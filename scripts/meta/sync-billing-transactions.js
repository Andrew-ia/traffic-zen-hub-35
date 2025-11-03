#!/usr/bin/env node
/**
 * Sincroniza transações de cobrança do Meta Ads (/transactions)
 *
 * Uso:
 *   node scripts/meta/sync-billing-transactions.js --days=30
 */

import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const args = process.argv.slice(2);
const daysArg = args.find((arg) => arg.startsWith("--days="));
const SYNC_DAYS = daysArg ? Number(daysArg.split("=")[1]) : 30;

const {
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_WORKSPACE_ID,
  SUPABASE_DATABASE_URL,
} = process.env;

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildUrl(path, params = {}) {
  const url = new URL(`${GRAPH_URL}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  return url;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
}

function parseAmount(value) {
  if (value === undefined || value === null) return 0;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchTransactions(accessToken, adAccountId, sinceDate, untilDate) {
  const transactions = [];

  let nextUrl = buildUrl(`act_${adAccountId}/transactions`, {
    fields: [
      "id",
      "created_time",
      "amount",
      "currency",
      "payment_method_type",
      "payment_method_subtype",
      "payment_method_details",
      "payment_status",
      "billing_reason",
    ].join(","),
    start_time: sinceDate,
    end_time: untilDate,
    limit: "100",
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      transactions.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return transactions;
}

async function upsertTransactions(client, workspaceId, platformAccountId, transactions) {
  if (transactions.length === 0) return 0;
  let inserted = 0;

  for (const tx of transactions) {
    const payload = {
      id: tx.id ?? null,
      created_time: tx.created_time ?? null,
      amount: parseAmount(tx.amount),
      currency: tx.currency ?? null,
      payment_method_type: tx.payment_method_type ?? null,
      payment_method_subtype: tx.payment_method_subtype ?? null,
      payment_status: tx.payment_status ?? null,
      billing_reason: tx.billing_reason ?? null,
      payment_method_details: tx.payment_method_details ?? null,
    };

    await client.query(
      `
        INSERT INTO billing_transactions (
          workspace_id,
          platform_account_id,
          external_id,
          transaction_time,
          amount,
          currency,
          payment_method_type,
          payment_method_details,
          payment_status,
          billing_reason,
          raw_payload,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW()
        )
        ON CONFLICT (platform_account_id, external_id) DO UPDATE
        SET
          transaction_time = EXCLUDED.transaction_time,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          payment_method_type = EXCLUDED.payment_method_type,
          payment_method_details = EXCLUDED.payment_method_details,
          payment_status = EXCLUDED.payment_status,
          billing_reason = EXCLUDED.billing_reason,
          raw_payload = EXCLUDED.raw_payload,
          updated_at = NOW()
      `,
      [
        workspaceId,
        platformAccountId,
        payload.id,
        payload.created_time ? new Date(payload.created_time).toISOString() : null,
        payload.amount,
        payload.currency,
        payload.payment_method_type ?? payload.payment_method_subtype ?? null,
        JSON.stringify({
          payment_method_type: payload.payment_method_type ?? null,
          payment_method_subtype: payload.payment_method_subtype ?? null,
          payment_method_details: payload.payment_method_details ?? null,
        }),
        payload.payment_status,
        payload.billing_reason,
        JSON.stringify(tx ?? {}),
      ],
    );

    inserted++;
  }

  return inserted;
}

async function main() {
  try {
    const accessToken = assertEnv(META_ACCESS_TOKEN, "META_ACCESS_TOKEN");
    const adAccountId = assertEnv(META_AD_ACCOUNT_ID, "META_AD_ACCOUNT_ID");
    const workspaceId = assertEnv(META_WORKSPACE_ID, "META_WORKSPACE_ID");
    const databaseUrl = assertEnv(SUPABASE_DATABASE_URL, "SUPABASE_DATABASE_URL");

    const today = new Date();
    const since = new Date();
    since.setDate(today.getDate() - (SYNC_DAYS - 1));

    const sinceDate = since.toISOString().slice(0, 10);
    const untilDate = today.toISOString().slice(0, 10);

    console.log(`\n💳 Sincronizando transações de cobrança do Meta Ads`);
    console.log(`📅 Período: ${sinceDate} → ${untilDate}`);

    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    try {
      const { rows } = await client.query(
        `SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
        [workspaceId],
      );

      if (rows.length === 0) {
        throw new Error("Conta Meta não encontrada. Execute scripts/meta/sync-campaigns.js primeiro.");
      }

      const platformAccountId = rows[0].id;

      const transactions = await fetchTransactions(accessToken, adAccountId, sinceDate, untilDate);
      console.log(`✅ ${transactions.length} transações encontradas`);

      if (transactions.length > 0) {
        const inserted = await upsertTransactions(client, workspaceId, platformAccountId, transactions);
        console.log(`💾 ${inserted} transações salvas/atualizadas em billing_transactions`);
      }
    } finally {
      await client.end();
    }

    console.log("🏁 Sincronização concluída\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Falha ao sincronizar transações do Meta:", error.message);
    process.exit(1);
  }
}

main();


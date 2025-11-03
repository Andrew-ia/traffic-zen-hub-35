import { Client } from "pg";

export class BillingSyncError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "BillingSyncError";
    this.status = status;
  }
}

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface SyncOptions {
  days?: number;
  accessToken?: string;
  adAccountId?: string;
  workspaceId?: string;
  databaseUrl?: string;
}

interface SyncResult {
  transactionsFound: number;
  transactionsUpserted: number;
  sinceDate: string;
  untilDate: string;
}

function assertEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${GRAPH_URL}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  return url;
}

async function fetchJson(url: URL) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
}

function parseAmount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchTransactions(accessToken: string, adAccountId: string, sinceDate: string, untilDate: string) {
  const transactions: any[] = [];

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

  try {
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
  } catch (error) {
    if (error instanceof Error && error.message.includes("nonexisting field (transactions)")) {
      throw new BillingSyncError(
        "A API do Meta não retornou o extrato de cobranças para essa conta. Verifique se o app possui permissões de cobrança (billing) ou se a conta está configurada para cobranças diretas.",
        400,
      );
    }
    throw error;
  }

  return transactions;
}

async function upsertTransactions(
  client: Client,
  workspaceId: string,
  platformAccountId: string,
  transactions: any[],
): Promise<number> {
  if (transactions.length === 0) return 0;
  let count = 0;

  for (const tx of transactions) {
    const amount = parseAmount(tx.amount);
    const paymentMethodType = tx.payment_method_type ?? tx.payment_method_subtype ?? null;

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
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, NOW()
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
        tx.id ?? null,
        tx.created_time ? new Date(tx.created_time).toISOString() : null,
        amount,
        tx.currency ?? null,
        paymentMethodType,
        JSON.stringify({
          payment_method_type: tx.payment_method_type ?? null,
          payment_method_subtype: tx.payment_method_subtype ?? null,
          payment_method_details: tx.payment_method_details ?? null,
        }),
        tx.payment_status ?? null,
        tx.billing_reason ?? null,
        JSON.stringify(tx ?? {}),
      ],
    );

    count++;
  }

  return count;
}

export async function syncMetaBillingTransactions({
  days = 30,
  accessToken,
  adAccountId,
  workspaceId,
  databaseUrl,
}: SyncOptions = {}): Promise<SyncResult> {
  const resolvedAccessToken = assertEnv(accessToken ?? process.env.META_ACCESS_TOKEN, "META_ACCESS_TOKEN");
  const resolvedAdAccountId = assertEnv(adAccountId ?? process.env.META_AD_ACCOUNT_ID, "META_AD_ACCOUNT_ID");
  const resolvedWorkspaceId = assertEnv(workspaceId ?? process.env.META_WORKSPACE_ID, "META_WORKSPACE_ID");
  const resolvedDatabaseUrl = assertEnv(databaseUrl ?? process.env.SUPABASE_DATABASE_URL, "SUPABASE_DATABASE_URL");

  const today = new Date();
  const since = new Date();
  since.setDate(today.getDate() - (days - 1));

  const sinceDate = since.toISOString().slice(0, 10);
  const untilDate = today.toISOString().slice(0, 10);

  const client = new Client({
    connectionString: resolvedDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
      [resolvedWorkspaceId],
    );

    if (rows.length === 0) {
      throw new Error("Conta Meta não encontrada. Execute scripts/meta/sync-campaigns.js primeiro.");
    }

    const platformAccountId = rows[0].id as string;

    const transactions = await fetchTransactions(resolvedAccessToken, resolvedAdAccountId, sinceDate, untilDate);
    const upserted = await upsertTransactions(client, resolvedWorkspaceId, platformAccountId, transactions);

    return {
      transactionsFound: transactions.length,
      transactionsUpserted: upserted,
      sinceDate,
      untilDate,
    };
  } finally {
    await client.end();
  }
}

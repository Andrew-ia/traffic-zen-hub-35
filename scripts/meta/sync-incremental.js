#!/usr/bin/env node
/**
 * Script de sincronização incremental do Meta Ads
 * Permite sincronizar apenas campanhas e métricas de um período específico
 *
 * Uso:
 * node scripts/meta/sync-incremental.js --days 7
 * node scripts/meta/sync-incremental.js --days 30 --campaigns-only
 * node scripts/meta/sync-incremental.js --days 1 --metrics-only
 */

import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Parse arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const SYNC_DAYS = daysArg ? Number(daysArg.split('=')[1]) : Number(process.env.SYNC_DAYS ?? 7);
const CAMPAIGNS_ONLY = args.includes('--campaigns-only');
const METRICS_ONLY = args.includes('--metrics-only');

const {
  META_APP_ID,
  META_APP_SECRET,
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

function mapCampaignStatus(status) {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "ACTIVE":
    case "IN_PROCESS":
    case "PENDING":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
    case "DELETED":
      return "archived";
    case "PENDING_REVIEW":
    case "DISAPPROVED":
      return "draft";
    default:
      return "draft";
  }
}

function mapAdSetStatus(status) {
  return mapCampaignStatus(status);
}

function mapAdStatus(status) {
  return mapCampaignStatus(status);
}

function centsToNumber(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return null;
  return asNumber / 100;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
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

// Get campaigns updated since X days
async function fetchRecentCampaigns(accessToken, adAccountId, days) {
  const campaigns = [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  let nextUrl = buildUrl(`act_${adAccountId}/campaigns`, {
    fields: [
      "id",
      "name",
      "status",
      "effective_status",
      "objective",
      "start_time",
      "stop_time",
      "daily_budget",
      "lifetime_budget",
      "created_time",
      "updated_time",
    ].join(","),
    filtering: JSON.stringify([
      {
        field: "updated_time",
        operator: "GREATER_THAN",
        value: sinceTimestamp,
      },
    ]),
    limit: "100",
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      campaigns.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return campaigns;
}

async function fetchAdSetsByCampaigns(accessToken, campaignIds) {
  if (campaignIds.length === 0) return [];

  const adSets = [];
  for (const campaignId of campaignIds) {
    const url = buildUrl(`${campaignId}/adsets`, {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "campaign_id",
        "start_time",
        "end_time",
        "daily_budget",
        "lifetime_budget",
        "bid_strategy",
        "bid_amount",
        "targeting",
        "created_time",
        "updated_time",
      ].join(","),
      limit: "100",
      access_token: accessToken,
    });

    const data = await fetchJson(url);
    if (Array.isArray(data.data)) {
      adSets.push(...data.data);
    }
  }

  return adSets;
}

async function fetchAdsByAdSets(accessToken, adSetIds) {
  if (adSetIds.length === 0) return [];

  const ads = [];
  for (const adSetId of adSetIds) {
    const url = buildUrl(`${adSetId}/ads`, {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "adset_id",
        "created_time",
        "updated_time",
        "creative{id,name}",
      ].join(","),
      limit: "100",
      access_token: accessToken,
    });

    const data = await fetchJson(url);
    if (Array.isArray(data.data)) {
      ads.push(...data.data);
    }
  }

  return ads;
}

async function fetchInsightsForPeriod(accessToken, adAccountId, days, level) {
  const insights = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days + 1);

  const since = startDate.toISOString().slice(0, 10);
  const until = today.toISOString().slice(0, 10);

  const levelSpecific = {
    account: [],
    campaign: ["campaign_id"],
    adset: ["campaign_id", "adset_id"],
    ad: ["campaign_id", "adset_id", "ad_id"],
  };

  const fields = [
    "date_start",
    "date_stop",
    "impressions",
    "reach",
    "frequency",
    "clicks",
    "unique_clicks",
    "spend",
    "cpm",
    "cpc",
    "ctr",
    "actions",
    "action_values",
    "inline_link_clicks",
    "inline_post_engagement",
    "outbound_clicks",
    "outbound_clicks_ctr",
    "purchase_roas",
    ...(levelSpecific[level] ?? []),
  ];

  let nextUrl = buildUrl(`act_${adAccountId}/insights`, {
    fields: fields.join(","),
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    level,
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      insights.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return insights;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function deriveBudgetType(adSet) {
  if (adSet.lifetime_budget) return "lifetime";
  if (adSet.daily_budget) return "daily";
  return null;
}

async function upsertCampaign(client, workspaceId, platformAccountId, campaign) {
  const settings = {
    effective_status: campaign.effective_status,
    created_time: campaign.created_time,
    updated_time: campaign.updated_time,
  };

  await client.query(
    `
      INSERT INTO campaigns (
        workspace_id,
        platform_account_id,
        external_id,
        name,
        objective,
        status,
        source,
        start_date,
        end_date,
        daily_budget,
        lifetime_budget,
        targeting,
        settings,
        last_synced_at,
        archived,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'synced', $7, $8, $9, $10, '{}'::jsonb, $11::jsonb, now(), false, now()
      )
      ON CONFLICT (platform_account_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        objective = EXCLUDED.objective,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        settings = EXCLUDED.settings,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      workspaceId,
      platformAccountId,
      campaign.id,
      campaign.name,
      campaign.objective,
      mapCampaignStatus(campaign.status),
      toDate(campaign.start_time),
      toDate(campaign.stop_time),
      centsToNumber(campaign.daily_budget),
      centsToNumber(campaign.lifetime_budget),
      JSON.stringify(settings),
    ],
  );
}

async function upsertAdSet(client, platformAccountId, campaignId, adSet) {
  const settings = {
    effective_status: adSet.effective_status,
    created_time: adSet.created_time,
    updated_time: adSet.updated_time,
  };

  await client.query(
    `
      INSERT INTO ad_sets (
        campaign_id,
        platform_account_id,
        external_id,
        name,
        status,
        start_date,
        end_date,
        bid_strategy,
        bid_amount,
        budget_type,
        daily_budget,
        lifetime_budget,
        targeting,
        settings,
        last_synced_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, now(), now()
      )
      ON CONFLICT (campaign_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        bid_strategy = EXCLUDED.bid_strategy,
        bid_amount = EXCLUDED.bid_amount,
        budget_type = EXCLUDED.budget_type,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        targeting = EXCLUDED.targeting,
        settings = EXCLUDED.settings,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      campaignId,
      platformAccountId,
      adSet.id,
      adSet.name,
      mapAdSetStatus(adSet.status),
      toDate(adSet.start_time),
      toDate(adSet.end_time),
      adSet.bid_strategy,
      centsToNumber(adSet.bid_amount),
      deriveBudgetType(adSet),
      centsToNumber(adSet.daily_budget),
      centsToNumber(adSet.lifetime_budget),
      JSON.stringify(adSet.targeting ?? {}),
      JSON.stringify(settings),
    ],
  );
}

async function upsertAd(client, platformAccountId, adSetId, ad, creativeAssetId = null) {
  const metadata = {
    effective_status: ad.effective_status,
    created_time: ad.created_time,
    updated_time: ad.updated_time,
    creative_id: ad.creative?.id ?? null,
    creative_name: ad.creative?.name ?? null,
  };

  await client.query(
    `
      INSERT INTO ads (
        ad_set_id,
        platform_account_id,
        creative_asset_id,
        external_id,
        name,
        status,
        last_synced_at,
        metadata,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, now(), $7::jsonb, now()
      )
      ON CONFLICT (ad_set_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        creative_asset_id = EXCLUDED.creative_asset_id,
        metadata = EXCLUDED.metadata,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      adSetId,
      platformAccountId,
      creativeAssetId,
      ad.id,
      ad.name,
      mapAdStatus(ad.status),
      JSON.stringify(metadata),
    ],
  );
}

function extractActionValue(actions = [], actionValues = [], actionType) {
  const actionEntry = actions.find((action) => action.action_type === actionType);
  const valueEntry = actionValues.find((action) => action.action_type === actionType);
  return {
    count: actionEntry ? Number(actionEntry.value ?? 0) : 0,
    value: valueEntry ? Number(valueEntry.value ?? 0) : 0,
  };
}

async function upsertMetrics(client, workspaceId, platformAccountId, rows, level, idMaps) {
  for (const row of rows) {
    const metricDate = row.date_start;
    const { count: conversions, value: conversionValue } = extractActionValue(
      row.actions,
      row.action_values,
      "purchase"
    );
    const roasEntry = row.purchase_roas?.[0];

    let campaignId = null;
    let adSetId = null;
    let adId = null;

    if (level === "campaign") {
      campaignId = idMaps.campaigns.get(row.campaign_id);
      if (!campaignId) continue;
    } else if (level === "adset") {
      const internal = idMaps.adsets.get(row.adset_id);
      if (!internal) continue;
      adSetId = internal.id;
      campaignId = internal.campaignId;
    } else if (level === "ad") {
      const internal = idMaps.ads.get(row.ad_id);
      if (!internal) continue;
      adId = internal.id;
      adSetId = internal.adSetId;
      campaignId = internal.campaignId;
    }

    await client.query(
      `
        INSERT INTO performance_metrics (
          workspace_id,
          platform_account_id,
          campaign_id,
          ad_set_id,
          ad_id,
          granularity,
          metric_date,
          currency,
          impressions,
          clicks,
          spend,
          ctr,
          cpc,
          cpa,
          roas,
          conversions,
          conversion_value,
          extra_metrics,
          synced_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 'day', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, now()
        )
        ON CONFLICT (workspace_id, platform_account_id,
                     COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid),
                     COALESCE(ad_set_id, '00000000-0000-0000-0000-000000000000'::uuid),
                     COALESCE(ad_id, '00000000-0000-0000-0000-000000000000'::uuid),
                     granularity, metric_date)
        DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend,
          ctr = EXCLUDED.ctr,
          cpc = EXCLUDED.cpc,
          cpa = EXCLUDED.cpa,
          roas = EXCLUDED.roas,
          conversions = EXCLUDED.conversions,
          conversion_value = EXCLUDED.conversion_value,
          extra_metrics = EXCLUDED.extra_metrics,
          synced_at = now();
      `,
      [
        workspaceId,
        platformAccountId,
        campaignId,
        adSetId,
        adId,
        metricDate,
        row.account_currency ?? "BRL",
        Number(row.impressions ?? 0),
        Number(row.clicks ?? 0),
        Number(row.spend ?? 0),
        Number(row.ctr ?? 0),
        Number(row.cpc ?? 0),
        0,
        roasEntry ? Number(roasEntry.value ?? 0) : Number(row.roas ?? 0),
        conversions,
        conversionValue,
        JSON.stringify({
          reach: Number(row.reach ?? 0),
          frequency: Number(row.frequency ?? 0),
          unique_clicks: Number(row.unique_clicks ?? 0),
          inline_link_clicks: Number(row.inline_link_clicks ?? 0),
          inline_post_engagement: Number(row.inline_post_engagement ?? 0),
          outbound_clicks: row.outbound_clicks ?? [],
          outbound_clicks_ctr: row.outbound_clicks_ctr ?? [],
          actions: row.actions ?? [],
          action_values: row.action_values ?? [],
        }),
      ],
    );
  }
}

async function updateIntegrationSync(client, workspaceId) {
  await client.query(
    `
      UPDATE workspace_integrations
      SET last_synced_at = now(), updated_at = now()
      WHERE workspace_id = $1 AND platform_key = 'meta'
    `,
    [workspaceId],
  );
}

async function main() {
  try {
    const accessToken = assertEnv(META_ACCESS_TOKEN, "META_ACCESS_TOKEN");
    assertEnv(META_APP_ID, "META_APP_ID");
    assertEnv(META_APP_SECRET, "META_APP_SECRET");
    const adAccountId = assertEnv(META_AD_ACCOUNT_ID, "META_AD_ACCOUNT_ID");
    const workspaceId = assertEnv(META_WORKSPACE_ID, "META_WORKSPACE_ID");
    const databaseUrl = assertEnv(SUPABASE_DATABASE_URL, "SUPABASE_DATABASE_URL");

    console.log(`\n🔄 Iniciando sincronização incremental do Meta Ads`);
    console.log(`📅 Período: últimos ${SYNC_DAYS} dias`);
    if (CAMPAIGNS_ONLY) console.log(`📊 Modo: Apenas campanhas`);
    if (METRICS_ONLY) console.log(`📈 Modo: Apenas métricas`);
    console.log('');

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const { rows } = await client.query(
        `SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
        [workspaceId],
      );

      if (rows.length === 0) {
        throw new Error("Conta Meta não encontrada. Execute sync-campaigns.js primeiro.");
      }

      const platformAccountId = rows[0].id;

      // Sync campaigns
      if (!METRICS_ONLY) {
        console.log(`📥 Buscando campanhas atualizadas nos últimos ${SYNC_DAYS} dias...`);
        const campaigns = await fetchRecentCampaigns(accessToken, adAccountId, SYNC_DAYS);
        console.log(`✅ ${campaigns.length} campanhas encontradas`);

        if (campaigns.length > 0) {
          for (const campaign of campaigns) {
            await upsertCampaign(client, workspaceId, platformAccountId, campaign);
          }
          console.log(`💾 Campanhas sincronizadas`);

          // Fetch ad sets for these campaigns
          const campaignIds = campaigns.map(c => c.id);
          console.log(`📥 Buscando ad sets das campanhas...`);
          const adSets = await fetchAdSetsByCampaigns(accessToken, campaignIds);
          console.log(`✅ ${adSets.length} ad sets encontrados`);

          // Build campaign ID map
          const { rows: campaignRows } = await client.query(
            `SELECT external_id, id FROM campaigns WHERE platform_account_id = $1`,
            [platformAccountId],
          );
          const campaignIdMap = new Map(campaignRows.map((row) => [row.external_id, row.id]));

          for (const adSet of adSets) {
            const campaignId = campaignIdMap.get(adSet.campaign_id);
            if (campaignId) {
              await upsertAdSet(client, platformAccountId, campaignId, adSet);
            }
          }
          console.log(`💾 Ad sets sincronizados`);

          // Fetch ads for these ad sets
          const adSetIds = adSets.map(a => a.id);
          console.log(`📥 Buscando anúncios...`);
          const ads = await fetchAdsByAdSets(accessToken, adSetIds);
          console.log(`✅ ${ads.length} anúncios encontrados`);

          // Build ad set ID map
          const { rows: adSetRows } = await client.query(
            `SELECT external_id, id FROM ad_sets WHERE platform_account_id = $1`,
            [platformAccountId],
          );
          const adSetIdMap = new Map(adSetRows.map((row) => [row.external_id, row.id]));

          for (const ad of ads) {
            const adSetId = adSetIdMap.get(ad.adset_id);
            if (adSetId) {
              await upsertAd(client, platformAccountId, adSetId, ad);
            }
          }
          console.log(`💾 Anúncios sincronizados\n`);
        }
      }

      // Sync metrics
      if (!CAMPAIGNS_ONLY) {
        console.log(`📊 Sincronizando métricas dos últimos ${SYNC_DAYS} dias...`);

        // Build ID maps
        const { rows: campaignRows } = await client.query(
          `SELECT external_id, id FROM campaigns WHERE platform_account_id = $1`,
          [platformAccountId],
        );
        const campaignIdMap = new Map(campaignRows.map((row) => [row.external_id, row.id]));

        const { rows: adSetRows } = await client.query(
          `SELECT id, external_id, campaign_id FROM ad_sets WHERE platform_account_id = $1`,
          [platformAccountId],
        );
        const adSetIdMap = new Map(
          adSetRows.map((row) => [row.external_id, { id: row.id, campaignId: row.campaign_id }]),
        );

        const { rows: adRows } = await client.query(
          `
            SELECT ads.id, ads.external_id, ads.ad_set_id, ad_sets.campaign_id
            FROM ads
            LEFT JOIN ad_sets ON ad_sets.id = ads.ad_set_id
            WHERE ads.platform_account_id = $1
          `,
          [platformAccountId],
        );
        const adIdMap = new Map(
          adRows.map((row) => [
            row.external_id,
            { id: row.id, adSetId: row.ad_set_id, campaignId: row.campaign_id },
          ]),
        );

        const levels = ["account", "campaign", "adset", "ad"];

        for (const level of levels) {
          console.log(`📈 Buscando métricas nivel ${level}...`);
          const insights = await fetchInsightsForPeriod(accessToken, adAccountId, SYNC_DAYS, level);
          console.log(`✅ ${insights.length} registros encontrados`);

          if (insights.length > 0) {
            await upsertMetrics(client, workspaceId, platformAccountId, insights, level, {
              campaigns: campaignIdMap,
              adsets: adSetIdMap,
              ads: adIdMap,
            });
            console.log(`💾 Métricas ${level} sincronizadas`);
          }
        }
      }

      // Update integration sync timestamp
      await updateIntegrationSync(client, workspaceId);

      console.log(`\n✅ Sincronização incremental concluída com sucesso!`);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("\n❌ Erro na sincronização:", error);
    process.exitCode = 1;
  }
}

main();

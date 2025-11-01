#!/usr/bin/env node
import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const BACKFILL_DAYS = Number(process.env.META_BACKFILL_DAYS ?? 30);
const BATCH_DAYS = Number(process.env.META_BACKFILL_BATCH_DAYS ?? 7);
const MAX_RETRIES = Number(process.env.META_BACKFILL_MAX_RETRIES ?? 5);
const RATE_LIMIT_SLEEP_MS = Number(process.env.META_RATE_LIMIT_SLEEP_MS ?? 60000);
const REQUEST_COOLDOWN_MS = Number(process.env.META_REQUEST_COOLDOWN_MS ?? 1200);

const BREAKDOWN_CONFIGS = [
  { key: "age", breakdowns: ["age"], dimensions: ["age"] },
  { key: "gender", breakdowns: ["gender"], dimensions: ["gender"] },
  { key: "age_gender", breakdowns: ["age", "gender"], dimensions: ["age", "gender"] },
  { key: "country", breakdowns: ["country"], dimensions: ["country"] },
  { key: "device_platform", breakdowns: ["device_platform"], dimensions: ["device_platform"] },
  {
    key: "publisher_platform",
    breakdowns: ["publisher_platform", "platform_position"],
    dimensions: ["publisher_platform", "platform_position"],
  },
  { key: "impression_device", breakdowns: ["impression_device"], dimensions: ["impression_device"] },
];

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchJson(url, attempt = 0) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = undefined;
    }

    const errorCode = payload?.error?.code;
    if ((errorCode === 4 || errorCode === 613 || payload?.error?.is_transient) && attempt < MAX_RETRIES) {
      console.warn(`Rate limit or transient error detected (code ${errorCode}). Waiting ${RATE_LIMIT_SLEEP_MS / 1000}s before retry (${attempt + 1}/${MAX_RETRIES}).`);
      await sleep(RATE_LIMIT_SLEEP_MS);
      return fetchJson(url, attempt + 1);
    }

    throw new Error(`Meta Insights error ${response.status}: ${text}`);
  }
  return response.json();
}

function chunkDates(startDate, endDate, chunkSize) {
  const ranges = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + chunkSize - 1);
    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime());
    }
    ranges.push({
      since: new Date(cursor),
      until: new Date(chunkEnd),
    });
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  return ranges;
}

async function fetchInsights(accessToken, adAccountId, since, until, level) {
  const baseFields = [
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
  ];

  const levelSpecific = {
    account: [],
    campaign: ["campaign_id"],
    adset: ["campaign_id", "adset_id"],
    ad: ["campaign_id", "adset_id", "ad_id"],
  };

  const fields = [...baseFields, ...(levelSpecific[level] ?? [])];

  const url = buildUrl(`act_${adAccountId}/insights`, {
    fields: fields.join(","),
    time_range: JSON.stringify({
      since,
      until,
    }),
    time_increment: "1",
    breakdowns: [],
    level,
    access_token: accessToken,
  });

  const all = [];
  let nextUrl = url;

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      all.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return all;
}

function extractActionValue(actions = [], actionValues = [], actionType) {
  const actionEntry = actions.find((action) => action.action_type === actionType);
  const valueEntry = actionValues.find((action) => action.action_type === actionType);
  return {
    count: actionEntry ? Number(actionEntry.value ?? 0) : 0,
    value: valueEntry ? Number(valueEntry.value ?? 0) : 0,
  };
}

function buildDimensionValues(row, dimensions) {
  const values = {};
  for (const dimension of dimensions) {
    const value = row[dimension];
    values[dimension] = value === undefined || value === null || value === "" ? "unknown" : value;
  }
  return values;
}

function serializeDimensionKey(dimensionValues) {
  return Object.keys(dimensionValues)
    .sort()
    .map((key) => `${key}:${dimensionValues[key]}`)
    .join("|");
}

async function fetchBreakdownInsights(accessToken, adAccountId, since, until, level, breakdownConfig) {
  const baseFields = [
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
  ];

  const levelSpecific = {
    account: [],
    campaign: ["campaign_id"],
    adset: ["campaign_id", "adset_id"],
    ad: ["campaign_id", "adset_id", "ad_id"],
  };

  const fields = [...baseFields, ...(levelSpecific[level] ?? [])];

  const url = buildUrl(`act_${adAccountId}/insights`, {
    fields: fields.join(","),
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    breakdowns: breakdownConfig.breakdowns.join(","),
    level,
    access_token: accessToken,
  });

  const all = [];
  let nextUrl = url;

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      all.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return all;
}

async function upsertBreakdownMetrics(client, workspaceId, platformAccountId, rows, level, idMaps, breakdownConfig) {
  for (const row of rows) {
    const metricDate = row.date_start;
    const { count: conversions, value: conversionValue } = extractActionValue(row.actions, row.action_values, "purchase");
    const roasEntry = row.purchase_roas?.[0];

    let campaignId = null;
    let adSetId = null;
    let adId = null;

    if (level === "campaign") {
      const internalId = idMaps.campaigns.get(row.campaign_id);
      if (!internalId) {
        console.warn(`Skipping ${breakdownConfig.key} campaign breakdown for ${row.campaign_id} (not found locally)`);
        continue;
      }
      campaignId = internalId;
    } else if (level === "adset") {
      const internal = idMaps.adsets.get(row.adset_id);
      if (!internal) {
        console.warn(`Skipping ${breakdownConfig.key} ad set breakdown for ${row.adset_id} (not found locally)`);
        continue;
      }
      adSetId = internal.id;
      campaignId = internal.campaignId ?? campaignId;
    } else if (level === "ad") {
      const internal = idMaps.ads.get(row.ad_id);
      if (!internal) {
        console.warn(`Skipping ${breakdownConfig.key} ad breakdown for ${row.ad_id} (not found locally)`);
        continue;
      }
      adId = internal.id;
      adSetId = internal.adSetId ?? adSetId;
      campaignId = internal.campaignId ?? campaignId;
    }

    const dimensionValues = buildDimensionValues(row, breakdownConfig.dimensions);
    const breakdownValueKey = serializeDimensionKey(dimensionValues);

    await client.query(
      `
        INSERT INTO performance_metric_breakdowns (
          workspace_id,
          platform_account_id,
          campaign_id,
          ad_set_id,
          ad_id,
          granularity,
          metric_date,
          breakdown_key,
          breakdown_value_key,
          dimension_values,
          currency,
          impressions,
          clicks,
          spend,
          conversions,
          conversion_value,
          extra_metrics,
          synced_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'day',
          $6,
          $7,
          $8,
          $9::jsonb,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16::jsonb,
          now()
        )
        ON CONFLICT (
          workspace_id,
          platform_account_id,
          campaign_id,
          ad_set_id,
          ad_id,
          granularity,
          metric_date,
          breakdown_key,
          breakdown_value_key
        )
        DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend,
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
        breakdownConfig.key,
        breakdownValueKey,
        JSON.stringify(dimensionValues),
        row.account_currency ?? "BRL",
        Number(row.impressions ?? 0),
        Number(row.clicks ?? 0),
        Number(row.spend ?? 0),
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

async function upsertMetrics(client, workspaceId, platformAccountId, rows, level, idMaps) {
  for (const row of rows) {
    const metricDate = row.date_start;
    const { count: conversions, value: conversionValue } = extractActionValue(row.actions, row.action_values, "purchase");
    const roasEntry = row.purchase_roas?.[0];

    let campaignId = null;
    let adSetId = null;
    let adId = null;

    if (level === "campaign") {
      const internalId = idMaps.campaigns.get(row.campaign_id);
      if (!internalId) {
        console.warn(`Skipping campaign insight for ${row.campaign_id} (not found locally)`);
        continue;
      }
      campaignId = internalId;
    } else if (level === "adset") {
      const internal = idMaps.adsets.get(row.adset_id);
      if (!internal) {
        console.warn(`Skipping ad set insight for ${row.adset_id} (not found locally)`);
        continue;
      }
      adSetId = internal.id;
      campaignId = internal.campaignId ?? campaignId;
    } else if (level === "ad") {
      const internal = idMaps.ads.get(row.ad_id);
      if (!internal) {
        console.warn(`Skipping ad insight for ${row.ad_id} (not found locally)`);
        continue;
      }
      adId = internal.id;
      adSetId = internal.adSetId ?? adSetId;
      campaignId = internal.campaignId ?? campaignId;
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
          $1,
          $2,
          $3,
          $4,
          $5,
          'day',
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::jsonb,
          now()
        )
        ON CONFLICT (workspace_id, platform_account_id, campaign_id, ad_set_id, ad_id, granularity, metric_date)
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

async function main() {
  try {
    const accessToken = assertEnv(META_ACCESS_TOKEN, "META_ACCESS_TOKEN");
    const adAccountId = assertEnv(META_AD_ACCOUNT_ID, "META_AD_ACCOUNT_ID");
    const workspaceId = assertEnv(META_WORKSPACE_ID, "META_WORKSPACE_ID");
    const databaseUrl = assertEnv(SUPABASE_DATABASE_URL, "SUPABASE_DATABASE_URL");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const { rows } = await client.query(
        `
          SELECT id
          FROM platform_accounts
          WHERE workspace_id = $1 AND platform_key = 'meta'
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [workspaceId],
      );

      if (rows.length === 0) {
        throw new Error("No Meta platform account found for this workspace. Sync campaigns first.");
      }

      const platformAccountId = rows[0].id;

      const campaignRows = await client.query(
        `SELECT id, external_id FROM campaigns WHERE platform_account_id = $1`,
        [platformAccountId],
      );
      const campaignIdMap = new Map(campaignRows.rows.map((row) => [row.external_id, row.id]));

      const adSetRows = await client.query(
        `SELECT id, external_id, campaign_id FROM ad_sets WHERE platform_account_id = $1`,
        [platformAccountId],
      );
      const adSetIdMap = new Map(
        adSetRows.rows.map((row) => [row.external_id, { id: row.id, campaignId: row.campaign_id }]),
      );

      const adRows = await client.query(
        `
          SELECT ads.id, ads.external_id, ads.ad_set_id, ad_sets.campaign_id
          FROM ads
          LEFT JOIN ad_sets ON ad_sets.id = ads.ad_set_id
          WHERE ads.platform_account_id = $1
        `,
        [platformAccountId],
      );
      const adIdMap = new Map(
        adRows.rows.map((row) => [row.external_id, { id: row.id, adSetId: row.ad_set_id, campaignId: row.campaign_id }]),
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - BACKFILL_DAYS + 1);

      const ranges = chunkDates(startDate, today, BATCH_DAYS);
      console.log(`Backfilling ${ranges.length} batches from ${startDate.toISOString().slice(0, 10)} to ${today.toISOString().slice(0, 10)}`);

      let totalRows = 0;

      for (const range of ranges) {
        const since = range.since.toISOString().slice(0, 10);
        const until = range.until.toISOString().slice(0, 10);
        console.log(`Fetching insights from ${since} to ${until}`);

        const levels = ["account", "campaign", "adset", "ad"];

        for (const level of levels) {
          const insights = await fetchInsights(accessToken, adAccountId, since, until, level);
          console.log(`Level ${level}: received ${insights.length} rows`);

          if (insights.length > 0) {
            await upsertMetrics(client, workspaceId, platformAccountId, insights, level, {
              campaigns: campaignIdMap,
              adsets: adSetIdMap,
              ads: adIdMap,
            });
            totalRows += insights.length;
          }

          await sleep(REQUEST_COOLDOWN_MS);

          for (const breakdownConfig of BREAKDOWN_CONFIGS) {
            const breakdownInsights = await fetchBreakdownInsights(
              accessToken,
              adAccountId,
              since,
              until,
              level,
              breakdownConfig,
            );
            console.log(`Level ${level} breakdown ${breakdownConfig.key}: received ${breakdownInsights.length} rows`);

            if (breakdownInsights.length > 0) {
              await upsertBreakdownMetrics(
                client,
                workspaceId,
                platformAccountId,
                breakdownInsights,
                level,
                {
                  campaigns: campaignIdMap,
                  adsets: adSetIdMap,
                  ads: adIdMap,
                },
                breakdownConfig,
              );
            }

            await sleep(Math.max(REQUEST_COOLDOWN_MS, 1000));
          }
        }
      }

      console.log(`Backfill completed. Inserted/updated ${totalRows} daily records.`);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Meta backfill failed:", error);
    process.exitCode = 1;
  }
}

main();

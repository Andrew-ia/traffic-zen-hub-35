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

function mapMetaStatus(status) {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "ACTIVE":
    case "IN_PROCESS":
    case "PENDING":
    case "WITH_ISSUES":
      return "active";
    case "PAUSED":
    case "INACTIVE":
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

function resolveDeliveryStatus(primaryStatus, effectiveStatus) {
  const effectiveMapped = effectiveStatus ? mapMetaStatus(effectiveStatus) : null;
  if (effectiveMapped) {
    if (effectiveMapped === "paused" || effectiveMapped === "archived") {
      return effectiveMapped;
    }
    if (effectiveMapped === "active") {
      return "active";
    }
  }
  return mapMetaStatus(primaryStatus);
}

function mapAdSetStatus(status, effectiveStatus) {
  return resolveDeliveryStatus(status, effectiveStatus);
}

function mapAdStatus(status, effectiveStatus) {
  return resolveDeliveryStatus(status, effectiveStatus);
}

function centsToNumber(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return null;
  return asNumber / 100;
}

// Helper to add delay between API requests to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limiter: wait 200ms between each Meta API request
const RATE_LIMIT_DELAY_MS = 200;

async function fetchJson(url) {
  // Add delay before each request to avoid hitting rate limits
  await delay(RATE_LIMIT_DELAY_MS);

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

  // Ensure adAccountId has act_ prefix (but don't duplicate if already present)
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  let nextUrl = buildUrl(`${accountId}/campaigns`, {
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
        "billing_event",
        "optimization_goal",
        "pacing_type",
        "campaign{daily_budget,budget_remaining,bid_strategy}",
        "targeting",
        "promoted_object",
        "destination_type",
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

async function fetchCreativeDetails(accessToken, creativeId) {
  const url = buildUrl(`${creativeId}`, {
    fields: ["id", "name", "body", "thumbnail_url", "image_url", "object_story_spec", "asset_feed_spec", "status"].join(","),
    access_token: accessToken,
  });
  return fetchJson(url);
}

function deriveCreativeType(creative) {
  const story = creative.object_story_spec ?? {};
  if (story.video_data) return "video";
  if (story.carousel_data) return "carousel";
  if (story.image_data) return "image";
  if (creative.image_url) return "image";
  return "text";
}

function buildCreativePayload(creative) {
  const story = creative.object_story_spec ?? {};
  const type = deriveCreativeType(creative);

  let storageUrl = creative.image_url ?? null;
  let thumbnailUrl = creative.thumbnail_url ?? storageUrl ?? null;
  let textContent = creative.body ?? null;
  let durationSeconds = null;
  let aspectRatio = null;

  if (story.video_data) {
    storageUrl = story.video_data.video_url ?? storageUrl;
    thumbnailUrl = story.video_data.image_url ?? thumbnailUrl;
    textContent = story.video_data.message ?? textContent;
  }

  if (story.image_data) {
    storageUrl = storageUrl ?? story.image_data.image_url ?? null;
    thumbnailUrl = story.image_data.image_url ?? thumbnailUrl;
    textContent = story.image_data.message ?? textContent;
  }

  if (story.link_data) {
    textContent = textContent ?? story.link_data.message ?? null;
  }

  if (story.carousel_data?.cards?.length) {
    textContent = textContent ?? story.carousel_data.cards.map((card) => card.title).filter(Boolean).join(" • ");
  }

  const metadata = {
    metaCreativeId: creative.id,
    object_story_spec: story,
    asset_feed_spec: creative.asset_feed_spec ?? null,
    body: creative.body ?? null,
    thumbnail_url: creative.thumbnail_url ?? null,
    image_url: creative.image_url ?? null,
    status: creative.status ?? null,
  };

  return {
    externalId: creative.id,
    name: creative.name ?? `Creative ${creative.id}`,
    type,
    storageUrl,
    thumbnailUrl,
    textContent,
    durationSeconds,
    aspectRatio,
    metadata,
    hash: creative.id,
  };
}

async function upsertCreativeAsset(client, workspaceId, creative) {
  const metadataJson = JSON.stringify({
    ...creative.metadata,
  });

  const existing = await client.query(
    `
      SELECT id
      FROM creative_assets
      WHERE workspace_id = $1
        AND metadata->>'metaCreativeId' = $2
      LIMIT 1
    `,
    [workspaceId, creative.externalId],
  );

  if (existing.rows[0]) {
    const creativeId = existing.rows[0].id;
    await client.query(
      `
        UPDATE creative_assets
        SET
          type = $2,
          name = $3,
          storage_url = $4,
          thumbnail_url = $5,
          duration_seconds = $6,
          aspect_ratio = $7,
          text_content = $8,
          metadata = $9::jsonb,
          hash = $10,
          updated_at = now()
        WHERE id = $1
      `,
      [
        creativeId,
        creative.type,
        creative.name,
        creative.storageUrl,
        creative.thumbnailUrl,
        creative.durationSeconds,
        creative.aspectRatio,
        creative.textContent,
        metadataJson,
        creative.hash,
      ],
    );
    return creativeId;
  }

  const insert = await client.query(
    `
      INSERT INTO creative_assets (
        workspace_id,
        type,
        name,
        storage_url,
        thumbnail_url,
        duration_seconds,
        aspect_ratio,
        text_content,
        hash,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id
    `,
    [
      workspaceId,
      creative.type,
      creative.name,
      creative.storageUrl,
      creative.thumbnailUrl,
      creative.durationSeconds,
      creative.aspectRatio,
      creative.textContent,
      creative.hash,
      metadataJson,
    ],
  );

  return insert.rows[0].id;
}

async function fetchInsightsForPeriod(accessToken, adAccountId, days, level) {
  const insights = [];
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1); // Use yesterday as "until" since today's data isn't complete yet
  const startDate = new Date(yesterday);
  startDate.setDate(startDate.getDate() - days + 1);

  const since = startDate.toISOString().slice(0, 10);
  const until = yesterday.toISOString().slice(0, 10);

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

  // Ensure adAccountId has act_ prefix (but don't duplicate if already present)
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  let nextUrl = buildUrl(`${accountId}/insights`, {
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
  if (adSet.campaign?.budget_remaining) return "campaign";
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
      resolveDeliveryStatus(campaign.status, campaign.effective_status),
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
    billing_event: adSet.billing_event ?? null,
    optimization_goal: adSet.optimization_goal ?? null,
    pacing_type: adSet.pacing_type ?? null,
    campaign_daily_budget: adSet.campaign?.daily_budget ? centsToNumber(adSet.campaign.daily_budget) : null,
    campaign_budget_remaining: adSet.campaign?.budget_remaining ? centsToNumber(adSet.campaign.budget_remaining) : null,
    campaign_bid_strategy: adSet.campaign?.bid_strategy ?? null,
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
        destination_type,
        promoted_object,
        settings,
        last_synced_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, $16::jsonb, now(), now()
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
        destination_type = EXCLUDED.destination_type,
        promoted_object = EXCLUDED.promoted_object,
        settings = EXCLUDED.settings,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      campaignId,
      platformAccountId,
      adSet.id,
      adSet.name,
      mapAdSetStatus(adSet.status, adSet.effective_status),
      toDate(adSet.start_time),
      toDate(adSet.end_time),
      adSet.bid_strategy ?? adSet.campaign?.bid_strategy ?? null,
      centsToNumber(adSet.bid_amount),
      deriveBudgetType(adSet),
      centsToNumber(adSet.daily_budget) ?? (adSet.campaign?.daily_budget ? centsToNumber(adSet.campaign.daily_budget) : null),
      centsToNumber(adSet.lifetime_budget),
      JSON.stringify(adSet.targeting ?? {}),
      adSet.destination_type || null,
      JSON.stringify(adSet.promoted_object ?? {}),
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
      mapAdStatus(ad.status, ad.effective_status),
      JSON.stringify(metadata),
    ],
  );
}

const ACTION_ALIASES = {
  conversationsStarted: [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.whatsapp_conversation_started_7d',
  ],
  messagingConnections: ['onsite_conversion.total_messaging_connection'],
  messagingFirstReply: ['onsite_conversion.messaging_first_reply'],
  instagramProfileVisit: [
    'onsite_conversion.instagram_profile_visit',
    'visit_instagram_profile',
    'onsite_conversion.profile_visit',
    'profile_visit',
  ],
  postSave: ['onsite_conversion.post_save'],
  instagramFollows: [
    'follow',
    'instagram_follow',
    'page_follow',
    'onsite_conversion.follow',
  ],
};

const PRIMARY_CONVERSION_PRIORITY = [
  ...ACTION_ALIASES.conversationsStarted,
  ...ACTION_ALIASES.messagingConnections,
  ...ACTION_ALIASES.messagingFirstReply,
  'offsite_conversion.fb_pixel_lead',
  'lead',
  'purchase',
  'omni_purchase',
  'complete_registration',
  'omni_complete_registration',
];

const SECONDARY_CONVERSION_PRIORITY = [
  ...ACTION_ALIASES.instagramProfileVisit,
  'landing_page_view',
  'link_click',
  'lead_generation',
  'action.conversion',
  'onsite_conversion.lead',
  ...ACTION_ALIASES.postSave,
];

function buildActionIndex(actions = [], actionValues = []) {
  const map = new Map();

  const ensureEntry = (type) => {
    if (!map.has(type)) {
      map.set(type, { count: 0, value: 0 });
    }
    return map.get(type);
  };

  for (const action of actions ?? []) {
    const type = action?.action_type;
    if (!type) continue;
    const count = Number(action?.value ?? 0);
    if (!Number.isFinite(count)) continue;
    ensureEntry(type).count += count;
  }

  for (const action of actionValues ?? []) {
    const type = action?.action_type;
    if (!type) continue;
    const value = Number(action?.value ?? 0);
    if (!Number.isFinite(value)) continue;
    ensureEntry(type).value += value;
  }

  return map;
}

function findActionFromIndex(index, types) {
  for (const type of types) {
    const entry = index.get(type);
    if (entry && entry.count > 0) {
      return { actionType: type, count: entry.count, value: entry.value };
    }
  }
  return null;
}

function resolvePrimaryConversionFromIndex(index, fallbackCount = 0) {
  const prioritized = findActionFromIndex(index, PRIMARY_CONVERSION_PRIORITY);
  if (prioritized) {
    return prioritized;
  }

  const secondary = findActionFromIndex(index, SECONDARY_CONVERSION_PRIORITY);
  if (secondary) {
    return secondary;
  }

  let largest = null;
  for (const [type, entry] of index.entries()) {
    if (entry.count > 0 && (!largest || entry.count > largest.count)) {
      largest = { actionType: type, count: entry.count, value: entry.value };
    }
  }

  if (largest) {
    return largest;
  }

  return {
    actionType: null,
    count: Number(fallbackCount ?? 0),
    value: 0,
  };
}

function sumAlias(index, aliasList) {
  return aliasList.reduce((total, type) => total + (index.get(type)?.count ?? 0), 0);
}

function sumAliasValues(index, aliasList) {
  return aliasList.reduce((total, type) => total + (index.get(type)?.value ?? 0), 0);
}

function collectDerivedMetrics(index) {
  const conversationsStarted = sumAlias(index, ACTION_ALIASES.conversationsStarted);
  const conversationsValue = sumAliasValues(index, ACTION_ALIASES.conversationsStarted);
  const messagingConnections = sumAlias(index, ACTION_ALIASES.messagingConnections);
  const messagingConnectionsValue = sumAliasValues(index, ACTION_ALIASES.messagingConnections);
  const messagingFirstReplies = sumAlias(index, ACTION_ALIASES.messagingFirstReply);
  const messagingFirstRepliesValue = sumAliasValues(index, ACTION_ALIASES.messagingFirstReply);
  const instagramProfileVisits = sumAlias(index, ACTION_ALIASES.instagramProfileVisit);
  const instagramProfileVisitsValue = sumAliasValues(index, ACTION_ALIASES.instagramProfileVisit);
  const postSaves = sumAlias(index, ACTION_ALIASES.postSave);
  const postSavesValue = sumAliasValues(index, ACTION_ALIASES.postSave);
  const instagramFollows = sumAlias(index, ACTION_ALIASES.instagramFollows);
  const instagramFollowsValue = sumAliasValues(index, ACTION_ALIASES.instagramFollows);

  return {
    counts: {
      conversations_started: conversationsStarted,
      messaging_connections: messagingConnections,
      messaging_first_replies: messagingFirstReplies,
      instagram_profile_visits: instagramProfileVisits,
      post_saves: postSaves,
      instagram_follows: instagramFollows,
    },
    values: {
      conversations_started: conversationsValue,
      messaging_connections: messagingConnectionsValue,
      messaging_first_replies: messagingFirstRepliesValue,
      instagram_profile_visits: instagramProfileVisitsValue,
      post_saves: postSavesValue,
      instagram_follows: instagramFollowsValue,
    },
  };
}

async function upsertMetrics(client, workspaceId, platformAccountId, rows, level, idMaps) {
  for (const row of rows) {
    const metricDate = row.date_start;

    const actionIndex = buildActionIndex(row.actions, row.action_values);
    const primaryConversion = resolvePrimaryConversionFromIndex(actionIndex, Number(row.conversions ?? 0));
    const derivedMetrics = collectDerivedMetrics(actionIndex);

    const conversions = primaryConversion.count;
    const conversionValue = primaryConversion.value;

    const spend = Number(row.spend ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.clicks ?? 0);

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;

    let roas = 0;
    if (spend > 0) {
      if (conversionValue > 0) {
        roas = conversionValue / spend;
      } else if (Array.isArray(row.purchase_roas) && row.purchase_roas[0]?.value) {
        roas = Number(row.purchase_roas[0].value ?? 0);
      } else if (Number.isFinite(Number(row.roas))) {
        roas = Number(row.roas ?? 0);
      }
    }

    const extraMetricsPayload = {
      reach: Number(row.reach ?? 0),
      frequency: Number(row.frequency ?? 0),
      unique_clicks: Number(row.unique_clicks ?? 0),
      inline_link_clicks: Number(row.inline_link_clicks ?? 0),
      inline_post_engagement: Number(row.inline_post_engagement ?? 0),
      outbound_clicks: row.outbound_clicks ?? [],
      outbound_clicks_ctr: row.outbound_clicks_ctr ?? [],
      actions: row.actions ?? [],
      action_values: row.action_values ?? [],
      derived_metrics: {
        counts: derivedMetrics.counts,
        values: derivedMetrics.values,
        primary_conversion_action: primaryConversion.actionType,
      },
    };

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
        clicks,
        spend,
        ctr,
        cpc,
        cpa,
        roas,
        conversions,
        conversionValue,
        JSON.stringify(extraMetricsPayload),
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

          // Collect unique creative IDs
          const creativeIds = new Set();
          for (const ad of ads) {
            if (ad.creative?.id) {
              creativeIds.add(ad.creative.id);
            }
          }

          // Fetch and upsert creative details
          const creativeIdToAssetId = new Map();
          if (creativeIds.size > 0) {
            console.log(`🎨 Buscando ${creativeIds.size} criativos únicos...`);
            let fetchedCount = 0;
            for (const creativeId of creativeIds) {
              try {
                const creativeData = await fetchCreativeDetails(accessToken, creativeId);
                const creativePayload = buildCreativePayload(creativeData);
                const assetId = await upsertCreativeAsset(client, workspaceId, creativePayload);
                creativeIdToAssetId.set(creativeId, assetId);
                fetchedCount++;
              } catch (error) {
                console.warn(`⚠️  Falha ao buscar criativo ${creativeId}:`, error.message);
              }
            }
            console.log(`✅ ${fetchedCount} criativos salvos`);
          }

          for (const ad of ads) {
            const adSetId = adSetIdMap.get(ad.adset_id);
            if (adSetId) {
              const creativeAssetId = ad.creative?.id ? creativeIdToAssetId.get(ad.creative.id) : null;
              await upsertAd(client, platformAccountId, adSetId, ad, creativeAssetId);
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

#!/usr/bin/env node
import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const {
  META_APP_ID,
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_WORKSPACE_ID,
  SUPABASE_DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

// Initialize Supabase client for storage
let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

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

async function fetchAccount(accessToken, adAccountId) {
  const url = buildUrl(`act_${adAccountId}`, {
    fields: [
      "id",
      "name",
      "account_id",
      "account_status",
      "currency",
      "timezone_name",
      "business_name",
      "funding_source_details",
    ].join(","),
    access_token: accessToken,
  });
  return fetchJson(url);
}

async function fetchAllCampaigns(accessToken, adAccountId) {
  const campaigns = [];
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

async function fetchAllAdSets(accessToken, adAccountId) {
  const adSets = [];
  let nextUrl = buildUrl(`act_${adAccountId}/adsets`, {
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
      "created_time",
      "updated_time",
    ].join(","),
    limit: "100",
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      adSets.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return adSets;
}

async function fetchAllAds(accessToken, adAccountId) {
  const ads = [];
  let nextUrl = buildUrl(`act_${adAccountId}/ads`, {
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

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      ads.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return ads;
}

async function fetchAllAudiences(accessToken, adAccountId) {
  const audiences = [];
  let nextUrl = buildUrl(`act_${adAccountId}/customaudiences`, {
    fields: [
      "id",
      "name",
      "rule",
      "subtype",
      "description",
      "customer_file_source",
      "time_created",
      "time_updated",
    ].join(","),
    limit: "100",
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      audiences.push(...data.data);
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  return audiences;
}

async function fetchCreativeDetails(accessToken, creativeId) {
  const url = buildUrl(`${creativeId}`, {
    fields: ["id", "name", "body", "thumbnail_url", "image_url", "object_story_spec", "asset_feed_spec", "status"].join(","),
    access_token: accessToken,
  });
  return fetchJson(url);
}

async function fetchCreatives(accessToken, creativeIds) {
  const results = [];
  for (const creativeId of creativeIds) {
    try {
      const creative = await fetchCreativeDetails(accessToken, creativeId);
      results.push(creative);
    } catch (error) {
      console.warn(`Failed to fetch creative ${creativeId}:`, error.message ?? error);
    }
  }
  return results;
}

/**
 * Download creative image from Facebook and upload to Supabase storage
 * @param {string} imageUrl - Facebook CDN URL
 * @param {string} creativeId - Creative ID for filename
 * @returns {Promise<string|null>} - Supabase public URL or null if failed
 */
async function downloadAndStoreCreative(imageUrl, creativeId) {
  if (!supabaseClient) {
    console.warn('Supabase client not initialized, skipping image download');
    return null;
  }

  if (!imageUrl) {
    return null;
  }

  try {
    // Download image from Facebook
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to download image for creative ${creativeId}: ${response.statusText}`);
      return null;
    }

    // Get content type and determine file extension
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';

    // Generate filename
    const filename = `${creativeId}.${extension}`;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from('creatives')
      .upload(filename, buffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.warn(`Failed to upload creative ${creativeId} to storage:`, error.message);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from('creatives')
      .getPublicUrl(filename);

    console.log(`✓ Stored creative ${creativeId} in Supabase storage`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.warn(`Error storing creative ${creativeId}:`, error.message ?? error);
    return null;
  }
}

function deriveCreativeType(creative) {
  const story = creative.object_story_spec ?? {};
  if (story.video_data) return "video";
  if (story.carousel_data) return "carousel";
  if (story.image_data) return "image";
  if (creative.image_url) return "image";
  return "text";
}

async function buildCreativePayload(creative) {
  const story = creative.object_story_spec ?? {};
  const type = deriveCreativeType(creative);

  let facebookImageUrl = creative.image_url ?? null;
  let facebookThumbnailUrl = creative.thumbnail_url ?? facebookImageUrl ?? null;
  let textContent = creative.body ?? null;
  let durationSeconds = null;
  let aspectRatio = null;

  if (story.video_data) {
    facebookImageUrl = story.video_data.video_url ?? facebookImageUrl;
    facebookThumbnailUrl = story.video_data.image_url ?? facebookThumbnailUrl;
    textContent = story.video_data.message ?? textContent;
  }

  if (story.image_data) {
    facebookImageUrl = facebookImageUrl ?? story.image_data.image_url ?? null;
    facebookThumbnailUrl = story.image_data.image_url ?? facebookThumbnailUrl;
    textContent = story.image_data.message ?? textContent;
  }

  if (story.link_data) {
    textContent = textContent ?? story.link_data.message ?? null;
  }

  if (story.carousel_data?.cards?.length) {
    textContent = textContent ?? story.carousel_data.cards.map((card) => card.title).filter(Boolean).join(" • ");
  }

  // Download and store image in Supabase
  const supabaseStorageUrl = await downloadAndStoreCreative(
    facebookThumbnailUrl || facebookImageUrl,
    creative.id
  );

  const metadata = {
    metaCreativeId: creative.id,
    object_story_spec: story,
    asset_feed_spec: creative.asset_feed_spec ?? null,
    body: creative.body ?? null,
    thumbnail_url: facebookThumbnailUrl,
    image_url: facebookImageUrl,
    status: creative.status ?? null,
  };

  return {
    externalId: creative.id,
    name: creative.name ?? `Creative ${creative.id}`,
    type,
    storageUrl: supabaseStorageUrl || facebookImageUrl, // Prefer Supabase, fallback to Facebook
    thumbnailUrl: facebookThumbnailUrl,
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

async function upsertIntegration(client, workspaceId) {
  const result = await client.query(
    `
      INSERT INTO workspace_integrations (
        workspace_id,
        platform_key,
        status,
        auth_type,
        metadata,
        last_synced_at
      )
      VALUES ($1, 'meta', 'active', 'oauth', '{}'::jsonb, now())
      ON CONFLICT (workspace_id, platform_key)
      DO UPDATE SET
        status = 'active',
        updated_at = now(),
        last_synced_at = now()
      RETURNING id
    `,
    [workspaceId],
  );
  return result.rows[0].id;
}

async function upsertAccount(client, workspaceId, integrationId, account) {
  const metadata = {
    account_status: account.account_status,
    business_name: account.business_name,
    funding_source_details: account.funding_source_details ?? null,
  };

  const result = await client.query(
    `
      INSERT INTO platform_accounts (
        workspace_id,
        integration_id,
        platform_key,
        external_id,
        name,
        account_type,
        currency,
        timezone,
        status,
        metadata,
        updated_at
      )
      VALUES ($1, $2, 'meta', $3, $4, 'business', $5, $6, 'active', $7::jsonb, now())
      ON CONFLICT (integration_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        status = 'active',
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      workspaceId,
      integrationId,
      account.id,
      account.name,
      account.currency,
      account.timezone_name,
      JSON.stringify(metadata),
    ],
  );

  return result.rows[0].id;
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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'synced',
        $7,
        $8,
        $9,
        $10,
        '{}'::jsonb,
        $11::jsonb,
        now(),
        false,
        now()
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
        settings,
        last_synced_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        $14::jsonb,
        now(),
        now()
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
      adSet.bid_strategy ?? adSet.campaign?.bid_strategy ?? null,
      centsToNumber(adSet.bid_amount),
      deriveBudgetType(adSet),
      centsToNumber(adSet.daily_budget) ?? (adSet.campaign?.daily_budget ? centsToNumber(adSet.campaign.daily_budget) : null),
      centsToNumber(adSet.lifetime_budget),
      JSON.stringify(adSet.targeting ?? {}),
      JSON.stringify(settings),
    ],
  );
}

async function upsertAd(client, platformAccountId, adSetId, ad, creativeAssetId) {
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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        now(),
        $7::jsonb,
        now()
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

function normalizeAudienceStatus(audience) {
  const deliveryStatus = audience.delivery_status?.status ?? audience.delivery_status?.code ?? "";
  const operationStatus = audience.operation_status?.code ?? "";
  const combined = [deliveryStatus, operationStatus].join(" ").toLowerCase();
  if (combined.includes("archived") || combined.includes("deleted")) return "archived";
  if (combined.includes("disabled") || combined.includes("failed")) return "disabled";
  return "active";
}

function deriveAudienceType(audience) {
  const subtype = (audience.subtype ?? "").toLowerCase();
  if (!subtype) return "custom";
  return subtype;
}

async function upsertAudience(client, workspaceId, platformAccountId, audience) {
  const metadata = {
    delivery_status: audience.delivery_status ?? null,
    operation_status: audience.operation_status ?? null,
    data_source: audience.data_source ?? null,
    lookalike_spec: audience.lookalike_spec ?? null,
  };

  await client.query(
    `
      INSERT INTO audiences (
        workspace_id,
        platform_account_id,
        external_id,
        name,
        audience_type,
        status,
        source,
        size_estimate,
        metadata,
        last_synced_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'synced',
        $7,
        $8::jsonb,
        now(),
        now()
      )
      ON CONFLICT (platform_account_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        audience_type = EXCLUDED.audience_type,
        status = EXCLUDED.status,
        size_estimate = EXCLUDED.size_estimate,
        metadata = EXCLUDED.metadata,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      workspaceId,
      platformAccountId,
      audience.id,
      audience.name ?? `Audience ${audience.id}`,
      deriveAudienceType(audience),
      normalizeAudienceStatus(audience),
      audience.approximate_count !== undefined && audience.approximate_count !== null
        ? Number(audience.approximate_count)
        : null,
      JSON.stringify(metadata),
    ],
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

    const account = await fetchAccount(accessToken, adAccountId);
    console.log(`Fetched Meta account ${account.id} (${account.name})`);

    const campaigns = await fetchAllCampaigns(accessToken, adAccountId);
    console.log(`Fetched ${campaigns.length} campaigns from Meta API`);

    const adSets = await fetchAllAdSets(accessToken, adAccountId);
    console.log(`Fetched ${adSets.length} ad sets from Meta API`);

    const ads = await fetchAllAds(accessToken, adAccountId);
    console.log(`Fetched ${ads.length} ads from Meta API`);

    const audiences = await fetchAllAudiences(accessToken, adAccountId);
    console.log(`Fetched ${audiences.length} audiences from Meta API`);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const integrationId = await upsertIntegration(client, workspaceId);
      const platformAccountId = await upsertAccount(client, workspaceId, integrationId, account);

      const creativeIdSet = new Set();
      for (const ad of ads) {
        if (ad.creative?.id) {
          creativeIdSet.add(ad.creative.id);
        }
      }

      const creativeAssetIdMap = new Map();
      if (creativeIdSet.size > 0) {
        const creatives = await fetchCreatives(accessToken, Array.from(creativeIdSet));
        for (const creative of creatives) {
          const payload = await buildCreativePayload(creative);
          const creativeAssetId = await upsertCreativeAsset(client, workspaceId, payload);
          creativeAssetIdMap.set(creative.id, creativeAssetId);
        }
        console.log(`Upserted ${creativeAssetIdMap.size} creatives into the database`);
      } else {
        console.log("No creatives associated with the fetched ads.");
      }

      let audiencesProcessed = 0;
      for (const audience of audiences) {
        await upsertAudience(client, workspaceId, platformAccountId, audience);
        audiencesProcessed += 1;
      }
      console.log(`Upserted ${audiencesProcessed} audiences into the database`);

      for (const campaign of campaigns) {
        await upsertCampaign(client, workspaceId, platformAccountId, campaign);
      }

      console.log(`Upserted ${campaigns.length} campaigns into the database`);

      const { rows: campaignRows } = await client.query(
        `
          SELECT external_id, id
          FROM campaigns
          WHERE platform_account_id = $1
        `,
        [platformAccountId],
      );
      const campaignIdMap = new Map(campaignRows.map((row) => [row.external_id, row.id]));

      let adSetsProcessed = 0;
      for (const adSet of adSets) {
        const campaignId = campaignIdMap.get(adSet.campaign_id);
        if (!campaignId) {
          console.warn(`Skipping ad set ${adSet.id} - campaign ${adSet.campaign_id} not found locally`);
          continue;
        }
        await upsertAdSet(client, platformAccountId, campaignId, adSet);
        adSetsProcessed += 1;
      }
      console.log(`Upserted ${adSetsProcessed} ad sets into the database`);

      const { rows: adSetRows } = await client.query(
        `
          SELECT external_id, id
          FROM ad_sets
          WHERE platform_account_id = $1
        `,
        [platformAccountId],
      );
      const adSetIdMap = new Map(adSetRows.map((row) => [row.external_id, row.id]));

      let adsProcessed = 0;
      for (const ad of ads) {
        const adSetId = adSetIdMap.get(ad.adset_id);
        if (!adSetId) {
          console.warn(`Skipping ad ${ad.id} - ad set ${ad.adset_id} not found locally`);
          continue;
        }
        const creativeAssetId = ad.creative?.id ? creativeAssetIdMap.get(ad.creative.id) ?? null : null;
        await upsertAd(client, platformAccountId, adSetId, ad, creativeAssetId);
        adsProcessed += 1;
      }
      console.log(`Upserted ${adsProcessed} ads into the database`);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Meta sync failed:", error);
    process.exitCode = 1;
  }
}

main();

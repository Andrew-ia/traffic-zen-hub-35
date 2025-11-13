import { DatabaseClient, SyncContext, defaultLogger } from './db.js';

const GRAPH_VERSION = 'v19.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaSyncOptions {
  accessToken: string;
  adAccountId: string;
  workspaceId: string;
  days: number;
  type?: 'all' | 'campaigns' | 'metrics';
}

export interface MetaSyncSummary {
  campaignsSynced: number;
  adSetsSynced: number;
  adsSynced: number;
  creativesSynced: number;
  metricsSynced: number;
  startedAt: string;
  completedAt: string;
}

type IdMap = Map<string, string>;

interface AdSetMapValue {
  id: string;
  campaignId: string;
}

interface AdMapValue {
  id: string;
  adSetId: string;
  campaignId: string;
}

function mapMetaStatus(status: string): string {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
    case 'IN_PROCESS':
    case 'PENDING':
    case 'WITH_ISSUES':
      return 'active';
    case 'PAUSED':
    case 'INACTIVE':
      return 'paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'archived';
    case 'PENDING_REVIEW':
    case 'DISAPPROVED':
      return 'draft';
    default:
      return 'draft';
  }
}

function resolveDeliveryStatus(primaryStatus: string, effectiveStatus?: string | null): string {
  const effectiveMapped = effectiveStatus ? mapMetaStatus(effectiveStatus) : null;
  if (effectiveMapped) {
    if (effectiveMapped === 'paused' || effectiveMapped === 'archived') {
      return effectiveMapped;
    }
    if (effectiveMapped === 'active') {
      return 'active';
    }
  }
  return mapMetaStatus(primaryStatus);
}

function mapAdSetStatus(status: string, effectiveStatus?: string | null): string {
  return resolveDeliveryStatus(status, effectiveStatus);
}

function mapAdStatus(status: string, effectiveStatus?: string | null): string {
  return resolveDeliveryStatus(status, effectiveStatus);
}

function centsToNumber(value: string | number | null | undefined): number | null {
  if (!value && value !== 0) return null;
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return null;
  return asNumber / 100;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RATE_LIMIT_DELAY_MS = 200;

async function fetchJson(url: URL | string) {
  await delay(RATE_LIMIT_DELAY_MS);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
}

function buildUrl(path: string, params: Record<string, string | number | undefined | null> = {}) {
  const url = new URL(`${GRAPH_URL}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  return url;
}

async function fetchRecentCampaigns(accessToken: string, adAccountId: string, days: number) {
  const campaigns: any[] = [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  let nextUrl: URL | null = buildUrl(`${accountId}/campaigns`, {
    fields: [
      'id',
      'name',
      'status',
      'effective_status',
      'objective',
      'start_time',
      'stop_time',
      'daily_budget',
      'lifetime_budget',
      'created_time',
      'updated_time',
    ].join(','),
    filtering: JSON.stringify([{ field: 'updated_time', operator: 'GREATER_THAN', value: sinceTimestamp }]),
    limit: '100',
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

async function fetchAdSetsByCampaigns(accessToken: string, campaignIds: string[]) {
  if (campaignIds.length === 0) return [];

  const adSets: any[] = [];
  for (const campaignId of campaignIds) {
    const url = buildUrl(`${campaignId}/adsets`, {
      fields: [
        'id',
        'name',
        'status',
        'effective_status',
        'campaign_id',
        'start_time',
        'end_time',
        'daily_budget',
        'lifetime_budget',
        'bid_strategy',
        'bid_amount',
        'billing_event',
        'optimization_goal',
        'pacing_type',
        'campaign{daily_budget,budget_remaining,bid_strategy}',
        'targeting',
        'promoted_object',
        'destination_type',
        'created_time',
        'updated_time',
      ].join(','),
      limit: '100',
      access_token: accessToken,
    });

    const data = await fetchJson(url);
    if (Array.isArray(data.data)) {
      adSets.push(...data.data);
    }
  }

  return adSets;
}

async function fetchAdsByAdSets(accessToken: string, adSetIds: string[]) {
  if (adSetIds.length === 0) return [];

  const ads: any[] = [];
  for (const adSetId of adSetIds) {
    const url = buildUrl(`${adSetId}/ads`, {
      fields: [
        'id',
        'name',
        'status',
        'effective_status',
        'adset_id',
        'created_time',
        'updated_time',
        'creative{id,name}',
      ].join(','),
      limit: '100',
      access_token: accessToken,
    });

    const data = await fetchJson(url);
    if (Array.isArray(data.data)) {
      ads.push(...data.data);
    }
  }

  return ads;
}

async function fetchCreativeDetails(accessToken: string, creativeId: string) {
  const url = buildUrl(`${creativeId}`, {
    fields: [
      'id',
      'name',
      'body',
      'thumbnail_url',
      'image_url',
      'object_story_spec',
      'asset_feed_spec',
      'status',
    ].join(','),
    access_token: accessToken,
  });
  return fetchJson(url);
}

function deriveCreativeType(creative: any) {
  const story = creative.object_story_spec ?? {};
  if (story.video_data) return 'video';
  if (story.carousel_data) return 'carousel';
  if (story.image_data) return 'image';
  if (creative.image_url) return 'image';
  return 'text';
}

function buildCreativePayload(creative: any) {
  const story = creative.object_story_spec ?? {};
  const type = deriveCreativeType(creative);

  let storageUrl = creative.image_url ?? null;
  let thumbnailUrl = creative.thumbnail_url ?? storageUrl ?? null;
  let textContent = creative.body ?? null;
  const durationSeconds = null;
  const aspectRatio = null;

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
    textContent = textContent ?? story.carousel_data.cards.map((card: any) => card.title).filter(Boolean).join(' • ');
  }

  const metadata = {
    object_story_spec: story,
    asset_feed_spec: creative.asset_feed_spec ?? null,
  };

  return {
    type,
    name: creative.name ?? `Creative ${creative.id}`,
    storageUrl,
    thumbnailUrl,
    durationSeconds,
    aspectRatio,
    textContent,
    metadata,
    hash: creative.id,
  };
}

async function upsertCampaign(
  db: DatabaseClient,
  workspaceId: string,
  platformAccountId: string,
  campaign: any,
) {

  await db.query(
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
        last_synced_at,
        archived,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'synced', $7, $8, $9, $10, '{}'::jsonb, now(), false, now()
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
      campaign.start_time ? new Date(campaign.start_time) : null,
      campaign.stop_time ? new Date(campaign.stop_time) : null,
      centsToNumber(campaign.daily_budget),
      centsToNumber(campaign.lifetime_budget),
    ],
  );
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function deriveBudgetType(adSet: any) {
  if (adSet.lifetime_budget) return 'lifetime';
  if (adSet.daily_budget) return 'daily';
  if (adSet.campaign?.budget_remaining) return 'campaign';
  return null;
}

async function upsertAdSet(
  db: DatabaseClient,
  platformAccountId: string,
  campaignId: string,
  adSet: any,
) {

  await db.query(
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
        last_synced_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, now(), now()
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
    ],
  );
}

async function upsertCreativeAsset(
  db: DatabaseClient,
  workspaceId: string,
  creative: ReturnType<typeof buildCreativePayload>,
) {
  const metadataJson = JSON.stringify(creative.metadata ?? {});

  const existing = await db.query<{ id: string }>(
    `SELECT id FROM creative_assets WHERE workspace_id = $1 AND hash = $2 LIMIT 1`,
    [workspaceId, creative.hash],
  );

  if (existing.rows[0]) {
    const creativeId = existing.rows[0].id;
    await db.query(
      `
        UPDATE creative_assets
        SET
          name = $2,
          storage_url = $3,
          thumbnail_url = $4,
          duration_seconds = $5,
          aspect_ratio = $6,
          text_content = $7,
          metadata = $8::jsonb,
          updated_at = now()
        WHERE id = $1
      `,
      [
        creativeId,
        creative.name,
        creative.storageUrl,
        creative.thumbnailUrl,
        creative.durationSeconds,
        creative.aspectRatio,
        creative.textContent,
        metadataJson,
      ],
    );
    return creativeId;
  }

  const insert = await db.query<{ id: string }>(
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

async function upsertAd(
  db: DatabaseClient,
  platformAccountId: string,
  adSetId: string,
  ad: any,
  creativeAssetId: string | null,
) {

  await db.query(
    `
      INSERT INTO ads (
        ad_set_id,
        platform_account_id,
        external_id,
        name,
        status,
        creative_asset_id,
        last_synced_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, now(), now()
      )
      ON CONFLICT (ad_set_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        creative_asset_id = EXCLUDED.creative_asset_id,
        last_synced_at = now(),
        updated_at = now()
    `,
    [
      adSetId,
      platformAccountId,
      ad.id,
      ad.name,
      mapAdStatus(ad.status, ad.effective_status),
      creativeAssetId,
    ],
  );
}

function extractDerivedMetrics(actions: any[] | undefined) {
  const counts: Record<string, number> = {};
  const values: Record<string, number> = {};

  if (Array.isArray(actions)) {
    for (const action of actions) {
      const key = action.action_type ?? action.actionType ?? action.type;
      if (!key) continue;
      if (action.value !== undefined) {
        counts[key] = Number(action.value ?? 0);
      } else if (action.count !== undefined) {
        counts[key] = Number(action.count ?? 0);
      }
      if (action.value_usd !== undefined) {
        values[key] = Number(action.value_usd ?? 0);
      } else if (action.value !== undefined) {
        values[key] = Number(action.value ?? 0);
      }
    }
  }

  return { counts, values };
}

function extractPrimaryConversion(actions: any[] | undefined) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { actionType: 'unknown', value: 0 };
  }
  const sorted = [...actions].sort((a, b) => (Number(b.value ?? 0) || 0) - (Number(a.value ?? 0) || 0));
  const top = sorted[0];
  return {
    actionType: top.action_type ?? top.actionType ?? 'unknown',
    value: Number(top.value ?? 0),
  };
}

async function upsertMetrics(
  db: DatabaseClient,
  workspaceId: string,
  platformAccountId: string,
  insights: any[],
  level: 'account' | 'campaign' | 'adset' | 'ad',
  idMaps: {
    campaigns: IdMap;
    adsets: Map<string, AdSetMapValue>;
    ads: Map<string, AdMapValue>;
  },
) {
  for (const row of insights) {
    const metricDate = row.date_start ?? row.date_start ?? row.date ?? null;
    const spend = Number(row.spend ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const conversions = Number(row.conversions ?? row.actions?.find((a: any) => a.action_type === 'offsite_conversion.purchase')?.value ?? 0);
    const conversionValue = Number(
      row.conversion_value ??
        row.action_values?.find((a: any) => a.action_type === 'offsite_conversion.purchase')?.value ??
        0,
    );

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    let roas = spend > 0 ? conversionValue / spend : null;

    const derivedMetrics = extractDerivedMetrics(row.actions);
    const primaryConversion = extractPrimaryConversion(row.actions);

    if (!roas && primaryConversion.value > 0) {
      roas = primaryConversion.value / (spend || 1);
    } else if (Array.isArray(row.purchase_roas) && row.purchase_roas[0]?.value) {
      roas = Number(row.purchase_roas[0].value ?? 0);
    } else if (Number.isFinite(Number(row.roas))) {
      roas = Number(row.roas ?? 0);
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

    let campaignId: string | null = null;
    let adSetId: string | null = null;
    let adId: string | null = null;

    if (level === 'campaign') {
      campaignId = idMaps.campaigns.get(row.campaign_id) ?? null;
      if (!campaignId) continue;
    } else if (level === 'adset') {
      const internal = idMaps.adsets.get(row.adset_id);
      if (!internal) continue;
      adSetId = internal.id;
      campaignId = internal.campaignId;
    } else if (level === 'ad') {
      const internal = idMaps.ads.get(row.ad_id);
      if (!internal) continue;
      adId = internal.id;
      adSetId = internal.adSetId;
      campaignId = internal.campaignId;
    }

    await db.query(
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
        row.account_currency ?? 'BRL',
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

async function fetchInsightsForPeriod(
  accessToken: string,
  adAccountId: string,
  days: number,
  level: 'account' | 'campaign' | 'adset' | 'ad',
) {
  const insights: any[] = [];
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const startDate = new Date(yesterday);
  startDate.setDate(startDate.getDate() - days + 1);

  const since = startDate.toISOString().slice(0, 10);
  const until = yesterday.toISOString().slice(0, 10);

  const levelSpecific: Record<string, string[]> = {
    account: [],
    campaign: ['campaign_id'],
    adset: ['campaign_id', 'adset_id'],
    ad: ['campaign_id', 'adset_id', 'ad_id'],
  };

  const fields = [
    'date_start',
    'date_stop',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'unique_clicks',
    'spend',
    'cpm',
    'cpc',
    'ctr',
    'actions',
    'action_values',
    'inline_link_clicks',
    'inline_post_engagement',
    'outbound_clicks',
    'outbound_clicks_ctr',
    'purchase_roas',
    ...(levelSpecific[level] ?? []),
  ];

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  let nextUrl: URL | null = buildUrl(`${accountId}/insights`, {
    fields: fields.join(','),
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
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

async function updateIntegrationSync(db: DatabaseClient, workspaceId: string) {
  await db.query(
    `
      UPDATE workspace_integrations
      SET last_synced_at = now(), updated_at = now()
      WHERE workspace_id = $1 AND platform_key = 'meta'
    `,
    [workspaceId],
  );
}

function normalizeType(type?: string) {
  if (type === 'campaigns') return 'campaigns';
  if (type === 'metrics') return 'metrics';
  return 'all';
}

export async function runMetaSync(
  options: MetaSyncOptions,
  ctx: SyncContext,
): Promise<MetaSyncSummary> {
  const logger = ctx.logger ?? defaultLogger;
  const db = ctx.db;
  const startedAt = new Date();
  const mode = normalizeType(options.type);

  const summary: MetaSyncSummary = {
    campaignsSynced: 0,
    adSetsSynced: 0,
    adsSynced: 0,
    creativesSynced: 0,
    metricsSynced: 0,
    startedAt: startedAt.toISOString(),
    completedAt: startedAt.toISOString(),
  };

  logger.info(`\n🔄 Iniciando sincronização incremental do Meta Ads`);
  logger.info(`📅 Período: últimos ${options.days} dias`);
  logger.info(`🎯 Modo: ${mode}\n`);

  const accountRes = await db.query<{ id: string }>(
    `SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
    [options.workspaceId],
  );

  if (accountRes.rows.length === 0) {
    throw new Error('Conta Meta não encontrada. Execute sync-campaigns primeiro.');
  }

  const platformAccountId = accountRes.rows[0].id;

  if (mode !== 'metrics') {
    ctx.reportProgress?.(10, 'Buscando campanhas');
    logger.info(`📥 Buscando campanhas atualizadas nos últimos ${options.days} dias...`);
    const campaigns = await fetchRecentCampaigns(options.accessToken, options.adAccountId, options.days);
    summary.campaignsSynced = campaigns.length;
    logger.info(`✅ ${campaigns.length} campanhas encontradas`);

    if (campaigns.length > 0) {
      for (const campaign of campaigns) {
        await upsertCampaign(db, options.workspaceId, platformAccountId, campaign);
      }
      logger.info(`💾 Campanhas sincronizadas`);
      ctx.reportProgress?.(25, 'Campanhas sincronizadas');

      const campaignIds = campaigns.map((c) => c.id);
      logger.info(`📥 Buscando ad sets das campanhas...`);
      const adSets = await fetchAdSetsByCampaigns(options.accessToken, campaignIds);
      summary.adSetsSynced = adSets.length;
      logger.info(`✅ ${adSets.length} ad sets encontrados`);
      ctx.reportProgress?.(35, 'Ad sets carregados');

      const campaignRows = await db.query<{ external_id: string; id: string }>(
        `SELECT external_id, id FROM campaigns WHERE platform_account_id = $1`,
        [platformAccountId],
      );

      const campaignIdMap = new Map(campaignRows.rows.map((row) => [row.external_id, row.id]));

      for (const adSet of adSets) {
        const campaignId = campaignIdMap.get(adSet.campaign_id);
        if (campaignId) {
          await upsertAdSet(db, platformAccountId, campaignId, adSet);
        }
      }
      logger.info(`💾 Ad sets sincronizados`);
      ctx.reportProgress?.(45, 'Ad sets sincronizados');

      const adSetIds = adSets.map((a) => a.id);
      logger.info(`📥 Buscando anúncios...`);
      const ads = await fetchAdsByAdSets(options.accessToken, adSetIds);
      summary.adsSynced = ads.length;
      logger.info(`✅ ${ads.length} anúncios encontrados`);

      const adSetRows = await db.query<{ external_id: string; id: string }>(
        `SELECT external_id, id FROM ad_sets WHERE platform_account_id = $1`,
        [platformAccountId],
      );
      const adSetIdMap = new Map(adSetRows.rows.map((row) => [row.external_id, row.id]));

      const creativeIds = new Set<string>();
      for (const ad of ads) {
        if (ad.creative?.id) {
          creativeIds.add(ad.creative.id);
        }
      }

      const creativeIdToAssetId = new Map<string, string>();
      if (creativeIds.size > 0) {
        logger.info(`🎨 Buscando ${creativeIds.size} criativos únicos...`);
        ctx.reportProgress?.(55, 'Buscando criativos');
        let fetchedCount = 0;
        for (const creativeId of creativeIds) {
          try {
            const creativeData = await fetchCreativeDetails(options.accessToken, creativeId);
            const creativePayload = buildCreativePayload(creativeData);
            const assetId = await upsertCreativeAsset(db, options.workspaceId, creativePayload);
            creativeIdToAssetId.set(creativeId, assetId);
            fetchedCount++;
          } catch (error) {
            logger.warn(`⚠️  Falha ao buscar criativo ${creativeId}:`, (error as Error).message);
          }
        }
        summary.creativesSynced = fetchedCount;
        logger.info(`✅ ${fetchedCount} criativos salvos`);
      }

      for (const ad of ads) {
        const adSetId = adSetIdMap.get(ad.adset_id);
        if (adSetId) {
          const creativeAssetId = ad.creative?.id ? creativeIdToAssetId.get(ad.creative.id) ?? null : null;
          await upsertAd(db, platformAccountId, adSetId, ad, creativeAssetId);
        }
      }
      logger.info(`💾 Anúncios sincronizados\n`);
      ctx.reportProgress?.(65, 'Anúncios sincronizados');
    }
  }

  if (mode !== 'campaigns') {
    logger.info(`📊 Sincronizando métricas dos últimos ${options.days} dias...`);
    ctx.reportProgress?.(70, 'Sincronizando métricas');

    const campaignRows = await db.query<{ external_id: string; id: string }>(
      `SELECT external_id, id FROM campaigns WHERE platform_account_id = $1`,
      [platformAccountId],
    );
    const campaignIdMap: IdMap = new Map(campaignRows.rows.map((row) => [row.external_id, row.id]));

    const adSetRows = await db.query<{ id: string; external_id: string; campaign_id: string }>(
      `SELECT id, external_id, campaign_id FROM ad_sets WHERE platform_account_id = $1`,
      [platformAccountId],
    );
    const adSetIdMap = new Map<string, AdSetMapValue>(
      adSetRows.rows.map((row) => [row.external_id, { id: row.id, campaignId: row.campaign_id }]),
    );

    const adRows = await db.query<{ id: string; external_id: string; ad_set_id: string; campaign_id: string }>(
      `
        SELECT ads.id, ads.external_id, ads.ad_set_id, ad_sets.campaign_id
        FROM ads
        LEFT JOIN ad_sets ON ad_sets.id = ads.ad_set_id
        WHERE ads.platform_account_id = $1
      `,
      [platformAccountId],
    );
    const adIdMap = new Map<string, AdMapValue>(
      adRows.rows.map((row) => [
        row.external_id,
        { id: row.id, adSetId: row.ad_set_id, campaignId: row.campaign_id },
      ]),
    );

    const levels: Array<'account' | 'campaign' | 'adset' | 'ad'> = ['account', 'campaign', 'adset', 'ad'];

    for (const level of levels) {
      logger.info(`📈 Buscando métricas nível ${level}...`);
      const insights = await fetchInsightsForPeriod(options.accessToken, options.adAccountId, options.days, level);
      summary.metricsSynced += insights.length;
      logger.info(`✅ ${insights.length} registros encontrados`);

      if (insights.length > 0) {
        await upsertMetrics(db, options.workspaceId, platformAccountId, insights, level, {
          campaigns: campaignIdMap,
          adsets: adSetIdMap,
          ads: adIdMap,
        });
        logger.info(`💾 Métricas ${level} sincronizadas`);
      }
    }
    ctx.reportProgress?.(95, 'Métricas sincronizadas');
  }

  await updateIntegrationSync(db, options.workspaceId);
  ctx.reportProgress?.(100, 'Sincronização concluída');
  logger.info(`\n✅ Sincronização incremental concluída com sucesso!`);

  summary.completedAt = new Date().toISOString();
  return summary;
}

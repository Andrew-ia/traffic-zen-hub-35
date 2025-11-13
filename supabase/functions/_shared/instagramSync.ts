import { DatabaseClient, SyncContext, defaultLogger } from './db.js';

const GRAPH_URL = 'https://graph.facebook.com/v24.0';

export interface InstagramSyncOptions {
  igUserId: string;
  accessToken: string;
  workspaceId: string;
  days: number;
}

export interface InstagramSyncSummary {
  userInsights: number;
  mediaInsights: number;
  mediaFetched: number;
  startedAt: string;
  completedAt: string;
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
    throw new Error(`Instagram API error ${response.status}: ${text}`);
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

async function validatePermissions(igUserId: string, accessToken: string, logger = defaultLogger) {
  logger.info('🔍 Validando permissões do token...');
  try {
    const basicUrl = buildUrl(`${igUserId}`, {
      fields: 'username,followers_count,media_count',
      access_token: accessToken,
    });
    await fetchJson(basicUrl);
  } catch (error) {
    logger.error('❌ Falha ao validar instagram_basic:', (error as Error).message);
    throw new Error('Permissão ausente: instagram_basic');
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86400;
    const testUrl = buildUrl(`${igUserId}/insights`, {
      metric: 'reach',
      period: 'day',
      since: dayAgo,
      until: now,
      access_token: accessToken,
    });
    await fetchJson(testUrl);
    logger.info('✅ Permissões básicas OK');
  } catch (error) {
    const msg = String((error as Error).message || '');
    if (msg.includes('does not have permission') || msg.includes('Permission') || msg.includes('code 10')) {
      throw new Error('Missing required permissions for Instagram Insights API');
    }
    throw error;
  }
}

async function fetchUserInsights(igUserId: string, accessToken: string, days: number, logger = defaultLogger) {
  logger.info(`📊 Fetching user insights for ${days} days...`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const until = new Date();
  until.setHours(23, 59, 59, 999);

  const insights: any[] = [];
  const dailyMetrics = ['reach', 'follower_count'];

  for (const metric of dailyMetrics) {
    try {
      const url = buildUrl(`${igUserId}/insights`, {
        metric,
        period: 'day',
        since: Math.floor(since.getTime() / 1000),
        until: Math.floor(until.getTime() / 1000),
        access_token: accessToken,
      });
      const data = await fetchJson(url);
      if (data.data) {
        insights.push(...data.data);
      }
    } catch (err) {
      logger.warn(`⚠️ Could not fetch ${metric}:`, String((err as Error).message || '').substring(0, 100));
    }
  }

  const totalValueMetrics = [
    'profile_views',
    'website_clicks',
    'accounts_engaged',
    'total_interactions',
    'likes',
    'comments',
    'shares',
    'saves',
    'replies',
    'profile_links_taps',
  ];

  for (const metric of totalValueMetrics) {
    try {
      const url = buildUrl(`${igUserId}/insights`, {
        metric,
        metric_type: 'total_value',
        period: 'day',
        since: Math.floor(since.getTime() / 1000),
        until: Math.floor(until.getTime() / 1000),
        access_token: accessToken,
      });
      const data = await fetchJson(url);
      if (data.data) {
        insights.push(...data.data);
      }
    } catch (err) {
      const msg = String((err as Error).message || '');
      if (!msg.includes('must be one of')) {
        logger.warn(`⚠️ Could not fetch ${metric}:`, msg.substring(0, 100));
      }
    }
  }

  try {
    const url = buildUrl(`${igUserId}/insights`, {
      metric: 'online_followers',
      period: 'lifetime',
      access_token: accessToken,
    });
    const data = await fetchJson(url);
    if (data.data) {
      insights.push(...data.data);
    }
  } catch (err) {
    logger.warn(`⚠️ Could not fetch online_followers:`, String((err as Error).message || '').substring(0, 80));
  }

  return insights;
}

async function fetchMedia(igUserId: string, accessToken: string, days: number, logger = defaultLogger) {
  logger.info(`📸 Fetching media for ${days} days...`);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const media: any[] = [];
  let nextUrl: URL | null = buildUrl(`${igUserId}/media`, {
    fields: [
      'id',
      'caption',
      'media_type',
      'media_url',
      'thumbnail_url',
      'permalink',
      'timestamp',
      'like_count',
      'comments_count',
    ].join(','),
    limit: '100',
    access_token: accessToken,
  });

  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    if (Array.isArray(data.data)) {
      for (const item of data.data) {
        const createdAt = item.timestamp ? new Date(item.timestamp) : null;
        if (!createdAt) continue;
        if (createdAt < since) continue;
        media.push(item);
      }
    }
    if (data.paging?.next) {
      nextUrl = new URL(data.paging.next);
    } else {
      nextUrl = null;
    }
  }

  logger.info(`✅ ${media.length} media posts found`);
  return media;
}

async function fetchMediaInsights(mediaId: string, accessToken: string) {
  const metrics = [
    'impressions',
    'reach',
    'engagement',
    'saved',
    'video_views',
    'plays',
    'total_interactions',
    'profile_activity',
  ];

  const url = buildUrl(`${mediaId}/insights`, {
    metric: metrics.join(','),
    access_token: accessToken,
  });

  const data = await fetchJson(url);
  return data.data ?? [];
}

async function upsertInstagramUserInsights(
  db: DatabaseClient,
  workspaceId: string,
  igUserId: string,
  insights: any[],
) {
  for (const insight of insights) {
    const metric = insight.name ?? insight.title ?? 'unknown';
    if (!Array.isArray(insight.values)) continue;

    for (const point of insight.values) {
      const date = point.end_time ? point.end_time.substring(0, 10) : null;
      if (!date) continue;

      // Store insights in performance_metrics table with structured data
      const extraMetrics = {
        [metric]: Number(point.value ?? 0),
        total_value: point.total_value ?? null,
        breakdown: point.breakdown ?? point.value_breakdown ?? null,
      };

      await db.query(
        `
          INSERT INTO performance_metrics (
            workspace_id,
            platform_account_id,
            metric_date,
            granularity,
            extra_metrics
          )
          VALUES ($1, $2, $3::date, 'day', $4::jsonb)
          ON CONFLICT (workspace_id, platform_account_id, metric_date, granularity)
          DO UPDATE SET
            extra_metrics = COALESCE(performance_metrics.extra_metrics, '{}'::jsonb) || EXCLUDED.extra_metrics
        `,
        [
          workspaceId,
          igUserId, // Using ig_user_id as platform_account_id
          date,
          JSON.stringify(extraMetrics),
        ],
      );
    }
  }
}

async function upsertInstagramMedia(
  db: DatabaseClient,
  workspaceId: string,
  media: any,
) {
  // Store media in creative_assets table
  await db.query(
    `
      INSERT INTO creative_assets (
        workspace_id,
        external_id,
        name,
        asset_type,
        url,
        thumbnail_url,
        metadata,
        last_synced_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, now()
      )
      ON CONFLICT (workspace_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        asset_type = EXCLUDED.asset_type,
        url = EXCLUDED.url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        metadata = EXCLUDED.metadata,
        last_synced_at = now()
      RETURNING id
    `,
    [
      workspaceId,
      media.id,
      media.caption ?? `Instagram ${media.media_type || 'Post'}`,
      media.media_type?.toLowerCase() || 'image',
      media.media_url ?? null,
      media.thumbnail_url ?? null,
      JSON.stringify({
        platform: 'instagram',
        permalink: media.permalink,
        posted_at: media.timestamp,
        like_count: Number(media.like_count ?? 0),
        comments_count: Number(media.comments_count ?? 0),
        media_type: media.media_type,
      }),
    ],
  );
}

async function upsertInstagramMediaInsights(
  db: DatabaseClient,
  workspaceId: string,
  mediaId: string,
  insights: any[],
) {
  for (const insight of insights) {
    const metric = insight.name ?? 'unknown';
    const value = typeof insight.values?.[0]?.value === 'number'
      ? Number(insight.values[0].value)
      : Array.isArray(insight.values?.[0]?.value)
        ? insight.values[0].value.reduce((acc: number, item: any) => acc + Number(item.value ?? 0), 0)
        : Number(insight.values?.[0]?.total_value ?? 0);

    // Store media insights in performance_metrics table with media_insights structure
    const today = new Date().toISOString().split('T')[0];
    const mediaInsights = { [mediaId]: { metrics: { [metric]: value } } };

    await db.query(
      `
        INSERT INTO performance_metrics (
          workspace_id,
          platform_account_id,
          metric_date,
          granularity,
          extra_metrics
        )
        VALUES ($1, $2, $3::date, 'day', $4::jsonb)
        ON CONFLICT (workspace_id, platform_account_id, metric_date, granularity)
        DO UPDATE SET
          extra_metrics = COALESCE(
            performance_metrics.extra_metrics, 
            '{}'::jsonb
          ) || jsonb_build_object(
            'media_insights', 
            COALESCE(performance_metrics.extra_metrics->'media_insights', '{}'::jsonb) || $4::jsonb->'media_insights'
          )
      `,
      [
        workspaceId,
        'instagram_platform', // Using a platform identifier
        today,
        JSON.stringify({ media_insights: mediaInsights }),
      ],
    );
  }
}

export async function runInstagramSync(
  options: InstagramSyncOptions,
  ctx: SyncContext,
): Promise<InstagramSyncSummary> {
  const logger = ctx.logger ?? defaultLogger;
  const db = ctx.db;
  const summary: InstagramSyncSummary = {
    userInsights: 0,
    mediaInsights: 0,
    mediaFetched: 0,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  await validatePermissions(options.igUserId, options.accessToken, logger);

  ctx.reportProgress?.(5, 'Validando permissões');

  const userInsights = await fetchUserInsights(options.igUserId, options.accessToken, options.days, logger);
  summary.userInsights = userInsights.length;
  await upsertInstagramUserInsights(db, options.workspaceId, options.igUserId, userInsights);
  ctx.reportProgress?.(25, 'Insights do usuário sincronizados');

  const media = await fetchMedia(options.igUserId, options.accessToken, options.days, logger);
  summary.mediaFetched = media.length;
  ctx.reportProgress?.(40, 'Posts coletados');

  let processed = 0;
  for (const item of media) {
    await upsertInstagramMedia(db, options.workspaceId, item);
    const insights = await fetchMediaInsights(item.id, options.accessToken);
    await upsertInstagramMediaInsights(db, options.workspaceId, item.id, insights);
    summary.mediaInsights += insights.length;
    processed++;

    const pct = 40 + Math.round((processed / Math.max(media.length, 1)) * 50);
    ctx.reportProgress?.(pct, `Processando mídia ${processed}/${media.length}`);
  }

  ctx.reportProgress?.(95, 'Gerando métricas finais');

  await db.query(
    `
      UPDATE workspace_integrations
      SET last_synced_at = now(), updated_at = now()
      WHERE workspace_id = $1 AND platform_key = 'instagram'
    `,
    [options.workspaceId],
  );

  ctx.reportProgress?.(100, 'Sincronização concluída');
  logger.info('✅ Instagram sync completed');

  summary.completedAt = new Date().toISOString();
  return summary;
}

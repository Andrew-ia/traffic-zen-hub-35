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

      await db.query(
        `
          INSERT INTO instagram_user_insights (
            workspace_id,
            ig_user_id,
            metric,
            value,
            recorded_at,
            period,
            total_value,
            breakdown
          )
          VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb)
          ON CONFLICT (workspace_id, ig_user_id, metric, recorded_at)
          DO UPDATE SET
            value = EXCLUDED.value,
            total_value = EXCLUDED.total_value,
            breakdown = EXCLUDED.breakdown,
            updated_at = now()
        `,
        [
          workspaceId,
          igUserId,
          metric,
          Number(point.value ?? 0),
          date,
          insight.period ?? 'day',
          point.total_value ?? null,
          JSON.stringify(point.breakdown ?? point.value_breakdown ?? null),
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
  await db.query(
    `
      INSERT INTO instagram_media (
        workspace_id,
        external_id,
        caption,
        media_type,
        media_url,
        thumbnail_url,
        permalink,
        posted_at,
        like_count,
        comments_count,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()
      )
      ON CONFLICT (workspace_id, external_id)
      DO UPDATE SET
        caption = EXCLUDED.caption,
        media_type = EXCLUDED.media_type,
        media_url = EXCLUDED.media_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        permalink = EXCLUDED.permalink,
        like_count = EXCLUDED.like_count,
        comments_count = EXCLUDED.comments_count,
        updated_at = now()
      RETURNING id
    `,
    [
      workspaceId,
      media.id,
      media.caption ?? null,
      media.media_type ?? null,
      media.media_url ?? null,
      media.thumbnail_url ?? null,
      media.permalink ?? null,
      media.timestamp ? new Date(media.timestamp) : null,
      Number(media.like_count ?? 0),
      Number(media.comments_count ?? 0),
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

    await db.query(
      `
        INSERT INTO instagram_media_insights (
          workspace_id,
          media_external_id,
          metric,
          value,
          recorded_at,
          breakdown
        )
        VALUES ($1, $2, $3, $4, now(), $5::jsonb)
        ON CONFLICT (workspace_id, media_external_id, metric)
        DO UPDATE SET
          value = EXCLUDED.value,
          breakdown = EXCLUDED.breakdown,
          recorded_at = now(),
          updated_at = now()
      `,
      [
        workspaceId,
        mediaId,
        metric,
        value,
        JSON.stringify(insight.values?.[0]?.value ?? null),
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

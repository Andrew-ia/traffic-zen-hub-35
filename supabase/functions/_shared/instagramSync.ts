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

interface InstagramAccountProfile {
  username?: string;
  followers_count?: number;
  media_count?: number;
  name?: string;
}

async function ensureInstagramPlatformAccount(
  db: DatabaseClient,
  workspaceId: string,
  igUserId: string,
  accountInfo?: InstagramAccountProfile,
) {
  await db.query(
    `
      INSERT INTO platforms (key, category, display_name)
      VALUES ('instagram', 'ads', 'Instagram')
      ON CONFLICT (key) DO NOTHING
    `,
  );

  const existingAccount = await db.query<{ id: string }>(
    `
      SELECT id
      FROM platform_accounts
      WHERE workspace_id = $1 AND platform_key = 'instagram'
      LIMIT 1
    `,
    [workspaceId],
  );

  if (existingAccount.rows.length > 0) {
    if (accountInfo) {
      const displayName = accountInfo.username ? `@${accountInfo.username}` : accountInfo.name ?? null;
      const metadataPatch = JSON.stringify({
        ig_user_id: igUserId,
        username: accountInfo.username ?? null,
        followers_count: accountInfo.followers_count ?? null,
        media_count: accountInfo.media_count ?? null,
      });

      await db.query(
        `
          UPDATE platform_accounts
          SET
            external_id = $2,
            name = COALESCE($3, name),
            metadata = COALESCE(platform_accounts.metadata, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [existingAccount.rows[0].id, igUserId, displayName, metadataPatch],
      );
    }
    return existingAccount.rows[0].id;
  }

  const integrationRes = await db.query<{ id: string }>(
    `
      SELECT id
      FROM workspace_integrations
      WHERE workspace_id = $1 AND platform_key = 'instagram'
      LIMIT 1
    `,
    [workspaceId],
  );

  let integrationId = integrationRes.rows[0]?.id;

  if (!integrationId) {
    const integrationInsert = await db.query<{ id: string }>(
      `
        INSERT INTO workspace_integrations (workspace_id, platform_key, status, auth_type, metadata)
        VALUES ($1, 'instagram', 'active', 'token', jsonb_build_object('created_by_sync', true))
        RETURNING id
      `,
      [workspaceId],
    );
    integrationId = integrationInsert.rows[0].id;
  }

  const displayName =
    accountInfo?.username ? `@${accountInfo.username}` : accountInfo?.name ?? `Instagram ${igUserId}`;
  const metadata = JSON.stringify({
    ig_user_id: igUserId,
    username: accountInfo?.username ?? null,
    followers_count: accountInfo?.followers_count ?? null,
    media_count: accountInfo?.media_count ?? null,
  });

  const accountInsert = await db.query<{ id: string }>(
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
        metadata
      )
      VALUES ($1, $2, 'instagram', $3, $4, 'instagram', NULL, NULL, 'active', $5::jsonb)
      RETURNING id
    `,
    [workspaceId, integrationId, igUserId, displayName, metadata],
  );

  return accountInsert.rows[0].id;
}

async function snapshotInstagramProfile(
  db: DatabaseClient,
  workspaceId: string,
  igUserId: string,
  accessToken: string,
) {
  try {
    const url = buildUrl(`${igUserId}`, {
      fields: 'username,biography,profile_picture_url,followers_count,follows_count,media_count',
      access_token: accessToken,
    });
    const data = await fetchJson(url)
    await db.query(
      `
        INSERT INTO instagram_profile_snapshots (
          workspace_id, ig_user_id, username, biography, profile_picture_url,
          followers_count, follows_count, media_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        workspaceId,
        igUserId,
        data.username ?? null,
        data.biography ?? null,
        data.profile_picture_url ?? null,
        Number(data.followers_count ?? 0),
        Number(data.follows_count ?? 0),
        Number(data.media_count ?? 0),
      ],
    )
  } catch { /* ignore snapshot failures */ }
}

async function upsertInstagramMediaMap(
  db: DatabaseClient,
  workspaceId: string,
  item: any,
  accessToken: string,
) {
  try {
    let counts: any = {}
    try {
      const cUrl = buildUrl(`${item.id}`, { fields: 'like_count,comments_count', access_token: accessToken })
      counts = await fetchJson(cUrl)
    } catch { counts = {} }
    await db.query(
      `
        INSERT INTO instagram_media (
          workspace_id, media_id, caption, media_type, media_url, thumbnail_url, permalink, posted_at, like_count, comments_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (workspace_id, media_id)
        DO UPDATE SET caption = EXCLUDED.caption,
                      media_type = EXCLUDED.media_type,
                      media_url = EXCLUDED.media_url,
                      thumbnail_url = EXCLUDED.thumbnail_url,
                      permalink = EXCLUDED.permalink,
                      posted_at = EXCLUDED.posted_at,
                      like_count = EXCLUDED.like_count,
                      comments_count = EXCLUDED.comments_count
      `,
      [
        workspaceId,
        item.id,
        item.caption ?? null,
        item.media_type ?? null,
        item.media_url ?? item.video_url ?? null,
        item.thumbnail_url ?? null,
        item.permalink ?? null,
        item.timestamp ?? null,
        Number(counts.like_count ?? 0),
        Number(counts.comments_count ?? 0),
      ],
    )
  } catch { /* ignore map failures */ }
}

async function fetchAndStoreComments(
  db: DatabaseClient,
  workspaceId: string,
  mediaId: string,
  accessToken: string,
) {
  let url = buildUrl(`${mediaId}/comments`, {
    fields: 'id,text,username,timestamp',
    access_token: accessToken,
    limit: 100,
  });
  while (url) {
    try {
      const page = await fetchJson(url)
      if (Array.isArray(page.data)) {
        for (const c of page.data) {
          await db.query(
            `
              INSERT INTO instagram_media_comments (
                workspace_id, media_id, comment_id, username, text, commented_at
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (workspace_id, comment_id) DO NOTHING
            `,
            [workspaceId, mediaId, c.id, c.username ?? null, c.text ?? null, c.timestamp ?? null],
          )
        }
      }
      const next = page?.paging?.next
      url = next ? new URL(next) : null
    } catch {
      break
    }
  }
}

async function validatePermissions(
  igUserId: string,
  accessToken: string,
  logger = defaultLogger,
): Promise<InstagramAccountProfile> {
  logger.info('🔍 Validando permissões do token...');
  let accountInfo: InstagramAccountProfile | undefined;
  try {
    const basicUrl = buildUrl(`${igUserId}`, {
      fields: 'username,followers_count,media_count',
      access_token: accessToken,
    });
    const basicData = await fetchJson(basicUrl);
    accountInfo = {
      username: basicData.username,
      followers_count: basicData.followers_count,
      media_count: basicData.media_count,
      name: basicData.name,
    };
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

  return accountInfo ?? {};
}

async function fetchUserInsights(igUserId: string, accessToken: string, days: number, logger = defaultLogger) {
  logger.info(`📊 Fetching user insights for ${days} days...`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const until = new Date();
  until.setHours(23, 59, 59, 999);

  const insights: any[] = [];
  const dailyMetrics = ['reach', 'impressions', 'follower_count'];

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
    'views',
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

async function fetchMediaInsights(mediaId: string, accessToken: string, mediaType?: string) {
  const candidates: string[] = [
    'reach',
    'impressions',
    'likes',
    'comments',
    'shares',
    'saved',
    'total_interactions',
  ];
  if (mediaType && (mediaType.includes('VIDEO') || mediaType === 'VIDEO')) {
    candidates.push('video_views');
  }
  if (mediaType && mediaType === 'REELS') {
    candidates.push('plays');
  }

  const insights: any[] = [];
  for (const metric of candidates) {
    try {
      const url = buildUrl(`${mediaId}/insights`, {
        metric,
        access_token: accessToken,
      });
      const data = await fetchJson(url);
      if (data.data) insights.push(...data.data);
    } catch (err) {
      const msg = String((err as Error).message || '');
      if (
        msg.includes('does not support') ||
        msg.includes('must be one of') ||
        msg.includes('Starting from version')
      ) {
        continue;
      }
    }
  }
  return insights;
}

async function upsertInstagramUserInsights(
  db: DatabaseClient,
  workspaceId: string,
  platformAccountId: string,
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

      const updated = await db.query(
        `
          UPDATE performance_metrics
          SET extra_metrics = COALESCE(performance_metrics.extra_metrics, '{}'::jsonb) || $4::jsonb
          WHERE workspace_id = $1
            AND platform_account_id = $2
            AND granularity = 'day'
            AND metric_date = $3::date
          RETURNING id
        `,
        [workspaceId, platformAccountId, date, JSON.stringify(extraMetrics)],
      );
      if (updated.rows.length === 0) {
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
          `,
          [workspaceId, platformAccountId, date, JSON.stringify(extraMetrics)],
        );
      }
    }
  }
}

async function upsertInstagramMedia(
  db: DatabaseClient,
  workspaceId: string,
  media: any,
) {
  // Store media in creative_assets table (schema without external_id/url columns)
  const name = media.caption ?? `Instagram ${media.media_type || 'Post'}`;
  const mt = (media.media_type || '').toUpperCase();
  const type = mt === 'IMAGE' ? 'image' : mt === 'VIDEO' ? 'video' : mt === 'CAROUSEL_ALBUM' ? 'carousel' : 'image';
  const storageUrl = media.media_url ?? null;
  const thumbUrl = media.thumbnail_url ?? null;
  const metadata = JSON.stringify({
    platform: 'instagram',
    permalink: media.permalink,
    posted_at: media.timestamp,
    like_count: Number(media.like_count ?? 0),
    comments_count: Number(media.comments_count ?? 0),
    media_type: media.media_type,
    external_id: media.id,
  });

  const updated = await db.query(
    `
      UPDATE creative_assets
      SET
        name = $3,
        type = $4,
        storage_url = $5,
        thumbnail_url = $6,
        metadata = $7::jsonb,
        updated_at = now()
      WHERE workspace_id = $1
        AND (metadata->>'external_id') = $2
      RETURNING id
    `,
    [workspaceId, media.id, name, type, storageUrl, thumbUrl, metadata],
  );

  if (updated.rows.length === 0) {
    await db.query(
      `
        INSERT INTO creative_assets (
          workspace_id,
          name,
          type,
          storage_url,
          thumbnail_url,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [workspaceId, name, type, storageUrl, thumbUrl, metadata],
    );
  }
}

async function upsertInstagramMediaInsights(
  db: DatabaseClient,
  workspaceId: string,
  platformAccountId: string,
  mediaId: string,
  insights: any[],
  mediaTimestamp?: string,
) {
  for (const insight of insights) {
    const metric = insight.name ?? 'unknown';
    const value = typeof insight.values?.[0]?.value === 'number'
      ? Number(insight.values[0].value)
      : Array.isArray(insight.values?.[0]?.value)
        ? insight.values[0].value.reduce((acc: number, item: any) => acc + Number(item.value ?? 0), 0)
        : Number(insight.values?.[0]?.total_value ?? 0);

    // Store media insights in performance_metrics table with media_insights structure
    const metricDate = mediaTimestamp
      ? new Date(mediaTimestamp).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const mediaInsights = { [mediaId]: { metrics: { [metric]: value } } };

    const updated = await db.query(
      `
        UPDATE performance_metrics
        SET extra_metrics = COALESCE(
          performance_metrics.extra_metrics,
          '{}'::jsonb
        ) || jsonb_build_object(
          'media_insights',
          COALESCE(performance_metrics.extra_metrics->'media_insights', '{}'::jsonb) || $4::jsonb->'media_insights'
        )
        WHERE workspace_id = $1
          AND platform_account_id = $2
          AND granularity = 'day'
          AND metric_date = $3::date
        RETURNING id
      `,
      [workspaceId, platformAccountId, metricDate, JSON.stringify({ media_insights: mediaInsights })],
    );
    if (updated.rows.length === 0) {
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
        `,
        [workspaceId, platformAccountId, metricDate, JSON.stringify({ media_insights: mediaInsights })],
      );
    }
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

  const accountInfo = await validatePermissions(options.igUserId, options.accessToken, logger);

  ctx.reportProgress?.(5, 'Validando permissões');

  const platformAccountId = await ensureInstagramPlatformAccount(
    db,
    options.workspaceId,
    options.igUserId,
    accountInfo,
  );

  await snapshotInstagramProfile(db, options.workspaceId, options.igUserId, options.accessToken)

  const userInsights = await fetchUserInsights(options.igUserId, options.accessToken, options.days, logger);
  summary.userInsights = userInsights.length;
  await upsertInstagramUserInsights(db, options.workspaceId, platformAccountId, userInsights);
  ctx.reportProgress?.(25, 'Insights do usuário sincronizados');


  const media = await fetchMedia(options.igUserId, options.accessToken, options.days, logger);
  summary.mediaFetched = media.length;
  ctx.reportProgress?.(40, 'Posts coletados');

  let processed = 0;
  for (const item of media) {
    await upsertInstagramMedia(db, options.workspaceId, item);
    await upsertInstagramMediaMap(db, options.workspaceId, item, options.accessToken);
    const insights = await fetchMediaInsights(item.id, options.accessToken, item.media_type);
    await upsertInstagramMediaInsights(db, options.workspaceId, platformAccountId, item.id, insights, item.timestamp);
    await fetchAndStoreComments(db, options.workspaceId, item.id, options.accessToken);
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

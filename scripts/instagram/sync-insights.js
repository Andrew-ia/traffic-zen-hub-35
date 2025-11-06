#!/usr/bin/env node

/**
 * Instagram Insights Sync Script
 *
 * Collects insights from Instagram Graph API and stores in performance_metrics table
 *
 * Required environment variables:
 * - IG_USER_ID: Instagram Business Account ID
 * - IG_ACCESS_TOKEN: Long-lived User Access Token
 * - IG_WORKSPACE_ID: Workspace ID
 * - SUPABASE_DATABASE_URL: Database connection string
 * - SYNC_DAYS: Number of days to sync (default: 7)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

const GRAPH_URL = 'https://graph.facebook.com/v24.0';

// Environment variables
const {
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IG_WORKSPACE_ID,
  SUPABASE_DATABASE_URL,
} = process.env;

const SYNC_DAYS = parseInt(process.env.SYNC_DAYS || '7', 10);

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Helper to add delay between API requests to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limiter: wait 200ms between each Instagram API request
const RATE_LIMIT_DELAY_MS = 200;

async function fetchJson(url) {
  // Add delay before each request to avoid hitting rate limits
  await delay(RATE_LIMIT_DELAY_MS);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram API error ${response.status}: ${text}`);
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

/**
 * Validate Instagram API permissions with lightweight checks
 * - Checks basic account fields (requires instagram_basic)
 * - Attempts a simple insights metric (requires instagram_manage_insights)
 */
async function validatePermissions(igUserId, accessToken) {
  console.log('🔍 Validando permissões do token...');

  // Check instagram_basic by fetching simple account fields
  try {
    const basicUrl = buildUrl(`${igUserId}`, {
      fields: 'username,followers_count,media_count',
      access_token: accessToken,
    });
    await fetchJson(basicUrl);
  } catch (error) {
    console.error('❌ Falha ao validar instagram_basic:', error.message);
    throw new Error('Permissão ausente: instagram_basic');
  }

  // Check instagram_manage_insights by fetching a simple metric
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
    console.log('✅ Permissões básicas OK');
  } catch (error) {
    const msg = String(error.message || '');
    if (msg.includes('does not have permission') || msg.includes('Permission') || msg.includes('code 10')) {
      console.error('❌ ERRO DE PERMISSÃO: O aplicativo não tem acesso ao Instagram Insights.');
      console.error('📋 Permissões necessárias: instagram_manage_insights, instagram_basic, pages_read_engagement, pages_show_list');
      console.error('🔧 Corrija em: https://developers.facebook.com/apps/1486406569007058/ (App Review)');
      throw new Error('Missing required permissions for Instagram Insights API');
    }
    throw error;
  }
}

/**
 * Fetch Instagram User Insights
 * Metrics: reach, impressions, profile_views, website_clicks, email_contacts, phone_call_clicks
 */
async function fetchUserInsights(igUserId, accessToken, days) {
  console.log(`📊 Fetching user insights for ${days} days...`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const until = new Date();
  until.setHours(23, 59, 59, 999);

  // Metrics available in Instagram Graph API v21.0+
  // See: https://developers.facebook.com/docs/instagram-api/reference/ig-user/insights
  // NOTE: 'impressions' was removed in v21.0+, use 'reach' instead

  const insights = [];

  // 1) Fetch daily metrics with values array (time series data)
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
      console.warn(`⚠️ Could not fetch ${metric}:`, String(err.message || err).substring(0, 100));
    }
  }

  // 2) Fetch metrics requiring metric_type=total_value
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
      const msg = String(err.message || err);
      if (!msg.includes('must be one of')) {
        console.warn(`⚠️ Could not fetch ${metric}:`, msg.substring(0, 100));
      }
    }
  }

  // 3) Fetch lifetime metrics (special case)
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
    console.warn('⚠️ Could not fetch online_followers:', String(err.message || err).substring(0, 100));
  }

  console.log(`✅ Fetched ${insights.length} user insight metrics`);
  return insights;
}

/**
 * Fetch Instagram Media (posts) for recent period
 */
async function fetchRecentMedia(igUserId, accessToken, days) {
  console.log(`📸 Fetching recent media posts...`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  const url = buildUrl(`${igUserId}/media`, {
    fields: 'id,media_type,timestamp,caption,permalink,media_url,thumbnail_url',
    access_token: accessToken,
  });

  const media = [];
  let nextUrl = url;

  while (nextUrl) {
    const data = await fetchJson(nextUrl);

    if (Array.isArray(data.data)) {
      // Filter by date
      const recentMedia = data.data.filter(m => {
        const timestamp = new Date(m.timestamp).getTime() / 1000;
        return timestamp >= sinceTimestamp;
      });

      media.push(...recentMedia);

      // Stop if we've gone past the date range
      if (recentMedia.length < data.data.length) {
        break;
      }
    }

    nextUrl = data.paging?.next ? new URL(data.paging.next) : null;
  }

  console.log(`✅ Found ${media.length} recent media posts`);
  return media;
}

/**
 * Fetch insights for a specific media post
 */
function getMetricsByMediaType(mediaType) {
  // Metrics valid for Instagram API v21.0+
  // Note: plays, video_views, profile_visits, follows removed in v22.0+
  switch (mediaType) {
    case 'IMAGE':
    case 'CAROUSEL_ALBUM':
      return ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'];
    case 'VIDEO':
    case 'REELS':
      return ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'views'];
    default:
      return ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'];
  }
}

async function fetchMediaInsights(mediaId, mediaType, accessToken) {
  const candidateMetrics = getMetricsByMediaType(mediaType);

  const results = [];
  for (const metric of candidateMetrics) {
    const url = buildUrl(`${mediaId}/insights`, {
      metric,
      access_token: accessToken,
    });

    try {
      const data = await fetchJson(url);
      if (Array.isArray(data?.data) && data.data.length > 0) {
        results.push(...data.data);
      }
      await delay(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      const msg = error?.message || String(error);
      // Ignore unsupported metric errors for specific media types, continue
      if (msg.includes('metric') && msg.includes('not supported') || msg.includes('must be one of')) {
        continue;
      }
      console.warn(`⚠️ Could not fetch insights for media ${mediaId} (metric=${metric}):`, msg);
    }
  }

  return results;
}

/**
 * Transform Instagram insights data to our performance_metrics format
 */
function transformUserInsights(insights, workspaceId, platformAccountId, igUserId) {
  const metricsByDate = new Map();

  for (const insight of insights) {
    const metricName = insight.name;

    // Handle two different response formats:
    // 1. Standard metrics with 'values' array (e.g., reach)
    // 2. total_value metrics with single 'total_value' object

    if (insight.values && Array.isArray(insight.values)) {
      // Format 1: Standard metrics with time series data
      for (const value of insight.values) {
        const date = value.end_time.split('T')[0]; // Get YYYY-MM-DD

        if (!metricsByDate.has(date)) {
          metricsByDate.set(date, {
            workspace_id: workspaceId,
            platform_account_id: platformAccountId,
            metric_date: date,
            granularity: 'day',
            impressions: 0,
            clicks: 0,
            spend: 0,
            extra_metrics: {},
          });
        }

        const metrics = metricsByDate.get(date);

        // Map Instagram metrics to our schema
        switch (metricName) {
          case 'reach':
            metrics.extra_metrics.reach = value.value || 0;
            break;
          case 'follower_count':
            metrics.extra_metrics.follower_count = value.value || 0;
            break;
        }
      }
    } else if (insight.total_value) {
      // Format 2: total_value metrics (aggregated over the period)
      // Store as a single entry for "today" since it's a period total
      const today = new Date().toISOString().split('T')[0];

      if (!metricsByDate.has(today)) {
        metricsByDate.set(today, {
          workspace_id: workspaceId,
          platform_account_id: platformAccountId,
          metric_date: today,
          granularity: 'day',
          impressions: 0,
          clicks: 0,
          spend: 0,
          extra_metrics: {},
        });
      }

      const metrics = metricsByDate.get(today);
      const totalValue = insight.total_value.value || 0;

      switch (metricName) {
        case 'profile_views':
          metrics.extra_metrics.profile_views = totalValue;
          break;
        case 'website_clicks':
          metrics.clicks = totalValue;
          metrics.extra_metrics.website_clicks = totalValue;
          break;
        case 'accounts_engaged':
          metrics.extra_metrics.accounts_engaged = totalValue;
          break;
        case 'total_interactions':
          metrics.extra_metrics.total_interactions = totalValue;
          break;
        case 'likes':
          metrics.extra_metrics.likes = totalValue;
          break;
        case 'comments':
          metrics.extra_metrics.comments = totalValue;
          break;
        case 'shares':
          metrics.extra_metrics.shares = totalValue;
          break;
        case 'saves':
          metrics.extra_metrics.saves = totalValue;
          break;
        case 'replies':
          metrics.extra_metrics.replies = totalValue;
          break;
        case 'profile_links_taps':
          metrics.extra_metrics.profile_links_taps = totalValue;
          break;
      }
    } else if (metricName === 'online_followers' && insight.values) {
      // Format 3: online_followers has special format with hourly data
      const today = new Date().toISOString().split('T')[0];

      if (!metricsByDate.has(today)) {
        metricsByDate.set(today, {
          workspace_id: workspaceId,
          platform_account_id: platformAccountId,
          metric_date: today,
          granularity: 'day',
          impressions: 0,
          clicks: 0,
          spend: 0,
          extra_metrics: {},
        });
      }

      const metrics = metricsByDate.get(today);
      // Store the hourly breakdown
      if (insight.values[0] && insight.values[0].value) {
        metrics.extra_metrics.online_followers = insight.values[0].value;
      }
    }
  }

  return Array.from(metricsByDate.values());
}

/**
 * Transform media insights into performance_metrics format, stored under extra_metrics.media_insights[media_id]
 */
function transformMediaInsights(media, insights, workspaceId, platformAccountId) {
  // Build metrics payload per media
  const metricsObj = {};
  for (const item of insights) {
    if (!item || !item.name) continue;
    // Media insights are usually lifetime; use first value when present
    const v = Array.isArray(item.values) && item.values.length > 0 ? item.values[0]?.value : undefined;
    if (v !== undefined && v !== null) {
      metricsObj[item.name] = v;
    }
  }

  // Use media timestamp date for metric_date; fallback to today
  let dateStr;
  if (media?.timestamp) {
    dateStr = media.timestamp.split('T')[0];
  } else {
    const d = new Date();
    dateStr = d.toISOString().split('T')[0];
  }

  const extra = {
    media_insights: {
      [media.id]: {
        media_type: media.media_type,
        timestamp: media.timestamp,
        permalink: media.permalink,
        media_url: media.media_url || media.thumbnail_url,
        metrics: metricsObj,
      },
    },
  };

  return [{
    workspace_id: workspaceId,
    platform_account_id: platformAccountId,
    metric_date: dateStr,
    granularity: 'day',
    impressions: null,
    clicks: null,
    spend: null,
    extra_metrics: extra,
  }];
}

/**
 * Upsert metrics into database
 */
async function upsertMetrics(client, metrics) {
  if (metrics.length === 0) {
    console.log('⚠️ No metrics to upsert');
    return;
  }

  console.log(`💾 Upserting ${metrics.length} metric records...`);

  for (const metric of metrics) {
    // Try UPDATE first for idempotency, then INSERT if no rows affected
    const updateResult = await client.query(
      `
        UPDATE performance_metrics
        SET impressions = COALESCE($5, impressions),
            clicks = COALESCE($6, clicks),
            spend = COALESCE($7, spend),
            extra_metrics = COALESCE(extra_metrics, '{}'::jsonb) || $8::jsonb
        WHERE workspace_id = $1
          AND platform_account_id = $2
          AND campaign_id IS NULL
          AND ad_set_id IS NULL
          AND ad_id IS NULL
          AND granularity = $3
          AND metric_date = $4
      `,
      [
        metric.workspace_id,
        metric.platform_account_id,
        metric.granularity,
        metric.metric_date,
        metric.impressions ?? null,
        metric.clicks ?? null,
        metric.spend ?? null,
        JSON.stringify(metric.extra_metrics),
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query(
        `
        INSERT INTO performance_metrics (
          workspace_id,
          platform_account_id,
          campaign_id,
          ad_set_id,
          ad_id,
          metric_date,
          granularity,
          impressions,
          clicks,
          spend,
          extra_metrics
        )
        VALUES ($1, $2, NULL, NULL, NULL, $3, $4, COALESCE($5, 0), COALESCE($6, 0), COALESCE($7, 0), $8::jsonb)
        `,
        [
          metric.workspace_id,
          metric.platform_account_id,
          metric.metric_date,
          metric.granularity,
          metric.impressions ?? null,
          metric.clicks ?? null,
          metric.spend ?? null,
          JSON.stringify(metric.extra_metrics),
        ]
      );
    }
  }

  console.log('✅ Metrics upserted successfully');
}

/**
 * Update integration last_sync timestamp
 */
async function updateIntegrationSync(client, workspaceId) {
  await client.query(
    `
    UPDATE workspace_integrations
    SET last_synced_at = now(), updated_at = now()
    WHERE workspace_id = $1 AND platform_key = 'instagram'
    `,
    [workspaceId]
  );
}

/**
 * Main sync function
 */
async function main() {
  const client = new Client({
    connectionString: assertEnv(SUPABASE_DATABASE_URL, 'SUPABASE_DATABASE_URL'),
  });

  try {
    await client.connect();

    const igUserId = assertEnv(IG_USER_ID, 'IG_USER_ID');
    const accessToken = assertEnv(IG_ACCESS_TOKEN, 'IG_ACCESS_TOKEN');
    const workspaceId = assertEnv(IG_WORKSPACE_ID, 'IG_WORKSPACE_ID');

    console.log('\n🔄 Starting Instagram Insights sync');
    console.log(`📅 Period: last ${SYNC_DAYS} days`);
    console.log(`👤 IG User ID: ${igUserId}`);
    console.log(`🏢 Workspace: ${workspaceId}\n`);

    // Validate permissions before heavy sync
    await validatePermissions(igUserId, accessToken);

    // Get platform account ID
    const { rows: platformAccounts } = await client.query(
      `
      SELECT id FROM platform_accounts
      WHERE workspace_id = $1 AND platform_key = 'instagram'
      LIMIT 1
      `,
      [workspaceId]
    );

    if (platformAccounts.length === 0) {
      throw new Error('Instagram platform account not found. Please set up integration first.');
    }

    const platformAccountId = platformAccounts[0].id;

    // Fetch user insights
    const userInsights = await fetchUserInsights(igUserId, accessToken, SYNC_DAYS);

    // Transform and upsert
    if (userInsights.length > 0) {
      const metrics = transformUserInsights(userInsights, workspaceId, platformAccountId, igUserId);
      await upsertMetrics(client, metrics);
    }

    // Fetch recent media and their insights (gracefully skip if token lacks permission)
    try {
      const recentMedia = await fetchRecentMedia(igUserId, accessToken, SYNC_DAYS);
      if (recentMedia.length > 0) {
        console.log(`\n📊 Fetching insights for ${recentMedia.length} media posts...`);
        const mediaMetrics = [];
        let processedCount = 0;
        for (const media of recentMedia) {
          const mediaInsights = await fetchMediaInsights(media.id, media.media_type, accessToken);
          const transformed = transformMediaInsights(media, mediaInsights, workspaceId, platformAccountId);
          mediaMetrics.push(...transformed);
          processedCount++;
          if (processedCount % 5 === 0) {
            console.log(`   Progress: ${processedCount}/${recentMedia.length} media processed`);
          }
        }
        if (mediaMetrics.length > 0) {
          await upsertMetrics(client, mediaMetrics);
        }
        console.log(`✅ Processed insights for ${recentMedia.length} media posts`);
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      if (msg.includes('Application does not have permission') || msg.includes('OAuthException') || msg.includes('code":10')) {
        console.warn('⚠️  Token sem permissão para mídia. Pulando etapa de mídia e concluindo apenas insights de usuário.');
      } else {
        throw err;
      }
    }

    // Update last sync timestamp
    await updateIntegrationSync(client, workspaceId);

    console.log(`\n✅ Instagram Insights sync completed successfully!\n`);
  } catch (error) {
    console.error('\n❌ Error during sync:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

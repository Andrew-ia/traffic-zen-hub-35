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

  const metrics = [
    'impressions',
    'reach',
    'profile_views',
    'website_clicks',
    'email_contacts',
    'phone_call_clicks',
    'get_directions_clicks',
    'text_message_clicks',
  ];

  const insights = [];

  // Instagram API requires fetching metrics in groups
  // We'll fetch daily metrics (period=day)
  const url = buildUrl(`${igUserId}/insights`, {
    metric: metrics.join(','),
    period: 'day',
    since: Math.floor(since.getTime() / 1000),
    until: Math.floor(until.getTime() / 1000),
    access_token: accessToken,
  });

  try {
    const data = await fetchJson(url);

    if (data.data) {
      insights.push(...data.data);
    }

    console.log(`✅ Fetched ${insights.length} user insight metrics`);
    return insights;
  } catch (error) {
    console.error(`❌ Error fetching user insights:`, error.message);
    return [];
  }
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
    fields: 'id,media_type,timestamp,caption,permalink',
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
async function fetchMediaInsights(mediaId, accessToken) {
  const metrics = [
    'impressions',
    'reach',
    'engagement',
    'saved',
    'likes',
    'comments',
    'shares',
  ];

  const url = buildUrl(`${mediaId}/insights`, {
    metric: metrics.join(','),
    access_token: accessToken,
  });

  try {
    const data = await fetchJson(url);
    return data.data || [];
  } catch (error) {
    // Some media types (like Stories) may not have all metrics available
    console.warn(`⚠️ Could not fetch insights for media ${mediaId}:`, error.message);
    return [];
  }
}

/**
 * Transform Instagram insights data to our performance_metrics format
 */
function transformUserInsights(insights, workspaceId, platformAccountId, igUserId) {
  const metricsByDate = new Map();

  for (const insight of insights) {
    const metricName = insight.name;
    const values = insight.values || [];

    for (const value of values) {
      const date = value.end_time.split('T')[0]; // Get YYYY-MM-DD

      if (!metricsByDate.has(date)) {
        metricsByDate.set(date, {
          workspace_id: workspaceId,
          platform_account_id: platformAccountId,
          external_id: igUserId,
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
        case 'impressions':
          metrics.impressions = value.value || 0;
          break;
        case 'reach':
          metrics.extra_metrics.reach = value.value || 0;
          break;
        case 'profile_views':
          metrics.extra_metrics.profile_views = value.value || 0;
          break;
        case 'website_clicks':
          metrics.clicks = value.value || 0;
          metrics.extra_metrics.website_clicks = value.value || 0;
          break;
        case 'email_contacts':
          metrics.extra_metrics.email_contacts = value.value || 0;
          break;
        case 'phone_call_clicks':
          metrics.extra_metrics.phone_call_clicks = value.value || 0;
          break;
        case 'get_directions_clicks':
          metrics.extra_metrics.get_directions_clicks = value.value || 0;
          break;
        case 'text_message_clicks':
          metrics.extra_metrics.text_message_clicks = value.value || 0;
          break;
      }
    }
  }

  return Array.from(metricsByDate.values());
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
    await client.query(
      `
      INSERT INTO performance_metrics (
        workspace_id,
        platform_account_id,
        external_id,
        metric_date,
        granularity,
        impressions,
        clicks,
        spend,
        extra_metrics
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (workspace_id, platform_account_id, external_id, metric_date, granularity)
      DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        extra_metrics = EXCLUDED.extra_metrics,
        updated_at = now()
      `,
      [
        metric.workspace_id,
        metric.platform_account_id,
        metric.external_id,
        metric.metric_date,
        metric.granularity,
        metric.impressions,
        metric.clicks,
        metric.spend,
        JSON.stringify(metric.extra_metrics),
      ]
    );
  }

  console.log('✅ Metrics upserted successfully');
}

/**
 * Update integration last_sync timestamp
 */
async function updateIntegrationSync(client, workspaceId) {
  await client.query(
    `
    UPDATE integrations
    SET last_sync = now()
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

    // Fetch recent media and their insights
    const recentMedia = await fetchRecentMedia(igUserId, accessToken, SYNC_DAYS);

    if (recentMedia.length > 0) {
      console.log(`\n📊 Fetching insights for ${recentMedia.length} media posts...`);

      let processedCount = 0;
      for (const media of recentMedia) {
        const mediaInsights = await fetchMediaInsights(media.id, accessToken);
        processedCount++;

        if (processedCount % 5 === 0) {
          console.log(`   Progress: ${processedCount}/${recentMedia.length} media processed`);
        }
      }

      console.log(`✅ Processed insights for ${recentMedia.length} media posts`);
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

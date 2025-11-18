import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../services/encryption.js';

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Simple Instagram sync - Synchronous processing
 * POST /api/integrations/instagram/sync-simple
 */
export async function simpleInstagramSync(req: Request, res: Response) {
  try {
    const { workspaceId, days = 7 } = req.body;
    const envWorkspaceId = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID;
    const normalizedWorkspaceId = String(workspaceId || envWorkspaceId || '').trim();

    if (!normalizedWorkspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing workspaceId'
      });
    }

    console.log(`🚀 Starting simple Instagram sync for ${days} days`);

    const pool = getPool();

    // Get credentials
    let credResult = await pool.query(
      `SELECT encrypted_credentials, encryption_iv 
       FROM integration_credentials 
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [normalizedWorkspaceId]
    );

    if (credResult.rows.length === 0) {
      // Try environment variables as fallback
      const envIgUserId = String(process.env.IG_USER_ID || process.env.VITE_IG_USER_ID || '').trim();
      const envAccessToken = String(process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN || '').trim();

      if (!envIgUserId || !envAccessToken) {
        return res.status(404).json({
          success: false,
          error: 'Instagram credentials not found. Please configure integration first.'
        });
      }

      // Store credentials for future use
      const enc = encryptCredentials({ igUserId: envIgUserId, accessToken: envAccessToken });
      await pool.query(
        `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
         VALUES ($1, 'instagram', $2, $3)
         ON CONFLICT (workspace_id, platform_key)
         DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv`,
        [normalizedWorkspaceId, enc.encrypted_credentials, enc.encryption_iv]
      );

      credResult = await pool.query(
        `SELECT encrypted_credentials, encryption_iv 
         FROM integration_credentials 
         WHERE workspace_id = $1 AND platform_key = 'instagram'`,
        [normalizedWorkspaceId]
      );
    }

    const { encrypted_credentials, encryption_iv } = credResult.rows[0];
    const credentials = decryptCredentials(encrypted_credentials, encryption_iv) as any;
    const { igUserId, accessToken } = credentials;

    if (!igUserId || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Instagram credentials format'
      });
    }

    console.log(`📊 Processing Instagram account: ${igUserId}`);

    // Ensure platform exists
    await pool.query(
      `INSERT INTO platforms (key, display_name, category)
       VALUES ('instagram', 'Instagram Insights', 'analytics')
       ON CONFLICT (key) DO NOTHING`
    );

    // Ensure workspace integration
    const integrationResult = await pool.query(
      `INSERT INTO workspace_integrations (workspace_id, platform_key, status)
       VALUES ($1, 'instagram', 'active')
       ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
         status = 'active', updated_at = now()
       RETURNING id`,
      [normalizedWorkspaceId]
    );
    const integrationId = integrationResult.rows[0]?.id;

    // Get or create platform account
    let platformAccountResult = await pool.query(
      `SELECT id FROM platform_accounts 
       WHERE workspace_id = $1 AND platform_key = 'instagram' AND external_id = $2`,
      [normalizedWorkspaceId, igUserId]
    );

    if (platformAccountResult.rows.length === 0) {
      platformAccountResult = await pool.query(
        `INSERT INTO platform_accounts (
           workspace_id, integration_id, platform_key, external_id, name, status
         ) VALUES ($1, $2, 'instagram', $3, 'Instagram Business Account', 'active')
         RETURNING id`,
        [normalizedWorkspaceId, integrationId, igUserId]
      );
    }
    const platformAccountId = platformAccountResult.rows[0].id;

    // Validate permissions
    console.log(`🔍 Validating permissions...`);
    
    // Test basic account access
    const basicUrl = new URL(`${GRAPH_URL}/${igUserId}`);
    basicUrl.searchParams.set('fields', 'username,followers_count,media_count');
    basicUrl.searchParams.set('access_token', accessToken);
    
    const basicResp = await fetch(basicUrl);
    if (!basicResp.ok) {
      const text = await basicResp.text();
      throw new Error(`Instagram authentication failed: ${text}`);
    }

    const basicData = await basicResp.json();
    console.log(`✅ Account validation OK: @${basicData.username}`);

    // Test insights permissions
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1);
    const testUrl = new URL(`${GRAPH_URL}/${igUserId}/insights`);
    testUrl.searchParams.set('metric', 'reach');
    testUrl.searchParams.set('period', 'day');
    testUrl.searchParams.set('since', Math.floor(testDate.getTime() / 1000).toString());
    testUrl.searchParams.set('until', Math.floor(Date.now() / 1000).toString());
    testUrl.searchParams.set('access_token', accessToken);

    const testResp = await fetch(testUrl);
    if (!testResp.ok) {
      const text = await testResp.text();
      throw new Error(`Instagram insights permissions failed: ${text}`);
    }

    console.log(`✅ Insights permissions OK`);

    // Process data synchronously
    console.log(`📈 Fetching ${days} days of data...`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const allMetrics: any[] = [];
    let processedDays = 0;

    // Fetch data day by day
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dayStr = currentDate.toISOString().split('T')[0];
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      console.log(`📅 Processing ${dayStr}...`);

      try {
        // Primary metrics
        const insightsUrl = `${GRAPH_URL}/${igUserId}/insights`;
        const params = new URLSearchParams({
          metric: 'reach,profile_views,website_clicks,accounts_engaged,total_interactions,likes,comments,shares,saves',
          metric_type: 'total_value',
          period: 'day',
          since: dayStr,
          until: nextDayStr,
          access_token: accessToken,
        });

        const response = await fetch(`${insightsUrl}?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            data.data.forEach(metric => {
              metric.date = dayStr;
            });
            allMetrics.push(...data.data);
          }
        }

        // Rate limiting - wait 1 second between calls
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try follower count separately
        try {
          const followerParams = new URLSearchParams({
            metric: 'follower_count',
            period: 'day',
            since: dayStr,
            until: nextDayStr,
            access_token: accessToken,
          });

          const followerResponse = await fetch(`${insightsUrl}?${followerParams.toString()}`);
          if (followerResponse.ok) {
            const followerData = await followerResponse.json();
            if (followerData.data) {
              followerData.data.forEach(metric => {
                metric.date = dayStr;
              });
              allMetrics.push(...followerData.data);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (followerError) {
          console.warn(`⚠️  Follower data not available for ${dayStr}`);
        }

        processedDays++;
        
      } catch (dayError) {
        console.error(`❌ Error processing ${dayStr}:`, dayError.message);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📊 Fetched ${allMetrics.length} metric records`);

    // Store metrics
    let recordsStored = 0;
    for (const metric of allMetrics) {
      if (!metric.date) continue;

      let metricValue = 0;
      if (metric.total_value && typeof metric.total_value.value === 'number') {
        metricValue = metric.total_value.value;
      }

      try {
        await pool.query(
          `INSERT INTO performance_metrics (
            workspace_id, platform_account_id, granularity, metric_date,
            impressions, clicks, spend, conversions, extra_metrics, synced_at
          ) VALUES ($1, $2, 'day', $3, $4, $5, $6, $7, $8, now())
          ON CONFLICT (workspace_id, platform_account_id, metric_date, granularity)
          DO UPDATE SET
            clicks = CASE WHEN $5 IS NOT NULL THEN $5 ELSE performance_metrics.clicks END,
            extra_metrics = performance_metrics.extra_metrics || $8,
            synced_at = now()`,
          [
            normalizedWorkspaceId,
            platformAccountId,
            metric.date,
            0, // impressions
            metric.name === 'website_clicks' ? metricValue : null,
            0, // spend
            0, // conversions
            JSON.stringify({ [metric.name]: metricValue }),
          ]
        );
        recordsStored++;
      } catch (storeError) {
        console.warn(`⚠️  Error storing metric ${metric.name} for ${metric.date}:`, storeError.message);
      }
    }

    // Update last sync time
    await pool.query(
      `UPDATE workspace_integrations 
       SET last_synced_at = now(), updated_at = now()
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [normalizedWorkspaceId]
    );

    console.log(`✅ Sync completed: ${recordsStored} records stored`);

    res.json({
      success: true,
      message: `Instagram sync completed successfully! Processed ${days} days of data.`,
      data: {
        accountId: igUserId,
        username: basicData.username,
        days: days,
        recordsProcessed: allMetrics.length,
        recordsStored: recordsStored,
        processedDays: processedDays
      }
    });

  } catch (error) {
    console.error('❌ Simple Instagram sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

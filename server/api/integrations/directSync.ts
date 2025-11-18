import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../services/encryption.js';

const GRAPH_VERSION = 'v24.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Direct Instagram sync for serverless environments (like Vercel)
 * POST /api/integrations/direct-sync
 */
export async function directInstagramSync(req: Request, res: Response) {
  try {
    const { workspaceId, days = 7, mode = 'single', totalDays = days, batchDays = 5, accessTokenOverride, igUserIdOverride } = req.body as any;
    const envWorkspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    const normalizedWorkspaceId = String(workspaceId || envWorkspaceId || '').trim();

    if (!normalizedWorkspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing workspaceId',
      });
    }

    const pool = getPool();

    // Get Instagram credentials
    let credResult = await pool.query(
      `SELECT encrypted_credentials, encryption_iv 
       FROM integration_credentials 
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [normalizedWorkspaceId]
    );

    if (credResult.rows.length === 0) {
      const envIgUserId = String((process.env.IG_USER_ID || process.env.VITE_IG_USER_ID || '')).trim();
      const envAccessToken = String((process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN || '')).trim();

      if (envIgUserId && envAccessToken) {
        const enc = encryptCredentials({ igUserId: envIgUserId, accessToken: envAccessToken });
        await pool.query(
          `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
           VALUES ($1, 'instagram', $2, $3)
           ON CONFLICT (workspace_id, platform_key)
           DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
          [normalizedWorkspaceId, enc.encrypted_credentials, enc.encryption_iv]
        );

        credResult = await pool.query(
          `SELECT encrypted_credentials, encryption_iv 
           FROM integration_credentials 
           WHERE workspace_id = $1 AND platform_key = 'instagram'`,
          [normalizedWorkspaceId]
        );
      } else {
        try {
          const secrets = await pool.query(
            `SELECT name, value FROM get_secrets(ARRAY['ig_access_token','ig_user_id'])`
          );
          const accessTokenRow = secrets.rows.find((r: any) => r.name === 'ig_access_token');
          const userIdRow = secrets.rows.find((r: any) => r.name === 'ig_user_id');
          const accessToken = accessTokenRow?.value;
          const igUserId = userIdRow?.value;

          if (!accessToken || !igUserId) {
            return res.status(404).json({
              success: false,
              error: 'Instagram credentials not found. Configure integration_credentials or env variables.',
            });
          }

          const enc = encryptCredentials({ igUserId, accessToken });
          await pool.query(
            `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
             VALUES ($1, 'instagram', $2, $3)
             ON CONFLICT (workspace_id, platform_key)
             DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
            [normalizedWorkspaceId, enc.encrypted_credentials, enc.encryption_iv]
          );

          credResult = await pool.query(
            `SELECT encrypted_credentials, encryption_iv 
             FROM integration_credentials 
             WHERE workspace_id = $1 AND platform_key = 'instagram'`,
            [normalizedWorkspaceId]
          );
        } catch (vaultErr) {
          return res.status(500).json({ success: false, error: 'Failed to resolve credentials from Vault' });
        }
      }
    }

    const { encrypted_credentials, encryption_iv } = credResult.rows[0];
    const credentials = decryptCredentials(encrypted_credentials, encryption_iv);
    let { igUserId, accessToken } = credentials as any;
    if (typeof igUserIdOverride === 'string' && igUserIdOverride.trim()) {
      igUserId = igUserIdOverride.trim();
    }
    if (typeof accessTokenOverride === 'string' && accessTokenOverride.trim()) {
      accessToken = accessTokenOverride.trim();
    }

    if (!igUserId || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Instagram credentials format',
      });
    }

    console.log(`🚀 Starting direct Instagram sync for user ${igUserId}`);

    // Ensure platform and integration records exist
    await pool.query(
      `INSERT INTO platforms (key, display_name, category)
       VALUES ('instagram', 'Instagram Insights', 'analytics')
       ON CONFLICT (key) DO NOTHING`
    );

    const integrationInsert = await pool.query(
      `INSERT INTO workspace_integrations (workspace_id, platform_key, status)
       VALUES ($1, 'instagram', 'active')
       ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
         status = 'active', updated_at = now()
       RETURNING id`,
      [normalizedWorkspaceId]
    );
    const integrationId = integrationInsert.rows[0]?.id;

    // Ensure platform account exists
    let platformAccountId: string | null = null;
    const platformAccountResult = await pool.query(
      `SELECT id FROM platform_accounts 
       WHERE workspace_id = $1 AND platform_key = 'instagram' AND external_id = $2`,
      [normalizedWorkspaceId, igUserId]
    );
    if (platformAccountResult.rows.length > 0) {
      platformAccountId = platformAccountResult.rows[0].id;
    } else {
      const insertAccount = await pool.query(
        `INSERT INTO platform_accounts (
           workspace_id, integration_id, platform_key, external_id, name, status
         ) VALUES ($1, $2, 'instagram', $3, 'Instagram Business Account', 'active')
         RETURNING id`,
        [normalizedWorkspaceId, integrationId, igUserId]
      );
      platformAccountId = insertAccount.rows[0]?.id || null;
    }

    // Validate permissions early
    const basicFields = new URL(`${GRAPH_URL}/${igUserId}`);
    basicFields.searchParams.set('fields', 'username,followers_count,media_count');
    basicFields.searchParams.set('access_token', accessToken);
    const basicResp = await fetch(basicFields);
    if (!basicResp.ok) {
      const text = await basicResp.text();
      return res.status(403).json({ success: false, error: `Falha em instagram_basic: ${text}` });
    }

    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const reachUrl = new URL(`${GRAPH_URL}/${igUserId}/insights`);
    reachUrl.searchParams.set('metric', 'reach');
    reachUrl.searchParams.set('period', 'day');
    reachUrl.searchParams.set('since', Math.floor(oneDayAgo.getTime() / 1000).toString());
    reachUrl.searchParams.set('until', Math.floor(now.getTime() / 1000).toString());
    reachUrl.searchParams.set('access_token', accessToken);
    const reachResp = await fetch(reachUrl);
    if (!reachResp.ok) {
      const text = await reachResp.text();
      return res.status(403).json({ success: false, error: `Permissões insuficientes para insights: ${text}` });
    }

    // Calculate date range with optional step mode (chunked sync)
    const endDate = new Date();
    const dateFormat = (date: Date) => date.toISOString().split('T')[0];
    let startDate = new Date();
    startDate.setDate(endDate.getDate() - Number(totalDays));

    let stepStart = new Date(startDate);
    let stepEnd = new Date(endDate);

    if (String(mode) === 'step' && platformAccountId) {
      const cursorRow = await pool.query(
        `SELECT cursor FROM data_sync_cursors WHERE platform_account_id = $1 AND entity_type = 'instagram_insights' LIMIT 1`,
        [platformAccountId]
      );
      const cursor = cursorRow.rows[0]?.cursor || null;
      const nextDateStr = cursor?.nextDate || null;
      const nextDate = nextDateStr ? new Date(nextDateStr) : new Date(startDate);
      stepStart = nextDate;
      const candidateEnd = new Date(nextDate);
      candidateEnd.setDate(candidateEnd.getDate() + Number(batchDays));
      stepEnd = candidateEnd > endDate ? endDate : candidateEnd;
      await pool.query(
        `INSERT INTO data_sync_cursors (workspace_id, platform_account_id, entity_type, cursor, updated_at)
         VALUES ($1, $2, 'instagram_insights', $3::jsonb, now())
         ON CONFLICT (platform_account_id, entity_type)
         DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
        [normalizedWorkspaceId, platformAccountId, JSON.stringify({ nextDate: dateFormat(stepStart), endDate: dateFormat(endDate) })]
      );
    }

    const since = dateFormat(stepStart);
    const until = dateFormat(stepEnd);
    console.log(`📅 Fetching data from ${since} to ${until} ${String(mode) === 'step' ? `(batch=${batchDays}d)` : ''}`);

    // Fetch data for each day individually to get daily breakdown
    const allMetricsData = [];
    const currentDate = new Date(stepStart);
    
    while (currentDate < stepEnd) {
      const dayStr = dateFormat(currentDate);
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = dateFormat(nextDay);
      
      console.log(`📊 Fetching data for ${dayStr}`);
      
      try {
        const insightsUrl = `${GRAPH_URL}/${igUserId}/insights`;
        const dayParams = new URLSearchParams({
          metric: 'reach,profile_views,website_clicks,accounts_engaged,total_interactions,likes,comments,shares,saves',
          metric_type: 'total_value',
          period: 'day',
          since: dayStr,
          until: nextDayStr,
          access_token: accessToken,
        });

        const dayResponse = await fetch(`${insightsUrl}?${dayParams.toString()}`);
        const dayData = await dayResponse.json();

        if (dayResponse.ok && dayData.data) {
          // Add the date to each metric for processing
          dayData.data.forEach(metric => {
            metric.date = dayStr;
          });
          allMetricsData.push(...dayData.data);
        }

        // Try to get follower_count for this day
        const followerParams = new URLSearchParams({
          metric: 'follower_count',
          period: 'day', 
          since: dayStr,
          until: nextDayStr,
          access_token: accessToken,
        });

        const followerResponse = await fetch(`${insightsUrl}?${followerParams.toString()}`);
        const followerData = await followerResponse.json();

        if (followerResponse.ok && followerData.data) {
          followerData.data.forEach(metric => {
            metric.date = dayStr;
          });
          allMetricsData.push(...followerData.data);
        }

      } catch (dayError) {
        console.error(`❌ Error fetching data for ${dayStr}:`, dayError);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const combinedData = allMetricsData;

    console.log(`✅ Fetched ${combinedData.length} insight records`);

    // Process and store data
    if (combinedData && combinedData.length > 0) {
      for (const metric of combinedData) {
        // Use the date we added to each metric
        const date = metric.date;
        if (!date) continue;
        
        // Get the metric value
        let metricValue = 0;
        if (metric.total_value && typeof metric.total_value.value === 'number') {
          metricValue = metric.total_value.value;
        }
        
        console.log(`📊 Processing ${metric.name}: ${metricValue} for ${date}`);

        if (!platformAccountId) {
          console.log(`⚠️  No platform account found for Instagram user ${igUserId}`);
          continue;
        }

        // Insert performance metrics (ignore if exists)
        try {
          await pool.query(
            `INSERT INTO performance_metrics (
              workspace_id, platform_account_id, granularity, metric_date,
              impressions, clicks, spend, conversions, extra_metrics
            ) VALUES ($1, $2, 'day', $3, $4, $5, $6, $7, $8)`,
            [
              normalizedWorkspaceId,
              platformAccountId,
              date,
              0, // impressions (not available on Instagram)
              metric.name === 'website_clicks' ? metricValue : null,
              0, // spend
              0, // conversions
              JSON.stringify({
                [metric.name]: metricValue,
              }),
            ]
          );
        } catch (insertError) {
          // Ignore duplicate key errors
          if (!insertError.message.includes('duplicate key')) {
            throw insertError;
          }
        }
      }
    }

    // Update integration last_synced_at
    await pool.query(
      `UPDATE workspace_integrations SET last_synced_at = now(), updated_at = now()
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [normalizedWorkspaceId]
    );

    // Update step cursor (if enabled)
    let done = false;
    if (String(mode) === 'step' && platformAccountId) {
      const nextDate = new Date(stepEnd);
      const nextDateStr = dateFormat(nextDate);
      done = nextDate >= endDate;
      await pool.query(
        `INSERT INTO data_sync_cursors (workspace_id, platform_account_id, entity_type, cursor, updated_at)
         VALUES ($1, $2, 'instagram_insights', $3::jsonb, now())
         ON CONFLICT (platform_account_id, entity_type)
         DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
        [normalizedWorkspaceId, platformAccountId, JSON.stringify({ nextDate: nextDateStr, endDate: dateFormat(endDate) })]
      );
    }

    console.log(`💾 Data stored successfully for Instagram account ${igUserId}`);

    res.json({
      success: true,
      message: `Instagram sync completed successfully. Processed ${String(mode) === 'step' ? `${batchDays} days (chunk)` : `${days} days`} of data.`,
      data: {
        accountId: igUserId,
        days: String(mode) === 'step' ? batchDays : days,
        recordsProcessed: combinedData.length || 0,
        cursor: String(mode) === 'step' ? { nextDate: dateFormat(stepEnd), endDate: dateFormat(endDate), done } : undefined,
      },
    });

  } catch (error) {
    console.error('❌ Direct Instagram sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

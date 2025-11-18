import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../services/encryption.js';

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface InstagramMetric {
  name: string;
  total_value?: { value: number };
  date?: string;
}

class InstagramSyncOptimized {
  private pool = getPool();
  private accessToken: string;
  private igUserId: string;
  private workspaceId: string;
  private platformAccountId: string | null = null;

  constructor(accessToken: string, igUserId: string, workspaceId: string) {
    this.accessToken = accessToken;
    this.igUserId = igUserId;
    this.workspaceId = workspaceId;
  }

  // Rate limiting: Instagram allows 200 calls per hour (roughly 3.3 per minute)
  private async rateLimitedDelay() {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between calls
  }

  // Retry logic with exponential backoff
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`❌ Instagram API attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Initialize platform account
  private async ensurePlatformAccount(): Promise<string> {
    if (this.platformAccountId) return this.platformAccountId;

    // Ensure platform exists
    await this.pool.query(
      `INSERT INTO platforms (key, display_name, category)
       VALUES ('instagram', 'Instagram Insights', 'analytics')
       ON CONFLICT (key) DO NOTHING`
    );

    // Ensure workspace integration exists
    const integrationResult = await this.pool.query(
      `INSERT INTO workspace_integrations (workspace_id, platform_key, status)
       VALUES ($1, 'instagram', 'active')
       ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
         status = 'active', updated_at = now()
       RETURNING id`,
      [this.workspaceId]
    );
    const integrationId = integrationResult.rows[0]?.id;

    // Get or create platform account
    let accountResult = await this.pool.query(
      `SELECT id FROM platform_accounts 
       WHERE workspace_id = $1 AND platform_key = 'instagram' AND external_id = $2`,
      [this.workspaceId, this.igUserId]
    );

    if (accountResult.rows.length === 0) {
      accountResult = await this.pool.query(
        `INSERT INTO platform_accounts (
           workspace_id, integration_id, platform_key, external_id, name, status
         ) VALUES ($1, $2, 'instagram', $3, 'Instagram Business Account', 'active')
         RETURNING id`,
        [this.workspaceId, integrationId, this.igUserId]
      );
    }

    this.platformAccountId = accountResult.rows[0].id;
    return this.platformAccountId;
  }

  // Validate API permissions
  private async validatePermissions(): Promise<void> {
    // Test basic account access
    const basicUrl = new URL(`${GRAPH_URL}/${this.igUserId}`);
    basicUrl.searchParams.set('fields', 'username,followers_count,media_count');
    basicUrl.searchParams.set('access_token', this.accessToken);
    
    const basicResp = await fetch(basicUrl);
    if (!basicResp.ok) {
      const text = await basicResp.text();
      throw new Error(`Falha na autenticação Instagram: ${text}`);
    }

    // Test insights permissions with a simple 1-day query
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1);
    const testUrl = new URL(`${GRAPH_URL}/${this.igUserId}/insights`);
    testUrl.searchParams.set('metric', 'reach');
    testUrl.searchParams.set('period', 'day');
    testUrl.searchParams.set('since', Math.floor(testDate.getTime() / 1000).toString());
    testUrl.searchParams.set('until', Math.floor(Date.now() / 1000).toString());
    testUrl.searchParams.set('access_token', this.accessToken);

    const testResp = await fetch(testUrl);
    if (!testResp.ok) {
      const text = await testResp.text();
      throw new Error(`Permissões insuficientes para insights: ${text}`);
    }
  }

  // Fetch metrics for a specific date range with batching
  private async fetchMetricsBatch(startDate: Date, endDate: Date): Promise<InstagramMetric[]> {
    const allMetrics: InstagramMetric[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayStr = currentDate.toISOString().split('T')[0];
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      console.log(`📊 Fetching Instagram data for ${dayStr}`);

      try {
        // Primary metrics
        const primaryMetrics = await this.retryOperation(async () => {
          const url = new URL(`${GRAPH_URL}/${this.igUserId}/insights`);
          url.searchParams.set('metric', 'reach,profile_views,website_clicks,accounts_engaged,total_interactions,likes,comments,shares,saves');
          url.searchParams.set('metric_type', 'total_value');
          url.searchParams.set('period', 'day');
          url.searchParams.set('since', dayStr);
          url.searchParams.set('until', nextDayStr);
          url.searchParams.set('access_token', this.accessToken);

          const response = await fetch(url);
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Primary metrics failed: ${error}`);
          }

          const data = await response.json();
          return data.data || [];
        });

        // Add date to metrics
        primaryMetrics.forEach((metric: InstagramMetric) => {
          metric.date = dayStr;
        });
        allMetrics.push(...primaryMetrics);

        await this.rateLimitedDelay();

        // Follower count (separate call)
        try {
          const followerMetrics = await this.retryOperation(async () => {
            const url = new URL(`${GRAPH_URL}/${this.igUserId}/insights`);
            url.searchParams.set('metric', 'follower_count');
            url.searchParams.set('period', 'day');
            url.searchParams.set('since', dayStr);
            url.searchParams.set('until', nextDayStr);
            url.searchParams.set('access_token', this.accessToken);

            const response = await fetch(url);
            if (!response.ok) {
              const error = await response.text();
              throw new Error(`Follower metrics failed: ${error}`);
            }

            const data = await response.json();
            return data.data || [];
          });

          followerMetrics.forEach((metric: InstagramMetric) => {
            metric.date = dayStr;
          });
          allMetrics.push(...followerMetrics);

          await this.rateLimitedDelay();
        } catch (followerError) {
          console.warn(`⚠️  Follower data not available for ${dayStr}:`, followerError.message);
        }

      } catch (dayError) {
        console.error(`❌ Error fetching data for ${dayStr}:`, dayError.message);
        // Continue with other days even if one fails
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allMetrics;
  }

  // Store metrics in database with upsert logic
  private async storeMetrics(metrics: InstagramMetric[]): Promise<void> {
    const platformAccountId = await this.ensurePlatformAccount();
    let recordsProcessed = 0;

    for (const metric of metrics) {
      if (!metric.date) continue;

      let metricValue = 0;
      if (metric.total_value && typeof metric.total_value.value === 'number') {
        metricValue = metric.total_value.value;
      }

      console.log(`💾 Storing ${metric.name}: ${metricValue} for ${metric.date}`);

      try {
        // Use upsert to handle duplicates
        await this.pool.query(
          `INSERT INTO performance_metrics (
            workspace_id, platform_account_id, granularity, metric_date,
            impressions, clicks, spend, conversions, extra_metrics
          ) VALUES ($1, $2, 'day', $3, $4, $5, $6, $7, $8)
          ON CONFLICT (workspace_id, platform_account_id, metric_date, granularity)
          DO UPDATE SET
            clicks = CASE WHEN $5 IS NOT NULL THEN $5 ELSE performance_metrics.clicks END,
            extra_metrics = performance_metrics.extra_metrics || $8,
            updated_at = now()`,
          [
            this.workspaceId,
            platformAccountId,
            metric.date,
            0, // impressions (not available on Instagram)
            metric.name === 'website_clicks' ? metricValue : null,
            0, // spend
            0, // conversions
            JSON.stringify({ [metric.name]: metricValue }),
          ]
        );
        recordsProcessed++;
      } catch (storeError) {
        console.error(`❌ Error storing metric ${metric.name} for ${metric.date}:`, storeError.message);
      }
    }

    console.log(`✅ Stored ${recordsProcessed} Instagram metric records`);
  }

  // Start sync tracking
  private async startSyncTracking(totalDays: number): Promise<string> {
    await this.pool.query(
      `SELECT start_sync_tracking($1, $2, $3, $4)`,
      ['instagram', this.workspaceId, 'optimized_batch', totalDays]
    );
    // Return a simple identifier since the function doesn't return sync_id
    return `instagram-${this.workspaceId}-${Date.now()}`;
  }

  // Update sync progress (simplified - just log)
  private async updateSyncProgress(syncId: string, progress: number, status: string): Promise<void> {
    console.log(`📊 Instagram Sync Progress: ${progress}% - ${status}`);
    // Could update sync_metadata table directly here if needed
  }

  // Complete sync tracking
  private async completeSyncTracking(syncId: string, recordsProcessed: number): Promise<void> {
    console.log(`✅ Instagram Sync Completed: ${recordsProcessed} records processed`);
    
    // Update integration last_synced_at
    await this.pool.query(
      `UPDATE workspace_integrations 
       SET last_synced_at = now(), updated_at = now()
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [this.workspaceId]
    );
  }

  // Main sync method
  async sync(totalDays: number = 7, batchDays: number = 7): Promise<{ recordsProcessed: number; syncId: string }> {
    console.log(`🚀 Starting optimized Instagram sync for ${totalDays} days (batch: ${batchDays} days)`);

    // Validate permissions first
    await this.validatePermissions();

    // Start tracking
    const syncId = await this.startSyncTracking(totalDays);
    await this.updateSyncProgress(syncId, 10, 'Validating permissions');

    // Calculate date ranges
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - totalDays);

    let allMetrics: InstagramMetric[] = [];
    let processedDays = 0;

    // Process in batches to avoid timeouts
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const batchEnd = new Date(currentDate);
      batchEnd.setDate(batchEnd.getDate() + Math.min(batchDays, Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))));
      
      if (batchEnd > endDate) {
        batchEnd.setTime(endDate.getTime());
      }

      const progress = 20 + Math.floor((processedDays / totalDays) * 60);
      await this.updateSyncProgress(syncId, progress, `Processing days ${processedDays + 1}-${processedDays + Math.ceil((batchEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))}`);

      console.log(`📦 Processing batch: ${currentDate.toISOString().split('T')[0]} to ${batchEnd.toISOString().split('T')[0]}`);

      const batchMetrics = await this.fetchMetricsBatch(currentDate, batchEnd);
      allMetrics.push(...batchMetrics);

      processedDays += Math.ceil((batchEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDate.setTime(batchEnd.getTime());
    }

    await this.updateSyncProgress(syncId, 80, 'Storing data in database');

    // Store all metrics
    await this.storeMetrics(allMetrics);

    await this.updateSyncProgress(syncId, 95, 'Finalizing sync');

    // Complete tracking
    await this.completeSyncTracking(syncId, allMetrics.length);

    console.log(`✅ Instagram sync completed. Processed ${allMetrics.length} metric records.`);

    return {
      recordsProcessed: allMetrics.length,
      syncId
    };
  }
}

/**
 * Optimized Instagram sync endpoint
 * POST /api/integrations/instagram/sync-optimized
 */
export async function optimizedInstagramSync(req: Request, res: Response) {
  try {
    const { workspaceId, totalDays = 7, batchDays = 7 } = req.body;
    const envWorkspaceId = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID;
    const normalizedWorkspaceId = String(workspaceId || envWorkspaceId || '').trim();

    if (!normalizedWorkspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing workspaceId'
      });
    }

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

    // Initialize and run sync
    const instagramSync = new InstagramSyncOptimized(accessToken, igUserId, normalizedWorkspaceId);
    const result = await instagramSync.sync(totalDays, batchDays);

    res.json({
      success: true,
      message: `Instagram sync completed successfully. Processed ${totalDays} days of data.`,
      data: {
        accountId: igUserId,
        totalDays,
        batchDays,
        recordsProcessed: result.recordsProcessed,
        syncId: result.syncId
      }
    });

  } catch (error) {
    console.error('❌ Optimized Instagram sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get Instagram sync status
 * GET /api/integrations/instagram/sync-status/:workspaceId
 */
export async function getInstagramSyncStatus(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, sync_type, progress, status, metadata, 
              started_at, completed_at, error_message
       FROM sync_metadata 
       WHERE workspace_id = $1 AND platform = 'instagram'
       ORDER BY started_at DESC 
       LIMIT 1`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          status: 'no_sync',
          message: 'No sync found for this workspace'
        }
      });
    }

    const syncData = result.rows[0];
    res.json({
      success: true,
      data: {
        syncId: syncData.id,
        syncType: syncData.sync_type,
        progress: syncData.progress,
        status: syncData.status,
        metadata: syncData.metadata,
        startedAt: syncData.started_at,
        completedAt: syncData.completed_at,
        errorMessage: syncData.error_message
      }
    });

  } catch (error) {
    console.error('❌ Error getting Instagram sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
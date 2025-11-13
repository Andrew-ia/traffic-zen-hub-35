import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../services/encryption.js';
import { runWorkerIteration } from '../../workers/simpleSyncWorker.js';
import type {
  ApiResponse,
  SyncJobResponse,
  SyncJobStatusResponse,
  SyncJob,
  IntegrationCredential,
  SyncJobParameters,
} from '../../types/index.js';

/**
 * Start a new sync job (without Redis/BullMQ)
 * POST /api/integrations/sync
 */
export async function startSync(req: Request, res: Response) {
  try {
    const { workspaceId, platformKey, days, type } = req.body;
    const envWorkspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    const normalizedWorkspaceId = String(workspaceId || envWorkspaceId || '').trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedWorkspaceId);

    // Validate input
    if (!normalizedWorkspaceId || !platformKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workspaceId, platformKey',
      } as ApiResponse);
    }

    if (!isUuid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workspaceId format. Provide a UUID',
      } as ApiResponse);
    }

    if (!days || days < 1 || days > 90) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter. Must be between 1 and 90',
      } as ApiResponse);
    }

    const normalizedType = (type || 'all') as 'all' | 'campaigns' | 'metrics';
    if (!['all', 'campaigns', 'metrics'].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter. Must be: all, campaigns, or metrics',
      } as ApiResponse);
    }

    // Validate supported platforms
    if (!['meta', 'instagram'].includes(platformKey)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform. Supported platforms: meta, instagram',
      } as ApiResponse);
    }

    // Instagram doesn't use campaign/metrics split, only 'all'
    if (platformKey === 'instagram' && type !== 'all') {
      return res.status(400).json({
        success: false,
        error: 'Instagram sync only supports type="all"',
      } as ApiResponse);
    }

    const pool = getPool();

    console.log(`▶️ Sync request: workspace=${normalizedWorkspaceId} platform=${platformKey} days=${days} type=${normalizedType}`);

    // Check if credentials exist
    const credResult = await pool.query<IntegrationCredential>(
      `
      SELECT id
      FROM integration_credentials
      WHERE workspace_id = $1 AND platform_key = $2
      LIMIT 1
      `,
      [normalizedWorkspaceId, platformKey]
    );

    if (credResult.rows.length === 0) {
      try {
        const secrets = await pool.query(
          `
            SELECT name, value
            FROM get_secrets(ARRAY['meta_access_token','meta_ad_account_id'])
          `
        );

        const accessTokenRow = secrets.rows.find((r: any) => r.name === 'meta_access_token');
        const adAccountIdRow = secrets.rows.find((r: any) => r.name === 'meta_ad_account_id');

        const accessToken = accessTokenRow?.value;
        const adAccountId = adAccountIdRow?.value;

        if (!accessToken || !adAccountId) {
          return res.status(404).json({
            success: false,
            error: `Credentials not found for workspace ${normalizedWorkspaceId}. Configure integration_credentials or Vault secrets.`,
          } as ApiResponse);
        }

        const enc = encryptCredentials({ accessToken, adAccountId });
        await pool.query(
          `
            INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, platform_key)
            DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()
          `,
          [normalizedWorkspaceId, platformKey, enc.encrypted_credentials, enc.encryption_iv]
        );
        console.log(`🔑 Integration credentials created from Vault for workspace ${normalizedWorkspaceId}`);
      } catch (vaultErr) {
        console.error('Vault secret fetch failed:', vaultErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to resolve credentials from Vault',
        } as ApiResponse);
      }
    }

    // Create job record in database with 'queued' status
    const jobId = uuidv4();
    const parameters: SyncJobParameters = { days, type };

    await pool.query(
      `
      INSERT INTO sync_jobs (
        id,
        workspace_id,
        platform_key,
        job_type,
        status,
        parameters
      )
      VALUES ($1, $2, $3, 'sync', 'queued', $4::jsonb)
      `,
      [jobId, normalizedWorkspaceId, platformKey, JSON.stringify(parameters)]
    );

    console.log(`📋 Created sync job ${jobId} for workspace ${normalizedWorkspaceId}`);

    // In serverless environment, process job immediately instead of queueing
    if (process.env.VERCEL) {
      try {
        console.log(`🚀 Processing job immediately in serverless environment`);
        
        // Get credentials for immediate processing
        const credResult = await pool.query<IntegrationCredential>(
          `
          SELECT encrypted_credentials, encryption_iv
          FROM integration_credentials
          WHERE workspace_id = $1 AND platform_key = $2
          LIMIT 1
          `,
          [normalizedWorkspaceId, platformKey]
        );

        if (credResult.rows.length === 0) {
          throw new Error('Credentials not found for immediate processing');
        }

        // Decrypt credentials
        const credentials = decryptCredentials(
          credResult.rows[0].encrypted_credentials,
          credResult.rows[0].encryption_iv
        );

        // Mark as processing
        await pool.query(
          `UPDATE sync_jobs SET status = 'processing', started_at = now(), progress = 0 WHERE id = $1`,
          [jobId]
        );

        // Import and run the sync immediately
        const { processJobDirectly } = await import('../../workers/simpleSyncWorker.js');
        const result = await processJobDirectly({
          jobId,
          workspaceId: normalizedWorkspaceId,
          platformKey,
          parameters: { days, type: normalizedType },
          credentials
        });

        res.json({
          success: true,
          data: {
            jobId,
            status: 'completed',
            progress: 100,
            message: 'Sync completed successfully',
            result
          } as SyncJobResponse,
        } as ApiResponse<SyncJobResponse>);

      } catch (error) {
        console.error('Immediate sync processing failed:', error);
        
        // Mark job as failed
        await pool.query(
          `UPDATE sync_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
          [jobId, error instanceof Error ? error.message : 'Unknown error']
        );

        res.status(500).json({
          success: false,
          error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        } as ApiResponse);
      }
    } else {
      // Local development - use background worker
      res.json({
        success: true,
        data: {
          jobId,
          status: 'queued',
          progress: 0,
          message: 'Sync job created and queued successfully',
        } as SyncJobResponse,
      } as ApiResponse<SyncJobResponse>);

      runWorkerIteration(1).catch((err) => {
        console.error('Background sync worker failed', err);
      });
    }
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start sync',
    } as ApiResponse);
  }
}

/**
 * Get sync job status
 * GET /api/integrations/sync/:jobId
 */
export async function getSyncStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    const pool = getPool();

    const result = await pool.query<SyncJob>(
      `
      SELECT *
      FROM sync_jobs
      WHERE id = $1
      LIMIT 1
      `,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      } as ApiResponse);
    }

    const job = result.rows[0];

    const response: SyncJobStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: getStatusMessage(job.status, job.progress),
      result: job.result,
      error: job.error_message,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    };

    res.json({
      success: true,
      data: response,
    } as ApiResponse<SyncJobStatusResponse>);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
    } as ApiResponse);
  }
}

/**
 * Get recent sync jobs for a workspace
 * GET /api/integrations/sync/workspace/:workspaceId
 */
export async function getWorkspaceSyncJobs(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const pool = getPool();

    const result = await pool.query<SyncJob>(
      `
      SELECT *
      FROM sync_jobs
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [workspaceId, limit]
    );

    res.json({
      success: true,
      data: result.rows,
    } as ApiResponse<SyncJob[]>);
  } catch (error) {
    console.error('Error getting workspace sync jobs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync jobs',
    } as ApiResponse);
  }
}

/**
 * Helper function to generate status message
 */
function getStatusMessage(status: string, progress: number): string {
  switch (status) {
    case 'queued':
      return 'Job is queued and waiting to be processed';
    case 'processing':
      return `Job is processing... ${progress}% complete`;
    case 'completed':
      return 'Job completed successfully';
    case 'failed':
      return 'Job failed';
    default:
      return 'Unknown status';
  }
}

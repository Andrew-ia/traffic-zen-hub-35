import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../config/database.js';
import { bullMQConnection } from '../../config/redis.js';
import { decryptCredentials } from '../../services/encryption.js';
import type {
  ApiResponse,
  SyncJobData,
  SyncJobResponse,
  SyncJobStatusResponse,
  SyncJob,
  IntegrationCredential,
  SyncJobParameters,
} from '../../types/index.js';

const SYNC_QUEUE_NAME = 'meta-sync';

// Create queue instance
const syncQueue = new Queue(SYNC_QUEUE_NAME, bullMQConnection);

/**
 * Start a new sync job
 * POST /api/integrations/sync
 */
export async function startSync(req: Request, res: Response) {
  try {
    const { workspaceId, platformKey, days, type } = req.body;

    // Validate input
    if (!workspaceId || !platformKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workspaceId, platformKey',
      } as ApiResponse);
    }

    if (!days || days < 1 || days > 90) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter. Must be between 1 and 90',
      } as ApiResponse);
    }

    if (!['all', 'campaigns', 'metrics'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter. Must be: all, campaigns, or metrics',
      } as ApiResponse);
    }

    // Validate platform
    if (!['meta', 'google_ads'].includes(platformKey)) {
      return res.status(400).json({
        success: false,
        error: 'Platform not supported. Supported platforms: meta, google_ads',
      } as ApiResponse);
    }

    const pool = getPool();

    // Get encrypted credentials from database
    const credResult = await pool.query<IntegrationCredential>(
      `
      SELECT *
      FROM integration_credentials
      WHERE workspace_id = $1 AND platform_key = $2
      LIMIT 1
      `,
      [workspaceId, platformKey]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credentials not found. Please configure credentials first.',
      } as ApiResponse);
    }

    // Decrypt credentials
    const credentials = decryptCredentials(
      credResult.rows[0].encrypted_credentials,
      credResult.rows[0].encryption_iv
    );

    // Create job record in database
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
      [jobId, workspaceId, platformKey, JSON.stringify(parameters)]
    );

    // Add job to queue
    const jobData: SyncJobData = {
      jobId,
      workspaceId,
      platformKey,
      parameters,
      credentials,
    };

    await syncQueue.add('meta-sync', jobData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep max 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    });

    console.log(`📋 Created sync job ${jobId} for workspace ${workspaceId}`);

    res.json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        progress: 0,
        message: 'Sync job created and queued successfully',
      } as SyncJobResponse,
    } as ApiResponse<SyncJobResponse>);
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

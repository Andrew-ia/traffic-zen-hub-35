import { getPool } from '../config/database.js';
import { generatePostSyncInsights } from '../services/postSyncInsights.js';
import type { SyncJobData } from '../types/index.js';
import { runMetaSync } from '../../supabase/functions/_shared/metaSync.js';
import { runInstagramSync } from '../../supabase/functions/_shared/instagramSync.js';
import type { SyncContext } from '../../supabase/functions/_shared/db.js';
 

/**
 * Simple sync worker without Redis/BullMQ
 * Uses PostgreSQL polling to process jobs
 */

let isProcessing = false;

function resolveMetaCredentials(credentials: any) {
  const appId = credentials.appId ?? credentials.app_id;
  const appSecret = credentials.appSecret ?? credentials.app_secret;
  const accessToken = credentials.accessToken ?? credentials.access_token;
  const adAccountId = credentials.adAccountId ?? credentials.ad_account_id;

  if (!accessToken || !adAccountId) {
    throw new Error('Missing required Meta credentials: accessToken and adAccountId');
  }

  return { appId, appSecret, accessToken, adAccountId };
}

function resolveInstagramCredentials(credentials: any) {
  const igUserId = credentials.igUserId ?? credentials.ig_user_id;
  const accessToken = credentials.accessToken ?? credentials.access_token;

  if (!igUserId || !accessToken) {
    throw new Error('Missing required Instagram credentials (igUserId, accessToken)');
  }

  return { igUserId, accessToken };
}

 

async function executeInstagramSync(jobData: SyncJobData): Promise<any> {
  const pool = getPool();
  const { workspaceId, parameters } = jobData;
  const credentials = resolveInstagramCredentials(jobData.credentials as any);

  const ctx: SyncContext = {
    db: {
      query: (text: string, params?: any[]) => pool.query(text, params),
    },
    reportProgress: (progress) => updateJobStatus(jobData.jobId, 'processing', { progress }),
  };

  return runInstagramSync(
    {
      igUserId: credentials.igUserId,
      accessToken: credentials.accessToken,
      workspaceId,
      days: parameters.days,
    },
    ctx,
  );
}

async function executeMetaSync(jobData: SyncJobData): Promise<any> {
  const pool = getPool();
  const { workspaceId, parameters } = jobData;
  const credentials = resolveMetaCredentials(jobData.credentials as any);

  const ctx: SyncContext = {
    db: {
      query: (text: string, params?: any[]) => pool.query(text, params),
    },
    reportProgress: (progress) => updateJobStatus(jobData.jobId, 'processing', { progress }),
  };

  return runMetaSync(
    {
      accessToken: credentials.accessToken,
      adAccountId: credentials.adAccountId,
      workspaceId,
      days: parameters.days,
      type: parameters.type ?? 'all',
    },
    ctx,
  );
}

 

/**
 * Update job status in database
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  updates: {
    progress?: number;
    result?: any;
    error_message?: string;
    error_details?: any;
    started_at?: Date;
    completed_at?: Date;
  }
) {
  const pool = getPool();

  const fields: string[] = ['status = $2', 'updated_at = now()'];
  const values: any[] = [jobId, status];
  let paramIndex = 3;

  if (updates.progress !== undefined) {
    fields.push(`progress = $${paramIndex++}`);
    values.push(updates.progress);
  }

  if (updates.result !== undefined) {
    fields.push(`result = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(updates.result));
  }

  if (updates.error_message !== undefined) {
    fields.push(`error_message = $${paramIndex++}`);
    values.push(updates.error_message);
  }

  if (updates.error_details !== undefined) {
    fields.push(`error_details = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(updates.error_details));
  }

  if (updates.started_at) {
    fields.push(`started_at = $${paramIndex++}`);
    values.push(updates.started_at);
  }

  if (updates.completed_at) {
    fields.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completed_at);
  }

  const query = `
    UPDATE sync_jobs
    SET ${fields.join(', ')}
    WHERE id = $1
  `;

  await pool.query(query, values);
}

/**
 * Process a single job
 */
async function processJob(job: any, jobData: SyncJobData) {
  const jobId = job.id;

  try {
    // Mark job as processing
    await updateJobStatus(jobId, 'processing', {
      progress: 0,
      started_at: new Date(),
    });

    // Execute the sync based on platform
    let resultSummary: any = null;
    if (jobData.platformKey === 'instagram') {
      resultSummary = await executeInstagramSync(jobData);
    } else if (jobData.platformKey === 'meta') {
      resultSummary = await executeMetaSync(jobData);
    } else if (jobData.platformKey === 'google_ads') {
      throw new Error('Google Ads integration removed');
    } else {
      throw new Error(`Unsupported platform: ${jobData.platformKey}`);
    }

    let insights = null;
    try {
      insights = await generatePostSyncInsights({
        workspaceId: jobData.workspaceId,
        platformKey: jobData.platformKey,
        days: jobData.parameters.days,
      });
    } catch (insightsError) {
      console.error(`⚠️ Failed to build post-sync insights for job ${jobId}:`, insightsError);
    }

    // Mark job as completed
    await updateJobStatus(jobId, 'completed', {
      progress: 100,
      result: {
        summary: resultSummary,
        success: true,
        insights,
      },
      completed_at: new Date(),
    });

    console.log(`✅ Job ${jobId} completed successfully`);
    return true;
  } catch (error) {
    // Mark job as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    };

    await updateJobStatus(jobId, 'failed', {
      error_message: errorMessage,
      error_details: errorDetails,
      completed_at: new Date(),
    });

    console.error(`❌ Job ${jobId} failed:`, errorMessage);
    return false;
  }
}

/**
 * Poll for queued jobs and process them
 */
let consecutiveErrors = 0;
const maxConsecutiveErrors = 5;

async function pollForJobs() {
  if (isProcessing) {
    return; // Already processing a job
  }

  try {
    const pool = getPool();

    // Get next queued job
    const result = await pool.query(
      `
      SELECT id, workspace_id, platform_key, parameters
      FROM sync_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      `
    );

    if (result.rows.length === 0) {
      return; // No jobs to process
    }

    const job = result.rows[0];
    isProcessing = true;

    // Get credentials
    const credResult = await pool.query(
      `
      SELECT encrypted_credentials, encryption_iv
      FROM integration_credentials
      WHERE workspace_id = $1 AND platform_key = $2
      LIMIT 1
      `,
      [job.workspace_id, job.platform_key]
    );

    if (credResult.rows.length === 0) {
      throw new Error('Credentials not found');
    }

    // Decrypt credentials (fail job gracefully on error)
    let credentials: any;
    try {
      const { decryptCredentials } = await import('../services/encryption.js');
      credentials = decryptCredentials(
        credResult.rows[0].encrypted_credentials,
        credResult.rows[0].encryption_iv
      );
    } catch (decryptError) {
      await pool.query(
        `
        UPDATE sync_jobs
        SET status = 'failed',
            error_message = 'Failed to read credentials',
            error_details = $2::jsonb,
            completed_at = now(),
            progress = 0
        WHERE id = $1
        `,
        [job.id, JSON.stringify({ message: (decryptError as Error).message })]
      );
      console.error('Credential decrypt failed for job', job.id, decryptError);
      return; // stop processing this job
    }

    const jobData: SyncJobData = {
      jobId: job.id,
      workspaceId: job.workspace_id,
      platformKey: job.platform_key,
      parameters: job.parameters,
      credentials,
    };

    // Process the job
    await processJob(job, jobData);
    
    // Reset error counter on success
    consecutiveErrors = 0;
    
  } catch (error) {
    consecutiveErrors++;
    
    const isConnectionError = 
      error instanceof Error && 
      (error.message.includes('ENOTFOUND') || 
       error.message.includes('ECONNREFUSED') || 
       error.message.includes('timeout') ||
       error.message.includes('EHOSTUNREACH') ||
       error.message.includes('ETIMEDOUT') ||
       error.message.includes('Connection terminated'));
    
    if (isConnectionError && consecutiveErrors <= maxConsecutiveErrors) {
      // Suppress connection error logs - these are network issues, not code bugs
      return;
    } else if (!isConnectionError) {
      console.error('Error polling for jobs:', error);
    }
    
    // If too many consecutive errors, pause polling for a bit
    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.warn(`🔴 Too many consecutive errors (${consecutiveErrors}). Pausing worker for 30 seconds...`);
      setTimeout(() => {
        consecutiveErrors = 0;
        console.log('🟢 Worker resuming after pause');
      }, 30000);
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the worker with polling
 */
export function startSimpleWorker() {
  console.log('🔧 Simple sync worker started (PostgreSQL polling)');
  console.log('   Polling every 5 seconds for new jobs...\n');

  // Poll every 5 seconds (less aggressive)
  const intervalId = setInterval(pollForJobs, 5000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    clearInterval(intervalId);
    console.log('Worker shutting down...');
  });

  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('Worker shutting down...');
  });

  // Start polling immediately
  pollForJobs();

  return intervalId;
}

export async function runWorkerIteration(maxJobs = 1): Promise<void> {
  for (let i = 0; i < maxJobs; i++) {
    await pollForJobs();
  }
}

/**
 * Process a job directly without polling (for serverless environments)
 */
export async function processJobDirectly(jobData: SyncJobData): Promise<any> {
  const jobId = jobData.jobId;
  
  try {
    console.log(`🔄 Processing job ${jobId} directly`);

    // Update status to processing
    await updateJobStatus(jobId, 'processing', {
      progress: 0,
      started_at: new Date(),
    });

    // Execute the sync based on platform
    let resultSummary: any = null;
    if (jobData.platformKey === 'instagram') {
      resultSummary = await executeInstagramSync(jobData);
    } else if (jobData.platformKey === 'meta') {
      resultSummary = await executeMetaSync(jobData);
    } else if (jobData.platformKey === 'google_ads') {
      throw new Error('Google Ads integration removed');
    } else {
      throw new Error(`Unsupported platform: ${jobData.platformKey}`);
    }

    // Generate insights (with error handling)
    let insights = null;
    try {
      insights = await generatePostSyncInsights({
        workspaceId: jobData.workspaceId,
        platformKey: jobData.platformKey,
        days: jobData.parameters.days,
      });
    } catch (insightsError) {
      console.error(`⚠️ Failed to build post-sync insights for job ${jobId}:`, insightsError);
    }

    const result = {
      summary: resultSummary,
      success: true,
      insights,
    };

    // Mark job as completed
    await updateJobStatus(jobId, 'completed', {
      progress: 100,
      result,
      completed_at: new Date(),
    });

    console.log(`✅ Job ${jobId} completed successfully (direct processing)`);
    return result;

  } catch (error) {
    // Mark job as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    };

    await updateJobStatus(jobId, 'failed', {
      error_message: errorMessage,
      error_details: errorDetails,
      completed_at: new Date(),
    });

    console.error(`❌ Job ${jobId} failed (direct processing):`, errorMessage);
    throw error; // Re-throw to be handled by caller
  }
}

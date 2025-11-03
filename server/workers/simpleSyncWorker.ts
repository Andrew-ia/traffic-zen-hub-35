import { spawn } from 'child_process';
import { getPool } from '../config/database.js';
import { generatePostSyncInsights } from '../services/postSyncInsights.js';
import type { SyncJobData } from '../types/index.js';

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

  if (!appId || !appSecret || !accessToken || !adAccountId) {
    throw new Error('Missing required Meta credentials in integration_credentials record');
  }

  return { appId, appSecret, accessToken, adAccountId };
}

/**
 * Execute the Meta sync script
 */
async function executeMetaSync(jobData: SyncJobData): Promise<{ stdout: string; stderr: string }> {
  const { workspaceId, parameters } = jobData;
  const credentials = resolveMetaCredentials(jobData.credentials as any);

  console.log(`\n🚀 Starting Meta sync job ${jobData.jobId}`);
  console.log(`   Workspace: ${workspaceId}`);
  console.log(`   Period: ${parameters.days} days`);
  console.log(`   Type: ${parameters.type}`);

  // Build command arguments
  const args = ['scripts/meta/sync-incremental.js', `--days=${parameters.days}`];

  if (parameters.type === 'campaigns') {
    args.push('--campaigns-only');
  } else if (parameters.type === 'metrics') {
    args.push('--metrics-only');
  }

  // Environment variables with credentials
  const env = {
    ...process.env,
    META_APP_ID: credentials.appId,
    META_APP_SECRET: credentials.appSecret,
    META_ACCESS_TOKEN: credentials.accessToken,
    META_AD_ACCOUNT_ID: credentials.adAccountId,
    META_WORKSPACE_ID: workspaceId,
    SYNC_DAYS: String(parameters.days),
  };

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn('node', args, {
      env,
      cwd: process.cwd(),
    });

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());

      // Update job progress based on output
      updateProgressFromOutput(jobData.jobId, output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
    });

    child.on('error', (error) => {
      console.error(`❌ Process error:`, error);
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Meta sync job ${jobData.jobId} completed successfully`);
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Process exited with code ${code}`);
        console.error(`❌ Meta sync job ${jobData.jobId} failed with code ${code}`);
        reject(error);
      }
    });
  });
}

/**
 * Update job progress based on script output
 */
async function updateProgressFromOutput(jobId: string, output: string) {
  const pool = getPool();
  let progress = 0;

  if (output.includes('Buscando campanhas')) {
    progress = 10;
  } else if (output.includes('campanhas encontradas')) {
    progress = 25;
  } else if (output.includes('Ad sets sincronizados')) {
    progress = 50;
  } else if (output.includes('Anúncios sincronizados')) {
    progress = 60;
  } else if (output.includes('Sincronizando métricas')) {
    progress = 70;
  } else if (output.includes('Métricas')) {
    progress = 85;
  }

  if (progress > 0) {
    await pool.query(
      'UPDATE sync_jobs SET progress = $1, updated_at = now() WHERE id = $2',
      [progress, jobId]
    );
  }
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

    // Execute the sync
    const result = await executeMetaSync(jobData);

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
        stdout: result.stdout,
        stderr: result.stderr,
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

    // Decrypt credentials
    const { decryptCredentials } = await import('../services/encryption.js');
    const credentials = decryptCredentials(
      credResult.rows[0].encrypted_credentials,
      credResult.rows[0].encryption_iv
    );

    const jobData: SyncJobData = {
      jobId: job.id,
      workspaceId: job.workspace_id,
      platformKey: job.platform_key,
      parameters: job.parameters,
      credentials,
    };

    // Process the job
    await processJob(job, jobData);
  } catch (error) {
    console.error('Error polling for jobs:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the worker with polling
 */
export function startSimpleWorker() {
  console.log('🔧 Simple sync worker started (PostgreSQL polling)');
  console.log('   Polling every 2 seconds for new jobs...\n');

  // Poll every 2 seconds
  const intervalId = setInterval(pollForJobs, 2000);

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

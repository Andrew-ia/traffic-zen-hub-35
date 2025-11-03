import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import { bullMQConnection } from '../config/redis.js';
import { getPool } from '../config/database.js';
import type { SyncJobData } from '../types/index.js';
import { generatePostSyncInsights } from '../services/postSyncInsights.js';

/**
 * BullMQ Worker for processing Meta Ads sync jobs
 * Executes the sync-incremental.js script with proper credentials and parameters
 */

const SYNC_QUEUE_NAME = 'meta-sync';

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
async function executeMetaSync(
  job: Job<SyncJobData>
): Promise<{ stdout: string; stderr: string }> {
  const { workspaceId, parameters } = job.data;
  const credentials = resolveMetaCredentials(job.data.credentials as any);

  console.log(`\n🚀 Starting Meta sync job ${job.id}`);
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
      if (output.includes('Buscando campanhas')) {
        job.updateProgress(10);
      } else if (output.includes('campanhas encontradas')) {
        job.updateProgress(25);
      } else if (output.includes('Ad sets sincronizados')) {
        job.updateProgress(50);
      } else if (output.includes('Anúncios sincronizados')) {
        job.updateProgress(60);
      } else if (output.includes('Sincronizando métricas')) {
        job.updateProgress(70);
      } else if (output.includes('Métricas')) {
        job.updateProgress(85);
      }
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
        console.log(`✅ Meta sync job ${job.id} completed successfully`);
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Process exited with code ${code}`);
        console.error(`❌ Meta sync job ${job.id} failed with code ${code}`);
        reject(error);
      }
    });
  });
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
 * Create and start the worker
 */
export function createMetaSyncWorker(): Worker {
  const worker = new Worker<SyncJobData>(
    SYNC_QUEUE_NAME,
    async (job) => {
      const jobId = job.data.jobId;

      try {
        // Mark job as processing
        await updateJobStatus(jobId, 'processing', {
          progress: 0,
          started_at: new Date(),
        });

        // Execute the sync
        const result = await executeMetaSync(job);

        let insights = null;
        try {
          insights = await generatePostSyncInsights({
            workspaceId: job.data.workspaceId,
            platformKey: job.data.platformKey,
            days: job.data.parameters.days,
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

        throw error;
      }
    },
    {
      ...bullMQConnection,
      concurrency: 2, // Process up to 2 jobs simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // per minute (rate limiting)
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('🔧 Meta sync worker started');

  return worker;
}

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
    if (!['meta', 'instagram', 'google_ads'].includes(platformKey)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform. Supported platforms: meta, instagram, google_ads',
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
      if (platformKey === 'google_ads') {
        const googleSecrets = await pool.query(
          `
            SELECT name, value
            FROM get_secrets(ARRAY[
              'google_ads_refresh_token',
              'google_ads_customer_id',
              'google_ads_developer_token',
              'google_client_id',
              'google_client_secret',
              'google_ads_login_customer_id'
            ])
          `
        );
        const refreshTokenRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_refresh_token');
        const customerIdRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_customer_id');
        const developerTokenRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_developer_token');
        const clientIdRow = googleSecrets.rows.find((r: any) => r.name === 'google_client_id');
        const clientSecretRow = googleSecrets.rows.find((r: any) => r.name === 'google_client_secret');

        const refreshToken = refreshTokenRow?.value || process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
        const customerId = (customerIdRow?.value || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
        const developerToken = developerTokenRow?.value || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
        const clientId = clientIdRow?.value || process.env.GOOGLE_CLIENT_ID || '';
        const clientSecret = clientSecretRow?.value || process.env.GOOGLE_CLIENT_SECRET || '';
        const loginCustomerId = googleSecrets.rows.find((r: any) => r.name === 'google_ads_login_customer_id')?.value
          || (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '') || undefined;

        if (!refreshToken || !customerId || !developerToken || !clientId || !clientSecret) {
          return res.status(404).json({
            success: false,
            error: `Google Ads credentials not found (Vault/env) for workspace ${normalizedWorkspaceId}. Configure google_* secrets.`,
          } as ApiResponse);
        }

        const encGoogle = encryptCredentials({
          platform: 'google_ads',
          refreshToken,
          customerId,
          developerToken,
          clientId,
          clientSecret,
          loginCustomerId,
        });
        await pool.query(
          `
            INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, platform_key)
            DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()
          `,
          [normalizedWorkspaceId, platformKey, encGoogle.encrypted_credentials, encGoogle.encryption_iv]
        );
        console.log(`🔑 Google Ads credentials stored for workspace ${normalizedWorkspaceId}`);
      } else {
        let resolvedAccessToken: string | undefined;
        let resolvedAccountId: string | undefined;

        try {
          if (platformKey === 'instagram') {
            const secrets = await pool.query(
              `
                SELECT name, value
                FROM get_secrets(ARRAY['ig_access_token','ig_user_id'])
              `
            );
            const accessTokenRow = secrets.rows.find((r: any) => r.name === 'ig_access_token');
            const userIdRow = secrets.rows.find((r: any) => r.name === 'ig_user_id');
            resolvedAccessToken = accessTokenRow?.value;
            resolvedAccountId = userIdRow?.value; // Using ig_user_id as account identifier
          } else if (platformKey === 'meta') {
            const secrets = await pool.query(
              `
                SELECT name, value
                FROM get_secrets(ARRAY['meta_access_token','meta_ad_account_id'])
              `
            );
            const accessTokenRow = secrets.rows.find((r: any) => r.name === 'meta_access_token');
            const adAccountIdRow = secrets.rows.find((r: any) => r.name === 'meta_ad_account_id');
            resolvedAccessToken = accessTokenRow?.value;
            resolvedAccountId = adAccountIdRow?.value;
          }
        } catch (vaultErr) {
          console.warn('Vault secret fetch failed, trying environment variables:', vaultErr);
        }

        if (platformKey === 'instagram') {
          const envToken = String(process.env.IG_ACCESS_TOKEN || process.env.VITE_IG_ACCESS_TOKEN || '').trim();
          const envUserId = String(process.env.IG_USER_ID || process.env.VITE_IG_USER_ID || '').trim();
          resolvedAccessToken = resolvedAccessToken ?? (envToken || undefined);
          resolvedAccountId = resolvedAccountId ?? (envUserId || undefined);
        } else if (platformKey === 'meta') {
          const envToken = String(process.env.META_ACCESS_TOKEN || '').trim();
          const envAdAccount = String(process.env.META_AD_ACCOUNT_ID || '').trim();
          resolvedAccessToken = resolvedAccessToken ?? (envToken || undefined);
          resolvedAccountId = resolvedAccountId ?? (envAdAccount || undefined);
        }

        if (!resolvedAccessToken || !resolvedAccountId) {
          return res.status(404).json({
            success: false,
            error: 'Missing Instagram credentials. Set IG_ACCESS_TOKEN and IG_USER_ID or configure Vault secrets.',
          } as ApiResponse);
        }

        const enc =
          platformKey === 'instagram'
            ? encryptCredentials({ accessToken: resolvedAccessToken, igUserId: resolvedAccountId })
            : encryptCredentials({ accessToken: resolvedAccessToken, adAccountId: resolvedAccountId });
        await pool.query(
          `
            INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, platform_key)
            DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()
          `,
          [normalizedWorkspaceId, platformKey, enc.encrypted_credentials, enc.encryption_iv]
        );
        console.log(`🔑 Integration credentials created for workspace ${normalizedWorkspaceId}`);
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

        if (platformKey === 'instagram') {
          const upgradedIgUserId =
            credentials.igUserId ??
            credentials.ig_user_id ??
            credentials.adAccountId ??
            credentials.ad_account_id;

          if (!upgradedIgUserId) {
            throw new Error('Missing Instagram credentials (igUserId)');
          }

          if (!credentials.igUserId) {
            credentials.igUserId = upgradedIgUserId;
            const enc = encryptCredentials({
              accessToken: credentials.accessToken,
              igUserId: upgradedIgUserId,
            });
            await pool.query(
              `
                UPDATE integration_credentials
                SET encrypted_credentials = $3, encryption_iv = $4, updated_at = now()
                WHERE workspace_id = $1 AND platform_key = $2
              `,
              [normalizedWorkspaceId, platformKey, enc.encrypted_credentials, enc.encryption_iv]
            );
          }
        }

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

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const is403 = /Instagram API error 403|insufficient permissions|Permissão ausente|403/.test(String(msg));
        const statusCode = is403 ? 403 : 500;
        res.status(statusCode).json({
          success: false,
          error: `Sync failed: ${msg}`,
        } as ApiResponse);
      }
    } else {
      // Local development
      if (platformKey === 'google_ads') {
        try {
          const credRow = await pool.query(
            `SELECT encrypted_credentials, encryption_iv FROM integration_credentials WHERE workspace_id = $1 AND platform_key = 'google_ads' LIMIT 1`,
            [normalizedWorkspaceId]
          );
          let credentials: any;
          if (credRow.rows.length > 0) {
            const { decryptCredentials } = await import('../../services/encryption.js');
            credentials = decryptCredentials(credRow.rows[0].encrypted_credentials, credRow.rows[0].encryption_iv);
          } else {
            const googleSecrets = await pool.query(
              `
                SELECT name, value
                FROM get_secrets(ARRAY[
                  'google_ads_refresh_token',
                  'google_ads_customer_id',
                  'google_ads_developer_token',
                  'google_client_id',
                  'google_client_secret'
                ])
              `
            );
            const refreshTokenRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_refresh_token');
            const customerIdRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_customer_id');
            const developerTokenRow = googleSecrets.rows.find((r: any) => r.name === 'google_ads_developer_token');
            const clientIdRow = googleSecrets.rows.find((r: any) => r.name === 'google_client_id');
            const clientSecretRow = googleSecrets.rows.find((r: any) => r.name === 'google_client_secret');
            credentials = {
              google_ads_refresh_token: refreshTokenRow?.value || process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
              google_ads_customer_id: (customerIdRow?.value || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, ''),
              google_ads_developer_token: developerTokenRow?.value || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
              google_client_id: clientIdRow?.value || process.env.GOOGLE_CLIENT_ID || '',
              google_client_secret: clientSecretRow?.value || process.env.GOOGLE_CLIENT_SECRET || '',
            };
          }

          await pool.query(
            `UPDATE sync_jobs SET status = 'processing', started_at = now(), progress = 0 WHERE id = $1`,
            [jobId]
          );

          const { processJobDirectly } = await import('../../workers/simpleSyncWorker.js');
          const result = await processJobDirectly({
            jobId,
            workspaceId: normalizedWorkspaceId,
            platformKey,
            parameters: { days, type: normalizedType },
            credentials,
          });

          return res.json({
            success: true,
            data: {
              jobId,
              status: 'completed',
              progress: 100,
              message: 'Sync completed successfully',
              result,
            } as SyncJobResponse,
          } as ApiResponse<SyncJobResponse>);
        } catch (err) {
          await pool.query(
            `UPDATE sync_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
            [jobId, err instanceof Error ? err.message : 'Unknown error']
          );
          return res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to process Google Ads sync',
          } as ApiResponse);
        }
      }

      // Fallback: queue and run one worker iteration
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
    const msg = error instanceof Error ? error.message : 'Failed to start sync';
    const is403 = /Instagram API error 403|insufficient permissions|Permissão ausente|403/.test(String(msg));
    const statusCode = is403 ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: msg,
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

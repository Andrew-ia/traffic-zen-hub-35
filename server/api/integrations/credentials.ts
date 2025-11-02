import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { encryptCredentials, decryptCredentials } from '../../services/encryption.js';
import type { ApiResponse, IntegrationCredential, MetaCredentials } from '../../types/index.js';

/**
 * Save or update integration credentials
 * POST /api/integrations/credentials
 */
export async function saveCredentials(req: Request, res: Response) {
  try {
    const { workspaceId, platformKey, credentials } = req.body;

    // Validate input
    if (!workspaceId || !platformKey || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workspaceId, platformKey, credentials',
      } as ApiResponse);
    }

    // Validate platform-specific credentials
    if (platformKey === 'meta') {
      const { appId, appSecret, accessToken, adAccountId } = credentials as MetaCredentials;
      if (!appId || !appSecret || !accessToken || !adAccountId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required Meta credentials: appId, appSecret, accessToken, adAccountId',
        } as ApiResponse);
      }
    }

    // Encrypt credentials
    const { encrypted_credentials, encryption_iv } = encryptCredentials(credentials);

    const pool = getPool();

    // Upsert credentials
    const result = await pool.query<IntegrationCredential>(
      `
      INSERT INTO integration_credentials (
        workspace_id,
        platform_key,
        encrypted_credentials,
        encryption_iv
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id, platform_key)
      DO UPDATE SET
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        encryption_iv = EXCLUDED.encryption_iv,
        updated_at = now()
      RETURNING id, workspace_id, platform_key, created_at, updated_at
      `,
      [workspaceId, platformKey, encrypted_credentials, encryption_iv]
    );

    res.json({
      success: true,
      message: 'Credentials saved successfully',
      data: {
        id: result.rows[0].id,
        platform_key: result.rows[0].platform_key,
        updated_at: result.rows[0].updated_at,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save credentials',
    } as ApiResponse);
  }
}

/**
 * Get integration credentials (decrypted)
 * GET /api/integrations/credentials/:workspaceId/:platformKey
 */
export async function getCredentials(req: Request, res: Response) {
  try {
    const { workspaceId, platformKey } = req.params;

    const pool = getPool();

    const result = await pool.query<IntegrationCredential>(
      `
      SELECT *
      FROM integration_credentials
      WHERE workspace_id = $1 AND platform_key = $2
      LIMIT 1
      `,
      [workspaceId, platformKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credentials not found',
      } as ApiResponse);
    }

    const row = result.rows[0];

    // Decrypt credentials
    const decrypted = decryptCredentials(
      row.encrypted_credentials,
      row.encryption_iv
    );

    res.json({
      success: true,
      data: {
        platform_key: row.platform_key,
        credentials: decrypted,
        updated_at: row.updated_at,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve credentials',
    } as ApiResponse);
  }
}

/**
 * Delete integration credentials
 * DELETE /api/integrations/credentials/:workspaceId/:platformKey
 */
export async function deleteCredentials(req: Request, res: Response) {
  try {
    const { workspaceId, platformKey } = req.params;

    const pool = getPool();

    const result = await pool.query(
      `
      DELETE FROM integration_credentials
      WHERE workspace_id = $1 AND platform_key = $2
      RETURNING id
      `,
      [workspaceId, platformKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credentials not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Credentials deleted successfully',
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting credentials:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete credentials',
    } as ApiResponse);
  }
}

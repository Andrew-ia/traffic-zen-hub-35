import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../services/encryption.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

const router = Router();
const SHOPEE_PLATFORM_KEY = 'shopee';

type ShopeeCredentials = {
  partnerId?: string;
  partnerKey?: string;
  shopId?: string;
  accessToken?: string;
  refreshToken?: string;
  apiBase?: string;
};

const normalizeShopeeCredentials = (raw: Record<string, any>): ShopeeCredentials => {
  const safe = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  return {
    partnerId: safe(raw.partnerId ?? raw.partner_id),
    partnerKey: safe(raw.partnerKey ?? raw.partner_key),
    shopId: safe(raw.shopId ?? raw.shop_id),
    accessToken: safe(raw.accessToken ?? raw.access_token),
    refreshToken: safe(raw.refreshToken ?? raw.refresh_token),
    apiBase: safe(raw.apiBase ?? raw.api_base),
  };
};

async function getShopeeCredentials(workspaceId: string): Promise<{ credentials: ShopeeCredentials; updatedAt: string } | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT encrypted_credentials, encryption_iv, updated_at
       FROM integration_credentials
       WHERE workspace_id = $1 AND platform_key = $2
       LIMIT 1`,
      [workspaceId, SHOPEE_PLATFORM_KEY],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    const decrypted = decryptCredentials(row.encrypted_credentials, row.encryption_iv) as Record<string, any>;
    return {
      credentials: normalizeShopeeCredentials(decrypted || {}),
      updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : String(row.updated_at || ''),
    };
  } catch (error) {
    console.warn('[Shopee] Falha ao buscar credenciais:', error instanceof Error ? error.message : error);
    return null;
  }
}

router.get('/auth/status', async (req: Request, res: Response) => {
  const { id: workspaceId } = resolveWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ connected: false, error: 'workspace_id_required' });
  }

  const record = await getShopeeCredentials(workspaceId);
  if (!record) {
    return res.json({ connected: false });
  }

  const { credentials, updatedAt } = record;
  const connected = Boolean(credentials.accessToken && credentials.shopId);

  return res.json({
    connected,
    shopId: credentials.shopId || null,
    partnerId: credentials.partnerId || null,
    apiBase: credentials.apiBase || null,
    updatedAt,
  });
});

router.post('/manual-credentials', async (req: Request, res: Response) => {
  const { id: workspaceId } = resolveWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspace_id_required' });
  }

  const {
    partnerId,
    partnerKey,
    shopId,
    accessToken,
    refreshToken,
    apiBase,
  } = (req.body || {}) as Record<string, any>;

  if (!shopId || !accessToken) {
    return res.status(400).json({
      success: false,
      error: 'missing_required_fields',
      message: 'shopId e accessToken são obrigatórios',
    });
  }

  const payload: ShopeeCredentials = normalizeShopeeCredentials({
    partnerId,
    partnerKey,
    shopId,
    accessToken,
    refreshToken,
    apiBase,
  });

  try {
    const { encrypted_credentials, encryption_iv } = encryptCredentials(payload as Record<string, any>);
    const pool = getPool();
    await pool.query(
      `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, platform_key)
       DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials,
                     encryption_iv = EXCLUDED.encryption_iv,
                     updated_at = now()`,
      [workspaceId, SHOPEE_PLATFORM_KEY, encrypted_credentials, encryption_iv],
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('[Shopee] Falha ao salvar credenciais:', error);
    return res.status(500).json({ success: false, error: 'save_failed' });
  }
});

router.delete('/auth', async (req: Request, res: Response) => {
  const { id: workspaceId } = resolveWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspace_id_required' });
  }

  try {
    const pool = getPool();
    await pool.query(
      'DELETE FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2',
      [workspaceId, SHOPEE_PLATFORM_KEY],
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[Shopee] Falha ao remover credenciais:', error);
    return res.status(500).json({ success: false, error: 'delete_failed' });
  }
});

export default router;

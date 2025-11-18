import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { getPool } from '../../config/database.js';
import { encryptCredentials } from '../../services/encryption.js';
import fetch from 'node-fetch';

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const redirectUri = `${frontendUrl}/api/integrations/google-ads/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function googleAdsAuth(req: Request, res: Response) {
  const oauth2 = createOAuthClient();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/adwords'],
  });
  res.redirect(url);
}

export async function googleAdsCallback(req: Request, res: Response) {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing code' });
    }

    const oauth2 = createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token || '';
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'No refresh_token returned' });
    }

    const workspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Missing workspace id in env' });
    }

    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '') || undefined;

    const { encrypted_credentials, encryption_iv } = encryptCredentials({
      platform: 'google_ads',
      refreshToken,
      customerId,
      developerToken,
      clientId,
      clientSecret,
      loginCustomerId,
    });

    const pool = getPool();
    await pool.query(
      `
        INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (workspace_id, platform_key)
        DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()
      `,
      [workspaceId, 'google_ads', encrypted_credentials, encryption_iv]
    );

    res.send('Google Ads conectado. Refresh token salvo com sucesso.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth callback error';
    res.status(500).json({ success: false, error: msg });
  }
}

export async function googleAdsTest(req: Request, res: Response) {
  try {
    const workspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Missing workspace id in env' });

    const pool = getPool();
    const row = await pool.query(
      `SELECT encrypted_credentials, encryption_iv FROM integration_credentials WHERE workspace_id = $1 AND platform_key = 'google_ads' LIMIT 1`,
      [workspaceId]
    );
    if (row.rows.length === 0) return res.status(404).json({ success: false, error: 'No google_ads credentials found' });
    const { decryptCredentials } = await import('../../services/encryption.js');
    const creds: any = decryptCredentials(row.rows[0].encrypted_credentials, row.rows[0].encryption_iv);

    const oauth2 = createOAuthClient();
    oauth2.setCredentials({ refresh_token: creds.refreshToken });
    const { token } = await oauth2.getAccessToken();
    if (!token) return res.status(500).json({ success: false, error: 'Failed to get access token' });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'developer-token': creds.developerToken,
    };
    if (creds.loginCustomerId) headers['login-customer-id'] = String(creds.loginCustomerId);

    const url = 'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers';
    const resp = await fetch(url, { method: 'GET', headers });
    const bodyText = await resp.text();
    let body: any = {};
    try { body = JSON.parse(bodyText); } catch (e) { body = {}; }
    if (!resp.ok) {
      const msg = body?.error?.message || resp.statusText || 'Google Ads listAccessibleCustomers failed';
      return res.status(500).json({ success: false, error: msg, details: body });
    }
    return res.json({ success: true, data: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google Ads test error';
    res.status(500).json({ success: false, error: msg });
  }
}

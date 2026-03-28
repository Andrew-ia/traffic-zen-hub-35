import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Agent as HttpsAgent } from 'https';
import { getPool } from '../../config/database.js';
import { decryptCredentials } from '../encryption.js';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const MERCADO_LIVRE_PLATFORM_KEY = 'mercadolivre';
const ML_PLAINTEXT_IV = 'plain';
const ML_HTTP_TIMEOUT_MS = Number(process.env.ML_HTTP_TIMEOUT_MS || 12000);
const ML_HTTP_RETRY_MAX = Number(process.env.ML_HTTP_RETRY_MAX || 2);
const ML_HTTP_RETRY_BASE_MS = Number(process.env.ML_HTTP_RETRY_BASE_MS || 400);
const ML_HTTP_RETRY_JITTER_MS = Number(process.env.ML_HTTP_RETRY_JITTER_MS || 250);
const ML_HTTP_MAX_SOCKETS = Number(process.env.ML_HTTP_MAX_SOCKETS || 24);
const ML_HTTP_KEEPALIVE = process.env.ML_HTTP_KEEPALIVE !== 'false';

const mlHttpsAgent = new HttpsAgent({
  keepAlive: ML_HTTP_KEEPALIVE,
  maxSockets: ML_HTTP_MAX_SOCKETS,
  maxFreeSockets: Math.min(ML_HTTP_MAX_SOCKETS, 10),
  keepAliveMsecs: 1000,
});

const mlAxios = axios.create({
  baseURL: MERCADO_LIVRE_API_BASE,
  timeout: ML_HTTP_TIMEOUT_MS,
  httpsAgent: mlHttpsAgent,
});

type MercadoLivreCredentials = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  clientId?: string;
  clientSecret?: string;
};

type MlRequestOptions = {
  retries?: number;
  retryOnWrite?: boolean;
};

type RequestWithAuthConfig = AxiosRequestConfig & {
  retryOnWrite?: boolean;
  retries?: number;
};

const tokenStore = new Map<string, (MercadoLivreCredentials & { expiresAt?: number })>();
const invalidRefreshTokens = new Map<string, string>();

const isRetryableMlError = (error: any) => {
  const status = error?.response?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const code = String(error?.code || '').toUpperCase();
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  return message.includes('socket hang up') || message.includes('network error');
};

const isIdempotentMethod = (method?: string) => {
  const normalized = String(method || 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value: any) => {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) {
    return Math.max(0, parsed - Date.now());
  }
  return null;
};

const mlRequest = async <T>(config: AxiosRequestConfig, options: MlRequestOptions = {}): Promise<AxiosResponse<T>> => {
  const retries = Number.isFinite(options.retries) ? Number(options.retries) : ML_HTTP_RETRY_MAX;
  const allowRetry = options.retryOnWrite === true || isIdempotentMethod(config.method);
  let attempt = 0;

  while (true) {
    try {
      return await mlAxios.request<T>({
        timeout: ML_HTTP_TIMEOUT_MS,
        ...config,
      });
    } catch (error: any) {
      attempt += 1;
      if (!allowRetry || !isRetryableMlError(error) || attempt > retries) {
        throw error;
      }

      const retryAfterMs = parseRetryAfterMs(error?.response?.headers?.['retry-after']);
      const baseDelay = ML_HTTP_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * ML_HTTP_RETRY_JITTER_MS);
      const delayMs = Math.min(retryAfterMs ?? (baseDelay + jitter), 15000);
      await sleep(delayMs);
    }
  }
};

const serializeMercadoLivreCredentials = (payload: Record<string, any>) => ({
  encrypted_credentials: JSON.stringify(payload),
  encryption_iv: ML_PLAINTEXT_IV,
});

const parseMercadoLivreCredentialsPayload = (encryptedCredentials: string, encryptionIv?: string | null) => {
  const normalizedIv = String(encryptionIv || '').trim();
  if (!normalizedIv || normalizedIv === ML_PLAINTEXT_IV) {
    const parsed = JSON.parse(encryptedCredentials);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid MercadoLivre credentials payload');
    }
    return parsed as Record<string, any>;
  }

  try {
    return decryptCredentials(encryptedCredentials, normalizedIv) as Record<string, any>;
  } catch (error) {
    const fallbackParsed = JSON.parse(encryptedCredentials);
    if (!fallbackParsed || typeof fallbackParsed !== 'object') {
      throw error;
    }
    return fallbackParsed as Record<string, any>;
  }
};

async function persistMercadoLivreCredentials(
  workspaceId: string,
  credentials: MercadoLivreCredentials & { expiresAt?: number },
) {
  try {
    const pool = getPool();
    const payload = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      userId: credentials.userId,
      expiresAt: credentials.expiresAt,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    };
    const { encrypted_credentials, encryption_iv } = serializeMercadoLivreCredentials(payload);

    await pool.query(
      `insert into integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
       values ($1, $2, $3, $4)
       on conflict (workspace_id, platform_key)
       do update set encrypted_credentials = excluded.encrypted_credentials, encryption_iv = excluded.encryption_iv, updated_at = now()`,
      [workspaceId, MERCADO_LIVRE_PLATFORM_KEY, encrypted_credentials, encryption_iv],
    );
    invalidRefreshTokens.delete(workspaceId);
    return true;
  } catch (error) {
    console.warn('[MercadoLivre Client] Falha ao persistir tokens:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function clearMercadoLivreCredentials(workspaceId: string, reason?: string) {
  tokenStore.delete(workspaceId);
  try {
    const pool = getPool();
    await pool.query(
      'delete from integration_credentials where workspace_id = $1 and platform_key = $2',
      [workspaceId, MERCADO_LIVRE_PLATFORM_KEY],
    );
    if (reason) {
      console.warn(`[MercadoLivre Client] Credenciais removidas (${reason}) para workspace ${workspaceId}.`);
    }
  } catch (error) {
    console.warn('[MercadoLivre Client] Falha ao limpar credenciais:', error instanceof Error ? error.message : error);
  }
}

async function getCredentialsFromDb(workspaceId: string): Promise<(MercadoLivreCredentials & { expiresAt?: number }) | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `select encrypted_credentials, encryption_iv
       from integration_credentials
       where workspace_id = $1 and platform_key = $2
       limit 1`,
      [workspaceId, MERCADO_LIVRE_PLATFORM_KEY],
    );

    if (!result.rows.length) return null;

    const decrypted = parseMercadoLivreCredentialsPayload(
      result.rows[0].encrypted_credentials,
      result.rows[0].encryption_iv,
    ) as any;

    const accessToken = decrypted.accessToken || decrypted.access_token;
    const refreshToken = decrypted.refreshToken || decrypted.refresh_token;
    const userId = decrypted.userId || decrypted.user_id;
    const clientId = decrypted.clientId || decrypted.client_id;
    const clientSecret = decrypted.clientSecret || decrypted.client_secret;

    if (!accessToken || !userId) return null;

    return {
      accessToken: String(accessToken),
      refreshToken: String(refreshToken || ''),
      userId: String(userId),
      expiresAt: typeof decrypted.expiresAt === 'number' ? decrypted.expiresAt : undefined,
      clientId: clientId ? String(clientId) : undefined,
      clientSecret: clientSecret ? String(clientSecret) : undefined,
    };
  } catch (error) {
    console.warn('[MercadoLivre Client] Falha ao buscar tokens no banco:', error instanceof Error ? error.message : error);
    return null;
  }
}

function tokenNeedsRefresh(creds: { expiresAt?: number }) {
  if (!creds.expiresAt) return false;
  return Date.now() >= (creds.expiresAt - 15 * 60 * 1000);
}

export async function getMercadoLivreCredentials(workspaceId: string) {
  const blockedRefreshToken = invalidRefreshTokens.get(workspaceId);
  if (blockedRefreshToken) {
    const dbCreds = await getCredentialsFromDb(workspaceId);
    if (dbCreds?.refreshToken && dbCreds.refreshToken !== blockedRefreshToken) {
      invalidRefreshTokens.delete(workspaceId);
      tokenStore.set(workspaceId, dbCreds);
      return dbCreds;
    }
    return null;
  }

  const cached = tokenStore.get(workspaceId);
  if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
    return cached;
  }

  const dbCreds = await getCredentialsFromDb(workspaceId);
  if (dbCreds) {
    tokenStore.set(workspaceId, dbCreds);
    return dbCreds;
  }

  const accessToken = (process.env.MERCADO_LIVRE_ACCESS_TOKEN || '').trim();
  const refreshToken = (process.env.MERCADO_LIVRE_REFRESH_TOKEN || '').trim();
  const userId = (process.env.MERCADO_LIVRE_USER_ID || '').trim();
  const clientId = (process.env.MERCADO_LIVRE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.MERCADO_LIVRE_CLIENT_SECRET || '').trim();

  if (!accessToken || !userId) return null;

  const creds = {
    accessToken,
    refreshToken,
    userId,
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
  };
  tokenStore.set(workspaceId, creds);
  void persistMercadoLivreCredentials(workspaceId, creds);
  return creds;
}

export async function refreshAccessToken(workspaceId: string): Promise<MercadoLivreCredentials | null> {
  const current = await getMercadoLivreCredentials(workspaceId);
  if (!current || !current.refreshToken) return null;

  const clientId = (current.clientId || process.env.MERCADO_LIVRE_CLIENT_ID || '').trim();
  const clientSecret = (current.clientSecret || process.env.MERCADO_LIVRE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    console.warn('[MercadoLivre Client] Nao e possivel renovar token: client_id/client_secret ausentes');
    return null;
  }

  try {
    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: current.refreshToken,
    });

    const tokenResponse = await mlRequest<any>({
      url: `${MERCADO_LIVRE_API_BASE}/oauth/token`,
      method: 'POST',
      data: payload,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data || {};
    const updated: MercadoLivreCredentials & { expiresAt?: number } = {
      accessToken: String(access_token || ''),
      refreshToken: String(refresh_token || current.refreshToken || ''),
      userId: current.userId,
      clientId,
      clientSecret,
      expiresAt: typeof expires_in === 'number' ? Date.now() + (expires_in * 1000) : undefined,
    };
    tokenStore.set(workspaceId, updated);
    invalidRefreshTokens.delete(workspaceId);
    void persistMercadoLivreCredentials(workspaceId, updated);
    return {
      accessToken: updated.accessToken,
      refreshToken: updated.refreshToken,
      userId: updated.userId,
      clientId,
      clientSecret,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const errCode = err?.response?.data?.error;

    if (errCode === 'invalid_grant') {
      invalidRefreshTokens.set(workspaceId, current.refreshToken);
      const dbCreds = await getCredentialsFromDb(workspaceId);
      if (dbCreds?.refreshToken && dbCreds.refreshToken !== current.refreshToken) {
        invalidRefreshTokens.delete(workspaceId);
        tokenStore.set(workspaceId, dbCreds);
        return {
          accessToken: dbCreds.accessToken,
          refreshToken: dbCreds.refreshToken,
          userId: dbCreds.userId,
          clientId: dbCreds.clientId,
          clientSecret: dbCreds.clientSecret,
        };
      }

      await clearMercadoLivreCredentials(workspaceId, 'invalid_grant');
      return null;
    }

    if (errCode === 'invalid_client') {
      const msg = err?.response?.data?.message || err?.message || 'invalid_client';
      throw new Error(`ml_invalid_client:${msg}`);
    }

    const message = err?.response?.data?.message || err?.message || `ml_refresh_failed:${status || 'unknown'}`;
    throw new Error(message);
  }
}

export async function requestWithAuth<T>(workspaceId: string, url: string, config: RequestWithAuthConfig = {}): Promise<T> {
  let creds = await getMercadoLivreCredentials(workspaceId);
  if (!creds) {
    throw new Error('ml_not_connected');
  }

  if (tokenNeedsRefresh(creds)) {
    try {
      const refreshed = await refreshAccessToken(workspaceId);
      if (refreshed) {
        creds = refreshed;
      } else if (invalidRefreshTokens.has(workspaceId)) {
        throw new Error('ml_not_connected');
      }
    } catch (error: any) {
      if (String(error?.message || '').startsWith('ml_invalid_client')) {
        throw error;
      }
      if (error?.message === 'ml_not_connected') {
        throw error;
      }
    }
  }

  try {
    const response = await mlRequest<T>({
      url,
      method: config.method || 'GET',
      params: config.params,
      data: config.data,
      headers: { Authorization: `Bearer ${creds.accessToken}`, ...config.headers },
      timeout: config.timeout,
    }, {
      retryOnWrite: config.retryOnWrite,
      retries: config.retries,
    });
    return response.data as any;
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 401) {
      const refreshed = await refreshAccessToken(workspaceId);
      if (!refreshed) {
        tokenStore.delete(workspaceId);
        throw new Error('ml_not_connected');
      }
      const response = await mlRequest<T>({
        url,
        method: config.method || 'GET',
        params: config.params,
        data: config.data,
        headers: { Authorization: `Bearer ${refreshed.accessToken}`, ...config.headers },
        timeout: config.timeout,
      }, {
        retryOnWrite: config.retryOnWrite,
        retries: config.retries,
      });
      return response.data as any;
    }
    throw error;
  }
}

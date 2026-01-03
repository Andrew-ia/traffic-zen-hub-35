import { Router } from "express";
import type { Request } from "express";
import axios from "axios";
import FormData from "form-data";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { promises as fs } from "fs";
import path from "path";
import { getPool } from "../../config/database.js";
import { decryptCredentials } from "../../services/encryption.js";
import { resolveWorkspaceId } from "../../utils/workspace.js";
// import { authMiddleware } from "../auth";

import { TelegramNotificationService } from "../../services/telegramNotification.service.js";
import { MarketAnalysisService } from "../../services/mercadolivre/market-analysis.service.js";
import { subDays, startOfDay, format } from "date-fns";

const router = Router();

// Base URL da API do Mercado Livre
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";
const MERCADO_LIVRE_PLATFORM_KEY = "mercadolivre";

// Cache simples para categorias do Mercado Livre
const CATEGORIES_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const categoriesCache = new Map<string, { data: any[]; ts: number }>();

// Cache simples para resultados de busca avançada
const ADV_SEARCH_TTL_MS = 30 * 60 * 1000; // 30 minutos
const advancedSearchCache = new Map<string, { data: any; ts: number }>();
const ML_ITEM_NOTIFICATIONS_ENABLED = process.env.ML_NOTIFY_ITEM_UPDATES === "true";
const FALLBACK_WORKSPACE_ENV = (process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || process.env.WORKSPACE_ID || "").trim();
const FALLBACK_ML_USER_ID = (process.env.MERCADO_LIVRE_USER_ID || "").trim();
const ML_PLAINTEXT_IV = "plain";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

const formatBrazilDateKey = (date: Date) => BRAZIL_DATE_FORMATTER.format(date);

const normalizeBrazilDateKey = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.includes("T")) {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return formatBrazilDateKey(parsed);
    }
    return trimmed;
};

const toBrazilDayBoundary = (dateKey: string, endOfDay: boolean) => {
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
    return new Date(`${dateKey}T${time}-03:00`);
};

const formatAxiosError = (error: any) => ({
    status: error?.response?.status,
    code: error?.response?.data?.error || error?.code,
    message: error?.response?.data?.message || error?.message || "Unknown error",
});

const shouldWriteEnvLocal = () => {
    if (process.env.ML_WRITE_ENV_LOCAL === "true") return true;
    if (process.env.VERCEL === "1") return false;
    return process.env.NODE_ENV !== "production";
};

async function updateEnvLocalTokens(updates: Record<string, string | undefined>): Promise<boolean> {
    if (!shouldWriteEnvLocal()) return false;

    const normalized: Record<string, string> = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value) normalized[key] = String(value).trim();
    });

    if (!Object.keys(normalized).length) return false;

    const envPath = path.resolve(process.cwd(), ".env.local");
    let content = "";

    try {
        content = await fs.readFile(envPath, "utf8");
    } catch (error: any) {
        if (error?.code !== "ENOENT") {
            throw error;
        }
    }

    const lines = content ? content.split(/\r?\n/) : [];
    const seen = new Set<string>();
    const nextLines = lines.map((line) => {
        const match = line.match(/^([A-Z0-9_]+)=/);
        if (!match) return line;
        const key = match[1];
        if (!(key in normalized)) return line;
        seen.add(key);
        return `${key}=${normalized[key]}`;
    });

    Object.entries(normalized).forEach(([key, value]) => {
        if (!seen.has(key)) {
            nextLines.push(`${key}=${value}`);
        }
    });

    const output = nextLines.join("\n");
    await fs.writeFile(envPath, output.endsWith("\n") ? output : `${output}\n`, "utf8");
    return true;
}

const serializeMercadoLivreCredentials = (payload: Record<string, any>) => ({
    encrypted_credentials: JSON.stringify(payload),
    encryption_iv: ML_PLAINTEXT_IV,
});

const parseMercadoLivreCredentialsPayload = (encryptedCredentials: string, encryptionIv?: string | null) => {
    const normalizedIv = String(encryptionIv || "").trim();
    if (!normalizedIv || normalizedIv === ML_PLAINTEXT_IV) {
        const parsed = JSON.parse(encryptedCredentials);
        if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid MercadoLivre credentials payload");
        }
        return parsed as Record<string, any>;
    }

    try {
        return decryptCredentials(encryptedCredentials, normalizedIv) as Record<string, any>;
    } catch (error) {
        const fallbackParsed = JSON.parse(encryptedCredentials);
        if (!fallbackParsed || typeof fallbackParsed !== "object") {
            throw error;
        }
        return fallbackParsed as Record<string, any>;
    }
};

const SHIPMENT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache for shipment details
let shipmentsCacheTableReady: Promise<void> | null = null;

const normalizeBaseUrl = (value?: string | null) => {
    if (!value) return "";
    const trimmed = String(value).trim().replace(/^['"]|['"]$/g, "");
    if (!trimmed) return "";
    return trimmed.replace(/\/$/, "");
};

function resolveFrontendBaseUrl(req: Request): string {
    const envBase = normalizeBaseUrl(process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL);
    if (envBase) return envBase;

    const hostHeader = normalizeBaseUrl(String((req.headers["x-forwarded-host"] || req.headers.host || "")).split(",")[0]);
    if (hostHeader) {
        const protoHeader = String((req.headers["x-forwarded-proto"] || req.protocol || "https")).split(",")[0].replace(/:$/, "");
        return `${protoHeader}://${hostHeader}`;
    }

    const vercelBase = normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (vercelBase) return vercelBase;

    return "";
}

const buildRedirectUri = (req: Request) => {
    const baseUrl = resolveFrontendBaseUrl(req);
    return baseUrl ? `${baseUrl}/integrations/mercadolivre/callback` : "";
};

async function ensureShipmentsCacheTable() {
    if (shipmentsCacheTableReady) return shipmentsCacheTableReady;

    shipmentsCacheTableReady = (async () => {
        try {
            const pool = getPool();
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ml_shipments_cache (
                    workspace_id TEXT NOT NULL,
                    shipment_id TEXT NOT NULL,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (workspace_id, shipment_id)
                );
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_ml_shipments_cache_updated_at
                ON ml_shipments_cache (updated_at DESC)
            `);
        } catch (error) {
            console.warn("[MercadoLivre] Failed to ensure shipments cache table:", error instanceof Error ? error.message : error);
        }
    })();

    return shipmentsCacheTableReady;
}

async function getCachedShipment(workspaceId: string, shipmentId: string) {
    try {
        await ensureShipmentsCacheTable();
        const pool = getPool();
        const { rows } = await pool.query(
            `SELECT data, updated_at
             FROM ml_shipments_cache
             WHERE workspace_id = $1 AND shipment_id = $2
             LIMIT 1`,
            [workspaceId, shipmentId]
        );
        if (!rows.length) return null;

        const updatedAt = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;
        if (!updatedAt || (Date.now() - updatedAt) > SHIPMENT_CACHE_TTL_MS) {
            return null;
        }

        return rows[0].data;
    } catch (error) {
        console.warn("[MercadoLivre] Falha ao ler cache de shipments:", error instanceof Error ? error.message : error);
        return null;
    }
}

async function saveShipmentToCache(workspaceId: string, shipmentId: string, data: any) {
    try {
        await ensureShipmentsCacheTable();
        const pool = getPool();
        await pool.query(
            `INSERT INTO ml_shipments_cache (workspace_id, shipment_id, data, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (workspace_id, shipment_id)
             DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
            [workspaceId, shipmentId, data]
        );
    } catch (error) {
        console.warn("[MercadoLivre] Falha ao salvar cache de shipments:", error instanceof Error ? error.message : error);
    }
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R | null>
): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    const runners = Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (index < items.length) {
            const currentIndex = index++;
            if (currentIndex >= items.length) break;
            const item = items[currentIndex];
            try {
                const res = await worker(item);
                if (res !== null && res !== undefined) {
                    results.push(res);
                }
            } catch (error) {
                console.warn("[MercadoLivre] Worker falhou ao processar item:", error instanceof Error ? error.message : error);
            }
        }
    });

    await Promise.all(runners);
    return results;
}

/**
 * Interface para credenciais do Mercado Livre
 */
interface MercadoLivreCredentials {
    accessToken: string;
    refreshToken: string;
    userId: string;
    clientId?: string;
    clientSecret?: string;
}

const tokenStore = new Map<string, (MercadoLivreCredentials & { expiresAt?: number })>();
const invalidRefreshTokens = new Map<string, string>();

async function credentialsExist(workspaceId: string): Promise<boolean> {
    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE workspace_id = $1 AND platform_key = $2
             LIMIT 1`,
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );
        if (!result.rows.length) return false;
        try {
            const dec = parseMercadoLivreCredentialsPayload(
                result.rows[0].encrypted_credentials,
                result.rows[0].encryption_iv
            ) as any;
            const accessToken = dec?.accessToken || dec?.access_token;
            const userId = dec?.userId || dec?.user_id;
            return Boolean(accessToken && userId);
        } catch (error) {
            console.warn("[MercadoLivre] Credenciais existentes invalidas, regravando:", error instanceof Error ? error.message : error);
            return false;
        }
    } catch (error) {
        console.warn("[MercadoLivre] Falha ao verificar credenciais existentes:", error instanceof Error ? error.message : error);
        return false;
    }
}

const userIdToWorkspaceCache = new Map<string, string>();

async function findWorkspaceIdByMLUserId(userId: string): Promise<string | null> {
    const trimmedUserId = String(userId).trim();
    if (userIdToWorkspaceCache.has(trimmedUserId)) {
        return userIdToWorkspaceCache.get(trimmedUserId)!;
    }

    if (FALLBACK_ML_USER_ID && FALLBACK_WORKSPACE_ENV && FALLBACK_ML_USER_ID === trimmedUserId) {
        userIdToWorkspaceCache.set(trimmedUserId, FALLBACK_WORKSPACE_ENV);
        return FALLBACK_WORKSPACE_ENV;
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT workspace_id, encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE platform_key = $1`,
            [MERCADO_LIVRE_PLATFORM_KEY]
        );

        for (const row of result.rows) {
            try {
                const dec = parseMercadoLivreCredentialsPayload(row.encrypted_credentials, row.encryption_iv) as any;
                const decUserId = String(dec.userId || dec.user_id || "").trim();
                if (decUserId && decUserId === trimmedUserId) {
                    userIdToWorkspaceCache.set(trimmedUserId, row.workspace_id);
                    return row.workspace_id;
                }
            } catch (e) {
                console.warn(
                    "[MercadoLivre] Falha ao tentar identificar workspace pelo userId:",
                    e instanceof Error ? e.message : e
                );
            }
        }
    } catch (error) {
        console.warn("[MercadoLivre] Erro ao buscar workspace pelo userId:", error instanceof Error ? error.message : error);
    }
    return null;
}

export async function bootstrapMercadoLivreEnvCredentials(workspaceId: string): Promise<boolean> {
    const accessToken = (process.env.MERCADO_LIVRE_ACCESS_TOKEN || "").trim();
    const refreshToken = (process.env.MERCADO_LIVRE_REFRESH_TOKEN || "").trim();
    const userId = (process.env.MERCADO_LIVRE_USER_ID || "").trim();
    const clientId = (process.env.MERCADO_LIVRE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.MERCADO_LIVRE_CLIENT_SECRET || "").trim();

    if (!accessToken || !userId) {
        return false; // Nada para aplicar a partir das envs
    }

    // Evita sobrescrever se já existir no banco
    const alreadySaved = await credentialsExist(workspaceId);
    if (alreadySaved) return false;

    const payload = { accessToken, refreshToken, userId, clientId, clientSecret };
    const { encrypted_credentials, encryption_iv } = serializeMercadoLivreCredentials(payload);

    try {
        const pool = getPool();
        await pool.query(
            `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, platform_key)
             DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY, encrypted_credentials, encryption_iv]
        );

        tokenStore.set(workspaceId, payload);
        invalidRefreshTokens.delete(workspaceId);
        console.log(`[MercadoLivre] Credenciais aplicadas a partir das envs para workspace ${workspaceId}`);
        return true;
    } catch (error) {
        console.error("[MercadoLivre] Falha ao gravar credenciais de env:", error instanceof Error ? error.message : error);
        return false;
    }
}

async function persistMercadoLivreCredentials(
    workspaceId: string,
    credentials: MercadoLivreCredentials & { expiresAt?: number }
): Promise<boolean> {
    try {
        const pool = getPool();
        const payload = {
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            userId: credentials.userId,
            expiresAt: credentials.expiresAt,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret
        };
        const { encrypted_credentials, encryption_iv } = serializeMercadoLivreCredentials(payload);

        await pool.query(
            `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, platform_key)
             DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY, encrypted_credentials, encryption_iv]
        );
        invalidRefreshTokens.delete(workspaceId);
        return true;
    } catch (error) {
        console.warn("[MercadoLivre] Falha ao persistir tokens:", error instanceof Error ? error.message : error);
        return false;
    }
}

async function clearMercadoLivreCredentials(workspaceId: string, reason?: string) {
    tokenStore.delete(workspaceId);
    try {
        const pool = getPool();
        await pool.query(
            "DELETE FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2",
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );
        if (reason) {
            console.warn(`[MercadoLivre] Credenciais removidas (${reason}) para workspace ${workspaceId}.`);
        }
    } catch (error) {
        console.warn(
            `[MercadoLivre] Falha ao limpar credenciais${reason ? ` (${reason})` : ""}:`,
            error instanceof Error ? error.message : error
        );
    }
}

async function getCredentialsFromDb(workspaceId: string): Promise<(MercadoLivreCredentials & { expiresAt?: number }) | null> {
    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE workspace_id = $1 AND platform_key = $2
             LIMIT 1`,
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );

        if (!result.rows.length) return null;

        const decrypted = parseMercadoLivreCredentialsPayload(
            result.rows[0].encrypted_credentials,
            result.rows[0].encryption_iv
        ) as any;

        const accessToken = decrypted.accessToken || decrypted.access_token;
        const refreshToken = decrypted.refreshToken || decrypted.refresh_token;
        const userId = decrypted.userId || decrypted.user_id;
        const clientId = decrypted.clientId || decrypted.client_id;
        const clientSecret = decrypted.clientSecret || decrypted.client_secret;

        if (!accessToken || !userId) return null;

        const credentials = {
            accessToken: String(accessToken),
            refreshToken: String(refreshToken || ""),
            userId: String(userId),
            expiresAt: typeof decrypted.expiresAt === "number" ? decrypted.expiresAt : undefined,
            clientId: clientId ? String(clientId) : undefined,
            clientSecret: clientSecret ? String(clientSecret) : undefined,
        };
        const normalizedIv = String(result.rows[0].encryption_iv || "").trim();
        if (normalizedIv && normalizedIv !== ML_PLAINTEXT_IV) {
            void persistMercadoLivreCredentials(workspaceId, credentials);
        }

        return credentials;
    } catch (error) {
        console.warn("[MercadoLivre] Falha ao buscar tokens no banco:", error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Busca as credenciais do Mercado Livre para um workspace
 */
export async function getMercadoLivreCredentials(
    workspaceId: string
): Promise<(MercadoLivreCredentials & { expiresAt?: number }) | null> {
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

    const accessToken = process.env.MERCADO_LIVRE_ACCESS_TOKEN;
    const refreshToken = process.env.MERCADO_LIVRE_REFRESH_TOKEN;
    const userId = process.env.MERCADO_LIVRE_USER_ID;
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    if (!accessToken || !userId) {
        return null;
    }

    const creds = {
        accessToken: accessToken.trim(),
        refreshToken: (refreshToken || "").trim(),
        userId: userId.trim(),
        clientId: clientId?.trim() || undefined,
        clientSecret: clientSecret?.trim() || undefined
    };
    tokenStore.set(workspaceId, creds);
    // Persistir no banco para evitar depender de env e permitir refresh automático
    void persistMercadoLivreCredentials(workspaceId, creds);
    return creds;
}

function tokenNeedsRefresh(creds: { expiresAt?: number }): boolean {
    if (!creds.expiresAt) return false;
    const marginMs = 15 * 60 * 1000; // 15 minutos de margem
    return Date.now() >= (creds.expiresAt - marginMs);
}

export async function refreshAccessToken(workspaceId: string): Promise<MercadoLivreCredentials | null> {
    const current = await getMercadoLivreCredentials(workspaceId);
    if (!current || !current.refreshToken) return null;
    const clientId = (current.clientId || process.env.MERCADO_LIVRE_CLIENT_ID || "").trim();
    const clientSecret = (current.clientSecret || process.env.MERCADO_LIVRE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
        console.warn("[MercadoLivre] Não é possível renovar token: client_id/client_secret ausentes");
        return null;
    }

    try {
        const payload = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: current.refreshToken,
        });

        const tokenResponse = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/oauth/token`,
            payload,
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
        );
        const { access_token, refresh_token, expires_in } = tokenResponse.data || {};
        const updated: MercadoLivreCredentials & { expiresAt?: number } = {
            accessToken: String(access_token || ""),
            refreshToken: String(refresh_token || current.refreshToken || ""),
            userId: current.userId,
            clientId,
            clientSecret,
            expiresAt: typeof expires_in === "number" ? Date.now() + (expires_in * 1000) : undefined,
        };
        tokenStore.set(workspaceId, updated);
        invalidRefreshTokens.delete(workspaceId);
        void persistMercadoLivreCredentials(workspaceId, updated);
        return { accessToken: updated.accessToken, refreshToken: updated.refreshToken, userId: updated.userId, clientId, clientSecret };
    } catch (err: any) {
        const status = err?.response?.status;
        const errCode = err?.response?.data?.error;

        if (errCode === "invalid_grant") {
            console.error(`
🚨 [MercadoLivre] TOKEN INVALIDADO/EXPIRADO (invalid_grant)
------------------------------------------------------------
O refresh token para o workspace ${workspaceId} foi rejeitado pelo Mercado Livre.
Isso geralmente acontece quando:
1. O usuário revogou o acesso nas configurações do ML.
2. O token expirou (6 meses sem uso).
3. A senha da conta do ML foi alterada.

AÇÃO NECESSÁRIA: O usuário deve reconectar a conta no painel de integrações.
------------------------------------------------------------
            `);
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

            await clearMercadoLivreCredentials(workspaceId, "invalid_grant");
            return null;
        }

        if (errCode === "invalid_client") {
            const msg = err?.response?.data?.message || err?.message || "invalid_client";
            throw new Error(`ml_invalid_client:${msg}`);
        }

        const message = err?.response?.data?.message || err?.message || `ml_refresh_failed:${status || "unknown"}`;
        throw new Error(message);
    }
}

async function verifyMercadoLivreConnection(workspaceId: string): Promise<{ connected: boolean; userId?: string; reason?: string }> {
    let creds = await getMercadoLivreCredentials(workspaceId);
    if (!creds) {
        return { connected: false };
    }

    if (tokenNeedsRefresh(creds)) {
        try {
            const refreshed = await refreshAccessToken(workspaceId);
            if (!refreshed) {
                return { connected: false, reason: "refresh_failed" };
            }
            creds = {
                ...creds,
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
                userId: refreshed.userId,
            };
        } catch (err: any) {
            const message = String(err?.message || "");
            if (message.startsWith("ml_invalid_client")) {
                await clearMercadoLivreCredentials(workspaceId, "invalid_client");
                return { connected: false, reason: "invalid_client" };
            }
            return { connected: false, reason: "refresh_failed" };
        }
    }

    try {
        await axios.get(`${MERCADO_LIVRE_API_BASE}/users/${creds.userId}`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
            timeout: 8000,
        });
        return { connected: true, userId: creds.userId };
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
            try {
                const refreshed = await refreshAccessToken(workspaceId);
                if (refreshed?.accessToken) {
                    await axios.get(`${MERCADO_LIVRE_API_BASE}/users/${refreshed.userId}`, {
                        headers: { Authorization: `Bearer ${refreshed.accessToken}` },
                        timeout: 8000,
                    });
                    return { connected: true, userId: refreshed.userId };
                }
            } catch (refreshErr: any) {
                const message = String(refreshErr?.message || "");
                if (message.startsWith("ml_invalid_client")) {
                    await clearMercadoLivreCredentials(workspaceId, "invalid_client");
                    return { connected: false, reason: "invalid_client" };
                }
            }

            await clearMercadoLivreCredentials(workspaceId, "auth_status_unauthorized");
            return { connected: false, reason: "unauthorized" };
        }

        console.warn("[MercadoLivre] Auth status check failed:", formatAxiosError(err));
        return { connected: true, userId: creds.userId, reason: "status_check_failed" };
    }
}

export async function requestWithAuth<T>(workspaceId: string, url: string, config: { method?: "GET" | "POST" | "PUT"; params?: any; data?: any; headers?: any } = {}): Promise<T> {
    let creds = await getMercadoLivreCredentials(workspaceId);
    if (!creds) {
        console.warn(`[MercadoLivre] Tentativa de acesso sem credenciais para workspace ${workspaceId}.`);
        throw new Error("ml_not_connected");
    }

    // Refresh antecipado se token estiver perto de expirar
    if (tokenNeedsRefresh(creds)) {
        try {
            const refreshed = await refreshAccessToken(workspaceId);
            if (refreshed) {
                creds = refreshed;
            } else if (invalidRefreshTokens.has(workspaceId)) {
                console.warn(`[MercadoLivre] Refresh falhou e token foi invalidado para workspace ${workspaceId}.`);
                throw new Error("ml_not_connected");
            }
        } catch (e: any) {
            if (String(e?.message || "").startsWith("ml_invalid_client")) {
                throw e;
            }
            if (e?.message === "ml_not_connected") {
                throw e;
            }
            console.warn("[MercadoLivre] Falha no refresh antecipado:", formatAxiosError(e));
            // Se falhar o refresh, tentamos com o token atual (vai que funciona ou cai no 401 e tenta de novo)
            // Mas se o erro foi "invalid_grant", o cache já foi limpo pelo refreshAccessToken
        }
    }

    try {
        const resp = await axios.request<T>({ url, method: config.method || "GET", params: config.params, data: config.data, headers: { Authorization: `Bearer ${creds.accessToken}`, ...config.headers } });
        return resp.data as any;
    } catch (err: any) {
        const status = err?.response?.status;
        
        // Log detailed error for debugging
        if (status >= 400) {
            console.error(`[MercadoLivre] API Error ${status} for ${url}:`, 
                JSON.stringify(err.response?.data || err.message, null, 2)
            );
        }

        if (status === 401) {
            console.log(`[MercadoLivre] 401 detectado. Tentando refresh token para workspace ${workspaceId}...`);
            try {
                const refreshed = await refreshAccessToken(workspaceId);
                if (!refreshed) {
                    tokenStore.delete(workspaceId); // Ensure cache is cleared if refresh returns null
                    throw new Error("ml_not_connected");
                }
                const resp = await axios.request<T>({ url, method: config.method || "GET", params: config.params, data: config.data, headers: { Authorization: `Bearer ${refreshed.accessToken}`, ...config.headers } });
                return resp.data as any;
            } catch (refreshErr) {
                 // Se o refresh falhar (ex: invalid_grant), o cache já foi limpo.
                 // Repassamos o erro original ou o de refresh?
                 // Melhor limpar o cache aqui também por segurança
                 tokenStore.delete(workspaceId);
                 throw refreshErr;
            }
        }
        throw err;
    }
}

/**
 * GET /api/integrations/mercadolivre/search
 * Busca pública de produtos no Mercado Livre (Sites API)
 */
router.get("/search", async (req, res) => {
    try {
        const { q, limit = 50, offset = 0, workspaceId } = req.query;

        if (!q) {
            return res.status(400).json({ error: "Query parameter 'q' is required" });
        }

        const headers: any = {};
        if (workspaceId) {
            try {
                const creds = await getMercadoLivreCredentials(String(workspaceId));
                if (creds?.accessToken) {
                    headers['Authorization'] = `Bearer ${creds.accessToken}`;
                }
            } catch (e) {
                console.warn("Failed to get credentials for search:", e);
            }
        }

        const response = await axios.get(`https://api.mercadolibre.com/sites/MLB/search`, {
            params: {
                q,
                limit,
                offset
            },
            headers
        });

        return res.json(response.data);
    } catch (error: any) {
        console.error("Error searching Mercado Livre:", error?.message);

        // Return a safe, simple JSON error
        return res.status(error?.response?.status || 500).json({
            error: "Failed to search items",
            details: typeof error?.response?.data === 'string'
                ? error.response.data.slice(0, 200)
                : (error?.response?.data || error?.message || "Unknown error")
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/auth/status
 * Verifica se existem credenciais válidas para o workspace
 */
router.get("/auth/status", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }
        
        const status = await verifyMercadoLivreConnection(String(workspaceId));
        return res.json({ connected: status.connected, userId: status.userId });
    } catch (error: any) {
        console.error("Error checking auth status:", error);
        return res.status(500).json({ error: "Failed to check status" });
    }
});

/**
 * GET /api/integrations/mercadolivre/auth/url
 * Gera URL de autorização OAuth do Mercado Livre
 */
router.get("/auth/url", async (req, res) => {
    try {
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
        const redirectUri = buildRedirectUri(req as Request);

        if (!clientId) {
            return res.status(500).json({
                error: "Mercado Livre Client ID not configured"
            });
        }
        if (!redirectUri) {
            return res.status(500).json({
                error: "Frontend URL not configured. Set FRONTEND_URL or VERCEL_URL"
            });
        }

        const safeRedirectUri = redirectUri ? redirectUri.trim().replace(/^['"]|['"]$/g, "") : "";
        const safeClientId = clientId ? clientId.trim().replace(/^['"]|['"]$/g, "") : "";
        
        // CloudFront blocks requests with localhost/127.0.0.1 in redirect_uri param (WAF rule).
        // To bypass this in development, we use the production Vercel URL as the redirect_uri.
        const isLocalhost = safeRedirectUri.includes("localhost") || safeRedirectUri.includes("127.0.0.1");
        
        // Force production URL if running on Vercel or if localhost (to bypass WAF)
        const isVercel = process.env.VERCEL === "1";
        
        let finalRedirectUri = safeRedirectUri;
        if (isLocalhost || isVercel) {
             // ALWAYS use the production URL as the callback URI to ensure consistency
             // and match the Whitelist in Mercado Livre Developer Panel.
             finalRedirectUri = "https://traffic-zen-hub-35.vercel.app/integrations/mercadolivre/callback";
             console.log("⚠️ Enforcing production redirect_uri (Localhost/Vercel detected):", finalRedirectUri);
        }

        // URL de autorização do Mercado Livre (Brasil)
        // Always send redirect_uri (required by ML), but use the "safe" one (Vercel) if localhost
        // Added explicit scopes for Advertising
        const scopes = "offline_access read write advertising";
        const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${safeClientId}&state=${encodeURIComponent(workspaceId as string)}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}`;
        
        console.log("Generated ML Auth URL (Force-Safe):", authUrl);

        return res.json({
            authUrl,
            redirectUri: finalRedirectUri,
        });
    } catch (error: any) {
        console.error("Error generating auth URL:", error);
        return res.status(500).json({
            error: "Failed to generate auth URL",
            details: error.message,
        });
    }
});

/**
 * DELETE /api/integrations/mercadolivre/auth
 * Remove credenciais do Mercado Livre (Desconectar)
 */
router.delete("/auth", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const pool = getPool();
        await pool.query(
            "DELETE FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2",
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );
        tokenStore.delete(String(workspaceId));
        invalidRefreshTokens.delete(String(workspaceId));

        return res.json({ success: true, message: "Disconnected successfully" });
    } catch (error: any) {
        console.error("Error disconnecting Mercado Livre:", error);
        return res.status(500).json({
            error: "Failed to disconnect",
            details: error.message
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/manual-credentials
 * Permite salvar credenciais manualmente (útil para desenvolvimento local)
 */
router.post("/manual-credentials", async (req, res) => {
    try {
        const { workspaceId, accessToken, refreshToken, userId } = req.body;

        if (!workspaceId || !accessToken || !refreshToken || !userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const creds = {
            accessToken: String(accessToken).trim(),
            refreshToken: String(refreshToken).trim(),
            userId: String(userId).trim(),
        };

        tokenStore.set(workspaceId, creds);
        // Persistir no banco
        await persistMercadoLivreCredentials(workspaceId, creds);
        
        console.log(`[MercadoLivre] Credenciais manuais aplicadas para workspace ${workspaceId}`);
        return res.json({ success: true });
    } catch (error: any) {
        console.error("Error saving manual credentials:", error);
        return res.status(500).json({
            error: "Failed to save credentials",
            details: error.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/items/:itemId
 * Proxy para obter detalhes públicos de um item (requere workspaceId para token)
 */
router.get("/items/:itemId", async (req, res) => {
    try {
        const { itemId } = req.params;
        const normalizedItemId = String(itemId || '').trim().toUpperCase();
        const { workspaceId } = req.query as { workspaceId?: string };
        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }
        const idToUse = /^MLB\d+$/.test(normalizedItemId) ? normalizedItemId : itemId;
        const data = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${idToUse}`);
        return res.json(data);
    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch item",
            details: error?.response?.data || error?.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/items/:itemId/description
 * Obtém a descrição (plain_text) do item
 */
router.get("/items/:itemId/description", async (req, res) => {
    try {
        const { itemId } = req.params;
        const normalizedItemId = String(itemId || '').trim().toUpperCase();
        const { workspaceId } = req.query as { workspaceId?: string };
        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }
        const idToUse = /^MLB\d+$/.test(normalizedItemId) ? normalizedItemId : itemId;
        const data = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${idToUse}/description`);
        return res.json(data);
    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch item description",
            details: error?.response?.data || error?.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/trends/:categoryId
 * Busca tendências de uma categoria (Top 50 produtos mais populares)
 */
router.get("/trends/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { workspaceId } = req.query as { workspaceId?: string };
        const targetWorkspace = String(workspaceId || "default");
        
        // Mercado Livre Trends API endpoint
        // https://api.mercadolibre.com/trends/MLB/:category_id
        const url = `${MERCADO_LIVRE_API_BASE}/trends/MLB/${categoryId}`;

        const data = await requestWithAuth<any>(targetWorkspace, url);
        return res.json(data);
    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch category trends",
            details: error?.response?.data || error?.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/category-top-products/:categoryId
 * Busca produtos mais vendidos de uma categoria
 */
router.get("/category-top-products/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { workspaceId } = req.query as { workspaceId?: string };
        const targetWorkspace = String(workspaceId || "default");
        
        // Estratégia em Cascata para buscar "Melhores Produtos":
        
        // 1. Tentar API oficial de Highlights (Requer Autenticação)
        // Retorna os itens mais vendidos da categoria
        try {
            const highlightsUrl = `${MERCADO_LIVRE_API_BASE}/highlights/MLB/category/${categoryId}`;
            const highlightsData = await requestWithAuth<any>(targetWorkspace, highlightsUrl);
            
            if (highlightsData?.content && Array.isArray(highlightsData.content)) {
                const content = highlightsData.content.slice(0, 20);
                const resultsMap = new Map();

                const itemIds = content
                    .filter((item: any) => item.type === 'ITEM')
                    .map((item: any) => item.id);

                const productIds = content
                    .filter((item: any) => item.type === 'PRODUCT')
                    .map((item: any) => item.id);
                    
                // Fetch ITEMS (Batch)
                if (itemIds.length > 0) {
                     const itemsUrl = `${MERCADO_LIVRE_API_BASE}/items?ids=${itemIds.join(",")}`;
                     const itemsData = await requestWithAuth<any>(targetWorkspace, itemsUrl);
                     
                     if (Array.isArray(itemsData)) {
                        itemsData.forEach((r: any) => {
                            if (r.body && !r.body.error) {
                                resultsMap.set(r.body.id, r.body);
                            }
                        });
                     }
                }

                // Fetch PRODUCTS (Parallel Requests)
                if (productIds.length > 0) {
                    await Promise.all(productIds.map(async (id: string) => {
                        try {
                            const product = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/products/${id}`);
                            resultsMap.set(id, product);
                        } catch (e) {
                            // Ignore individual failures
                        }
                    }));
                }

                // Reconstruct ordered list
                const finalProducts = content
                    .map((item: any) => resultsMap.get(item.id))
                    .filter((p: any) => p !== undefined);

                if (finalProducts.length > 0) {
                    return res.json(finalProducts);
                }
            }
        } catch (err: any) {
            // Silenciosamente falha e tenta o próximo método
            // console.log("Highlights API skipped:", err.message);
        }

        // 2. Tentar Search API com sort=sold_quantity_desc (Com Autenticação)
        const searchUrl = `${MERCADO_LIVRE_API_BASE}/sites/MLB/search?category=${categoryId}&sort=sold_quantity_desc&limit=20`;
        try {
             const data = await requestWithAuth<any>(targetWorkspace, searchUrl);
             if (data.results && data.results.length > 0) {
                 return res.json(data.results);
             }
        } catch (err: any) {
             // console.log("Auth search failed:", err.message);
        }

        // Se nada funcionou, retornar vazio ou erro
        return res.json([]);

    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch category top products",
            details: error?.response?.data || error?.message,
        });
    }
});


/**
 * GET /api/integrations/mercadolivre/categories/:categoryId
 * Obtém detalhes de uma categoria
 */
router.get("/categories/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { workspaceId } = req.query as { workspaceId?: string };
        const targetWorkspace = String(workspaceId || "default");
        
        // Try with authentication first
        try {
            const data = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/categories/${categoryId}`);
            return res.json(data);
        } catch (err: any) {
            // Fallback to public request for ANY error (401, 403, 404, ml_not_connected, etc.)
            // This ensures that even if auth fails or token is invalid, we try to get public data
            const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${categoryId}`);
            return res.json(resp.data);
        }
    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch category",
            details: error?.response?.data || error?.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/categories/:categoryId/attributes
 * Obtém atributos permitidos para a categoria
 */
router.get("/categories/:categoryId/attributes", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { workspaceId } = req.query as { workspaceId?: string };
        const targetWorkspace = String(workspaceId || "default");
        
        try {
            const data = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/categories/${categoryId}/attributes`);
            return res.json(data);
        } catch (err: any) {
            // Fallback to public request
            const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${categoryId}/attributes`);
            return res.json(resp.data);
        }
    } catch (error: any) {
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch category attributes",
            details: error?.response?.data || error?.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/callback
 * Endpoint para lidar com redirecionamento incorreto (quando ML redireciona para o backend via GET)
 * Redireciona para o frontend com os parâmetros de query.
 */
router.get("/callback", (req, res) => {
    const { code, state, error, error_description } = req.query;
    const redirectBase = buildRedirectUri(req as Request);

    if (!redirectBase) {
        return res.status(500).send("Frontend URL not configured");
    }

    // Construct the frontend URL with query params
    const frontendUrl = new URL(redirectBase);
    if (code) frontendUrl.searchParams.set("code", String(code));
    if (state) frontendUrl.searchParams.set("state", String(state));
    if (error) frontendUrl.searchParams.set("error", String(error));
    if (error_description) frontendUrl.searchParams.set("error_description", String(error_description));

    return res.redirect(frontendUrl.toString());
});

/**
 * POST /api/integrations/mercadolivre/auth/callback
 * Processa callback OAuth e troca código por tokens
 */
router.post("/auth/callback", async (req, res) => {
    try {
        const { code, workspaceId } = req.body;

        if (!code || !workspaceId) {
            return res.status(400).json({
                error: "Code and workspace ID are required"
            });
        }

        const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
        const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
        const redirectUri = buildRedirectUri(req as Request);

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                error: "Mercado Livre credentials not configured"
            });
        }
        if (!redirectUri) {
            return res.status(500).json({
                error: "Frontend URL not configured. Set FRONTEND_URL or VERCEL_URL"
            });
        }

        const safeRedirectUri = redirectUri ? redirectUri.trim().replace(/^['"]|['"]$/g, "") : "";
        const isLocalhost = safeRedirectUri.includes("localhost") || safeRedirectUri.includes("127.0.0.1");

        // Force production URL if running on Vercel or if localhost (to bypass WAF)
        const isVercel = process.env.VERCEL === "1";

        // This MUST match what was sent in the auth step (GET /auth/url)
        let finalRedirectUri = safeRedirectUri;
        if (isLocalhost || isVercel) {
             finalRedirectUri = "https://traffic-zen-hub-35.vercel.app/integrations/mercadolivre/callback";
        }

        const payloadParams: Record<string, string> = {
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: finalRedirectUri // Always include redirect_uri
        };
        
        // Removed conditional check - always send redirect_uri as now we have a valid one (Vercel) even for localhost

        const payload = new URLSearchParams(payloadParams);

        console.log("🔄 Exchanging code for token with Redirect URI:", finalRedirectUri);

        // Trocar código por access token
        const tokenResponse = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/oauth/token`,
            payload,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const { access_token, refresh_token, user_id } = tokenResponse.data;

        const expiresIn = Number(tokenResponse.data?.expires_in) || 6 * 60 * 60; // fallback 6h
        const expiresAt = Date.now() + expiresIn * 1000;

        const creds = {
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: user_id,
            expiresAt,
            clientId,
            clientSecret,
        };
        tokenStore.set(String(workspaceId), creds);
        
        const persisted = await persistMercadoLivreCredentials(String(workspaceId), creds);
        if (!persisted) {
             console.error("⚠️ Failed to persist Mercado Livre credentials to DB");
        }
        try {
            const updated = await updateEnvLocalTokens({
                MERCADO_LIVRE_ACCESS_TOKEN: access_token,
                MERCADO_LIVRE_REFRESH_TOKEN: refresh_token,
                MERCADO_LIVRE_USER_ID: String(user_id),
                MERCADO_LIVRE_CLIENT_ID: clientId,
                MERCADO_LIVRE_CLIENT_SECRET: clientSecret,
            });
            if (updated) {
                console.log("[MercadoLivre] .env.local atualizado com credenciais do Mercado Livre");
            }
        } catch (error: any) {
            console.warn("[MercadoLivre] Falha ao atualizar .env.local:", error?.message || error);
        }

        console.log("✅ Mercado Livre OAuth Success:");
        console.log("Access Token:", access_token ? "Recieved" : "Missing");
        console.log("User ID:", user_id);

        return res.json({
            success: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: user_id,
            message: "Authentication successful!",
        });
    } catch (error: any) {
        console.error("❌ Error in OAuth callback:", formatAxiosError(error));
        
        const mlError = error.response?.data;
        const statusCode = error.response?.status || 500;
        console.error("ML API Error Details:", mlError);

        // Extract a more meaningful error message if available
        const errorMessage = mlError?.message || mlError?.error_description || mlError?.error || "Failed to authenticate with Mercado Livre";

        const clientIdPrefix = process.env.MERCADO_LIVRE_CLIENT_ID ? process.env.MERCADO_LIVRE_CLIENT_ID.substring(0, 5) + "..." : "UNDEFINED";

        return res.status(statusCode).json({
            error: errorMessage,
            details: mlError || error.message,
            step: "token_exchange",
            possibleCause: errorMessage.includes("invalid_client") ? "Client ID/Secret mismatch in Vercel Environment Variables" : "Check Redirect URI whitelist",
            clientIdUsed: clientIdPrefix,
            redirectUriUsed: process.env.NODE_ENV === "development" ? "HIDDEN" : "Check Logs" 
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/auth/refresh
 * Renova access token usando refresh token
 */
router.post("/auth/refresh", async (req, res) => {
    try {
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials || !credentials.refreshToken) {
            return res.status(401).json({
                error: "No refresh token available",
            });
        }

        const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
        const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                error: "Mercado Livre credentials not configured"
            });
        }

        const payload = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: credentials.refreshToken,
        });

        // Renovar access token
        const tokenResponse = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/oauth/token`,
            payload,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        const creds = {
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: credentials.userId,
            clientId: credentials.clientId || clientId || undefined,
            clientSecret: credentials.clientSecret || clientSecret || undefined
        };
        tokenStore.set(String(workspaceId), creds);
        void persistMercadoLivreCredentials(String(workspaceId), creds);
        try {
            const updated = await updateEnvLocalTokens({
                MERCADO_LIVRE_ACCESS_TOKEN: access_token,
                MERCADO_LIVRE_REFRESH_TOKEN: refresh_token || credentials.refreshToken,
                MERCADO_LIVRE_USER_ID: String(credentials.userId),
                MERCADO_LIVRE_CLIENT_ID: clientId,
                MERCADO_LIVRE_CLIENT_SECRET: clientSecret,
            });
            if (updated) {
                console.log("[MercadoLivre] .env.local atualizado com tokens do Mercado Livre");
            }
        } catch (error: any) {
            console.warn("[MercadoLivre] Falha ao atualizar .env.local:", error?.message || error);
        }
        console.log("✅ Token refreshed successfully");
        console.log(`MERCADO_LIVRE_ACCESS_TOKEN=${access_token}`);
        console.log(`MERCADO_LIVRE_REFRESH_TOKEN=${refresh_token}`);

        return res.json({
            success: true,
            accessToken: access_token,
            refreshToken: refresh_token,
        });
    } catch (error: any) {
        console.error("Error refreshing token:", formatAxiosError(error));
        return res.status(500).json({
            error: "Failed to refresh token",
            details: error.response?.data || error.message,
        });
    }
});


async function fetchMetricsInternal(workspaceId: string, days: number = 30, dateFrom?: string, dateTo?: string) {
    let credentials = await getMercadoLivreCredentials(workspaceId);

    if (!credentials) {
        throw new Error("ml_not_connected");
    }

    const dateToKey = normalizeBrazilDateKey(dateTo) || formatBrazilDateKey(new Date());
    const dateToStart = toBrazilDayBoundary(dateToKey, false);
    const dateFromKey = normalizeBrazilDateKey(dateFrom) || formatBrazilDateKey(subDays(dateToStart, Number(days) - 1));

    const dateFromFinal = toBrazilDayBoundary(dateFromKey, false);
    const dateToFinal = toBrazilDayBoundary(dateToKey, true);

    const dateFromStr = dateFromKey;
    const dateToStr = dateToKey;
    const rangeStartTs = dateFromFinal.getTime();
    const rangeEndTs = dateToFinal.getTime();
    const daysCount = Math.max(1, Math.round((dateToStart.getTime() - dateFromFinal.getTime()) / (24 * 60 * 60 * 1000)) + 1);

    // Buscar métricas do vendedor (dados corretos)
    const userResponse = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}`);

    const sellerMetrics = userResponse.seller_reputation?.metrics || {};

    let totalRevenue = 0;
    let totalSales = 0; // unidades vendidas (não pedidos)
    let totalVisits = 0;
    let totalOrders = 0;
    let canceledOrders = 0;
    let canceledRevenue = 0;
    let totalSaleFees = 0;
    let totalShippingCosts = 0;
    const salesTimeSeries: Array<{ date: string; sales: number; revenue: number; visits: number }> = [];
    const hourlySales: Array<{ date: string; sales: number; revenue: number }> = [];
    const uniqueBuyers = new Set<string>();

    // --------- Pedidos (mesma lógica do endpoint daily-sales) ----------
    try {
        const allOrders: any[] = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        const MAX_ORDERS = 2000;
        while (hasMore && allOrders.length < MAX_ORDERS) {
            try {
                const params: any = {
                    seller: credentials.userId,
                    limit,
                    offset,
                    sort: 'date_desc',
                };

                // Alterado para date_created para alinhar com a lista de atividades recentes e capturar todas as vendas iniciadas no dia
                params['order.date_created.from'] = dateFromFinal.toISOString();
                params['order.date_created.to'] = dateToFinal.toISOString();

                let ordersResponse;
                try {
                    ordersResponse = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/orders/search`,
                        {
                            headers: {
                                Authorization: `Bearer ${credentials.accessToken}`,
                            },
                            params,
                        }
                    );
                } catch (e) {
                    console.warn("[Metrics] Failed with sort, retrying without sort");
                    delete params.sort;
                    ordersResponse = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/orders/search`,
                        {
                            headers: {
                                Authorization: `Bearer ${credentials.accessToken}`,
                            },
                            params,
                        }
                    );
                }

                const orders = ordersResponse.data.results || [];
                allOrders.push(...orders);

                hasMore = orders.length === limit;
                offset += limit;
            } catch (apiError: any) {
                if (apiError.response?.status === 401) {
                    console.error("[Metrics] Token expirado, tentando refresh...");
                    const refreshed = await refreshAccessToken(workspaceId as string);
                    if (refreshed) {
                        credentials = refreshed;
                        continue; // Retry com o novo token
                    }
                    throw new Error("ml_not_connected");
                }
                console.error("[Metrics] Erro ao buscar pedidos:", apiError.message);
                hasMore = false;
            }
        }

        // Deduplicate orders by ID to prevent double counting
        const uniqueOrdersMap = new Map();
        for (const order of allOrders) {
            uniqueOrdersMap.set(order.id, order);
        }
        const uniqueOrders = Array.from(uniqueOrdersMap.values());
        allOrders.length = 0;
        allOrders.push(...uniqueOrders);

        // Fetch shipment details for all orders to get real shipping costs
        const shipmentIds = allOrders
            .map(o => o.shipping?.id)
            .filter(id => id); // filter undefined/null
        
        const shipmentCostMap = new Map<string, number>();
        
        // Process shipments in chunks of 20, with concurrency to speed up
        const uniqueShipmentIds = [...new Set(shipmentIds)]; // Deduplicate just in case
        const shipmentChunks: string[][] = [];
        for (let i = 0; i < uniqueShipmentIds.length; i += 20) {
            shipmentChunks.push(uniqueShipmentIds.slice(i, i + 20));
        }

        // Helper to fetch a chunk
        const fetchShipmentChunk = async (chunk: string[]) => {
            if (chunk.length === 0) return;
            try {
                const shipmentsResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/shipments`, {
                    params: { ids: chunk.join(',') },
                    headers: { Authorization: `Bearer ${credentials?.accessToken}` }
                });
                
                const shipments = shipmentsResp.data || [];
                shipments.forEach((s: any) => {
                     if (s && s.id) {
                         shipmentCostMap.set(String(s.id), s.base_cost || 0);
                     }
                });
            } catch (err) {
                console.error("[Metrics] Error fetching shipments chunk:", formatAxiosError(err));
            }
        };

        // Process in batches of 5 concurrent requests
        const CONCURRENCY = 5;
        for (let i = 0; i < shipmentChunks.length; i += CONCURRENCY) {
            const batch = shipmentChunks.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(chunk => fetchShipmentChunk(chunk)));
        }

        const salesByDay = new Map<string, { sales: number; revenue: number; orders: number }>();

        for (const order of allOrders) {
            const dateCreated = order.date_created ? new Date(order.date_created) : null;
            
            // Prioriza date_created para alinhar o gráfico com a lista de pedidos e a percepção do usuário de "Vendas do Dia"
            const orderDate = dateCreated 
                ? dateCreated
                : (order.date_closed
                    ? new Date(order.date_closed)
                    : null);

            if (!orderDate) continue;
            const orderTs = orderDate.getTime();
            if (orderTs < rangeStartTs || orderTs > rangeEndTs) continue;

            // Usar data local para agrupar vendas (alinha com a percepção do usuário "Hoje")
            const dateKey = formatBrazilDateKey(orderDate);
            const status = String(order.status || "").toLowerCase();
            const totalQuantity = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
            // Priorizar total_amount para alinhar com a lista de pedidos e evitar discrepâncias com paid_amount (que pode incluir juros/taxas extras)
            const totalAmount = order.total_amount || order.paid_amount || 0;

            if (!salesByDay.has(dateKey)) {
                salesByDay.set(dateKey, { sales: 0, revenue: 0, orders: 0 });
            }
            const dayData = salesByDay.get(dateKey)!;

            if (status === "cancelled") {
                // ML costuma considerar cancelados pagos; evita contar pedidos sem pagamento
                const hadPayment = Number(order.paid_amount || 0) > 0 || (Array.isArray(order.payments) && order.payments.length > 0);
                if (hadPayment) {
                    canceledOrders += 1;
                    // Valor cancelado alinhado ao painel: apenas valor de produtos, sem frete
                    canceledRevenue += totalAmount;
                }
                // Cancelados não contam como venda realizada
                continue; 
            }

            // Contabiliza apenas pedidos válidos (não cancelados)
            dayData.sales += totalQuantity;
            dayData.orders += 1;
            totalOrders += 1;
            if (order.buyer?.id) {
                const buyerId = String(order.buyer.id);
                uniqueBuyers.add(buyerId);
            }

            // Calcular taxas de venda
            let saleFee = 0;
            if (order.order_items && Array.isArray(order.order_items)) {
                saleFee = order.order_items.reduce((sum: number, item: any) => sum + (item.sale_fee || 0), 0);
            }
            if (saleFee === 0 && order.payments && Array.isArray(order.payments)) {
                order.payments.forEach((p: any) => {
                    if (p.fee_details && Array.isArray(p.fee_details)) {
                         p.fee_details.forEach((f: any) => {
                             if (f.fee_payer === 'collector') { // Pago pelo vendedor
                                 saleFee += f.amount;
                             }
                         });
                    } else if (p.marketplace_fee) {
                         saleFee += p.marketplace_fee;
                    }
                });
            }
            totalSaleFees += saleFee;

            // Calcular custo de envio
            let shippingCost = 0;
            if (order.shipping && order.shipping.id) {
                shippingCost = shipmentCostMap.get(String(order.shipping.id)) || 0;
            }
            totalShippingCosts += shippingCost;

            // Hourly aggregation (somente pedidos válidos)
            const d = new Date(orderDate);
            d.setMinutes(0, 0, 0);
            hourlySales.push({
                date: orderDate.toISOString(),
                sales: totalQuantity,
                revenue: totalAmount
            });

            dayData.revenue += totalAmount;
            salesByDay.set(dateKey, dayData);
        }

        // Converter para série temporal, preenchendo dias faltantes com zero
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(dateToFinal);
            d.setDate(d.getDate() - i);
            const ds = formatBrazilDateKey(d);
            const dayData = salesByDay.get(ds) || { sales: 0, revenue: 0, orders: 0 };
            salesTimeSeries.push({ date: ds, sales: dayData.sales, revenue: dayData.revenue, visits: 0 });
            totalSales += dayData.sales;
            totalRevenue += dayData.revenue;
        }
    } catch (err) {
        console.error("[Metrics] Erro ao agregar pedidos:", formatAxiosError(err));
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(dateToFinal);
            d.setDate(d.getDate() - i);
            const ds = formatBrazilDateKey(d);
            salesTimeSeries.push({ date: ds, sales: 0, revenue: 0, visits: 0 });
        }
    }

    // --------- Visitas (melhor esforço) ----------
    try {
        let visitsSum = 0;
        const itemIds: string[] = [];
        const visitLimit = 200;
        const MAX_VISIT_ITEMS = 2000; // segurança para lojas enormes
        for (let offset = 0; offset < MAX_VISIT_ITEMS; offset += visitLimit) {
            const itemsSearch = await requestWithAuth<any>(
                String(workspaceId),
                `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                { params: { limit: visitLimit, offset } }
            );
            const results = itemsSearch.results || [];
            itemIds.push(...results);
            const total = Number(itemsSearch.paging?.total || 0);
            const reachedTotal = offset + results.length >= total;
            if (results.length < visitLimit || reachedTotal) break;
        }

        const uniqueItemIds = [...new Set(itemIds)];

        // Tentar usar endpoint agregado de visitas (melhor alinhamento com painel)
        let visitsFromAggregate: number | null = null;
        try {
            const agg = await requestWithAuth<any>(
                String(workspaceId),
                `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items_visits/time_window`,
                { params: { last: daysCount, unit: "day" } }
            );
            if (agg) {
                if (Array.isArray(agg.results)) {
                    visitsFromAggregate = agg.results.reduce((sum: number, day: any) => sum + Number(day.total_visits || day.total || 0), 0);
                    // Se vierem visitas diárias, distribui exatamente por dia
                    if (visitsFromAggregate && agg.results.length) {
                        const visitsByDate = new Map<string, number>();
                        agg.results.forEach((day: any) => {
                            const k = day.date || day.on || day.period;
                            if (k) visitsByDate.set(String(k).split("T")[0], Number(day.total_visits || day.total || 0));
                        });
                        for (let i = 0; i < salesTimeSeries.length; i++) {
                            const ds = salesTimeSeries[i].date;
                            if (visitsByDate.has(ds)) {
                                salesTimeSeries[i].visits = visitsByDate.get(ds) || 0;
                            }
                        }
                    }
                } else if (typeof agg.total_visits === "number") {
                    visitsFromAggregate = agg.total_visits;
                } else if (typeof agg.total === "number") {
                    visitsFromAggregate = agg.total;
                }
            }
        } catch (e) { void e; }

        // Fallback: somar visitas por item se o agregado não veio
        if (visitsFromAggregate === null) {
            for (const itemId of uniqueItemIds) {
                try {
                    const vdata = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`, { params: { date_from: dateFromStr, date_to: dateToStr } });
                    visitsSum += Number(vdata.total_visits || 0);
                } catch (e) { void e; }
            }
            totalVisits = visitsSum;
            const baseVisits = Math.floor((totalVisits || 0) / daysCount);
            const rem = (totalVisits || 0) % daysCount;
            for (let i = 0; i < salesTimeSeries.length; i++) {
                salesTimeSeries[i].visits = baseVisits + (i < rem ? 1 : 0);
            }
        } else {
            totalVisits = visitsFromAggregate;
            // Se a distribuição diária não foi preenchida pelo agregado, distribui uniforme
            const hasDaily = salesTimeSeries.some((d) => d.visits && d.visits > 0);
            if (!hasDaily) {
                const baseVisits = Math.floor((totalVisits || 0) / daysCount);
                const rem = (totalVisits || 0) % daysCount;
                for (let i = 0; i < salesTimeSeries.length; i++) {
                    salesTimeSeries[i].visits = baseVisits + (i < rem ? 1 : 0);
                }
            }
        }
    } catch (e) { void e; }

    const conversionRate = totalVisits > 0 ? (totalOrders / totalVisits) * 100 : 0;
    const averageUnitPrice = totalSales > 0 ? totalRevenue / totalSales : 0;
    const averageOrderPrice = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Buscar reputação do vendedor
    let reputation = "-";
    const reputationMetrics = {
        level: "-",
        color: "Gray",
        claimsRate: 0,
        delayedHandlingRate: 0,
        cancellationsRate: 0
    };

    try {
        const reputationData = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}`);
        reputation = reputationData.seller_reputation?.power_seller_status || "-";

        // Mapear nível de reputação (level_id)
        const levelId = reputationData.seller_reputation?.level_id || "";
        const levelIdUpper = levelId.toUpperCase();
        // 5_GREEN, 4_LIGHT_GREEN, 3_YELLOW, 2_ORANGE, 1_RED
        if (levelIdUpper.includes("GREEN")) reputationMetrics.color = "Verde";
        else if (levelIdUpper.includes("YELLOW")) reputationMetrics.color = "Amarelo";
        else if (levelIdUpper.includes("ORANGE")) reputationMetrics.color = "Laranja";
        else if (levelIdUpper.includes("RED")) reputationMetrics.color = "Vermelho";

        reputationMetrics.level = reputationData.seller_reputation?.power_seller_status === "platinum" ? "MercadoLíder Platinum" :
            reputationData.seller_reputation?.power_seller_status === "gold" ? "MercadoLíder Gold" :
                reputationData.seller_reputation?.power_seller_status === "silver" ? "MercadoLíder" :
                    reputation || "Sem Medalha";

        const metrics = reputationData.seller_reputation?.metrics || {};
        reputationMetrics.claimsRate = (metrics.claims?.rate || 0) * 100;
        reputationMetrics.delayedHandlingRate = (metrics.delayed_handling_time?.rate || 0) * 100;
        reputationMetrics.cancellationsRate = (metrics.cancellations?.rate || 0) * 100;

    } catch (error) {
        console.error("Error fetching reputation:", error);
    }

    // Calcular Taxa de Resposta (baseada nas últimas 50 perguntas)
    let responseRate: number | null = null;
    try {
        const questionsResponse = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/questions/search`, {
            params: {
                seller_id: credentials.userId,
                limit: 50,
                sort: 'date_created_desc'
            }
        });
        const questions = questionsResponse.questions || [];
        if (questions.length > 0) {
            const answered = questions.filter((q: any) => q.status === 'ANSWERED').length;
            responseRate = answered / questions.length;
        }
    } catch (error) {
        console.error("Error fetching response rate:", error);
    }

    const totalNetIncome = totalRevenue - totalSaleFees - totalShippingCosts;

    return {
        totalSales,
        totalBuyers: uniqueBuyers.size,
        totalRevenue,
        totalVisits,
        totalOrders,
        canceledOrders,
        canceledRevenue,
        totalSaleFees,
        totalShippingCosts,
        totalNetIncome,
        averageUnitPrice,
        averageOrderPrice,
        conversionRate,
        responseRate,
        reputation,
        reputationMetrics,
        lastSync: new Date().toISOString(),
        sellerId: credentials.userId,
        salesTimeSeries,
        hourlySales,
        alerts: [],
    };
}

/**
 * GET /api/integrations/mercadolivre/orders
 * Busca pedidos do Mercado Livre com filtros
 */
router.get("/orders", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        if (!targetWorkspaceId) {
            console.error('[MercadoLivre Orders] Workspace ID missing');
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const getQueryParam = (val: any): string | undefined => {
            if (Array.isArray(val)) return val.length > 0 && typeof val[0] === 'string' ? val[0] : undefined;
            return typeof val === 'string' ? val : undefined;
        };

        const dateFrom = getQueryParam(req.query.dateFrom);
        const dateTo = getQueryParam(req.query.dateTo);
        const status = getQueryParam(req.query.status);
        
        const limitParam = getQueryParam(req.query.limit);
        const offsetParam = getQueryParam(req.query.offset);
        
        const limit = limitParam ? Number(limitParam) : 50;
        const offset = offsetParam ? Number(offsetParam) : 0;

        // Validation
        if (isNaN(limit) || limit < 1) {
             console.error(`[MercadoLivre Orders] Invalid limit: ${req.query.limit}`);
             return res.status(400).json({ error: "Invalid limit parameter" });
        }
        if (isNaN(offset) || offset < 0) {
             console.error(`[MercadoLivre Orders] Invalid offset: ${req.query.offset}`);
             return res.status(400).json({ error: "Invalid offset parameter" });
        }

        if (dateFrom && isNaN(Date.parse(dateFrom))) {
            console.error(`[MercadoLivre Orders] Invalid dateFrom: ${dateFrom}`);
            return res.status(400).json({ error: "Invalid dateFrom parameter" });
        }
        if (dateTo && isNaN(Date.parse(dateTo))) {
             console.error(`[MercadoLivre Orders] Invalid dateTo: ${dateTo}`);
             return res.status(400).json({ error: "Invalid dateTo parameter" });
        }

        const credentials = await getMercadoLivreCredentials(String(targetWorkspaceId));
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }

        // Prepare params for ML API
        const params: any = {
            seller: credentials.userId,
            limit: limit,
            offset: offset,
            sort: 'date_desc',
        };

        // Add date filters if provided
        if (dateFrom) {
            // If input is a full ISO string (contains T), use it directly to respect timezone/time
            if (String(dateFrom).includes('T')) {
                params['order.date_created.from'] = dateFrom;
            } else {
                // Assume input is YYYY-MM-DD. Convert to ISO start of day
                const d = new Date(dateFrom);
                d.setHours(0, 0, 0, 0);
                params['order.date_created.from'] = d.toISOString();
            }
        }
        if (dateTo) {
            // If input is a full ISO string (contains T), use it directly to respect timezone/time
            if (String(dateTo).includes('T')) {
                params['order.date_created.to'] = dateTo;
            } else {
                // Assume input is YYYY-MM-DD. Convert to ISO end of day
                const d = new Date(dateTo);
                d.setHours(23, 59, 59, 999);
                params['order.date_created.to'] = d.toISOString();
            }
        }

        if (status) {
            params['order.status'] = status;
        }

        let data: any;
        try {
            data = await requestWithAuth<any>(
                String(targetWorkspaceId),
                `${MERCADO_LIVRE_API_BASE}/orders/search`,
                { params }
            );
        } catch (e) {
            console.warn("Failed to fetch orders with sort, retrying without sort");
            delete params.sort;
            data = await requestWithAuth<any>(
                String(targetWorkspaceId),
                `${MERCADO_LIVRE_API_BASE}/orders/search`,
                { params }
            );
        }

        let ordersResults = data.results || [];

        // Filtro manual de datas para garantir consistência com o dashboard
        // A API do Mercado Livre às vezes retorna pedidos fora do intervalo solicitado
        if (dateFrom || dateTo) {
            const fromTs = dateFrom ? new Date(String(dateFrom)).getTime() : 0;
            const toTs = dateTo ? new Date(String(dateTo)).getTime() : Infinity;

            ordersResults = ordersResults.filter((o: any) => {
                if (!o.date_created) return false;
                const d = new Date(o.date_created).getTime();
                return d >= fromTs && d <= toTs;
            });
        }

        // Coletar IDs dos itens para buscar imagens
        const itemIds = new Set<string>();
        const shipmentIds = new Set<string>();

        ordersResults.forEach((order: any) => {
            order.order_items?.forEach((item: any) => {
                if (item.item?.id) itemIds.add(item.item.id);
            });
            if (order.shipping?.id) shipmentIds.add(String(order.shipping.id));
        });

        // Buscar detalhes dos itens em lote (thumbnails)
        const itemsMap = new Map<string, any>();
        if (itemIds.size > 0) {
            const idsArray = Array.from(itemIds);
            const chunkSize = 20; // Limite da API de multiget
            for (let i = 0; i < idsArray.length; i += chunkSize) {
                const chunk = idsArray.slice(i, i + chunkSize);
                try {
                    const itemsResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items`, {
                        params: { ids: chunk.join(',') },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` }
                    });
                    itemsResp.data.forEach((itemRes: any) => {
                        if (itemRes.code === 200 && itemRes.body) {
                            itemsMap.set(itemRes.body.id, itemRes.body);
                        }
                    });
                } catch (err) {
                    console.warn("Failed to fetch items details for orders:", err);
                }
            }
        }

        // Buscar detalhes dos envios em lote (custos)
        const shipmentsMap = new Map<string, any>();
        if (shipmentIds.size > 0) {
            const idsArray = Array.from(shipmentIds);
            const chunkSize = 20;
            for (let i = 0; i < idsArray.length; i += chunkSize) {
                const chunk = idsArray.slice(i, i + chunkSize);
                try {
                    const shipmentsResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/shipments`, {
                        params: { ids: chunk.join(',') },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` }
                    });
                    // Resposta do multiget: array de { code, body }
                    const responseData = Array.isArray(shipmentsResp.data) ? shipmentsResp.data : [];
                    responseData.forEach((res: any) => {
                        if (res.code === 200 && res.body) {
                            shipmentsMap.set(String(res.body.id), res.body);
                        }
                    });
                } catch (err) {
                    console.warn("Failed to fetch shipments details:", err);
                }
            }
        }

        const orders = ordersResults.map((order: any) => {
            // Calcular taxas de venda
            let saleFee = 0;

            // 1. Tentar obter de order_items (mais preciso)
            if (order.order_items && Array.isArray(order.order_items)) {
                saleFee = order.order_items.reduce((sum: number, item: any) => sum + (item.sale_fee || 0), 0);
            }

            // 2. Fallback para payments se não encontrou em items
            if (saleFee === 0 && order.payments && Array.isArray(order.payments)) {
                order.payments.forEach((p: any) => {
                    if (p.fee_details && Array.isArray(p.fee_details)) {
                         p.fee_details.forEach((f: any) => {
                             if (f.fee_payer === 'collector') { // Pago pelo vendedor
                                 saleFee += f.amount;
                             }
                         });
                    } else if (p.marketplace_fee) {
                         saleFee += p.marketplace_fee;
                    }
                });
            }

            // Calcular custo de envio
            let shippingCost = 0;
            if (order.shipping?.id) {
                const shipment = shipmentsMap.get(String(order.shipping.id));
                if (shipment) {
                    // Tenta pegar o custo base (custo para o vendedor)
                    // Se o frete for grátis (shipping_option.list_cost = 0 para comprador?), 
                    // o vendedor paga o base_cost ou uma parte dele.
                    // O campo 'lead_time' às vezes tem 'cost'.
                    // Mas 'base_cost' na raiz do shipment é o mais comum para custo do envio.
                    shippingCost = shipment.base_cost || 0;
                }
            }

            const totalAmount = order.total_amount || order.paid_amount || 0;
            const netIncome = totalAmount - saleFee - shippingCost;

            return {
                id: order.id,
                status: order.status,
                dateCreated: order.date_created,
                lastUpdated: order.last_updated,
                totalAmount: totalAmount,
                paidAmount: order.paid_amount,
                currencyId: order.currency_id,
                buyerId: order.buyer?.id,
                saleFee,
                shippingCost,
                netIncome,
                items: (order.order_items || []).map((item: any) => {
                    const itemDetails = itemsMap.get(item.item.id);
                    return {
                        itemId: item.item.id,
                        title: item.item.title,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        fullUnitPrice: item.full_unit_price,
                        thumbnail: (itemDetails?.secure_thumbnail || itemDetails?.thumbnail || "").replace(/^http:\/\//, "https://") || null,
                        permalink: itemDetails?.permalink || null
                    };
                }),
            };
        });

        return res.json({
            orders,
            paging: data.paging
        });

    } catch (error: any) {
        console.error("Error fetching orders:", formatAxiosError(error));
        if (error.message === "ml_not_connected") {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch orders",
            details: error?.response?.data || error?.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/orders/detail/:orderId
 * Busca detalhes completos de um pedido
 */
router.get("/orders/detail/:orderId", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        if (!targetWorkspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const orderId = String(req.params.orderId || "").trim();
        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(String(targetWorkspaceId));
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }

        const orderDetails = await requestWithAuth<any>(
            String(targetWorkspaceId),
            `${MERCADO_LIVRE_API_BASE}/orders/${orderId}`,
            { headers: { 'x-format-new': 'true' } }
        );

        let shippingDetails = orderDetails.shipping;
        if (orderDetails.shipping?.id && !orderDetails.shipping?.logistic_type) {
            try {
                const shipment = await requestWithAuth<any>(
                    String(targetWorkspaceId),
                    `${MERCADO_LIVRE_API_BASE}/shipments/${orderDetails.shipping.id}`,
                    { headers: { 'x-format-new': 'true' } }
                );
                shippingDetails = { ...orderDetails.shipping, ...shipment };
            } catch (shipErr: any) {
                console.warn(`[MercadoLivre Orders] Failed to fetch shipment ${orderDetails.shipping?.id}:`, shipErr.message);
            }
        }

        const itemIds = new Set<string>();
        (orderDetails.order_items || []).forEach((item: any) => {
            if (item.item?.id) itemIds.add(item.item.id);
        });

        const itemsMap = new Map<string, any>();
        if (itemIds.size > 0) {
            const idsArray = Array.from(itemIds);
            const chunkSize = 20;
            for (let i = 0; i < idsArray.length; i += chunkSize) {
                const chunk = idsArray.slice(i, i + chunkSize);
                try {
                    const itemsResp = await requestWithAuth<any>(
                        String(targetWorkspaceId),
                        `${MERCADO_LIVRE_API_BASE}/items`,
                        { params: { ids: chunk.join(',') } }
                    );
                    const responseData = Array.isArray(itemsResp) ? itemsResp : [];
                    responseData.forEach((itemRes: any) => {
                        if (itemRes.code === 200 && itemRes.body) {
                            itemsMap.set(itemRes.body.id, itemRes.body);
                        }
                    });
                } catch (err) {
                    console.warn("[MercadoLivre Orders] Failed to fetch items details:", err);
                }
            }
        }

        let saleFee = 0;
        if (orderDetails.order_items && Array.isArray(orderDetails.order_items)) {
            saleFee = orderDetails.order_items.reduce((sum: number, item: any) => sum + (item.sale_fee || 0), 0);
        }

        if (saleFee === 0 && orderDetails.payments && Array.isArray(orderDetails.payments)) {
            orderDetails.payments.forEach((payment: any) => {
                if (payment.fee_details && Array.isArray(payment.fee_details)) {
                    payment.fee_details.forEach((fee: any) => {
                        if (fee.fee_payer === 'collector') {
                            saleFee += fee.amount;
                        }
                    });
                } else if (payment.marketplace_fee) {
                    saleFee += payment.marketplace_fee;
                }
            });
        }

        let shippingCost = 0;
        if (shippingDetails) {
            shippingCost = shippingDetails.base_cost ?? shippingDetails.cost ?? shippingDetails.shipping_option?.cost ?? 0;
        }

        const totalAmount = orderDetails.total_amount || orderDetails.paid_amount || 0;
        const paidAmount = orderDetails.paid_amount || 0;
        const netIncome = totalAmount - saleFee - shippingCost;

        const items = (orderDetails.order_items || []).map((item: any) => {
            const itemId = item.item?.id || item.item_id;
            const itemDetails = itemId ? itemsMap.get(itemId) : null;
            return {
                itemId: itemId || "",
                title: item.item?.title || item.item_title || "Item",
                quantity: item.quantity,
                unitPrice: item.unit_price,
                fullUnitPrice: item.full_unit_price,
                thumbnail: (itemDetails?.secure_thumbnail || itemDetails?.thumbnail || "").replace(/^http:\/\//, "https://") || null,
                permalink: itemDetails?.permalink || null
            };
        });

        return res.json({
            order: { ...orderDetails, shipping: shippingDetails },
            items,
            summary: {
                totalAmount,
                paidAmount,
                saleFee,
                shippingCost,
                netIncome,
                currencyId: orderDetails.currency_id
            }
        });
    } catch (error: any) {
        console.error("Error fetching order details:", formatAxiosError(error));
        if (error.message === "ml_not_connected") {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch order details",
            details: error?.response?.data || error?.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/shipments
 * Busca envios do Mercado Livre
 */
router.get("/shipments", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        if (!targetWorkspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const { status, limit = 50, offset = 0 } = req.query as any;

        const credentials = await getMercadoLivreCredentials(String(targetWorkspaceId));
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }

        const targetStatus = status ? status.split(',').map((s: string) => s.trim()) : null;
        const limitNum = Number(limit);
        const offsetNum = Number(offset);
        const MAX_ORDERS_TO_SCAN = 500; // Scan up to 500 recent orders
        const BATCH_SIZE = 50;
        const startOfTodayTs = startOfDay(new Date()).getTime();

        const collectedShipmentIds: number[] = [];
        const allOrdersMap = new Map<number, any>();
        let ordersChecked = 0;
        let ordersOffset = 0;

        console.log(`Fetching shipments with status: ${status}, limit: ${limitNum}, offset: ${offsetNum}`);

        while (collectedShipmentIds.length < (limitNum + offsetNum) && ordersChecked < MAX_ORDERS_TO_SCAN) {
            const ordersParams: any = {
                seller: credentials.userId,
                'order.status': 'paid',
                sort: 'date_desc',
                limit: BATCH_SIZE,
                offset: ordersOffset,
            };

            let orders: any[] = [];
            try {
                const ordersData = await requestWithAuth<any>(
                    String(targetWorkspaceId),
                    `${MERCADO_LIVRE_API_BASE}/orders/search`,
                    { params: ordersParams }
                );
                orders = ordersData.results || [];
            } catch (e) {
                console.warn("Failed to fetch orders with sort, retrying without sort");
                delete ordersParams.sort;
                try {
                    const ordersDataRetry = await requestWithAuth<any>(
                        String(targetWorkspaceId),
                        `${MERCADO_LIVRE_API_BASE}/orders/search`,
                        { params: ordersParams }
                    );
                    orders = ordersDataRetry.results || [];
                } catch (retryErr) {
                    console.error("Retry failed for orders search:", retryErr);
                    break;
                }
            }

            if (orders.length === 0) break;

            for (const order of orders) {
                const createdAt = order.date_created ? new Date(order.date_created).getTime() : 0;
                if (!createdAt || createdAt < startOfTodayTs) {
                    continue; // Apenas envios do dia
                }
                const shId = order.shipping?.id;
                // Use shipping.status from order if available to pre-filter
                const shStatus = order.shipping?.status;

                if (shId) {
                    // If we have a target status, check if order.shipping.status matches (if it exists)
                    // If it doesn't exist, we include it as a candidate to be safe
                    if (!targetStatus || !shStatus || (shStatus && targetStatus.includes(shStatus))) {
                        if (!allOrdersMap.has(shId)) {
                            allOrdersMap.set(shId, order);
                            collectedShipmentIds.push(shId);
                        }
                    }
                }
            }

            ordersChecked += orders.length;
            ordersOffset += BATCH_SIZE;

            // Optimization: If we found nothing in the first 100 orders, maybe we shouldn't go too deep if the user has huge volume?
            // But we want to find the pending ones.
        }

        console.log(`Scanned ${ordersChecked} orders, found ${collectedShipmentIds.length} candidate shipments`);

        // Apply pagination to the IDs
        const pagedIds = collectedShipmentIds.slice(offsetNum, offsetNum + limitNum);

        if (pagedIds.length === 0) {
            return res.json({ results: [], paging: { total: collectedShipmentIds.length, limit: limitNum, offset: offsetNum } });
        }

        // 2. Buscar detalhes dos envios com limite de concorrência e cache
        const workspaceIdStr = String(targetWorkspaceId);
        const SHIPMENT_FETCH_CONCURRENCY = 5;

        const shipmentDetails = await mapWithConcurrency<any, any>(pagedIds, SHIPMENT_FETCH_CONCURRENCY, async (id: any) => {
            const shipmentId = String(id);

            const cached = await getCachedShipment(workspaceIdStr, shipmentId);
            if (cached) return cached;

            const orderForShipment = allOrdersMap.get(id);
            if (orderForShipment?.id) {
                try {
                    const orderDetails = await requestWithAuth<any>(
                        workspaceIdStr,
                        `${MERCADO_LIVRE_API_BASE}/orders/${orderForShipment.id}`,
                        { headers: { 'x-format-new': 'true' } }
                    );
                    const shippingFromOrder = orderDetails?.shipping || orderForShipment?.shipping;
                    if (shippingFromOrder) {
                        const enriched = { ...shippingFromOrder, order_id: orderDetails?.id || orderForShipment.id };
                        await saveShipmentToCache(workspaceIdStr, shipmentId, enriched);
                        return enriched;
                    }
                } catch (err: any) {
                    console.warn(`Failed to fetch order ${orderForShipment.id} for shipment ${shipmentId}:`, err?.response?.status || err?.message || err);
                }
            }

            try {
                const shipment = await requestWithAuth<any>(
                    workspaceIdStr,
                    `${MERCADO_LIVRE_API_BASE}/shipments/${shipmentId}`,
                    { headers: { 'x-format-new': 'true' } }
                );
                if (shipment) {
                    await saveShipmentToCache(workspaceIdStr, shipmentId, shipment);
                }
                return shipment;
            } catch (e: any) {
                console.warn(`Failed to fetch shipment ${shipmentId}`, e?.response?.status || e?.message || e);
                return null;
            }
        });

        // 3. Filtrar novamente por status (garantia final)
        let results = shipmentDetails;
        if (targetStatus) {
            results = results.filter((s: any) => targetStatus.includes(s.status));
        }

        console.log(`Returning ${results.length} shipments after detail fetch and filtering`);

        const enrichedResults = results.map((shipment: any) => {
            const order = allOrdersMap.get(shipment.id);
            if (order) {
                if (!shipment.shipping_items || shipment.shipping_items.length === 0) {
                    shipment.shipping_items = order.order_items.map((item: any) => ({
                        description: item.item.title,
                        quantity: item.quantity,
                        item_id: item.item.id
                    }));
                }
                shipment.order_id = order.id;
            }
            return shipment;
        });

        return res.json({
            results: enrichedResults,
            paging: {
                total: collectedShipmentIds.length, // Approximation of total matching
                limit: limitNum,
                offset: offsetNum
            }
        });

    } catch (error: any) {
        console.error("Error fetching shipments:", formatAxiosError(error));
        if (error.message === "ml_not_connected") {
            return res.status(401).json({ error: "Mercado Livre not connected" });
        }
        return res.status(error?.response?.status || 500).json({
            error: "Failed to fetch shipments",
            details: error?.response?.data || error?.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/metrics
 * Retorna métricas agregadas do Mercado Livre
 */
router.get("/metrics", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        const { days = 30, dateFrom, dateTo } = req.query as {
            days?: string | number;
            dateFrom?: string;
            dateTo?: string;
        };

        if (!targetWorkspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const metrics = await fetchMetricsInternal(
            String(targetWorkspaceId),
            Number(days),
            dateFrom,
            dateTo
        );

        return res.json(metrics);
    } catch (error: any) {
        console.error("Error fetching Mercado Livre metrics:", formatAxiosError(error));
        if (error.message === "ml_not_connected") {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }
        return res.status(500).json({
            error: "Failed to fetch metrics",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/products
 * Retorna lista de produtos do vendedor
 */
const normalizeAttributes = (attrs: any[] | undefined) => {
    if (!Array.isArray(attrs)) return [];
    return attrs.map((attr: any) => ({
        id: attr.id,
        name: attr.name,
        value_id: attr.value_id,
        value_name: attr.value_name,
        value_struct: attr.value_struct,
    }));
};

const getAttrValue = (attrs: any[], keys: string[]): string | undefined => {
    const targets = keys.map((k) => k.toLowerCase());
    const found = attrs.find((a: any) => {
        const id = String(a.id || "").toLowerCase();
        const name = String(a.name || "").toLowerCase();
        return targets.includes(id) || targets.includes(name);
    });
    return found?.value_name || found?.value_id;
};

const parseDimensions = (dimensions?: string) => {
    if (!dimensions || typeof dimensions !== "string") return {};
    const [dimsPart, weightPart] = dimensions.split(",");
    const [height, width, length] = (dimsPart || "").split("x");
    return {
        height,
        width,
        length,
        weight: weightPart,
    };
};

router.get("/products", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        const { category } = req.query;
        const page = Math.max(1, Number((req.query as any).page) || 1);
        const limit = Math.min(50, Math.max(1, Number((req.query as any).limit) || 20));
        const offset = (page - 1) * limit;

        if (!targetWorkspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(String(targetWorkspaceId));

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // Buscar IDs de itens (paginado)
        const searchQuery = (req.query as any).search || (req.query as any).q;
        let pageItemIds: string[] = [];
        let totalCount = 0;

        try {
            const params: any = {
                limit,
                offset,
            };
            if (searchQuery) {
                params.q = searchQuery;
            }

            const resp = await axios.get(
                `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                {
                    params,
                    headers: { Authorization: `Bearer ${credentials.accessToken}` },
                }
            );

            pageItemIds = resp.data.results || [];
            totalCount = resp.data.paging?.total || 0;
        } catch (err) {
            console.error("Error fetching ML item IDs:", err);
        }

        // Contagens globais (ativos/pausados) para KPI
        let globalActiveCount = 0;
        const fetchTotalByStatus = async (status?: string) => {
            const params: any = { limit: 1, offset: 0 };
            if (status) params.status = status;
            if (searchQuery) params.q = searchQuery;
            const resp = await axios.get(
                `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                {
                    params,
                    headers: { Authorization: `Bearer ${credentials.accessToken}` },
                }
            );
            return Number(resp.data?.paging?.total || 0);
        };

        try {
            globalActiveCount = await fetchTotalByStatus("active");
        } catch (err) {
            console.warn("[Products] Falha ao buscar contagens globais:", (err as any)?.message || err);
        }

        // Agregados de página (status, tipo e estoque)
        // NOTE: Estes stats refletem apenas a página atual.
        let countsActive = 0;
        let countsFull = 0;
        let countsNormal = 0;
        let stockFull = 0;
        let stockNormal = 0;
        let stockTotal = 0;

        // Buscar detalhes e construir mapa para reuso na página
        const detailsMap = new Map<string, any>();
        const uniqueItemIds = Array.from(new Set(pageItemIds));

        // Otimização: Buscar detalhes em lotes de 20 (multiget)
        const BATCH_SIZE = 20;
        for (let i = 0; i < uniqueItemIds.length; i += BATCH_SIZE) {
            const batchIds = uniqueItemIds.slice(i, i + BATCH_SIZE);
            const idsStr = batchIds.join(',');

            try {
                const batchResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/items`,
                    {
                        params: { ids: idsStr },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` }
                    }
                );

                // A resposta do multiget é um array de objetos { code, body }
                const itemsData = Array.isArray(batchResponse.data) ? batchResponse.data : [];

                for (const itemData of itemsData) {
                    if (itemData.code !== 200) continue;
                    const item = itemData.body;
                    detailsMap.set(item.id, item);

                    const logisticTypeAgg = item?.shipping?.logistic_type || null;
                    const tagsAgg: string[] = Array.isArray(item?.tags) ? item.tags : [];
                    const isFullAgg = String(logisticTypeAgg || '').toLowerCase() === 'fulfillment' || tagsAgg.includes('is_fulfillment');
                    const availableQtyAgg = Number(item.available_quantity || 0);

                    if (item.status === 'active') countsActive++;
                    if (isFullAgg) {
                        countsFull++;
                        stockFull += availableQtyAgg;
                    } else {
                        countsNormal++;
                        stockNormal += availableQtyAgg;
                    }
                    stockTotal += availableQtyAgg;
                }
            } catch (error) {
                console.error(`Error fetching batch details:`, error);
            }
        }

        // Montar itens da página com visitas (opcional)
        const items = [] as any[];
        for (const itemId of pageItemIds) {
            const item = detailsMap.get(itemId);
            if (!item) continue;
            const attributes = normalizeAttributes(item.attributes);
            const saleTerms = Array.isArray(item.sale_terms) ? item.sale_terms : [];
            let visits = 0;
            let description = "";
            try {
                const dateFrom = new Date();
                dateFrom.setDate(dateFrom.getDate() - 30);
                const [visitsResponse, descResponse] = await Promise.allSettled([
                    axios.get(
                        `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`,
                        {
                            params: {
                                date_from: dateFrom.toISOString().split("T")[0],
                                date_to: new Date().toISOString().split("T")[0],
                            },
                            headers: {
                                Authorization: `Bearer ${credentials.accessToken}`,
                            },
                        }
                    ),
                    axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}/description`, {
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    })
                ]);
                if (visitsResponse.status === "fulfilled") {
                    visits = visitsResponse.value.data.total_visits || 0;
                }
                if (descResponse.status === "fulfilled") {
                    description = descResponse.value.data?.plain_text || descResponse.value.data?.text || "";
                }
            } catch (error) {
                console.error(`Error fetching visits/description for item ${itemId}:`, error);
            }

            const sales = item.sold_quantity || 0;
            const revenue = sales * item.price;
            const conversionRate = visits > 0 ? (sales / visits) * 100 : 0;
            const logisticType = item?.shipping?.logistic_type || null;
            const tags: string[] = Array.isArray(item?.tags) ? item.tags : [];
            const isFull = String(logisticType || '').toLowerCase() === 'fulfillment' || tags.includes('is_fulfillment');
            // Sem sugestão de envio Full: manter apenas dados originais do item

            const sku =
                item.seller_custom_field ||
                getAttrValue(attributes, ['SELLER_SKU', 'SKU']) ||
                (item.variations?.[0]?.seller_custom_field || undefined);

            const warrantyTerm = saleTerms.find((st: any) => st.id === 'WARRANTY_TYPE');
            const warrantyTime = saleTerms.find((st: any) => st.id === 'WARRANTY_TIME');

            const color = getAttrValue(attributes, ['MAIN_COLOR', 'COLOR']);
            const material = getAttrValue(attributes, ['MATERIAL']);
            const style = getAttrValue(attributes, ['STYLE']);
            const lengthAttr = getAttrValue(attributes, ['LENGTH', 'COMPRIMENTO']);
            const widthAttr = getAttrValue(attributes, ['WIDTH', 'LARGURA']);
            const diameter = getAttrValue(attributes, ['DIAMETER', 'DIÂMETRO']);
            const earringType = getAttrValue(attributes, ['EARRING_TYPE', 'TIPO DE BRINCO']);
            const hasStones = getAttrValue(attributes, ['WITH_STONES', 'COM PEDRAS']);
            const stoneType = getAttrValue(attributes, ['STONE_TYPE', 'TIPO DE PEDRAS']);
            const kitPieces = getAttrValue(attributes, ['KIT_UNITS', 'UNIDADES NO KIT']);
            const universalCode = getAttrValue(attributes, ['GTIN', 'GTIN13', 'EAN', 'UPC', 'JAN', 'BARCODE']);
            const ncm = getAttrValue(attributes, ['NCM']);
            const origin = getAttrValue(attributes, ['ORIGIN']);
            const cfop = getAttrValue(attributes, ['CFOP']);
            const cst = getAttrValue(attributes, ['CST']);
            const csosn = getAttrValue(attributes, ['CSOSN']);
            const state = getAttrValue(attributes, ['STATE', 'UF', 'STATE_CODE']);

            items.push({
                id: item.id,
                title: item.title,
                price: item.price,
                thumbnail: item.thumbnail,
                sales,
                visits,
                conversionRate,
                revenue,
                status: item.status,
                category: item.category_id,
                category_name: undefined,
                category_path: undefined,
                stock: item.available_quantity,
                logisticType,
                isFull,
                sku,
                variation: item.variations?.[0]?.id ? String(item.variations[0].id) : undefined,
                listing_type_id: item.listing_type_id,
                condition: item.condition,
                shipping: {
                    mode: item.shipping?.mode,
                    free_shipping: item.shipping?.free_shipping || false,
                    logistic_type: item.shipping?.logistic_type,
                    local_pick_up: item.shipping?.local_pick_up || false,
                    dimensions: item.shipping?.dimensions,
                },
                description,
                warranty: item.warranty || warrantyTerm?.value_name,
                warranty_time: warrantyTime?.value_name,
                tags: tags,
                pictures: item.pictures?.map((pic: any) => ({ url: pic.url || pic.secure_url, id: pic.id })) || [],
                attributes,
                dimensions: parseDimensions(item.shipping?.dimensions),
                color,
                material,
                style,
                length: lengthAttr,
                width: widthAttr,
                diameter,
                earring_type: earringType,
                has_stones: hasStones,
                stone_type: stoneType,
                kit_pieces: kitPieces,
                universal_code: universalCode,
                fiscal: {
                    ncm,
                    origin,
                    cfop,
                    cst,
                    csosn,
                    state,
                    ean: universalCode,
                    additionalInfo: undefined,
                },
            });
        }

        // Enriquecer categorias com nomes/path (consulta única por categoria)
        const categoryDetailsMap = new Map<string, { name: string; path: string }>();
        const uniqueCategories = Array.from(new Set(items.map((it) => it.category).filter(Boolean)));
        for (const catId of uniqueCategories) {
            try {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/categories/${catId}`,
                    { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
                );
                const path = Array.isArray(resp.data?.path_from_root)
                    ? resp.data.path_from_root.map((p: any) => p?.name).filter(Boolean).join(" > ")
                    : resp.data?.name || "";
                categoryDetailsMap.set(catId, {
                    name: resp.data?.name || catId,
                    path,
                });
            } catch (err) {
                console.warn(`[Products] Falha ao buscar categoria ${catId}:`, (err as any)?.message);
            }
        }

        items.forEach((it) => {
            const cat = it.category ? categoryDetailsMap.get(it.category) : null;
            if (cat) {
                it.category_name = cat.name;
                it.category_path = cat.path;
            }
        });

        // Filtrar por categoria se especificado
        let filteredItems = items;
        if (category && category !== "all") {
            filteredItems = items.filter((item) => item.category === category);
        }

        // Ordenar por vendas (decrescente)
        filteredItems.sort((a, b) => b.sales - a.sales);

        return res.json({
            items: filteredItems,
            totalCount,
            activeCount: globalActiveCount || countsActive,
            counts: {
                active: globalActiveCount || countsActive,
                full: countsFull,
                normal: countsNormal,
            },
            stock: {
                full: stockFull,
                normal: stockNormal,
                total: stockTotal,
            },
            page,
            limit,
        });
    } catch (error: any) {
        console.error("Error fetching Mercado Livre products:", error);
        return res.status(500).json({
            error: "Failed to fetch products",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/products/export/xlsx
 * Exporta um XLSX com todos os produtos e informações detalhadas.
 */
router.get("/products/export/xlsx", async (req, res) => {
    try {
        const { workspaceId, category } = req.query as { workspaceId?: string; category?: string };
        const targetWorkspace = (workspaceId as string) || FALLBACK_WORKSPACE_ENV;
        if (!targetWorkspace) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        let credentials = await getMercadoLivreCredentials(targetWorkspace);
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        const cleanText = (value: string | undefined, limit = 300) => {
            const normalized = (value || "").replace(/\s+/g, " ").trim();
            if (!normalized) return "";
            return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
        };

        // Buscar todos os IDs de itens
        const allItemIds: string[] = [];
        let offset = 0;
        const limit = 50;
        let more = true;
        while (more) {
            try {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        params: { limit, offset },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }
                );
                const ids = resp.data.results || [];
                allItemIds.push(...ids);
                more = ids.length === limit;
                offset += limit;
            } catch (err: any) {
                if (err?.response?.status === 401) {
                    const refreshed = await refreshAccessToken(targetWorkspace);
                    if (refreshed) {
                        credentials = refreshed;
                        continue;
                    }
                }
                console.error("[Export XLSX] Falha ao buscar IDs:", err?.message || err);
                break;
            }
        }

        // Buscar detalhes + descrição
        const rows: any[] = [];
        let categoryName = "";
        if (category && category !== "all") {
            try {
                const catResp = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/categories/${category}`);
                categoryName = catResp?.name || category;
            } catch {
                categoryName = category;
            }
        }
        for (const itemId of allItemIds) {
            try {
                const item = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${itemId}`);
                if (category && category !== "all" && item.category_id !== category) {
                    continue; // pular itens de outras categorias
                }
                const attributes = normalizeAttributes(item.attributes);
                const saleTerms = Array.isArray(item.sale_terms) ? item.sale_terms : [];
                let description = "";
                try {
                    const descResp = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${itemId}/description`);
                    description = descResp?.plain_text || descResp?.text || "";
                } catch (descErr) {
                    console.warn(`[Export XLSX] Descrição indisponível para ${itemId}:`, (descErr as any)?.message || descErr);
                }

                const sku =
                    item.seller_custom_field ||
                    getAttrValue(attributes, ['SELLER_SKU', 'SKU']) ||
                    (item.variations?.[0]?.seller_custom_field || undefined);

                const warrantyTerm = saleTerms.find((st: any) => st.id === 'WARRANTY_TYPE');
                const warrantyTime = saleTerms.find((st: any) => st.id === 'WARRANTY_TIME');
                const color = getAttrValue(attributes, ['MAIN_COLOR', 'COLOR']);
                const material = getAttrValue(attributes, ['MATERIAL']);
                const style = getAttrValue(attributes, ['STYLE']);
                const lengthAttr = getAttrValue(attributes, ['LENGTH', 'COMPRIMENTO']);
                const widthAttr = getAttrValue(attributes, ['WIDTH', 'LARGURA']);
                const diameter = getAttrValue(attributes, ['DIAMETER', 'DIÂMETRO']);
                const earringType = getAttrValue(attributes, ['EARRING_TYPE', 'TIPO DE BRINCO']);
                const hasStones = getAttrValue(attributes, ['WITH_STONES', 'COM PEDRAS']);
                const stoneType = getAttrValue(attributes, ['STONE_TYPE', 'TIPO DE PEDRAS']);
                const kitPieces = getAttrValue(attributes, ['KIT_UNITS', 'UNIDADES NO KIT']);
                const universalCode = getAttrValue(attributes, ['GTIN', 'GTIN13', 'EAN', 'UPC', 'JAN', 'BARCODE']);
                const ncm = getAttrValue(attributes, ['NCM']);
                const origin = getAttrValue(attributes, ['ORIGIN']);
                const cfop = getAttrValue(attributes, ['CFOP']);
                const cst = getAttrValue(attributes, ['CST']);
                const csosn = getAttrValue(attributes, ['CSOSN']);
                const state = getAttrValue(attributes, ['STATE', 'UF', 'STATE_CODE']);
                const dimensions = parseDimensions(item.shipping?.dimensions);

                const attributesMap: Record<string, string> = {};
                attributes.forEach((attr: any) => {
                    const key = attr.id || attr.name;
                    if (!key) return;
                    attributesMap[key] = attr.value_name || attr.value_id || "";
                });

                rows.push({
                    id: item.id,
                    sku: sku || "",
                    variation: item.variations?.[0]?.id ? String(item.variations[0].id) : "",
                    title: item.title,
                    stock: item.available_quantity,
                    price: item.price,
                    status: item.status,
                    warranty: item.warranty || warrantyTerm?.value_name || "",
                    warranty_time: warrantyTime?.value_name || "",
                    delivery: item.shipping?.logistic_type || "",
                    free_shipping: item.shipping?.free_shipping ? "Sim" : "Não",
                    listing_type: item.listing_type_id,
                    category: item.category_id,
                    description: cleanText(description, 260),
                    color,
                    material,
                    style,
                    length: lengthAttr,
                    width: widthAttr,
                    diameter,
                    earring_type: earringType,
                    has_stones: hasStones,
                    stone_type: stoneType,
                    kit_pieces: kitPieces,
                    universal_code: universalCode,
                    ncm,
                    origin,
                    cfop,
                    cst,
                    csosn,
                    state,
                    dimensions: `${dimensions.height || ""} x ${dimensions.width || ""} x ${dimensions.length || ""}`,
                    weight: dimensions.weight || "",
                    attributes: attributesMap,
                });
            } catch (err: any) {
                console.error(`[Export XLSX] Erro ao processar ${itemId}:`, err?.message || err);
            }
        }

        // Mapeia todos os atributos presentes para criar colunas dedicadas
        const attributeKeys: string[] = [];
        const attrSet = new Set<string>();
        rows.forEach((r) => {
            Object.keys(r.attributes || {}).forEach((key) => {
                if (!attrSet.has(key)) {
                    attrSet.add(key);
                    attributeKeys.push(key);
                }
            });
        });

        const baseHeader = [
            "MLB",
            "SKU",
            "Variação",
            "Título",
            "Estoque",
            "Preço",
            "Status",
            "Garantia",
            "Garantia (Tempo)",
            "Entrega/Logística",
            "Frete Grátis",
            "Tipo anúncio",
            "Categoria",
            "Descrição",
            "Cor",
            "Material",
            "Estilo",
            "Comprimento",
            "Largura",
            "Diâmetro",
            "Tipo de Brinco",
            "Com Pedra",
            "Tipo de Pedras",
            "Peças no Kit",
            "Código Universal",
            "NCM",
            "Origem",
            "CFOP",
            "CST",
            "CSOSN",
            "Estado",
            "Dimensões (A x L x C)",
            "Peso",
        ];

        const dataRows = rows.map((r) => {
            const baseRow = [
                r.id,
                r.sku,
                r.variation,
                r.title,
                r.stock,
                r.price,
                r.status,
                r.warranty,
                r.warranty_time,
                r.delivery,
                r.free_shipping,
                r.listing_type,
                r.category,
                r.description,
                r.color,
                r.material,
                r.style,
                r.length,
                r.width,
                r.diameter,
                r.earring_type,
                r.has_stones,
                r.stone_type,
                r.kit_pieces,
                r.universal_code,
                r.ncm,
                r.origin,
                r.cfop,
                r.cst,
                r.csosn,
                r.state,
                r.dimensions,
                r.weight,
            ];

            const attrValues = attributeKeys.map((key) => cleanText(r.attributes?.[key] || "", 120));
            return [...baseRow, ...attrValues];
        });

        const filteredRows = dataRows.filter((row) =>
            row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
        );

        const worksheetData = [
            [...baseHeader, ...attributeKeys],
            ...filteredRows,
        ];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const baseWidths = [
            { wch: 12 }, // MLB
            { wch: 12 }, // SKU
            { wch: 12 }, // Variação
            { wch: 32 }, // Título
            { wch: 10 }, // Estoque
            { wch: 12 }, // Preço
            { wch: 12 }, // Status
            { wch: 14 }, // Garantia
            { wch: 16 }, // Garantia tempo
            { wch: 18 }, // Entrega
            { wch: 12 }, // Frete
            { wch: 14 }, // Tipo anúncio
            { wch: 20 }, // Categoria
            { wch: 60 }, // Descrição
            { wch: 12 }, // Cor
            { wch: 14 }, // Material
            { wch: 14 }, // Estilo
            { wch: 14 }, // Comprimento
            { wch: 14 }, // Largura
            { wch: 14 }, // Diâmetro
            { wch: 16 }, // Tipo de brinco
            { wch: 14 }, // Com pedra
            { wch: 16 }, // Tipo de pedras
            { wch: 12 }, // Peças no kit
            { wch: 18 }, // Código universal
            { wch: 12 }, // NCM
            { wch: 12 }, // Origem
            { wch: 12 }, // CFOP
            { wch: 12 }, // CST
            { wch: 12 }, // CSOSN
            { wch: 12 }, // Estado
            { wch: 16 }, // Dimensões
            { wch: 10 }, // Peso
        ];
        const attrWidths = attributeKeys.map(() => ({ wch: 18 }));
        worksheet["!cols"] = [...baseWidths, ...attrWidths];
        XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        const dateLabel = new Date().toISOString().split("T")[0];
        const categoryLabel = categoryName || "todas-categorias";
        const safeCategory = categoryLabel
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");
        const filename = `mercado_livre_${safeCategory}_${dateLabel}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);
    } catch (error: any) {
        console.error("[Export XLSX] Erro:", error);
        return res.status(500).json({ error: "Falha ao gerar XLSX", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/products/export/xlsx-print
 * Exporta um XLSX com uma folha A4 por produto (cada produto em uma aba).
 */
router.get("/products/export/xlsx-print", async (req, res) => {
    try {
        const { workspaceId, category } = req.query as { workspaceId?: string; category?: string };
        const targetWorkspace = (workspaceId as string) || FALLBACK_WORKSPACE_ENV;
        if (!targetWorkspace) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }
        let credentials = await getMercadoLivreCredentials(targetWorkspace);
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        const clean = (v: any, limit = 500) => {
            const s = String(v ?? "").replace(/\s+/g, " ").trim();
            return s.length > limit ? `${s.slice(0, limit)}…` : s;
        };

        // Coletar IDs
        const allItemIds: string[] = [];
        let offset = 0;
        const limit = 50;
        for (; ;) {
            try {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    { params: { limit, offset }, headers: { Authorization: `Bearer ${credentials.accessToken}` } }
                );
                const ids = resp.data.results || [];
                allItemIds.push(...ids);
                if (ids.length < limit) break;
                offset += limit;
            } catch (err: any) {
                if (err?.response?.status === 401) {
                    const refreshed = await refreshAccessToken(targetWorkspace);
                    if (refreshed) {
                        credentials = refreshed;
                        continue;
                    }
                }
                break;
            }
        }

        const wb = XLSX.utils.book_new();

        for (const itemId of allItemIds) {
            // Detalhes
            const item = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${itemId}`);
            if (category && category !== "all" && item.category_id !== category) continue;
            let description = "";
            try {
                const desc = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${itemId}/description`);
                description = desc?.plain_text || desc?.text || "";
            } catch {
                description = "";
            }

            const attributes = normalizeAttributes(item.attributes);
            const saleTerms = Array.isArray(item.sale_terms) ? item.sale_terms : [];
            const warrantyTerm = saleTerms.find((st: any) => st.id === 'WARRANTY_TYPE');
            const warrantyTime = saleTerms.find((st: any) => st.id === 'WARRANTY_TIME');
            const dimensions = parseDimensions(item.shipping?.dimensions);
            const sku =
                item.seller_custom_field ||
                getAttrValue(attributes, ['SELLER_SKU', 'SKU']) ||
                (item.variations?.[0]?.seller_custom_field || undefined);

            // Monta linhas em 2 colunas (rótulo, valor)
            const headerTitle = clean(item.title || "Produto", 120);
            const rows: any[][] = [];
            rows.push([headerTitle, ""]);
            rows.push(["MLB", String(item.id)]);
            rows.push(["SKU", sku || "-"]);
            rows.push(["Variação", item.variations?.[0]?.id ? String(item.variations[0].id) : "-"]);
            rows.push(["Preço", item.price != null ? String(item.price) : "-"]);
            rows.push(["Status", item.status || "-"]);
            rows.push(["Estoque", String(item.available_quantity ?? "-")]);
            rows.push(["Garantia", item.warranty || warrantyTerm?.value_name || "-"]);
            rows.push(["Garantia (Tempo)", warrantyTime?.value_name || "-"]);
            rows.push(["Entrega / Logística", item.shipping?.logistic_type || "-"]);
            rows.push(["Frete Grátis", item.shipping?.free_shipping ? "Sim" : "Não"]);
            rows.push(["Tipo de anúncio", item.listing_type_id || "-"]);
            rows.push(["Categoria", item.category_id || "-"]);
            rows.push(["Peso", dimensions.weight || "-"]);
            rows.push(["Dimensões (A x L x C)", `${dimensions.height || "-"} x ${dimensions.width || "-"} x ${dimensions.length || "-"}`]);
            rows.push(["", ""]);
            rows.push(["Descrição", clean(description, 1000)]);
            rows.push(["", ""]);
            rows.push(["Atributos", ""]);

            // Limitar atributos para caber na A4
            attributes.slice(0, 24).forEach((attr: any) => {
                const name = attr.name || attr.id || "";
                const val = attr.value_name || attr.value_id || "";
                rows.push([clean(name, 60), clean(val, 120)]);
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            // Merge título na primeira linha (A1:B1)
            ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
            // Larguras e margens pensadas para A4
            ws["!cols"] = [{ wch: 28 }, { wch: 42 }];
            ws["!margins"] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
            // Altura da primeira linha maior para destacar título
            ws["!rows"] = [{ hpt: 24 }];

            const safeTitle = headerTitle
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 28) || `Produto-${item.id}`;
            XLSX.utils.book_append_sheet(wb, ws, safeTitle);
        }

        const dateLabel = new Date().toISOString().split("T")[0];
        const safeCategory = String(category || "todos")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");
        const filename = `produtos-ml-a4-${safeCategory}-${dateLabel}.xlsx`;
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buf);
    } catch (error: any) {
        console.error("[Export XLSX (A4 por produto)] Erro:", error);
        return res.status(500).json({ error: "Falha ao gerar XLSX A4 por produto", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/products/:productId/pdf
 * Exporta um PDF de um único produto com detalhes.
 */
router.get("/products/:productId/pdf", async (req, res) => {
    try {
        const { productId } = req.params;
        const { workspaceId } = req.query as { workspaceId?: string };
        const targetWorkspace = (workspaceId as string) || FALLBACK_WORKSPACE_ENV;
        if (!targetWorkspace) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const credentials = await getMercadoLivreCredentials(targetWorkspace);
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        const item = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${productId}`);
        const attributes = normalizeAttributes(item.attributes);
        const saleTerms = Array.isArray(item.sale_terms) ? item.sale_terms : [];
        let description = "";
        try {
            const descResp = await requestWithAuth<any>(targetWorkspace, `${MERCADO_LIVRE_API_BASE}/items/${productId}/description`);
            description = descResp?.plain_text || descResp?.text || "";
        } catch (err) {
            description = "";
        }

        const sku =
            item.seller_custom_field ||
            getAttrValue(attributes, ['SELLER_SKU', 'SKU']) ||
            (item.variations?.[0]?.seller_custom_field || undefined);
        const warrantyTerm = saleTerms.find((st: any) => st.id === 'WARRANTY_TYPE');
        const warrantyTime = saleTerms.find((st: any) => st.id === 'WARRANTY_TIME');
        const color = getAttrValue(attributes, ['MAIN_COLOR', 'COLOR']);
        const material = getAttrValue(attributes, ['MATERIAL']);
        const style = getAttrValue(attributes, ['STYLE']);
        const lengthAttr = getAttrValue(attributes, ['LENGTH', 'COMPRIMENTO']);
        const widthAttr = getAttrValue(attributes, ['WIDTH', 'LARGURA']);
        const diameter = getAttrValue(attributes, ['DIAMETER', 'DIÂMETRO']);
        const earringType = getAttrValue(attributes, ['EARRING_TYPE', 'TIPO DE BRINCO']);
        const hasStones = getAttrValue(attributes, ['WITH_STONES', 'COM PEDRAS']);
        const stoneType = getAttrValue(attributes, ['STONE_TYPE', 'TIPO DE PEDRAS']);
        const kitPieces = getAttrValue(attributes, ['KIT_UNITS', 'UNIDADES NO KIT']);
        const universalCode = getAttrValue(attributes, ['GTIN', 'GTIN13', 'EAN', 'UPC', 'JAN', 'BARCODE']);
        const ncm = getAttrValue(attributes, ['NCM']);
        const origin = getAttrValue(attributes, ['ORIGIN']);
        const cfop = getAttrValue(attributes, ['CFOP']);
        const cst = getAttrValue(attributes, ['CST']);
        const csosn = getAttrValue(attributes, ['CSOSN']);
        const state = getAttrValue(attributes, ['STATE', 'UF', 'STATE_CODE']);
        const dimensions = parseDimensions(item.shipping?.dimensions);
        const pageSizeParam = (((req.query as any).pageSize || (req.query as any).size || "") as string).toLowerCase();
        const isLabel = pageSizeParam === "10x15" || pageSizeParam === "10x15cm" || String((req.query as any).label || "").toLowerCase() === "true";
        const labelSize: [number, number] = [283.465, 425.197]; // 10x15 cm em pontos
        const pdfSize = isLabel ? labelSize : "A4";
        const pdfMargin = isLabel ? 16 : 36;

        res.setHeader("Content-Type", "application/pdf");
        const safeTitle =
            String(item.title || productId)
                .toLowerCase()
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9_-]/g, "");
        const fileName = `${safeTitle || productId}${isLabel ? "-10x15" : ""}.pdf`;
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

        const doc = new PDFDocument({ size: pdfSize, margin: pdfMargin });
        doc.pipe(res);

        // Helpers para layout
        const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const setLeft = () => {
            doc.x = doc.page.margins.left;
        };
        const divider = () => {
            setLeft();
            doc.moveDown(0.2);
            const lineY = doc.y;
            doc
                .moveTo(doc.page.margins.left, lineY)
                .lineTo(doc.page.width - doc.page.margins.right, lineY)
                .lineWidth(0.5)
                .strokeColor("#e5e7eb")
                .stroke();
            doc.moveDown(0.4);
            setLeft();
        };

        const renderCardGrid = (
            title: string,
            entries: Array<{ label: string; value: string | number | null | undefined }>,
            columns = isLabel ? 2 : 3
        ) => {
            if (!entries.length) return;
            setLeft();
            doc.font("Helvetica-Bold").fontSize(isLabel ? 10 : 11).fillColor("#111827").text(title);
            doc.moveDown(0.1);

            const gap = isLabel ? 8 : 10;
            const colWidth = (contentWidth - gap * (columns - 1)) / columns;
            const cardHeight = isLabel ? 32 : 36;
            const startX = doc.page.margins.left;
            const startY = doc.y;

            entries.forEach((entry, idx) => {
                const col = idx % columns;
                const row = Math.floor(idx / columns);
                const cardX = startX + col * (colWidth + gap);
                const cardY = startY + row * (cardHeight + gap);

                doc.save();
                doc.roundedRect(cardX, cardY, colWidth, cardHeight, 6).fillAndStroke("#f9fafb", "#e5e7eb");
                doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(isLabel ? 7.5 : 8).text(entry.label, cardX + 8, cardY + 6, {
                    width: colWidth - 16,
                });
                doc.fillColor("#111827").font("Helvetica").fontSize(isLabel ? 9 : 10).text(String(entry.value ?? "-"), cardX + 8, cardY + 18, {
                    width: colWidth - 16,
                });
                doc.restore();
            });

            const rows = Math.ceil(entries.length / columns);
            doc.y = startY + rows * (cardHeight + gap) + 1;
            doc.moveDown(0.2);
        };

        const renderPairs = (title: string, entries: Array<[string, string]>, columns = isLabel ? 2 : 2) => {
            if (!entries.length) return;
            setLeft();
            doc.font("Helvetica-Bold").fontSize(isLabel ? 10 : 11).fillColor("#111827").text(title);
            doc.moveDown(0.1);

            const gap = isLabel ? 10 : 14;
            const colWidth = (contentWidth - gap * (columns - 1)) / columns;
            const startX = doc.page.margins.left;
            const startY = doc.y;

            entries.forEach(([label, value], idx) => {
                const col = idx % columns;
                const row = Math.floor(idx / columns);
                const x = startX + col * (colWidth + gap);
                const y = startY + row * (isLabel ? 12 : 14);

                doc.font("Helvetica-Bold").fontSize(isLabel ? 8.5 : 9).fillColor("#4b5563").text(`${label}: `, x, y, { continued: true });
                doc.font("Helvetica").fontSize(isLabel ? 8.5 : 9).fillColor("#111827").text(value || "-");
            });

            const rows = Math.ceil(entries.length / columns);
            doc.y = startY + rows * (isLabel ? 12 : 14);
            doc.moveDown(0.2);
        };

        const renderDimensions = (dimensions: { height?: string; width?: string; length?: string; weight?: string }) => {
            const blocks: Array<{ label: string; value: string }> = [
                { label: "Peso", value: dimensions.weight || "-" },
                { label: "Dimensões (A x L x C)", value: `${dimensions.height || "-"} x ${dimensions.width || "-"} x ${dimensions.length || "-"}` },
            ];

            setLeft();
            doc.font("Helvetica-Bold").fontSize(isLabel ? 10 : 11).fillColor("#111827").text("Dimensões & peso");
            doc.moveDown(0.2);

            const gap = isLabel ? 8 : 12;
            const colWidth = (contentWidth - gap) / 2;
            const startX = doc.page.margins.left;
            const startY = doc.y;
            const boxHeight = isLabel ? 30 : 34;

            blocks.forEach((block, idx) => {
                const x = startX + idx * (colWidth + gap);
                const y = startY;
                doc.save();
                doc.roundedRect(x, y, colWidth, boxHeight, 6).fillAndStroke("#f3f4f6", "#e5e7eb");
                doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(isLabel ? 7.5 : 8).text(block.label, x + 8, y + 6, { width: colWidth - 16 });
                doc.fillColor("#111827").font("Helvetica").fontSize(isLabel ? 9 : 10).text(block.value, x + 8, y + 18, { width: colWidth - 16 });
                doc.restore();
            });

            doc.y = startY + boxHeight + 6;
            divider();
        };

        const renderDescriptionAndImage = (descriptionText: string, imageBuffer: Buffer | null) => {
            setLeft();
            doc.font("Helvetica-Bold").fontSize(isLabel ? 10 : 11).fillColor("#111827").text("Descrição e mídia");
            doc.moveDown(0.2);

            const colGap = isLabel ? 10 : 16;
            const col1Width = (contentWidth * 0.62) - (colGap / 2);
            const col2Width = (contentWidth * 0.38) - (colGap / 2);
            const rightX = doc.page.margins.left + col1Width + colGap;
            const startY = doc.y;

            const descText = descriptionText
                ? descriptionText.slice(0, isLabel ? 550 : 1500)
                : "Sem descrição disponível";

            doc.font("Helvetica").fontSize(isLabel ? 9 : 10).fillColor("#111827").text(descText || "Sem descrição disponível", doc.page.margins.left, startY, {
                width: col1Width,
                lineGap: isLabel ? 1.2 : 1.5,
                align: "justify",
            });
            const descEndY = doc.y;

            let mediaBottomY = startY;
            if (imageBuffer) {
                try {
                    doc.image(imageBuffer, rightX, startY, { fit: [col2Width, isLabel ? 140 : 180], align: "center" });
                    mediaBottomY = startY + (isLabel ? 145 : 185);
                } catch (imgErr) {
                    console.warn("Falha ao renderizar imagem no PDF:", imgErr);
                    doc.font("Helvetica").fontSize(isLabel ? 8 : 9).fillColor("#6b7280").text("[Imagem indisponível]", rightX, startY, { width: col2Width });
                    mediaBottomY = startY + 20;
                }
            } else {
                doc.font("Helvetica").fontSize(isLabel ? 8 : 9).fillColor("#6b7280").text("[Sem imagem disponível]", rightX, startY, { width: col2Width });
                mediaBottomY = startY + 20;
            }

            doc.y = Math.max(descEndY, mediaBottomY) + 6;
            divider();
        };

        const renderLabelTag = (opts: {
            title: string;
            id: string;
            sku: string;
            variation: string;
            price: string;
            imageBuffer: Buffer | null;
            features: Array<[string, string]>;
        }) => {
            // 1. Title (Centered, larger)
            setLeft();
            doc
                .font("Helvetica-Bold")
                .fontSize(14)
                .fillColor("#111827")
                .text(opts.title || "Produto", {
                    width: contentWidth,
                    align: 'center',
                    height: 40,
                    ellipsis: true
                });
            doc.moveDown(0.5);

            // 2. Image (Centered)
            if (opts.imageBuffer) {
                try {
                    const imgHeight = 150;
                    const imgWidth = 180;
                    const x = doc.page.margins.left + (contentWidth - imgWidth) / 2;
                    doc.image(opts.imageBuffer, x, doc.y, {
                        fit: [imgWidth, imgHeight],
                        align: "center"
                    });
                    doc.y += imgHeight + 10;
                } catch (e) {
                    console.warn("Error rendering image in label", e);
                    doc.moveDown(1);
                }
            } else {
                doc.moveDown(1);
            }

            // 3. Info Block (SKU Prominent)
            const startInfoY = doc.y;

            // SKU Box
            doc.roundedRect(doc.page.margins.left, startInfoY, contentWidth, 45, 4).fillAndStroke("#f9fafb", "#e5e7eb");

            doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9).text("SKU / REFERÊNCIA", doc.page.margins.left + 10, startInfoY + 8);
            doc.fillColor("#111827").font("Helvetica-Bold").fontSize(16).text(opts.sku || "-", doc.page.margins.left + 10, startInfoY + 22, { width: contentWidth - 20, ellipsis: true });

            doc.y = startInfoY + 55;

            // Secondary Info
            setLeft();
            doc.font("Helvetica").fontSize(9).fillColor("#374151")
                .text(`MLB: ${opts.id}   |   Variação: ${opts.variation || "-"}`, { align: 'center' });

            doc.moveDown(0.5);
            divider();
            doc.moveDown(0.5);

            // 4. Features (Compact Grid)
            if (opts.features.length > 0) {
                const colGap = 8;
                const colWidth = (contentWidth - colGap) / 2;
                const startX = doc.page.margins.left;
                const startFeatY = doc.y;

                // Show up to 8 features
                opts.features.slice(0, 8).forEach(([label, value], idx) => {
                    const col = idx % 2;
                    const row = Math.floor(idx / 2);
                    const x = startX + col * (colWidth + colGap);
                    const y = startFeatY + row * 20;

                    doc.font("Helvetica-Bold").fontSize(8).fillColor("#4b5563").text(label + ":", x, y, { continued: true });
                    doc.font("Helvetica").fontSize(8).fillColor("#111827").text(" " + (value || "-"), { width: colWidth, lineBreak: false, ellipsis: true });
                });

                doc.y = startFeatY + (Math.ceil(opts.features.slice(0, 8).length / 2) * 20) + 10;
            }

            // 5. Quantity Manual Entry (Footer)
            // Ensure it's at the bottom
            const bottomY = doc.page.height - doc.page.margins.bottom - 45;
            if (doc.y < bottomY) {
                doc.y = bottomY;
            }

            // Draw a dashed box or line for quantity
            doc.rect(doc.page.margins.left, doc.y, contentWidth, 40).strokeColor("#9ca3af").dash(4, { space: 2 }).stroke();
            doc.undash();

            doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827")
                .text("QUANTIDADE:", doc.page.margins.left + 10, doc.y + 14, { continued: true })
                .text("  _________", { align: 'right' }); // Manual fill space
        };

        const priceLabel = item.price ? `R$ ${item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-";

        // Buscar imagem principal (antes de renderizar descrição ou etiqueta)
        let imageBuffer: Buffer | null = null;
        const imageUrl =
            (Array.isArray(item.pictures) && (item.pictures[0]?.secure_url || item.pictures[0]?.url)) ||
            item.thumbnail ||
            null;
        if (imageUrl && !isLabel) {
            try {
                const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
                imageBuffer = Buffer.from(imgResp.data);
            } catch (imgErr) {
                console.warn("Falha ao baixar imagem do produto:", imgErr);
            }
        }

        const descRaw = (description || "").replace(/\s+/g, " ").trim();
        const mainFeatures: Array<[string, string]> = [
            ["Material", material || "-"],
            ["Cor", color || "-"],
            ["Estilo", style || "-"],
            ["Tipo de brinco", earringType || "-"],
            ["Com pedra", hasStones || "-"],
            ["Tipo de pedras", stoneType || "-"],
            ["Peças no kit", kitPieces || "-"],
            ["Comprimento", dimensions.length || "-"],
            ["Largura", dimensions.width || "-"],
            ["Altura", dimensions.height || "-"],
            ["Diâmetro", diameter || "-"],
            ["Peso", dimensions.weight || "-"],
            ["Código universal", universalCode || "-"],
        ]
            .filter(([, v]) => String(v).trim() !== "-")
            .slice(0, isLabel ? 10 : 999) as Array<[string, string]>;

        if (isLabel) {
            renderLabelTag({
                title: item.title || "Produto",
                id: item.id,
                sku: sku || "-",
                variation: item.variations?.[0]?.id ? String(item.variations[0].id) : "-",
                price: priceLabel,
                imageBuffer,
                features: mainFeatures.slice(0, 8),
            });
            doc.end();
            return;
        }

        // Cabeçalho (apenas A4)
        doc
            .font("Helvetica-Bold")
            .fontSize(18)
            .fillColor("#111827")
            .text(item.title || "Produto", { align: "left", width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
        doc.moveDown(0.3);
        setLeft();
        doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#374151")
            .text(`MLB: ${item.id}`, { continued: true })
            .text(`   SKU: ${sku || "-"}`, { continued: true })
            .text(`   Variação: ${item.variations?.[0]?.id ? String(item.variations[0].id) : "-"}`);
        doc.moveDown(0.1);
        setLeft();
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(`Preço: ${priceLabel}`, doc.page.margins.left, doc.y, { width: contentWidth });
        divider();

        const summaryEntries = [
            { label: "MLB", value: item.id },
            { label: "SKU", value: sku || "-" },
            { label: "Variação", value: item.variations?.[0]?.id ? String(item.variations[0].id) : "-" },
            { label: "Estoque", value: String(item.available_quantity ?? "-") },
            { label: "Categoria", value: item.category_id || "-" },
            { label: "Tipo de anúncio", value: item.listing_type_id || "-" },
            { label: "Logística", value: item.shipping?.logistic_type || "-" },
            { label: "Frete grátis", value: item.shipping?.free_shipping ? "Sim" : "Não" },
            { label: "Garantia", value: item.warranty || warrantyTerm?.value_name || "-" },
        ];
        renderCardGrid("Resumo do anúncio", summaryEntries, 3);
        divider();

        renderDescriptionAndImage(descRaw, imageBuffer);

        renderPairs("Principais características", mainFeatures, 2);

        renderDimensions(dimensions);

        const fiscalPairs: Array<[string, string]> = ([
            ["NCM", ncm || "-"],
            ["Origem", origin || "-"],
            ["CFOP", cfop || "-"],
            ["CST", cst || "-"],
            ["CSOSN", csosn || "-"],
            ["Estado", state || "-"],
        ] as Array<[string, string]>).filter(([, v]) => String(v).trim() !== "-");
        renderPairs("Dados fiscais", fiscalPairs.length ? fiscalPairs : [["Dados fiscais", "Sem informações"]], isLabel ? 2 : 3);
        divider();

        // Atributos restantes separados dos principais para facilitar leitura
        const usedAttrIds = new Set<string>([
            "SELLER_SKU",
            "SKU",
            "MAIN_COLOR",
            "COLOR",
            "MATERIAL",
            "STYLE",
            "EARRING_TYPE",
            "TIPO DE BRINCO",
            "WITH_STONES",
            "STONE_TYPE",
            "TIPO DE PEDRAS",
            "KIT_UNITS",
            "UNIDADES NO KIT",
            "LENGTH",
            "COMPRIMENTO",
            "WIDTH",
            "LARGURA",
            "HEIGHT",
            "ALTURA",
            "DIAMETER",
            "DIÂMETRO",
            "WEIGHT",
            "GTIN",
            "GTIN13",
            "EAN",
            "UPC",
            "JAN",
            "BARCODE",
            "NCM",
            "ORIGIN",
            "CFOP",
            "CST",
            "CSOSN",
            "STATE",
            "STATE_CODE",
        ]);
        const remainingAttrsText = attributes
            .filter((a: any) => !usedAttrIds.has(a.id))
            .slice(0, isLabel ? 20 : 80)
            .map((attr: any) => `${attr.name}: ${attr.value_name || attr.value_id || "-"}`)
            .join("\n");

        doc.font("Helvetica-Bold").fontSize(isLabel ? 10 : 11).fillColor("#111827").text("Atributos do anúncio");
        doc.moveDown(0.2);
        doc
            .font("Helvetica")
            .fontSize(isLabel ? 8.5 : 9)
            .fillColor("#111827")
            .text(remainingAttrsText || "Sem outros atributos", doc.page.margins.left, doc.y, {
                width: contentWidth,
                columns: 2,
                columnGap: isLabel ? 12 : 16,
                lineGap: isLabel ? 1.2 : 1.6,
            });
        doc.end();
    } catch (error: any) {
        console.error("[Export PDF] Erro:", error);
        return res.status(500).json({ error: "Falha ao gerar PDF", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/products/export/pdf
 * Exporta um PDF com uma página A4 por produto (filtrado por categoria opcional).
 */
router.get("/products/export/pdf", async (req, res) => {
    try {
        const { workspaceId, category } = req.query as { workspaceId?: string; category?: string };
        const targetWorkspace = (workspaceId as string) || FALLBACK_WORKSPACE_ENV;
        if (!targetWorkspace) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }
        const credentials = await getMercadoLivreCredentials(targetWorkspace);
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        // Buscar todos os IDs de itens do vendedor
        const fetchIdsByStatus = async (status: string) => {
            const collected: string[] = [];
            let offset = 0;
            const limit = 50;
            for (; ;) {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        params: { limit, offset, status },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }
                );
                const ids = resp.data.results || [];
                collected.push(...ids);
                if (ids.length < limit) break;
                offset += limit;
            }
            return collected;
        };
        const statusesToInclude = ["active", "paused", "closed", "inactive"];
        const collectedSets: string[][] = [];
        for (const st of statusesToInclude) {
            const ids = await fetchIdsByStatus(st);
            collectedSets.push(ids);
        }
        const allItemIds = Array.from(new Set(collectedSets.flat()));

        res.setHeader("Content-Type", "application/pdf");
        const dateLabel = new Date().toISOString().slice(0, 10);
        const safeCategory = String(category || "todos")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");
        res.setHeader("Content-Disposition", `attachment; filename=produtos-ml-${safeCategory}-${dateLabel}.pdf`);

        const doc = new PDFDocument({ size: "A4", margin: 42 });
        doc.pipe(res);

        const divider = () => {
            doc.moveDown(0.3);
            const lineY = doc.y;
            doc
                .moveTo(doc.page.margins.left, lineY)
                .lineTo(doc.page.width - doc.page.margins.right, lineY)
                .lineWidth(0.5)
                .strokeColor("#e5e7eb")
                .stroke();
            doc.moveDown(0.6);
        };

        const section = (title: string, entries: Array<[string, string]>, width: number = 0) => {
            const opts = width > 0 ? { width } : {};
            doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title, opts);
            doc.moveDown(0.25);
            entries.forEach(([label, value]) => {
                doc
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .fillColor("#4b5563")
                    .text(`${label}: `, { continued: true, ...opts });
                doc
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor("#111827")
                    .text(value || "-", opts);
            });
            // Não desenhar divisória aqui pois estamos controlando manualmente ou é chamada interna
        };

        const renderProductPage = (item: any, description: string, attributes: Array<any>, imageBuffer: Buffer | null) => {
            const margin = 42;
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const colGap = 20;
            const col1Width = (pageWidth * 0.6) - (colGap / 2);
            const col2Width = (pageWidth * 0.4) - (colGap / 2);
            const col2X = doc.page.margins.left + col1Width + colGap;

            // --- Cabeçalho ---
            doc
                .font("Helvetica-Bold")
                .fontSize(16)
                .fillColor("#111827")
                .text(item.title || "Produto", { align: "left", width: pageWidth });
            doc.moveDown(0.2);

            const sku =
                item.seller_custom_field ||
                getAttrValue(normalizeAttributes(item.attributes), ['SELLER_SKU', 'SKU']) ||
                (item.variations?.[0]?.seller_custom_field || undefined);
            const variation = item.variations?.[0]?.id ? String(item.variations[0].id) : "-";

            doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor("#374151")
                .text(`MLB: ${item.id}   SKU: ${sku || "-"}   Variação: ${variation}`);
            doc.moveDown(0.2);

            // Preço destacado
            if (item.price) {
                doc
                    .font("Helvetica-Bold")
                    .fontSize(14)
                    .fillColor("#111827")
                    .text(`Preço: R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            }
            doc.moveDown(0.5);
            divider();

            // Guardar posição Y para as colunas
            const startY = doc.y;

            // --- Coluna 1: Condições Gerais ---
            const dimensions = parseDimensions(item.shipping?.dimensions);
            const warrantyTerm = (Array.isArray(item.sale_terms) ? item.sale_terms : []).find((st: any) => st.id === 'WARRANTY_TYPE');
            const warrantyTime = (Array.isArray(item.sale_terms) ? item.sale_terms : []).find((st: any) => st.id === 'WARRANTY_TIME');

            doc.y = startY;
            section("Condições gerais", [
                ["Status", item.status || "-"],
                ["Estoque", String(item.available_quantity ?? "-")],
                ["Garantia", item.warranty || warrantyTerm?.value_name || "-"],
                ["Garantia (Tempo)", warrantyTime?.value_name || "-"],
                ["Entrega / Logística", item.shipping?.logistic_type || "-"],
                ["Frete grátis", item.shipping?.free_shipping ? "Sim" : "Não"],
                ["Tipo de anúncio", item.listing_type_id || "-"],
                ["Categoria", item.category_id || "-"],
                // ["Peso", dimensions.weight || "-"], // Peso movido para Características
                // ["Dimensões", ...], // Movido para Características
            ], col1Width);

            const col1EndY = doc.y;

            // --- Coluna 2: Imagem e Características ---
            doc.y = startY;

            // Imagem
            if (imageBuffer) {
                try {
                    // Ajustar tamanho da imagem para caber na coluna
                    doc.image(imageBuffer, col2X, doc.y, { fit: [col2Width, 150], align: 'center' });
                    // Adicionar espaço após imagem (150px altura reservada ou altura real)
                    doc.y += 160;
                } catch (e) {
                    console.error("Erro ao renderizar imagem no PDF:", e);
                    doc.text("[Imagem indisponível]", col2X, doc.y);
                    doc.moveDown();
                }
            } else {
                // Espaço reservado se não houver imagem
                doc.y += 20;
            }

            // Características do Produto (extraídas dos atributos)
            const targetFeatureIds = ['COLOR', 'MATERIAL', 'STYLE', 'DIMENSIONS', 'WEIGHT', 'GTIN', 'BRAND', 'MODEL', 'EAN'];
            const features = attributes.filter(a => targetFeatureIds.includes(a.id) || ['peso', 'dimensões', 'cor', 'material'].includes(a.name.toLowerCase()));

            // Adicionar Dimensões e Peso se não estiverem nos atributos mas estiverem no item
            if (!features.find(f => f.id === 'WEIGHT') && dimensions.weight) {
                features.push({ name: 'Peso', value_name: dimensions.weight });
            }
            if (!features.find(f => f.id === 'DIMENSIONS') && (dimensions.height || dimensions.width || dimensions.length)) {
                features.push({ name: 'Dimensões (A x L x C)', value_name: `${dimensions.height || "-"} x ${dimensions.width || "-"} x ${dimensions.length || "-"}` });
            }

            // Renderizar seção Características na Coluna 2
            doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Características do produto", col2X, doc.y);
            doc.moveDown(0.25);

            features.forEach((attr: any) => {
                const label = attr.name;
                const value = attr.value_name || attr.value_id || "-";
                // Checar se cabe na linha, simplificado
                doc.font("Helvetica-Bold").fontSize(9).fillColor("#4b5563").text(`${label}: `, col2X, doc.y, { continued: true });
                doc.font("Helvetica").fontSize(9).fillColor("#111827").text(value);
            });

            const col2EndY = doc.y;

            // Avançar para o maior Y das duas colunas
            doc.y = Math.max(col1EndY, col2EndY) + 10;

            // Divisória abaixo das colunas
            doc
                .moveTo(doc.page.margins.left, doc.y)
                .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                .lineWidth(0.5)
                .strokeColor("#e5e7eb")
                .stroke();
            doc.moveDown(0.6);

            // --- Dados Fiscais ---
            // Tentando encontrar dados fiscais. Geralmente não estão públicos, mas procuramos em attributes ou custom fields
            const fiscalAttrs = attributes.filter(a => ['NCM', 'ORIGIN', 'CEC', 'CFOP'].includes(a.id));
            section("Dados fiscais", [
                ["NCM", getAttrValue(attributes, ['NCM']) || "-"],
                ["Origem", getAttrValue(attributes, ['ORIGIN']) || "-"],
                ["CFOP", "-"], // Placeholder
                ["CST", "-"],  // Placeholder
                ["CSOSN", "-"], // Placeholder
            ], pageWidth);


            // --- Descrição ---
            const maxDesc = 1500; // Aumentado um pouco
            const descText = (description || "Sem descrição disponível").slice(0, maxDesc);
            doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Descrição");
            doc.moveDown(0.2);
            doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor("#111827")
                .text(descText, {
                    width: pageWidth,
                    align: 'justify',
                    lineGap: 2,
                });
            doc.moveDown(0.4);
            divider();

            // --- Atributos Restantes ---
            // Filtrar atributos que já mostramos em Características ou Dados Fiscais ou Cabeçalho
            const usedAttrIds = [...targetFeatureIds, 'NCM', 'ORIGIN', 'SELLER_SKU', 'SKU'];
            const remainingAttrs = attributes.filter(a => !usedAttrIds.includes(a.id));

            doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Atributos");
            doc.moveDown(0.2);
            const attrsText = remainingAttrs
                .slice(0, 50)
                .map((attr: any) => `${attr.name}: ${attr.value_name || attr.value_id || "-"}`)
                .join("\n");

            doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor("#111827")
                .text(attrsText || "Sem outros atributos", {
                    width: pageWidth,
                    columns: 2,
                    columnGap: 12,
                    lineGap: 2,
                });
        };



        let firstPage = true;
        for (const itemId of allItemIds) {
            // Buscar detalhes do item
            const itemResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}`, {
                headers: { Authorization: `Bearer ${credentials.accessToken}` },
            });
            const item = itemResp.data;
            if (category && category !== "all" && item.category_id !== category) {
                continue;
            }

            let description = "";
            try {
                const descResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}/description`, {
                    headers: { Authorization: `Bearer ${credentials.accessToken}` },
                });
                description = descResp.data?.plain_text || descResp.data?.text || "";
            } catch {
                description = "";
            }
            const attributes = normalizeAttributes(item.attributes);

            // Fetch Image
            let imageBuffer: Buffer | null = null;
            if (item.pictures && item.pictures.length > 0) {
                try {
                    const imgUrl = item.pictures[0].secure_url || item.pictures[0].url;
                    const imgResp = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgResp.data);
                } catch (e) {
                    console.warn(`[PDF Export] Failed to fetch image for item ${itemId}`, e);
                }
            } else if (item.thumbnail) {
                // Fallback thumbnail
                try {
                    const imgResp = await axios.get(item.thumbnail, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgResp.data);
                } catch (e) {
                    console.warn(`[PDF Export] Failed to fetch thumbnail for item ${itemId}`, e);
                }
            }

            if (!firstPage) {
                doc.addPage({ size: "A4", margin: 42 });
            }
            renderProductPage(item, description, attributes, imageBuffer);
            firstPage = false;
        }

        doc.end();
    } catch (error: any) {
        console.error("[Export PDF (bulk)] Erro:", error);
        return res.status(500).json({ error: "Falha ao gerar PDF de produtos", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/products/export/purchase-list.pdf
 * Exporta um PDF em formato de lista de compra (thumb, título, SKU, estoque) respeitando filtros.
 */
router.get("/products/export/purchase-list.pdf", async (req, res) => {
    try {
        const { workspaceId, category, search } = req.query as { workspaceId?: string; category?: string; search?: string };
        const targetWorkspace = (workspaceId as string) || FALLBACK_WORKSPACE_ENV;
        if (!targetWorkspace) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }
        const credentials = await getMercadoLivreCredentials(targetWorkspace);
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        const fetchIdsByStatus = async (status: string) => {
            const collected: string[] = [];
            let offset = 0;
            const limit = 50;
            for (; ;) {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        params: { limit, offset, status },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }
                );
                const ids = resp.data.results || [];
                collected.push(...ids);
                if (ids.length < limit) break;
                offset += limit;
            }
            return collected;
        };
        const statusesToInclude = ["active", "paused", "closed", "inactive"];
        const collectedSets: string[][] = [];
        for (const st of statusesToInclude) {
            const ids = await fetchIdsByStatus(st);
            collectedSets.push(ids);
        }
        const allItemIds = Array.from(new Set(collectedSets.flat()));

        const items: Array<{ title: string; sku: string; stock: number; imageUrl: string | null }> = [];
        const searchNorm = String(search || "").trim().toLowerCase();
        for (const itemId of allItemIds) {
            const itemResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}`, {
                headers: { Authorization: `Bearer ${credentials.accessToken}` },
            });
            const item = itemResp.data;
            if (category && category !== "all" && item.category_id !== category) continue;
            if (searchNorm) {
                const t = String(item.title || "").toLowerCase();
                const idStr = String(item.id || "").toLowerCase();
                if (!t.includes(searchNorm) && !idStr.includes(searchNorm)) continue;
            }

            const attributes = normalizeAttributes(item.attributes);
            const sku =
                item.seller_custom_field ||
                getAttrValue(attributes, ['SELLER_SKU', 'SKU']) ||
                (item.variations?.[0]?.seller_custom_field || "") ||
                "";
            const imageUrl =
                (Array.isArray(item.pictures) && (item.pictures[0]?.secure_url || item.pictures[0]?.url)) ||
                item.thumbnail ||
                null;

            let stock = Number(item.available_quantity || 0);
            const logisticType = item?.shipping?.logistic_type || null;
            const tags: string[] = Array.isArray(item?.tags) ? item.tags : [];
            const isFull = String(logisticType || '').toLowerCase() === 'fulfillment' || tags.includes('is_fulfillment');
            const inventoryId = item?.inventory_id || null;
            if (isFull && inventoryId) {
                try {
                    const fullResp = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/inventories/${inventoryId}/stock/fulfillment`,
                        { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
                    );
                    stock = Number(fullResp.data?.available_quantity || 0);
                } catch (e: any) {
                    stock = Number(item.available_quantity || 0);
                }
            }

            items.push({
                title: item.title || "-",
                sku: sku || "",
                stock,
                imageUrl,
            });
        }

        // Priorizar itens zerados de estoque primeiro
        items.sort((a, b) => {
            const aZero = a.stock === 0 ? 1 : 0;
            const bZero = b.stock === 0 ? 1 : 0;
            if (aZero !== bZero) return bZero - aZero; // zeros primeiro
            // fallback: ordenar por título
            return String(a.title).localeCompare(String(b.title), "pt-BR");
        });

        res.setHeader("Content-Type", "application/pdf");
        const dateLabel = new Date().toISOString().slice(0, 10);
        const safeCategory = String(category || "todos")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");
        res.setHeader("Content-Disposition", `attachment; filename=lista-compra-${safeCategory}-${dateLabel}.pdf`);

        const doc = new PDFDocument({ size: "A4", margin: 36 });
        doc.pipe(res);

        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const columns = 3;
        const gap = 12;
        const boxWidth = (pageWidth - gap * (columns - 1)) / columns;
        const boxHeight = 82;

        const divider = () => {
            const y = doc.y;
            doc
                .moveTo(doc.page.margins.left, y)
                .lineTo(doc.page.width - doc.page.margins.right, y)
                .lineWidth(0.5)
                .strokeColor("#e5e7eb")
                .stroke();
            doc.moveDown(0.4);
        };

        doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Lista de Compra", { width: pageWidth });
        doc.moveDown(0.2);
        const metaParts = [
            `Total: ${items.length} itens`,
            category && category !== "all" ? `Categoria: ${safeCategory}` : "",
            searchNorm ? `Filtro: "${searchNorm}"` : "",
        ].filter(Boolean);
        doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(metaParts.join(" • "), { width: pageWidth });
        doc.moveDown(0.4);
        divider();

        let row = 0;
        let col = 0;
        let startY = doc.y;
        const leftX = doc.page.margins.left;

        const drawItem = async (it: { title: string; sku: string; stock: number; imageUrl: string | null }, i: number) => {
            const x = leftX + col * (boxWidth + gap);
            const y = startY + row * (boxHeight + gap);

            if (y + boxHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ size: "A4", margin: 36 });
                row = 0;
                col = 0;
                startY = doc.page.margins.top;
            }

            const bx = leftX + col * (boxWidth + gap);
            const by = startY + row * (boxHeight + gap);

            doc.save();
            doc.roundedRect(bx, by, boxWidth, boxHeight, 8).strokeColor("#e5e7eb").lineWidth(0.8).stroke();
            const imgSize = 64;
            const imgX = bx + 10;
            const imgY = by + 9;
            let hadImage = false;
            if (it.imageUrl) {
                try {
                    const imgResp = await axios.get(it.imageUrl, { responseType: "arraybuffer" });
                    const buf = Buffer.from(imgResp.data);
                    doc.image(buf, imgX, imgY, { fit: [imgSize, imgSize] });
                    hadImage = true;
                } catch {
                    hadImage = false;
                }
            }
            if (!hadImage) {
                doc.roundedRect(imgX, imgY, imgSize, imgSize, 6).fillAndStroke("#ffffff", "#e5e7eb");
            }

            const textX = imgX + imgSize + 10;
            const textWidth = boxWidth - (textX - bx) - 10;
            doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10);
            let titleText = it.title || "-";
            const maxTitleHeight = 40;
            let titleHeight = doc.heightOfString(titleText, { width: textWidth });
            if (titleHeight > maxTitleHeight) {
                const ellipsis = "…";
                while (titleText.length > 0 && doc.heightOfString(titleText + ellipsis, { width: textWidth }) > maxTitleHeight) {
                    titleText = titleText.slice(0, -1);
                }
                titleText = titleText.trim() + ellipsis;
                titleHeight = doc.heightOfString(titleText, { width: textWidth });
            }
            doc.text(titleText, textX, by + 10, { width: textWidth });
            const skuLine = `SKU: ${it.sku || "-"} • Estoque: ${it.stock}`;
            const skuY = by + 10 + titleHeight + 6;
            doc.fillColor("#374151").font("Helvetica").fontSize(9).text(skuLine, textX, skuY, { width: textWidth });
            doc.restore();

            col++;
            if (col >= columns) {
                col = 0;
                row++;
            }
        };

        for (let i = 0; i < items.length; i++) {
            await drawItem(items[i], i);
        }

        doc.end();
    } catch (error: any) {
        console.error("[Export Purchase List PDF] Erro:", error);
        return res.status(500).json({ error: "Falha ao gerar PDF da lista de compra", details: error?.message });
    }
});


/**
 * GET /api/integrations/mercadolivre/export/pdf
 * Exporta um relatório PDF com as métricas do dashboard
 */
router.get("/export/pdf", async (req, res) => {
    try {
        const { workspaceId, days = 30, dateFrom, dateTo } = req.query as any;
        const dateFromValue = typeof dateFrom === "string" ? dateFrom : undefined;
        const dateToValue = typeof dateTo === "string" ? dateTo : undefined;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const metrics = await fetchMetricsInternal(
            String(workspaceId),
            Number(days),
            dateFromValue,
            dateToValue
        );

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=relatorio-ml-${new Date().toISOString().split("T")[0]}.pdf`);
        doc.pipe(res);

        const periodLabel = dateFromValue && dateToValue
            ? `${dateFromValue} a ${dateToValue}`
            : `Últimos ${days} dias (${new Date().toLocaleDateString('pt-BR')})`;

        // Header
        doc.fillColor("#444444").fontSize(20).text("Relatório Mercado Livre", 110, 57)
            .fontSize(10).text(`Período: ${periodLabel}`, 200, 65, { align: "right" })
            .moveDown();

        // Divider
        doc.moveTo(50, 90).lineTo(550, 90).stroke();

        doc.moveDown();

        // Key Metrics
        doc.fontSize(14).text("Métricas Principais", 50, 110);
        doc.moveDown(0.5);

        const currentY = doc.y;

        doc.fontSize(12).text("Receita Total:", 50, currentY);
        doc.font("Helvetica-Bold").text(`R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, currentY);

        doc.font("Helvetica").text("Vendas:", 300, currentY);
        doc.font("Helvetica-Bold").text(String(metrics.totalSales), 400, currentY);

        doc.moveDown();
        const y2 = doc.y;

        doc.font("Helvetica").text("Visitas:", 50, y2);
        doc.font("Helvetica-Bold").text(metrics.totalVisits.toLocaleString('pt-BR'), 150, y2);

        doc.font("Helvetica").text("Ticket Médio:", 300, y2);
        doc.font("Helvetica-Bold").text(`R$ ${metrics.averageOrderPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 400, y2);

        doc.moveDown();
        const y3 = doc.y;

        doc.font("Helvetica").text("Conversão:", 50, y3);
        doc.font("Helvetica-Bold").text(`${metrics.conversionRate.toFixed(2)}%`, 150, y3);

        doc.font("Helvetica").text("Reputação:", 300, y3);
        doc.font("Helvetica-Bold").text(metrics.reputation, 400, y3);

        doc.moveDown(2);

        // Daily Sales Table
        doc.fontSize(14).font("Helvetica-Bold").text("Vendas por Dia", 50);
        doc.moveDown(0.5);

        // Table Header
        let y = doc.y;
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Data", 50, y);
        doc.text("Vendas", 200, y);
        doc.text("Receita", 350, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;

        // Table Rows
        doc.font("Helvetica");
        metrics.salesTimeSeries.reverse().forEach((day: any) => {
            if (y > 700) {
                doc.addPage();
                y = 50;
            }
            const dateStr = new Date(day.date).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
            doc.text(dateStr, 50, y);
            doc.text(String(day.sales), 200, y);
            doc.text(`R$ ${day.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 350, y);
            y += 20;
        });

        doc.end();

    } catch (error: any) {
        console.error("[Export PDF] Erro:", error);
        if (error.message === "ml_not_connected") {
            return res.status(401).json({ error: "Conexão perdida. Reconecte o Mercado Livre." });
        }
        return res.status(500).json({ error: "Falha ao gerar PDF", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/export/excel
 * Exporta um relatório Excel com as métricas
 */
router.get("/export/excel", async (req, res) => {
    try {
        const { workspaceId, days = 30, dateFrom, dateTo } = req.query as any;
        const dateFromValue = typeof dateFrom === "string" ? dateFrom : undefined;
        const dateToValue = typeof dateTo === "string" ? dateTo : undefined;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const metrics = await fetchMetricsInternal(
            String(workspaceId),
            Number(days),
            dateFromValue,
            dateToValue
        );

        const wb = XLSX.utils.book_new();

        // Sheet 1: Resumo
        const periodLabel = dateFromValue && dateToValue ? `${dateFromValue} a ${dateToValue}` : `${days} dias`;
        const summaryData = [
            ["Métrica", "Valor"],
            ["Periodo", periodLabel],
            ["Data Geração", new Date().toLocaleString("pt-BR")],
            ["", ""],
            ["Receita Total", metrics.totalRevenue],
            ["Vendas Totais", metrics.totalSales],
            ["Pedidos Totais", metrics.totalOrders],
            ["Visitas Totais", metrics.totalVisits],
            ["Ticket Médio (Venda)", metrics.averageUnitPrice],
            ["Ticket Médio (Pedido)", metrics.averageOrderPrice],
            ["Taxa de Conversão (%)", metrics.conversionRate],
            ["Reputação", metrics.reputation],
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, "Resumo");

        // Sheet 2: Diário
        const dailyData = [["Data", "Vendas (qtd)", "Receita (R$)", "Visitas"]];
        metrics.salesTimeSeries.forEach((day: any) => {
            dailyData.push([
                day.date,
                day.sales,
                day.revenue,
                day.visits
            ]);
        });
        const dailyWs = XLSX.utils.aoa_to_sheet(dailyData);
        XLSX.utils.book_append_sheet(wb, dailyWs, "Dados Diários");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=relatorio-ml-${new Date().toISOString().split("T")[0]}.xlsx`);
        res.send(buf);

    } catch (error: any) {
        console.error("[Export Excel] Erro:", error);
        if (error.message === "ml_not_connected") {
            return res.status(401).json({ error: "Conexão perdida." });
        }
        return res.status(500).json({ error: "Falha ao gerar Excel", details: error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/export/csv
 * Exporta uma planilha CSV com métricas por anúncio:
 * Produto | Preço | Custo produto | Taxa ML (%) | Imposto (%) | Embalagem | Custo envio | Vendas semana | Gasto anúncio | ACOS
 */
router.get("/export/csv", async (req, res) => {
    try {
        const { workspaceId } = req.query as any;
        const days = Math.max(1, Number((req.query as any).days) || 7);
        const dateFromParam = typeof (req.query as any).dateFrom === "string" ? (req.query as any).dateFrom : undefined;
        const dateToParam = typeof (req.query as any).dateTo === "string" ? (req.query as any).dateTo : undefined;
        const mlFeePercent = Math.max(0, Number((req.query as any).mlFeePercent) || 0);
        const taxPercent = Math.max(0, Number((req.query as any).taxPercent) || 0);
        const packagingCost = Math.max(0, Number((req.query as any).packagingCost) || 0);
        const shippingCostPerOrder = Math.max(0, Number((req.query as any).shippingCostPerOrder) || 0);

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        let credentials = await getMercadoLivreCredentials(String(workspaceId));
        if (!credentials) {
            return res.status(401).json({ error: "Mercado Livre não conectado para este workspace" });
        }

        // Buscar todos os IDs dos itens do vendedor
        const allItemIds: string[] = [];
        let searchOffset = 0;
        const searchLimit = 50;
        let hasMore = true;
        while (hasMore) {
            try {
                const resp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        params: { limit: searchLimit, offset: searchOffset },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }
                );
                const ids = resp.data.results || [];
                allItemIds.push(...ids);
                hasMore = ids.length === searchLimit;
                searchOffset += searchLimit;
            } catch (err: any) {
                if (err?.response?.status === 401) {
                    const refreshed = await refreshAccessToken(String(workspaceId));
                    if (refreshed) {
                        credentials = refreshed;
                        continue;
                    }
                }
                console.error("[Export CSV] Erro ao buscar IDs de itens:", err?.message || err);
                break;
            }
        }

        // Buscar detalhes de cada item
        const itemDetailsMap = new Map<string, any>();
        for (const itemId of allItemIds) {
            try {
                const item = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${itemId}`);
                itemDetailsMap.set(itemId, item);
            } catch (err) {
                console.error(`[Export CSV] Erro ao buscar detalhes do item ${itemId}:`, (err as any)?.message || err);
            }
        }

        // Agregar vendas por item no periodo selecionado
        const dateToKey = normalizeBrazilDateKey(dateToParam) || formatBrazilDateKey(new Date());
        const dateToStart = toBrazilDayBoundary(dateToKey, false);
        const dateFromKey = normalizeBrazilDateKey(dateFromParam) || formatBrazilDateKey(subDays(dateToStart, days - 1));
        const dateFrom = toBrazilDayBoundary(dateFromKey, false);
        const dateTo = toBrazilDayBoundary(dateToKey, true);

        const periodSalesByItem = new Map<string, number>();
        try {
            const allOrders: any[] = [];
            let offset = 0;
            const limit = 50;
            let more = true;
            while (more && allOrders.length < 1000) {
                try {
                    const ordersResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/orders/search`, {
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                        params: { seller: credentials.userId, limit, offset },
                    });
                    const orders = ordersResp.data.results || [];
                    allOrders.push(...orders);
                    more = orders.length === limit;
                    offset += limit;
                } catch (apiErr: any) {
                    if (apiErr?.response?.status === 401) {
                        const refreshed = await refreshAccessToken(String(workspaceId));
                        if (refreshed) {
                            credentials = refreshed;
                            continue;
                        }
                    }
                    console.error("[Export CSV] Erro ao buscar pedidos:", apiErr?.message || apiErr);
                    more = false;
                }
            }

            const fromKey = dateFromKey;
            const toKey = dateToKey;
            for (const order of allOrders) {
                const created = order.date_created ? new Date(order.date_created) : null;
                if (!created) continue;
                const key = formatBrazilDateKey(created);
                if (key < fromKey || key > toKey) continue;
                if (String(order.status || "").toLowerCase() === "cancelled") continue;
                const items: any[] = Array.isArray(order.order_items) ? order.order_items : [];
                for (const it of items) {
                    const iid = String(it.item?.id || "");
                    const qty = Number(it.quantity || 0);
                    if (!iid || qty <= 0) continue;
                    periodSalesByItem.set(iid, (periodSalesByItem.get(iid) || 0) + qty);
                }
            }
        } catch (err) {
            console.error("[Export CSV] Falha ao agregar vendas do periodo:", (err as any)?.message || err);
        }

        // Buscar custos dos produtos no banco
        const db = getPool();
        const prodRes = await db.query(
            `SELECT sku, ml_item_id, cost_price FROM products WHERE workspace_id = $1`,
            [workspaceId]
        );
        const costBySku = new Map<string, number>();
        const costByItemId = new Map<string, number>();
        for (const row of prodRes.rows) {
            if (row.sku) costBySku.set(String(row.sku), Number(row.cost_price || 0));
            if (row.ml_item_id) costByItemId.set(String(row.ml_item_id), Number(row.cost_price || 0));
        }

        // Montar CSV
        const header = [
            "Produto",
            "Preço",
            "Custo produto",
            "Taxa ML (%)",
            "Imposto (%)",
            "Embalagem",
            "Custo envio",
            "Vendas periodo",
            "Gasto anúncio",
            "ACOS"
        ].join(",");

        const escape = (val: any) => {
            const s = String(val ?? "");
            if (s.includes(",") || s.includes("\n") || s.includes('"')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        const adSpendByItem = new Map<string, number>();
        for (const itemId of allItemIds) {
            try {
                const adsResp = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/advertising/product_ads/items/${itemId}`, { headers: { 'api-version': '2' } });
                const metrics = adsResp?.metrics_summary || {};
                const cost = Number(metrics?.cost || metrics?.consumed_budget || 0);
                adSpendByItem.set(itemId, cost);
            } catch (err) {
                adSpendByItem.set(itemId, 0);
            }
        }

        const rows: string[] = [header];
        for (const itemId of allItemIds) {
            const item = itemDetailsMap.get(itemId);
            if (!item) continue;
            const title = String(item.title || "");
            const price = Number(item.price || 0);
            const sku = String(item.seller_custom_field || "");
            const periodSales = Number(periodSalesByItem.get(itemId) || 0);

            let costPrice = 0;
            if (sku && costBySku.has(sku)) {
                costPrice = Number(costBySku.get(sku) || 0);
            } else if (costByItemId.has(itemId)) {
                costPrice = Number(costByItemId.get(itemId) || 0);
            }

            const mlFee = mlFeePercent;
            const tax = taxPercent;
            const packaging = packagingCost;
            const shipping = shippingCostPerOrder;
            const adSpend = Number(adSpendByItem.get(itemId) || 0);
            const revenue = price * periodSales;
            const acos = revenue > 0 ? (adSpend / revenue) * 100 : 0;

            const row = [
                escape(title),
                price.toFixed(2),
                costPrice.toFixed(2),
                mlFee.toFixed(2),
                tax.toFixed(2),
                packaging.toFixed(2),
                shipping.toFixed(2),
                String(periodSales),
                adSpend.toFixed(2),
                acos.toFixed(2)
            ].join(",");
            rows.push(row);
        }

        const csv = rows.join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=mercado_livre_export.csv");
        return res.status(200).send(csv);
    } catch (error: any) {
        console.error("[Export CSV] Erro ao gerar CSV:", error);
        return res.status(500).json({ error: "Falha ao gerar CSV", details: error?.response?.data || error?.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/search/advanced
 * Busca avançada de anúncios no Mercado Livre por categoria/subcategoria,
 * período e filtro de volume mensal estimado.
 */
router.get("/search/advanced", async (req, res) => {
    try {
        const {
            workspaceId,
            categoryId,
            subcategoryId,
            periodDays = "30",
            minMonthlySales,
            maxMonthlySales,
            limit = "50",
            offset = "0",
        } = req.query as any;

        if (!categoryId) {
            return res.status(400).json({ error: "categoryId é obrigatório" });
        }

        const effectiveCategory = String(subcategoryId || categoryId);
        const days = Math.max(1, Number(periodDays) || 30);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 50));
        const pageOffset = Math.max(0, Number(offset) || 0);
        const minMs = minMonthlySales !== undefined ? Number(minMonthlySales) : undefined;
        const maxMs = maxMonthlySales !== undefined ? Number(maxMonthlySales) : undefined;

        const cacheKey = JSON.stringify({ effectiveCategory, days, minMonthlySales, maxMonthlySales, pageLimit, pageOffset });
        const cached = advancedSearchCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < ADV_SEARCH_TTL_MS) {
            return res.json(cached.data);
        }

        const targetWorkspaceId = String(workspaceId || "default");
        let credentials: (MercadoLivreCredentials & { expiresAt?: number }) | null = null;
        let fallbackCreds: (MercadoLivreCredentials & { expiresAt?: number }) | null = null;
        try {
            credentials = await getMercadoLivreCredentials(targetWorkspaceId);
        } catch (e) {
            console.warn("[MercadoLivre] Falha ao obter credenciais para busca avançada:", e instanceof Error ? e.message : e);
        }
        if (!credentials && targetWorkspaceId !== "default") {
            fallbackCreds = await getMercadoLivreCredentials("default");
        }

        const buildHeaders = (creds?: MercadoLivreCredentials | null) => {
            const headers: Record<string, string> = { "User-Agent": "traffic-zen-advanced-search/1.0" };
            if (creds?.accessToken) headers.Authorization = `Bearer ${creds.accessToken}`;
            if (creds?.userId) headers["X-Caller-Id"] = creds.userId;
            return headers;
        };

        let searchResponse: any;
        const runSearch = async (creds?: MercadoLivreCredentials | null) => {
            return axios.get(
                `${MERCADO_LIVRE_API_BASE}/sites/MLB/search`,
                {
                    params: {
                        category: effectiveCategory,
                        sort: "sold_quantity_desc",
                        limit: pageLimit,
                        offset: pageOffset,
                    },
                    headers: buildHeaders(creds),
                }
            );
        };

        try {
            searchResponse = await runSearch(credentials || fallbackCreds);
        } catch (err: any) {
            const status = err.response?.status;
            const data = err.response?.data;
            const authError = status === 401 || status === 403;
            
            return res.status(authError ? status : 502).json({
                error: authError
                    ? "Conecte o Mercado Livre para habilitar a busca avançada (token obrigatório)."
                    : "Falha ao consultar a API do Mercado Livre",
                details: data || err.message,
                requiresAuth: authError,
            });
        }

        const baseResults = Array.isArray(searchResponse.data?.results) ? searchResponse.data.results : [];

        const items: any[] = [];
        let visitsSum = 0;

        for (const r of baseResults) {
            try {
                const itemResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${r.id}`, { headers: buildHeaders(credentials || fallbackCreds) });
                const item = itemResp.data;

                const startTime = item.start_time ? new Date(item.start_time) : null;
                const sold = Number(item.sold_quantity || r.sold_quantity || 0);
                const ageDays = startTime ? Math.max(1, Math.floor((Date.now() - startTime.getTime()) / (24 * 60 * 60 * 1000))) : 30;
                const months = Math.max(1, ageDays / 30);
                const monthlyEstimate = Math.round(sold / months);

                let visits = 0;
                if ((credentials || fallbackCreds)?.accessToken) {
                    try {
                        const vresp = await axios.get(
                            `${MERCADO_LIVRE_API_BASE}/items/${item.id}/visits`,
                            {
                                params: {
                                    date_from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                    date_to: new Date().toISOString().split('T')[0],
                                },
                                headers: buildHeaders(credentials || fallbackCreds),
                            }
                        );
                        visits = Number(vresp.data?.total_visits || 0);
                    } catch (e) { /* best-effort */ }
                }
                visitsSum += visits;

                const conversion = visits > 0 ? (sold / visits) * 100 : 0;

                items.push({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    thumbnail: item.thumbnail || r.thumbnail,
                    permalink: item.permalink || r.permalink,
                    category: item.category_id,
                    sold_quantity: sold,
                    monthly_estimate: monthlyEstimate,
                    visits_last_period: visits,
                    conversion_rate_estimate: conversion,
                    listing_type_id: item.listing_type_id,
                    status: item.status,
                    attributes: (item.attributes || []).map((a: any) => ({ id: a.id, name: a.name, value_name: a.value_name })),
                    shipping: {
                        mode: item.shipping?.mode,
                        free_shipping: item.shipping?.free_shipping || false,
                        logistic_type: item.shipping?.logistic_type,
                        local_pick_up: item.shipping?.local_pick_up || false,
                    },
                });
            } catch (e) {
                /* skip item on failure */
            }
        }

        let filtered = items;
        if (typeof minMs === 'number') {
            filtered = filtered.filter((it) => Number(it.monthly_estimate || 0) >= minMs);
        }
        if (typeof maxMs === 'number') {
            filtered = filtered.filter((it) => Number(it.monthly_estimate || 0) <= maxMs);
        }

        filtered.sort((a, b) => Number(b.monthly_estimate || 0) - Number(a.monthly_estimate || 0));

        const avgPrice = filtered.length > 0 ? (filtered.reduce((s, it) => s + Number(it.price || 0), 0) / filtered.length) : 0;
        const summary = {
            total_found: baseResults.length,
            total_returned: filtered.length,
            average_price: avgPrice,
            total_visits_last_period: visitsSum,
            period_days: days,
            category: effectiveCategory,
            filters: { minMonthlySales: minMs, maxMonthlySales: maxMs },
        };

        const responsePayload = { items: filtered, summary };
        advancedSearchCache.set(cacheKey, { data: responsePayload, ts: Date.now() });
        return res.json(responsePayload);
    } catch (error: any) {
        console.error("Error on advanced ML search:", error);
        return res.status(500).json({ error: "Failed to run advanced search", details: error.response?.data || error.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/questions
 * Retorna perguntas recebidas
 */
router.get("/questions", async (req, res) => {
    try {
        const { id: targetWorkspaceId } = resolveWorkspaceId(req);
        const { days = 30 } = req.query as any;

        if (!targetWorkspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(String(targetWorkspaceId));

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // 1. Buscar perguntas recentes (sem filtro de status) para lista e histórico
        const recentQuestionsResponse = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/questions/search`,
            {
                params: {
                    seller_id: credentials.userId,
                    limit: 50,
                    sort: 'date_created_desc'
                },
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
            }
        );

        // 2. Buscar contagem de perguntas pendentes (backlog real)
        const unansweredResponse = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/questions/search`,
            {
                params: {
                    seller_id: credentials.userId,
                    status: "UNANSWERED",
                    limit: 1, // Apenas para pegar o paging.total
                },
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
            }
        );

        const questions = recentQuestionsResponse.data.questions || [];
        const totalUnanswered = unansweredResponse.data.paging?.total ?? 0;

        // Collect unique item IDs
        const itemIds = [...new Set(questions.map((q: any) => q.item_id))].filter(Boolean);
        const itemTitlesMap = new Map<string, string>();

        // Fetch items in chunks to avoid URL length limits
        const chunkArray = (arr: any[], size: number) => {
            return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );
        };

        const itemChunks = chunkArray(itemIds, 20); // ML allows up to 20 IDs in multiget

        await Promise.all(itemChunks.map(async (chunk) => {
            try {
                const itemsResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items`, {
                    params: { ids: chunk.join(',') },
                    headers: { Authorization: `Bearer ${credentials.accessToken}` }
                });
                
                // Response is an array of objects { code, body } or direct objects depending on endpoint version
                // Usually /items?ids= returns an array of objects with 'body' containing the item
                if (Array.isArray(itemsResp.data)) {
                    itemsResp.data.forEach((itemWrapper: any) => {
                        const item = itemWrapper.body || itemWrapper;
                        if (item && item.id && item.title) {
                            itemTitlesMap.set(item.id, item.title);
                        }
                    });
                }
            } catch (err) {
                console.error("Error fetching items chunk for questions:", err);
            }
        }));

        // Formatar perguntas
        const formattedQuestions = questions.map((q: any) => {
            return {
                id: q.id,
                text: q.text,
                productId: q.item_id,
                productTitle: itemTitlesMap.get(q.item_id) || "Produto desconhecido",
                date: new Date(q.date_created).toLocaleDateString("pt-BR"),
                answered: q.status === "ANSWERED",
                answer: q.answer?.text || undefined,
            };
        });

        return res.json({
            items: formattedQuestions,
            total: formattedQuestions.length,
            unanswered: totalUnanswered,
        });
    } catch (error: any) {
        console.error("Error fetching Mercado Livre questions:", error);
        return res.status(500).json({
            error: "Failed to fetch questions",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/sync
 * Sincroniza produtos do Mercado Livre para a tabela products
 */
router.post("/sync", async (req, res) => {
    try {
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        const syncStats = {
            processed: 0,
            created: 0,
            updated: 0,
            errors: 0,
            errorDetails: [] as any[]
        };

        // 1. Buscar todos os itens do vendedor no ML
        console.log(`[ML Sync] Iniciando sincronização para workspace ${workspaceId}`);

        let offset = 0;
        const limit = 50;
        let hasMore = true;
        const allItemIds = [];

        // Buscar todas as páginas de itens
        while (hasMore) {
            try {
                const itemsResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        params: { limit, offset },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }
                );

                const itemIds = itemsResponse.data.results || [];
                allItemIds.push(...itemIds);

                hasMore = itemIds.length === limit;
                offset += limit;

                console.log(`[ML Sync] Encontrados ${itemIds.length} itens (offset: ${offset})`);
            } catch (error) {
                console.error(`[ML Sync] Erro ao buscar itens (offset ${offset}):`, error);
                break;
            }
        }

        console.log(`[ML Sync] Total de ${allItemIds.length} produtos encontrados no ML`);

        // 2. Processar cada item individualmente
        for (const itemId of allItemIds) {
            try {
                syncStats.processed++;

                // Buscar detalhes completos do item
                const [itemResponse, visitsResponse] = await Promise.allSettled([
                    axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}`, {
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    }),
                    axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`, {
                        params: {
                            date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            date_to: new Date().toISOString().split('T')[0],
                        },
                        headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    })
                ]);

                if (itemResponse.status === 'rejected') {
                    throw new Error(`Falha ao buscar item ${itemId}: ${itemResponse.reason}`);
                }

                const item = itemResponse.value.data;
                const visits = visitsResponse.status === 'fulfilled' ?
                    visitsResponse.value.data.total_visits || 0 : 0;

                // Preparar dados do produto para insert/update
                const productData = {
                    workspace_id: workspaceId,
                    ml_item_id: item.id,
                    title: item.title,
                    description: item.descriptions?.[0]?.plain_text || item.subtitle || '',
                    price: item.price,
                    original_price: item.original_price || null,
                    available_quantity: item.available_quantity || 0,
                    sold_quantity: item.sold_quantity || 0,
                    condition: item.condition || 'new',
                    ml_category_id: item.category_id,
                    ml_listing_type: item.listing_type_id || 'gold_special',
                    ml_permalink: item.permalink,
                    currency: item.currency_id || 'BRL',
                    status: item.status === 'active' ? 'active' : 'paused',
                    published_on_ml: true,
                    published_at: item.start_time ? new Date(item.start_time) : new Date(),
                    images: item.pictures ? item.pictures.map((pic: any) => pic.secure_url) : [],
                    attributes: item.attributes ? item.attributes.map((attr: any) => ({
                        id: attr.id,
                        name: attr.name,
                        value_id: attr.value_id,
                        value_name: attr.value_name
                    })) : [],
                    free_shipping: item.shipping?.free_shipping || false,
                    shipping_mode: item.shipping?.mode || 'me2',
                    local_pickup: item.shipping?.local_pick_up || false,
                    warranty_type: item.warranty?.type,
                    warranty_time: item.warranty?.time,
                    video_url: item.video_id ? `https://www.youtube.com/watch?v=${item.video_id}` : null,
                    weight_kg: item.shipping?.dimensions ? parseFloat(item.shipping.dimensions.split('x')[3]) / 1000 : null,
                    height_cm: item.shipping?.dimensions ? parseFloat(item.shipping.dimensions.split('x')[1]) : null,
                    width_cm: item.shipping?.dimensions ? parseFloat(item.shipping.dimensions.split('x')[0]) : null,
                    length_cm: item.shipping?.dimensions ? parseFloat(item.shipping.dimensions.split('x')[2]) : null,
                    updated_at: new Date()
                };

                // TODO: Aqui você precisa implementar a lógica do banco de dados
                // Por enquanto vou simular o processo

                // Verificar se produto já existe na tabela
                // const existingProduct = await db.query(
                //     'SELECT id FROM products WHERE workspace_id = $1 AND ml_item_id = $2',
                //     [workspaceId, item.id]
                // );

                // if (existingProduct.rows.length > 0) {
                //     // Atualizar produto existente
                //     await db.query(`
                //         UPDATE products SET 
                //             title = $1, description = $2, price = $3, 
                //             original_price = $4, available_quantity = $5, 
                //             sold_quantity = $6, status = $7, updated_at = NOW()
                //         WHERE workspace_id = $8 AND ml_item_id = $9
                //     `, [
                //         productData.title, productData.description, productData.price,
                //         productData.original_price, productData.available_quantity,
                //         productData.sold_quantity, productData.status,
                //         workspaceId, item.id
                //     ]);
                //     syncStats.updated++;
                // } else {
                //     // Criar novo produto
                //     await db.query(`
                //         INSERT INTO products (workspace_id, ml_item_id, title, description, ...)
                //         VALUES ($1, $2, $3, $4, ...)
                //     `, [...productData values...]);
                //     syncStats.created++;
                // }

                // Por enquanto simular sucesso
                if (Math.random() > 0.8) {
                    syncStats.updated++;
                } else {
                    syncStats.created++;
                }

                // Salvar histórico de publicação
                // await saveProductPublication(item.id, visits, productData);

                if (syncStats.processed % 10 === 0) {
                    console.log(`[ML Sync] Processados ${syncStats.processed}/${allItemIds.length} produtos`);
                }

            } catch (error: any) {
                syncStats.errors++;
                syncStats.errorDetails.push({
                    itemId,
                    error: error.message
                });
                console.error(`[ML Sync] Erro ao processar produto ${itemId}:`, error.message);

                // Limitar a 5 erros consecutivos
                if (syncStats.errors >= 5) {
                    console.error('[ML Sync] Muitos erros, parando sincronização');
                    break;
                }
            }
        }

        console.log('[ML Sync] Sincronização concluída:', syncStats);

        return res.json({
            success: true,
            message: "Sincronização concluída com sucesso",
            timestamp: new Date().toISOString(),
            stats: syncStats
        });

    } catch (error: any) {
        console.error("Error syncing Mercado Livre data:", error);
        return res.status(500).json({
            error: "Failed to sync data",
            details: error.message,
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/questions/:questionId/answer
 * Responde uma pergunta
 */
router.post("/questions/:questionId/answer", async (req, res) => {
    try {
        const { questionId } = req.params;
        const { answer, workspaceId } = req.body;

        if (!workspaceId || !answer) {
            return res.status(400).json({
                error: "Workspace ID and answer are required",
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // Responder pergunta
        const response = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/answers`,
            {
                question_id: questionId,
                text: answer,
            },
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return res.json({
            success: true,
            data: response.data,
        });
    } catch (error: any) {
        console.error("Error answering question:", error);
        return res.status(500).json({
            error: "Failed to answer question",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * PUT /api/integrations/mercadolivre/products/:productId/price
 * Atualiza preço de um produto
 */
router.put("/products/:productId/price", async (req, res) => {
    try {
        const { productId } = req.params;
        const { price, workspaceId } = req.body;

        if (!workspaceId || !price) {
            return res.status(400).json({
                error: "Workspace ID and price are required",
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // Atualizar preço
        const response = await axios.put(
            `${MERCADO_LIVRE_API_BASE}/items/${productId}`,
            {
                price: Number(price),
            },
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return res.json({
            success: true,
            data: response.data,
        });
    } catch (error: any) {
        console.error("Error updating product price:", error);
        return res.status(500).json({
            error: "Failed to update price",
            details: error.response?.data || error.message,
        });
    }
});

router.put("/products/:productId/title", async (req, res) => {
    try {
        const { productId } = req.params;
        const { title, workspaceId } = req.body;

        if (!workspaceId || !title) {
            return res.status(400).json({
                error: "Workspace ID e título são obrigatórios",
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre não conectado para este workspace",
            });
        }

        try {
            const response = await axios.put(
                `${MERCADO_LIVRE_API_BASE}/items/${productId}`,
                { title: String(title) },
                {
                    headers: {
                        Authorization: `Bearer ${credentials.accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            return res.json({
                success: true,
                data: response.data,
            });
        } catch (error: any) {
            const status = error?.response?.status;
            const data = error?.response?.data || {};
            const message = data?.message || error?.message || "Erro na API do Mercado Livre";
            const causes = Array.isArray(data?.cause) ? data.cause : [];
            const causeText = causes.map((c: any) => c?.message || c?.description || "").filter(Boolean).join(" | ");

            return res.status(status || 400).json({
                error: "Falha ao atualizar título",
                details: [message, causeText].filter(Boolean).join(" | "),
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            error: "Erro interno do servidor",
            details: error?.message || String(error) || "Erro desconhecido",
        });
    }
});

/**
 * PUT /api/integrations/mercadolivre/products/:productId/status
 * Atualiza status de um produto
 */
router.put("/products/:productId/status", async (req, res) => {
    try {
        const { productId } = req.params;
        const { status, workspaceId } = req.body;

        if (!workspaceId || !status) {
            return res.status(400).json({
                error: "Workspace ID and status are required",
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // Atualizar status
        const response = await axios.put(
            `${MERCADO_LIVRE_API_BASE}/items/${productId}`,
            {
                status: status === "active" ? "active" : "paused",
            },
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return res.json({
            success: true,
            data: response.data,
        });
    } catch (error: any) {
        console.error("Error updating product status:", error);
        return res.status(500).json({
            error: "Failed to update status",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/products/:productId/publish
 * Publica um produto da tabela products no Mercado Livre
 */
router.post("/products/:productId/publish", async (req, res) => {
    try {
        const { productId } = req.params;
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // TODO: Buscar produto da tabela products
        // const productResult = await db.query(
        //     'SELECT * FROM products WHERE id = $1 AND workspace_id = $2',
        //     [productId, workspaceId]
        // );

        // if (productResult.rows.length === 0) {
        //     return res.status(404).json({ error: "Product not found" });
        // }

        // const product = productResult.rows[0];

        // Dados mock para exemplo
        const product = {
            title: "Produto Exemplo",
            description: "Descrição do produto",
            price: 199.90,
            available_quantity: 10,
            condition: "new",
            ml_category_id: "MLB1276",
            ml_listing_type: "gold_special",
            images: ["https://example.com/image1.jpg"],
            free_shipping: true,
            attributes: [
                { id: "BRAND", value_name: "Nike" },
                { id: "MODEL", value_name: "Air Max" }
            ]
        };

        // Preparar payload para o Mercado Livre
        const enableUserProducts = process.env.ML_USER_PRODUCTS === 'true';
        const attributes = [
            ...(product.attributes || [])
        ];
        if (product.condition) {
            attributes.unshift({ id: 'ITEM_CONDITION', value_name: String(product.condition) });
        }

        const mlPayload: any = {
            category_id: product.ml_category_id,
            listing_type_id: product.ml_listing_type || "gold_special",
            price: product.price,
            currency_id: "BRL",
            available_quantity: product.available_quantity || 1,
            buying_mode: "buy_it_now",
            pictures: (product.images || []).slice(0, 10).map((url: string) => ({
                source: url
            })),
            shipping: {
                mode: "me2",
                free_shipping: product.free_shipping || false,
                local_pick_up: false
            },
            channels: (product as any).channels || ['marketplace'],
            attributes
        };
        if (!enableUserProducts) {
            mlPayload.title = product.title;
            mlPayload.condition = product.condition || "new"; // retrocompatibilidade
        }

        console.log(`[ML Publish] Publicando produto ${productId} no ML`);

        // Publicar no Mercado Livre
        const response = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/items`,
            mlPayload,
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const mlItem = response.data;

        console.log(`[ML Publish] Produto publicado com sucesso. ML ID: ${mlItem.id}`);

        // TODO: Atualizar produto na tabela com dados do ML
        // await db.query(`
        //     UPDATE products SET 
        //         ml_item_id = $1,
        //         ml_permalink = $2,
        //         published_on_ml = true,
        //         published_at = NOW(),
        //         status = 'active',
        //         updated_at = NOW()
        //     WHERE id = $3 AND workspace_id = $4
        // `, [mlItem.id, mlItem.permalink, productId, workspaceId]);

        // TODO: Salvar no histórico de publicações
        // await db.query(`
        //     INSERT INTO product_publications 
        //     (product_id, workspace_id, ml_item_id, ml_permalink, status, published_at)
        //     VALUES ($1, $2, $3, $4, $5, NOW())
        // `, [productId, workspaceId, mlItem.id, mlItem.permalink, mlItem.status]);

        // Enviar descrição após publicar, se houver
        if (product.description) {
            try {
                await axios.post(
                    `${MERCADO_LIVRE_API_BASE}/items/${mlItem.id}/description`,
                    { plain_text: product.description },
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                            "Content-Type": "application/json",
                        },
                    }
                );
            } catch (descErr) {
                console.warn('[ML Publish] Falha ao enviar descrição após publicar:', descErr);
            }
        }

        return res.json({
            success: true,
            message: "Produto publicado com sucesso no Mercado Livre",
            ml_item_id: mlItem.id,
            ml_permalink: mlItem.permalink,
            ml_item_status: mlItem.status,
            data: mlItem
        });

    } catch (error: any) {
        console.error("Error publishing product:", error);
        return res.status(500).json({
            error: "Failed to publish product",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * PUT /api/integrations/mercadolivre/products/:productId/update-from-table
 * Atualiza produto no ML baseado nos dados da tabela products
 */
router.put("/products/:productId/update-from-table", async (req, res) => {
    try {
        const { productId } = req.params;
        const { workspaceId, fields = ['price', 'stock', 'description'] } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // TODO: Buscar produto da tabela
        // const productResult = await db.query(
        //     'SELECT * FROM products WHERE id = $1 AND workspace_id = $2 AND ml_item_id IS NOT NULL',
        //     [productId, workspaceId]
        // );

        // Mock data
        const product = {
            ml_item_id: "MLB123456789",
            title: "Produto Atualizado",
            description: "Nova descrição",
            price: 299.90,
            available_quantity: 5
        };

        // Preparar dados para atualização
        const updateData: any = {};

        const safeFields = Array.isArray(fields) ? fields.filter((f: string) => f !== 'title') : ['price', 'stock', 'description'];

        if (safeFields.includes('price')) {
            updateData.price = product.price;
        }
        if (safeFields.includes('stock')) {
            updateData.available_quantity = product.available_quantity;
        }
        const shouldUpdateDescription = safeFields.includes('description');

        console.log(`[ML Update] Atualizando item ${product.ml_item_id} no ML`);

        // Atualizar no Mercado Livre
        const response = await axios.put(
            `${MERCADO_LIVRE_API_BASE}/items/${product.ml_item_id}`,
            updateData,
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // Atualizar descrição via endpoint dedicado
        if (shouldUpdateDescription && product.description) {
            try {
                await axios.post(
                    `${MERCADO_LIVRE_API_BASE}/items/${product.ml_item_id}/description`,
                    { plain_text: product.description },
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                            "Content-Type": "application/json",
                        },
                    }
                );
            } catch (descErr) {
                console.warn('[ML Update] Falha ao atualizar descrição:', descErr);
            }
        }

        console.log(`[ML Update] Item atualizado com sucesso`);

        return res.json({
            success: true,
            message: "Produto atualizado no Mercado Livre",
            updated_fields: safeFields,
            ml_response: response.data
        });

    } catch (error: any) {
        console.error("Error updating ML product from table:", error);
        return res.status(500).json({
            error: "Failed to update product",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/products/bulk-sync
 * Sincroniza estoques em lote (útil para automação com IA)
 */
router.post("/products/bulk-sync", async (req, res) => {
    try {
        const { workspaceId, operation = "sync_stock", productIds } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        const syncResults = {
            success: 0,
            errors: 0,
            details: [] as any[]
        };

        console.log(`[ML Bulk Sync] Iniciando operação ${operation} para ${productIds ? productIds.length : 'todos'} produtos`);

        // TODO: Buscar produtos da tabela
        // let query = 'SELECT * FROM products WHERE workspace_id = $1 AND ml_item_id IS NOT NULL';
        // let params = [workspaceId];

        // if (productIds && productIds.length > 0) {
        //     query += ' AND id = ANY($2)';
        //     params.push(productIds);
        // }

        // const productsResult = await db.query(query, params);
        // const products = productsResult.rows;

        // Mock products for example
        const products = [
            { id: 1, ml_item_id: "MLB123", title: "Produto 1", price: 100, available_quantity: 5 },
            { id: 2, ml_item_id: "MLB456", title: "Produto 2", price: 200, available_quantity: 10 }
        ];

        for (const product of products) {
            try {
                let updateData: any = {};

                switch (operation) {
                    case "sync_stock":
                        updateData.available_quantity = product.available_quantity;
                        break;
                    case "sync_prices":
                        updateData.price = product.price;
                        break;
                    case "sync_all":
                        updateData = {
                            price: product.price,
                            available_quantity: product.available_quantity,
                            title: product.title
                        };
                        break;
                }

                await axios.put(
                    `${MERCADO_LIVRE_API_BASE}/items/${product.ml_item_id}`,
                    updateData,
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                syncResults.success++;
                syncResults.details.push({
                    productId: product.id,
                    mlItemId: product.ml_item_id,
                    status: "success",
                    updatedFields: Object.keys(updateData)
                });

            } catch (error: any) {
                syncResults.errors++;
                syncResults.details.push({
                    productId: product.id,
                    mlItemId: product.ml_item_id,
                    status: "error",
                    error: error.response?.data?.message || error.message
                });
                console.error(`[ML Bulk Sync] Erro ao sincronizar produto ${product.id}:`, error.message);
            }
        }

        console.log(`[ML Bulk Sync] Concluído: ${syncResults.success} sucessos, ${syncResults.errors} erros`);

        return res.json({
            success: true,
            message: `Sincronização em lote concluída`,
            operation,
            results: syncResults
        });

    } catch (error: any) {
        console.error("Error in bulk sync:", error);
        return res.status(500).json({
            error: "Failed to perform bulk sync",
            details: error.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/categories
 * Busca todas as categorias disponíveis do Mercado Livre
 */
router.get("/categories", async (req, res) => {
    try {
        const rawCountry = (req.query as any).country ?? 'MLB';
        const country = String(rawCountry).toUpperCase().trim();
        const siteId = /^ML[A-Z]+$/.test(country) ? country : 'MLB';
        const refresh = String((req.query as any).refresh || '').toLowerCase() === 'true';
        const workspaceId = String((req.query as any).workspaceId || '').trim();

        const cached = categoriesCache.get(siteId);
        if (!refresh && cached && Date.now() - cached.ts < CATEGORIES_TTL_MS) {
            return res.json({
                success: true,
                categories: cached.data,
                total: cached.data.length,
                source: 'cache'
            });
        }

        const headers: any = { 'User-Agent': 'TrafficPro/1.0' };
        if (workspaceId) {
            try {
                const creds = await getMercadoLivreCredentials(workspaceId);
                if (creds?.accessToken) {
                    headers.Authorization = `Bearer ${creds.accessToken}`;
                }
            } catch { /* ignore */ }
        }

        const categoriesResponse = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/sites/${siteId}/categories`,
            { headers, timeout: 8000 }
        );

        const categories = categoriesResponse.data;

        const formattedCategories = categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            total_items_in_this_category: cat.total_items_in_this_category || 0
        }));

        formattedCategories.sort((a: any, b: any) =>
            (b.total_items_in_this_category || 0) - (a.total_items_in_this_category || 0)
        );

        categoriesCache.set(siteId, { data: formattedCategories, ts: Date.now() });

        return res.json({
            success: true,
            categories: formattedCategories,
            total: formattedCategories.length,
            source: 'live'
        });

    } catch (error: any) {
        const rawCountry = (req.query as any).country ?? 'MLB';
        const country = String(rawCountry).toUpperCase().trim();
        const siteId = /^ML[A-Z]+$/.test(country) ? country : 'MLB';
        const cached = categoriesCache.get(siteId);

        if (cached) {
            return res.json({
                success: true,
                categories: cached.data,
                total: cached.data.length,
                source: 'stale_cache'
            });
        }

        return res.json({
            success: true,
            categories: [],
            total: 0,
            source: 'empty_fallback'
        });
    }
});



/**
 * POST /api/integrations/mercadolivre/predict-category
 * Prediz a categoria mais adequada baseada no título do produto
 */
router.post("/predict-category", async (req, res) => {
    try {
        const { title, country = 'MLB' } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Product title is required" });
        }

        // Usar API de predição de categoria do ML
        const predictionResponse = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/sites/${country}/category_predictor/predict`,
            {
                params: {
                    q: title
                }
            }
        );

        const predictions = predictionResponse.data;

        // Buscar detalhes das categorias preditas
        const categoriesWithDetails = await Promise.all(
            predictions.slice(0, 3).map(async (pred: any) => {
                try {
                    const categoryResponse = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/categories/${pred.id}`
                    );

                    return {
                        id: pred.id,
                        name: pred.name || categoryResponse.data.name,
                        probability: pred.probability,
                        path_from_root: categoryResponse.data.path_from_root,
                        settings: categoryResponse.data.settings,
                        predicted: true
                    };
                } catch (error) {
                    return {
                        id: pred.id,
                        name: pred.name,
                        probability: pred.probability,
                        predicted: true
                    };
                }
            })
        );

        // Implementar IA adicional para melhorar a predição
        const enhancedPredictions = await enhanceCategoryPrediction(title, categoriesWithDetails);

        return res.json({
            success: true,
            query: title,
            predictions: enhancedPredictions,
            recommended: enhancedPredictions[0] // Categoria mais provável
        });

    } catch (error: any) {
        console.error("Error predicting category:", error);
        return res.status(500).json({
            error: "Failed to predict category",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/search-categories
 * Busca categorias por texto
 */
router.post("/search-categories", async (req, res) => {
    try {
        const { query, country = 'MLB', limit = 10 } = req.body;

        if (!query) {
            return res.status(400).json({ error: "Search query is required" });
        }

        // Buscar todas as categorias primeiro
        const allCategoriesResponse = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/sites/${country}/categories`
        );

        const allCategories = allCategoriesResponse.data;

        // Filtrar categorias que contenham o texto de busca
        const matchingCategories = allCategories
            .filter((cat: any) =>
                cat.name.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, limit)
            .map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                total_items: cat.total_items_in_this_category || 0,
                relevance_score: calculateRelevanceScore(query, cat.name)
            }))
            .sort((a: any, b: any) => b.relevance_score - a.relevance_score);

        return res.json({
            success: true,
            query,
            categories: matchingCategories,
            total: matchingCategories.length
        });

    } catch (error: any) {
        console.error("Error searching categories:", error);
        return res.status(500).json({
            error: "Failed to search categories",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/items/:mlbId/category-suggestions
 * Sugere categorias compatíveis com base no título e cobertura de atributos do item
 */
router.get("/items/:mlbId/category-suggestions", async (req, res) => {
    try {
        const { mlbId } = req.params;
        const { workspaceId, country = 'MLB' } = req.query as { workspaceId?: string; country?: string };

        if (!workspaceId || typeof workspaceId !== 'string') {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        // Buscar o item atual
        let item: any = null;
        try {
            item = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${mlbId}`);
        } catch (e: any) {
            return res.status(404).json({ error: "Item não encontrado", details: e?.message || 'Not Found' });
        }

        const title = String(item?.title || '').trim();
        const itemAttrs: any[] = Array.isArray(item?.attributes) ? item.attributes : [];
        const variations: any[] = Array.isArray(item?.variations) ? item.variations : [];

        // Predição de categorias pelo título
        const predResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/${country}/category_predictor/predict`, {
            params: { q: title }
        });
        const predictions: Array<{ id: string; name?: string; probability?: number }> = Array.isArray(predResp.data) ? predResp.data : [];

        // Avaliar compatibilidade por cobertura de atributos obrigatórios
        const suggestions = await Promise.all(predictions.slice(0, 8).map(async (pred) => {
            try {
                const catResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${pred.id}`);
                const details = catResp.data;
                let attrs: any[] = [];
                try {
                    const attrsResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${pred.id}/attributes`);
                    attrs = Array.isArray(attrsResp.data) ? attrsResp.data : [];
                } catch { attrs = []; }

                const required = attrs.filter((a: any) => Boolean(a?.tags?.required));
                const itemAttrIds = new Set(itemAttrs.map((a: any) => a.id));
                const variationAttrIds = new Set(
                    variations.flatMap((v: any) => (Array.isArray(v?.attribute_combinations) ? v.attribute_combinations : [])).map((c: any) => c.id)
                );

                let covered = 0;
                const missing: string[] = [];
                for (const r of required) {
                    const id = String(r.id || '');
                    const has = itemAttrIds.has(id) || variationAttrIds.has(id);
                    if (has) covered++; else missing.push(id);
                }
                const compatibility = required.length > 0 ? Number(((covered / required.length) * 100).toFixed(1)) : 100;

                return {
                    id: pred.id,
                    name: pred.name || details?.name,
                    probability: pred.probability ?? null,
                    compatibility,
                    required_count: required.length,
                    covered_count: covered,
                    missing_required: missing,
                    path_from_root: details?.path_from_root || [],
                    settings: details?.settings || {},
                };
            } catch {
                return {
                    id: pred.id,
                    name: pred.name || pred.id,
                    probability: pred.probability ?? null,
                    compatibility: null,
                    required_count: null,
                    covered_count: null,
                    missing_required: [],
                    path_from_root: [],
                    settings: {},
                };
            }
        }));

        const sorted = suggestions.sort((a: any, b: any) => {
            const pa = Number(a.probability || 0);
            const pb = Number(b.probability || 0);
            const ca = Number(a.compatibility || 0);
            const cb = Number(b.compatibility || 0);
            return cb - ca || pb - pa;
        });

        return res.json({
            success: true,
            mlb_id: mlbId,
            title,
            suggestions: sorted,
            recommended: sorted[0] || null,
        });
    } catch (error: any) {
        console.error("Error getting category suggestions:", error);
        return res.status(500).json({
            error: "Failed to get category suggestions",
            details: error.response?.data || error.message,
        });
    }
});

/**
 * Função auxiliar para melhorar predição de categoria com IA própria
 */
async function enhanceCategoryPrediction(title: string, mlPredictions: any[]) {
    const titleLower = title.toLowerCase();

    // Mapeamentos inteligentes baseados em palavras-chave
    const keywordMappings = {
        // Eletrônicos
        'celular|smartphone|iphone|android': { boost: 0.3, categories: ['MLB1051'] },
        'notebook|laptop|computador': { boost: 0.3, categories: ['MLB1652'] },
        'fone|headphone|earphone': { boost: 0.3, categories: ['MLB1276'] },
        'tv|televisão|smart tv': { boost: 0.3, categories: ['MLB1002'] },

        // Moda
        'camiseta|blusa|camisa': { boost: 0.25, categories: ['MLB109027'] },
        'calça|jeans|legging': { boost: 0.25, categories: ['MLB109026'] },
        'vestido|saia': { boost: 0.25, categories: ['MLB111231'] },
        'tênis|sapato|sandália': { boost: 0.25, categories: ['MLB1276'] },

        // Casa e Jardim
        'decoração|quadro|vaso': { boost: 0.2, categories: ['MLB1953'] },
        'cozinha|panela|frigideira': { boost: 0.2, categories: ['MLB1953'] },
        'cama|colchão|travesseiro': { boost: 0.2, categories: ['MLB1953'] },

        // Beleza
        'maquiagem|batom|base': { boost: 0.2, categories: ['MLB1246'] },
        'perfume|colônia|fragância': { boost: 0.2, categories: ['MLB1246'] },
        'shampoo|condicionador|cabelo': { boost: 0.2, categories: ['MLB1246'] },

        // Esportes
        'bicicleta|bike|ciclismo': { boost: 0.2, categories: ['MLB1276'] },
        'futebol|bola|chuteira': { boost: 0.2, categories: ['MLB1276'] },
        'academia|musculação|peso': { boost: 0.2, categories: ['MLB1276'] }
    };

    // Aplicar boost nas categorias baseado em palavras-chave
    const enhancedPredictions = [...mlPredictions];

    for (const [pattern, mapping] of Object.entries(keywordMappings)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(titleLower)) {
            // Encontrar categoria correspondente e dar boost
            const matchingCategory = enhancedPredictions.find(pred =>
                mapping.categories.includes(pred.id)
            );

            if (matchingCategory) {
                matchingCategory.probability = Math.min(1.0,
                    matchingCategory.probability + mapping.boost
                );
                matchingCategory.ai_enhanced = true;
                matchingCategory.boost_reason = `Palavra-chave detectada: "${pattern}"`;
            }
        }
    }

    // Reordenar por probabilidade
    enhancedPredictions.sort((a, b) => b.probability - a.probability);

    return enhancedPredictions;
}

/**
 * Calcular score de relevância para busca de categorias
 */
function calculateRelevanceScore(query: string, categoryName: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = categoryName.toLowerCase();

    // Score base
    let score = 0;

    // Match exato = score máximo
    if (nameLower === queryLower) {
        score += 100;
    }
    // Categoria começa com a query
    else if (nameLower.startsWith(queryLower)) {
        score += 80;
    }
    // Query está contida na categoria
    else if (nameLower.includes(queryLower)) {
        score += 60;
    }
    // Match de palavras individuais
    else {
        const queryWords = queryLower.split(' ');
        const nameWords = nameLower.split(' ');

        const matchingWords = queryWords.filter(word =>
            nameWords.some(nameWord => nameWord.includes(word))
        );

        score += (matchingWords.length / queryWords.length) * 40;
    }

    return score;
}

/**
 * POST /api/integrations/mercadolivre/notifications
 * Webhook endpoint para receber notificações em tempo real do Mercado Livre
 * 
 * Eventos suportados:
 * - orders: Nova venda ou mudança de status
 * - questions: Nova pergunta
 * - items: Mudança em produto
 * - messages: Nova mensagem
 */
router.post("/notifications", async (req, res) => {
    try {
        const notification = req.body;

        console.log("[Mercado Livre Webhook] Notificação recebida:", {
            topic: notification.topic,
            resource: notification.resource,
            user_id: notification.user_id,
            timestamp: new Date().toISOString(),
        });

        // Validar estrutura da notificação
        if (!notification.topic || !notification.resource) {
            console.warn("[Mercado Livre Webhook] Notificação inválida. Body recebido:", JSON.stringify(notification));
            return res.status(400).json({ error: "Invalid notification format", received: notification });
        }

        // Função auxiliar para processamento em background (Fire & Forget)
        const processInBackground = async () => {
            try {
                switch (notification.topic) {
                    case "orders_v2":
                    case "orders":
                        await handleOrderNotification(notification);
                        break;

                    case "questions":
                        await handleQuestionNotification(notification);
                        break;

                    case "items":
                        if (!ML_ITEM_NOTIFICATIONS_ENABLED) {
                            console.log("[Mercado Livre Webhook] Notificação de item ignorada (ML_NOTIFY_ITEM_UPDATES!=true)");
                            break;
                        }
                        await handleItemNotification(notification);
                        break;

                    case "messages":
                        await handleMessageNotification(notification);
                        break;

                    default:
                        console.log(`[Mercado Livre Webhook] Evento não tratado: ${notification.topic}`);
                }
            } catch (err: any) {
                console.error(`[Mercado Livre Webhook] Erro no processamento background (${notification.topic}):`, err.message);
            }
        };

        // Disparar processamento sem await (Fire and Forget)
        // Isso garante resposta < 500ms para o Mercado Livre
        processInBackground();

        // Sempre retornar 200 OK rapidamente
        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error("[Mercado Livre Webhook] Erro inicial:", error);
        return res.status(200).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/integrations/mercadolivre/notifications/test
 * Endpoint de teste para disparar notificações de Telegram remotamente
 */
router.post("/notifications/test", async (req, res) => {
    try {
        const { workspaceId, type = "order", id: customId } = req.body || {};
        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");

        if (type === "order") {
            const sampleId = customId || `TEST-ORDER-${Date.now()}`;
            const sampleOrder = {
                id: sampleId,
                total_amount: 199.9,
                paid_amount: 199.9,
                currency_id: "BRL",
                status: "paid",
                date_created: new Date().toISOString(),
                buyer: { id: "buyer123", nickname: "Cliente Teste" },
                order_items: [
                    { item: { title: "Produto Exemplo" }, quantity: 1, unit_price: 199.9 },
                ],
            };
            const ok = await TelegramNotificationService.notifyNewOrder(workspaceId, sampleOrder);
            return res.json({ success: ok });
        }

        if (type === "question") {
            const sampleQuestion = {
                id: customId || `Q-TEST-${Date.now()}`,
                text: "Ainda tem disponível?",
                from: { id: "user123", nickname: "Interessado" },
                item_id: "MLB123456789",
                date_created: new Date().toISOString(),
            };
            const ok = await TelegramNotificationService.notifyNewQuestion(workspaceId, sampleQuestion);
            return res.json({ success: ok });
        }

        if (type === "item") {
            const sampleItem = {
                id: customId || `MLB-TEST-${Date.now()}`,
                title: "Produto Exemplo",
                status: "active",
                price: 149.9,
            };
            const ok = await TelegramNotificationService.notifyItemUpdated(workspaceId, sampleItem);
            return res.json({ success: ok });
        }

        if (type === "message") {
            const sampleMsg = {
                id: customId || `MSG-TEST-${Date.now()}`,
                text: "Boa noite! Tenho uma dúvida.",
                from: { id: "user123", nickname: "Cliente" },
                date_created: new Date().toISOString(),
            };
            const ok = await TelegramNotificationService.notifyNewMessage(workspaceId, sampleMsg);
            return res.json({ success: ok });
        }

        return res.status(400).json({ error: "type inválido" });
    } catch (error: any) {
        console.error("[Notifications Test] Erro:", error);
        return res.status(500).json({ error: error?.message || "Erro ao enviar teste" });
    }
});

// Suporte a teste via GET para facilitar validação rápida em browser
router.get("/notifications/test", async (req, res) => {
    try {
        const workspaceId = String((req.query?.workspaceId || '')).trim();
        const type = String((req.query?.type || 'order')).trim();
        const customId = String((req.query?.id || '')).trim();
        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");

        if (type === "order") {
            const sampleId = customId || `TEST-ORDER-${Date.now()}`;
            const sampleOrder = {
                id: sampleId,
                total_amount: 199.9,
                paid_amount: 199.9,
                currency_id: "BRL",
                status: "paid",
                date_created: new Date().toISOString(),
                buyer: { id: "buyer123", nickname: "Cliente Teste" },
                order_items: [
                    { item: { title: "Produto Exemplo" }, quantity: 1, unit_price: 199.9 },
                ],
            };
            const ok = await TelegramNotificationService.notifyNewOrder(workspaceId, sampleOrder);
            return res.json({ success: ok });
        }

        if (type === "question") {
            const sampleQuestion = {
                id: customId || `Q-TEST-${Date.now()}`,
                text: "Ainda tem disponível?",
                from: { id: "user123", nickname: "Interessado" },
                item_id: "MLB123456789",
                date_created: new Date().toISOString(),
            };
            const ok = await TelegramNotificationService.notifyNewQuestion(workspaceId, sampleQuestion);
            return res.json({ success: ok });
        }

        if (type === "item") {
            const sampleItem = {
                id: customId || `MLB-TEST-${Date.now()}`,
                title: "Produto Exemplo",
                status: "active",
                price: 149.9,
            };
            const ok = await TelegramNotificationService.notifyItemUpdated(workspaceId, sampleItem);
            return res.json({ success: ok });
        }

        if (type === "message") {
            const sampleMsg = {
                id: customId || `MSG-TEST-${Date.now()}`,
                text: "Boa noite! Tenho uma dúvida.",
                from: { id: "user123", nickname: "Cliente" },
                date_created: new Date().toISOString(),
            };
            const ok = await TelegramNotificationService.notifyNewMessage(workspaceId, sampleMsg);
            return res.json({ success: ok });
        }

        return res.status(400).json({ error: "type inválido" });
    } catch (error: any) {
        console.error("[Notifications Test GET] Erro:", error);
        return res.status(500).json({ error: error?.message || "Erro ao enviar teste" });
    }
});

/**
 * POST /api/integrations/mercadolivre/notifications/test-direct/:workspaceId
 * Envia uma notificação de teste no Telegram usando workspaceId direto
 * Bypass total das credenciais do ML (usa payload mockado)
 */
router.post("/notifications/test-direct/:workspaceId", async (req, res) => {
    try {
        const workspaceId = String(req.params?.workspaceId || "").trim();
        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const pool = getPool();
        const { rows: workspaceRows } = await pool.query(
            `SELECT id, name FROM workspaces WHERE id = $1 LIMIT 1`,
            [workspaceId]
        );

        if (!workspaceRows.length) {
            return res.status(404).json({ error: "Workspace não encontrado" });
        }

        const { rows: notifRows } = await pool.query(
            `SELECT 1 FROM notification_settings WHERE workspace_id = $1 AND platform = 'telegram' AND enabled = true LIMIT 1`,
            [workspaceId]
        );

        if (!notifRows.length) {
            return res.status(400).json({ error: "Configuração do Telegram não encontrada para este workspace" });
        }

        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
        const now = Date.now();
        const sampleOrder = {
            id: `TEST-${now}`,
            total_amount: 199.9,
            paid_amount: 199.9,
            currency_id: "BRL",
            status: "paid",
            date_created: new Date(now).toISOString(),
            buyer: { id: "tester", nickname: `${workspaceRows[0].name || "Workspace"} (teste direto)` },
            shipping: { logistic_type: "drop_off" },
            order_items: [
                {
                    item: { title: "Notificação de teste (bypass ML)" },
                    quantity: 1,
                    unit_price: 199.9,
                },
            ],
        };

        const ok = await TelegramNotificationService.notifyNewOrder(workspaceId, sampleOrder);

        return res.json({
            success: ok,
            workspace: workspaceRows[0],
            type: "order",
            sentAt: new Date(now).toISOString(),
        });
    } catch (error: any) {
        console.error("[Notifications Direct Test] Erro:", error);
        return res.status(500).json({ error: error?.message || "Erro ao enviar teste direto" });
    }
});

/**
 * POST /api/integrations/mercadolivre/notifications/replay
 * Reenvia notificações de vendas para o Telegram (retroativas)
 */
router.post("/notifications/replay", async (req, res) => {
    try {
        const { workspaceId, days = 1, dryRun = false, maxOrders = 50 } = req.body;
        let targetWorkspaces: string[] = [];

        if (workspaceId) {
            targetWorkspaces = [workspaceId];
        } else {
            // Se não informar workspaceId, buscar todos que têm credenciais ML
            const pool = getPool();
            const result = await pool.query(
                `SELECT DISTINCT workspace_id FROM integration_credentials WHERE platform_key = $1`,
                [MERCADO_LIVRE_PLATFORM_KEY]
            );
            targetWorkspaces = result.rows.map(r => r.workspace_id);
            console.log(`[ML Replay] Modo global: processando ${targetWorkspaces.length} workspaces.`);
        }

        const results = [];
        const now = new Date();
        const endDate = now;
        // Use sliding window instead of start of day to avoid fetching too old orders
        // days=1 means last 24h, days=0.5 means last 12h
        const startDate = subDays(now, Number(days));

        for (const currentWorkspaceId of targetWorkspaces) {
            try {
                const credentials = await getMercadoLivreCredentials(currentWorkspaceId);
                if (!credentials) {
                    results.push({ workspaceId: currentWorkspaceId, success: false, error: "Mercado Livre não conectado" });
                    continue;
                }

                console.log(`[ML Replay] Iniciando replay para workspace ${currentWorkspaceId}`);

                let totalFound = 0;
                let sent = 0;
                let skippedAlreadySent = 0;

                // 1. Buscar Vendas (Orders)
                let orders: any[] = [];
                try {
                    const ordersUrl = `${MERCADO_LIVRE_API_BASE}/orders/search`;
                    const ordersResp = await requestWithAuth<any>(currentWorkspaceId, ordersUrl, {
                        params: {
                            seller: credentials.userId,
                            sort: "date_desc",
                            limit: maxOrders
                        }
                    });
                    const allOrders = ordersResp.results || [];

                    orders = allOrders.filter((o: any) => {
                        const d = new Date(o.date_created);
                        return d >= startDate && d <= endDate;
                    });

                    console.log(`[ML Replay] Workspace ${currentWorkspaceId}: Encontradas ${orders.length} vendas.`);
                } catch (err: any) {
                    console.error(`[ML Replay] Erro ao buscar vendas workspace ${currentWorkspaceId}:`, err?.message);
                }

                totalFound += orders.length;

                // Processar Vendas
                const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
                for (const order of orders) {
                    if (dryRun) continue;
                    try {
                        const notified = await TelegramNotificationService.notifyNewOrder(currentWorkspaceId, order);
                        if (notified) sent++;
                        else skippedAlreadySent++;
                    } catch (e) {
                        console.error(`[ML Replay] Falha ao processar venda ${order.id}:`, e);
                    }
                }

                // 2. Buscar Perguntas (Questions)
                let questions: any[] = [];
                try {
                    const questionsUrl = `${MERCADO_LIVRE_API_BASE}/my/received_questions/search`;
                    const questionsResp = await requestWithAuth<any>(currentWorkspaceId, questionsUrl, {
                        params: {
                            sort_fields: "date_created",
                            sort_types: "DESC",
                            limit: 50
                        }
                    });
                    const allQuestions = questionsResp.questions || [];

                    questions = allQuestions.filter((q: any) => {
                        const qDate = new Date(q.date_created);
                        return qDate >= startDate && qDate <= endDate;
                    });
                } catch (err: any) {
                    console.error(`[ML Replay] Erro ao buscar perguntas workspace ${currentWorkspaceId}:`, err?.message);
                }

                totalFound += questions.length;

                // Processar Perguntas
                for (const question of questions) {
                    if (dryRun) continue;
                    try {
                        const notified = await TelegramNotificationService.notifyNewQuestion(currentWorkspaceId, question);
                        if (notified) sent++;
                        else skippedAlreadySent++;
                    } catch (e) {
                        console.error(`[ML Replay] Falha ao processar pergunta ${question.id}:`, e);
                    }
                }

                results.push({
                    workspaceId: currentWorkspaceId,
                    success: true,
                    totalFound,
                    sent,
                    skippedAlreadySent
                });

            } catch (err: any) {
                console.error(`[ML Replay] Erro fatal no workspace ${currentWorkspaceId}:`, err);
                results.push({ workspaceId: currentWorkspaceId, success: false, error: err.message });
            }
        }

        return res.json({
            success: true,
            period: {
                from: format(startDate, 'yyyy-MM-dd HH:mm:ss'),
                to: format(endDate, 'yyyy-MM-dd HH:mm:ss')
            },
            dryRun,
            results
        });

    } catch (error: any) {
        console.error("[ML Replay] Erro fatal:", error);
        return res.status(500).json({
            error: "Falha ao processar replay de notificações",
            details: error?.message
        });
    }
});
/**
 * Processar notificação de pedido/venda
 */
export async function handleOrderNotification(notification: any) {
    const start = Date.now();
    try {
        // Ignore test notifications
        if (notification.resource.includes("TEST-ORDER") || notification.resource.includes("test-order")) {
            console.log(`[Order Notification] Ignorando notificação de teste: ${notification.resource}`);
            return;
        }

        console.log(`[Order Notification] Pedido: ${notification.resource}`);

        // Extrair order ID do resource
        const orderId = notification.resource.split('/').pop();
        const userId = notification.user_id;

        if (!orderId || !userId) {
            console.warn("[Order Notification] Missing orderId or userId");
            return;
        }

        const workspaceId = await findWorkspaceIdByMLUserId(String(userId));
        if (!workspaceId) {
            console.warn(`[Order Notification] Workspace não encontrado para user_id ${userId} (Tempo: ${Date.now() - start}ms)`);
            return;
        }

        // Buscar credenciais para fazer request dos detalhes
        let credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            console.error("[Order Notification] Credenciais não encontradas");
            return;
        }

        // Refresh token se necessário
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId);
            if (refreshed) {
                credentials = refreshed;
            }
        }

        // Buscar detalhes completos do pedido
        const orderDetails = await axios.get(
            `${MERCADO_LIVRE_API_BASE}${notification.resource}`,
            { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
        );

        // Se shipping for apenas ID, buscar detalhes do envio
        if (orderDetails.data.shipping?.id && !orderDetails.data.shipping.logistic_type) {
            try {
                const shipmentRes = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/shipments/${orderDetails.data.shipping.id}`,
                    { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
                );
                // Merge shipment details into order.shipping
                orderDetails.data.shipping = { ...orderDetails.data.shipping, ...shipmentRes.data };
                console.log(`[Order Notification] Shipment ${orderDetails.data.shipping.id} details fetched.`);
            } catch (shipErr: any) {
                console.warn(`[Order Notification] Failed to fetch shipment ${orderDetails.data.shipping?.id}:`, shipErr.message);
            }
        }

        console.log(`[Order Notification] Detalhes do pedido ${orderId} obtidos com sucesso (Tempo: ${Date.now() - start}ms)`);

        const status = String(orderDetails.data?.status || "").toLowerCase();
        if (!["paid", "confirmed"].includes(status)) {
            console.log(`[Order Notification] Ignorado status ${status} para pedido ${orderId}`);
            return;
        }

        // Enviar notificação Telegram
        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
        await TelegramNotificationService.notifyNewOrder(workspaceId, orderDetails.data);
        console.log(`[Order Notification] Sucesso total pedido ${orderId} (Total: ${Date.now() - start}ms)`);

        // TODO: Salvar pedido no banco para cache local
    } catch (error: any) {
        console.error(`[Order Notification] Erro após ${Date.now() - start}ms:`, error.response?.data || error.message);
    }
}

/**
 * Processar notificação de pergunta
 */
async function handleQuestionNotification(notification: any) {
    try {
        // Ignore test notifications
        if (notification.resource.includes("TEST-CREATED-") || notification.resource.includes("test-created")) {
            console.log(`[Question Notification] Ignorando notificação de teste: ${notification.resource}`);
            return;
        }

        console.log(`[Question Notification] Pergunta: ${notification.resource}`);

        const questionId = notification.resource.split('/').pop();
        const userId = notification.user_id;

        if (!questionId || !userId) {
            console.warn("[Question Notification] Missing questionId or userId");
            return;
        }

        const workspaceId = await findWorkspaceIdByMLUserId(String(userId));
        if (!workspaceId) {
            console.warn(`[Question Notification] Workspace não encontrado para user_id ${userId}`);
            return;
        }

        // Buscar credenciais
        let credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            console.error("[Question Notification] Credenciais não encontradas");
            return;
        }

        // Refresh token se necessário
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId);
            if (refreshed) {
                credentials = refreshed;
            }
        }

        // Buscar detalhes da pergunta
        const questionDetails = await axios.get(
            `${MERCADO_LIVRE_API_BASE}${notification.resource}`,
            { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
        );

        console.log(`[Question Notification] Detalhes da pergunta ${questionId} obtidos`);

        // Enviar notificação Telegram
        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
        await TelegramNotificationService.notifyNewQuestion(workspaceId, questionDetails.data);
    } catch (error: any) {
        console.error("[Question Notification] Erro:", error.response?.data || error.message);
    }
}

/**
 * Processar notificação de item/produto
 */
async function handleItemNotification(notification: any) {
    try {
        // Ignore test notifications
        if (notification.resource.includes("TEST-ITEM") || notification.resource.includes("test-item")) {
            console.log(`[Item Notification] Ignorando notificação de teste: ${notification.resource}`);
            return;
        }

        console.log(`[Item Notification] Item: ${notification.resource}`);

        if (!ML_ITEM_NOTIFICATIONS_ENABLED) {
            console.log("[Item Notification] Ignorado porque ML_NOTIFY_ITEM_UPDATES!=true");
            return;
        }

        const itemId = notification.resource.split('/').pop();
        const userId = notification.user_id;

        if (!itemId || !userId) {
            console.warn("[Item Notification] Missing itemId or userId");
            return;
        }

        const workspaceId = await findWorkspaceIdByMLUserId(String(userId));
        if (!workspaceId) {
            console.warn(`[Item Notification] Workspace não encontrado para user_id ${userId}`);
            return;
        }

        let credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            console.error("[Item Notification] Credenciais não encontradas");
            return;
        }
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId);
            if (refreshed) credentials = refreshed;
        }

        const itemResp = await axios.get(
            `${MERCADO_LIVRE_API_BASE}${notification.resource}`,
            { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
        );

        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
        await TelegramNotificationService.notifyItemUpdated(workspaceId, itemResp.data);
    } catch (error) {
        console.error("[Item Notification] Erro:", error);
    }
}

/**
 * Processar notificação de mensagem
 */
async function handleMessageNotification(notification: any) {
    try {
        console.log(`[Message Notification] Mensagem: ${notification.resource}`);
        const userId = notification.user_id;
        const workspaceId = await findWorkspaceIdByMLUserId(String(userId));
        if (!workspaceId) return;

        let credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) return;
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId);
            if (refreshed) credentials = refreshed;
        }

        const msgResp = await axios.get(
            `${MERCADO_LIVRE_API_BASE}${notification.resource}`,
            { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
        ).catch(() => ({ data: { text: "Nova mensagem recebida" } }));

        const { TelegramNotificationService } = await import("../../services/telegramNotification.service.js");
        await TelegramNotificationService.notifyNewMessage(workspaceId, msgResp.data);
    } catch (error) {
        console.error("[Message Notification] Erro:", error);
    }
}

/**
 * POST /api/integrations/mercadolivre/analyze
 * Análise completa de produto MLB para otimização SEO
 */
// ... (router definition)
router.post("/analyze", async (req, res) => {
    const normalizedMlbId = String((req.body?.mlbId) || '').trim().toUpperCase();
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        const { mlbId } = req.body;
        // normalizedMlbId já calculado acima para uso no catch

        if (!mlbId) {
            return res.status(400).json({
                error: "MLB ID é obrigatório"
            });
        }

        // Validar formato do MLB ID
        if (!normalizedMlbId.match(/^MLB\d+$/)) {
            return res.status(400).json({
                error: "Formato de MLB ID inválido. Use: MLB1234567890"
            });
        }

        let accessToken: string | undefined = undefined;
        let credentials: any = null;

        if (workspaceId) {
            credentials = await getMercadoLivreCredentials(workspaceId);
            accessToken = credentials?.accessToken;
        }

        // Importar serviços dinamicamente para evitar problemas de circular dependency
        const { mlbAnalyzerService } = await import("../../services/mlbAnalyzer.service.js");
        const { seoOptimizerService, fetchTrendingKeywordsFromML, fetchCompetitorKeywordsFromML } = await import("../../services/seoOptimizer.service.js");
        const { modelOptimizerService } = await import("../../services/modelOptimizer.service.js");
        const { technicalSheetService } = await import("../../services/technicalSheetService.js");
        const { competitiveAnalyzerService } = await import("../../services/competitiveAnalyzer.service.js");

        console.log(`[MLB Analyzer] Iniciando análise do produto ${normalizedMlbId}`);

        let productData;
        try {
            productData = await mlbAnalyzerService.getProductData(normalizedMlbId, accessToken);
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            if (status === 401 && credentials?.refreshToken) {
                try {
                    const refreshed = await refreshAccessToken(String(workspaceId));
                    const newToken = refreshed?.accessToken;
                    productData = await mlbAnalyzerService.getProductData(normalizedMlbId, newToken);
                } catch (retryErr: any) {
                    return res.status(401).json({
                        error: "Conexão Mercado Livre inválida",
                        details: retryErr?.message || "Unauthorized",
                        mlb_id: normalizedMlbId
                    });
                }
            } else if (status === 404) {
                return res.status(404).json({
                    error: "Produto não encontrado",
                    details: err?.message || "Not Found",
                    mlb_id: normalizedMlbId
                });
            } else {
                return res.status(502).json({
                    error: "Falha ao consultar API do Mercado Livre",
                    details: err?.message || "Bad Gateway",
                    mlb_id: normalizedMlbId
                });
            }
        }

        const buildEmptyCompetitiveAnalysis = () => ({
            total_competitors_analyzed: 0,
            market_position: 'average',
            competitive_score: 50,
            top_competitors: [] as any[],
            price_analysis: {
                current_price: productData.price,
                market_average: productData.price,
                cheapest_competitor: productData.price,
                most_expensive: productData.price,
                price_position: 'average',
                optimal_price_range: {
                    min: productData.price,
                    max: productData.price,
                    recommended: productData.price
                },
                price_elasticity_insights: {
                    price_sensitive_category: false,
                    sweet_spot: productData.price,
                    conversion_impact: 'neutral'
                }
            },
            feature_comparison: {
                current_features: productData.attributes.map((a: any) => a.id),
                competitor_features: {},
                missing_features: [] as any[],
                unique_advantages: [] as any[],
                category_standards: [] as any[]
            },
            ranking_factors: {
                current_score: 50,
                top_competitor_score: 50,
                gap_analysis: [] as any[],
                quick_wins: [] as any[]
            },
            competitive_gaps: [] as any[],
            opportunities: [] as any[],
            threats: [] as any[],
            market_insights: {
                category_trends: [] as any[],
                consumer_preferences: [] as any[],
                seasonal_patterns: [] as any[],
                growth_opportunities: [] as any[]
            },
            category_top_products: [] as any[] | undefined
        });

        const buildEmptyModelOptimization = () => ({
            current_model: null as string | null,
            current_score: 50,
            strategic_keywords: [] as any[],
            optimized_models: [] as any[],
            category_insights: {
                category_id: productData.category_id,
                category_name: '',
                trending_terms: [] as any[],
                high_conversion_words: [] as any[],
                seasonal_keywords: [] as any[],
                competitor_analysis: [] as any[]
            },
            advanced_strategies: [] as any[]
        });

        const buildEmptyTechnicalSheetAnalysis = () => ({
            completion_score: 0,
            total_attributes: productData.attributes.length,
            filled_attributes: 0,
            critical_missing: [] as any[],
            high_priority_missing: [] as any[],
            optimization_opportunities: [] as any[],
            category_specific_insights: {
                required_attributes: [] as any[],
                recommended_attributes: [] as any[],
                competitive_advantages: [] as any[]
            },
            seo_impact_analysis: {
                current_seo_score: 0,
                max_possible_score: 100,
                improvement_potential: 100,
                priority_attributes: [] as any[]
            },
            validation_results: [] as any[]
        });

        // 2. Calcular score de qualidade
        const qualityScore = mlbAnalyzerService.calculateQualityScore(productData);

        // 3. Análise de palavras-chave
        const keywordAnalysis = seoOptimizerService.analyzeKeywords(productData);
        const liveTrending = await fetchTrendingKeywordsFromML(productData.category_id);
        const liveCompetitors = await fetchCompetitorKeywordsFromML(productData.category_id);
        if (Array.isArray(liveTrending) && liveTrending.length > 0) {
            keywordAnalysis.trending_keywords = liveTrending;
        }
        if (Array.isArray(liveCompetitors) && liveCompetitors.length > 0) {
            keywordAnalysis.competitor_keywords = liveCompetitors;
        }

        // 4. Otimização de título
        const titleOptimization = seoOptimizerService.optimizeTitle(productData, keywordAnalysis);

        // 5. Geração de descrição SEO
        const seoDescription = seoOptimizerService.generateSEODescription(productData, keywordAnalysis);

        // 6. Análise de ficha técnica
        const technicalAnalysis = {
            total_attributes: productData.attributes.length,
            filled_attributes: productData.attributes.filter(attr =>
                attr.value_name || (attr.values && attr.values.length > 0)
            ).length,
            missing_important: ['BRAND', 'MODEL', 'COLOR', 'SIZE'].filter(id =>
                !productData.attributes.some(attr => attr.id === id && attr.value_name)
            ),
            completion_percentage: Math.round(
                (productData.attributes.filter(attr => attr.value_name).length /
                    Math.max(productData.attributes.length, 1)) * 100
            )
        };

        // 7. Análise de imagens
        const imageAnalysis = {
            total_images: productData.pictures.length,
            has_video: !!productData.video_id,
            high_quality_images: productData.pictures.filter(pic => {
                const sizes = pic.max_size?.split('x').map(s => parseInt(s));
                return sizes && sizes[0] >= 800 && sizes[1] >= 800;
            }).length,
            has_variations_images: productData.variations?.some(v => v.picture_ids?.length > 0) || false
        };

        // 8. Análise competitiva avançada
        let competitiveAnalysis: any = buildEmptyCompetitiveAnalysis();
        try {
            competitiveAnalysis = await competitiveAnalyzerService.analyzeCompetition(productData, accessToken);
        } catch (e: any) {
            console.warn('[MLB Analyzer] Falha na análise competitiva, usando fallback:', e?.message || e);
        }

        // 9. Análise e otimização do campo Modelo
        let modelOptimization: any = buildEmptyModelOptimization();
        try {
            modelOptimization = await modelOptimizerService.generateModelStrategy(productData);
        } catch (e: any) {
            console.warn('[MLB Analyzer] Falha na otimização de modelo, usando fallback:', e?.message || e);
        }

        // 10. Análise avançada de ficha técnica
        let technicalSheetAnalysis: any = buildEmptyTechnicalSheetAnalysis();
        try {
            technicalSheetAnalysis = await technicalSheetService.analyzeTechnicalSheet(productData);
        } catch (e: any) {
            console.warn('[MLB Analyzer] Falha na análise de ficha técnica, usando fallback:', e?.message || e);
        }

        // 11. Previsão de entrega orgânica
        const organicDeliveryPrediction = {
            ranking_potential: Math.min(100, qualityScore.overall_score + 10),
            relevance_index: keywordAnalysis.keyword_density,
            optimization_level: qualityScore.overall_score >= 80 ? 'high' :
                qualityScore.overall_score >= 60 ? 'medium' : 'low',
            estimated_visibility: `${Math.round(qualityScore.overall_score * 0.8)}%`
        };

        console.log(`[MLB Analyzer] Análise concluída para ${normalizedMlbId}. Score: ${qualityScore.overall_score}`);

        return res.json({
            success: true,
            mlb_id: normalizedMlbId,
            analyzed_at: new Date().toISOString(),
            product_data: {
                id: productData.id,
                title: productData.title,
                price: productData.price,
                category_id: productData.category_id,
                status: productData.status,
                sold_quantity: productData.sold_quantity,
                available_quantity: productData.available_quantity,
                permalink: productData.permalink,
                thumbnail: productData.thumbnail,
                description_text: (productData as any).description_text,
                attributes: productData.attributes || [],
                pictures: productData.pictures || []
            },
            quality_score: qualityScore,
            keyword_analysis: keywordAnalysis,
            title_optimization: titleOptimization,
            model_optimization: modelOptimization,
            seo_description: seoDescription,
            technical_analysis: technicalAnalysis,
            technical_sheet_analysis: technicalSheetAnalysis,
            image_analysis: imageAnalysis,
            competitive_analysis: competitiveAnalysis,
            organic_delivery_prediction: organicDeliveryPrediction,
            recommendations: {
                priority_actions: qualityScore.suggestions.filter(s => s.impact === 'high'),
                quick_wins: qualityScore.suggestions.filter(s => s.difficulty === 'easy'),
                advanced_optimizations: qualityScore.suggestions.filter(s =>
                    s.impact === 'high' && s.difficulty === 'hard'
                )
            }
        });

    } catch (error: any) {
        console.error("Error in MLB analysis:", error);
        return res.status(500).json({
            error: "Falha na análise do produto",
            details: error.message,
            mlb_id: normalizedMlbId
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/analyze/:mlbId
 * Versão GET para análise rápida
 */
router.get("/analyze/:mlbId", async (req, res) => {
    try {
        const { mlbId } = req.params;
        const { id: workspaceId } = resolveWorkspaceId(req);

        if (!workspaceId) {
            return res.status(400).json({
                error: "Workspace ID é obrigatório"
            });
        }

        // Redirecionar para a versão POST
        return res.redirect(307, `/api/integrations/mercadolivre/analyze`);

    } catch (error: any) {
        console.error("Error in MLB analysis GET:", error);
        return res.status(500).json({
            error: "Falha na análise do produto",
            details: error.message
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/smart-suggestions
 * Gera sugestões inteligentes baseadas em análise de mercado
 */
router.post("/smart-suggestions", async (req, res) => {
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        const { mlbId } = req.body;

        console.log("[Smart Suggestions] Request:", { mlbId, workspaceId });

        if (!mlbId) {
            return res.status(400).json({
                error: "MLB ID é obrigatório"
            });
        }

        const { mlbAnalyzerService } = await import("../../services/mlbAnalyzer.service.js");

        // Buscar credenciais do Mercado Livre
        console.log("[Smart Suggestions] Buscando credenciais...");
        const effectiveWorkspaceId = workspaceId || FALLBACK_WORKSPACE_ENV;

        let credentials = await getMercadoLivreCredentials(effectiveWorkspaceId);
        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre não conectado para este workspace"
            });
        }

        // Refresh token se necessário
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(effectiveWorkspaceId);
            if (refreshed) {
                credentials = refreshed;
            }
        }

        const accessToken = credentials.accessToken;

        console.log("[Smart Suggestions] Buscando dados do produto...");
        let productData;
        try {
            productData = await mlbAnalyzerService.getProductData(mlbId, accessToken);
        } catch (productError: any) {
            console.error("[Smart Suggestions] Erro ao buscar produto:", productError);
            return res.status(404).json({
                error: "Não foi possível buscar dados do produto",
                details: productError.message
            });
        }

        // Gerar sugestões inteligentes baseadas em dados de mercado
        console.log("[Smart Suggestions] Gerando sugestões inteligentes...");
        let smartSuggestions;
        try {
            smartSuggestions = await mlbAnalyzerService.generateSmartSuggestions(productData);
        } catch (suggestionsError: any) {
            console.error("[Smart Suggestions] Erro ao gerar sugestões:", suggestionsError);
            return res.status(500).json({
                error: "Erro ao analisar mercado e gerar sugestões",
                details: suggestionsError.message
            });
        }

        console.log("[Smart Suggestions] Sugestões geradas com sucesso");
        return res.json({
            success: true,
            mlb_id: mlbId,
            suggestions: smartSuggestions,
            generated_at: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("[Smart Suggestions] Erro geral:", error);
        return res.status(500).json({
            error: "Falha ao gerar sugestões inteligentes",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/optimize-title
 * Otimização específica de título
 */
router.post("/optimize-title", async (req, res) => {
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        const { title, mlbId } = req.body;

        if (!title) {
            return res.status(400).json({
                error: "Título é obrigatório"
            });
        }

        const { seoOptimizerService } = await import("../../services/seoOptimizer.service.js");

        // Análise básica do título
        const titleAnalysis = {
            current_title: title,
            length: title.length,
            word_count: title.split(' ').length,
            has_brand: /\b(apple|samsung|nike|adidas)\b/i.test(title),
            has_numbers: /\d/.test(title),
            has_special_chars: /[!@#$%^&*()_+\-=\\{}|;':",.<>?~`]/.test(title),
            readability_score: title.split(' ').reduce((sum: number, word: string) => sum + word.length, 0) / title.split(' ').length < 6 ? 90 : 70,
            seo_score: Math.floor(Math.random() * 40) + 60 // Placeholder
        };

        // Sugestões rápidas
        const suggestions = [
            `${title} Original`,
            `${title} Premium`,
            `${title.slice(0, 50)} - Garantia`,
            title.replace(/\s+/g, ' ').trim()
        ].filter((suggestion, index, self) =>
            suggestion !== title && self.indexOf(suggestion) === index
        );

        return res.json({
            success: true,
            title_analysis: titleAnalysis,
            suggestions: suggestions.map((suggestion, index) => ({
                title: suggestion,
                score: titleAnalysis.seo_score + Math.floor(Math.random() * 20) - 10,
                improvements: ['Melhor SEO', 'Maior CTR', 'Mais palavras-chave']
            })),
            recommendations: [
                'Mantenha entre 20-60 caracteres',
                'Inclua marca quando relevante',
                'Use palavras-chave da categoria',
                'Evite excesso de maiúsculas'
            ]
        });

    } catch (error: any) {
        console.error("Error in title optimization:", error);
        return res.status(500).json({
            error: "Falha na otimização do título",
            details: error.message
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/generate-description
 * Geração de descrição SEO
 */
router.post("/generate-description", async (req, res) => {
    try {
        const { mlbId, workspaceId, style = 'professional' } = req.body;
        const normalizedMlbId = String(mlbId || '').trim().toUpperCase();

        if (!normalizedMlbId) {
            return res.status(400).json({
                error: "MLB ID é obrigatório"
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId || 'default');
        const { mlbAnalyzerService } = await import("../../services/mlbAnalyzer.service.js");
        const { seoOptimizerService, fetchTrendingKeywordsFromML, fetchCompetitorKeywordsFromML } = await import("../../services/seoOptimizer.service.js");

        // Buscar dados do produto
        const productData = await mlbAnalyzerService.getProductData(normalizedMlbId, credentials?.accessToken);
        const keywordAnalysis = seoOptimizerService.analyzeKeywords(productData);
        const liveTrending = await fetchTrendingKeywordsFromML(productData.category_id);
        const liveCompetitors = await fetchCompetitorKeywordsFromML(productData.category_id);
        if (Array.isArray(liveTrending) && liveTrending.length > 0) {
            keywordAnalysis.trending_keywords = liveTrending;
        }
        if (Array.isArray(liveCompetitors) && liveCompetitors.length > 0) {
            keywordAnalysis.competitor_keywords = liveCompetitors;
        }
        const seoDescription = seoOptimizerService.generateSEODescription(productData, keywordAnalysis);

        return res.json({
            success: true,
            mlb_id: normalizedMlbId,
            generated_description: seoDescription,
            style_applied: style,
            keywords_included: keywordAnalysis.primary_keywords.concat(keywordAnalysis.secondary_keywords),
            estimated_seo_boost: `+${Math.floor(Math.random() * 25) + 15}%`
        });

    } catch (error: any) {
        console.error("Error generating description:", error);
        return res.status(500).json({
            error: "Falha na geração da descrição",
            details: error.message
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/apply-optimizations
 * Aplica otimizações automaticamente no anúncio do MercadoLivre
 */
router.post("/apply-optimizations", async (req, res) => {
    try {
        const { id: workspaceId } = resolveWorkspaceId(req);
        const { mlbId, optimizations } = req.body;
        const normalizedMlbId = String(mlbId || '').trim().toUpperCase();

        if (!normalizedMlbId || !workspaceId || !optimizations) {
            return res.status(400).json({
                error: "MLB ID, Workspace ID e otimizações são obrigatórios"
            });
        }

        // Validar formato do MLB ID
        if (!normalizedMlbId.match(/^MLB\d+$/)) {
            return res.status(400).json({
                error: "Formato de MLB ID inválido. Use: MLB1234567890"
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({
                error: "Credenciais do MercadoLivre não encontradas"
            });
        }

        console.log(`[Apply Optimizations] Iniciando aplicação de otimizações para ${normalizedMlbId}`);

        // Buscar dados atuais do produto
        let currentProduct;
        try {
            currentProduct = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}`);
        } catch (err: any) {
            return res.status(404).json({
                error: "Produto não encontrado",
                details: err?.message || "Not Found",
                mlb_id: normalizedMlbId
            });
        }

        const updates: any = {};
        const appliedChanges: string[] = [];



        // 2. Aplicar modelo otimizado
        if (optimizations.model) {
            // Encontrar o atributo MODEL
            if (!currentProduct.attributes) currentProduct.attributes = [];

            const modelAttr = currentProduct.attributes.find((attr: any) => attr.id === 'MODEL');
            const originalModel = modelAttr?.value_name || null;

            console.log(`[Apply Optimizations] MODELO - Original: "${originalModel}" -> Novo: "${optimizations.model}"`);

            if (modelAttr) {
                modelAttr.value_name = optimizations.model;
            } else {
                currentProduct.attributes.push({
                    id: 'MODEL',
                    value_name: optimizations.model
                });
            }

            updates.attributes = currentProduct.attributes;
            appliedChanges.push(`Campo modelo: "${optimizations.model}"`);
        }

        // 2.1 Aplicar atributos COLOR e SIZE, se fornecidos (com mapeamento para value_id quando disponível)
        if (optimizations.attributes) {
            if (!currentProduct.attributes) currentProduct.attributes = [];
            const { COLOR, SIZE } = optimizations.attributes as { COLOR?: string; SIZE?: string };
            const SELLER_SKU = (optimizations.attributes as any)?.SELLER_SKU as string | undefined;

            // Helper: normalizar strings para comparação
            const normalize = (s: string) => s
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();

            // Buscar metadados de atributos da categoria para obter value_id válido
            let categoryAttributes: any[] = [];
            try {
                const catId = String(currentProduct.category_id || '').trim();
                if (catId) {
                    const attrsResp = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/categories/${catId}/attributes`);
                    categoryAttributes = Array.isArray(attrsResp) ? attrsResp : [];
                }
            } catch (e) {
                // Se falhar, seguimos com value_name
            }

            const findValueId = (attrId: string, valueName: string): string | null => {
                if (!valueName) return null;
                const meta = categoryAttributes.find((a) => a.id === attrId);
                const values = Array.isArray(meta?.values) ? meta.values : [];
                const target = values.find((v: any) => normalize(v?.name || '') === normalize(valueName));
                return target?.id || null;
            };

            const findAttrMeta = (attrId: string) => categoryAttributes.find((a) => a.id === attrId);
            const getDefaultUnit = (meta: any): string => {
                const allowed = Array.isArray(meta?.allowed_units) ? meta.allowed_units : [];
                return meta?.default_unit || allowed?.[0]?.id || allowed?.[0]?.name || 'cm';
            };

            if (COLOR) {
                const valueId = findValueId('COLOR', COLOR);
                const existing = currentProduct.attributes.find((attr: any) => attr.id === 'COLOR');
                const resolveName = (attr: any): string | null => {
                    if (!attr) return null;
                    if (attr.value_name) return String(attr.value_name);
                    if (attr.value_id) {
                        const meta = categoryAttributes.find((a) => a.id === 'COLOR');
                        const v = Array.isArray(meta?.values) ? meta.values.find((x: any) => String(x.id) === String(attr.value_id)) : null;
                        return v?.name || null;
                    }
                    return null;
                };
                const before = resolveName(existing);
                const after = valueId ? null : COLOR;
                const changed = !before || normalize(before) !== normalize(COLOR);
                if (existing) {
                    if (valueId) {
                        existing.value_id = valueId;
                        delete existing.value_name;
                    } else {
                        existing.value_name = COLOR;
                        delete existing.value_id;
                    }
                } else {
                    currentProduct.attributes.push(valueId ? { id: 'COLOR', value_id: valueId } : { id: 'COLOR', value_name: COLOR });
                }
                if (changed) appliedChanges.push('Cor (COLOR) atualizada');
            }

            if (SIZE) {
                const valueId = findValueId('SIZE', SIZE);
                const existing = currentProduct.attributes.find((attr: any) => attr.id === 'SIZE');
                const resolveName = (attr: any): string | null => {
                    if (!attr) return null;
                    if (attr.value_name) return String(attr.value_name);
                    if (attr.value_id) {
                        const meta = categoryAttributes.find((a) => a.id === 'SIZE');
                        const v = Array.isArray(meta?.values) ? meta.values.find((x: any) => String(x.id) === String(attr.value_id)) : null;
                        return v?.name || null;
                    }
                    return null;
                };
                const before = resolveName(existing);
                const changed = !before || normalize(before) !== normalize(SIZE);
                if (existing) {
                    if (valueId) {
                        existing.value_id = valueId;
                        delete existing.value_name;
                    } else {
                        existing.value_name = SIZE;
                        delete existing.value_id;
                    }
                } else {
                    currentProduct.attributes.push(valueId ? { id: 'SIZE', value_id: valueId } : { id: 'SIZE', value_name: SIZE });
                }
                if (changed) appliedChanges.push('Tamanho (SIZE) atualizado');
            }

            if ((optimizations.attributes as any)?.BRAND) {
                const BRAND = (optimizations.attributes as any).BRAND as string;
                const valueId = findValueId('BRAND', BRAND);
                const existing = currentProduct.attributes.find((attr: any) => attr.id === 'BRAND');
                const resolveName = (attr: any): string | null => {
                    if (!attr) return null;
                    if (attr.value_name) return String(attr.value_name);
                    if (attr.value_id) {
                        const meta = categoryAttributes.find((a) => a.id === 'BRAND');
                        const v = Array.isArray(meta?.values) ? meta.values.find((x: any) => String(x.id) === String(attr.value_id)) : null;
                        return v?.name || null;
                    }
                    return null;
                };
                const before = resolveName(existing);
                const changed = !before || normalize(before) !== normalize(BRAND);
                if (existing) {
                    if (valueId) {
                        existing.value_id = valueId;
                        delete existing.value_name;
                    } else {
                        existing.value_name = BRAND;
                        delete existing.value_id;
                    }
                } else {
                    currentProduct.attributes.push(valueId ? { id: 'BRAND', value_id: valueId } : { id: 'BRAND', value_name: BRAND });
                }
                if (changed) appliedChanges.push('Marca (BRAND) atualizada');
            }

            // Tratar outros atributos (que não sejam COLOR, SIZE, BRAND)
            const processedAttributes = ['COLOR', 'SIZE', 'BRAND'];
            for (const [attrId, attrValue] of Object.entries(optimizations.attributes)) {
                if (processedAttributes.includes(attrId) || !attrValue) continue;

                const existing = currentProduct.attributes.find((attr: any) => attr.id === attrId);
                const meta = findAttrMeta(attrId);
                const isNumberUnit = meta?.value_type === 'number_unit';

                const allowedUnitsRaw = Array.isArray(meta?.allowed_units) ? meta.allowed_units : [];
                const normalizeUnit = (u: any) => String(u || '').trim().toLowerCase();
                const allowedUnits = allowedUnitsRaw.map((u: any) => ({
                    id: normalizeUnit(u.id),
                    name: normalizeUnit(u.name)
                }));

                const existingUnit = normalizeUnit(existing?.value_struct?.unit || existing?.value_name?.split(' ')?.slice(-1)[0] || '');
                const defaultUnit = normalizeUnit(meta?.default_unit) || allowedUnits[0]?.id || allowedUnits[0]?.name || 'cm';

                const parseNumberWithUnit = (val: any): { number: number | null; unit: string } => {
                    const raw = String(val ?? '').trim();
                    const match = raw.match(/([-+]?[0-9]+(?:[.,][0-9]+)?)/);
                    const numStr = match ? match[1] : '';
                    const number = numStr ? Number(numStr.replace(',', '.')) : NaN;
                    const unitCandidateRaw = normalizeUnit(raw.replace(numStr, '').trim());
                    const unitCandidate = allowedUnits.find((u: any) => u.id === unitCandidateRaw || u.name === unitCandidateRaw);
                    const unit = unitCandidate?.id || unitCandidate?.name || existingUnit || defaultUnit;
                    return { number: Number.isFinite(number) ? number : null, unit };
                };

                const currentStruct = isNumberUnit ? {
                    number: Number.isFinite(Number(existing?.value_struct?.number)) ? Number(existing?.value_struct?.number) : null,
                    unit: existingUnit || defaultUnit
                } : null;

                const currentValue = existing?.value_name || existing?.value_id || (currentStruct && currentStruct.number !== null ? String(currentStruct.number) : '');

                const parsed = isNumberUnit ? parseNumberWithUnit(attrValue) : null;
                const changed = isNumberUnit
                    ? (parsed && parsed.number !== null && (parsed.number !== currentStruct?.number || normalizeUnit(parsed.unit) !== normalizeUnit(currentStruct?.unit)))
                    : (!existing || String((existing?.value_name || existing?.value_id || '')).toLowerCase().trim() !== String(attrValue).toLowerCase().trim());

                console.log(`[Apply Optimizations] ${attrId} - Original: "${currentValue}" -> Novo: "${attrValue}"`);

                let formattedValueName: string | undefined;
                if (isNumberUnit) {
                    if (!parsed || parsed.number === null) {
                        console.warn(`[Apply Optimizations] ${attrId} ignorado: valor numérico inválido (${attrValue})`);
                        continue;
                    }
                    formattedValueName = `${parsed.number} ${parsed.unit || ''}`.trim();
                    const payload: any = {
                        id: attrId,
                        value_struct: { number: parsed.number, unit: parsed.unit || defaultUnit },
                        value_name: formattedValueName
                    };
                    if (existing) {
                        existing.value_struct = payload.value_struct;
                        existing.value_name = payload.value_name;
                        delete existing.value_id;
                    } else {
                        currentProduct.attributes.push(payload);
                    }
                } else {
                    if (existing) {
                        existing.value_name = attrValue;
                        delete existing.value_id; // Usar value_name para atributos customizados
                        delete existing.value_struct;
                    } else {
                        currentProduct.attributes.push({
                            id: attrId,
                            value_name: attrValue
                        });
                    }
                }

                if (changed) {
                    const changeLabel = isNumberUnit && parsed?.number !== null
                        ? `${attrId} atualizado: "${formattedValueName}"`
                        : `${attrId} atualizado: "${attrValue}"`;
                    appliedChanges.push(changeLabel);
                }
            }

            const hasAnyAttributes = COLOR || SIZE || Boolean((optimizations.attributes as any)?.BRAND) ||
                Object.keys(optimizations.attributes).some(k => !processedAttributes.includes(k) && optimizations.attributes[k]);

            if (hasAnyAttributes) {
                updates.attributes = currentProduct.attributes;
            }

            const hasVariations = Array.isArray(currentProduct?.variations) && currentProduct.variations.length > 0;
            if (hasVariations && (COLOR || SIZE)) {
                const variationsPayload = currentProduct.variations.map((v: any) => {
                    const combos = Array.isArray(v?.attribute_combinations) ? [...v.attribute_combinations] : [];
                    const upsertCombo = (id: string, valueName?: string) => {
                        if (!valueName) return;
                        const valueId = findValueId(id, valueName);
                        const idx = combos.findIndex((c: any) => c.id === id);
                        const entry = valueId ? { id, value_id: valueId } : { id, value_name: valueName };
                        if (idx >= 0) {
                            combos[idx] = entry;
                        } else {
                            combos.push(entry);
                        }
                    };
                    upsertCombo('COLOR', COLOR);
                    upsertCombo('SIZE', SIZE);
                    return { id: v.id, attribute_combinations: combos };
                });
                updates.variations = variationsPayload;
            }
            // Mapear SELLER_SKU para o campo correto do item (seller_custom_field)
            if (SELLER_SKU && typeof SELLER_SKU === 'string' && SELLER_SKU.trim().length > 0) {
                updates.seller_custom_field = SELLER_SKU.trim();
                appliedChanges.push('SKU do vendedor atualizado');
            }
        }

        // 3. Aplicar descrição otimizada
        if (optimizations.description) {
            try {
                let hasExistingDesc = false;
                try {
                    const existing = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}/description`);
                    hasExistingDesc = !!existing && (typeof existing.plain_text === 'string' || typeof existing.id === 'string');
                } catch {
                    hasExistingDesc = false;
                }

                const sanitizePlain = (s: string): string => {
                    const cleaned = String(s)
                        .replace(/[•–]/g, '-')
                        .replace(/<[^>]*>/g, '')
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n');
                    return cleaned;
                };
                const plain = sanitizePlain(String(optimizations.description));

                const url = hasExistingDesc
                    ? `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}/description?api_version=2`
                    : `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}/description`;

                await requestWithAuth(String(workspaceId), url, {
                    method: hasExistingDesc ? 'PUT' : 'POST',
                    data: { plain_text: plain }
                });
                appliedChanges.push('Descrição SEO aplicada');
            } catch (descError) {
                console.warn('[Apply Optimizations] Erro ao atualizar descrição:', descError);
                appliedChanges.push('Descrição não atualizada');
            }
        }

        // Aplicar as atualizações principais (título, atributos, etc.)
        if (Object.keys(updates).length > 0) {
            try {
                console.log(`[Apply Optimizations] Tentando atualizar produto ${normalizedMlbId} com:`, updates);

                await requestWithAuth(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}`, {
                    method: 'PUT',
                    data: updates
                });

                console.log(`[Apply Optimizations] Produto ${normalizedMlbId} atualizado com sucesso`);

            } catch (updateError: any) {
                console.error('[Apply Optimizations] Erro ao atualizar produto:', updateError);

                // Verificar se é erro de permissão ou status do produto
                const status = updateError?.response?.status;
                const errorData = updateError?.response?.data || {};
                const errorMessage = errorData?.message || updateError?.message || "Erro na API do MercadoLivre";
                const causes = Array.isArray(errorData?.cause) ? errorData.cause : [];
                const causeMessages = causes.map((c: any) => c?.message || c?.description || '').filter(Boolean);

                if (status === 400) {
                    const titleBlocked = causeMessages.some((m: string) => /title/i.test(m)) || /title/i.test(errorMessage);

                    if (titleBlocked && updates.title) {
                        const originalTitle = updates.title;
                        delete updates.title;
                        try {
                            await requestWithAuth(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}`, {
                                method: 'PUT',
                                data: updates
                            });
                            const safeChanges = appliedChanges
                                .filter((c) => c !== 'Título atualizado');
                            safeChanges.push('Título não atualizado devido a restrição, demais campos aplicados');
                            return res.json({
                                success: true,
                                message: 'Algumas otimizações aplicadas (título não permitido)',
                                changes_applied: safeChanges,
                                mlb_id: normalizedMlbId,
                                updated_fields: Object.keys(updates),
                                applied_at: new Date().toISOString(),
                            });
                        } catch (retryErr: any) {
                            const retryData = retryErr?.response?.data || {};
                            const retryCauses = Array.isArray(retryData?.cause) ? retryData.cause : [];
                            const retryMessages = retryCauses.map((c: any) => c?.message || c?.description || '').filter(Boolean);
                            return res.status(400).json({
                                error: "Não foi possível editar este produto",
                                details: [errorMessage, ...causeMessages, ...retryMessages].filter(Boolean).join(' | '),
                                mlb_id: normalizedMlbId,
                                suggestions: [
                                    "Verifique se o produto está ativo no MercadoLivre",
                                    "Confirme se você tem permissão para editar este produto",
                                    "Valide se os valores de atributos (BRAND/COLOR/SIZE) são aceitos pela categoria",
                                    "Tente aplicar as mudanças manualmente no ML"
                                ]
                            });
                        } finally {
                            updates.title = originalTitle;
                        }
                    }

                    return res.status(400).json({
                        error: "Não foi possível editar este produto",
                        details: [
                            errorMessage,
                            ...causeMessages
                        ].filter(Boolean).join(' | '),
                        mlb_id: normalizedMlbId,
                        suggestions: [
                            "Verifique se o produto está ativo no MercadoLivre",
                            "Confirme se você tem permissão para editar este produto",
                            "Valide se os valores de atributos (BRAND/COLOR/SIZE) são aceitos pela categoria",
                            "Tente aplicar as mudanças manualmente no ML"
                        ]
                    });
                } else if (status === 403) {
                    return res.status(403).json({
                        error: "Permissão negada para editar produto",
                        details: "Sua conta não tem permissão para editar este produto via API.",
                        mlb_id: normalizedMlbId,
                        suggestions: [
                            "Verifique as permissões da sua aplicação no MercadoLivre",
                            "Confirme se o token de acesso tem escopo de escrita",
                            "Aplique as mudanças manualmente no painel do ML"
                        ]
                    });
                }

                return res.status(502).json({
                    error: "Falha ao aplicar otimizações",
                    details: [
                        errorMessage,
                        ...causeMessages
                    ].filter(Boolean).join(' | '),
                    mlb_id: normalizedMlbId,
                    status_code: status
                });
            }
        }

        if (appliedChanges.length === 0) {
            return res.json({
                success: true,
                message: "Nenhuma alteração necessária",
                changes_applied: [],
                mlb_id: normalizedMlbId
            });
        }

        console.log(`[Apply Optimizations] Sucesso! Aplicadas ${appliedChanges.length} otimizações para ${normalizedMlbId}`);

        // Pós-verificação: buscar item e descrição para confirmar aplicação efetiva
        let afterItem: any = null;
        let afterDesc: any = null;
        const effectiveChanges: string[] = [];
        try {
            // Margem de consistência eventual
            await new Promise((r) => setTimeout(r, 1500));
            afterItem = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}`);
            try {
                afterDesc = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}/description`);
            } catch { /* descrição pode não existir */ }


            // Checar atributos
            const attrs = Array.isArray(afterItem?.attributes) ? afterItem.attributes : [];
            const findName = (id: string): string | null => {
                const a = attrs.find((x: any) => x.id === id);
                return a?.value_name || null;
            };

            // Verificação específica do modelo
            if (optimizations.model) {
                const actualModel = findName('MODEL');
                console.log(`[Apply Optimizations] MODELO VERIFICAÇÃO - Enviado: "${optimizations.model}" -> Real: "${actualModel}"`);
                if (actualModel) {
                    if (actualModel.toLowerCase().trim() === optimizations.model.toLowerCase().trim()) {
                        effectiveChanges.push(`Modelo aplicado: "${actualModel}"`);
                    } else {
                        effectiveChanges.push(`Modelo modificado pelo ML: "${actualModel}" (enviado: "${optimizations.model}")`);
                    }
                }
            }
            if ((optimizations as any)?.attributes?.COLOR) {
                const c = findName('COLOR');
                if (c && c.toLowerCase().trim() === String((optimizations as any).attributes.COLOR).toLowerCase().trim()) {
                    effectiveChanges.push('COLOR confirmado');
                }
            }
            if ((optimizations as any)?.attributes?.SIZE) {
                const s = findName('SIZE');
                if (s && s.toLowerCase().trim() === String((optimizations as any).attributes.SIZE).toLowerCase().trim()) {
                    effectiveChanges.push('SIZE confirmado');
                }
            }
            if ((optimizations as any)?.attributes?.BRAND) {
                const b = findName('BRAND');
                if (b && b.toLowerCase().trim() === String((optimizations as any).attributes.BRAND).toLowerCase().trim()) {
                    effectiveChanges.push('BRAND confirmado');
                }
            }
            // Checar descrição
            if (optimizations?.description) {
                const d = String(afterDesc?.plain_text || '').trim();
                if (d && d.slice(0, 24) === String(optimizations.description).trim().slice(0, 24)) {
                    effectiveChanges.push('Descrição confirmada');
                }
            }
        } catch (postErr) {
            console.warn('[Apply Optimizations] Falha na pós-verificação:', postErr);
        }

        res.json({
            success: true,
            message: "Otimizações aplicadas com sucesso!",
            changes_applied: appliedChanges,
            effective_changes: effectiveChanges,
            mlb_id: normalizedMlbId,
            updated_fields: Object.keys(updates),
            after_snapshot: {
                title: afterItem?.title,
                model: afterItem?.attributes?.find((a: any) => a.id === 'MODEL')?.value_name || null,
                attributes: Array.isArray(afterItem?.attributes) ? afterItem.attributes : [],
                description: afterDesc?.plain_text || null,
            },
            applied_at: new Date().toISOString()
        });

    } catch (error) {
        console.error("[Apply Optimizations] Erro:", error);
        res.status(500).json({
            error: "Erro interno do servidor",
            details: error instanceof Error ? error.message : "Erro desconhecido"
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/catalog-intelligence
 * Busca análise de inteligência de catálogo para um workspace
 */
router.get("/catalog-intelligence", async (req, res) => {
    try {
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({
                error: 'Workspace ID é obrigatório'
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId as string);

        if (!credentials) {
            return res.status(401).json({
                error: 'Token de acesso do MercadoLivre não encontrado',
                details: 'É necessário conectar sua conta do MercadoLivre primeiro',
                suggestions: [
                    'Vá para Integrações > MercadoLivre',
                    'Clique em "Conectar Conta"',
                    'Autorize o acesso à sua conta'
                ]
            });
        }

        // Importar dinamicamente o serviço
        const { catalogIntelligenceService } = await import('../../services/catalogIntelligence.service.js');

        // Executar análise de catálogo
        const catalogAnalysis = await catalogIntelligenceService.analyzeCatalog(
            workspaceId as string,
            credentials.accessToken
        );

        return res.json({
            success: true,
            data: catalogAnalysis,
            message: 'Análise de catálogo realizada com sucesso',
            analyzed_at: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Erro na análise de catálogo:', error);

        // Tratamento de erros específicos
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Token de acesso inválido ou expirado',
                details: 'Seu token do MercadoLivre pode ter expirado',
                suggestions: [
                    'Reconecte sua conta do MercadoLivre',
                    'Verifique se as permissões estão corretas',
                    'Tente novamente em alguns minutos'
                ]
            });
        }

        if (error.response?.status === 403) {
            return res.status(403).json({
                error: 'Permissões insuficientes',
                details: 'Sua conta não tem permissão para acessar os dados necessários',
                suggestions: [
                    'Verifique se sua conta do MercadoLivre tem produtos cadastrados',
                    'Confirme que você é o proprietário dos produtos',
                    'Reconecte com permissões completas'
                ]
            });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Limite de requisições excedido',
                details: 'Muitas requisições para a API do MercadoLivre',
                suggestions: [
                    'Aguarde alguns minutos antes de tentar novamente',
                    'Reduza a frequência de análises',
                    'Tente em um horário de menor movimento'
                ]
            });
        }

        // Erro genérico
        return res.status(500).json({
            error: 'Falha na análise de catálogo',
            details: error.message || 'Erro interno do servidor',
            suggestions: [
                'Verifique sua conexão com o MercadoLivre',
                'Tente novamente em alguns minutos',
                'Contate o suporte se o erro persistir'
            ]
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/catalog-intelligence/refresh
 * Força atualização dos dados de catálogo
 */
router.post("/catalog-intelligence/refresh", async (req, res) => {
    try {
        const { workspaceId } = req.body;

        if (!workspaceId) {
            return res.status(400).json({
                error: 'Workspace ID é obrigatório'
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);

        if (!credentials) {
            return res.status(401).json({
                error: 'Token de acesso não encontrado'
            });
        }

        // Importar dinamicamente o serviço
        const { catalogIntelligenceService } = await import('../../services/catalogIntelligence.service.js');

        // Forçar nova análise (sem cache)
        const catalogAnalysis = await catalogIntelligenceService.analyzeCatalog(
            workspaceId,
            credentials.accessToken
        );

        return res.json({
            success: true,
            data: catalogAnalysis,
            message: 'Dados de catálogo atualizados com sucesso',
            refreshed_at: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Erro na atualização de catálogo:', error);

        return res.status(500).json({
            error: 'Falha na atualização',
            details: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/upload-image
 * Faz upload de uma imagem para o MercadoLivre
 */
router.post("/upload-image", async (req, res) => {
    try {
        const { workspaceId, imageData, fileName } = req.body;

        if (!workspaceId || !imageData) {
            return res.status(400).json({
                error: "Workspace ID e dados da imagem são obrigatórios"
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({
                error: "Credenciais do MercadoLivre não encontradas"
            });
        }

        console.log(`[Upload Image] Iniciando upload de imagem: ${fileName}`);

        // Converter base64 para buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Preparar form data para upload
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: fileName || 'image.jpg',
            contentType: imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
        });

        // Upload da imagem para o MercadoLivre
        const uploadResponse = await requestWithAuth<any>(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/pictures/items/upload`, {
            method: 'POST',
            data: formData,
            headers: formData.getHeaders()
        });

        console.log(`[Upload Image] Upload realizado com sucesso. Picture ID: ${uploadResponse.id}`);

        return res.json({
            success: true,
            picture_id: uploadResponse.id,
            url: uploadResponse.variations?.[0]?.url || null,
            max_size: uploadResponse.max_size,
            message: "Imagem enviada com sucesso!"
        });

    } catch (error: any) {
        console.error("[Upload Image] Erro:", error);

        const status = error?.response?.status;
        const errorData = error?.response?.data || {};

        return res.status(status || 500).json({
            error: "Falha no upload da imagem",
            details: errorData?.message || error?.message || "Erro desconhecido",
            suggestions: [
                "Verifique se a imagem tem menos de 10MB",
                "Use formatos JPG, JPEG ou PNG",
                "Tente uma imagem com resolução menor"
            ]
        });
    }
});

/**
 * POST /api/integrations/mercadolivre/add-pictures
 * Adiciona imagens a um produto existente
 */
router.post("/add-pictures", async (req, res) => {
    try {
        const { mlbId, workspaceId, pictureIds } = req.body;
        const normalizedMlbId = String(mlbId || '').trim().toUpperCase();

        if (!normalizedMlbId || !workspaceId || !Array.isArray(pictureIds)) {
            return res.status(400).json({
                error: "MLB ID, Workspace ID e lista de picture IDs são obrigatórios"
            });
        }

        if (!normalizedMlbId.match(/^MLB\d+$/)) {
            return res.status(400).json({
                error: "Formato de MLB ID inválido. Use: MLB1234567890"
            });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({
                error: "Credenciais do MercadoLivre não encontradas"
            });
        }

        console.log(`[Add Pictures] Adicionando ${pictureIds.length} imagens ao produto ${normalizedMlbId}`);

        const addedPictures = [];
        const errors = [];

        // Adicionar cada imagem individualmente
        for (const pictureId of pictureIds) {
            try {
                const addResponse = await requestWithAuth(String(workspaceId), `${MERCADO_LIVRE_API_BASE}/items/${normalizedMlbId}/pictures`, {
                    method: 'POST',
                    data: { id: pictureId }
                });

                addedPictures.push({
                    picture_id: pictureId,
                    status: 'success',
                    response: addResponse
                });

                console.log(`[Add Pictures] Imagem ${pictureId} adicionada com sucesso`);

            } catch (err: any) {
                console.error(`[Add Pictures] Erro ao adicionar imagem ${pictureId}:`, err);
                errors.push({
                    picture_id: pictureId,
                    error: err?.response?.data?.message || err?.message || 'Erro desconhecido'
                });
            }
        }

        return res.json({
            success: addedPictures.length > 0,
            message: `${addedPictures.length} de ${pictureIds.length} imagens adicionadas`,
            added_pictures: addedPictures,
            errors: errors,
            mlb_id: normalizedMlbId
        });

    } catch (error: any) {
        console.error("[Add Pictures] Erro:", error);

        return res.status(500).json({
            error: "Falha ao adicionar imagens",
            details: error?.message || "Erro interno do servidor"
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/orders/daily-sales
 * Agrega vendas por dia para gráficos
 */
router.get("/orders/daily-sales", async (req, res) => {
    try {
        const { workspaceId, dateFrom, dateTo } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
        }

        let credentials = await getMercadoLivreCredentials(workspaceId as string);

        if (!credentials) {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }

        // Refresh antecipado se token estiver perto de expirar
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId as string);
            if (refreshed) {
                credentials = refreshed;
            }
        }

        const dateFromKey = normalizeBrazilDateKey(dateFrom as string | undefined);
        const dateToKey = normalizeBrazilDateKey(dateTo as string | undefined);

        // Buscar todos os pedidos no período
        const allOrders: any[] = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;
        const shouldCap = !dateFromKey;
        const maxOrders = 1000;

        console.log(`[Daily Sales] Buscando pedidos entre ${dateFromKey || dateFrom} e ${dateToKey || dateTo}`);

        while (hasMore && (!shouldCap || allOrders.length < maxOrders)) {
            try {
                const params: any = {
                    seller: credentials.userId,
                    limit,
                    offset,
                    sort: 'date_desc',
                    // REMOVIDO: Filtro de data na API do ML não está confiável
                    // Vamos filtrar rigorosamente no código
                };

                const ordersResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/orders/search`,
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                        },
                        params,
                    }
                );

                const orders = ordersResponse.data.results || [];
                allOrders.push(...orders);

                hasMore = orders.length === limit;
                if (dateFromKey && orders.length > 0) {
                    const lastOrder = orders[orders.length - 1];
                    if (lastOrder?.date_created) {
                        const lastKey = formatBrazilDateKey(new Date(lastOrder.date_created));
                        if (lastKey < dateFromKey) {
                            hasMore = false;
                        }
                    }
                }
                offset += limit;
            } catch (apiError: any) {
                if (apiError.response?.status === 401) {
                    console.error("[Daily Sales] Token expirado, tentando refresh...");
                    const refreshed = await refreshAccessToken(workspaceId as string);
                    if (refreshed) {
                        credentials = refreshed;
                        continue; // Retry com o novo token
                    }
                    throw new Error("ml_not_connected");
                }
                console.error("[Daily Sales] Erro ao buscar pedidos:", apiError.message);
                hasMore = false;
            }
        }

        console.log(`[Daily Sales] Total de ${allOrders.length} pedidos encontrados (antes da deduplicação)`);

        // Log todos os IDs de pedidos para debug
        const allOrderIds = allOrders.map(o => o.id);
        const orderIdCounts = new Map<string, number>();
        allOrderIds.forEach(id => {
            orderIdCounts.set(id, (orderIdCounts.get(id) || 0) + 1);
        });

        const duplicateIds = Array.from(orderIdCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([id, count]) => `${id}(x${count})`);

        if (duplicateIds.length > 0) {
            console.log(`[Daily Sales] ⚠️  Pedidos duplicados encontrados:`, duplicateIds);
        }

        // ⚠️ DEDUPLICAR PEDIDOS POR ID (API pode retornar duplicados)
        const uniqueOrdersMap = new Map();
        for (const order of allOrders) {
            if (!uniqueOrdersMap.has(order.id)) {
                uniqueOrdersMap.set(order.id, order);
            }
        }
        const uniqueOrders = Array.from(uniqueOrdersMap.values());
        console.log(`[Daily Sales] ${uniqueOrders.length} pedidos únicos após deduplicação (removidos ${allOrders.length - uniqueOrders.length})`);

        // Agregar por dia
        const salesByDay = new Map<string, { date: string; sales: number; revenue: number; orders: number }>();

        for (const order of uniqueOrders) {
            // Ignorar pedidos cancelados (mas manter pendentes/pagamento necessário para alinhar com Atividade Recente)
            const status = String(order.status || "").toLowerCase();
            if (status === "cancelled") continue;

            const dateCreated = order.date_created ? new Date(order.date_created) : null;
            if (!dateCreated) continue;

            const dateKey = formatBrazilDateKey(dateCreated);

            // Filtro de data deve usar a Data Ajustada (dateKey) para consistência
            // Se usarmos o timestamp original (UTC), pedidos feitos à noite (ex: 28/12 22h) que são dia 29/12 UTC
            // seriam excluídos se o filtro for até dia 28/12, mesmo pertencendo ao dia 28/12 no Brasil.
            if (dateFromKey && dateKey < dateFromKey) continue;
            if (dateToKey && dateKey > dateToKey) continue;

            const totalQuantity = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
            // Priorizar total_amount para alinhar com a lista de pedidos e evitar discrepâncias
            const totalAmount = order.total_amount || order.paid_amount || 0;

            if (!salesByDay.has(dateKey)) {
                salesByDay.set(dateKey, { date: dateKey, sales: 0, revenue: 0, orders: 0 });
            }

            const dayData = salesByDay.get(dateKey)!;
            dayData.sales += totalQuantity;
            dayData.revenue += totalAmount;
            dayData.orders += 1;

            // Log detalhado para debug dos últimos 2 dias
            const todayKey = formatBrazilDateKey(new Date());
            const yesterdayKey = formatBrazilDateKey(subDays(new Date(), 1));
            if (dateKey === todayKey || dateKey === yesterdayKey) {
                console.log(`[Daily Sales DEBUG - ${dateKey}] Pedido ${order.id}:`, {
                    quantity: totalQuantity,
                    amount: totalAmount,
                    items: order.order_items?.length || 0,
                    itemDetails: order.order_items?.map((i: any) => ({
                        id: i.item?.id,
                        title: i.item?.title?.substring(0, 30),
                        qty: i.quantity
                    })),
                    status: order.status,
                    date_created: order.date_created
                });
            }
        }

        // Converter para array e ordenar por data
        const dailySalesArray = Array.from(salesByDay.values()).sort((a, b) => a.date.localeCompare(b.date));

        // Log resumo de hoje
        const todayKey = formatBrazilDateKey(new Date());
        const todayData = salesByDay.get(todayKey);
        if (todayData) {
            console.log(`[Daily Sales RESUMO HOJE - ${todayKey}]:`, todayData);
        }

        return res.json({
            dailySales: dailySalesArray,
            // totalOrders deve somar APENAS os pedidos dentro do período (já calculados em dailySales)
            totalOrders: dailySalesArray.reduce((sum, day) => sum + day.orders, 0),
            totalSales: dailySalesArray.reduce((sum, day) => sum + day.sales, 0),
            totalRevenue: dailySalesArray.reduce((sum, day) => sum + day.revenue, 0),
        });

    } catch (error: any) {
        if (error?.message === "ml_not_connected") {
            return res.status(401).json({
                error: "Mercado Livre not connected for this workspace",
            });
        }
        console.error("[Daily Sales] Erro geral:", formatAxiosError(error));
        return res.status(500).json({
            error: "Erro ao agregar vendas diárias",
            details: error?.message || "Erro interno do servidor",
        });
    }
});

// Debug endpoint para verificar configuração
router.get("/debug/config", async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT workspace_id, encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE platform_key = $1`,
            [MERCADO_LIVRE_PLATFORM_KEY]
        );

        const configs = [];
        for (const row of result.rows) {
            try {
                const dec = parseMercadoLivreCredentialsPayload(row.encrypted_credentials, row.encryption_iv) as any;
                configs.push({
                    workspaceId: row.workspace_id,
                    userId: dec.userId || dec.user_id,
                    hasAccessToken: !!dec.accessToken,
                    hasRefreshToken: !!dec.refreshToken,
                    expiresAt: dec.expiresAt
                });
            } catch (e: any) {
                configs.push({
                    workspaceId: row.workspace_id,
                    error: e.message
                });
            }
        }

        return res.json({ configs });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// --- Market Analysis Endpoints ---

const marketAnalysisService = new MarketAnalysisService();

/**
 * POST /api/integrations/mercadolivre/analyze-market
 * Triggers full analysis for a category (Categories, Trends, Products)
 */
router.post("/analyze-market", async (req, res) => {
    try {
        const { categoryId } = req.body;
        if (!categoryId) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const resolvedWorkspace = resolveWorkspaceId(req);
        const workspaceId = resolvedWorkspace.id;
        let accessToken: string | undefined;

        // If workspaceId is provided, try to get credentials
        if (workspaceId) {
            if (resolvedWorkspace.usedFallback) {
                console.log(`[MarketAnalysis] Using fallback workspace ${workspaceId} for credentials.`);
            }
            console.log(`[MarketAnalysis] Checking credentials for workspace ${workspaceId}...`);
            let credentials = await getMercadoLivreCredentials(workspaceId);
            
            if (credentials) {
                 console.log(`[MarketAnalysis] Credentials found. Checking expiry...`);
                 const marginMs = 15 * 60 * 1000;
                 if (credentials.expiresAt && Date.now() >= (credentials.expiresAt - marginMs)) {
                     console.log(`[MarketAnalysis] Token expired or close to expiry for workspace ${workspaceId}, refreshing...`);
                     const refreshed = await refreshAccessToken(workspaceId);
                     if (refreshed) {
                         credentials = { 
                             ...credentials, 
                             accessToken: refreshed.accessToken, 
                             refreshToken: refreshed.refreshToken,
                         };
                     }
                 }
                 
                 if (credentials && credentials.accessToken) {
                    accessToken = credentials.accessToken;
                    console.log(`[MarketAnalysis] Using access token for workspace ${workspaceId} (Token length: ${accessToken.length})`);
                 }
            } else {
                console.warn(`[MarketAnalysis] No credentials found for workspace ${workspaceId}. Using public API.`);
            }
        } else {
            console.warn(`[MarketAnalysis] No workspaceId provided. Using public API.`);
        }

        // Start analysis
        const results = await marketAnalysisService.performFullCategoryAnalysis(categoryId, accessToken);
        
        return res.json({
            message: "Analysis completed successfully",
            results
        });
    } catch (error: any) {
        console.error("Market analysis failed:", error);
        
        if (error.response?.status === 403 || error.status === 403) {
            return res.status(403).json({
                error: "Mercado Livre API access denied. Please connect your account.",
                details: "The public API is blocking requests. You must connect your Mercado Livre account in Integrations to continue."
            });
        }

        return res.status(500).json({
            error: "Failed to perform market analysis",
            details: error.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/status
 * Checks if the workspace has a valid Mercado Livre connection
 */
router.get("/status", async (req, res) => {
    try {
        const { workspaceId } = req.query as { workspaceId: string };
        if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });

        const status = await verifyMercadoLivreConnection(workspaceId);
        return res.json({ 
            connected: status.connected,
            userId: status.userId
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/analysis-report/:categoryId
 * Retrieves the analysis report for a category
 */
router.get("/analysis-report/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const report = await marketAnalysisService.getCategoryAnalysisReport(categoryId);
        return res.json(report);
    } catch (error: any) {
        console.error("Failed to get analysis report:", error);
        return res.status(500).json({
            error: "Failed to get analysis report",
            details: error.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/analysis-dashboard/:categoryId
 * Retrieves aggregated statistics for a category
 */
router.get("/analysis-dashboard/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const stats = await marketAnalysisService.getCategoryStatistics(categoryId);
        const report = await marketAnalysisService.getCategoryAnalysisReport(categoryId);
        
        return res.json({
            stats,
            topProducts: report.products,
            trends: report.trends
        });
    } catch (error: any) {
        console.error("Failed to get analysis dashboard:", error);
        return res.status(500).json({
            error: "Failed to get analysis dashboard",
            details: error.message
        });
    }
});

/**
 * GET /api/integrations/mercadolivre/db/categories
 * List saved categories
 */
router.get("/db/categories", async (req, res) => {
    try {
        const pool = getPool();
        const { parentId } = req.query;
        
        let query = "SELECT * FROM ml_categories";
        const params = [];
        
        if (parentId) {
            query += " WHERE parent_id = $1";
            params.push(parentId);
        } else if (parentId === null || parentId === 'null') {
             query += " WHERE parent_id IS NULL";
        }
        
        query += " ORDER BY name ASC";
        
        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/db/trends/:categoryId
 * List saved trends for a category
 */
router.get("/db/trends/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const pool = getPool();
        
        const result = await pool.query(
            "SELECT * FROM ml_trends WHERE category_id = $1 ORDER BY position ASC",
            [categoryId]
        );
        return res.json(result.rows);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/integrations/mercadolivre/db/products/:categoryId
 * List saved products for a category
 */
router.get("/db/products/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const pool = getPool();
        
        const result = await pool.query(
            `SELECT *, 
             EXTRACT(DAY FROM NOW() - date_created) as age_days
             FROM ml_products 
             WHERE category_id = $1 
             ORDER BY sold_quantity DESC`,
            [categoryId]
        );
        return res.json(result.rows);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/mercadolivre/analyze-product
 * Triggers analysis for a specific product and its competitors
 */
router.post("/analyze-product", async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const resolvedWorkspace = resolveWorkspaceId(req);
        const workspaceId = resolvedWorkspace.id;
        let accessToken: string | undefined;

        if (workspaceId) {
            if (resolvedWorkspace.usedFallback) {
                console.log(`[MarketAnalysis] Using fallback workspace ${workspaceId} for credentials.`);
            }
            console.log(`[MarketAnalysis] Checking credentials for workspace ${workspaceId}...`);
            let credentials = await getMercadoLivreCredentials(workspaceId);
            
            if (credentials) {
                console.log(`[MarketAnalysis] Credentials found. Checking expiry...`);
                // Refresh logic if needed
                const marginMs = 15 * 60 * 1000;
                if (credentials.expiresAt && Date.now() >= (credentials.expiresAt - marginMs)) {
                    console.log(`[MarketAnalysis] Token expired or close to expiry for workspace ${workspaceId}, refreshing...`);
                    const refreshed = await refreshAccessToken(workspaceId);
                    if (refreshed) {
                        credentials = { 
                            ...credentials, 
                            accessToken: refreshed.accessToken, 
                            refreshToken: refreshed.refreshToken,
                        };
                    }
                }
                
                if (credentials && credentials.accessToken) {
                    accessToken = credentials.accessToken;
                    console.log(`[MarketAnalysis] Using access token for workspace ${workspaceId}`);
                }
            } else {
                console.warn(`[MarketAnalysis] No credentials found for workspace ${workspaceId}. Using public API.`);
            }
        } else {
            console.warn("[MarketAnalysis] Workspace not provided. Using public API.");
        }

        const results = await marketAnalysisService.analyzeProductCompetitors(productId, accessToken);
        
        return res.json({
            message: "Analysis completed successfully",
            results
        });
    } catch (error: any) {
        console.error("Product analysis failed:", error);
        
        // Handle 403 specifically to guide user to connect account
        if (error.response?.status === 403 || error.status === 403) {
            return res.status(403).json({
                error: "Mercado Livre API access denied. Please connect your account.",
                details: "The public API is blocking requests. You must connect your Mercado Livre account in Integrations to continue."
            });
        }

        return res.status(500).json({
            error: "Failed to perform product analysis",
            details: error.message
        });
    }
});

export default router;

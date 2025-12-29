import { Router } from "express";
import axios from "axios";
import { getPool } from "../../config/database.js";
import { encryptCredentials, decryptCredentials } from "../../services/encryption.js";

const router = Router();
const TRAY_PLATFORM_KEY = "tray";

// Credentials provided by user (should ideally be in .env)
const TRAY_CONSUMER_KEY = process.env.TRAY_CONSUMER_KEY || "52499b11a3cd1536e3679b58cabc7b4424e63f8f5d1e772977eb841e8a2db780";
const TRAY_CONSUMER_SECRET = process.env.TRAY_CONSUMER_SECRET || "648d7ee1b854963ca63ca3e1bc60d73df57bf2f6bbdcb767d658cfb3b44d9189";

interface TrayCredentials {
    accessToken: string;
    refreshToken: string;
    dateExpirationAccessToken: string; // "2023-01-01 12:00:00"
    dateExpirationRefreshToken: string;
    storeUrl: string; // e.g., "https://www.minhaloja.com.br"
}

// In-memory cache for tokens
const tokenStore = new Map<string, TrayCredentials>();

async function persistTrayCredentials(workspaceId: string, credentials: TrayCredentials): Promise<boolean> {
    try {
        const pool = getPool();
        const { encrypted_credentials, encryption_iv } = encryptCredentials(credentials);

        await pool.query(
            `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, platform_key)
             DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
            [workspaceId, TRAY_PLATFORM_KEY, encrypted_credentials, encryption_iv]
        );
        tokenStore.set(workspaceId, credentials);
        return true;
    } catch (error) {
        console.error("[Tray] Falha ao persistir credenciais:", error);
        return false;
    }
}

export async function getTrayCredentials(workspaceId: string): Promise<TrayCredentials | null> {
    if (tokenStore.has(workspaceId)) {
        return tokenStore.get(workspaceId)!;
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE workspace_id = $1 AND platform_key = $2
             LIMIT 1`,
            [workspaceId, TRAY_PLATFORM_KEY]
        );

        if (!result.rows.length) return null;

        const decrypted = decryptCredentials(
            result.rows[0].encrypted_credentials,
            result.rows[0].encryption_iv
        ) as TrayCredentials;

        tokenStore.set(workspaceId, decrypted);
        return decrypted;
    } catch (error) {
        console.error("[Tray] Erro ao buscar credenciais:", error);
        return null;
    }
}

/**
 * Verifica se o token precisa de refresh
 */
function needsRefresh(creds: TrayCredentials): boolean {
    const now = new Date();
    const expiration = new Date(creds.dateExpirationAccessToken);
    // Refresh se faltar menos de 1 hora para expirar
    return now.getTime() + 60 * 60 * 1000 >= expiration.getTime();
}

/**
 * Realiza o refresh do token
 */
async function refreshTrayToken(workspaceId: string, creds: TrayCredentials): Promise<TrayCredentials | null> {
    try {
        const cleanUrl = creds.storeUrl.replace(/\/$/, "").replace(/^https?:\/\//, "");
        const url = `https://${cleanUrl}/web_api/auth`;
        
        const response = await axios.get(url, {
            params: {
                refresh_token: creds.refreshToken,
                consumer_key: TRAY_CONSUMER_KEY,
                consumer_secret: TRAY_CONSUMER_SECRET
            }
        });

        const { access_token, refresh_token, date_expiration_access_token, date_expiration_refresh_token } = response.data;

        const newCreds: TrayCredentials = {
            ...creds,
            accessToken: access_token,
            refreshToken: refresh_token,
            dateExpirationAccessToken: date_expiration_access_token,
            dateExpirationRefreshToken: date_expiration_refresh_token
        };

        await persistTrayCredentials(workspaceId, newCreds);
        return newCreds;
    } catch (error) {
        console.error("[Tray] Erro ao fazer refresh do token:", error);
        return null;
    }
}

/**
 * Wrapper para requisições autenticadas na Tray
 */
export async function requestTray<T>(workspaceId: string, path: string, options: any = {}): Promise<T> {
    let creds = await getTrayCredentials(workspaceId);
    if (!creds) throw new Error("Tray integration not connected");

    if (needsRefresh(creds)) {
        const refreshed = await refreshTrayToken(workspaceId, creds);
        if (refreshed) creds = refreshed;
        else throw new Error("Failed to refresh Tray token");
    }

    const cleanUrl = creds.storeUrl.replace(/\/$/, "").replace(/^https?:\/\//, "");
    const url = `https://${cleanUrl}/web_api${path.startsWith("/") ? "" : "/"}${path}`;

    const response = await axios({
        url,
        method: options.method || "GET",
        params: { ...options.params, access_token: creds.accessToken },
        data: options.data,
        headers: options.headers
    });

    return response.data;
}

// --- Routes ---

/**
 * GET /api/integrations/tray/auth/url
 * Gera a URL para o usuário iniciar a autenticação
 */
router.get("/auth/url", (req, res) => {
    try {
        const { storeUrl, workspaceId } = req.query;
        if (!storeUrl || !workspaceId) {
            return res.status(400).json({ error: "Store URL and Workspace ID are required" });
        }

        const cleanUrl = String(storeUrl).replace(/\/$/, "").replace(/^https?:\/\//, "");
        
        // Tenta determinar a URL do frontend dinamicamente se não estiver na ENV
        const origin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer')!).origin : null);
        const baseUrl = process.env.FRONTEND_URL || origin || "http://localhost:5173";
        const callbackUrl = `${baseUrl}/integrations/tray/callback`;

        const stateData = JSON.stringify({ workspaceId, storeUrl: cleanUrl });
        const state = Buffer.from(stateData).toString('base64');

        const authUrl = `https://${cleanUrl}/auth.php?response_type=code&consumer_key=${TRAY_CONSUMER_KEY}&callback=${encodeURIComponent(callbackUrl)}&state=${state}`;

        res.json({ authUrl });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/integrations/tray/auth/callback
 * Troca o code pelo token
 */
router.post("/auth/callback", async (req, res) => {
    try {
        const { code, storeUrl, workspaceId } = req.body;
        if (!code || !storeUrl || !workspaceId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const cleanUrl = String(storeUrl).replace(/\/$/, "").replace(/^https?:\/\//, "");
        const url = `https://${cleanUrl}/web_api/auth`;

        // Troca code por token
        const response = await axios.post(url, {
            consumer_key: TRAY_CONSUMER_KEY,
            consumer_secret: TRAY_CONSUMER_SECRET,
            code
        });

        const { access_token, refresh_token, date_expiration_access_token, date_expiration_refresh_token } = response.data;

        if (!access_token) {
            throw new Error("Failed to retrieve access token from Tray");
        }

        const credentials: TrayCredentials = {
            accessToken: access_token,
            refreshToken: refresh_token,
            dateExpirationAccessToken: date_expiration_access_token,
            dateExpirationRefreshToken: date_expiration_refresh_token,
            storeUrl: `https://${cleanUrl}`
        };

        await persistTrayCredentials(String(workspaceId), credentials);

        res.json({ success: true, message: "Tray integration connected successfully" });
    } catch (error: any) {
        console.error("Tray Auth Error:", error?.response?.data || error.message);
        res.status(500).json({ 
            error: "Failed to authenticate with Tray", 
            details: error?.response?.data || error.message 
        });
    }
});

/**
 * GET /api/integrations/tray/metrics
 * Exemplo de rota para buscar métricas (stub)
 */
router.get("/metrics", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });

        // Exemplo: Buscar dados básicos da loja
        const storeInfo = await requestTray<any>(String(workspaceId), "/info");
        
        // Exemplo: Buscar pedidos de hoje (pode ser complexo na Tray, requer filtro)
        // const orders = await requestTray(String(workspaceId), "/orders?date_created_start=...");

        res.json({
            store: storeInfo,
            // Adicionar mais métricas aqui
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

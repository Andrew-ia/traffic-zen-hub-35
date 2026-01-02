import { Router } from "express";
import axios from "axios";
import { getPool } from "../../config/database.js";
import { decryptCredentials } from "../../services/encryption.js";

const router = Router();
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";
const MERCADO_LIVRE_PLATFORM_KEY = "mercadolivre";
const ML_PLAINTEXT_IV = "plain";

/**
 * Interface para credenciais do Mercado Livre
 */
interface MercadoLivreCredentials {
    accessToken: string;
    refreshToken: string;
    userId: string;
}

/**
 * Buscar credenciais do Mercado Livre do banco
 */
async function getMercadoLivreCredentials(workspaceId: string): Promise<(MercadoLivreCredentials & { expiresAt?: number }) | null> {
    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE workspace_id = $1 AND platform_key = $2
             LIMIT 1`,
            [workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );

        if (!result.rows.length) {
            const accessToken = process.env.MERCADO_LIVRE_ACCESS_TOKEN;
            const refreshToken = process.env.MERCADO_LIVRE_REFRESH_TOKEN;
            const userId = process.env.MERCADO_LIVRE_USER_ID;
            if (accessToken && userId) {
                return {
                    accessToken: String(accessToken),
                    refreshToken: String(refreshToken || ""),
                    userId: String(userId),
                };
            }
            return null;
        }

        const decrypted = decryptCredentials(
            result.rows[0].encrypted_credentials,
            result.rows[0].encryption_iv
        ) as any;

        const accessToken = decrypted.accessToken || decrypted.access_token;
        const refreshToken = decrypted.refreshToken || decrypted.refresh_token;
        const userId = decrypted.userId || decrypted.user_id;

        if (!accessToken || !userId) return null;

        return {
            accessToken: String(accessToken),
            refreshToken: String(refreshToken || ""),
            userId: String(userId),
            expiresAt: typeof decrypted.expiresAt === "number" ? decrypted.expiresAt : undefined,
        };
    } catch (error) {
        console.error("[MercadoLivre Fulfillment] Erro ao buscar credenciais:", error);
        return null;
    }
}

/**
 * Verifica se o token precisa ser renovado
 */
function tokenNeedsRefresh(creds: { expiresAt?: number }): boolean {
    if (!creds.expiresAt) return false;
    const marginMs = 15 * 60 * 1000; // 15 minutos de margem
    return Date.now() >= (creds.expiresAt - marginMs);
}

/**
 * Renova o access token usando refresh token
 */
async function refreshAccessToken(workspaceId: string, current: MercadoLivreCredentials): Promise<MercadoLivreCredentials | null> {
    if (!current.refreshToken) return null;

    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("[Fulfillment] CLIENT_ID ou CLIENT_SECRET não configurados");
        return null;
    }

    try {
        const tokenResponse = await axios.post(
            `${MERCADO_LIVRE_API_BASE}/oauth/token`,
            {
                grant_type: "refresh_token",
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: current.refreshToken,
            },
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data || {};
        const updated: MercadoLivreCredentials & { expiresAt?: number } = {
            accessToken: String(access_token || ""),
            refreshToken: String(refresh_token || current.refreshToken || ""),
            userId: current.userId,
            expiresAt: typeof expires_in === "number" ? Date.now() + (expires_in * 1000) : undefined,
        };

        // Persistir no banco
        const pool = getPool();
        const encrypted_credentials = JSON.stringify(updated);
        const encryption_iv = ML_PLAINTEXT_IV;
        await pool.query(
            `UPDATE integration_credentials
             SET encrypted_credentials = $1, encryption_iv = $2, updated_at = now()
             WHERE workspace_id = $3 AND platform_key = $4`,
            [encrypted_credentials, encryption_iv, workspaceId, MERCADO_LIVRE_PLATFORM_KEY]
        );

        console.log("[Fulfillment] Token renovado com sucesso");
        return { accessToken: updated.accessToken, refreshToken: updated.refreshToken, userId: updated.userId };
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao renovar token:", error.response?.data || error.message);
        return null;
    }
}

/**
 * GET /api/integrations/mercadolivre-fulfillment/inventory/:itemId
 * Busca o inventory_id de um item específico
 */
router.get("/inventory/:itemId", async (req, res) => {
    try {
        const { itemId } = req.params;
        const { workspaceId } = req.query;

        if (!workspaceId || typeof workspaceId !== "string") {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({ error: "Credenciais do Mercado Livre não encontradas" });
        }

        const response = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/items/${itemId}`,
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
            }
        );

        return res.json({
            itemId: response.data.id,
            inventoryId: response.data.inventory_id || null,
            title: response.data.title,
            availableQuantity: response.data.available_quantity,
        });
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao buscar inventory_id:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || "Erro ao buscar inventory_id",
        });
    }
});

/**
 * GET /api/integrations/mercadolivre-fulfillment/stock/:inventoryId
 * Consulta estoque Full de um produto específico
 */
router.get("/stock/:inventoryId", async (req, res) => {
    try {
        const { inventoryId } = req.params;
        const { workspaceId, includeConditions } = req.query;

        if (!workspaceId || typeof workspaceId !== "string") {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({ error: "Credenciais do Mercado Livre não encontradas" });
        }

        let url = `${MERCADO_LIVRE_API_BASE}/inventories/${inventoryId}/stock/fulfillment`;
        if (includeConditions === "true") {
            url += "?include_attributes=conditions";
        }

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
            },
        });

        return res.json(response.data);
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao buscar estoque:", error.response?.data || error.message);

        if (error.response?.status === 404) {
            return res.status(404).json({ error: "Produto não encontrado no fulfillment" });
        }

        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || "Erro ao buscar estoque fulfillment",
        });
    }
});

/**
 * GET /api/integrations/mercadolivre-fulfillment/operations
 * Busca operações de estoque Full (histórico de movimentações)
 */
router.get("/operations", async (req, res) => {
    try {
        const { workspaceId, inventoryId, dateFrom, dateTo, type, limit, scroll } = req.query;

        if (!workspaceId || typeof workspaceId !== "string") {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        if (!inventoryId || typeof inventoryId !== "string") {
            return res.status(400).json({ error: "inventoryId é obrigatório" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({ error: "Credenciais do Mercado Livre não encontradas" });
        }

        const params: any = {
            seller_id: credentials.userId,
            inventory_id: inventoryId,
        };

        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (type) params.type = type;
        if (limit) params.limit = limit;
        if (scroll) params.scroll = scroll;

        const response = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/stock/fulfillment/operations/search`,
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
                params,
            }
        );

        return res.json(response.data);
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao buscar operações:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || "Erro ao buscar operações de estoque",
        });
    }
});

/**
 * GET /api/integrations/mercadolivre-fulfillment/operation/:operationId
 * Busca detalhes de uma operação específica
 */
router.get("/operation/:operationId", async (req, res) => {
    try {
        const { operationId } = req.params;
        const { workspaceId } = req.query;

        if (!workspaceId || typeof workspaceId !== "string") {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({ error: "Credenciais do Mercado Livre não encontradas" });
        }

        const response = await axios.get(
            `${MERCADO_LIVRE_API_BASE}/stock/fulfillment/operations/${operationId}`,
            {
                headers: {
                    Authorization: `Bearer ${credentials.accessToken}`,
                },
            }
        );

        return res.json(response.data);
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao buscar operação:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || "Erro ao buscar detalhes da operação",
        });
    }
});

/**
 * GET /api/integrations/mercadolivre-fulfillment/summary
 * Busca resumo consolidado de estoque Full para todos os produtos
 */
router.get("/summary", async (req, res) => {
    try {
        const { workspaceId } = req.query;

        if (!workspaceId || typeof workspaceId !== "string") {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        let credentials = await getMercadoLivreCredentials(workspaceId);
        if (!credentials) {
            return res.status(401).json({ error: "Credenciais do Mercado Livre não encontradas" });
        }

        // Refresh antecipado se token estiver perto de expirar
        if (tokenNeedsRefresh(credentials)) {
            const refreshed = await refreshAccessToken(workspaceId, credentials);
            if (refreshed) {
                credentials = refreshed;
            }
        }

        const summary = {
            totalProducts: 0,
            fullProducts: 0,
            totalStock: 0,
            availableStock: 0,
            unavailableStock: 0,
            unavailableDetail: {
                damaged: 0,
                lost: 0,
                withdrawal: 0,
                internal_process: 0,
                transfer: 0,
                noFiscalCoverage: 0,
                not_supported: 0,
            },
            products: [] as any[],
        };

        // Buscar todos os produtos do seller com paginação
        let offset = 0;
        const limit = 50;
        let hasMore = true;
        const allItemIds: string[] = [];

        while (hasMore && allItemIds.length < 200) {
            try {
                const itemsResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                        },
                        params: { limit, offset },
                    }
                );

                const itemIds = itemsResponse.data.results || [];
                allItemIds.push(...itemIds);

                if (itemIds.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } catch (error: any) {
                console.error("[Fulfillment] Erro ao buscar lista de produtos:", error.message);
                hasMore = false;
            }
        }

        console.log(`[Fulfillment] Total de ${allItemIds.length} produtos encontrados`);

        // Buscar detalhes de cada item em lotes
        for (const itemId of allItemIds) {
            try {
                const itemResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/items/${itemId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${credentials.accessToken}`,
                        },
                    }
                );

                const item = itemResponse.data;
                const inventoryId = item.inventory_id;

                if (!inventoryId) continue;

                summary.totalProducts++;

                // Detectar se o produto usa Mercado Envios Full
                const logisticType = item?.shipping?.logistic_type || null;
                const tags: string[] = Array.isArray(item?.tags) ? item.tags : [];
                const isFull = String(logisticType || '').toLowerCase() === 'fulfillment' || tags.includes('is_fulfillment');

                if (!isFull) continue; // Só processar produtos Full

                // Buscar estoque Full
                try {
                    const stockResponse = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/inventories/${inventoryId}/stock/fulfillment`,
                        {
                            headers: {
                                Authorization: `Bearer ${credentials.accessToken}`,
                            },
                        }
                    );

                    const stock = stockResponse.data;
                    summary.fullProducts++;
                    summary.totalStock += stock.total || 0;
                    summary.availableStock += stock.available_quantity || 0;
                    summary.unavailableStock += stock.not_available_quantity || 0;

                    // Consolidar detalhes de indisponibilidade
                    if (stock.not_available_detail && Array.isArray(stock.not_available_detail)) {
                        stock.not_available_detail.forEach((detail: any) => {
                            const status = detail.status;
                            if (status in summary.unavailableDetail) {
                                summary.unavailableDetail[status as keyof typeof summary.unavailableDetail] += detail.quantity || 0;
                            }
                        });
                    }

                    summary.products.push({
                        itemId: item.id,
                        inventoryId,
                        title: item.title,
                        thumbnail: item.thumbnail,
                        total: stock.total || 0,
                        available: stock.available_quantity || 0,
                        unavailable: stock.not_available_quantity || 0,
                        unavailableDetail: stock.not_available_detail || [],
                    });

                    console.log(`[Fulfillment] ✓ ${item.title} - Total: ${stock.total}, Disponível: ${stock.available_quantity}`);
                } catch (stockError: any) {
                    // Produto marcado como Full mas sem estoque no fulfillment
                    if (stockError.response?.status === 404) {
                        console.log(`[Fulfillment] Produto ${itemId} marcado como Full mas sem estoque no fulfillment`);
                    } else {
                        console.error(`[Fulfillment] Erro ao buscar estoque Full do item ${itemId}:`, stockError.message);
                    }
                }
            } catch (itemError: any) {
                if (itemError.response?.status === 401) {
                    console.error(`[Fulfillment] Token expirado, tentando refresh...`);
                    const refreshed = await refreshAccessToken(workspaceId, credentials);
                    if (refreshed) {
                        credentials = refreshed;
                    }
                } else {
                    console.error(`[Fulfillment] Erro ao buscar item ${itemId}:`, itemError.message);
                }
            }
        }

        console.log(`[Fulfillment] Resumo Final - Total: ${summary.totalProducts}, Full: ${summary.fullProducts}, Estoque: ${summary.totalStock}`);
        return res.json(summary);
    } catch (error: any) {
        console.error("[Fulfillment] Erro ao gerar resumo:", error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || "Erro ao gerar resumo de estoque",
        });
    }
});

export default router;

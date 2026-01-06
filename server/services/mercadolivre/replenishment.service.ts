
import { getPool } from "../../config/database.js";
import { getMercadoLivreCredentials, requestWithAuth } from "../../api/integrations/mercadolivre.js";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

// Configurações padrão
const DEFAULT_STOCK_COVER_DAYS = 45;

export async function ensureReplenishmentSchema() {
    const pool = getPool();
    await pool.query(`
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS stock_cover_days DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS replenishment_suggestion INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_replenishment_calc_at TIMESTAMP WITH TIME ZONE
    `);
}

/**
 * Atualiza sugestões de reabastecimento para produtos Full
 */
export async function updateReplenishmentSuggestions(workspaceId: string, userId: string) {
    await ensureReplenishmentSchema();
    const pool = getPool();
    
    // 1. Busca produtos do tipo fulfillment com dados de vendas
    const { rows: products } = await pool.query(`
        SELECT 
            id, 
            ml_item_id, 
            ml_full_stock, 
            sales_30d,
            title
        FROM products 
        WHERE workspace_id = $1 
        AND ml_logistic_type = 'fulfillment'
        AND status = 'active'
    `, [workspaceId]);

    console.log(`[Replenishment] Calculando sugestões para ${products.length} produtos Full...`);

    let updatedCount = 0;

    // 2. Para cada produto, calcula a sugestão
    for (const product of products) {
        // Vendas diárias médias (mínimo 0.1 para evitar zero absoluto em produtos com pouca venda mas ativos)
        const dailySales = Math.max((product.sales_30d || 0) / 30, 0.1);
        
        // Estoque necessário para cobrir X dias (com fator de segurança 1.5x se estoque zerado)
        let factor = 1.0;
        if (product.ml_full_stock === 0 && product.sales_30d > 0) {
            factor = 1.5; // Se está zerado e vende, sugere mais agressivamente
        }

        const requiredStock = Math.ceil(dailySales * DEFAULT_STOCK_COVER_DAYS * factor);
        
        // Sugestão = Necessário - Atual (se positivo)
        const currentStock = product.ml_full_stock || 0;
        let suggestion = Math.max(0, requiredStock - currentStock);

        // Se a sugestão for muito baixa (< 5) mas vendeu algo, arredonda pra cima (envio mínimo viável)
        if (suggestion > 0 && suggestion < 5 && product.sales_30d > 0) {
            suggestion = 5;
        }

        // Atualiza no banco
        await pool.query(`
            UPDATE products 
            SET 
                stock_cover_days = $1,
                replenishment_suggestion = $2,
                last_replenishment_calc_at = NOW()
            WHERE id = $3
        `, [DEFAULT_STOCK_COVER_DAYS, suggestion, product.id]);

        updatedCount++;
    }

    console.log(`[Replenishment] Atualizadas sugestões para ${updatedCount} produtos.`);
    return { updatedCount };
}

/**
 * Busca dados de saúde do estoque (Stock Health) da API do ML se possível
 * Nota: Endpoint restrito, pode falhar com 403.
 */
export async function fetchStockHealth(workspaceId: string) {
    try {
        const creds = await getMercadoLivreCredentials(workspaceId);
        if (!creds) throw new Error("Credenciais não encontradas");

        const url = `${MERCADO_LIVRE_API_BASE}/stock/fulfillment/inventory/health`;
        const response = await requestWithAuth<any>(workspaceId, url, {
            params: { seller_id: creds.userId }
        });
        
        return response;
    } catch (error: any) {
        console.warn(`[Replenishment] Falha ao buscar Stock Health: ${error.message}`);
        return null;
    }
}

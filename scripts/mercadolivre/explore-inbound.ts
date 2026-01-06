
import axios from "axios";
import { getMercadoLivreCredentials, requestWithAuth } from "../../server/api/integrations/mercadolivre.js";
import { getPool, closeDatabasePool } from "../../server/config/database.js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

async function exploreInbound() {
  console.log("Iniciando exploração de Inbound/Fulfillment...");

  try {
    const creds = await getMercadoLivreCredentials(WORKSPACE_ID);
    if (!creds) {
      console.error("Credenciais não encontradas!");
      return;
    }

    console.log(`Usuário logado: ${creds.userId}`);

    // Teste 1: Recomendações de reabastecimento (Replenishment) - Tentativa 2
    console.log("\n--- Teste 1: Replenishment Recommendations (Tentativa 2) ---");
    try {
      const url = `${MERCADO_LIVRE_API_BASE}/stock/fulfillment/replenishment/recommendations`;
      const response = await requestWithAuth<any>(WORKSPACE_ID, url, {
        params: {
          seller_id: creds.userId,
          limit: 5,
          offset: 0
        },
        headers: {
            "x-format-new": "true"
        }
      });
      console.log("Sucesso! Dados encontrados:", JSON.stringify(response, null, 2).substring(0, 500));
    } catch (error: any) {
      console.log("Erro no Teste 1:", error.response?.status, error.response?.data?.message || error.message);
    }

    // Teste 4: Stock Health / Cobertura
    console.log("\n--- Teste 4: Stock Health ---");
    try {
        // Tentar endpoint de inventário com health
        // GET /inventories/{inventory_id}/stock/fulfillment já retorna estoque.
        // Talvez haja um endpoint global de saúde
        const url = `${MERCADO_LIVRE_API_BASE}/stock/fulfillment/inventory/health`;
         const response = await requestWithAuth<any>(WORKSPACE_ID, url, {
            params: {
                seller_id: creds.userId
            }
        });
        console.log("Sucesso! Dados de saúde encontrados:", JSON.stringify(response, null, 2).substring(0, 500));
    } catch (error: any) {
         console.log("Erro no Teste 4:", error.response?.status, error.response?.data?.message || error.message);
    }


    // Teste 2: Inbound Shipments Plan
    console.log("\n--- Teste 2: Inbound Shipments Plan ---");
    try {
        // Tentar endpoint de plano de envio
        const url = `${MERCADO_LIVRE_API_BASE}/inbound/shipments/plan`;
        const response = await requestWithAuth<any>(WORKSPACE_ID, url, {
            params: {
                seller_id: creds.userId
            }
        });
        console.log("Sucesso! Dados encontrados:", JSON.stringify(response, null, 2).substring(0, 500));
    } catch (error: any) {
        console.log("Erro no Teste 2:", error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Teste 3: Items com filtro de fulfillment
    console.log("\n--- Teste 3: Items Search (Fulfillment) ---");
    try {
        const url = `${MERCADO_LIVRE_API_BASE}/users/${creds.userId}/items/search`;
        const response = await requestWithAuth<any>(WORKSPACE_ID, url, {
            params: {
                logistic_type: 'fulfillment',
                limit: 5
            }
        });
        const items = response.results || [];
        console.log(`Encontrados ${items.length} itens fulfillment.`);
        
        if (items.length > 0) {
            const itemId = items[0];
            // Buscar detalhes do item para ver se tem info de restock
            const itemDetails = await requestWithAuth<any>(WORKSPACE_ID, `${MERCADO_LIVRE_API_BASE}/items/${itemId}`);
            console.log("Item details (shipping):", JSON.stringify(itemDetails.shipping, null, 2));
            
            // Tentar endpoint de estoque do item
            if (itemDetails.inventory_id) {
                 const stockUrl = `${MERCADO_LIVRE_API_BASE}/inventories/${itemDetails.inventory_id}/stock/fulfillment`;
                 const stockResp = await requestWithAuth<any>(WORKSPACE_ID, stockUrl);
                 console.log("Stock details:", JSON.stringify(stockResp, null, 2));
            }
        }
    } catch (error: any) {
        console.log("Erro no Teste 3:", error.response?.status, error.response?.data?.message || error.message);
    }

  } catch (err: any) {
    console.error("Erro geral:", err);
  } finally {
    await closeDatabasePool();
  }
}

exploreInbound();

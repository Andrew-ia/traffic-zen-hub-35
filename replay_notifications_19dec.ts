
import { getPool } from "./server/config/database";
import { decryptCredentials } from "./server/services/encryption";
import axios from "axios";
import dotenv from "dotenv";
// Importar o serviço de notificação dinamicamente dentro da função

dotenv.config();
dotenv.config({ path: '.env.local' });

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

// Copiando funções auxiliares de mercadolivre.ts para o script funcionar standalone
async function getMercadoLivreCredentials(workspaceId: string) {
    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT encrypted_credentials, encryption_iv
             FROM integration_credentials
             WHERE workspace_id = $1 AND platform_key = 'mercadolivre'`,
            [workspaceId]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const creds = decryptCredentials(row.encrypted_credentials, row.encryption_iv) as any;
        
        return {
            accessToken: creds.accessToken,
            refreshToken: creds.refreshToken,
            userId: creds.userId || creds.user_id,
        };
    } catch (error) {
        console.error("Erro ao buscar credenciais:", error);
        return null;
    }
}

async function refreshAccessToken(workspaceId: string, current: any) {
    if (!current.refreshToken) return null;
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    
    console.log(`🔄 Tentando refresh token para workspace ${workspaceId}...`);
    
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

        const { access_token, refresh_token } = tokenResponse.data || {};
        console.log("✅ Token atualizado com sucesso!");
        
        // Atualizar no banco seria ideal, mas para este script vamos apenas retornar o novo token para uso em memória
        // Se precisar persistir, teríamos que replicar a lógica de persistMercadoLivreCredentials
        
        return {
            accessToken: access_token,
            refreshToken: refresh_token,
            userId: current.userId,
        };
    } catch (error: any) {
        console.error("❌ Erro no refresh token:", error?.response?.data || error.message);
        return null;
    }
}

async function requestWithAuth(workspaceId: string, url: string, config: any = {}) {
    let creds = await getMercadoLivreCredentials(workspaceId);
    if (!creds) throw new Error("ml_not_connected");

    try {
        const resp = await axios.request({
            url,
            method: config.method || "GET",
            params: config.params,
            data: config.data,
            headers: { Authorization: `Bearer ${creds.accessToken}`, ...config.headers }
        });
        return resp.data;
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401) {
            console.log("⚠️ Token expirado, tentando refresh...");
            const refreshed = await refreshAccessToken(workspaceId, creds);
            if (!refreshed) throw err;
            
            // Tentar novamente com novo token
            const resp = await axios.request({
                url,
                method: config.method || "GET",
                params: config.params,
                data: config.data,
                headers: { Authorization: `Bearer ${refreshed.accessToken}`, ...config.headers }
            });
            return resp.data;
        }
        throw err;
    }
}

async function main() {
    try {
        const { TelegramNotificationService } = await import("./server/services/telegramNotification.service");
        
        // Configuração
        const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010'; // ID confirmado nos logs anteriores
        const DATE_TARGET = '2025-12-19';
        
        console.log(`🚀 Iniciando reenvio de notificações para ${DATE_TARGET} no workspace ${WORKSPACE_ID}`);
        
        // Definir intervalo de tempo (UTC-3 para UTC)
        // ML API espera ISO String.
        // 2025-12-19 00:00:00 BRT -> 2025-12-19T03:00:00.000Z
        // 2025-12-19 23:59:59 BRT -> 2025-12-20T02:59:59.999Z
        
        const dateFrom = new Date(`${DATE_TARGET}T00:00:00-03:00`);
        const dateTo = new Date(`${DATE_TARGET}T23:59:59-03:00`);
        
        console.log(`📅 Buscando pedidos de ${dateFrom.toISOString()} até ${dateTo.toISOString()}`);

        const creds = await getMercadoLivreCredentials(WORKSPACE_ID);
        if (!creds) {
            console.error("❌ Credenciais não encontradas.");
            return;
        }

        const params = {
            seller: creds.userId,
            'order.date_created.from': dateFrom.toISOString(),
            'order.date_created.to': dateTo.toISOString(),
            sort: 'date_asc', // Mais antigos primeiro para manter ordem cronológica
            limit: 50, // Ajuste conforme volume
        };

        const data = await requestWithAuth(
            WORKSPACE_ID,
            `${MERCADO_LIVRE_API_BASE}/orders/search`,
            { params }
        );
        
        const orders = data.results || [];
        console.log(`📦 Encontrados ${orders.length} pedidos.`);
        
        if (orders.length === 0) {
            console.log("✅ Nenhum pedido encontrado para esta data.");
            return;
        }

        let sentCount = 0;
        let failedCount = 0;

        for (const order of orders) {
            console.log(`\n🔔 Processando Pedido: ${order.id} | Valor: ${order.total_amount} | Status: ${order.status}`);
            
            // Validar status (opcional, mas recomendado pois o webhook filtra)
            const status = String(order.status || "").toLowerCase();
            if (!["paid", "confirmed"].includes(status)) {
                console.log(`   ⏭️ Pulando pedido com status '${status}' (apenas 'paid' ou 'confirmed')`);
                continue;
            }

            // Enviar notificação
            // Nota: O serviço tem verificação de duplicidade, mas como estamos forçando o reenvio,
            // pode ser necessário ajustar o serviço ou limpar logs.
            // Porém, o usuário pediu para REENVIAR, então se já foi enviado, o serviço vai bloquear.
            // O usuário disse que "não recebeu nenhuma mensagem", então não deve ter log de sucesso.
            
            const success = await TelegramNotificationService.notifyNewOrder(WORKSPACE_ID, order);
            
            if (success) {
                console.log(`   ✅ Notificação enviada com sucesso!`);
                sentCount++;
            } else {
                console.log(`   ⚠️ Notificação não enviada (possível duplicata ou erro).`);
                failedCount++;
            }
            
            // Pequeno delay para não flodar o Telegram
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n🏁 Processo finalizado!`);
        console.log(`   Enviados: ${sentCount}`);
        console.log(`   Falhas/Ignorados: ${failedCount}`);

    } catch (error: any) {
        console.error("❌ Erro fatal:", error.message);
        if (error.response) {
            console.error("   Detalhes API:", error.response.data);
        }
    } finally {
        process.exit(0);
    }
}

main();

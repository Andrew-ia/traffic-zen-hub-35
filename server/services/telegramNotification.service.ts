import fetch from "node-fetch";
import { getPool } from "../config/database.js";

interface TelegramConfig {
    botToken: string;
    chatId: string;
}

interface NotificationPayload {
    workspaceId: string;
    type: "order_created" | "question_received" | "item_updated" | "message_received";
    data: any;
}

/**
 * Serviço para enviar notificações via Telegram
 */
export class TelegramNotificationService {
    /**
     * Busca configuração do Telegram para um workspace
     */
    private static async getTelegramConfig(workspaceId: string): Promise<TelegramConfig | null> {
        try {
            const pool = getPool();
            const result = await pool.query(
                `SELECT config
                 FROM notification_settings
                 WHERE workspace_id = $1 AND platform = 'telegram' AND enabled = true
                 LIMIT 1`,
                [workspaceId]
            );

            if (!result.rows.length) return null;

            const config = result.rows[0].config;
            if (!config.bot_token || !config.chat_id) return null;

            return {
                botToken: config.bot_token,
                chatId: config.chat_id,
            };
        } catch (error) {
            console.error("[Telegram] Erro ao buscar configuração:", error);
            return null;
        }
    }

    /**
     * Envia mensagem via Telegram Bot API
     */
    private static async sendTelegramMessage(
        botToken: string,
        chatId: string,
        message: string,
        parseMode: "HTML" | "Markdown" = "HTML"
    ): Promise<{ ok: boolean; response?: any; error?: string }> {
        try {
            const normalizedChatId = /^-?\d+$/.test(String(chatId)) ? Number(chatId) : chatId;
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: normalizedChatId,
                    text: message,
                    parse_mode: parseMode,
                    disable_web_page_preview: false,
                }),
            });
            const json = await response.json().catch(() => ({}));
            const ok = Boolean(json?.ok === true);
            const description = typeof json?.description === "string" ? json.description : undefined;
            return { ok, response: json, error: ok ? undefined : description };
        } catch (error: any) {
            const msg = error?.message || String(error);
            console.error("[Telegram] Erro ao enviar mensagem:", msg);
            return { ok: false, error: msg };
        }
    }

    /**
     * Salva log da notificação no banco
     */
    private static async logNotification(
        workspaceId: string,
        type: string,
        referenceId: string | null,
        status: "sent" | "failed",
        payload: any,
        response: any = null,
        errorMessage: string | null = null
    ): Promise<void> {
        try {
            const pool = getPool();
            await pool.query(
                `INSERT INTO notification_logs
                 (workspace_id, platform, notification_type, reference_id, status, payload, response, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    workspaceId,
                    "telegram",
                    type,
                    referenceId,
                    status,
                    JSON.stringify(payload),
                    response ? JSON.stringify(response) : null,
                    errorMessage,
                ]
            );
        } catch (error) {
            console.error("[Telegram] Erro ao salvar log:", error);
        }
    }

    /**
     * Formata mensagem para notificação de nova venda
     */
    private static formatOrderMessage(orderData: any): string {
        const {
            id,
            total_amount,
            paid_amount,
            currency_id,
            status,
            date_created,
            buyer,
            order_items,
        } = orderData;

        const formatCurrency = (value: number) => {
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: currency_id || "BRL",
            }).format(value);
        };

        const formatDate = (dateStr: string) => {
            return new Date(dateStr).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        };

        let message = `🎉 <b>NOVA VENDA NO MERCADO LIVRE!</b>\n\n`;
        message += `📦 <b>Pedido:</b> #${id}\n`;
        message += `💰 <b>Valor:</b> ${formatCurrency(paid_amount || total_amount)}\n`;
        message += `📊 <b>Status:</b> ${status}\n`;
        message += `📅 <b>Data:</b> ${formatDate(date_created)}\n\n`;

        if (buyer) {
            message += `👤 <b>Comprador:</b>\n`;
            message += `   • ID: ${buyer.id || "N/A"}\n`;
            if (buyer.nickname) message += `   • Nome: ${buyer.nickname}\n`;
        }

        if (order_items && order_items.length > 0) {
            message += `\n📋 <b>Itens:</b>\n`;
            order_items.forEach((item: any, idx: number) => {
                const itemTitle = item.item?.title || "Produto";
                const quantity = item.quantity || 1;
                const unitPrice = item.unit_price || 0;
                message += `   ${idx + 1}. ${itemTitle}\n`;
                message += `      • Qtd: ${quantity} x ${formatCurrency(unitPrice)}\n`;
            });
        }

        message += `\n🔗 <a href="https://www.mercadolivre.com.br/vendas/${id}/detalle">Ver Pedido no ML</a>`;

        return message;
    }

    /**
     * Formata mensagem para notificação de pergunta
     */
    private static formatQuestionMessage(questionData: any): string {
        const { id, text, from, item_id, date_created } = questionData;

        const formatDate = (dateStr: string) => {
            return new Date(dateStr).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        };

        let message = `❓ <b>NOVA PERGUNTA NO MERCADO LIVRE!</b>\n\n`;
        message += `💬 <b>Pergunta:</b> ${text}\n\n`;
        message += `👤 <b>De:</b> ${from?.nickname || "Cliente"}\n`;
        message += `📦 <b>Produto ID:</b> ${item_id}\n`;
        message += `📅 <b>Data:</b> ${formatDate(date_created)}\n\n`;
        message += `🔗 <a href="https://www.mercadolivre.com.br/vendas/questions/${id}">Responder Pergunta</a>`;

        return message;
    }

    /**
     * Formata mensagem para atualização de item/produto
     */
    private static formatItemUpdateMessage(itemData: any): string {
        const id = itemData?.id || itemData?.item_id || "N/A";
        const title = itemData?.title || itemData?.name || "Produto";
        const status = itemData?.status || itemData?.listing_type_id || "atualizado";

        let message = `📦 <b>ATUALIZAÇÃO DE PRODUTO</b>\n\n`;
        message += `🆔 <b>ID:</b> ${id}\n`;
        message += `📝 <b>Título:</b> ${title}\n`;
        message += `📊 <b>Status:</b> ${status}\n`;

        if (typeof itemData?.price === "number") {
            const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(itemData.price);
            message += `💰 <b>Preço:</b> ${price}\n`;
        }

        message += `\n🔗 <a href="https://www.mercadolivre.com.br/itm/${id}">Ver Produto</a>`;
        return message;
    }

    /**
     * Formata mensagem para nova mensagem recebida
     */
    private static formatNewMessage(messageData: any): string {
        const text = messageData?.text || messageData?.message || "Mensagem recebida";
        const from = messageData?.from?.nickname || messageData?.from?.id || "Cliente";
        const dateStr = messageData?.date_created || messageData?.date || new Date().toISOString();
        const dateFmt = new Date(dateStr).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

        let message = `💬 <b>NOVA MENSAGEM</b>\n\n`;
        message += `👤 <b>De:</b> ${from}\n`;
        message += `🕒 <b>Data:</b> ${dateFmt}\n\n`;
        message += `${text}`;
        return message;
    }

    /**
     * Envia notificação de atualização de item
     */
    public static async notifyItemUpdated(workspaceId: string, itemData: any): Promise<boolean> {
        try {
            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const message = this.formatItemUpdateMessage(itemData);
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "item_updated",
                itemData?.id || null,
                result.ok ? "sent" : "failed",
                itemData,
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao notificar item:", error);
            await this.logNotification(
                workspaceId,
                "item_updated",
                itemData?.id || null,
                "failed",
                itemData,
                null,
                error?.message || String(error)
            );
            return false;
        }
    }

    /**
     * Envia notificação de nova mensagem
     */
    public static async notifyNewMessage(workspaceId: string, messageData: any): Promise<boolean> {
        try {
            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const message = this.formatNewMessage(messageData);
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "message_received",
                messageData?.id || null,
                result.ok ? "sent" : "failed",
                messageData,
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao notificar mensagem:", error);
            await this.logNotification(
                workspaceId,
                "message_received",
                messageData?.id || null,
                "failed",
                messageData,
                null,
                error?.message || String(error)
            );
            return false;
        }
    }

    /**
     * Envia notificação de nova venda
     */
    public static async notifyNewOrder(workspaceId: string, orderData: any): Promise<boolean> {
        try {
            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const message = this.formatOrderMessage(orderData);
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "order_created",
                orderData.id,
                result.ok ? "sent" : "failed",
                orderData,
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            if (result.ok) {
                console.log(`[Telegram] ✅ Notificação de venda enviada: ${orderData.id}`);
            } else {
                console.error(`[Telegram] ❌ Falha ao enviar notificação de venda: ${orderData.id}`);
            }

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao notificar venda:", error);
            await this.logNotification(
                workspaceId,
                "order_created",
                orderData.id,
                "failed",
                orderData,
                null,
                error.message
            );
            return false;
        }
    }

    /**
     * Envia notificação de nova pergunta
     */
    public static async notifyNewQuestion(workspaceId: string, questionData: any): Promise<boolean> {
        try {
            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const message = this.formatQuestionMessage(questionData);
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "question_received",
                questionData.id,
                result.ok ? "sent" : "failed",
                questionData,
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            if (result.ok) {
                console.log(`[Telegram] ✅ Notificação de pergunta enviada: ${questionData.id}`);
            }

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao notificar pergunta:", error);
            await this.logNotification(
                workspaceId,
                "question_received",
                questionData.id,
                "failed",
                questionData,
                null,
                error.message
            );
            return false;
        }
    }

    /**
     * Testa a configuração do Telegram enviando mensagem de teste
     */
    public static async testConfiguration(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const testMessage = `✅ <b>Teste de Notificação</b>\n\nSeu bot do Telegram está configurado corretamente!\n\nVocê receberá notificações em tempo real sobre:\n• 🎉 Novas vendas\n• ❓ Novas perguntas\n• 📦 Atualizações de produtos`;

            const result = await this.sendTelegramMessage(botToken, chatId, testMessage, "HTML");
            if (result.ok) {
                return { success: true };
            }
            return { success: false, error: result.error || "Falha ao enviar mensagem de teste" };
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || "Erro desconhecido",
            };
        }
    }
}

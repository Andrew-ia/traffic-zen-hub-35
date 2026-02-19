import fetch from "node-fetch";
import { getPool } from "../config/database.js";

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const REALTIME_ONLY =
    String(process.env.ML_NOTIFICATIONS_REALTIME_ONLY || "true").toLowerCase() === "true";
const REALTIME_WINDOW_MINUTES = Math.max(
    1,
    Number(process.env.ML_NOTIFICATIONS_REALTIME_WINDOW_MINUTES || 5)
);
const REALTIME_WINDOW_MS = REALTIME_WINDOW_MINUTES * 60 * 1000;
const QUESTION_WINDOW_MINUTES = Math.max(
    1,
    Number(process.env.ML_NOTIFICATIONS_QUESTION_WINDOW_MINUTES || REALTIME_WINDOW_MINUTES)
);
const QUESTION_WINDOW_MS = QUESTION_WINDOW_MINUTES * 60 * 1000;
const MESSAGE_WINDOW_MINUTES = Math.max(
    1,
    Number(process.env.ML_NOTIFICATIONS_MESSAGE_WINDOW_MINUTES || REALTIME_WINDOW_MINUTES)
);
const MESSAGE_WINDOW_MS = MESSAGE_WINDOW_MINUTES * 60 * 1000;
const ORDERS_ONLY =
    String(process.env.ML_NOTIFICATIONS_ORDERS_ONLY || "false").toLowerCase() === "true";

const shouldAllowNotificationType = (type: string) => !ORDERS_ONLY || type === "order_created";

const WORKSPACE_LABEL_TTL_MS = 10 * 60 * 1000;
const workspaceLabelCache = new Map<string, { label: string; ts: number }>();

const getBrazilDateKey = (date: Date) => BRAZIL_DATE_FORMATTER.format(date);

const getTodayBrazilDateKey = () => getBrazilDateKey(new Date());

const parseDateValue = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const escapeTelegramHtml = (value: string) => {
    const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    };
    return value.replace(/[&<>]/g, (char) => map[char] || char);
};

const getWorkspaceLabel = async (workspaceId: string): Promise<string | null> => {
    const cached = workspaceLabelCache.get(workspaceId);
    const now = Date.now();
    if (cached && now - cached.ts < WORKSPACE_LABEL_TTL_MS) {
        return cached.label;
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT name, slug
             FROM workspaces
             WHERE id = $1
             LIMIT 1`,
            [workspaceId]
        );

        if (!result.rows.length) return null;
        const row = result.rows[0];
        const label = String(row.name || row.slug || workspaceId || "").trim();
        if (!label) return null;

        workspaceLabelCache.set(workspaceId, { label, ts: now });
        return label;
    } catch (error) {
        console.warn("[Telegram] Falha ao buscar workspace:", error);
        return null;
    }
};

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
    // Lock em memória para prevenir processamento concorrente do mesmo pedido
    private static processingOrders = new Set<string>();
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

    private static async prependWorkspaceLabel(workspaceId: string, message: string): Promise<string> {
        const label = await getWorkspaceLabel(workspaceId);
        if (!label) return message;
        const safeLabel = escapeTelegramHtml(label);
        return `🏷️ <b>Cliente:</b> ${safeLabel}\n\n${message}`;
    }

    /**
     * Envia mensagem personalizada (uso interno)
     */
    static async sendCustomMessage(
        workspaceId: string,
        message: string,
        type: string = "custom",
        referenceId?: string | null
    ): Promise<boolean> {
        if (!shouldAllowNotificationType(type)) {
            console.log(`[Telegram] Ignorando notificação ${type} (modo vendas apenas)`);
            return false;
        }

        const config = await this.getTelegramConfig(workspaceId);
        if (!config) {
            console.warn("[Telegram] Configuracao nao encontrada para envio custom");
            return false;
        }

        const recent = await this.hasRecentNotification(workspaceId, type, referenceId || null, 60);
        if (recent) return true;

        const messageWithLabel = await this.prependWorkspaceLabel(workspaceId, message);
        const result = await this.sendTelegramMessage(config.botToken, config.chatId, messageWithLabel, "HTML");
        await this.logNotification(
            workspaceId,
            type,
            referenceId || null,
            result.ok ? "sent" : "failed",
            { message },
            result.response,
            result.error || null
        );
        return result.ok;
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
            const json: any = await response.json().catch(() => ({} as any));
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
                    payload ?? null,
                    response ?? null,
                    errorMessage,
                ]
            );
        } catch (error) {
            console.error("[Telegram] Erro ao salvar log:", error);
        }
    }

    /**
     * Verifica se já enviamos uma notificação igual recentemente para evitar duplicados
     */
    private static async hasRecentNotification(
        workspaceId: string,
        type: string,
        referenceId: string | null | undefined,
        windowMinutes = 5
    ): Promise<boolean> {
        if (!referenceId) return false;

        try {
            const pool = getPool();
            const result = await pool.query(
                `SELECT 1
                 FROM notification_logs
                 WHERE workspace_id = $1
                   AND platform = 'telegram'
                   AND notification_type = $2
                   AND reference_id = $3
                   AND status = 'sent'
                   AND created_at >= NOW() - ($4 * INTERVAL '1 minute')
                 LIMIT 1`,
                [workspaceId, type, String(referenceId), windowMinutes]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.warn(`[Telegram] Falha ao verificar duplicidade (${type}):`, error);
            return false;
        }
    }

    /**
     * Verifica se já existe notificação registrada para o mesmo recurso (sem janela de tempo)
     */
    private static async hasNotification(
        workspaceId: string,
        type: string,
        referenceId: string | null | undefined
    ): Promise<boolean> {
        if (!referenceId) return false;

        try {
            const pool = getPool();
            const result = await pool.query(
                `SELECT 1
                 FROM notification_logs
                 WHERE workspace_id = $1
                   AND platform = 'telegram'
                   AND notification_type = $2
                   AND reference_id = $3
                   AND status = 'sent'
                 LIMIT 1`,
                [workspaceId, type, String(referenceId)]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.warn(`[Telegram] Falha ao verificar histórico (${type}):`, error);
            return false;
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
            shipping,
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
                timeZone: "America/Sao_Paulo", // Forçar timezone do Brasil
            });
        };

        const statusLabels: Record<string, string> = {
            paid: "Pago",
            confirmed: "Confirmado",
            payment_required: "Pagamento pendente",
            payment_in_process: "Pagamento em processamento",
            partially_paid: "Pagamento parcial",
            cancelled: "Cancelado",
            invalid: "Inválido",
            not_yet_shipped: "Aguardando envio",
        };
        const normalizedStatus = String(status || "").toLowerCase();
        const statusLabel = statusLabels[normalizedStatus] || status || "N/A";
        const safeStatusLabel = escapeTelegramHtml(String(statusLabel));

        const hasFulfillmentTag = (tags?: any) => Array.isArray(tags) && tags.some((tag: any) => String(tag || "").toLowerCase() === "fulfillment");
        const isFullShipment = (() => {
            const shippingLogistic = String(shipping?.logistic_type || shipping?.mode || "").toLowerCase();
            if (shippingLogistic === "fulfillment") return true;

            const shippingOptionLogistic = String(shipping?.shipping_option?.logistic_type || "").toLowerCase();
            if (shippingOptionLogistic === "fulfillment") return true;

            if (hasFulfillmentTag(shipping?.tags)) return true;

            const shippingOptionName = String(shipping?.shipping_option?.name || shipping?.shipping_type || "").toLowerCase();
            if (shippingOptionName.includes("full")) return true;

            if (Array.isArray(order_items)) {
                const itemHasFull = order_items.some((item: any) => {
                    const itemShippingLogistic = String(item?.shipping?.logistic_type || item?.item?.shipping?.logistic_type || item?.item?.logistic_type || "").toLowerCase();
                    if (itemShippingLogistic === "fulfillment") return true;

                    if (hasFulfillmentTag(item?.shipping?.tags) || hasFulfillmentTag(item?.item?.tags)) return true;

                    const itemShippingOptionLogistic = String(item?.shipping_option?.logistic_type || "").toLowerCase();
                    if (itemShippingOptionLogistic === "fulfillment") return true;

                    const itemShippingOptionName = String(item?.shipping_option?.name || "").toLowerCase();
                    return itemShippingOptionName.includes("full");
                });
                if (itemHasFull) return true;
            }

            return false;
        })();

        const shippingType = isFullShipment ? "🚀 Full" : "📮 Padrão";

        let message = `🎉 <b>NOVA VENDA NO MERCADO LIVRE!</b>\n\n`;
        message += `📦 <b>Pedido:</b> #${id}\n`;
        message += `💰 <b>Valor:</b> ${formatCurrency(paid_amount || total_amount)}\n`;
        message += `📊 <b>Status:</b> ${safeStatusLabel}\n`;
        message += `🚚 <b>Envio:</b> ${shippingType}\n`;
        message += `📅 <b>Data:</b> ${formatDate(date_created)}\n\n`;

        if (buyer) {
            const safeBuyerId = escapeTelegramHtml(String(buyer.id || "N/A"));
            message += `👤 <b>Comprador:</b>\n`;
            message += `   • ID: ${safeBuyerId}\n`;
            if (buyer.nickname) {
                const safeBuyerName = escapeTelegramHtml(String(buyer.nickname));
                message += `   • Nome: ${safeBuyerName}\n`;
            }
        }

        if (order_items && order_items.length > 0) {
            message += `\n📋 <b>Itens:</b>\n`;
            order_items.forEach((item: any, idx: number) => {
                const itemTitle = escapeTelegramHtml(String(item.item?.title || "Produto"));
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

        const safeText = escapeTelegramHtml(String(text || ""));
        const safeFrom = escapeTelegramHtml(String(from?.nickname || "Cliente"));
        const safeItemId = escapeTelegramHtml(String(item_id || "N/A"));

        let message = `❓ <b>NOVA PERGUNTA NO MERCADO LIVRE!</b>\n\n`;
        message += `💬 <b>Pergunta:</b> ${safeText}\n\n`;
        message += `👤 <b>De:</b> ${safeFrom}\n`;
        message += `📦 <b>Produto ID:</b> ${safeItemId}\n`;
        message += `📅 <b>Data:</b> ${formatDate(date_created)}\n\n`;
        message += `🔗 <a href="https://questions.mercadolivre.com.br/question/${id}">Responder Pergunta</a>`;

        return message;
    }

    /**
     * Formata mensagem para atualização de item/produto
     */
    private static formatItemUpdateMessage(itemData: any): string {
        const id = itemData?.id || itemData?.item_id || "N/A";
        const title = itemData?.title || itemData?.name || "Produto";
        const status = itemData?.status || itemData?.listing_type_id || "atualizado";
        const safeId = escapeTelegramHtml(String(id));
        const safeTitle = escapeTelegramHtml(String(title));
        const safeStatus = escapeTelegramHtml(String(status));

        let message = `📦 <b>ATUALIZAÇÃO DE PRODUTO</b>\n\n`;
        message += `🆔 <b>ID:</b> ${safeId}\n`;
        message += `📝 <b>Título:</b> ${safeTitle}\n`;
        message += `📊 <b>Status:</b> ${safeStatus}\n`;

        if (typeof itemData?.price === "number") {
            const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(itemData.price);
            message += `💰 <b>Preço:</b> ${price}\n`;
        }

        message += `\n🔗 <a href="https://www.mercadolivre.com.br/itm/${id}">Ver Produto</a>`;
        return message;
    }

    /**
     * Formata mensagem para sugestao de preco
     */
    private static formatPriceSuggestionMessage(suggestion: any): string {
        const itemId = suggestion?.itemId || suggestion?.item_id || "N/A";
        const title = suggestion?.title || suggestion?.item_title || "Produto";
        const currencyId = suggestion?.currencyId || suggestion?.currency_id || "BRL";
        const currentPrice = typeof suggestion?.currentPrice === "number" ? suggestion.currentPrice : null;
        const suggestedPrice = typeof suggestion?.suggestedPrice === "number" ? suggestion.suggestedPrice : null;

        const formatCurrency = (value: number | null) => {
            if (typeof value !== "number") return "N/D";
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: currencyId,
            }).format(value);
        };

        const safeItemId = escapeTelegramHtml(String(itemId));
        const safeTitle = escapeTelegramHtml(String(title));

        let message = `💡 <b>SUGESTÃO DE PREÇO ML</b>\n\n`;
        message += `🆔 <b>ID:</b> ${safeItemId}\n`;
        message += `📝 <b>Título:</b> ${safeTitle}\n`;
        message += `💰 <b>Preço atual:</b> ${formatCurrency(currentPrice)}\n`;
        message += `🎯 <b>Preço sugerido:</b> ${formatCurrency(suggestedPrice)}\n`;

        if (typeof currentPrice === "number" && typeof suggestedPrice === "number" && currentPrice > 0) {
            const diff = suggestedPrice - currentPrice;
            const diffPct = (diff / currentPrice) * 100;
            message += `📈 <b>Diferença:</b> ${formatCurrency(diff)} (${diffPct.toFixed(1)}%)\n`;
        }

        if (itemId && String(itemId).startsWith("MLB")) {
            message += `\n🔗 <a href="https://www.mercadolivre.com.br/itm/${safeItemId}">Ver Produto</a>`;
        }

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
        const safeText = escapeTelegramHtml(String(text || ""));
        const safeFrom = escapeTelegramHtml(String(from || "Cliente"));

        let message = `💬 <b>NOVA MENSAGEM</b>\n\n`;
        message += `👤 <b>De:</b> ${safeFrom}\n`;
        message += `🕒 <b>Data:</b> ${dateFmt}\n\n`;
        message += `${safeText}`;
        return message;
    }

    /**
     * Envia notificação de atualização de item
     */
    public static async notifyItemUpdated(workspaceId: string, itemData: any): Promise<boolean> {
        try {
            if (!shouldAllowNotificationType("item_updated")) {
                console.log("[Telegram] Ignorando notificação de item (modo vendas apenas)");
                return false;
            }

            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const referenceId = itemData?.id || itemData?.item_id || null;
            const dedupWindowMinutes = 5;
            const isDuplicate = await this.hasRecentNotification(
                workspaceId,
                "item_updated",
                referenceId,
                dedupWindowMinutes
            );

            if (isDuplicate) {
                console.log(`[Telegram] Ignorando notificação duplicada de item ${referenceId} (últimos ${dedupWindowMinutes} min)`);
                return false;
            }

            const message = await this.prependWorkspaceLabel(workspaceId, this.formatItemUpdateMessage(itemData));
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "item_updated",
                referenceId,
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
     * Envia notificacao de sugestao de preco
     */
    public static async notifyPriceSuggestion(workspaceId: string, suggestion: any): Promise<boolean> {
        try {
            if (!shouldAllowNotificationType("price_suggestion")) {
                console.log("[Telegram] Ignorando sugestão de preço (modo vendas apenas)");
                return false;
            }

            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificacoes nao configuradas para workspace ${workspaceId}`);
                return false;
            }

            const itemId = suggestion?.itemId || suggestion?.item_id || null;
            const suggestedPrice = typeof suggestion?.suggestedPrice === "number" ? suggestion.suggestedPrice : "na";
            const referenceId = itemId ? `${itemId}:${suggestedPrice}` : null;

            const isDuplicate = await this.hasRecentNotification(
                workspaceId,
                "price_suggestion",
                referenceId,
                60
            );

            if (isDuplicate) {
                console.log(`[Telegram] Ignorando sugestao de preco duplicada ${referenceId}`);
                return false;
            }

            const message = await this.prependWorkspaceLabel(
                workspaceId,
                this.formatPriceSuggestionMessage(suggestion)
            );
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "price_suggestion",
                referenceId,
                result.ok ? "sent" : "failed",
                suggestion,
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao notificar sugestao de preco:", error);
            await this.logNotification(
                workspaceId,
                "price_suggestion",
                suggestion?.itemId || suggestion?.item_id || null,
                "failed",
                suggestion,
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
            if (!shouldAllowNotificationType("message_received")) {
                console.log("[Telegram] Ignorando mensagem (modo vendas apenas)");
                return false;
            }

            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const messageDate = parseDateValue(messageData?.date_created || messageData?.date);
            if (!messageDate) {
                console.log(`[Telegram] Ignorando mensagem sem data valida ${messageData?.id || "sem-id"}`);
                return false;
            }
            if (REALTIME_ONLY) {
                const diffMs = Date.now() - messageDate.getTime();
                if (diffMs > MESSAGE_WINDOW_MS) {
                    const diffMin = Math.round(diffMs / 60000);
                    console.log(`[Telegram] Ignorando mensagem fora da janela real-time ${messageData?.id || "sem-id"} (${diffMin} min)`);
                    return false;
                }
                if (diffMs < -MESSAGE_WINDOW_MS) {
                    const diffMin = Math.round(Math.abs(diffMs) / 60000);
                    console.log(`[Telegram] Ignorando mensagem com data futura ${messageData?.id || "sem-id"} (${diffMin} min)`);
                    return false;
                }
            } else {
                const messageDateKey = getBrazilDateKey(messageDate);
                const todayKey = getTodayBrazilDateKey();
                if (messageDateKey !== todayKey) {
                    console.log(`[Telegram] Ignorando mensagem fora do dia (BRT) ${messageData?.id || "sem-id"} (${messageDateKey})`);
                    return false;
                }
            }

            const message = await this.prependWorkspaceLabel(workspaceId, this.formatNewMessage(messageData));
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
        const referenceId = orderData?.id || null;
        if (!referenceId) {
            console.warn("[Telegram] Pedido sem ID, ignorando notificação");
            return false;
        }

        const eventDate = parseDateValue(orderData?.date_created);
        if (!eventDate) {
            console.log(`[Telegram] Ignorando venda sem data valida ${referenceId}`);
            return false;
        }

        if (REALTIME_ONLY) {
            const diffMs = Date.now() - eventDate.getTime();
            if (diffMs > REALTIME_WINDOW_MS) {
                const diffMin = Math.round(diffMs / 60000);
                console.log(
                    `[Telegram] Ignorando venda fora da janela real-time ${referenceId} (${diffMin} min)`
                );
                return false;
            }
            if (diffMs < -REALTIME_WINDOW_MS) {
                const diffMin = Math.round(Math.abs(diffMs) / 60000);
                console.log(
                    `[Telegram] Ignorando venda com data futura ${referenceId} (${diffMin} min)`
                );
                return false;
            }
        } else {
            const orderDateKey = getBrazilDateKey(eventDate);
            const todayKey = getTodayBrazilDateKey();
            if (orderDateKey !== todayKey) {
                console.log(`[Telegram] Ignorando venda fora do dia (BRT) ${referenceId} (${orderDateKey})`);
                return false;
            }
        }

        // Se já temos notificação registrada para este pedido, evitar duplicar (mesmo que seja outro dia)
        const alreadyNotified = await this.hasNotification(workspaceId, "order_created", referenceId);
        if (alreadyNotified) {
            console.log(`[Telegram] Ignorando venda já notificada (histórico) ${referenceId}`);
            return false;
        }

        // Lock para prevenir processamento concorrente do mesmo pedido
        const lockKey = `${workspaceId}:${referenceId}`;
        if (this.processingOrders.has(lockKey)) {
            console.log(`[Telegram] 🔒 Pedido ${referenceId} já está sendo processado, ignorando duplicata`);
            return false;
        }

        // Adicionar ao lock
        this.processingOrders.add(lockKey);

        try {
            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            // Verificar se já foi enviado (com janela de tempo de 30 minutos)
            const isDuplicate = await this.hasRecentNotification(
                workspaceId,
                "order_created",
                referenceId,
                30
            );

            if (isDuplicate) {
                console.log(`[Telegram] Ignorando venda já notificada ${referenceId} (últimos 30 min)`);
                return false;
            }

            const message = await this.prependWorkspaceLabel(workspaceId, this.formatOrderMessage(orderData));
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "order_created",
                referenceId,
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
                referenceId,
                "failed",
                orderData,
                null,
                error.message
            );
            return false;
        } finally {
            // Remover do lock após 5 segundos para prevenir memory leak
            setTimeout(() => {
                this.processingOrders.delete(lockKey);
            }, 5000);
        }
    }

    /**
     * Envia notificação de nova pergunta
     */
    public static async notifyNewQuestion(workspaceId: string, questionData: any): Promise<boolean> {
        try {
            if (!shouldAllowNotificationType("question_received")) {
                console.log("[Telegram] Ignorando pergunta (modo vendas apenas)");
                return false;
            }

            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const questionDate = parseDateValue(questionData?.date_created);
            if (!questionDate) {
                console.log(`[Telegram] Ignorando pergunta sem data valida ${questionData?.id || "sem-id"}`);
                return false;
            }
            if (REALTIME_ONLY) {
                const diffMs = Date.now() - questionDate.getTime();
                if (diffMs > QUESTION_WINDOW_MS) {
                    const diffMin = Math.round(diffMs / 60000);
                    console.log(`[Telegram] Ignorando pergunta fora da janela real-time ${questionData?.id || "sem-id"} (${diffMin} min)`);
                    return false;
                }
                if (diffMs < -QUESTION_WINDOW_MS) {
                    const diffMin = Math.round(Math.abs(diffMs) / 60000);
                    console.log(`[Telegram] Ignorando pergunta com data futura ${questionData?.id || "sem-id"} (${diffMin} min)`);
                    return false;
                }
            } else {
                const questionDateKey = getBrazilDateKey(questionDate);
                const todayKey = getTodayBrazilDateKey();
                if (questionDateKey !== todayKey) {
                    console.log(`[Telegram] Ignorando pergunta fora do dia (BRT) ${questionData?.id || "sem-id"} (${questionDateKey})`);
                    return false;
                }
            }

            const referenceId = String(questionData.id || "");

            // Evitar duplicatas em janela curta e histórico
            const isRecentDuplicate = await this.hasRecentNotification(
                workspaceId,
                "question_received",
                referenceId,
                10 // minutos
            );

            if (isRecentDuplicate) {
                console.log(`[Telegram] Ignorando pergunta duplicada (últimos 10 min): ${referenceId}`);
                return false;
            }

            const alreadyNotified = await this.hasNotification(
                workspaceId,
                "question_received",
                referenceId
            );

            if (alreadyNotified) {
                console.log(`[Telegram] Ignorando pergunta já notificada anteriormente: ${referenceId}`);
                return false;
            }

            const message = await this.prependWorkspaceLabel(workspaceId, this.formatQuestionMessage(questionData));
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                message,
                "HTML"
            );

            await this.logNotification(
                workspaceId,
                "question_received",
                referenceId,
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
                error?.message || String(error)
            );
            return false;
        }
    }

    /**
     * Envia alerta do Full Analytics
     */
    public static async notifyFullAnalyticsAlert(workspaceId: string, messageHtml: string): Promise<boolean> {
        try {
            if (!shouldAllowNotificationType("full_analytics_alert")) {
                console.log("[Telegram] Ignorando alerta de analytics (modo vendas apenas)");
                return false;
            }

            const config = await this.getTelegramConfig(workspaceId);
            if (!config) {
                console.log(`[Telegram] Notificações não configuradas para workspace ${workspaceId}`);
                return false;
            }

            const messageWithLabel = await this.prependWorkspaceLabel(workspaceId, messageHtml);
            // Enviar mensagem
            const result = await this.sendTelegramMessage(
                config.botToken,
                config.chatId,
                messageWithLabel,
                "HTML"
            );

            // Logar
            await this.logNotification(
                workspaceId,
                "full_analytics_alert",
                `alert_${Date.now()}`,
                result.ok ? "sent" : "failed",
                { message: messageHtml },
                result.response || null,
                result.ok ? null : (result.error || "Falha ao enviar mensagem")
            );

            return result.ok;
        } catch (error: any) {
            console.error("[Telegram] Erro ao enviar alerta Full Analytics:", error);
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

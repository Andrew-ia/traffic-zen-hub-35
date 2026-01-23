import { getPool } from "../config/database.js";
import { getMercadoLivreCredentials, requestWithAuth } from "../api/integrations/mercadolivre.js";
import { TelegramNotificationService } from "../services/telegramNotification.service.js";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const CHECK_INTERVAL_MS = 60 * 1000;
const ORDER_PAGE_LIMIT = 50;
const MAX_ORDERS = 5000;

const SUMMARY_ENABLED = String(process.env.ML_DAILY_SUMMARY_ENABLED || "true").toLowerCase() !== "false";
const SUMMARY_HOUR = Number(process.env.ML_DAILY_SUMMARY_HOUR || 11);
const SUMMARY_MINUTE = Number(process.env.ML_DAILY_SUMMARY_MINUTE || 59);

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const normalizeStatus = (value: any) => String(value || "").toLowerCase();
const isSaleStatus = (value: any) => ["paid", "confirmed"].includes(normalizeStatus(value));
const isCancelledStatus = (value: any) => ["cancelled", "canceled"].includes(normalizeStatus(value));

const escapeHtml = (value: string) => {
    const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    };
    return value.replace(/[&<>]/g, (char) => map[char] || char);
};

const getBrazilParts = (date: Date) => {
    const parts = dateTimeFormatter.formatToParts(date);
    const map = new Map(parts.map((part) => [part.type, part.value]));
    return {
        year: map.get("year") || "1970",
        month: map.get("month") || "01",
        day: map.get("day") || "01",
        hour: Number(map.get("hour") || 0),
        minute: Number(map.get("minute") || 0),
    };
};

const getBrazilDateKey = (date: Date) => {
    const parts = getBrazilParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatBrazilDateLabel = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-");
    if (!year || !month || !day) return dateKey;
    return `${day}/${month}/${year}`;
};

const toBrazilDayBoundary = (dateKey: string, endOfDay: boolean) => {
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
    return new Date(`${dateKey}T${time}-03:00`);
};

export function startMercadoLivreDailySummaryScheduler() {
    if (!SUMMARY_ENABLED) {
        console.log("[ML Daily Summary] Scheduler disabled");
        return;
    }

    console.log("[ML Daily Summary] Scheduler started");
    checkAndSend();
    setInterval(checkAndSend, CHECK_INTERVAL_MS);
}

async function checkAndSend() {
    const now = new Date();
    const { hour, minute } = getBrazilParts(now);
    if (hour !== SUMMARY_HOUR || minute !== SUMMARY_MINUTE) return;

    const dateKey = getBrazilDateKey(now);
    const dateLabel = formatBrazilDateLabel(dateKey);
    const dateFrom = toBrazilDayBoundary(dateKey, false);
    const dateTo = toBrazilDayBoundary(dateKey, true);

    const pool = getPool();

    let workspaces: Array<{ workspace_id: string }> = [];
    try {
        const res = await pool.query(
            `select distinct workspace_id
             from integration_credentials
             where platform_key = $1`,
            ["mercadolivre"]
        );
        workspaces = res.rows || [];
    } catch (err) {
        console.error("[ML Daily Summary] Failed to load workspaces:", err);
        return;
    }

    if (!workspaces.length) return;

    for (const row of workspaces) {
        const workspaceId = String(row.workspace_id);
        try {
            const alreadySent = await hasSummaryAlreadySent(workspaceId, dateKey);
            if (alreadySent) continue;

            const summary = await buildDailySummary(workspaceId, dateFrom, dateTo);
            const message = buildSummaryMessage(dateLabel, summary);
            const sent = await TelegramNotificationService.sendCustomMessage(
                workspaceId,
                message,
                "ml_daily_summary",
                dateKey
            );

            if (sent) {
                console.log(`[ML Daily Summary] Sent for workspace ${workspaceId}`);
            } else {
                console.warn(`[ML Daily Summary] Not sent for workspace ${workspaceId}`);
            }
        } catch (err) {
            console.error(`[ML Daily Summary] Failed for workspace ${workspaceId}:`, err);
        }
    }
}

async function hasSummaryAlreadySent(workspaceId: string, dateKey: string): Promise<boolean> {
    try {
        const pool = getPool();
        const result = await pool.query(
            `select 1
             from notification_logs
             where workspace_id = $1
               and platform = 'telegram'
               and notification_type = $2
               and reference_id = $3
               and status = 'sent'
             limit 1`,
            [workspaceId, "ml_daily_summary", dateKey]
        );
        return result.rows.length > 0;
    } catch (err) {
        console.warn("[ML Daily Summary] Failed to check history:", err);
        return false;
    }
}

async function buildDailySummary(workspaceId: string, dateFrom: Date, dateTo: Date) {
    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials?.userId) {
        throw new Error("ml_not_connected");
    }

    const orders = await fetchOrdersByDate(workspaceId, String(credentials.userId), dateFrom, dateTo);
    const salesOrders = orders.filter((order) => isSaleStatus(order?.status));

    const salesCount = salesOrders.length;
    const revenue = salesOrders.reduce((sum, order) => {
        const total = Number(order?.total_amount ?? order?.paid_amount ?? 0);
        return sum + (Number.isFinite(total) ? total : 0);
    }, 0);

    const buyers = new Set(
        salesOrders
            .map((order) => order?.buyer?.id)
            .filter((buyerId) => buyerId !== undefined && buyerId !== null)
            .map((buyerId) => String(buyerId))
    );

    const cancellations = await fetchCancelledOrders(workspaceId, String(credentials.userId), dateFrom, dateTo);
    const topProduct = getTopProduct(salesOrders);

    return {
        salesCount,
        revenue,
        buyersCount: buyers.size,
        cancellationsCount: cancellations.length,
        topProduct,
    };
}

async function fetchOrdersByDate(workspaceId: string, userId: string, dateFrom: Date, dateTo: Date) {
    const orders = new Map<string, any>();
    const dateFromIso = dateFrom.toISOString();
    const dateToIso = dateTo.toISOString();
    let offset = 0;
    let hasMore = true;

    while (hasMore && orders.size < MAX_ORDERS) {
        const params: any = {
            seller: userId,
            limit: ORDER_PAGE_LIMIT,
            offset,
            sort: "date_desc",
            "order.date_created.from": dateFromIso,
            "order.date_created.to": dateToIso,
        };

        let response: any;
        try {
            response = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/orders/search`, { params });
        } catch (err) {
            if (params.sort) {
                delete params.sort;
                response = await requestWithAuth<any>(
                    workspaceId,
                    `${MERCADO_LIVRE_API_BASE}/orders/search`,
                    { params }
                );
            } else {
                throw err;
            }
        }

        const results = response?.results || [];
        results.forEach((order: any) => {
            const id = String(order?.id || "").trim();
            if (!id) return;
            if (!orders.has(id)) {
                orders.set(id, order);
            }
        });

        hasMore = results.length === ORDER_PAGE_LIMIT;
        offset += ORDER_PAGE_LIMIT;
    }

    return Array.from(orders.values());
}

async function fetchCancelledOrders(workspaceId: string, userId: string, dateFrom: Date, dateTo: Date) {
    const canceled = new Map<string, any>();
    const dateFromIso = dateFrom.toISOString();
    const dateToIso = dateTo.toISOString();
    const statuses = ["cancelled"];

    for (const status of statuses) {
        let offset = 0;
        let hasMore = true;

        while (hasMore && canceled.size < MAX_ORDERS) {
            const params: any = {
                seller: userId,
                limit: ORDER_PAGE_LIMIT,
                offset,
                sort: "date_desc",
                "order.status": status,
                "order.date_closed.from": dateFromIso,
                "order.date_closed.to": dateToIso,
            };

            let response: any;
            try {
                response = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/orders/search`, { params });
            } catch (err) {
                if (params.sort) {
                    delete params.sort;
                    try {
                        response = await requestWithAuth<any>(
                            workspaceId,
                            `${MERCADO_LIVRE_API_BASE}/orders/search`,
                            { params }
                        );
                    } catch (retryErr) {
                        console.warn(`[ML Daily Summary] Falha ao buscar cancelados (${status}):`, retryErr);
                        break;
                    }
                } else {
                    console.warn(`[ML Daily Summary] Falha ao buscar cancelados (${status}):`, err);
                    break;
                }
            }

            const results = response?.results || [];
            results.forEach((order: any) => {
                const id = String(order?.id || "").trim();
                if (!id) return;
                if (!canceled.has(id)) {
                    canceled.set(id, order);
                }
            });

            hasMore = results.length === ORDER_PAGE_LIMIT;
            offset += ORDER_PAGE_LIMIT;
        }
    }

    return Array.from(canceled.values());
}

function getTopProduct(orders: any[]) {
    const items = new Map<string, { title: string; quantity: number; revenue: number }>();

    for (const order of orders) {
        const orderItems = Array.isArray(order?.order_items) ? order.order_items : [];
        for (const item of orderItems) {
            const itemId = String(item?.item?.id || item?.item_id || "").trim();
            if (!itemId) continue;
            const quantity = Number(item?.quantity || 0);
            const unitPrice = Number(item?.unit_price ?? item?.full_unit_price ?? 0);
            const revenue = quantity * unitPrice;
            const title = String(item?.item?.title || item?.title || itemId).trim();

            const current = items.get(itemId) || { title, quantity: 0, revenue: 0 };
            current.quantity += quantity;
            current.revenue += revenue;
            if (!current.title || current.title === itemId) {
                current.title = title;
            }
            items.set(itemId, current);
        }
    }

    let top: { title: string; quantity: number; revenue: number } | null = null;
    for (const value of items.values()) {
        if (!top) {
            top = value;
            continue;
        }
        if (value.quantity > top.quantity) {
            top = value;
            continue;
        }
        if (value.quantity === top.quantity && value.revenue > top.revenue) {
            top = value;
        }
    }

    return top;
}

function buildSummaryMessage(
    dateLabel: string,
    summary: {
        salesCount: number;
        revenue: number;
        buyersCount: number;
        cancellationsCount: number;
        topProduct: { title: string; quantity: number; revenue: number } | null;
    }
) {
    const revenueFormatted = currencyFormatter.format(Number(summary.revenue || 0));
    let topProductLine = "Sem vendas";

    if (summary.topProduct && summary.topProduct.quantity > 0) {
        const title = escapeHtml(summary.topProduct.title || "Produto");
        topProductLine = `${title} (${summary.topProduct.quantity} un.)`;
    }

    return [
        `📊 <b>Resumo do Dia</b> (${dateLabel})`,
        "",
        `💰 <b>Faturamento:</b> ${revenueFormatted}`,
        `🛒 <b>Vendas:</b> ${summary.salesCount}`,
        `👥 <b>Compradores:</b> ${summary.buyersCount}`,
        `❌ <b>Cancelamentos:</b> ${summary.cancellationsCount}`,
        `🏆 <b>Mais vendido:</b> ${topProductLine}`,
    ].join("\n");
}

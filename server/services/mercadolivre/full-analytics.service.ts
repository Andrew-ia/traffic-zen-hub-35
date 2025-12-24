
import { getPool } from "../../config/database.js";
import { requestWithAuth, getMercadoLivreCredentials } from "../../api/integrations/mercadolivre.js";
import { TelegramNotificationService } from "../telegramNotification.service.js";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

// Helper to chunk array
function chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
}

// Helper to calculate classification
function calculateClassification(item: any, sales30d: number, profit: number): { class: string; recommendation: string; tags: string[] } {
    const isFull = item.shipping?.logistic_type === "fulfillment";
    const dateCreated = new Date(item.date_created);
    const daysSinceCreation = (Date.now() - dateCreated.getTime()) / (1000 * 60 * 60 * 24);

    if (!isFull) {
        return { class: "N/A", recommendation: "Produto não é Full", tags: [] };
    }

    // Class A
    if (sales30d >= 5 && profit > 0) {
        if ((item.available_quantity || 0) === 0) {
            return { 
                class: "A", 
                recommendation: "🚨 Sugerir Recompra Urgente\n✅ Alta conversão e lucro", 
                tags: ["A - Recompra"] 
            };
        }
        return { 
            class: "A", 
            recommendation: "✅ Ativar Ads\n✅ Aumentar orçamento\n✅ Prioridade máxima", 
            tags: ["A - Escalar"] 
        };
    }
    // Class B
    else if (sales30d >= 1 && sales30d <= 4 && profit > 0) {
        if ((item.available_quantity || 0) === 0) {
            return { 
                class: "B", 
                recommendation: "🚨 Sugerir Recompra\n⚠️ Potencial de crescimento", 
                tags: ["B - Recompra"] 
            };
        }
        return { 
            class: "B", 
            recommendation: "⚠️ Melhorar imagem\n⚠️ Ajustar título\n⚠️ Ads de teste (baixo orçamento)", 
            tags: ["B - Otimizar"] 
        };
    }
    // Class D
    else if (profit <= 0) {
        return { 
            class: "D", 
            recommendation: "❌ Não anunciar\n❌ Ajustar preço ou kit\n❌ Queima de estoque", 
            tags: ["D - Não escalar"] 
        };
    }
    // Class C
    else if (sales30d === 0 && daysSinceCreation <= 30) {
        return { 
            class: "C", 
            recommendation: "⏳ Não anunciar\n⏳ Aguardar tração orgânica\n⏳ Revisar após 7 dias", 
            tags: ["C - Aguardar"] 
        };
    }
    // Fallback for old items with 0 sales
    else if (sales30d === 0 && daysSinceCreation > 30) {
        return { 
            class: "D", 
            recommendation: "❌ Produto parado há muito tempo\n❌ Avaliar queima", 
            tags: ["D - Parado"] 
        };
    }

    return { class: "C", recommendation: "", tags: [] };
}

export async function syncFullAnalyticsForWorkspace(workspaceId: string) {
    console.log(`[Full Analytics] Starting sync for workspace ${workspaceId}`);
    
    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) {
        console.error(`[Full Analytics] No credentials for workspace ${workspaceId}`);
        return { success: false, error: "Not connected" };
    }

    const pool = getPool();

    // 1. Fetch all items (active and paused)
    const allItemIds: string[] = [];
    const statuses = ['active', 'paused'];

    for (const status of statuses) {
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            try {
                const searchRes = await requestWithAuth<any>(
                    workspaceId,
                    `${MERCADO_LIVRE_API_BASE}/users/${credentials.userId}/items/search`,
                    { params: { limit, offset, status } }
                );
                
                if (searchRes.results && searchRes.results.length > 0) {
                    allItemIds.push(...searchRes.results);
                    offset += limit;
                    if (offset >= (searchRes.paging?.total || 0)) hasMore = false;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                console.error(`[Full Analytics] Error fetching ${status} items for ${workspaceId}:`, e);
                hasMore = false;
            }
        }
    }

    // 2. Fetch Item Details (Multiget) to filter Full
    const fullItems: any[] = [];
    const chunks = chunk(allItemIds, 20);

    for (const batch of chunks) {
        try {
            const idsStr = batch.join(",");
            const itemsRes = await requestWithAuth<any[]>(
                workspaceId,
                `${MERCADO_LIVRE_API_BASE}/items`,
                { params: { ids: idsStr } }
            );
            
            for (const item of itemsRes) {
                if (item.code === 200 && item.body.shipping?.logistic_type === "fulfillment") {
                    fullItems.push(item.body);
                }
            }
        } catch (e) {
            console.error(`[Full Analytics] Error fetching item details for ${workspaceId}:`, e);
        }
    }

    // 3. Fetch Orders (Last 30 days) to calculate sales
    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateFromStr = dateFrom.toISOString();

    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
        try {
            const ordersRes = await requestWithAuth<any>(
                workspaceId,
                `${MERCADO_LIVRE_API_BASE}/orders/search`,
                {
                    params: {
                        seller: credentials.userId,
                        'order.date_created.from': dateFromStr,
                        limit,
                        offset,
                        sort: 'date_desc'
                    }
                }
            );

            const orders = ordersRes.results || [];
            if (orders.length === 0) {
                hasMore = false;
                break;
            }

            for (const order of orders) {
                if (order.status === 'cancelled') continue;
                for (const item of order.order_items) {
                    // Normalize Item ID (remove variation if present, though ML usually returns base item ID here)
                    const itemId = item.item.id;
                    const current = salesMap.get(itemId) || { quantity: 0, revenue: 0 };
                    current.quantity += item.quantity;
                    current.revenue += (item.unit_price * item.quantity);
                    salesMap.set(itemId, current);
                }
            }

            offset += limit;
            if (offset >= (ordersRes.paging?.total || 0)) hasMore = false;
            if (offset > 5000) hasMore = false; 
        } catch (e) {
            console.error(`[Full Analytics] Error fetching orders for ${workspaceId}:`, e);
            hasMore = false;
        }
    }

    // 4. Process each Full item
    let updatedCount = 0;
    const alerts: Array<{ item: any, oldClass: string, newClass: string }> = [];

    for (const item of fullItems) {
        // Try exact match
        let salesData = salesMap.get(item.id);
        
        // If not found, try to find by variation (sometimes orders reference the variation ID, but here we mapped by item ID)
        // Actually, we mapped by item.item.id in orders, which should be the main item ID.
        // Let's ensure we are using the base ID.
        
        if (!salesData) {
             salesData = { quantity: 0, revenue: 0 };
        }
        
        // Costs & Existing Data
        const price = Number(item.price);
        
        // Get existing product to preserve cost_price and check old classification
        const existingRes = await pool.query("SELECT id, cost_price, overhead_cost, fixed_fee, cac, classification FROM products WHERE ml_item_id = $1 AND workspace_id = $2", [item.id, workspaceId]);
        const existing = existingRes.rows[0] || {};
        const oldClass = existing.classification || 'N/A';
        
        const finalCostPrice = Number(existing.cost_price || 0);
        const overhead = Number(existing.overhead_cost || 0);
        const fixedFee = Number(existing.fixed_fee || (price < 79 ? 6.00 : 0));
        const cac = Number(existing.cac || 0);
        
        // ML Tax
        let taxRate = 0.11;
        if (item.listing_type_id === "gold_pro") taxRate = 0.16;
        else if (item.listing_type_id === "gold_special") taxRate = 0.11;
        
        const mlTax = price * taxRate;
        const profitUnit = price - mlTax - fixedFee - finalCostPrice - overhead - cac;

        // Classification
        const { class: classification, recommendation, tags } = calculateClassification(item, salesData.quantity, profitUnit);

        // Check for alerts
        if (oldClass !== 'N/A' && oldClass !== classification) {
            // C -> B
            if (oldClass === 'C' && classification === 'B') {
                alerts.push({ item, oldClass, newClass: classification });
            }
            // B -> A
            else if (oldClass === 'B' && classification === 'A') {
                alerts.push({ item, oldClass, newClass: classification });
            }
            // A -> D (Critical)
            else if (oldClass === 'A' && classification === 'D') {
                alerts.push({ item, oldClass, newClass: classification });
            }
        }

        // Upsert
        try {
            if (existing.id) {
                 await pool.query(`
                    UPDATE products SET 
                        title = $1, price = $2, available_quantity = $3, ml_full_stock = $4,
                        sold_quantity = $5, ml_listing_type = $6, ml_logistic_type = $7,
                        revenue_30d = $8, sales_30d = $9, profit_unit = $10,
                        classification = $11, recommendation = $12, tags = $13,
                        ml_tax_rate = $14, fixed_fee = $15, last_analyzed_at = NOW(), updated_at = NOW(),
                        status = $17, images = $18
                    WHERE id = $16
                 `, [
                    item.title, item.price, item.available_quantity, item.available_quantity,
                    item.sold_quantity, item.listing_type_id, "fulfillment",
                    salesData.revenue, salesData.quantity, profitUnit,
                    classification, recommendation, tags,
                    taxRate, fixedFee,
                    existing.id,
                    item.status,
                    JSON.stringify(item.pictures.map((p: any) => p.url))
                 ]);
            } else {
                 const skuAttr = item.attributes?.find((a: any) => a.id === "SELLER_SKU");
                 const sku = skuAttr ? skuAttr.value_name : null;
                 
                 await pool.query(`
                    INSERT INTO products (
                        workspace_id, ml_item_id, sku, title, price, available_quantity, ml_full_stock,
                        sold_quantity, ml_listing_type, ml_permalink, images, status, ml_logistic_type,
                        revenue_30d, sales_30d, profit_unit, classification, recommendation, tags,
                        ml_tax_rate, fixed_fee, last_analyzed_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
                    ON CONFLICT (workspace_id, sku) WHERE sku IS NOT NULL DO NOTHING
                 `, [
                    workspaceId, item.id, sku, item.title, item.price, item.available_quantity, item.available_quantity,
                    item.sold_quantity, item.listing_type_id, item.permalink, JSON.stringify(item.pictures.map((p: any) => p.url)),
                    item.status, "fulfillment",
                    salesData.revenue, salesData.quantity, profitUnit,
                    classification, recommendation, tags,
                    taxRate, fixedFee
                 ]);
            }
            updatedCount++;
        } catch (e) {
            console.error(`[Full Analytics] Error upserting item ${item.id}:`, e);
        }
    }

    // Send Alerts
    if (alerts.length > 0) {
        await sendAlerts(workspaceId, alerts);
    }

    return { success: true, count: updatedCount, alertsSent: alerts.length };
}

async function sendAlerts(workspaceId: string, alerts: Array<{ item: any, oldClass: string, newClass: string }>) {
    // Group by type
    const cToB = alerts.filter(a => a.oldClass === 'C' && a.newClass === 'B');
    const bToA = alerts.filter(a => a.oldClass === 'B' && a.newClass === 'A');
    const aToD = alerts.filter(a => a.oldClass === 'A' && a.newClass === 'D');

    if (cToB.length === 0 && bToA.length === 0 && aToD.length === 0) return;

    let message = "<b>📊 Atualização Full Analytics</b>\n\n";

    if (bToA.length > 0) {
        message += "🚀 <b>Escalar (B → A):</b>\n";
        bToA.forEach(a => message += `- ${a.item.title} (${a.item.id})\n`);
        message += "\n";
    }

    if (cToB.length > 0) {
        message += "📈 <b>Otimizar (C → B):</b>\n";
        cToB.forEach(a => message += `- ${a.item.title} (${a.item.id})\n`);
        message += "\n";
    }

    if (aToD.length > 0) {
        message += "🚨 <b>ALERTA CRÍTICO (A → D):</b>\n";
        aToD.forEach(a => message += `- ${a.item.title} (${a.item.id})\n`);
        message += "\n";
    }

    // Send via Telegram Service (using a direct method we assume or creating one)
    // Assuming TelegramNotificationService has a generic send method or we use the config getter
    try {
        // We can access the private method via 'any' cast or add a public method.
        // Or better, just implement a simple send here using the config, as TelegramNotificationService is a class with private methods.
        // Let's assume we can add a method to TelegramNotificationService or use the getTelegramConfig from it if it was public.
        // Since getTelegramConfig is private, let's just duplicate the config fetch for now to avoid modifying the service extensively if not needed,
        // OR better: Add a public method to TelegramNotificationService.
        
        // Using a public method that I will add: notifyFullAnalyticsAlert
        await TelegramNotificationService.notifyFullAnalyticsAlert(workspaceId, message);
    } catch (e) {
        console.error("Failed to send telegram alert:", e);
    }
}

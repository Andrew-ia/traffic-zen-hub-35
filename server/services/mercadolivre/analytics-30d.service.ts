import { getPool } from "../../config/database.js";
import { getMercadoLivreCredentials, requestWithAuth } from "../../api/integrations/mercadolivre.js";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";
const ITEMS_BATCH_SIZE = 20;
const ORDER_PAGE_LIMIT = 50;
const MAX_ORDERS = 5000;
const ITEM_STATUSES = ["active", "paused", "closed"];
const VISITS_CONCURRENCY = Number(process.env.ML_VISITS_CONCURRENCY || 5);
const VISITS_MAX_ITEMS = Number(process.env.ML_VISITS_MAX_ITEMS || 500);

let schemaReady: Promise<void> | null = null;

type OrderItemMetric = {
    itemId: string;
    quantity: number;
    revenue: number;
    title?: string;
    unitPrice?: number;
    listingTypeId?: string | null;
    currencyId?: string | null;
};

type ItemMetricSummary = {
    quantity: number;
    revenue: number;
    title?: string;
    unitPrice?: number;
    listingTypeId?: string | null;
};

type ItemFallback = {
    title?: string;
    unitPrice?: number;
    listingTypeId?: string | null;
};

type ProductSyncSummary = {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    missingCost: number;
};

type AnalyticsSyncResult = {
    success: boolean;
    days: number;
    products: ProductSyncSummary;
    ordersSynced: number;
    orderItemsSynced: number;
};

const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

async function ensureAnalyticsSchema() {
    if (schemaReady) return schemaReady;
    schemaReady = (async () => {
        const pool = getPool();
        await pool.query(`
            create table if not exists ml_orders (
              workspace_id uuid not null references workspaces(id) on delete cascade,
              order_id text not null,
              status text,
              date_created timestamptz,
              date_closed timestamptz,
              total_amount numeric(14,2),
              paid_amount numeric(14,2),
              currency_id text,
              buyer_id text,
              seller_id text,
              shipping_id text,
              shipping_logistic_type text,
              order_json jsonb,
              updated_at timestamptz not null default now(),
              primary key (workspace_id, order_id)
            );
        `);
        await pool.query(`
            create index if not exists idx_ml_orders_workspace_date on ml_orders (workspace_id, date_created desc);
        `);
        await pool.query(`
            create index if not exists idx_ml_orders_workspace_status on ml_orders (workspace_id, status);
        `);
        await pool.query(`
            create table if not exists ml_order_items (
              workspace_id uuid not null references workspaces(id) on delete cascade,
              order_id text not null,
              item_id text not null,
              quantity integer not null default 0,
              unit_price numeric(14,2) not null default 0,
              total_amount numeric(14,2) not null default 0,
              title text,
              listing_type_id text,
              currency_id text,
              created_at timestamptz not null default now(),
              primary key (workspace_id, order_id, item_id),
              constraint ml_order_items_order_fk
                foreign key (workspace_id, order_id)
                references ml_orders(workspace_id, order_id)
                on delete cascade
            );
        `);
        await pool.query(`
            create index if not exists idx_ml_order_items_workspace_item on ml_order_items (workspace_id, item_id);
        `);
        await pool.query(`
            create index if not exists idx_ml_order_items_workspace_order on ml_order_items (workspace_id, order_id);
        `);
        await pool.query(`alter table products add column if not exists sales_30d integer default 0;`);
        await pool.query(`alter table products add column if not exists revenue_30d numeric(14,2) default 0;`);
        await pool.query(`alter table products add column if not exists visits_30d integer default 0;`);
        await pool.query(`alter table products add column if not exists conversion_rate_30d numeric(10,4) default 0;`);
        await pool.query(`alter table products add column if not exists profit_unit numeric(14,2) default 0;`);
        await pool.query(`alter table products add column if not exists ml_tax_rate numeric(6,4) default 0;`);
        await pool.query(`alter table products add column if not exists fixed_fee numeric(10,2) default 0;`);
        await pool.query(`alter table products add column if not exists overhead_cost numeric(10,2) default 0;`);
        await pool.query(`alter table products add column if not exists cac numeric(10,2) default 0;`);
    })();
    return schemaReady;
}

const extractSku = (item: any): string | null => {
    const attrs = Array.isArray(item.attributes) ? item.attributes : [];
    const attrSku = attrs.find((a: any) => a.id === "SELLER_SKU" || a.id === "SKU" || String(a.name || "").toLowerCase() === "sku");
    if (attrSku?.value_name) return String(attrSku.value_name).trim();
    if (item.seller_custom_field) return String(item.seller_custom_field).trim();
    const variations = Array.isArray(item.variations) ? item.variations : [];
    const variationSku = variations.find((v: any) => v.seller_custom_field)?.seller_custom_field;
    if (variationSku) return String(variationSku).trim();
    return null;
};

const normalizeAttributes = (attrs: any[] | undefined) => {
    if (!Array.isArray(attrs)) return [];
    return attrs.map((attr: any) => ({
        id: attr.id,
        name: attr.name,
        value_id: attr.value_id,
        value_name: attr.value_name,
        value_struct: attr.value_struct
    }));
};

const parseDimensions = (dimensions?: string) => {
    if (!dimensions || typeof dimensions !== "string") return {};
    const [dimsPart, weightPart] = dimensions.split(",");
    const [width, height, length] = (dimsPart || "").split("x");
    return {
        widthCm: width ? Number.parseFloat(width) : null,
        heightCm: height ? Number.parseFloat(height) : null,
        lengthCm: length ? Number.parseFloat(length) : null,
        weightKg: weightPart ? Number.parseFloat(weightPart) / 1000 : null
    };
};

const computeTaxRate = (listingTypeId?: string | null) => {
    if (!listingTypeId) return 0.11;
    if (listingTypeId === "gold_pro") return 0.16;
    if (listingTypeId === "gold_special") return 0.11;
    if (listingTypeId === "free") return 0;
    return 0.11;
};

const computeFixedFee = (price: number, existingFee?: number | null) => {
    if (existingFee !== null && existingFee !== undefined) return Number(existingFee || 0);
    return price < 79 ? 6 : 0;
};

const computeProfitUnit = (
    price: number,
    taxRate: number,
    fixedFee: number,
    costPrice?: number | null,
    overheadCost?: number | null,
    cac?: number | null
) => {
    const cost = Number(costPrice || 0);
    const overhead = Number(overheadCost || 0);
    const acquisition = Number(cac || 0);
    return price - (price * taxRate) - fixedFee - cost - overhead - acquisition;
};

async function fetchAllItemIds(workspaceId: string, userId: string): Promise<string[]> {
    const ids = new Set<string>();

    for (const status of ITEM_STATUSES) {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            try {
                const resp = await requestWithAuth<any>(
                    workspaceId,
                    `${MERCADO_LIVRE_API_BASE}/users/${userId}/items/search`,
                    { params: { status, limit: 50, offset } }
                );
                const results: string[] = resp?.results || [];
                results.forEach((id) => ids.add(String(id)));
                offset += 50;
                const total = Number(resp?.paging?.total || 0);
                if (offset >= total || results.length === 0) {
                    hasMore = false;
                }
            } catch (error) {
                console.warn(`[ML Analytics] Falha ao buscar itens (${status}):`, (error as any)?.message || error);
                hasMore = false;
            }
        }
    }

    return Array.from(ids);
}

async function fetchItemsDetails(workspaceId: string, itemIds: string[]): Promise<any[]> {
    const items: any[] = [];
    const batches = chunkArray(itemIds, ITEMS_BATCH_SIZE);
    for (const batch of batches) {
        const idsStr = batch.join(",");
        const data = await requestWithAuth<any[]>(
            workspaceId,
            `${MERCADO_LIVRE_API_BASE}/items`,
            { params: { ids: idsStr } }
        );
        if (!Array.isArray(data)) continue;
        data.forEach((entry) => {
            if (entry?.code === 200 && entry.body) items.push(entry.body);
        });
    }
    return items;
}

async function fetchVisitsByItem(workspaceId: string, itemIds: string[], days: number): Promise<Map<string, number>> {
    const visitsByItem = new Map<string, number>();
    const uniqueItemIds = Array.from(new Set(itemIds.filter((id) => Boolean(id))));
    if (uniqueItemIds.length === 0) return visitsByItem;

    const dateTo = new Date();
    const dateFrom = new Date();
    const daysBack = Math.max(1, days);
    dateFrom.setDate(dateFrom.getDate() - (daysBack - 1));

    const dateFromStr = dateFrom.toISOString().split("T")[0];
    const dateToStr = dateTo.toISOString().split("T")[0];

    let index = 0;
    const concurrency = Math.max(1, Math.min(VISITS_CONCURRENCY, uniqueItemIds.length));

    const worker = async () => {
        while (index < uniqueItemIds.length) {
            const itemId = uniqueItemIds[index++];
            if (!itemId) continue;
            try {
                const data = await requestWithAuth<any>(
                    workspaceId,
                    `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`,
                    { params: { date_from: dateFromStr, date_to: dateToStr } }
                );
                const total = Number(data?.total_visits ?? data?.total ?? 0);
                visitsByItem.set(itemId, total);
            } catch (error) {
                // Best-effort: keep missing to avoid overwriting existing visits.
            }
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return visitsByItem;
}

async function fetchOrders(workspaceId: string, userId: string, days: number) {
    const orders: any[] = [];
    const dateFrom = new Date();
    const daysBack = Math.max(1, days) - 1;
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const dateFromStr = dateFrom.toISOString();

    let offset = 0;
    let hasMore = true;

    while (hasMore && orders.length < MAX_ORDERS) {
        const resp = await requestWithAuth<any>(
            workspaceId,
            `${MERCADO_LIVRE_API_BASE}/orders/search`,
            {
                params: {
                    seller: userId,
                    "order.date_created.from": dateFromStr,
                    limit: ORDER_PAGE_LIMIT,
                    offset,
                    sort: "date_desc"
                }
            }
        );
        const pageOrders = resp?.results || [];
        orders.push(...pageOrders);
        offset += ORDER_PAGE_LIMIT;
        const total = Number(resp?.paging?.total || 0);
        if (pageOrders.length === 0 || offset >= total) {
            hasMore = false;
        }
    }

    return orders;
}

function buildOrderMetrics(orders: any[]) {
    const metricsByItem = new Map<string, ItemMetricSummary>();
    const orderItemsByOrder = new Map<string, OrderItemMetric[]>();
    const fallbackByItem = new Map<string, ItemFallback>();

    for (const order of orders) {
        const status = String(order?.status || "").toLowerCase();
        const isCancelled = status === "cancelled";
        const items = Array.isArray(order?.order_items) ? order.order_items : [];
        const orderItemMap = new Map<string, OrderItemMetric>();

        items.forEach((orderItem: any) => {
            const itemId = String(orderItem?.item?.id || "").trim();
            if (!itemId) return;
            const qty = Number(orderItem?.quantity || 0);
            const unitPrice = Number(orderItem?.unit_price || 0);
            const total = unitPrice * qty;
            const listingTypeId = orderItem?.item?.listing_type_id || null;

            const existing = orderItemMap.get(itemId) || {
                itemId,
                quantity: 0,
                revenue: 0,
                title: orderItem?.item?.title,
                unitPrice,
                listingTypeId,
                currencyId: order?.currency_id || null
            };
            existing.quantity += qty;
            existing.revenue += total;
            existing.title = existing.title || orderItem?.item?.title;
            existing.unitPrice = unitPrice || existing.unitPrice;
            existing.listingTypeId = listingTypeId || existing.listingTypeId;
            existing.currencyId = order?.currency_id || existing.currencyId || null;
            orderItemMap.set(itemId, existing);

            if (!fallbackByItem.has(itemId)) {
                fallbackByItem.set(itemId, {
                    title: orderItem?.item?.title,
                    unitPrice,
                    listingTypeId
                });
            }

            if (!isCancelled) {
                const metric = metricsByItem.get(itemId) || {
                    quantity: 0,
                    revenue: 0,
                    title: orderItem?.item?.title,
                    unitPrice,
                    listingTypeId
                };
                metric.quantity += qty;
                metric.revenue += total;
                metric.title = metric.title || orderItem?.item?.title;
                metric.unitPrice = unitPrice || metric.unitPrice;
                metric.listingTypeId = listingTypeId || metric.listingTypeId;
                metricsByItem.set(itemId, metric);
            }
        });

        if (orderItemMap.size > 0) {
            orderItemsByOrder.set(order.id, Array.from(orderItemMap.values()));
        }
    }

    return { metricsByItem, orderItemsByOrder, fallbackByItem };
}

async function upsertOrders(workspaceId: string, orders: any[]) {
    const pool = getPool();
    let orderItemsCount = 0;

    for (const order of orders) {
        const shipping = order?.shipping || {};
        await pool.query(
            `
            insert into ml_orders (
                workspace_id, order_id, status, date_created, date_closed,
                total_amount, paid_amount, currency_id, buyer_id, seller_id,
                shipping_id, shipping_logistic_type, order_json, updated_at
            ) values (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13::jsonb, now()
            )
            on conflict (workspace_id, order_id) do update set
                status = excluded.status,
                date_created = excluded.date_created,
                date_closed = excluded.date_closed,
                total_amount = excluded.total_amount,
                paid_amount = excluded.paid_amount,
                currency_id = excluded.currency_id,
                buyer_id = excluded.buyer_id,
                seller_id = excluded.seller_id,
                shipping_id = excluded.shipping_id,
                shipping_logistic_type = excluded.shipping_logistic_type,
                order_json = excluded.order_json,
                updated_at = now()
            `,
            [
                workspaceId,
                String(order?.id || ""),
                order?.status || null,
                order?.date_created ? new Date(order.date_created) : null,
                order?.date_closed ? new Date(order.date_closed) : null,
                order?.total_amount || null,
                order?.paid_amount || null,
                order?.currency_id || null,
                order?.buyer?.id ? String(order.buyer.id) : null,
                order?.seller?.id ? String(order.seller.id) : null,
                shipping?.id ? String(shipping.id) : null,
                shipping?.logistic_type || null,
                JSON.stringify(order || {})
            ]
        );
    }

    const { orderItemsByOrder } = buildOrderMetrics(orders);

    for (const [orderId, items] of orderItemsByOrder.entries()) {
        for (const item of items) {
            const unitPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
            await pool.query(
                `
                insert into ml_order_items (
                    workspace_id, order_id, item_id, quantity, unit_price,
                    total_amount, title, listing_type_id, currency_id
                ) values (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9
                )
                on conflict (workspace_id, order_id, item_id) do update set
                    quantity = excluded.quantity,
                    unit_price = excluded.unit_price,
                    total_amount = excluded.total_amount,
                    title = excluded.title,
                    listing_type_id = excluded.listing_type_id,
                    currency_id = excluded.currency_id
                `,
                [
                    workspaceId,
                    orderId,
                    item.itemId,
                    item.quantity,
                    unitPrice,
                    item.revenue,
                    item.title || null,
                    item.listingTypeId || null,
                    item.currencyId || null
                ]
            );
            orderItemsCount += 1;
        }
    }

    return orderItemsCount;
}

async function loadExistingProducts(pool: ReturnType<typeof getPool>, workspaceId: string, itemIds: string[], skus: string[]) {
    const existingByItemId = new Map<string, any>();
    const existingBySku = new Map<string, any>();

    const idChunks = chunkArray(itemIds, 500);
    for (const chunk of idChunks) {
        const { rows } = await pool.query(
            `
            select id, ml_item_id, sku, cost_price, overhead_cost, fixed_fee, cac, ml_tax_rate
            from products
            where workspace_id = $1 and ml_item_id = any($2)
            `,
            [workspaceId, chunk]
        );
        rows.forEach((row) => {
            if (row.ml_item_id) existingByItemId.set(String(row.ml_item_id), row);
            if (row.sku) existingBySku.set(String(row.sku), row);
        });
    }

    const skuChunks = chunkArray(skus, 500);
    for (const chunk of skuChunks) {
        const { rows } = await pool.query(
            `
            select id, ml_item_id, sku, cost_price, overhead_cost, fixed_fee, cac, ml_tax_rate
            from products
            where workspace_id = $1 and sku = any($2)
            `,
            [workspaceId, chunk]
        );
        rows.forEach((row) => {
            if (row.ml_item_id) existingByItemId.set(String(row.ml_item_id), row);
            if (row.sku) existingBySku.set(String(row.sku), row);
        });
    }

    return { existingByItemId, existingBySku };
}

export async function syncMercadoLivreProducts(
    workspaceId: string,
    options: {
        items?: any[];
        metricsByItem?: Map<string, ItemMetricSummary>;
        fallbackItems?: Map<string, ItemMetricSummary>;
        includeMetrics?: boolean;
        visitsByItem?: Map<string, number>;
        days?: number;
    } = {}
): Promise<ProductSyncSummary> {
    await ensureAnalyticsSchema();

    const pool = getPool();
    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) {
        throw new Error("ml_not_connected");
    }

    const {
        items: providedItems,
        metricsByItem,
        fallbackItems,
        includeMetrics = false,
        visitsByItem,
        days = 30
    } = options;

    const itemIds = providedItems
        ? providedItems.map((item) => String(item.id))
        : await fetchAllItemIds(workspaceId, String(credentials.userId || credentials.user_id));

    const items = providedItems || (await fetchItemsDetails(workspaceId, itemIds));

    const extraItemIds = metricsByItem ? Array.from(metricsByItem.keys()) : [];
    const fallbackItemIds = fallbackItems ? Array.from(fallbackItems.keys()) : [];
    const allItemIds = Array.from(new Set([...itemIds, ...extraItemIds, ...fallbackItemIds]));
    const allItemIdsUnique = Array.from(new Set(allItemIds));

    const skus = items.map(extractSku).filter((sku): sku is string => Boolean(sku));
    const { existingByItemId, existingBySku } = await loadExistingProducts(pool, workspaceId, allItemIds, skus);

    let visitsByItemMap: Map<string, number> | null = null;
    if (includeMetrics) {
        if (visitsByItem) {
            visitsByItemMap = visitsByItem;
        } else if (allItemIdsUnique.length > 0) {
            const prioritizedIds = metricsByItem
                ? Array.from(metricsByItem.entries())
                    .sort((a, b) => Number(b[1]?.quantity || 0) - Number(a[1]?.quantity || 0))
                    .map(([itemId]) => itemId)
                : [];
            const visitLimit = VISITS_MAX_ITEMS > 0 ? VISITS_MAX_ITEMS : allItemIdsUnique.length;
            const visitItemIds = Array.from(new Set([...prioritizedIds, ...allItemIdsUnique])).slice(0, visitLimit);
            visitsByItemMap = await fetchVisitsByItem(workspaceId, visitItemIds, days);
        }
    }

    const summary: ProductSyncSummary = {
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        missingCost: 0
    };

    const processedIds = new Set<string>();

    for (const item of items) {
        if (!item?.id) {
            summary.skipped += 1;
            continue;
        }

        const itemId = String(item.id);
        processedIds.add(itemId);
        summary.processed += 1;

        const sku = extractSku(item);
        const existing = existingByItemId.get(itemId) || (sku ? existingBySku.get(sku) : null);

        const price = Number(item.price || 0);
        const listingTypeId = item.listing_type_id || null;
        const taxRate = existing?.ml_tax_rate ?? computeTaxRate(listingTypeId);
        const fixedFee = computeFixedFee(price, existing?.fixed_fee);
        const profitUnit = computeProfitUnit(price, taxRate, fixedFee, existing?.cost_price, existing?.overhead_cost, existing?.cac);

        const metrics = metricsByItem?.get(itemId);
        const sales30d = includeMetrics ? Number(metrics?.quantity || 0) : null;
        const revenue30d = includeMetrics ? Number(metrics?.revenue || 0) : null;
        const visits30d = includeMetrics && visitsByItemMap?.has(itemId)
            ? Number(visitsByItemMap.get(itemId) || 0)
            : null;
        const conversionRate30d = visits30d !== null
            ? (visits30d > 0 ? Number(sales30d || 0) / visits30d : 0)
            : null;

        const pics = Array.isArray(item.pictures) ? item.pictures : [];
        const images = pics
            .map((p: any) => p.secure_url || p.url)
            .filter((url: string | undefined) => Boolean(url));
        const attributes = normalizeAttributes(item.attributes);
        const dims = parseDimensions(item?.shipping?.dimensions);

        const payload = [
            itemId,
            sku,
            item.title,
            item.description || null,
            price,
            item.original_price || null,
            Number(item.available_quantity || 0),
            Number(item.sold_quantity || 0),
            item.condition || "new",
            item.category_id || null,
            listingTypeId,
            item.permalink || null,
            JSON.stringify(images),
            JSON.stringify(attributes),
            Boolean(item.shipping?.free_shipping),
            item.shipping?.mode || "me2",
            Boolean(item.shipping?.local_pick_up),
            dims.weightKg,
            dims.heightCm,
            dims.widthCm,
            dims.lengthCm,
            item.status || null,
            includeMetrics ? revenue30d : null,
            includeMetrics ? sales30d : null,
            includeMetrics ? visits30d : null,
            includeMetrics ? conversionRate30d : null,
            profitUnit,
            taxRate,
            fixedFee
        ];

        if (existing?.id) {
            await pool.query(
                `
                update products set
                    ml_item_id = $1,
                    sku = coalesce($2, sku),
                    title = $3,
                    description = coalesce($4, description),
                    price = $5,
                    original_price = $6,
                    available_quantity = $7,
                    sold_quantity = $8,
                    condition = $9,
                    ml_category_id = $10,
                    ml_listing_type = $11,
                    ml_permalink = $12,
                    images = $13,
                    attributes = $14,
                    free_shipping = $15,
                    shipping_mode = $16,
                    local_pickup = $17,
                    weight_kg = $18,
                    height_cm = $19,
                    width_cm = $20,
                    length_cm = $21,
                    status = $22,
                    revenue_30d = coalesce($23, revenue_30d),
                    sales_30d = coalesce($24, sales_30d),
                    visits_30d = coalesce($25, visits_30d),
                    conversion_rate_30d = coalesce($26, conversion_rate_30d),
                    profit_unit = $27,
                    ml_tax_rate = $28,
                    fixed_fee = $29,
                    published_on_ml = true,
                    published_at = coalesce(published_at, $30),
                    updated_at = now()
                where id = $31
                `,
                [
                    ...payload,
                    item.start_time ? new Date(item.start_time) : null,
                    existing.id
                ]
            );
            summary.updated += 1;
        } else {
            await pool.query(
                `
                insert into products (
                    workspace_id,
                    ml_item_id,
                    sku,
                    title,
                    description,
                    price,
                    original_price,
                    available_quantity,
                    sold_quantity,
                    condition,
                    ml_category_id,
                    ml_listing_type,
                    ml_permalink,
                    images,
                    attributes,
                    free_shipping,
                    shipping_mode,
                    local_pickup,
                    weight_kg,
                    height_cm,
                    width_cm,
                    length_cm,
                    status,
                    revenue_30d,
                    sales_30d,
                    visits_30d,
                    conversion_rate_30d,
                    profit_unit,
                    ml_tax_rate,
                    fixed_fee,
                    currency,
                    published_on_ml,
                    published_at,
                    created_at,
                    updated_at
                ) values (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    $19,
                    $20,
                    $21,
                    $22,
                    $23,
                    $24,
                    $25,
                    $26,
                    $27,
                    $28,
                    $29,
                    $30,
                    $31,
                    $32,
                    $33,
                    now(),
                    now()
                )
                `,
                [
                    workspaceId,
                    itemId,
                    sku,
                    item.title,
                    item.description || null,
                    price,
                    item.original_price || null,
                    Number(item.available_quantity || 0),
                    Number(item.sold_quantity || 0),
                    item.condition || "new",
                    item.category_id || null,
                    listingTypeId,
                    item.permalink || null,
                    JSON.stringify(images),
                    JSON.stringify(attributes),
                    Boolean(item.shipping?.free_shipping),
                    item.shipping?.mode || "me2",
                    Boolean(item.shipping?.local_pick_up),
                    dims.weightKg,
                    dims.heightCm,
                    dims.widthCm,
                    dims.lengthCm,
                    item.status || null,
                    includeMetrics ? revenue30d : 0,
                    includeMetrics ? sales30d : 0,
                    includeMetrics ? visits30d : null,
                    includeMetrics ? conversionRate30d : null,
                    profitUnit,
                    taxRate,
                    fixedFee,
                    item.currency_id || "BRL",
                    true,
                    item.start_time ? new Date(item.start_time) : null
                ]
            );
            summary.created += 1;
        }

        const hasCost = Boolean(
            existing && (existing.cost_price != null || existing.overhead_cost != null || existing.cac != null)
        );
        if (!hasCost) {
            summary.missingCost += 1;
        }
    }

    if (includeMetrics && fallbackItems) {
        for (const [itemId, metric] of fallbackItems.entries()) {
            if (processedIds.has(itemId)) continue;
            const existing = existingByItemId.get(itemId);
            const metrics = metricsByItem?.get(itemId);
            const price = Number(metrics?.unitPrice || metric.unitPrice || 0);
            const listingTypeId = metrics?.listingTypeId || metric.listingTypeId || null;
            const taxRate = existing?.ml_tax_rate ?? computeTaxRate(listingTypeId);
            const fixedFee = computeFixedFee(price, existing?.fixed_fee);
            const profitUnit = computeProfitUnit(price, taxRate, fixedFee, existing?.cost_price, existing?.overhead_cost, existing?.cac);
            const sales30d = Number(metrics?.quantity || 0);
            const revenue30d = Number(metrics?.revenue || 0);
            const visits30d = visitsByItemMap?.has(itemId)
                ? Number(visitsByItemMap.get(itemId) || 0)
                : null;
            const conversionRate30d = visits30d !== null
                ? (visits30d > 0 ? sales30d / visits30d : 0)
                : null;

            if (existing?.id) {
                await pool.query(
                    `
                    update products set
                        sales_30d = $1,
                        revenue_30d = $2,
                        visits_30d = coalesce($3, visits_30d),
                        conversion_rate_30d = coalesce($4, conversion_rate_30d),
                        profit_unit = $5,
                        ml_tax_rate = $6,
                        fixed_fee = $7
                    where id = $8
                    `,
                    [
                        sales30d,
                        revenue30d,
                        visits30d,
                        conversionRate30d,
                        profitUnit,
                        taxRate,
                        fixedFee,
                        existing.id
                    ]
                );
                summary.updated += 1;
            } else {
                await pool.query(
                    `
                    insert into products (
                        workspace_id,
                        ml_item_id,
                        title,
                        price,
                        ml_listing_type,
                        revenue_30d,
                        sales_30d,
                        visits_30d,
                        conversion_rate_30d,
                        profit_unit,
                        ml_tax_rate,
                        fixed_fee,
                        currency,
                        published_on_ml,
                        created_at,
                        updated_at
                    ) values (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        true,
                        now(),
                        now()
                    )
                    `,
                    [
                        workspaceId,
                        itemId,
                        metric.title || metrics?.title || `Produto ${itemId}`,
                        price,
                        listingTypeId,
                        revenue30d,
                        sales30d,
                        visits30d,
                        conversionRate30d,
                        profitUnit,
                        taxRate,
                        fixedFee,
                        "BRL"
                    ]
                );
                summary.created += 1;
            }

            const hasCost = Boolean(
                existing && (existing.cost_price != null || existing.overhead_cost != null || existing.cac != null)
            );
            if (!hasCost) {
                summary.missingCost += 1;
            }
        }
    }

    return summary;
}

export async function syncMercadoLivreAnalytics30d(workspaceId: string, days = 30): Promise<AnalyticsSyncResult> {
    await ensureAnalyticsSchema();

    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) {
        throw new Error("ml_not_connected");
    }

    const orders = await fetchOrders(workspaceId, String(credentials.userId || credentials.user_id), days);
    const { metricsByItem, fallbackByItem } = buildOrderMetrics(orders);
    const orderItemsSynced = await upsertOrders(workspaceId, orders);

    const productsSummary = await syncMercadoLivreProducts(workspaceId, {
        metricsByItem,
        fallbackItems: fallbackByItem,
        includeMetrics: true,
        days
    });

    return {
        success: true,
        days,
        products: productsSummary,
        ordersSynced: orders.length,
        orderItemsSynced
    };
}

export async function syncMercadoLivreOrders(workspaceId: string, days = 7) {
    await ensureAnalyticsSchema();

    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) {
        throw new Error("ml_not_connected");
    }

    const orders = await fetchOrders(workspaceId, String(credentials.userId || credentials.user_id), days);
    const orderItemsSynced = await upsertOrders(workspaceId, orders);

    return {
        success: true,
        days,
        ordersSynced: orders.length,
        orderItemsSynced
    };
}

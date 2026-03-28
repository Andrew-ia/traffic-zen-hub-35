import { createHash, randomUUID } from "crypto";
import { Router } from "express";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../config/database.js";
import { ensureRuntimeSchema } from "../config/runtimeSchema.js";
import { requestWithAuth } from "./integrations/mercadolivre.js";

const router = Router();
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

let catalogSchemaReady: Promise<void> | null = null;
let purchaseListSchemaReady: Promise<void> | null = null;

type ProductHubPayload = {
  sku?: string | null;
  name?: string | null;
  category?: string | null;
  price?: number | string | null;
  cost_price?: number | string | null;
  stock_on_hand?: number | string | null;
  stock_reserved?: number | string | null;
  status?: string | null;
  supplier?: string | null;
  barcode?: string | null;
  description?: string | null;
  notes?: string | null;
  video_url?: string | null;
  primary_image_url?: string | null;
  weight_kg?: number | string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
  length_cm?: number | string | null;
  metadata?: Record<string, any> | null;
  images?: Array<{
    id?: string | null;
    url?: string | null;
    imageData?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
    isPrimary?: boolean | null;
  }> | null;
};

type InventoryMovementRecord = {
  id: string;
  delta_quantity: number;
  balance_before: number;
  balance_after: number;
  movement_type: string;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
};

type StockSyncResult = {
  channel: string;
  source: string;
  sourceId: string;
  externalListingId: string;
  title: string | null;
  synced: boolean;
  publishedStock?: number | null;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

type ProductImageInput = {
  id?: string | null;
  url?: string | null;
  imageData?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  isPrimary: boolean;
};

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function normalizeChannel(value: unknown): "mercadolivre" | "shopee" | "other" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "mercadolivre") return "mercadolivre";
  if (normalized === "shopee") return "shopee";
  return "other";
}

function computeAvailableStock(stockOnHand: number, stockReserved: number) {
  return Math.max(stockOnHand - stockReserved, 0);
}

function computeAssetHash(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function normalizeImageInputs(value: unknown): ProductImageInput[] {
  if (!Array.isArray(value)) return [];

  const items = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, any>;
      const id = normalizeText(item.id);
      const rawUrl = normalizeText(item.url);
      const rawImageData = normalizeText(item.imageData);
      const imageData = rawImageData || (rawUrl && isImageDataUrl(rawUrl) ? rawUrl : null);
      const url = imageData ? null : rawUrl;
      const fileName = normalizeText(item.fileName);
      const mimeType = normalizeText(item.mimeType);
      const fileSizeBytes = item.fileSizeBytes != null ? toInteger(item.fileSizeBytes) : null;
      const isPrimary = Boolean(item.isPrimary);

      if (!id && !url && !imageData) return null;
      if (imageData && !isImageDataUrl(imageData)) return null;

      return {
        id,
        url: imageData ? null : url,
        imageData,
        fileName,
        mimeType,
        fileSizeBytes,
        isPrimary,
      } satisfies ProductImageInput;
    })
    .filter((item): item is ProductImageInput => Boolean(item));

  if (!items.length) return [];
  if (!items.some((item) => item.isPrimary)) {
    items[0].isPrimary = true;
  }

  return items;
}

function normalizeCatalogPayload(payload: ProductHubPayload, existing?: any) {
  const sku = normalizeText(payload.sku) ?? normalizeText(existing?.sku);
  const name = normalizeText(payload.name) ?? normalizeText(existing?.name);
  const category = normalizeText(payload.category) ?? normalizeText(existing?.category);
  const description = normalizeText(payload.description) ?? normalizeText(existing?.description);
  const notes = normalizeText(payload.notes) ?? normalizeText(existing?.notes);
  const supplier = normalizeText(payload.supplier) ?? normalizeText(existing?.supplier);
  const barcode = normalizeText(payload.barcode) ?? normalizeText(existing?.barcode);
  const status = normalizeText(payload.status) ?? normalizeText(existing?.status) ?? "active";
  const videoUrl = normalizeText(payload.video_url) ?? normalizeText(existing?.video_url);
  const primaryImageUrl = normalizeText(payload.primary_image_url);
  const price =
    payload.price !== undefined ? toNumberOrNull(payload.price) : toNumberOrNull(existing?.price);
  const costPrice =
    payload.cost_price !== undefined
      ? toNumberOrNull(payload.cost_price) ?? 0
      : toNumberOrNull(existing?.cost_price) ?? 0;
  const stockOnHand =
    payload.stock_on_hand !== undefined
      ? Math.max(0, toInteger(payload.stock_on_hand))
      : Math.max(0, toInteger(existing?.stock_on_hand));
  const stockReserved =
    payload.stock_reserved !== undefined
      ? Math.max(0, toInteger(payload.stock_reserved))
      : Math.max(0, toInteger(existing?.stock_reserved));
  const weightKg =
    payload.weight_kg !== undefined ? toNumberOrNull(payload.weight_kg) : toNumberOrNull(existing?.weight_kg);
  const widthCm =
    payload.width_cm !== undefined ? toNumberOrNull(payload.width_cm) : toNumberOrNull(existing?.width_cm);
  const heightCm =
    payload.height_cm !== undefined ? toNumberOrNull(payload.height_cm) : toNumberOrNull(existing?.height_cm);
  const lengthCm =
    payload.length_cm !== undefined ? toNumberOrNull(payload.length_cm) : toNumberOrNull(existing?.length_cm);
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? payload.metadata
      : existing?.metadata && typeof existing.metadata === "object"
        ? existing.metadata
        : {};

  return {
    sku,
    name,
    category,
    description,
    notes,
    supplier,
    barcode,
    status,
    videoUrl,
    primaryImageUrl,
    price,
    costPrice,
    stockOnHand,
    stockReserved,
    weightKg,
    widthCm,
    heightCm,
    lengthCm,
    metadata,
  };
}

async function ensureCatalogSchema() {
  if (catalogSchemaReady) return catalogSchemaReady;

  catalogSchemaReady = ensureRuntimeSchema(
    "Product Hub catalog",
    {
      tables: ["products_hub", "product_assets", "product_channel_listings", "inventory_movements"],
      columns: {
        products_hub: [
          "id",
          "workspace_id",
          "platform",
          "platform_product_id",
          "sku",
          "name",
          "category",
          "price",
          "description",
          "video_url",
          "barcode",
          "supplier",
          "cost_price",
          "stock_on_hand",
          "stock_reserved",
          "status",
          "weight_kg",
          "width_cm",
          "height_cm",
          "length_cm",
          "notes",
          "metadata",
        ],
        products: ["id", "workspace_id", "ml_item_id", "hub_product_id"],
        product_assets: [
          "id",
          "product_id",
          "type",
          "url",
          "storage_mode",
          "inline_data",
          "file_name",
          "mime_type",
          "file_size_bytes",
          "asset_hash",
          "is_primary",
          "metadata",
          "created_at",
        ],
        product_channel_listings: [
          "id",
          "workspace_id",
          "hub_product_id",
          "channel",
          "source",
          "internal_product_id",
          "external_listing_id",
          "title",
          "price",
          "published_stock",
          "permalink",
          "metadata",
          "last_synced_at",
        ],
        inventory_movements: [
          "id",
          "workspace_id",
          "hub_product_id",
          "movement_type",
          "delta_quantity",
          "balance_before",
          "balance_after",
          "reason",
          "notes",
          "metadata",
          "created_at",
        ],
      },
    },
    async () => {
      const db = getPool();
      await db.query(`
        create extension if not exists "pgcrypto";

        alter table products_hub
          add column if not exists description text;

        alter table products_hub
          add column if not exists video_url text;

        alter table products_hub
          add column if not exists barcode text;

        alter table products_hub
          add column if not exists supplier text;

        alter table products_hub
          add column if not exists cost_price numeric(14,2) default 0;

        alter table products_hub
          add column if not exists stock_on_hand integer not null default 0;

        alter table products_hub
          add column if not exists stock_reserved integer not null default 0;

        alter table products_hub
          add column if not exists status text not null default 'active';

        alter table products_hub
          add column if not exists weight_kg numeric(10,3);

        alter table products_hub
          add column if not exists width_cm numeric(10,2);

        alter table products_hub
          add column if not exists height_cm numeric(10,2);

        alter table products_hub
          add column if not exists length_cm numeric(10,2);

        alter table products_hub
          add column if not exists notes text;

        alter table products_hub
          drop constraint if exists products_hub_platform_check;

        alter table products_hub
          add constraint products_hub_platform_check
          check (platform in ('hub', 'mercadolivre', 'shopee', 'meta', 'google'));

        alter table products
          add column if not exists hub_product_id uuid;

        do $$
        begin
          if not exists (
            select 1
            from pg_constraint
            where conname = 'products_hub_product_fk'
          ) then
            alter table products
              add constraint products_hub_product_fk
              foreign key (hub_product_id)
              references products_hub(id)
              on delete set null;
          end if;
        end $$;

        create index if not exists idx_products_workspace_hub_product
          on products (workspace_id, hub_product_id);

        update products p
        set hub_product_id = ph.id
        from products_hub ph
        where p.workspace_id = ph.workspace_id
          and p.ml_item_id = ph.platform_product_id
          and ph.platform = 'mercadolivre'
          and p.hub_product_id is null;

        create table if not exists product_channel_listings (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          hub_product_id uuid not null references products_hub(id) on delete cascade,
          channel text not null check (channel in ('mercadolivre', 'shopee', 'other')),
          source text not null default 'manual',
          internal_product_id uuid references products(id) on delete set null,
          external_listing_id text not null,
          sku text,
          title text,
          status text,
          price numeric(14,2),
          published_stock integer default 0,
          permalink text,
          metadata jsonb default '{}'::jsonb,
          last_synced_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (workspace_id, channel, external_listing_id)
        );

        create index if not exists idx_product_channel_listings_hub_product
          on product_channel_listings (hub_product_id, channel);

        create index if not exists idx_product_channel_listings_workspace_channel
          on product_channel_listings (workspace_id, channel, updated_at desc);

        create table if not exists inventory_movements (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          hub_product_id uuid not null references products_hub(id) on delete cascade,
          channel text,
          movement_type text not null check (
            movement_type in (
              'manual_adjustment',
              'catalog_edit',
              'sale',
              'return',
              'reservation',
              'release',
              'sync'
            )
          ),
          delta_quantity integer not null,
          balance_before integer not null default 0,
          balance_after integer not null default 0,
          reference_type text,
          reference_id text,
          reason text,
          notes text,
          metadata jsonb default '{}'::jsonb,
          created_at timestamptz not null default now()
        );

        create index if not exists idx_inventory_movements_hub_product
          on inventory_movements (hub_product_id, created_at desc);

        create index if not exists idx_inventory_movements_workspace
          on inventory_movements (workspace_id, created_at desc);

        alter table product_assets
          add column if not exists storage_mode text not null default 'url';

        alter table product_assets
          add column if not exists inline_data text;

        alter table product_assets
          add column if not exists file_name text;

        alter table product_assets
          add column if not exists mime_type text;

        alter table product_assets
          add column if not exists file_size_bytes integer;

        alter table product_assets
          add column if not exists asset_hash text;

        alter table product_assets
          drop constraint if exists product_assets_storage_mode_check;

        alter table product_assets
          add constraint product_assets_storage_mode_check
          check (storage_mode in ('url', 'inline'));

        drop index if exists idx_product_assets_url;

        create unique index if not exists idx_product_assets_url_unique
          on product_assets (product_id, url)
          where url is not null;

        create unique index if not exists idx_product_assets_hash_unique
          on product_assets (product_id, asset_hash)
          where asset_hash is not null;
      `);
    },
  );

  return catalogSchemaReady;
}

async function ensurePurchaseListSchema() {
  if (purchaseListSchemaReady) return purchaseListSchemaReady;

  purchaseListSchemaReady = ensureRuntimeSchema(
    "Product Hub purchase lists",
    {
      tables: ["product_hub_purchase_lists", "product_hub_purchase_items"],
      columns: {
        product_hub_purchase_lists: ["id", "workspace_id", "name", "created_at", "updated_at"],
        product_hub_purchase_items: [
          "id",
          "list_id",
          "product_id",
          "suggestion",
          "sizes",
          "created_at",
          "updated_at",
        ],
      },
    },
    async () => {
      const db = getPool();
      await db.query(`
        create table if not exists product_hub_purchase_lists (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          name text not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create index if not exists idx_product_hub_purchase_lists_workspace
          on product_hub_purchase_lists (workspace_id, updated_at desc);

        create table if not exists product_hub_purchase_items (
          id uuid primary key default gen_random_uuid(),
          list_id uuid not null references product_hub_purchase_lists(id) on delete cascade,
          product_id uuid not null references products_hub(id) on delete cascade,
          suggestion text,
          sizes text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (list_id, product_id)
        );
        create index if not exists idx_product_hub_purchase_items_list
          on product_hub_purchase_items (list_id);
        alter table product_hub_purchase_items
          add column if not exists sizes text;
      `);
    },
  );

  return purchaseListSchemaReady;
}

async function syncProductImages(
  db: Pool | PoolClient,
  productId: string,
  rawImages: ProductImageInput[],
  fallbackPrimaryImageUrl?: string | null,
) {
  const fallbackImages =
    rawImages.length === 0 && fallbackPrimaryImageUrl
      ? normalizeImageInputs([{ url: fallbackPrimaryImageUrl, isPrimary: true }])
      : rawImages;

  const existingResult = await db.query(
    `
      select
        id,
        url,
        inline_data,
        asset_hash
      from product_assets
      where product_id = $1
        and type = 'image'
      order by is_primary desc, created_at desc
    `,
    [productId],
  );

  const existingById = new Map<string, any>();
  const existingByHash = new Map<string, any>();
  const existingByUrl = new Map<string, any>();

  existingResult.rows.forEach((row) => {
    existingById.set(String(row.id), row);
    if (row.asset_hash) existingByHash.set(String(row.asset_hash), row);
    if (row.url) existingByUrl.set(String(row.url), row);
  });

  await db.query(
    `
      update product_assets
      set is_primary = false
      where product_id = $1
        and type = 'image'
    `,
    [productId],
  );

  const keepIds = new Set<string>();

  for (const image of fallbackImages) {
    const normalizedUrl = image.imageData ? null : normalizeText(image.url);
    const normalizedData = image.imageData ? normalizeText(image.imageData) : null;
    const assetHash = normalizedData
      ? computeAssetHash(normalizedData)
      : normalizedUrl
        ? computeAssetHash(normalizedUrl)
        : null;

    const existingMatch =
      (image.id && existingById.get(String(image.id))) ||
      (assetHash && existingByHash.get(assetHash)) ||
      (normalizedUrl && existingByUrl.get(normalizedUrl)) ||
      null;

    if (existingMatch) {
      await db.query(
        `
          update product_assets
          set
            is_primary = $2,
            storage_mode = $3,
            inline_data = $4,
            url = $5,
            file_name = $6,
            mime_type = $7,
            file_size_bytes = $8,
            asset_hash = $9,
            metadata = coalesce(product_assets.metadata, '{}'::jsonb) || $10::jsonb
          where id = $1
        `,
        [
          existingMatch.id,
          image.isPrimary,
          normalizedData ? "inline" : "url",
          normalizedData,
          normalizedUrl,
          image.fileName || null,
          image.mimeType || null,
          image.fileSizeBytes ?? null,
          assetHash,
          JSON.stringify({
            source: normalizedData ? "platform_upload" : "external_url",
          }),
        ],
      );
      keepIds.add(String(existingMatch.id));
      continue;
    }

    const { rows } = await db.query(
      `
        insert into product_assets (
          product_id,
          type,
          url,
          storage_mode,
          inline_data,
          file_name,
          mime_type,
          file_size_bytes,
          asset_hash,
          is_primary,
          metadata
        )
        values ($1, 'image', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        returning id
      `,
      [
        productId,
        normalizedUrl,
        normalizedData ? "inline" : "url",
        normalizedData,
        image.fileName || null,
        image.mimeType || null,
        image.fileSizeBytes ?? null,
        assetHash,
        image.isPrimary,
        JSON.stringify({
          source: normalizedData ? "platform_upload" : "external_url",
        }),
      ],
    );

    keepIds.add(String(rows[0].id));
  }

  if (keepIds.size > 0) {
    await db.query(
      `
        delete from product_assets
        where product_id = $1
          and type = 'image'
          and not (id = any($2::uuid[]))
      `,
      [productId, Array.from(keepIds)],
    );
  } else {
    await db.query(
      `
        delete from product_assets
        where product_id = $1
          and type = 'image'
      `,
      [productId],
    );
  }
}

async function insertInventoryMovement(
  db: Pool | PoolClient,
  workspaceId: string,
  hubProductId: string,
  movement: {
    deltaQuantity: number;
    balanceBefore: number;
    balanceAfter: number;
    movementType: string;
    reason?: string | null;
    notes?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Record<string, any>;
  },
): Promise<InventoryMovementRecord> {
  const { rows } = await db.query(
    `
      insert into inventory_movements (
        workspace_id,
        hub_product_id,
        movement_type,
        delta_quantity,
        balance_before,
        balance_after,
        reason,
        notes,
        reference_type,
        reference_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      returning id, delta_quantity, balance_before, balance_after, movement_type, reason, notes, created_at
    `,
    [
      workspaceId,
      hubProductId,
      movement.movementType,
      movement.deltaQuantity,
      movement.balanceBefore,
      movement.balanceAfter,
      movement.reason || null,
      movement.notes || null,
      movement.referenceType || null,
      movement.referenceId || null,
      JSON.stringify(movement.metadata || {}),
    ],
  );

  return rows[0] as InventoryMovementRecord;
}

async function fetchHubProduct(db: Pool | PoolClient, workspaceId: string, productId: string) {
  const { rows } = await db.query(
    `
      with first_video as (
        select distinct on (pa.product_id)
          pa.product_id,
          coalesce(pa.inline_data, pa.url) as video_url
        from product_assets pa
        where pa.type = 'video'
        order by pa.product_id, pa.is_primary desc, pa.created_at desc
      )
      select
        p.id,
        p.workspace_id,
        p.platform,
        p.platform_product_id,
        p.sku,
        p.name,
        p.category,
        p.price,
        p.source,
        p.description,
        p.barcode,
        p.supplier,
        p.cost_price,
        p.stock_on_hand,
        p.stock_reserved,
        greatest(coalesce(p.stock_on_hand, 0) - coalesce(p.stock_reserved, 0), 0) as available_stock,
        p.status,
        p.weight_kg,
        p.width_cm,
        p.height_cm,
        p.length_cm,
        p.notes,
        p.metadata,
        p.created_at,
        p.updated_at,
        coalesce(p.video_url, fv.video_url) as video_url,
        coalesce(a.assets, '[]') as assets
      from products_hub p
      left join first_video fv on fv.product_id = p.id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', pa.id,
            'type', pa.type,
            'url', coalesce(pa.inline_data, pa.url),
            'is_primary', pa.is_primary,
            'storage_mode', pa.storage_mode,
            'file_name', pa.file_name,
            'mime_type', pa.mime_type,
            'file_size_bytes', pa.file_size_bytes,
            'metadata', pa.metadata,
            'created_at', pa.created_at
          )
          order by pa.is_primary desc, pa.created_at desc
        ) as assets
        from product_assets pa
        where pa.product_id = p.id
      ) a on true
      where p.id = $1
        and p.workspace_id = $2
      limit 1
    `,
    [productId, workspaceId],
  );

  return rows[0] || null;
}

async function syncHubProductStock(
  workspaceId: string,
  hubProductId: string,
  availableStock: number,
): Promise<StockSyncResult[]> {
  const db = getPool();
  const results: StockSyncResult[] = [];

  const [mlListingsResult, manualListingsResult] = await Promise.all([
    db.query(
      `
        select id, ml_item_id, title
        from products
        where workspace_id = $1
          and hub_product_id = $2
          and ml_item_id is not null
          and coalesce(status, '') != 'deleted'
        order by updated_at desc nulls last, created_at desc
      `,
      [workspaceId, hubProductId],
    ),
    db.query(
      `
        select id, channel, external_listing_id, title
        from product_channel_listings
        where workspace_id = $1
          and hub_product_id = $2
          and channel != 'mercadolivre'
        order by updated_at desc nulls last, created_at desc
      `,
      [workspaceId, hubProductId],
    ),
  ]);

  for (const row of mlListingsResult.rows) {
    try {
      await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/items/${row.ml_item_id}`, {
        method: "PUT",
        data: { available_quantity: availableStock },
        retryOnWrite: true,
      });

      await db.query(
        `
          update products
          set available_quantity = $1,
              updated_at = now()
          where id = $2
        `,
        [availableStock, row.id],
      );

      results.push({
        channel: "mercadolivre",
        source: "products",
        sourceId: row.id,
        externalListingId: row.ml_item_id,
        title: row.title || null,
        synced: true,
        publishedStock: availableStock,
      });
    } catch (error: any) {
      results.push({
        channel: "mercadolivre",
        source: "products",
        sourceId: row.id,
        externalListingId: row.ml_item_id,
        title: row.title || null,
        synced: false,
        error: error?.message || "failed_to_sync_mercadolivre",
      });
    }
  }

  for (const row of manualListingsResult.rows) {
    results.push({
      channel: row.channel,
      source: "manual",
      sourceId: row.id,
      externalListingId: row.external_listing_id,
      title: row.title || null,
      synced: false,
      skipped: true,
      reason: row.channel === "shopee" ? "shopee_sync_not_implemented" : "manual_channel_link",
    });
  }

  return results;
}

router.get("/", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { workspaceId, search = "", searchBy = "all", page = "1", limit = "50" } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
    const offset = (pageNumber - 1) * pageSize;

    const filters: string[] = [];
    const params: any[] = [workspaceId];
    let idx = 2;

    if (search && typeof search === "string") {
      const searchByKey = typeof searchBy === "string" ? searchBy.toLowerCase() : "all";
      const searchValue = `%${search}%`;
      if (searchByKey === "name") {
        filters.push(`p.name ILIKE $${idx}`);
      } else if (searchByKey === "mlb") {
        filters.push(`p.platform_product_id ILIKE $${idx}`);
      } else {
        filters.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.platform_product_id ILIKE $${idx})`);
      }
      params.push(searchValue);
      idx += 1;
    }

    const where = filters.length ? `and ${filters.join(" and ")}` : "";

    const itemsQuery = `
      with first_video as (
        select distinct on (pa.product_id)
          pa.product_id,
          coalesce(pa.inline_data, pa.url) as video_url
        from product_assets pa
        where pa.type = 'video'
        order by pa.product_id, pa.is_primary desc, pa.created_at desc
      ),
      link_counts as (
        select
          links.hub_product_id,
          count(*) as linked_listings,
          count(*) filter (where links.channel = 'mercadolivre') as mercado_livre_listings,
          count(*) filter (where links.channel = 'shopee') as shopee_listings
        from (
          select
            p.workspace_id,
            p.hub_product_id,
            'mercadolivre'::text as channel
          from products p
          where p.workspace_id = $1
            and p.hub_product_id is not null
            and p.ml_item_id is not null
            and coalesce(p.status, '') != 'deleted'
          union all
          select
            pcl.workspace_id,
            pcl.hub_product_id,
            pcl.channel
          from product_channel_listings pcl
          where pcl.workspace_id = $1
        ) links
        group by links.hub_product_id
      )
      select
        p.id,
        p.workspace_id,
        p.platform,
        p.platform_product_id,
        p.sku,
        p.name,
        p.category,
        p.price,
        p.source,
        p.description,
        p.barcode,
        p.supplier,
        p.cost_price,
        p.stock_on_hand,
        p.stock_reserved,
        greatest(coalesce(p.stock_on_hand, 0) - coalesce(p.stock_reserved, 0), 0) as available_stock,
        p.status,
        p.weight_kg,
        p.width_cm,
        p.height_cm,
        p.length_cm,
        p.notes,
        p.created_at,
        p.updated_at,
        coalesce(p.video_url, fv.video_url) as video_url,
        coalesce(a.assets, '[]') as assets,
        coalesce(lc.linked_listings, 0) as linked_listings,
        coalesce(lc.mercado_livre_listings, 0) as mercado_livre_listings,
        coalesce(lc.shopee_listings, 0) as shopee_listings
      from products_hub p
      left join first_video fv on fv.product_id = p.id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', pa.id,
            'type', pa.type,
            'url', coalesce(pa.inline_data, pa.url),
            'is_primary', pa.is_primary,
            'storage_mode', pa.storage_mode,
            'file_name', pa.file_name,
            'mime_type', pa.mime_type,
            'file_size_bytes', pa.file_size_bytes,
            'created_at', pa.created_at
          )
          order by pa.is_primary desc, pa.created_at desc
        ) as assets
        from (
          select
            pa.id,
            pa.type,
            pa.inline_data,
            pa.url,
            pa.is_primary,
            pa.storage_mode,
            pa.file_name,
            pa.mime_type,
            pa.file_size_bytes,
            pa.created_at
          from product_assets pa
          where pa.product_id = p.id
          order by pa.is_primary desc, pa.created_at desc
          limit 4
        ) pa
      ) a on true
      left join link_counts lc on lc.hub_product_id = p.id
      where p.workspace_id = $1
      ${where}
      order by p.updated_at desc nulls last, p.created_at desc
      limit ${pageSize} offset ${offset}
    `;

    const countQuery = `
      select count(*) as total
      from products_hub p
      where p.workspace_id = $1
      ${where}
    `;

    const [itemsResult, countResult] = await Promise.all([
      db.query(itemsQuery, params),
      db.query(countQuery, params),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);
    return res.json({
      items: itemsResult.rows,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching product hub items:", error);
    return res.status(500).json({ error: "Failed to fetch product hub items", details: error?.message });
  }
});

router.post("/", async (req, res) => {
  const db = getPool();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    await ensureCatalogSchema();

    const { workspaceId } = req.query;
    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const payload = normalizeCatalogPayload(req.body || {});
    const images = normalizeImageInputs(req.body?.images);
    if (!payload.sku) {
      return res.status(400).json({ error: "sku is required" });
    }
    if (!payload.name) {
      return res.status(400).json({ error: "name is required" });
    }

    const hubId = randomUUID();
    const platformProductId = `HUB-${hubId.slice(0, 8).toUpperCase()}`;

    await client.query("begin");
    transactionStarted = true;

    await client.query(
      `
        insert into products_hub (
          id,
          workspace_id,
          platform,
          platform_product_id,
          sku,
          name,
          category,
          price,
          source,
          description,
          video_url,
          barcode,
          supplier,
          cost_price,
          stock_on_hand,
          stock_reserved,
          status,
          weight_kg,
          width_cm,
          height_cm,
          length_cm,
          notes,
          metadata,
          updated_at
        )
        values (
          $1, $2, 'hub', $3, $4, $5, $6, $7, 'manual', $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21::jsonb, now()
        )
      `,
      [
        hubId,
        workspaceId,
        platformProductId,
        payload.sku,
        payload.name,
        payload.category,
        payload.price,
        payload.description,
        payload.videoUrl,
        payload.barcode,
        payload.supplier,
        payload.costPrice,
        payload.stockOnHand,
        payload.stockReserved,
        payload.status,
        payload.weightKg,
        payload.widthCm,
        payload.heightCm,
        payload.lengthCm,
        payload.notes,
        JSON.stringify(payload.metadata || {}),
      ],
    );

    await syncProductImages(client, hubId, images, payload.primaryImageUrl);

    let createdMovement: InventoryMovementRecord | null = null;
    if (payload.stockOnHand > 0) {
      createdMovement = await insertInventoryMovement(client, workspaceId, hubId, {
        deltaQuantity: payload.stockOnHand,
        balanceBefore: 0,
        balanceAfter: payload.stockOnHand,
        movementType: "manual_adjustment",
        reason: "Cadastro inicial",
      });
    }

    await client.query("commit");
    transactionStarted = false;

    const product = await fetchHubProduct(db, workspaceId, hubId);
    return res.status(201).json({ product, inventoryMovement: createdMovement });
  } catch (error: any) {
    if (transactionStarted) {
      await client.query("rollback");
    }
    console.error("Error creating product hub item:", error);
    return res.status(500).json({ error: "Failed to create product", details: error?.message });
  } finally {
    client.release();
  }
});

router.get("/:id/linkable-listings", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { id } = req.params;
    const { workspaceId, search = "" } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const targetProduct = await db.query(
      `select id from products_hub where id = $1 and workspace_id = $2 limit 1`,
      [id, workspaceId],
    );
    if (targetProduct.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const params: any[] = [workspaceId, id];
    let clause = `
      where p.workspace_id = $1
        and p.ml_item_id is not null
        and coalesce(p.status, '') != 'deleted'
        and (p.hub_product_id is null or p.hub_product_id = $2)
    `;

    if (typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      const searchParam = `$${params.length}`;
      clause += ` and (p.title ilike ${searchParam} or p.sku ilike ${searchParam} or p.ml_item_id ilike ${searchParam})`;
    }

    const result = await db.query(
      `
        select
          p.id,
          p.ml_item_id,
          p.sku,
          p.title,
          p.price,
          p.available_quantity,
          p.status,
          p.ml_permalink,
          p.hub_product_id,
          p.updated_at
        from products p
        ${clause}
        order by p.updated_at desc nulls last, p.created_at desc
        limit 50
      `,
      params,
    );

    return res.json({ items: result.rows });
  } catch (error: any) {
    console.error("Error fetching linkable ML listings:", error);
    return res.status(500).json({ error: "Failed to fetch listings", details: error?.message });
  }
});

router.post("/:id/channel-links", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { id } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const hubProductResult = await db.query(
      `
        select id, stock_on_hand, stock_reserved
        from products_hub
        where id = $1 and workspace_id = $2
        limit 1
      `,
      [id, workspaceId],
    );

    if (hubProductResult.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const hubProduct = hubProductResult.rows[0];
    const channel = normalizeChannel(req.body?.channel);
    const internalProductId = normalizeText(req.body?.internalProductId);

    if (channel === "mercadolivre" && internalProductId) {
      const listingResult = await db.query(
        `
          select id, ml_item_id, sku, title, status, price, available_quantity, ml_permalink, hub_product_id
          from products
          where id = $1
            and workspace_id = $2
            and ml_item_id is not null
          limit 1
        `,
        [internalProductId, workspaceId],
      );

      if (listingResult.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const listing = listingResult.rows[0];
      if (listing.hub_product_id && listing.hub_product_id !== id) {
        return res.status(409).json({ error: "Listing already linked to another product" });
      }

      await db.query(
        `
          update products
          set hub_product_id = $1,
              updated_at = now()
          where id = $2
            and workspace_id = $3
        `,
        [id, internalProductId, workspaceId],
      );

      return res.status(201).json({
        link: {
          channel: "mercadolivre",
          source: "products",
          source_id: listing.id,
          internal_product_id: listing.id,
          external_listing_id: listing.ml_item_id,
          sku: listing.sku,
          title: listing.title,
          status: listing.status,
          price: listing.price,
          published_stock: listing.available_quantity,
          permalink: listing.ml_permalink,
          last_synced_at: null,
        },
      });
    }

    if (channel === "mercadolivre") {
      return res.status(400).json({ error: "Mercado Livre links must reference an internal product" });
    }

    const externalListingId = normalizeText(req.body?.externalListingId);
    if (!externalListingId) {
      return res.status(400).json({ error: "externalListingId is required" });
    }

    const existingLink = await db.query(
      `
        select id, hub_product_id
        from product_channel_listings
        where workspace_id = $1
          and channel = $2
          and external_listing_id = $3
        limit 1
      `,
      [workspaceId, channel, externalListingId],
    );

    if (existingLink.rowCount > 0 && existingLink.rows[0].hub_product_id !== id) {
      return res.status(409).json({ error: "Listing already linked to another product" });
    }

    const availableStock = computeAvailableStock(
      toInteger(hubProduct.stock_on_hand),
      toInteger(hubProduct.stock_reserved),
    );

    const { rows } = await db.query(
      `
        insert into product_channel_listings (
          workspace_id,
          hub_product_id,
          channel,
          source,
          internal_product_id,
          external_listing_id,
          sku,
          title,
          status,
          price,
          published_stock,
          permalink,
          metadata,
          updated_at
        )
        values ($1, $2, $3, 'manual', null, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
        on conflict (workspace_id, channel, external_listing_id)
        do update set
          hub_product_id = excluded.hub_product_id,
          sku = excluded.sku,
          title = excluded.title,
          status = excluded.status,
          price = excluded.price,
          published_stock = excluded.published_stock,
          permalink = excluded.permalink,
          metadata = excluded.metadata,
          updated_at = now()
        returning
          id as source_id,
          channel,
          source,
          internal_product_id,
          external_listing_id,
          sku,
          title,
          status,
          price,
          published_stock,
          permalink,
          last_synced_at,
          created_at,
          updated_at
      `,
      [
        workspaceId,
        id,
        channel,
        externalListingId,
        normalizeText(req.body?.sku),
        normalizeText(req.body?.title),
        normalizeText(req.body?.status),
        toNumberOrNull(req.body?.price),
        req.body?.publishedStock !== undefined
          ? Math.max(0, toInteger(req.body?.publishedStock))
          : availableStock,
        normalizeText(req.body?.permalink),
        JSON.stringify(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}),
      ],
    );

    return res.status(201).json({ link: rows[0] });
  } catch (error: any) {
    console.error("Error creating channel link:", error);
    return res.status(500).json({ error: "Failed to create link", details: error?.message });
  }
});

router.delete("/:id/channel-links/:linkId", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { id, linkId } = req.params;
    const { workspaceId, source = "manual" } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    if (String(source) === "products") {
      const result = await db.query(
        `
          update products
          set hub_product_id = null,
              updated_at = now()
          where id = $1
            and workspace_id = $2
            and hub_product_id = $3
          returning id
        `,
        [linkId, workspaceId, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Link not found" });
      }

      return res.json({ success: true });
    }

    const result = await db.query(
      `
        delete from product_channel_listings
        where id = $1
          and workspace_id = $2
          and hub_product_id = $3
        returning id
      `,
      [linkId, workspaceId, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Link not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting channel link:", error);
    return res.status(500).json({ error: "Failed to delete link", details: error?.message });
  }
});

router.post("/:id/inventory-adjustments", async (req, res) => {
  const db = getPool();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    await ensureCatalogSchema();

    const { id } = req.params;
    const { workspaceId } = req.query;
    const deltaQuantity = toInteger(req.body?.deltaQuantity);
    const reason = normalizeText(req.body?.reason) || "Ajuste manual";
    const notes = normalizeText(req.body?.notes);
    const syncChannels = req.body?.syncChannels !== false;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    if (deltaQuantity === 0) {
      return res.status(400).json({ error: "deltaQuantity must be different from zero" });
    }

    await client.query("begin");
    transactionStarted = true;

    const productResult = await client.query(
      `
        select id, stock_on_hand, stock_reserved
        from products_hub
        where id = $1 and workspace_id = $2
        for update
      `,
      [id, workspaceId],
    );

    if (productResult.rowCount === 0) {
      await client.query("rollback");
      transactionStarted = false;
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productResult.rows[0];
    const balanceBefore = toInteger(product.stock_on_hand);
    const balanceAfter = balanceBefore + deltaQuantity;

    if (balanceAfter < 0) {
      await client.query("rollback");
      transactionStarted = false;
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    const reserved = toInteger(product.stock_reserved);
    const previousAvailable = computeAvailableStock(balanceBefore, reserved);
    const nextAvailable = computeAvailableStock(balanceAfter, reserved);

    await client.query(
      `
        update products_hub
        set stock_on_hand = $1,
            updated_at = now()
        where id = $2
      `,
      [balanceAfter, id],
    );

    const movement = await insertInventoryMovement(client, workspaceId, id, {
      deltaQuantity,
      balanceBefore,
      balanceAfter,
      movementType: "manual_adjustment",
      reason,
      notes,
    });

    await client.query("commit");
    transactionStarted = false;

    let syncResults: StockSyncResult[] = [];
    if (syncChannels && previousAvailable !== nextAvailable) {
      syncResults = await syncHubProductStock(workspaceId, id, nextAvailable);
    }

    const refreshedProduct = await fetchHubProduct(db, workspaceId, id);
    return res.json({
      product: refreshedProduct,
      inventoryMovement: movement,
      syncResults,
    });
  } catch (error: any) {
    if (transactionStarted) {
      await client.query("rollback");
    }
    console.error("Error adjusting inventory:", error);
    return res.status(500).json({ error: "Failed to adjust inventory", details: error?.message });
  } finally {
    client.release();
  }
});

router.post("/:id/inventory-sync", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { id } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const product = await fetchHubProduct(db, workspaceId, id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const availableStock = computeAvailableStock(
      toInteger(product.stock_on_hand),
      toInteger(product.stock_reserved),
    );
    const syncResults = await syncHubProductStock(workspaceId, id, availableStock);
    return res.json({ availableStock, syncResults });
  } catch (error: any) {
    console.error("Error syncing inventory:", error);
    return res.status(500).json({ error: "Failed to sync inventory", details: error?.message });
  }
});

router.get("/lists", async (req, res) => {
  try {
    const db = getPool();
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    await ensurePurchaseListSchema();

    const listsQuery = `
      select
        l.id,
        l.name,
        l.created_at,
        l.updated_at,
        count(i.id) as items_count
      from product_hub_purchase_lists l
      left join product_hub_purchase_items i on i.list_id = l.id
      where l.workspace_id = $1
      group by l.id
      order by l.updated_at desc
    `;

    const result = await db.query(listsQuery, [workspaceId]);
    return res.json({ lists: result.rows });
  } catch (error: any) {
    console.error("Error fetching product hub purchase lists:", error);
    return res.status(500).json({ error: "Failed to fetch purchase lists", details: error?.message });
  }
});

router.post("/lists", async (req, res) => {
  try {
    const db = getPool();
    const { workspaceId } = req.query;
    const { name, items } = req.body || {};

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const listName = typeof name === "string" ? name.trim() : "";
    if (!listName) {
      return res.status(400).json({ error: "name is required" });
    }

    await ensurePurchaseListSchema();

    const listResult = await db.query(
      `
        insert into product_hub_purchase_lists (workspace_id, name)
        values ($1, $2)
        returning id, name, created_at, updated_at
      `,
      [workspaceId, listName],
    );

    const list = listResult.rows[0];
    const normalizedItems = Array.isArray(items) ? items : [];
    const productIds: string[] = [];
    const suggestions: Array<string | null> = [];
    const sizes: Array<string | null> = [];

    normalizedItems.forEach((item: any) => {
      const productId = String(item?.productId || "").trim();
      if (!productId) return;
      const suggestion = typeof item?.suggestion === "string" ? item.suggestion.trim() : "";
      const sizeValue = typeof item?.sizes === "string" ? item.sizes.trim() : "";
      productIds.push(productId);
      suggestions.push(suggestion || null);
      sizes.push(sizeValue || null);
    });

    if (productIds.length > 0) {
      await db.query(
        `
          insert into product_hub_purchase_items (list_id, product_id, suggestion, sizes)
          select $1, unnest($2::uuid[]), unnest($3::text[]), unnest($4::text[])
        `,
        [list.id, productIds, suggestions, sizes],
      );
    }

    return res.status(201).json({ list });
  } catch (error: any) {
    console.error("Error creating product hub purchase list:", error);
    return res.status(500).json({ error: "Failed to create purchase list", details: error?.message });
  }
});

router.put("/lists/:listId", async (req, res) => {
  const db = getPool();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    const { listId } = req.params;
    const { workspaceId } = req.query;
    const { name, items } = req.body || {};

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    await ensurePurchaseListSchema();

    const listCheck = await client.query(
      `select id from product_hub_purchase_lists where id = $1 and workspace_id = $2 limit 1`,
      [listId, workspaceId],
    );
    if (listCheck.rowCount === 0) {
      return res.status(404).json({ error: "List not found" });
    }

    await client.query("begin");
    transactionStarted = true;

    if (typeof name === "string" && name.trim()) {
      await client.query(
        `update product_hub_purchase_lists set name = $1, updated_at = now() where id = $2`,
        [name.trim(), listId],
      );
    }

    if (Array.isArray(items)) {
      await client.query(`delete from product_hub_purchase_items where list_id = $1`, [listId]);

      const productIds: string[] = [];
      const suggestions: Array<string | null> = [];
      const sizes: Array<string | null> = [];

      items.forEach((item: any) => {
        const productId = String(item?.productId || "").trim();
        if (!productId) return;
        const suggestion = typeof item?.suggestion === "string" ? item.suggestion.trim() : "";
        const sizeValue = typeof item?.sizes === "string" ? item.sizes.trim() : "";
        productIds.push(productId);
        suggestions.push(suggestion || null);
        sizes.push(sizeValue || null);
      });

      if (productIds.length > 0) {
        await client.query(
          `
            insert into product_hub_purchase_items (list_id, product_id, suggestion, sizes)
            select $1, unnest($2::uuid[]), unnest($3::text[]), unnest($4::text[])
          `,
          [listId, productIds, suggestions, sizes],
        );
      }
    }

    await client.query("commit");
    transactionStarted = false;
    return res.json({ success: true });
  } catch (error: any) {
    if (transactionStarted) {
      await client.query("rollback");
    }
    console.error("Error updating product hub purchase list:", error);
    return res.status(500).json({ error: "Failed to update purchase list", details: error?.message });
  } finally {
    client.release();
  }
});

router.get("/lists/:listId/items", async (req, res) => {
  try {
    const db = getPool();
    const { listId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    await ensurePurchaseListSchema();

    const itemsQuery = `
      with primary_image as (
        select distinct on (pa.product_id)
          pa.product_id,
          coalesce(pa.inline_data, pa.url) as url
        from product_assets pa
        where pa.type = 'image'
        order by pa.product_id, pa.is_primary desc, pa.created_at desc
      )
      select
        i.id,
        i.product_id,
        i.suggestion,
        i.sizes,
        p.name,
        p.sku,
        p.platform,
        p.platform_product_id,
        pi.url as image_url
      from product_hub_purchase_items i
      join product_hub_purchase_lists l on l.id = i.list_id
      join products_hub p on p.id = i.product_id
      left join primary_image pi on pi.product_id = p.id
      where i.list_id = $1 and l.workspace_id = $2
      order by p.name asc
    `;

    const result = await db.query(itemsQuery, [listId, workspaceId]);
    return res.json({ items: result.rows });
  } catch (error: any) {
    console.error("Error fetching product hub purchase list items:", error);
    return res.status(500).json({ error: "Failed to fetch purchase list items", details: error?.message });
  }
});

router.put("/:id", async (req, res) => {
  const db = getPool();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    await ensureCatalogSchema();

    const { id } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const existingResult = await client.query(
      `select * from products_hub where id = $1 and workspace_id = $2 limit 1`,
      [id, workspaceId],
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existing = existingResult.rows[0];
    const payload = normalizeCatalogPayload(req.body || {}, existing);
    const images = normalizeImageInputs(req.body?.images);

    if (!payload.sku) {
      return res.status(400).json({ error: "sku is required" });
    }
    if (!payload.name) {
      return res.status(400).json({ error: "name is required" });
    }

    const previousStock = toInteger(existing.stock_on_hand);
    const previousReserved = toInteger(existing.stock_reserved);
    const previousAvailable = computeAvailableStock(previousStock, previousReserved);
    const nextAvailable = computeAvailableStock(payload.stockOnHand, payload.stockReserved);
    const syncChannels = req.body?.syncChannels !== false;

    await client.query("begin");
    transactionStarted = true;

    await client.query(
      `
        update products_hub
        set
          sku = $1,
          name = $2,
          category = $3,
          price = $4,
          description = $5,
          video_url = $6,
          barcode = $7,
          supplier = $8,
          cost_price = $9,
          stock_on_hand = $10,
          stock_reserved = $11,
          status = $12,
          weight_kg = $13,
          width_cm = $14,
          height_cm = $15,
          length_cm = $16,
          notes = $17,
          metadata = $18::jsonb,
          updated_at = now()
        where id = $19
          and workspace_id = $20
      `,
      [
        payload.sku,
        payload.name,
        payload.category,
        payload.price,
        payload.description,
        payload.videoUrl,
        payload.barcode,
        payload.supplier,
        payload.costPrice,
        payload.stockOnHand,
        payload.stockReserved,
        payload.status,
        payload.weightKg,
        payload.widthCm,
        payload.heightCm,
        payload.lengthCm,
        payload.notes,
        JSON.stringify(payload.metadata || {}),
        id,
        workspaceId,
      ],
    );

    await syncProductImages(client, id, images, payload.primaryImageUrl);

    let inventoryMovement: InventoryMovementRecord | null = null;
    if (payload.stockOnHand !== previousStock) {
      inventoryMovement = await insertInventoryMovement(client, workspaceId, id, {
        deltaQuantity: payload.stockOnHand - previousStock,
        balanceBefore: previousStock,
        balanceAfter: payload.stockOnHand,
        movementType: "catalog_edit",
        reason: "Ajuste pela ficha do produto",
      });
    }

    await client.query("commit");
    transactionStarted = false;

    let syncResults: StockSyncResult[] = [];
    if (syncChannels && previousAvailable !== nextAvailable) {
      syncResults = await syncHubProductStock(workspaceId, id, nextAvailable);
    }

    const product = await fetchHubProduct(db, workspaceId, id);
    return res.json({ product, inventoryMovement, syncResults });
  } catch (error: any) {
    if (transactionStarted) {
      await client.query("rollback");
    }
    console.error("Error updating product hub item:", error);
    return res.status(500).json({ error: "Failed to update product", details: error?.message });
  } finally {
    client.release();
  }
});

router.get("/:id", async (req, res) => {
  try {
    await ensureCatalogSchema();

    const db = getPool();
    const { id } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const product = await fetchHubProduct(db, workspaceId, id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const [adsResult, channelLinksResult, inventoryResult] = await Promise.all([
      db.query(
        `
          select
            id,
            platform,
            platform_ad_id,
            platform_account_id,
            status,
            impressions,
            clicks,
            spend,
            permalink,
            last_seen_at,
            created_at,
            updated_at
          from product_ads
          where product_id = $1 and workspace_id = $2
          order by updated_at desc
        `,
        [id, workspaceId],
      ),
      db.query(
        `
          select
            'products'::text as source,
            p.id as source_id,
            p.id as internal_product_id,
            'mercadolivre'::text as channel,
            p.ml_item_id as external_listing_id,
            p.sku,
            p.title,
            p.status,
            p.price,
            p.available_quantity as published_stock,
            p.ml_permalink as permalink,
            p.last_synced_at,
            p.created_at,
            p.updated_at
          from products p
          where p.workspace_id = $1
            and p.hub_product_id = $2
            and p.ml_item_id is not null
            and coalesce(p.status, '') != 'deleted'

          union all

          select
            pcl.source,
            pcl.id as source_id,
            pcl.internal_product_id,
            pcl.channel,
            pcl.external_listing_id,
            pcl.sku,
            pcl.title,
            pcl.status,
            pcl.price,
            pcl.published_stock,
            pcl.permalink,
            pcl.last_synced_at,
            pcl.created_at,
            pcl.updated_at
          from product_channel_listings pcl
          where pcl.workspace_id = $1
            and pcl.hub_product_id = $2
            and (pcl.channel != 'mercadolivre' or pcl.internal_product_id is null)
          order by updated_at desc nulls last, created_at desc
        `,
        [workspaceId, id],
      ),
      db.query(
        `
          select
            id,
            movement_type,
            delta_quantity,
            balance_before,
            balance_after,
            reason,
            notes,
            created_at
          from inventory_movements
          where workspace_id = $1
            and hub_product_id = $2
          order by created_at desc
          limit 15
        `,
        [workspaceId, id],
      ),
    ]);

    return res.json({
      product,
      ads: adsResult.rows,
      channelLinks: channelLinksResult.rows,
      inventoryMovements: inventoryResult.rows,
    });
  } catch (error: any) {
    console.error("Error fetching product hub item:", error);
    return res.status(500).json({ error: "Failed to fetch product hub item", details: error?.message });
  }
});

export default router;

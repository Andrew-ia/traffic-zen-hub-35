import { Router } from "express";
import { getPool } from "../config/database.js";

const router = Router();
let purchaseListSchemaReady: Promise<void> | null = null;

async function ensurePurchaseListSchema() {
  if (purchaseListSchemaReady) return purchaseListSchemaReady;

  purchaseListSchemaReady = (async () => {
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
  })();

  return purchaseListSchemaReady;
}

router.get("/", async (req, res) => {
  try {
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
          pa.url as video_url
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
            'url', pa.url,
            'is_primary', pa.is_primary,
            'created_at', pa.created_at
          )
          order by pa.is_primary desc, pa.created_at desc
        ) as assets
        from product_assets pa
        where pa.product_id = p.id
      ) a on true
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
      [workspaceId, listName]
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
        [list.id, productIds, suggestions, sizes]
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
  try {
    const { listId } = req.params;
    const { workspaceId } = req.query;
    const { name, items } = req.body || {};

    if (!workspaceId || typeof workspaceId !== "string") {
      client.release();
      return res.status(400).json({ error: "workspaceId is required" });
    }

    await ensurePurchaseListSchema();

    const listCheck = await client.query(
      `select id from product_hub_purchase_lists where id = $1 and workspace_id = $2 limit 1`,
      [listId, workspaceId]
    );
    if (listCheck.rowCount === 0) {
      client.release();
      return res.status(404).json({ error: "List not found" });
    }

    await client.query("BEGIN");

    if (typeof name === "string" && name.trim()) {
      await client.query(
        `update product_hub_purchase_lists set name = $1, updated_at = now() where id = $2`,
        [name.trim(), listId]
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
          [listId, productIds, suggestions, sizes]
        );
      }
    }

    await client.query("COMMIT");
    client.release();
    return res.json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    client.release();
    console.error("Error updating product hub purchase list:", error);
    return res.status(500).json({ error: "Failed to update purchase list", details: error?.message });
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
          pa.url
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

router.get("/:id", async (req, res) => {
  try {
    const db = getPool();
    const { id } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const productQuery = `
      with first_video as (
        select distinct on (pa.product_id)
          pa.product_id,
          pa.url as video_url
        from product_assets pa
        where pa.type = 'video'
        order by pa.product_id, pa.is_primary desc, pa.created_at desc
      )
      select
        p.*,
        coalesce(p.video_url, fv.video_url) as video_url,
        coalesce(a.assets, '[]') as assets
      from products_hub p
      left join first_video fv on fv.product_id = p.id
      left join lateral (
        select json_agg(
          json_build_object(
            'id', pa.id,
            'type', pa.type,
            'url', pa.url,
            'is_primary', pa.is_primary,
            'metadata', pa.metadata,
            'created_at', pa.created_at
          )
          order by pa.is_primary desc, pa.created_at desc
        ) as assets
        from product_assets pa
        where pa.product_id = p.id
      ) a on true
      where p.id = $1 and p.workspace_id = $2
      limit 1
    `;

    const adsQuery = `
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
    `;

    const [productResult, adsResult] = await Promise.all([
      db.query(productQuery, [id, workspaceId]),
      db.query(adsQuery, [id, workspaceId]),
    ]);

    if (productResult.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      product: productResult.rows[0],
      ads: adsResult.rows,
    });
  } catch (error: any) {
    console.error("Error fetching product hub item:", error);
    return res.status(500).json({ error: "Failed to fetch product hub item", details: error?.message });
  }
});

export default router;

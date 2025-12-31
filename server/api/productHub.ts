import { Router } from "express";
import { getPool } from "../config/database.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const db = getPool();
    const { workspaceId, search = "", page = "1", limit = "50" } = req.query;

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
      filters.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.platform_product_id ILIKE $${idx})`);
      params.push(`%${search}%`);
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

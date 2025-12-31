import dotenv from "dotenv";
import { Pool } from "pg";
import { getPool, closeDatabasePool } from "../config/database.js";
import { getMercadoLivreCredentials, requestWithAuth } from "../api/integrations/mercadolivre.js";

dotenv.config({ path: ".env.local" });

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

type MlItem = {
  id: string;
  title: string;
  price: number;
  status: string;
  category_id?: string;
  permalink?: string;
  domain_id?: string;
  seller_id?: number;
  seller_custom_field?: string;
  variations?: Array<{ seller_custom_field?: string }>;
  attributes?: Array<{ id?: string; name?: string; value_id?: string; value_name?: string }>;
  pictures?: Array<{ url?: string; secure_url?: string; size?: string; max_size?: string }>;
  video_id?: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function extractSku(item: MlItem): string | null {
  const attrSku = (item.attributes || []).find(
    (a) => a.id === "SELLER_SKU" || a.id === "SKU" || a.name?.toLowerCase() === "sku"
  );
  if (attrSku?.value_name) return attrSku.value_name.trim();
  if (item.seller_custom_field) return item.seller_custom_field.trim();
  const variationSku = item.variations?.find((v) => v.seller_custom_field)?.seller_custom_field;
  if (variationSku) return variationSku.trim();
  return null;
}

async function fetchItemIds(workspaceId: string, userId: string, status: string): Promise<string[]> {
  let offset = 0;
  const limit = 50;
  const ids: string[] = [];
  let hasMore = true;

  while (hasMore) {
    const data = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/users/${userId}/items/search`, {
      params: { status, offset, limit },
    });
    const pageIds: string[] = data?.results || [];
    ids.push(...pageIds);

    offset += limit;
    const total = data?.paging?.total || 0;
    hasMore = offset < total && pageIds.length > 0;
  }

  return ids;
}

async function fetchItemsDetails(workspaceId: string, ids: string[]): Promise<MlItem[]> {
  const results: MlItem[] = [];
  const batches = chunk(ids, 20);

  for (const batch of batches) {
    const idsStr = batch.join(",");
    const items = await requestWithAuth<any[]>(workspaceId, `${MERCADO_LIVRE_API_BASE}/items`, {
      params: { ids: idsStr },
    });
    for (const item of items) {
      if (item?.code === 200 && item.body) {
        results.push(item.body as MlItem);
      }
    }
  }

  return results;
}

async function fetchItemDescription(workspaceId: string, id: string): Promise<string | null> {
  try {
    const data = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/items/${id}/description`);
    const text = data?.plain_text || data?.text || null;
    if (!text) return null;
    // Evita descrições extremamente longas
    return String(text).slice(0, 20000);
  } catch {
    return null;
  }
}

async function fetchItemVideoId(workspaceId: string, id: string): Promise<string | null> {
  // Tentativa adicional de pegar o video_id quando não vem no multiget
  try {
    const data = await requestWithAuth<any>(workspaceId, `${MERCADO_LIVRE_API_BASE}/items/${id}`, {
      params: { attributes: "video_id", fields: "id,video_id" },
    });
    const vid = data?.video_id;
    if (vid && typeof vid === "string" && vid.trim()) return vid.trim();
  } catch { /* ignore */ }
  return null;
}

async function getPlatformAccountId(pool: Pool, workspaceId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `select id from platform_accounts where workspace_id = $1 and platform_key = 'mercadolivre' limit 1`,
    [workspaceId]
  );
  return rows[0]?.id ?? null;
}

async function upsertProduct(pool: Pool, workspaceId: string, item: MlItem) {
  const sku = extractSku(item);
  const description = await fetchItemDescription(workspaceId, item.id);
  const videoId = (item as any).video_id || (item as any).videoId || null;
  const videoUrl = videoId ? (videoId.startsWith("http") ? videoId : `https://www.youtube.com/watch?v=${videoId}`) : null;
  const metadata = {
    permalink: item.permalink ?? null,
    domain_id: item.domain_id ?? null,
    seller_id: item.seller_id ?? null,
    status: item.status ?? null,
    attributes: item.attributes ?? [],
    video_id: videoId,
  };

  const { rows } = await pool.query(
    `
      insert into products_hub (
        workspace_id, platform, platform_product_id, sku, name, category, price, description, video_url, metadata, updated_at
      )
      values ($1, 'mercadolivre', $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
      on conflict (workspace_id, platform, platform_product_id)
      do update set
        sku = coalesce(excluded.sku, products_hub.sku),
        name = excluded.name,
        category = excluded.category,
        price = excluded.price,
        description = coalesce(excluded.description, products_hub.description),
        video_url = coalesce(excluded.video_url, products_hub.video_url),
        metadata = coalesce(products_hub.metadata, '{}'::jsonb) || excluded.metadata,
        updated_at = now()
      returning id
    `,
    [
      workspaceId,
      item.id,
      sku,
      item.title,
      item.category_id ?? null,
      item.price ?? null,
      description,
      videoUrl,
      JSON.stringify(metadata),
    ]
  );

  return rows[0].id as string;
}

async function upsertAssets(pool: Pool, productId: string, item: MlItem, workspaceId: string) {
  const pictures = item.pictures || [];
  for (let i = 0; i < pictures.length; i++) {
    const pic = pictures[i];
    const url = pic.url || pic.secure_url;
    if (!url) continue;
    await pool.query(
      `
        insert into product_assets (product_id, type, url, is_primary, metadata)
        values ($1, 'image', $2, $3, $4::jsonb)
        on conflict (product_id, url)
        do update set
          is_primary = product_assets.is_primary or excluded.is_primary,
          metadata = coalesce(product_assets.metadata, '{}'::jsonb) || excluded.metadata
      `,
      [productId, url, i === 0, JSON.stringify({ size: pic.size ?? null, max_size: pic.max_size ?? null })]
    );
  }

  let videoId = (item as any).video_id || (item as any).videoId || null;
  if (!videoId) {
    videoId = await fetchItemVideoId(workspaceId, item.id);
  }
  if (videoId) {
    const url = videoId.startsWith("http") ? videoId : `https://www.youtube.com/watch?v=${videoId}`;
    await pool.query(
      `
        insert into product_assets (product_id, type, url, is_primary, metadata)
        values ($1, 'video', $2, false, $3::jsonb)
        on conflict (product_id, url)
        do update set
          metadata = coalesce(product_assets.metadata, '{}'::jsonb) || excluded.metadata
      `,
      [productId, url, JSON.stringify({ video_id: videoId })]
    );
    await pool.query(
      `
        update products_hub
        set video_url = coalesce(products_hub.video_url, $2)
        where id = $1
      `,
      [productId, url]
    );
  }
}

async function upsertAd(
  pool: Pool,
  workspaceId: string,
  productId: string,
  platformAccountId: string | null,
  item: MlItem
) {
  await pool.query(
    `
      insert into product_ads (
        product_id, workspace_id, platform, platform_account_id, platform_ad_id, status, permalink, impressions, clicks, spend, last_seen_at, updated_at
      )
      values ($1, $2, 'mercadolivre', $3, $4, $5, $6, 0, 0, 0, now(), now())
      on conflict (workspace_id, platform, platform_ad_id)
      do update set
        product_id = excluded.product_id,
        platform_account_id = coalesce(excluded.platform_account_id, product_ads.platform_account_id),
        status = excluded.status,
        permalink = excluded.permalink,
        last_seen_at = now(),
        updated_at = now()
    `,
    [productId, workspaceId, platformAccountId, item.id, item.status ?? null, item.permalink ?? null]
  );
}

async function main() {
  const workspaceId =
    process.argv[2]?.trim() ||
    process.env.WORKSPACE_ID ||
    process.env.VITE_WORKSPACE_ID ||
    process.env.MERCADO_LIVRE_WORKSPACE_ID;

  if (!workspaceId) {
    console.error("⚠️  Informe o workspaceId: `npx tsx server/scripts/backfill-product-hub-ml.ts <workspace-uuid>`");
    process.exit(1);
  }

  const pool = getPool();

  const creds = await getMercadoLivreCredentials(workspaceId);
  if (!creds) {
    console.error("❌ Sem credenciais do Mercado Livre para o workspace informado.");
    process.exit(1);
  }

  console.log(`🔄 Coletando anúncios do ML (workspace ${workspaceId}, user ${creds.userId})...`);

  const [activeIds, pausedIds] = await Promise.all([
    fetchItemIds(workspaceId, creds.userId, "active"),
    fetchItemIds(workspaceId, creds.userId, "paused"),
  ]);
  const allIds = Array.from(new Set([...activeIds, ...pausedIds]));
  console.log(`🗂️  Encontrados ${allIds.length} anúncios (ativos + pausados).`);

  if (allIds.length === 0) {
    console.log("Nada para sincronizar.");
    await closeDatabasePool();
    return;
  }

  const items = await fetchItemsDetails(workspaceId, allIds);
  console.log(`📦 Detalhes baixados: ${items.length} itens.`);

  const platformAccountId = await getPlatformAccountId(pool, workspaceId);

  let success = 0;
  for (const item of items) {
    try {
      const productId = await upsertProduct(pool, workspaceId, item);
      await upsertAssets(pool, productId, item, workspaceId);
      await upsertAd(pool, workspaceId, productId, platformAccountId, item);
      success += 1;
    } catch (err) {
      console.error(`Erro ao processar item ${item.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`✅ Sync concluído. Produtos atualizados: ${success}/${items.length}.`);
  await closeDatabasePool();
}

main().catch(async (err) => {
  console.error("Falha geral no backfill:", err);
  await closeDatabasePool();
  process.exit(1);
});

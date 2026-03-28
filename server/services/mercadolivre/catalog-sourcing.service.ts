import axios from 'axios';
import { getPool } from '../../config/database.js';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': 'TrafficPro-CatalogSourcing/1.0',
};
const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_DELAY_MS = 220;
const DEFAULT_ANALYZE_LIMIT = 12;
const DEFAULT_MATCHES_PER_ITEM = 3;

type ImportRowInput = {
  supplierSku?: string | null;
  productName: string;
  costPrice: number;
  categoryHint?: string | null;
  rawPayload?: Record<string, unknown> | null;
};

type CreateImportPayload = {
  workspaceId?: string | null;
  supplierName: string;
  sourceFileName?: string | null;
  sourceType?: string | null;
  rows: ImportRowInput[];
};

type AnalyzeImportPayload = {
  importId: string;
  accessToken?: string;
  limit?: number;
  matchesPerItem?: number;
};

type SellerSummary = {
  nickname: string | null;
  reputationLevel: string | null;
  reputationScore: number | null;
  transactions: number | null;
  sellerType: 'official' | 'mercado_lider' | 'common';
};

type CatalogImportRow = {
  id: string;
  workspace_id: string | null;
  supplier_name: string;
  source_file_name: string | null;
  source_type: string;
  item_count: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type CatalogImportItemRow = {
  id: string;
  import_id: string;
  line_number: number;
  supplier_sku: string | null;
  product_name: string;
  normalized_name: string | null;
  search_term: string | null;
  category_hint: string | null;
  supplier_cost: string | number;
  raw_payload: any;
  status: string;
  approved_for_purchase: boolean;
  selected_match_ml_item_id: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CatalogMatchRow = {
  id: string;
  import_item_id: string;
  ml_item_id: string;
  title: string;
  price: string | number;
  sold_quantity: number;
  available_quantity: number;
  sales_per_day: string | number | null;
  permalink: string | null;
  thumbnail: string | null;
  date_created: string | null;
  ad_age_days: number | null;
  official_store_id: number | null;
  logistic_type: string | null;
  shipping_free_shipping: boolean;
  seller_id: string | null;
  seller_nickname: string | null;
  seller_reputation_level: string | null;
  seller_reputation_score: string | number | null;
  seller_transactions: number | null;
  seller_type: 'official' | 'mercado_lider' | 'common';
  match_score: string | number | null;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'e', 'em', 'por', 'the',
  'um', 'uma', 'kit', 'ml', 'mercado', 'livre', 'produto', 'item', 'modelo',
]);

const tokenize = (value: string) =>
  normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !STOPWORDS.has(token));

const generateSearchTerm = (name: string, sku?: string | null) => {
  const skuTokens = tokenize(sku || '').slice(0, 2);
  const nameTokens = tokenize(name).slice(0, 7);
  const merged = [...skuTokens, ...nameTokens].filter(Boolean);
  return merged.join(' ').trim() || name.trim();
};

const calculateAgeDays = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / DAY_MS));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const reputationScoreFromLevel = (level?: string | null) => {
  const normalized = String(level || '').toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('5_green')) return 100;
  if (normalized.includes('4_light_green')) return 88;
  if (normalized.includes('3_yellow')) return 72;
  if (normalized.includes('2_orange')) return 45;
  if (normalized.includes('1_red')) return 20;
  if (normalized.includes('new')) return 55;
  return 50;
};

const classifySellerType = (payload: any): 'official' | 'mercado_lider' | 'common' => {
  if (payload?.official_store_id) return 'official';
  const power = String(payload?.seller_reputation?.power_seller_status || '').toLowerCase();
  if (['platinum', 'gold', 'leader'].includes(power)) return 'mercado_lider';
  return 'common';
};

const scoreMatch = (productName: string, searchTerm: string, candidateTitle: string, soldQuantity: number, sellerType: string) => {
  const productTokens = new Set(tokenize(productName));
  const searchTokens = new Set(tokenize(searchTerm));
  const titleTokens = new Set(tokenize(candidateTitle));

  const productOverlap = [...productTokens].filter((token) => titleTokens.has(token)).length;
  const searchOverlap = [...searchTokens].filter((token) => titleTokens.has(token)).length;
  const productRatio = productTokens.size ? productOverlap / productTokens.size : 0;
  const searchRatio = searchTokens.size ? searchOverlap / searchTokens.size : 0;
  const demandScore = Math.min(30, Math.log10(Math.max(1, soldQuantity) + 1) * 10);
  const sellerPenalty = sellerType === 'official' ? -8 : sellerType === 'mercado_lider' ? -3 : 4;

  return Math.max(1, Math.round((productRatio * 45) + (searchRatio * 20) + demandScore + sellerPenalty));
};

export class CatalogSourcingService {
  private schemaEnsured = false;

  private buildHeaders(accessToken?: string) {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }

  private async ensureSchema() {
    if (this.schemaEnsured) return;
    const pool = getPool();
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_imports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id TEXT,
          supplier_name TEXT NOT NULL,
          source_file_name TEXT,
          source_type TEXT NOT NULL DEFAULT 'spreadsheet',
          item_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          import_id UUID NOT NULL REFERENCES ml_catalog_sourcing_imports(id) ON DELETE CASCADE,
          line_number INTEGER NOT NULL DEFAULT 0,
          supplier_sku TEXT,
          product_name TEXT NOT NULL,
          normalized_name TEXT,
          search_term TEXT,
          category_hint TEXT,
          supplier_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
          raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          status TEXT NOT NULL DEFAULT 'imported',
          approved_for_purchase BOOLEAN NOT NULL DEFAULT FALSE,
          selected_match_ml_item_id TEXT,
          analyzed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ml_catalog_sourcing_matches (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          import_item_id UUID NOT NULL REFERENCES ml_catalog_sourcing_items(id) ON DELETE CASCADE,
          ml_item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          sold_quantity INTEGER NOT NULL DEFAULT 0,
          available_quantity INTEGER NOT NULL DEFAULT 0,
          sales_per_day NUMERIC(12, 4),
          permalink TEXT,
          thumbnail TEXT,
          date_created TIMESTAMPTZ,
          ad_age_days INTEGER,
          official_store_id INTEGER,
          logistic_type TEXT,
          shipping_free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
          seller_id TEXT,
          seller_nickname TEXT,
          seller_reputation_level TEXT,
          seller_reputation_score NUMERIC(8, 2),
          seller_transactions INTEGER,
          seller_type TEXT,
          match_score NUMERIC(8, 2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(import_item_id, ml_item_id)
      );
    `);
    this.schemaEnsured = true;
  }

  async createImport(payload: CreateImportPayload) {
    await this.ensureSchema();
    const pool = getPool();

    const supplierName = String(payload.supplierName || '').trim();
    if (!supplierName) {
      throw new Error('Supplier name is required');
    }

    const rows = (payload.rows || []).filter((row) => String(row.productName || '').trim());
    if (!rows.length) {
      throw new Error('At least one catalog row is required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const importResult = await client.query<CatalogImportRow>(
        `
          INSERT INTO ml_catalog_sourcing_imports (
            workspace_id,
            supplier_name,
            source_file_name,
            source_type,
            item_count,
            status
          ) VALUES ($1, $2, $3, $4, $5, 'imported')
          RETURNING *
        `,
        [
          payload.workspaceId || null,
          supplierName,
          payload.sourceFileName || null,
          payload.sourceType || 'spreadsheet',
          rows.length,
        ],
      );

      const importId = importResult.rows[0].id;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        await client.query(
          `
            INSERT INTO ml_catalog_sourcing_items (
              import_id,
              line_number,
              supplier_sku,
              product_name,
              normalized_name,
              search_term,
              category_hint,
              supplier_cost,
              raw_payload
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `,
          [
            importId,
            index + 1,
            row.supplierSku || null,
            String(row.productName || '').trim(),
            normalizeText(row.productName),
            generateSearchTerm(row.productName, row.supplierSku),
            row.categoryHint || null,
            toFiniteNumber(row.costPrice),
            JSON.stringify(row.rawPayload || {}),
          ],
        );
      }

      await client.query('COMMIT');
      return this.getImportDetail(importId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listImports(workspaceId?: string | null) {
    await this.ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `
        SELECT
          i.*,
          COALESCE(stats.items_count, 0) AS items_count,
          COALESCE(stats.analyzed_count, 0) AS analyzed_count,
          COALESCE(stats.approved_count, 0) AS approved_count,
          COALESCE(stats.matched_count, 0) AS matched_count
        FROM ml_catalog_sourcing_imports i
        LEFT JOIN (
          SELECT
            import_id,
            COUNT(*) AS items_count,
            COUNT(*) FILTER (WHERE analyzed_at IS NOT NULL) AS analyzed_count,
            COUNT(*) FILTER (WHERE approved_for_purchase) AS approved_count,
            COUNT(*) FILTER (WHERE selected_match_ml_item_id IS NOT NULL) AS matched_count
          FROM ml_catalog_sourcing_items
          GROUP BY import_id
        ) stats ON stats.import_id = i.id
        WHERE ($1::text IS NULL OR i.workspace_id = $1::text)
        ORDER BY i.created_at DESC
      `,
      [workspaceId || null],
    );
    return result.rows;
  }

  private async fetchSeller(sellerId: string | null, headers: Record<string, string>, cache: Map<string, SellerSummary>) {
    if (!sellerId) {
      return {
        nickname: null,
        reputationLevel: null,
        reputationScore: null,
        transactions: null,
        sellerType: 'common' as const,
      };
    }

    if (cache.has(sellerId)) return cache.get(sellerId)!;

    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/users/${sellerId}`, { headers });
      const data = response.data || {};
      const summary: SellerSummary = {
        nickname: data.nickname || null,
        reputationLevel: data?.seller_reputation?.level_id || null,
        reputationScore: reputationScoreFromLevel(data?.seller_reputation?.level_id),
        transactions: data?.seller_reputation?.transactions?.completed || null,
        sellerType: classifySellerType(data),
      };
      cache.set(sellerId, summary);
      return summary;
    } catch {
      const fallback: SellerSummary = {
        nickname: null,
        reputationLevel: null,
        reputationScore: null,
        transactions: null,
        sellerType: 'common',
      };
      cache.set(sellerId, fallback);
      return fallback;
    }
  }

  private async fetchMatchesForItem(item: CatalogImportItemRow, accessToken?: string, maxMatches = DEFAULT_MATCHES_PER_ITEM) {
    const headers = this.buildHeaders(accessToken);
    const sellerCache = new Map<string, SellerSummary>();
    const query = String(item.search_term || item.product_name || '').trim();
    const searchResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
      params: {
        q: query,
        limit: Math.max(maxMatches * 2, 6),
      },
      headers,
    });

    const rawResults = Array.isArray(searchResponse.data?.results) ? searchResponse.data.results.slice(0, Math.max(maxMatches * 2, 6)) : [];
    const matches: any[] = [];

    for (const candidate of rawResults) {
      const mlItemId = String(candidate?.id || '').trim();
      if (!mlItemId) continue;

      const itemResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${mlItemId}`, { headers });
      const itemData = itemResponse.data || {};
      const seller = await this.fetchSeller(String(itemData?.seller_id || candidate?.seller?.id || ''), headers, sellerCache);
      const ageDays = calculateAgeDays(itemData?.date_created || null);
      const soldQuantity = toFiniteNumber(itemData?.sold_quantity ?? candidate?.sold_quantity, 0);
      const salesPerDay = ageDays && ageDays > 0 ? soldQuantity / Math.max(1, ageDays) : soldQuantity;
      const officialStoreId = itemData?.official_store_id || candidate?.official_store_id || null;
      const sellerType = officialStoreId ? 'official' : seller.sellerType;
      const score = scoreMatch(item.product_name, query, itemData?.title || candidate?.title || '', soldQuantity, sellerType);

      matches.push({
        ml_item_id: mlItemId,
        title: String(itemData?.title || candidate?.title || ''),
        price: toFiniteNumber(itemData?.price ?? candidate?.price),
        sold_quantity: soldQuantity,
        available_quantity: toFiniteNumber(itemData?.available_quantity, 0),
        sales_per_day: Number.isFinite(salesPerDay) ? Number(salesPerDay.toFixed(2)) : 0,
        permalink: itemData?.permalink || candidate?.permalink || null,
        thumbnail: itemData?.thumbnail || candidate?.thumbnail || null,
        date_created: itemData?.date_created || null,
        ad_age_days: ageDays,
        official_store_id: officialStoreId,
        logistic_type: itemData?.shipping?.logistic_type || null,
        shipping_free_shipping: Boolean(itemData?.shipping?.free_shipping ?? candidate?.shipping?.free_shipping),
        seller_id: String(itemData?.seller_id || candidate?.seller?.id || '') || null,
        seller_nickname: seller.nickname,
        seller_reputation_level: seller.reputationLevel,
        seller_reputation_score: seller.reputationScore,
        seller_transactions: seller.transactions,
        seller_type: sellerType,
        match_score: score,
      });

      await sleep(SEARCH_DELAY_MS);
    }

    return matches
      .sort((a, b) => (toFiniteNumber(b.match_score) - toFiniteNumber(a.match_score)) || (b.sold_quantity - a.sold_quantity))
      .slice(0, maxMatches);
  }

  async analyzeImport(payload: AnalyzeImportPayload) {
    await this.ensureSchema();
    const pool = getPool();
    const itemsResult = await pool.query<CatalogImportItemRow>(
      `
        SELECT *
        FROM ml_catalog_sourcing_items
        WHERE import_id = $1
        ORDER BY
          CASE WHEN selected_match_ml_item_id IS NULL THEN 0 ELSE 1 END,
          line_number ASC
        LIMIT $2
      `,
      [payload.importId, Math.max(1, Math.min(payload.limit || DEFAULT_ANALYZE_LIMIT, 30))],
    );

    const items = itemsResult.rows;
    for (const item of items) {
      let matches: any[] = [];
      try {
        matches = await this.fetchMatchesForItem(item, payload.accessToken, payload.matchesPerItem || DEFAULT_MATCHES_PER_ITEM);
      } catch (error) {
        await pool.query(
          `UPDATE ml_catalog_sourcing_items SET status = 'error', analyzed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [item.id],
        );
        continue;
      }

      await pool.query(`DELETE FROM ml_catalog_sourcing_matches WHERE import_item_id = $1`, [item.id]);

      for (const match of matches) {
        await pool.query(
          `
            INSERT INTO ml_catalog_sourcing_matches (
              import_item_id,
              ml_item_id,
              title,
              price,
              sold_quantity,
              available_quantity,
              sales_per_day,
              permalink,
              thumbnail,
              date_created,
              ad_age_days,
              official_store_id,
              logistic_type,
              shipping_free_shipping,
              seller_id,
              seller_nickname,
              seller_reputation_level,
              seller_reputation_score,
              seller_transactions,
              seller_type,
              match_score,
              updated_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()
            )
          `,
          [
            item.id,
            match.ml_item_id,
            match.title,
            match.price,
            match.sold_quantity,
            match.available_quantity,
            match.sales_per_day,
            match.permalink,
            match.thumbnail,
            match.date_created,
            match.ad_age_days,
            match.official_store_id,
            match.logistic_type,
            match.shipping_free_shipping,
            match.seller_id,
            match.seller_nickname,
            match.seller_reputation_level,
            match.seller_reputation_score,
            match.seller_transactions,
            match.seller_type,
            match.match_score,
          ],
        );
      }

      const selected = matches[0]?.ml_item_id || null;
      await pool.query(
        `
          UPDATE ml_catalog_sourcing_items
          SET
            status = $2,
            selected_match_ml_item_id = COALESCE(selected_match_ml_item_id, $3),
            analyzed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [item.id, selected ? 'matched' : 'no_match', selected],
      );

      await sleep(SEARCH_DELAY_MS);
    }

    await pool.query(
      `
        UPDATE ml_catalog_sourcing_imports
        SET
          status = 'analyzed',
          updated_at = NOW()
        WHERE id = $1
      `,
      [payload.importId],
    );

    return this.getImportDetail(payload.importId);
  }

  async selectMatch(itemId: string, mlItemId: string | null) {
    await this.ensureSchema();
    const pool = getPool();
    const status = mlItemId ? 'matched' : 'imported';
    await pool.query(
      `
        UPDATE ml_catalog_sourcing_items
        SET
          selected_match_ml_item_id = $2,
          status = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [itemId, mlItemId, status],
    );
  }

  async updateItem(itemId: string, updates: { approvedForPurchase?: boolean; status?: string | null }) {
    await this.ensureSchema();
    const pool = getPool();
    await pool.query(
      `
        UPDATE ml_catalog_sourcing_items
        SET
          approved_for_purchase = COALESCE($2, approved_for_purchase),
          status = COALESCE($3, status),
          updated_at = NOW()
        WHERE id = $1
      `,
      [itemId, updates.approvedForPurchase ?? null, updates.status || null],
    );
  }

  async getImportDetail(importId: string) {
    await this.ensureSchema();
    const pool = getPool();

    const importResult = await pool.query<CatalogImportRow>(
      `SELECT * FROM ml_catalog_sourcing_imports WHERE id = $1 LIMIT 1`,
      [importId],
    );
    if (!importResult.rows.length) {
      throw new Error('Catalog import not found');
    }

    const itemsResult = await pool.query<CatalogImportItemRow>(
      `SELECT * FROM ml_catalog_sourcing_items WHERE import_id = $1 ORDER BY line_number ASC`,
      [importId],
    );

    const matchesResult = itemsResult.rows.length
      ? await pool.query<CatalogMatchRow>(
          `SELECT * FROM ml_catalog_sourcing_matches WHERE import_item_id = ANY($1::uuid[]) ORDER BY match_score DESC, sold_quantity DESC`,
          [itemsResult.rows.map((item) => item.id)],
        )
      : { rows: [] as CatalogMatchRow[] };

    const matchesByItem = new Map<string, CatalogMatchRow[]>();
    for (const match of matchesResult.rows) {
      const current = matchesByItem.get(match.import_item_id) || [];
      current.push(match);
      matchesByItem.set(match.import_item_id, current);
    }

    const items = itemsResult.rows.map((item) => {
      const matches = matchesByItem.get(item.id) || [];
      const selectedMatch = item.selected_match_ml_item_id
        ? matches.find((match) => match.ml_item_id === item.selected_match_ml_item_id) || null
        : matches[0] || null;
      return {
        id: item.id,
        lineNumber: item.line_number,
        supplierSku: item.supplier_sku,
        productName: item.product_name,
        normalizedName: item.normalized_name,
        searchTerm: item.search_term,
        categoryHint: item.category_hint,
        supplierCost: toFiniteNumber(item.supplier_cost),
        rawPayload: item.raw_payload || {},
        status: item.status,
        approvedForPurchase: item.approved_for_purchase,
        selectedMatchMlItemId: item.selected_match_ml_item_id,
        analyzedAt: item.analyzed_at,
        matches: matches.map((match) => ({
          id: match.id,
          mlItemId: match.ml_item_id,
          title: match.title,
          price: toFiniteNumber(match.price),
          soldQuantity: toFiniteNumber(match.sold_quantity),
          availableQuantity: toFiniteNumber(match.available_quantity),
          salesPerDay: toFiniteNumber(match.sales_per_day),
          permalink: match.permalink,
          thumbnail: match.thumbnail,
          dateCreated: match.date_created,
          adAgeDays: match.ad_age_days,
          officialStoreId: match.official_store_id,
          logisticType: match.logistic_type,
          shippingFreeShipping: match.shipping_free_shipping,
          sellerId: match.seller_id,
          sellerNickname: match.seller_nickname,
          sellerReputationLevel: match.seller_reputation_level,
          sellerReputationScore: match.seller_reputation_score == null ? null : toFiniteNumber(match.seller_reputation_score),
          sellerTransactions: match.seller_transactions,
          sellerType: match.seller_type,
          matchScore: toFiniteNumber(match.match_score),
        })),
        selectedMatch: selectedMatch
          ? {
              id: selectedMatch.id,
              mlItemId: selectedMatch.ml_item_id,
              title: selectedMatch.title,
              price: toFiniteNumber(selectedMatch.price),
              soldQuantity: toFiniteNumber(selectedMatch.sold_quantity),
              availableQuantity: toFiniteNumber(selectedMatch.available_quantity),
              salesPerDay: toFiniteNumber(selectedMatch.sales_per_day),
              permalink: selectedMatch.permalink,
              thumbnail: selectedMatch.thumbnail,
              dateCreated: selectedMatch.date_created,
              adAgeDays: selectedMatch.ad_age_days,
              officialStoreId: selectedMatch.official_store_id,
              logisticType: selectedMatch.logistic_type,
              shippingFreeShipping: selectedMatch.shipping_free_shipping,
              sellerId: selectedMatch.seller_id,
              sellerNickname: selectedMatch.seller_nickname,
              sellerReputationLevel: selectedMatch.seller_reputation_level,
              sellerReputationScore: selectedMatch.seller_reputation_score == null ? null : toFiniteNumber(selectedMatch.seller_reputation_score),
              sellerTransactions: selectedMatch.seller_transactions,
              sellerType: selectedMatch.seller_type,
              matchScore: toFiniteNumber(selectedMatch.match_score),
            }
          : null,
      };
    });

    const summary = {
      totalItems: items.length,
      analyzedItems: items.filter((item) => item.analyzedAt).length,
      matchedItems: items.filter((item) => item.selectedMatch).length,
      approvedItems: items.filter((item) => item.approvedForPurchase).length,
      noMatchItems: items.filter((item) => item.status === 'no_match').length,
      averageCost: items.length ? items.reduce((sum, item) => sum + item.supplierCost, 0) / items.length : 0,
    };

    return {
      import: {
        id: importResult.rows[0].id,
        workspaceId: importResult.rows[0].workspace_id,
        supplierName: importResult.rows[0].supplier_name,
        sourceFileName: importResult.rows[0].source_file_name,
        sourceType: importResult.rows[0].source_type,
        itemCount: importResult.rows[0].item_count,
        status: importResult.rows[0].status,
        createdAt: importResult.rows[0].created_at,
        updatedAt: importResult.rows[0].updated_at,
      },
      summary,
      items,
    };
  }
}

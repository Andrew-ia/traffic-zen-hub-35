import axios from 'axios';
import { getPool } from '../../config/database.js';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': 'TrafficPro-ML-MarketResearch/1.0',
};
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 40;
const MAX_SCAN_LIMIT = 80;
const HIGHLIGHTS_PAGE_LIMIT = 10;
const MARKET_RESEARCH_CONCURRENCY = 2;
const MARKET_RESEARCH_STEP_DELAY_MS = 180;
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface MarketResearchRequest {
  workspaceId?: string | null;
  categoryId: string;
  subcategoryId?: string | null;
  searchTerm?: string | null;
  scanLimit?: number | null;
}

export interface MarketResearchTrend {
  keyword: string;
  url: string;
  position: number;
}

export interface MarketResearchCategory {
  id: string;
  name: string;
  total_items_in_this_category?: number | null;
}

export interface MarketResearchListing {
  id: string;
  title: string;
  price: number;
  sold_quantity: number;
  reviews_count: number;
  reviews_average: number | null;
  demand_source: 'sold_quantity' | 'reviews_proxy' | 'limited';
  available_quantity: number;
  permalink: string;
  thumbnail: string;
  category_id: string | null;
  category_name: string | null;
  date_created: string | null;
  ad_age_days: number | null;
  sales_per_day: number | null;
  official_store_id: number | null;
  logistic_type: string | null;
  shipping_free_shipping: boolean;
  seller_id: string | null;
  seller_nickname: string | null;
  seller_reputation_level: string | null;
  seller_reputation_score: number | null;
  seller_transactions: number | null;
  seller_power_seller_status: string | null;
  seller_type: 'official' | 'mercado_lider' | 'common';
  total_visits: number | null;
  competing_sellers_count?: number | null;
  source_category_id?: string | null;
  source_category_name?: string | null;
}

type MarketResearchSummary = {
  totalListings: number;
  scannedListings: number;
  uniqueSellers: number;
  officialStoresPct: number;
  fullPct: number;
  freeShippingPct: number;
  totalSoldQuantity: number;
  estimatedRevenue: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  averageListingAgeDays: number | null;
  averageSalesPerDay: number;
  averageSellerReputationScore: number | null;
  top10SellerSharePct: number;
  recentAcceleratorsCount: number;
  officialSoldSharePct: number;
};

type PersistableSummary = MarketResearchSummary & {
  dominantSellerType: string;
};

type CategoryMap = Map<string, MarketResearchCategory>;

type HighlightEntry = {
  id: string;
  position: number;
  type: 'ITEM' | 'PRODUCT';
  sourceCategoryId: string;
  sourceCategoryName: string | null;
};

type ItemReviewStats = {
  total: number;
  average: number | null;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const formatBrazilDateKey = (date: Date) => BRAZIL_DATE_FORMATTER.format(date);

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

const powerSellerStatuses = new Set(['platinum', 'gold', 'leader']);

export class MarketResearchService {
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

      CREATE TABLE IF NOT EXISTS ml_market_research_snapshots (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id TEXT,
          category_id TEXT NOT NULL,
          category_name TEXT,
          subcategory_id TEXT,
          subcategory_name TEXT,
          search_term TEXT,
          scan_limit INTEGER NOT NULL DEFAULT 120,
          total_listings INTEGER NOT NULL DEFAULT 0,
          scanned_listings INTEGER NOT NULL DEFAULT 0,
          sort_applied TEXT,
          filters JSONB NOT NULL DEFAULT '{}'::jsonb,
          summary JSONB NOT NULL DEFAULT '{}'::jsonb,
          generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ml_market_research_snapshots_workspace_generated
          ON ml_market_research_snapshots(workspace_id, generated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_ml_market_research_snapshots_category_generated
          ON ml_market_research_snapshots(category_id, generated_at DESC);

      CREATE TABLE IF NOT EXISTS ml_market_research_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          snapshot_id UUID NOT NULL REFERENCES ml_market_research_snapshots(id) ON DELETE CASCADE,
          ml_item_id TEXT NOT NULL,
          category_id TEXT,
          category_name TEXT,
          title TEXT NOT NULL,
          price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          sold_quantity INTEGER NOT NULL DEFAULT 0,
          available_quantity INTEGER NOT NULL DEFAULT 0,
          permalink TEXT,
          thumbnail TEXT,
          date_created TIMESTAMP WITH TIME ZONE,
          ad_age_days NUMERIC(12, 2),
          sales_per_day NUMERIC(12, 4),
          official_store_id INTEGER,
          logistic_type TEXT,
          shipping_free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
          seller_id TEXT,
          seller_nickname TEXT,
          seller_reputation_level TEXT,
          seller_reputation_score NUMERIC(8, 2),
          seller_transactions INTEGER,
          seller_power_seller_status TEXT,
          seller_type TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot
          ON ml_market_research_items(snapshot_id);

      CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot_sales
          ON ml_market_research_items(snapshot_id, sold_quantity DESC, sales_per_day DESC);

      CREATE INDEX IF NOT EXISTS idx_ml_market_research_items_snapshot_category
          ON ml_market_research_items(snapshot_id, category_id);
    `);
    this.schemaEnsured = true;
  }

  private normalizeProductId(id: string) {
    return String(id || '').trim().toUpperCase();
  }

  private normalizeCategory(category: any): MarketResearchCategory {
    return {
      id: String(category?.id || ''),
      name: String(category?.name || ''),
      total_items_in_this_category: category?.total_items_in_this_category ?? null,
    };
  }

  private calculateAgeDays(dateCreated: string | null) {
    if (!dateCreated) return null;
    const parsed = new Date(dateCreated);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / DAY_MS));
  }

  private async fetchCategory(categoryId: string, headers: Record<string, string>) {
    const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${categoryId}`, { headers });
    return response.data;
  }

  private async fetchTrends(categoryId: string, headers: Record<string, string>): Promise<MarketResearchTrend[]> {
    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/trends/MLB/${categoryId}`, { headers });
      const trends = Array.isArray(response.data) ? response.data : [];
      return trends.slice(0, 20).map((item: any, index: number) => ({
        keyword: String(item?.keyword || ''),
        url: String(item?.url || ''),
        position: index + 1,
      }));
    } catch (error) {
      console.warn('[MarketResearch] Falha ao buscar trends:', (error as any)?.message || error);
      return [];
    }
  }

  private async fetchCategoryMap(categoryIds: string[], headers: Record<string, string>) {
    const uniqueIds = Array.from(new Set(categoryIds.filter(Boolean)));
    const categoryMap: CategoryMap = new Map();

    await this.mapWithConcurrency(uniqueIds, MARKET_RESEARCH_CONCURRENCY, async (categoryId) => {
      try {
        const category = await this.fetchCategory(categoryId, headers);
        categoryMap.set(categoryId, this.normalizeCategory(category));
      } catch (error) {
        console.warn(`[MarketResearch] Falha ao carregar categoria ${categoryId}:`, (error as any)?.message || error);
      }
      return categoryId;
    });

    return categoryMap;
  }

  private async fetchHighlights(categoryId: string, headers: Record<string, string>): Promise<HighlightEntry[]> {
    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/highlights/MLB/category/${categoryId}`, { headers });
      const content = Array.isArray(response.data?.content) ? response.data.content : [];
      return content.slice(0, HIGHLIGHTS_PAGE_LIMIT)
        .filter((entry: any) => entry?.id && (entry?.type === 'ITEM' || entry?.type === 'PRODUCT'))
        .map((entry: any) => ({
          id: String(entry.id),
          position: Number(entry.position || 0),
          type: entry.type,
          sourceCategoryId: categoryId,
          sourceCategoryName: null,
        }));
    } catch (error) {
      console.warn(`[MarketResearch] Falha ao buscar highlights ${categoryId}:`, (error as any)?.message || error);
      return [];
    }
  }

  private buildHighlightsScanPlan(selectedCategory: any, includeChildren: boolean) {
    const children = Array.isArray(selectedCategory?.children_categories) ? selectedCategory.children_categories : [];
    const sortedChildren = children
      .map((child: any) => this.normalizeCategory(child))
      .sort((a, b) => Number(b.total_items_in_this_category || 0) - Number(a.total_items_in_this_category || 0))
      .slice(0, 4);

    const categories = [this.normalizeCategory(selectedCategory)];
    if (includeChildren) {
      categories.push(...sortedChildren);
    }

    return categories.filter((category, index, list) => list.findIndex((item) => item.id === category.id) === index);
  }

  private async collectHighlights(
    selectedCategory: any,
    scanLimit: number,
    headers: Record<string, string>,
    includeChildren: boolean
  ) {
    const categoriesToScan = this.buildHighlightsScanPlan(selectedCategory, includeChildren);
    const targetEntries = Math.min(MAX_SCAN_LIMIT * 3, Math.max(scanLimit * 3, scanLimit + 40));
    const dedupe = new Set<string>();
    const entries: HighlightEntry[] = [];

    for (const category of categoriesToScan) {
      const categoryEntries = await this.fetchHighlights(category.id, headers);
      categoryEntries.forEach((entry) => {
        const key = `${entry.type}:${entry.id}`;
        if (dedupe.has(key) || entries.length >= targetEntries) return;
        dedupe.add(key);
        entries.push({
          ...entry,
          sourceCategoryName: category.name,
        });
      });

      if (entries.length >= targetEntries) break;
    }

    return {
      entries,
      sampleTruncated: entries.length >= targetEntries,
      scannedCategories: categoriesToScan.length,
    };
  }

  private async fetchProductItems(productId: string, headers: Record<string, string>) {
    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/products/${productId}/items`, {
        headers,
        params: { limit: 10, offset: 0 },
      });

      return {
        total: Number(response.data?.paging?.total || 0),
        results: Array.isArray(response.data?.results) ? response.data.results : [],
      };
    } catch (error) {
      console.warn(`[MarketResearch] Falha ao buscar sellers do product ${productId}:`, (error as any)?.message || error);
      return {
        total: 0,
        results: [],
      };
    }
  }

  private async fetchProductDetail(productId: string, headers: Record<string, string>) {
    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/products/${productId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.warn(`[MarketResearch] Falha ao buscar detalhe do product ${productId}:`, (error as any)?.message || error);
      return null;
    }
  }

  private async fetchItemVisits(itemId: string, headers: Record<string, string>) {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - (30 * DAY_MS));

    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`, {
        headers,
        params: {
          date_from: formatBrazilDateKey(dateFrom),
          date_to: formatBrazilDateKey(dateTo),
        },
      });

      return Number(response.data?.total_visits || 0);
    } catch (error) {
      console.warn(`[MarketResearch] Falha ao buscar visits do item ${itemId}:`, (error as any)?.message || error);
      return null;
    }
  }

  private async fetchItemReviews(itemId: string, headers: Record<string, string>): Promise<ItemReviewStats> {
    try {
      const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/reviews/item/${itemId}`, {
        headers,
        params: { limit: 1, offset: 0 },
      });
      return {
        total: Number(response.data?.paging?.total || 0),
        average: Number.isFinite(Number(response.data?.rating_average))
          ? Number(response.data.rating_average)
          : null,
      };
    } catch (error) {
      console.warn(`[MarketResearch] Falha ao buscar reviews do item ${itemId}:`, (error as any)?.message || error);
      return {
        total: 0,
        average: null,
      };
    }
  }

  private async fetchSellerMap(sellerIds: string[], headers: Record<string, string>) {
    const uniqueIds = Array.from(new Set(sellerIds.filter(Boolean)));
    const sellerMap = new Map<string, any>();

    await this.mapWithConcurrency(uniqueIds, MARKET_RESEARCH_CONCURRENCY, async (sellerId) => {
      try {
        const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/users/${sellerId}`, { headers });
        sellerMap.set(String(sellerId), response.data);
      } catch (error) {
        console.warn(`[MarketResearch] Falha ao carregar seller ${sellerId}:`, (error as any)?.message || error);
      }
      return sellerId;
    });

    return sellerMap;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R | null>
  ) {
    const results = new Array<R | null>(items.length).fill(null);
    let cursor = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor++;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        if (MARKET_RESEARCH_STEP_DELAY_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, MARKET_RESEARCH_STEP_DELAY_MS));
        }
      }
    });

    await Promise.all(workers);
    return results.filter((item): item is R => item !== null);
  }

  private buildListingFromResolvedData(
    base: {
      id: string;
      title: string | null;
      price: number | null;
      soldQuantity: number | null;
      reviewsCount: number | null;
      reviewsAverage: number | null;
      demandSource: 'sold_quantity' | 'reviews_proxy' | 'limited';
      availableQuantity: number | null;
      permalink: string | null;
      thumbnail: string | null;
      categoryId: string | null;
      dateCreated: string | null;
      officialStoreId: number | null;
      logisticType: string | null;
      shippingFreeShipping: boolean;
      sellerId: string | null;
      sellerReputationLevel: string | null;
      sellerPowerSellerStatus: string | null;
      sourceCategoryId: string | null;
      sourceCategoryName: string | null;
      totalVisits: number | null;
      competingSellersCount: number | null;
    },
    seller: any,
    categoryMap: CategoryMap
  ): MarketResearchListing | null {
    if (!base.id || !base.title) return null;

    const categoryId = base.categoryId || null;
    const categoryName = categoryId ? categoryMap.get(categoryId)?.name || null : null;
    const officialStoreId = Number(base.officialStoreId || 0) || null;
    const reputationLevel =
      String(
        seller?.seller_reputation?.level_id ||
        base.sellerReputationLevel ||
        ''
      ) || null;
    const powerSellerStatus =
      String(
        seller?.seller_reputation?.power_seller_status ||
        base.sellerPowerSellerStatus ||
        ''
      ) || null;
    const sellerType: 'official' | 'mercado_lider' | 'common' =
      officialStoreId
        ? 'official'
        : powerSellerStatus && powerSellerStatuses.has(powerSellerStatus)
          ? 'mercado_lider'
          : 'common';
    const dateCreated = base.dateCreated || null;
    const adAgeDays = this.calculateAgeDays(dateCreated);
    const soldQuantity = toFiniteNumber(base.soldQuantity, 0);

    return {
      id: base.id,
      title: base.title,
      price: toFiniteNumber(base.price, 0),
      sold_quantity: soldQuantity,
      reviews_count: toFiniteNumber(base.reviewsCount, 0),
      reviews_average: base.reviewsAverage ?? null,
      demand_source: base.demandSource,
      available_quantity: toFiniteNumber(base.availableQuantity, 0),
      permalink: String(base.permalink || ''),
      thumbnail: String(base.thumbnail || ''),
      category_id: categoryId,
      category_name: categoryName,
      date_created: dateCreated,
      ad_age_days: adAgeDays,
      sales_per_day: adAgeDays !== null ? round(soldQuantity / Math.max(adAgeDays, 1), 4) : null,
      official_store_id: officialStoreId,
      logistic_type: base.logisticType || null,
      shipping_free_shipping: Boolean(base.shippingFreeShipping),
      seller_id: base.sellerId,
      seller_nickname: String(seller?.nickname || '') || null,
      seller_reputation_level: reputationLevel,
      seller_reputation_score: reputationScoreFromLevel(reputationLevel),
      seller_transactions: seller?.seller_reputation?.transactions?.total ?? null,
      seller_power_seller_status: powerSellerStatus,
      seller_type: sellerType,
      total_visits: base.totalVisits,
      competing_sellers_count: base.competingSellersCount,
      source_category_id: base.sourceCategoryId,
      source_category_name: base.sourceCategoryName,
    };
  }

  private computeSummary(listings: MarketResearchListing[], totalListings: number): PersistableSummary {
    const prices = listings.map((item) => item.price).filter((value) => Number.isFinite(value) && value > 0);
    const soldTotal = listings.reduce((sum, item) => sum + item.sold_quantity, 0);
    const revenueTotal = listings.reduce((sum, item) => sum + (item.price * item.sold_quantity), 0);
    const uniqueSellers = new Set(listings.map((item) => item.seller_id).filter(Boolean));
    const officialCount = listings.filter((item) => item.official_store_id).length;
    const fullCount = listings.filter((item) => item.logistic_type === 'fulfillment').length;
    const freeShippingCount = listings.filter((item) => item.shipping_free_shipping).length;
    const ageValues = listings.map((item) => item.ad_age_days).filter((value): value is number => value !== null);
    const speedValues = listings.map((item) => item.sales_per_day || 0).filter((value) => value > 0);
    const reputationValues = listings.map((item) => item.seller_reputation_score).filter((value): value is number => value !== null);

    const sellerSalesMap = new Map<string, number>();
    listings.forEach((item) => {
      if (!item.seller_id) return;
      sellerSalesMap.set(item.seller_id, (sellerSalesMap.get(item.seller_id) || 0) + item.sold_quantity);
    });
    const top10SellerShare = Array.from(sellerSalesMap.values())
      .sort((a, b) => b - a)
      .slice(0, 10)
      .reduce((sum, value) => sum + value, 0);

    const recentAccelerators = listings.filter((item) => {
      const age = item.ad_age_days ?? Number.POSITIVE_INFINITY;
      const speed = item.sales_per_day || 0;
      return age <= 60 && speed >= 0.8;
    }).length;

    const sellerTypeSales = listings.reduce<Record<string, number>>((acc, item) => {
      acc[item.seller_type] = (acc[item.seller_type] || 0) + item.sold_quantity;
      return acc;
    }, {});
    const dominantSellerType = Object.entries(sellerTypeSales)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'common';

    const officialSoldShare = listings
      .filter((item) => item.official_store_id)
      .reduce((sum, item) => sum + item.sold_quantity, 0);

    return {
      totalListings,
      scannedListings: listings.length,
      uniqueSellers: uniqueSellers.size,
      officialStoresPct: listings.length ? round((officialCount / listings.length) * 100, 1) : 0,
      fullPct: listings.length ? round((fullCount / listings.length) * 100, 1) : 0,
      freeShippingPct: listings.length ? round((freeShippingCount / listings.length) * 100, 1) : 0,
      totalSoldQuantity: soldTotal,
      estimatedRevenue: round(revenueTotal),
      averagePrice: prices.length ? round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0,
      minPrice: prices.length ? round(Math.min(...prices)) : 0,
      maxPrice: prices.length ? round(Math.max(...prices)) : 0,
      averageListingAgeDays: ageValues.length ? round(ageValues.reduce((sum, value) => sum + value, 0) / ageValues.length, 1) : null,
      averageSalesPerDay: speedValues.length ? round(speedValues.reduce((sum, value) => sum + value, 0) / speedValues.length, 2) : 0,
      averageSellerReputationScore: reputationValues.length ? round(reputationValues.reduce((sum, value) => sum + value, 0) / reputationValues.length, 1) : null,
      top10SellerSharePct: soldTotal > 0 ? round((top10SellerShare / soldTotal) * 100, 1) : 0,
      recentAcceleratorsCount: recentAccelerators,
      officialSoldSharePct: soldTotal > 0 ? round((officialSoldShare / soldTotal) * 100, 1) : 0,
      dominantSellerType,
    };
  }

  private buildSubcategoryBreakdown(listings: MarketResearchListing[], categoryMap: CategoryMap) {
    const buckets = new Map<string, {
      id: string;
      name: string;
      totalItems: number;
      listingsCount: number;
      soldQuantity: number;
      revenue: number;
      prices: number[];
      salesPerDay: number[];
      officialCount: number;
      fullCount: number;
    }>();

    listings.forEach((listing) => {
      const categoryId = listing.category_id || 'unknown';
      if (!buckets.has(categoryId)) {
        const category = categoryMap.get(categoryId);
        buckets.set(categoryId, {
          id: categoryId,
          name: category?.name || listing.category_name || 'Sem categoria',
          totalItems: category?.total_items_in_this_category || 0,
          listingsCount: 0,
          soldQuantity: 0,
          revenue: 0,
          prices: [],
          salesPerDay: [],
          officialCount: 0,
          fullCount: 0,
        });
      }

      const bucket = buckets.get(categoryId)!;
      bucket.listingsCount += 1;
      bucket.soldQuantity += listing.sold_quantity;
      bucket.revenue += listing.price * listing.sold_quantity;
      if (listing.price > 0) bucket.prices.push(listing.price);
      if ((listing.sales_per_day || 0) > 0) bucket.salesPerDay.push(listing.sales_per_day || 0);
      if (listing.official_store_id) bucket.officialCount += 1;
      if (listing.logistic_type === 'fulfillment') bucket.fullCount += 1;
    });

    return Array.from(buckets.values())
      .map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        total_items_in_this_category: bucket.totalItems || null,
        listings_count: bucket.listingsCount,
        sold_quantity: bucket.soldQuantity,
        estimated_revenue: round(bucket.revenue),
        average_price: bucket.prices.length ? round(bucket.prices.reduce((sum, value) => sum + value, 0) / bucket.prices.length) : 0,
        median_price: bucket.prices.length ? round(median(bucket.prices)) : 0,
        average_sales_per_day: bucket.salesPerDay.length ? round(bucket.salesPerDay.reduce((sum, value) => sum + value, 0) / bucket.salesPerDay.length, 2) : 0,
        official_pct: bucket.listingsCount ? round((bucket.officialCount / bucket.listingsCount) * 100, 1) : 0,
        full_pct: bucket.listingsCount ? round((bucket.fullCount / bucket.listingsCount) * 100, 1) : 0,
      }))
      .sort((a, b) => b.sold_quantity - a.sold_quantity);
  }

  private async persistSnapshot(payload: {
    workspaceId?: string | null;
    categoryId: string;
    categoryName: string;
    subcategoryId?: string | null;
    subcategoryName?: string | null;
    searchTerm?: string | null;
    scanLimit: number;
    totalListings: number;
    sortApplied: string;
    summary: PersistableSummary;
    listings: MarketResearchListing[];
  }) {
    await this.ensureSchema();
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const snapshotInsert = await client.query(
        `
          INSERT INTO ml_market_research_snapshots (
            workspace_id,
            category_id,
            category_name,
            subcategory_id,
            subcategory_name,
            search_term,
            scan_limit,
            total_listings,
            scanned_listings,
            sort_applied,
            filters,
            summary
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          RETURNING id
        `,
        [
          payload.workspaceId || null,
          payload.categoryId,
          payload.categoryName,
          payload.subcategoryId || null,
          payload.subcategoryName || null,
          payload.searchTerm || null,
          payload.scanLimit,
          payload.totalListings,
          payload.listings.length,
          payload.sortApplied,
          JSON.stringify({
            categoryId: payload.categoryId,
            subcategoryId: payload.subcategoryId || null,
            searchTerm: payload.searchTerm || null,
            scanLimit: payload.scanLimit,
          }),
          JSON.stringify(payload.summary),
        ]
      );

      const snapshotId = snapshotInsert.rows[0]?.id as string;

      for (const listing of payload.listings) {
        await client.query(
          `
            INSERT INTO ml_market_research_items (
              snapshot_id,
              ml_item_id,
              category_id,
              category_name,
              title,
              price,
              sold_quantity,
              available_quantity,
              permalink,
              thumbnail,
              date_created,
              ad_age_days,
              sales_per_day,
              official_store_id,
              logistic_type,
              shipping_free_shipping,
              seller_id,
              seller_nickname,
              seller_reputation_level,
              seller_reputation_score,
              seller_transactions,
              seller_power_seller_status,
              seller_type
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
            )
          `,
          [
            snapshotId,
            listing.id,
            listing.category_id,
            listing.category_name,
            listing.title,
            listing.price,
            listing.sold_quantity,
            listing.available_quantity,
            listing.permalink,
            listing.thumbnail,
            listing.date_created,
            listing.ad_age_days,
            listing.sales_per_day,
            listing.official_store_id,
            listing.logistic_type,
            listing.shipping_free_shipping,
            listing.seller_id,
            listing.seller_nickname,
            listing.seller_reputation_level,
            listing.seller_reputation_score,
            listing.seller_transactions,
            listing.seller_power_seller_status,
            listing.seller_type,
          ]
        );
      }

      await client.query('COMMIT');
      return snapshotId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runMarketResearch(request: MarketResearchRequest, accessToken?: string) {
    const headers = this.buildHeaders(accessToken);
    const categoryId = String(request.subcategoryId || request.categoryId || '').trim();
    const scanLimit = Math.max(20, Math.min(MAX_SCAN_LIMIT, toFiniteNumber(request.scanLimit, DEFAULT_SCAN_LIMIT)));
    const trimmedSearchTerm = String(request.searchTerm || '').trim() || null;

    const selectedCategory = await this.fetchCategory(categoryId, headers);
    const rootCategory = categoryId === request.categoryId
      ? selectedCategory
      : await this.fetchCategory(request.categoryId, headers);
    const trends = await this.fetchTrends(categoryId, headers);
    const highlightsData = await this.collectHighlights(
      selectedCategory,
      scanLimit,
      headers,
      !request.subcategoryId
    );

    const resolvedRows = await this.mapWithConcurrency(highlightsData.entries, MARKET_RESEARCH_CONCURRENCY, async (entry) => {
      if (entry.type !== 'PRODUCT') {
        return null;
      }

      const [productItems, productDetail] = await Promise.all([
        this.fetchProductItems(entry.id, headers),
        this.fetchProductDetail(entry.id, headers),
      ]);
      const representative = productItems.results[0];
      const itemId = String(representative?.item_id || '').trim();
      if (!itemId) return null;

      const [totalVisits, reviews] = await Promise.all([
        this.fetchItemVisits(itemId, headers),
        this.fetchItemReviews(itemId, headers),
      ]);

      const title =
        String(representative?.title || productDetail?.name || productDetail?.title || '').trim() || null;
      if (!title) return null;

      const soldQuantity = toFiniteNumber(
        representative?.sold_quantity ?? productDetail?.sold_quantity ?? reviews.total,
        0
      );
      const demandSource: 'sold_quantity' | 'reviews_proxy' | 'limited' =
        representative?.sold_quantity !== undefined && representative?.sold_quantity !== null
          ? 'sold_quantity'
          : reviews.total > 0
            ? 'reviews_proxy'
            : 'limited';
      const availableQuantity = toFiniteNumber(
        representative?.available_quantity ?? productDetail?.available_quantity,
        0
      );

      return {
        id: itemId,
        title,
        price: toFiniteNumber(representative?.price ?? productDetail?.price, 0),
        soldQuantity,
        reviewsCount: reviews.total,
        reviewsAverage: reviews.average,
        demandSource,
        availableQuantity,
        permalink: String(representative?.permalink || productDetail?.permalink || '') || null,
        thumbnail: String(
          representative?.thumbnail ||
          productDetail?.thumbnail ||
          productDetail?.picture ||
          productDetail?.thumbnail_id ||
          ''
        ) || null,
        categoryId: String(representative?.category_id || productDetail?.category_id || '') || null,
        dateCreated: String(representative?.date_created || productDetail?.date_created || '') || null,
        officialStoreId: Number(representative?.official_store_id || productDetail?.official_store_id || 0) || null,
        logisticType: String(representative?.shipping?.logistic_type || representative?.shipping?.mode || '') || null,
        shippingFreeShipping: Boolean(representative?.shipping?.free_shipping),
        sellerId: String(representative?.seller_id || '') || null,
        sellerReputationLevel: null,
        sellerPowerSellerStatus: null,
        sourceCategoryId: entry.sourceCategoryId,
        sourceCategoryName: entry.sourceCategoryName,
        totalVisits,
        competingSellersCount: productItems.total || productItems.results.length || null,
      };
    });

    const searchNormalized = trimmedSearchTerm?.toLocaleLowerCase('pt-BR') || null;
    const filteredResolvedRows = resolvedRows
      .filter((row) => !searchNormalized || row.title.toLocaleLowerCase('pt-BR').includes(searchNormalized))
      .slice(0, scanLimit);

    const categoryMap = await this.fetchCategoryMap(
      [
        categoryId,
        request.categoryId,
        ...filteredResolvedRows.map((item) => String(item.categoryId || '')),
      ],
      headers
    );

    const sellerMap = await this.fetchSellerMap(
      filteredResolvedRows.map((row) => String(row.sellerId || '')),
      headers
    );

    const listings = filteredResolvedRows
      .map((row) => this.buildListingFromResolvedData(row, sellerMap.get(String(row.sellerId || '')), categoryMap))
      .filter((listing): listing is MarketResearchListing => Boolean(listing?.id && listing?.title));

    const totalListings = Math.max(
      Number(selectedCategory?.total_items_in_this_category || 0),
      highlightsData.entries.length,
      listings.length,
    );
    const summary = this.computeSummary(listings, totalListings);
    const subcategories = this.buildSubcategoryBreakdown(listings, categoryMap);
    const snapshotId = await this.persistSnapshot({
      workspaceId: request.workspaceId || null,
      categoryId: String(request.categoryId),
      categoryName: String(rootCategory?.name || selectedCategory?.name || ''),
      subcategoryId: request.subcategoryId || null,
      subcategoryName: request.subcategoryId ? String(selectedCategory?.name || '') : null,
      searchTerm: trimmedSearchTerm,
      scanLimit,
      totalListings: summary.totalListings,
      sortApplied: 'highlights_api_safe',
      summary,
      listings,
    });

    return {
      snapshotId,
      generatedAt: new Date().toISOString(),
      query: {
        categoryId: String(request.categoryId),
        categoryName: String(rootCategory?.name || selectedCategory?.name || ''),
        subcategoryId: request.subcategoryId || null,
        subcategoryName: request.subcategoryId ? String(selectedCategory?.name || '') : null,
        searchTerm: trimmedSearchTerm,
        scanLimit,
        sortApplied: 'highlights_api_safe',
        totalListings: summary.totalListings,
        scannedListings: listings.length,
        sampleTruncated: highlightsData.sampleTruncated || resolvedRows.length > listings.length,
      },
      category: {
        id: String(rootCategory?.id || request.categoryId),
        name: String(rootCategory?.name || ''),
        path_from_root: Array.isArray(rootCategory?.path_from_root) ? rootCategory.path_from_root : [],
        children_categories: Array.isArray(rootCategory?.children_categories)
          ? rootCategory.children_categories.map((child: any) => this.normalizeCategory(child))
          : [],
      },
      selectedCategory: this.normalizeCategory(selectedCategory),
      trends,
      summary,
      subcategories,
      listings,
      notes: [
        'A amostra foi montada com highlights do Mercado Livre e enriquecimento apenas por APIs oficiais.',
        'Quando a API não expõe vendas exatas do anúncio, a prova social de reviews ajuda a validar tração sem usar raspagem pública.',
        request.subcategoryId
          ? 'A pesquisa ficou concentrada na subcategoria escolhida.'
          : `Foram incluídas as subcategorias líderes de ${String(selectedCategory?.name || rootCategory?.name || 'mercado')}.`,
        trimmedSearchTerm
          ? `O termo "${trimmedSearchTerm}" foi aplicado localmente sobre os anúncios coletados.`
          : `Foram analisados ${listings.length} anúncios da categoria selecionada.`,
      ],
      generatedAtBrazil: formatBrazilDateKey(new Date()),
    };
  }
}

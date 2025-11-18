import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface CreativeMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  lastMetricDate: string | null;
  platforms: string[];
}

export interface CreativeOverview {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  thumbnailUrl: string | null;
  storageUrl: string | null;
  textContent: string | null;
  aspectRatio: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  createdAt: string | null;
  metadata: Record<string, unknown> | null;
  adsCount: number;
  adSetsCount: number;
  campaignCount: number;
  campaignIds: string[]; // IDs das campanhas associadas
  metrics: CreativeMetrics;
}

export interface UseCreativeLibraryOptions {
  days?: number;
  platformKey?: string;
  onlyType?: 'video' | 'image';
  includeAssociations?: boolean;
  limit?: number;
}

interface CreativeAssetRow {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  storage_url: string | null;
  thumbnail_url: string | null;
  text_content: string | null;
  aspect_ratio: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  ads?: Array<{
    id: string;
    status: string | null;
    ad_set_id: string | null;
    ad_sets?: {
      id: string;
      campaign_id: string | null;
    } | null;
  }>;
}

interface CreativePerformanceRow {
  creative_id: string;
  metric_date: string;
  platform_key: string | null;
  spend: string | number | null;
  impressions: string | number | null;
  clicks: string | number | null;
  conversions: string | number | null;
  revenue: string | number | null;
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useCreativeLibrary(
  options: UseCreativeLibraryOptions = {},
): UseQueryResult<CreativeOverview[]> {
  const { days = 30, platformKey, onlyType, includeAssociations = true, limit = 200 } = options;

  return useQuery({
    queryKey: ["creatives", { days, platformKey }],
    queryFn: async (): Promise<CreativeOverview[]> => {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));

      const fromDate = start.toISOString().slice(0, 10);
      const toDate = end.toISOString().slice(0, 10);

      const baseSelect = `
            id,
            name,
            type,
            status,
            storage_url,
            thumbnail_url,
            text_content,
            aspect_ratio,
            duration_seconds,
            file_size_bytes,
            created_at,
            metadata
          `;
      const assocSelect = `,
            ads:ads (
              id,
              status,
              ad_set_id,
              ad_sets (
                id,
                campaign_id
              )
            )`;

      const creativeQuery = supabase
        .from("creative_assets")
        .select(includeAssociations ? baseSelect + assocSelect : baseSelect)
        .eq("workspace_id", WORKSPACE_ID)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (onlyType) {
        creativeQuery.eq("type", onlyType);
      }

      const performanceQuery = supabase
        .from("v_creative_performance")
        .select("creative_id, metric_date, platform_key, spend, impressions, clicks, conversions, revenue")
        .eq("workspace_id", WORKSPACE_ID)
        .gte("metric_date", fromDate)
        .lte("metric_date", toDate);

      if (platformKey && platformKey !== "all") {
        performanceQuery.eq("platform_key", platformKey);
      }

      const [{ data: creativeRows, error: creativeError }, { data: performanceRows, error: performanceError }] =
        await Promise.all([creativeQuery, performanceQuery]);

      if (creativeError) {
        console.error("Failed to load creative assets:", creativeError.message);
        throw creativeError;
      }

      if (performanceError) {
        console.error("Failed to load creative performance:", performanceError.message);
        throw performanceError;
      }

      const performanceByCreative = new Map<
        string,
        {
          spend: number;
          impressions: number;
          clicks: number;
          conversions: number;
          revenue: number;
          platforms: Set<string>;
          lastMetricDate: string | null;
        }
      >();

      for (const row of (performanceRows as CreativePerformanceRow[]) ?? []) {
        if (!row.creative_id) continue;
        const existing =
          performanceByCreative.get(row.creative_id) ??
          {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            platforms: new Set<string>(),
            lastMetricDate: null as string | null,
          };

        existing.spend += parseNumber(row.spend);
        existing.impressions += parseNumber(row.impressions);
        existing.clicks += parseNumber(row.clicks);
        existing.conversions += parseNumber(row.conversions);
        existing.revenue += parseNumber(row.revenue);
        if (row.platform_key) {
          existing.platforms.add(row.platform_key);
        }
        if (!existing.lastMetricDate || row.metric_date > existing.lastMetricDate) {
          existing.lastMetricDate = row.metric_date;
        }

        performanceByCreative.set(row.creative_id, existing);
      }

      return ((creativeRows as CreativeAssetRow[]) ?? []).map((creative) => {
        const metrics = performanceByCreative.get(creative.id) ?? {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          platforms: new Set<string>(),
          lastMetricDate: null as string | null,
        };

        const ads = creative.ads ?? [];
      const adIds = new Set<string>();
      const adSetIds = new Set<string>();
      const campaignIds = new Set<string>();

        for (const ad of ads) {
          if (ad?.id) {
            adIds.add(ad.id);
          }
          if (ad?.ad_set_id) {
            adSetIds.add(ad.ad_set_id);
          }
          const campaignId = ad?.ad_sets?.campaign_id;
          if (campaignId) {
            campaignIds.add(campaignId);
          }
        }

        const impressions = metrics.impressions;
        const clicks = metrics.clicks;
        const conversions = metrics.conversions;
        const spend = metrics.spend;
        const revenue = metrics.revenue;

        const ctr = impressions > 0 ? clicks / impressions * 100 : null;
        const cpc = clicks > 0 ? spend / clicks : null;
        const cpa = conversions > 0 ? spend / conversions : null;
        const roas = spend > 0 && revenue > 0 ? revenue / spend : null;

        return {
          id: creative.id,
          name: creative.name,
          type: creative.type,
          status: creative.status,
          thumbnailUrl: creative.thumbnail_url ?? null,
          storageUrl: creative.storage_url ?? null,
          textContent: creative.text_content ?? null,
          aspectRatio: creative.aspect_ratio ?? null,
          durationSeconds:
            creative.duration_seconds !== null && creative.duration_seconds !== undefined
              ? Number(creative.duration_seconds)
              : null,
          fileSizeBytes:
            creative.file_size_bytes !== null && creative.file_size_bytes !== undefined
              ? Number(creative.file_size_bytes)
              : null,
          createdAt: creative.created_at ?? null,
          metadata: creative.metadata ?? null,
          adsCount: adIds.size,
          adSetsCount: adSetIds.size,
          campaignCount: campaignIds.size,
          campaignIds: Array.from(campaignIds),
          metrics: {
            spend,
            impressions,
            clicks,
            conversions,
            revenue,
            ctr,
            cpc,
            cpa,
            roas,
            lastMetricDate: metrics.lastMetricDate,
            platforms: Array.from(metrics.platforms),
          },
        };
      });
    },
    staleTime: 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";
import type { CampaignStatusFilter } from "@/hooks/useCampaigns";

export interface PlatformMetrics {
  // Métricas principais
  totalSpend: number;
  totalResults: number;
  totalRevenue: number;
  avgRoas: number;
  avgCostPerResult: number;

  // Métricas secundárias
  reach?: number;
  impressions?: number;
  clicks?: number;
  cpm?: number;
  ctr?: number;
  cpc?: number;

  // Meta específico
  frequency?: number;
  linkClicks?: number;

  // Google específico
  qualityScore?: number;
  impressionShare?: number;

  // Dados agregados
  activeCampaigns: number;
  totalCampaigns: number;
}

interface UsePlatformMetricsParams {
  platform: "meta" | "google_ads";
  dateRange: number; // dias
  accountId?: string;
  status?: CampaignStatusFilter;
}

async function fetchPlatformMetrics({
  platform,
  dateRange,
  accountId,
  status,
}: UsePlatformMetricsParams): Promise<PlatformMetrics> {
  const params = new URLSearchParams({
    platform,
    days: dateRange.toString(),
  });

  if (accountId && accountId !== "all") {
    params.append("accountId", accountId);
  }

  if (status && status !== "all") {
    params.append("status", status);
  }

  const response = await fetch(`/api/metrics/aggregate?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch platform metrics");
  }

  return response.json();
}

export function usePlatformMetrics(params: UsePlatformMetricsParams) {
  return useQuery({
    queryKey: ["platform-metrics", params.platform, params.dateRange, params.accountId, params.status],
    queryFn: () => fetchPlatformMetrics(params),
    staleTime: 5 * 60 * 1000, // 5 minutos
    // Retornar dados mockados enquanto não há endpoint
    placeholderData: {
      totalSpend: 0,
      totalResults: 0,
      totalRevenue: 0,
      avgRoas: 0,
      avgCostPerResult: 0,
      impressions: 0,
      clicks: 0,
      cpm: 0,
      ctr: 0,
      cpc: 0,
      activeCampaigns: 0,
      totalCampaigns: 0,
    },
  });
}

export interface TimeSeriesDataPoint {
  date: string;
  spend: number;
  results: number;
  revenue: number;
  impressions: number;
  clicks: number;
}

interface UseTimeSeriesParams {
  platform: "meta" | "google_ads";
  dateRange: number;
  accountId?: string;
  metric: "spend" | "results" | "revenue" | "impressions" | "clicks";
  status?: CampaignStatusFilter;
}

async function fetchTimeSeries({
  platform,
  dateRange,
  accountId,
  metric,
  status,
}: UseTimeSeriesParams): Promise<TimeSeriesDataPoint[]> {
  const params = new URLSearchParams({
    platform,
    days: dateRange.toString(),
    metric,
  });

  if (accountId && accountId !== "all") {
    params.append("accountId", accountId);
  }

  if (status && status !== "all") {
    params.append("status", status);
  }

  const response = await fetch(`/api/metrics/timeseries?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch time series data");
  }

  return response.json();
}

export function useTimeSeries(params: UseTimeSeriesParams) {
  return useQuery({
    queryKey: ["timeseries", params.platform, params.dateRange, params.accountId, params.metric, params.status],
    queryFn: () => fetchTimeSeries(params),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });
}

// Dados demográficos
export interface DemographicDataPoint {
  name: string;
  value: number;
  percentage: number;
}

export interface DemographicData {
  ageData: DemographicDataPoint[];
  genderData: DemographicDataPoint[];
}

interface UseDemographicsParams {
  platform: "meta" | "google_ads";
  dateRange: number;
  accountId?: string;
}

async function fetchDemographics({
  platform,
  dateRange,
  accountId,
}: UseDemographicsParams): Promise<DemographicData> {
  const params = new URLSearchParams({
    platform,
    days: dateRange.toString(),
  });

  if (accountId && accountId !== "all") {
    params.append("accountId", accountId);
  }

  const response = await fetch(`/api/metrics/demographics?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch demographics data");
  }

  return response.json();
}

export function useDemographics(params: UseDemographicsParams) {
  return useQuery({
    queryKey: ["demographics", params.platform, params.dateRange, params.accountId],
    queryFn: () => fetchDemographics(params),
    staleTime: 5 * 60 * 1000,
    placeholderData: {
      ageData: [],
      genderData: [],
    },
  });
}

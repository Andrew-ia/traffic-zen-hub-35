import { useQuery } from "@tanstack/react-query";
import type { CampaignStatusFilter } from "@/hooks/useCampaigns";
import { resolveApiBase } from "@/lib/apiBase";

export interface PlatformMetrics {
  totalSpend: number;
  totalResults: number;
  totalRevenue: number;
  avgRoas: number;
  avgCostPerResult: number;
  reach?: number;
  impressions?: number;
  clicks?: number;
  cpm?: number;
  ctr?: number;
  cpc?: number;
  frequency?: number;
  linkClicks?: number;
  landingPageViews?: number;
  conversationsStarted?: number;
  buttonClicks?: number;
  engagements?: number;
  saves?: number;
  shares?: number;
  addToCart?: number;
  checkouts?: number;
  purchases?: number;
  qualityScore?: number;
  impressionShare?: number;
  activeCampaigns: number;
  totalCampaigns: number;
}

interface UsePlatformMetricsParams {
  platform: "meta" | "google_ads";
  dateRange: number;
  accountId?: string;
  status?: CampaignStatusFilter;
  objective?: string;
}

const API_BASE = resolveApiBase();

async function fetchPlatformMetrics(params: UsePlatformMetricsParams & { workspaceId: string }): Promise<PlatformMetrics> {
  const { platform, dateRange, accountId, status, objective, workspaceId } = params;
  const search = new URLSearchParams({ platform, days: dateRange.toString(), workspaceId });
  if (accountId && accountId !== "all") search.append("accountId", accountId);
  if (status && status !== "all") search.append("status", status);
  if (objective) search.append("objective", objective);

  const response = await fetch(`${API_BASE}/api/metrics/aggregate?${search.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch platform metrics");
  return response.json();
}

export function usePlatformMetrics(workspaceId: string | null, params: UsePlatformMetricsParams) {
  return useQuery({
    queryKey: ["platform-metrics", workspaceId, params.platform, params.dateRange, params.accountId, params.status, params.objective],
    enabled: !!workspaceId,
    queryFn: () => fetchPlatformMetrics({ ...params, workspaceId: workspaceId || "" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
      linkClicks: 0,
      landingPageViews: 0,
      conversationsStarted: 0,
      buttonClicks: 0,
      engagements: 0,
      saves: 0,
      shares: 0,
      addToCart: 0,
      checkouts: 0,
      purchases: 0,
      activeCampaigns: 0,
      totalCampaigns: 0,
    } satisfies PlatformMetrics,
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
  objective?: string;
}

async function fetchTimeSeries(params: UseTimeSeriesParams & { workspaceId: string }): Promise<TimeSeriesDataPoint[]> {
  const { platform, dateRange, accountId, metric, status, objective, workspaceId } = params;
  const search = new URLSearchParams({ platform, days: dateRange.toString(), metric, workspaceId });
  if (accountId && accountId !== "all") search.append("accountId", accountId);
  if (status && status !== "all") search.append("status", status);
  if (objective) search.append("objective", objective);

  const response = await fetch(`${API_BASE}/api/metrics/timeseries?${search.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch time series data");
  return response.json();
}

export function useTimeSeries(workspaceId: string | null, params: UseTimeSeriesParams) {
  return useQuery({
    queryKey: ["timeseries", workspaceId, params.platform, params.dateRange, params.accountId, params.metric, params.status, params.objective],
    enabled: !!workspaceId,
    queryFn: () => fetchTimeSeries({ ...params, workspaceId: workspaceId || "" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: [],
  });
}

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
  objective?: string;
}

async function fetchDemographics(params: UseDemographicsParams & { workspaceId: string }): Promise<DemographicData> {
  const { platform, dateRange, accountId, objective, workspaceId } = params;
  const search = new URLSearchParams({ platform, days: dateRange.toString(), workspaceId });
  if (accountId && accountId !== "all") search.append("accountId", accountId);
  if (objective) search.append("objective", objective);

  const response = await fetch(`${API_BASE}/api/metrics/demographics?${search.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch demographics data");
  return response.json();
}

export function useDemographics(workspaceId: string | null, params: UseDemographicsParams) {
  return useQuery({
    queryKey: ["demographics", workspaceId, params.platform, params.dateRange, params.accountId, params.objective],
    enabled: !!workspaceId,
    queryFn: () => fetchDemographics({ ...params, workspaceId: workspaceId || "" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: { ageData: [], genderData: [] },
  });
}

export interface ObjectiveMetrics {
  objective: string;
  resultLabel: string;
  campaignCount: number;
  totalSpend: number;
  totalResults: number;
  totalRevenue: number;
  avgRoas: number | null;
  avgCostPerResult: number | null;
}

interface UseMetricsByObjectiveParams {
  platform: "meta" | "google_ads";
  dateRange: number;
  accountId?: string;
  status?: CampaignStatusFilter;
}

async function fetchMetricsByObjective(params: UseMetricsByObjectiveParams & { workspaceId: string }): Promise<ObjectiveMetrics[]> {
  const { platform, dateRange, accountId, status, workspaceId } = params;
  const search = new URLSearchParams({ platform, days: dateRange.toString(), workspaceId });
  if (accountId && accountId !== "all") search.append("accountId", accountId);
  if (status && status !== "all") search.append("status", status);

  const response = await fetch(`${API_BASE}/api/metrics/aggregate-by-objective?${search.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch metrics by objective");
  return response.json();
}

export function useMetricsByObjective(workspaceId: string | null, params: UseMetricsByObjectiveParams) {
  return useQuery({
    queryKey: ["metrics-by-objective", workspaceId, params.platform, params.dateRange, params.accountId, params.status],
    enabled: !!workspaceId,
    queryFn: () => fetchMetricsByObjective({ ...params, workspaceId: workspaceId || "" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: [],
  });
}

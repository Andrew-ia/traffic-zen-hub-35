import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SyncInsightsSummary } from "@/types/sync";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

interface LatestInsightsResponse {
  summary: SyncInsightsSummary | null;
  jobId: string | null;
  completedAt: string | null;
}

async function fetchLatestInsights(workspaceId: string): Promise<LatestInsightsResponse> {
  const response = await fetch(`${API_BASE}/api/integrations/sync/workspace/${workspaceId}?limit=1`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load latest sync insights (${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error || "Failed to load latest sync insights");
  }

  const job = Array.isArray(payload.data) ? payload.data[0] : null;

  if (!job) {
    return {
      summary: null,
      jobId: null,
      completedAt: null,
    };
  }

  let result: unknown = job.result;

  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      result = null;
    }
  }

  const summary =
    typeof result === "object" && result !== null && "insights" in result
      ? (result as { insights?: SyncInsightsSummary }).insights
      : undefined;

  return {
    summary: summary ?? null,
    jobId: job.id ?? null,
    completedAt: job.completed_at ?? null,
  };
}

export function useLatestSyncInsights(workspaceId: string | null): UseQueryResult<LatestInsightsResponse> {
  return useQuery({
    queryKey: ["latest-sync-insights", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchLatestInsights(workspaceId || ""),
    staleTime: 60 * 1000,
  });
}

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { CampaignTableRow } from "@/components/campaigns/CampaignsTable";

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  paused: 1,
  archived: 2,
  completed: 3,
  draft: 4,
};

export type CampaignStatusFilter = "all" | "active" | "paused" | "archived" | "completed" | "draft";

export interface CampaignQueryOptions {
  status?: CampaignStatusFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface CampaignQueryRow {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
  platform_accounts: {
    name: string | null;
  } | null;
}

export interface CampaignQueryResult {
  campaigns: CampaignTableRow[];
  total: number;
}

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export function useCampaigns(options: CampaignQueryOptions = {}): UseQueryResult<CampaignQueryResult> {
  const {
    status = "all",
    search = "",
    page = 1,
    pageSize = 0, // 0 => fetch all
  } = options;

  return useQuery({
    queryKey: ["meta", "campaigns", status, search, page, pageSize],
    queryFn: async (): Promise<CampaignQueryResult> => {
      let query = supabase
        .from("campaigns")
        .select(
          `
            id,
            name,
            status,
            objective,
            daily_budget,
            lifetime_budget,
            start_date,
            end_date,
            updated_at,
            platform_accounts ( name )
          `,
          { count: "exact" },
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("source", "synced");

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      query = query.order("status", { ascending: true }).order("updated_at", { ascending: false });

      if (pageSize > 0) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Failed to load campaigns:", error.message);
        throw error;
      }

      const mapped: CampaignTableRow[] = (data as CampaignQueryRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        objective: row.objective,
        dailyBudget: row.daily_budget !== null && row.daily_budget !== undefined ? Number(row.daily_budget) : null,
        lifetimeBudget:
          row.lifetime_budget !== null && row.lifetime_budget !== undefined ? Number(row.lifetime_budget) : null,
        startDate: row.start_date,
        endDate: row.end_date,
        platformAccount: row.platform_accounts?.name ?? null,
        updatedAt: row.updated_at,
      }));

      const sorted = mapped.sort((a, b) => {
        const aStatus = STATUS_ORDER[a.status?.toLowerCase()] ?? 99;
        const bStatus = STATUS_ORDER[b.status?.toLowerCase()] ?? 99;
        if (aStatus !== bStatus) {
          return aStatus - bStatus;
        }
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      });

      const total = count ?? sorted.length;

      if (pageSize > 0) {
        return {
          campaigns: sorted.slice(0, pageSize),
          total,
        };
      }

      return { campaigns: sorted, total };
    },
  });
}

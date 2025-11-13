import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { CampaignTableRow } from "@/components/campaigns/CampaignsTable";
import type { CampaignKPIRow } from "@/types/kpi";

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
  platform?: string;
  objective?: string;
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
  // Supabase relationship select may return a single object or an array depending on FK setup
  platform_accounts:
    | {
        name: string | null;
        platform_key: string | null;
      }
    | {
        name: string | null;
        platform_key: string | null;
      }[]
    | null;
}

export interface CampaignQueryResult {
  campaigns: CampaignTableRow[];
  total: number;
}

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export function useCampaigns(options: CampaignQueryOptions = {}): UseQueryResult<CampaignQueryResult> {
  const {
    status = "all",
    search = "",
    page = 1,
    pageSize = 0, // 0 => fetch all
    platform = "all",
    objective = "all",
  } = options;

  return useQuery({
    queryKey: ["campaigns", platform, status, search, page, pageSize, objective],
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
            platform_accounts ( name, platform_key )
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

      if (objective !== "all") {
        query = query.eq("objective", objective);
      }

      // Filtro de platform precisa ser feito via platform_account_id + subquery
      // Não podemos filtrar diretamente por platform_accounts.platform_key no Supabase
      // Então vamos buscar os IDs das contas da plataforma primeiro
      if (platform !== "all") {
        const { data: platformAccounts } = await supabase
          .from("platform_accounts")
          .select("id")
          .eq("workspace_id", WORKSPACE_ID)
          .eq("platform_key", platform);

        const accountIds = (platformAccounts || []).map(acc => acc.id);
        if (accountIds.length > 0) {
          query = query.in("platform_account_id", accountIds);
        } else {
          // Se não há contas da plataforma, retornar vazio
          return { campaigns: [], total: 0 };
        }
      }

      query = query.order("status", { ascending: true }).order("updated_at", { ascending: false });

      if (pageSize > 0) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) {
        console.warn("Campaigns query failed, attempting fallback without join:", error.message);
        // Fallback: derive campaign_ids from KPI view for the requested platform
        // and then fetch campaigns without join/filter on platform.
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - 29);
        const fromDate = start.toISOString().slice(0, 10);
        const toDate = end.toISOString().slice(0, 10);

        let kpiQuery = supabase
          .from('v_campaign_kpi')
          .select('campaign_id')
          .eq('workspace_id', WORKSPACE_ID)
          .gte('metric_date', fromDate)
          .lte('metric_date', toDate);

        if (platform !== 'all') {
          kpiQuery = kpiQuery.eq('platform_key', platform);
        }

        const { data: kpiRows, error: kpiError } = await kpiQuery;

        if (kpiError) {
          console.error("Fallback KPI query failed:", kpiError.message);
          throw error; // rethrow original error
        }

        const campaignIds = Array.from(new Set((kpiRows ?? []).map((r: any) => r.campaign_id).filter(Boolean)));

        let fallbackQuery = supabase
          .from('campaigns')
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
              updated_at
            `,
            { count: 'exact' }
          )
          .eq('workspace_id', WORKSPACE_ID)
          .eq('source', 'synced');

        if (status !== 'all') {
          fallbackQuery = fallbackQuery.eq('status', status);
        }
        if (search) {
          fallbackQuery = fallbackQuery.ilike('name', `%${search}%`);
        }
        if (objective !== 'all') {
          fallbackQuery = fallbackQuery.eq('objective', objective);
        }
        if (campaignIds.length > 0) {
          fallbackQuery = fallbackQuery.in('id', campaignIds);
        }

        if (pageSize > 0) {
          const from = (page - 1) * pageSize;
          const to = from + pageSize - 1;
          fallbackQuery = fallbackQuery.range(from, to);
        }

        const fallback = await fallbackQuery;
        data = fallback.data as any[];
        count = fallback.count ?? (data?.length ?? 0);
      }

      // Fetch KPI metrics for the last 30 days
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      const fromDate = start.toISOString().slice(0, 10);
      const toDate = end.toISOString().slice(0, 10);

      const campaignIds = (data as CampaignQueryRow[]).map((row) => row.id);

      // Fetch KPI data from v_campaign_kpi view
      const { data: kpiData } = campaignIds.length > 0
        ? await supabase
            .from('v_campaign_kpi')
            .select('campaign_id, result_label, result_value, cost_per_result, spend, roas, instagram_follows')
            .eq('workspace_id', WORKSPACE_ID)
            .is('ad_set_id', null)
            .is('ad_id', null)
            .in('campaign_id', campaignIds)
            .gte('metric_date', fromDate)
            .lte('metric_date', toDate)
        : { data: [] };

      // Aggregate KPI by campaign
      const kpiByCampaign = new Map<string, {
        resultLabel: string;
        resultValue: number;
        costPerResult: number | null;
        spend: number;
        roas: number | null;
        instagramFollows: number;
      }>();

      for (const row of (kpiData as CampaignKPIRow[]) ?? []) {
        if (!row.campaign_id) continue;

        const existing = kpiByCampaign.get(row.campaign_id);
        if (!existing) {
          kpiByCampaign.set(row.campaign_id, {
            resultLabel: row.result_label,
            resultValue: row.result_value || 0,
            costPerResult: null,
            spend: row.spend || 0,
            roas: null,
            instagramFollows: (row as any).instagram_follows || 0,
          });
        } else {
          existing.resultValue += row.result_value || 0;
          existing.spend += row.spend || 0;
          existing.instagramFollows += (row as any).instagram_follows || 0;
          if (row.roas && row.revenue) {
            existing.roas = (existing.roas || 0) + row.roas;
          }
        }
      }

      // Calculate aggregated cost_per_result and average ROAS
      for (const kpi of kpiByCampaign.values()) {
        if (kpi.resultValue > 0) {
          kpi.costPerResult = kpi.spend / kpi.resultValue;
        }
      }

      const mapped: CampaignTableRow[] = (data as CampaignQueryRow[]).map((row) => {
        const paArray = Array.isArray(row.platform_accounts)
          ? row.platform_accounts
          : row.platform_accounts
            ? [row.platform_accounts]
            : [];
        const pa = platform !== 'all'
          ? (paArray.find((a) => a?.platform_key === platform) ?? paArray[0])
          : paArray[0];
        const kpi = kpiByCampaign.get(row.id);
        return {
          id: row.id,
          name: row.name,
          status: row.status,
          objective: row.objective,
          dailyBudget: row.daily_budget !== null && row.daily_budget !== undefined ? Number(row.daily_budget) : null,
          lifetimeBudget:
            row.lifetime_budget !== null && row.lifetime_budget !== undefined ? Number(row.lifetime_budget) : null,
          startDate: row.start_date,
          endDate: row.end_date,
          platformAccount: pa?.name ?? null,
          platformKey: pa?.platform_key ?? null,
          updatedAt: row.updated_at,

          // KPI metrics
          resultLabel: kpi?.resultLabel,
          resultValue: kpi?.resultValue,
          costPerResult: kpi?.costPerResult,
          spend: kpi?.spend,
          roas: kpi?.roas,
          instagramFollows: kpi?.instagramFollows,
        };
      });

      const filtered = platform === 'all' ? mapped : mapped.filter((c) => c.platformKey === platform);
      const sorted = filtered.sort((a, b) => {
        const aStatus = STATUS_ORDER[a.status?.toLowerCase()] ?? 99;
        const bStatus = STATUS_ORDER[b.status?.toLowerCase()] ?? 99;
        if (aStatus !== bStatus) {
          return aStatus - bStatus;
        }
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      });

      const total = count ?? filtered.length;

      // Do not slice here; range is already applied at the query level
      if (pageSize > 0) {
        return {
          campaigns: sorted,
          total,
        };
      }

      return { campaigns: sorted, total };
    },
  });
}

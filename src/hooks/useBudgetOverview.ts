import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

interface CampaignBudgetRow {
  platform_account_id: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  platform_accounts: {
    name: string | null;
  } | null;
}

interface MetricSpendRow {
  platform_account_id: string | null;
  spend: number | null;
}

export interface BudgetItem {
  platformAccountId: string;
  platformName: string;
  dailyBudget: number;
  lifetimeBudget: number;
  spend: number;
  utilization: number;
}

export interface BudgetOverview {
  totalDailyBudget: number;
  totalLifetimeBudget: number;
  totalSpend: number;
  availableBudget: number;
  utilization: number;
  items: BudgetItem[];
}

export function useBudgetOverview(): UseQueryResult<BudgetOverview> {
  return useQuery({
    queryKey: ["budget", "overview"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString().slice(0, 10);

      const [campaignRes, spendRes, accountsRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select(
            `
              platform_account_id,
              daily_budget,
              lifetime_budget,
              platform_accounts ( name )
            `,
          )
          .eq("workspace_id", WORKSPACE_ID)
          .eq("source", "synced"),
        supabase
          .from("performance_metrics")
          .select("platform_account_id, spend")
          .is("campaign_id", null)
          .is("ad_set_id", null)
          .is("ad_id", null)
          .eq("workspace_id", WORKSPACE_ID)
          .gte("metric_date", sinceIso),
        supabase
          .from("platform_accounts")
          .select("id, name")
          .eq("workspace_id", WORKSPACE_ID),
      ]);

      if (campaignRes.error) {
        console.error("Failed to load budgets from campaigns", campaignRes.error.message);
        throw campaignRes.error;
      }
      if (spendRes.error) {
        console.error("Failed to load spend metrics", spendRes.error.message);
        throw spendRes.error;
      }
      if (accountsRes.error) {
        console.error("Failed to load platform accounts", accountsRes.error.message);
        throw accountsRes.error;
      }

      const accountNameMap = new Map<string, string>();
      for (const account of accountsRes.data ?? []) {
        if (account.id) {
          accountNameMap.set(account.id, account.name ?? account.id);
        }
      }

      const itemsByAccount = new Map<string, BudgetItem>();

      for (const row of (campaignRes.data as CampaignBudgetRow[]) ?? []) {
        if (!row.platform_account_id) continue;
        const existing = itemsByAccount.get(row.platform_account_id) ?? {
          platformAccountId: row.platform_account_id,
          platformName:
            accountNameMap.get(row.platform_account_id) ?? row.platform_accounts?.name ?? row.platform_account_id,
          dailyBudget: 0,
          lifetimeBudget: 0,
          spend: 0,
          utilization: 0,
        };

        existing.dailyBudget += Number(row.daily_budget ?? 0);
        existing.lifetimeBudget += Number(row.lifetime_budget ?? 0);

        itemsByAccount.set(row.platform_account_id, existing);
      }

      for (const row of (spendRes.data as MetricSpendRow[]) ?? []) {
        if (!row.platform_account_id) continue;
        const existing = itemsByAccount.get(row.platform_account_id);
        if (!existing) continue;
        existing.spend += Number(row.spend ?? 0);
      }

      const items: BudgetItem[] = Array.from(itemsByAccount.values()).map((item) => {
        const capacity = item.lifetimeBudget > 0 ? item.lifetimeBudget : item.dailyBudget * 30;
        const utilization = capacity > 0 ? Math.min((item.spend / capacity) * 100, 100) : 0;
        return {
          ...item,
          utilization,
        };
      });

      const totalDailyBudget = items.reduce((acc, item) => acc + item.dailyBudget, 0);
      const totalLifetimeBudget = items.reduce((acc, item) => acc + item.lifetimeBudget, 0);
      const totalSpend = items.reduce((acc, item) => acc + item.spend, 0);

      const normalizedBudget = totalLifetimeBudget > 0 ? totalLifetimeBudget : totalDailyBudget * 30;
      const availableBudget = Math.max(normalizedBudget - totalSpend, 0);
      const utilization = normalizedBudget > 0 ? Math.min((totalSpend / normalizedBudget) * 100, 100) : 0;

      const sortedItems = items.sort((a, b) => b.dailyBudget - a.dailyBudget);

      return {
        totalDailyBudget,
        totalLifetimeBudget: normalizedBudget,
        totalSpend,
        availableBudget,
        utilization,
        items: sortedItems,
      };
    },
  });
}

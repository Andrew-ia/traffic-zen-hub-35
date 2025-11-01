import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface CampaignDetail {
  id: string;
  externalId: string | null;
  name: string;
  status: string;
  objective: string | null;
  source: string;
  startDate: string | null;
  endDate: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  targeting: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  updatedAt: string | null;
  platformAccount: {
    id: string;
    name: string | null;
    externalId: string | null;
    currency: string | null;
    timezone: string | null;
  } | null;
}

export interface CampaignAd {
  id: string;
  externalId: string | null;
  name: string;
  status: string;
  lastSyncedAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CampaignAdSet {
  id: string;
  externalId: string | null;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  bidStrategy: string | null;
  bidAmount: number | null;
  budgetType: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  targeting: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  updatedAt: string | null;
  ads: CampaignAd[];
}

export interface CampaignDetailsResult {
  campaign: CampaignDetail | null;
  adSets: CampaignAdSet[];
}

export function useCampaignDetails(campaignId?: string): UseQueryResult<CampaignDetailsResult> {
  return useQuery({
    queryKey: ["campaign", campaignId, "details"],
    enabled: Boolean(campaignId),
    queryFn: async (): Promise<CampaignDetailsResult> => {
      if (!campaignId) {
        throw new Error("Missing campaign id");
      }

      const { data: campaignRow, error: campaignError } = await supabase
        .from("campaigns")
        .select(
          `
            id,
            external_id,
            name,
            status,
            objective,
            source,
            start_date,
            end_date,
            daily_budget,
            lifetime_budget,
            targeting,
            settings,
            last_synced_at,
            updated_at,
            platform_accounts:platform_accounts (
              id,
              name,
              external_id,
              currency,
              timezone
            )
          `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError) {
        console.error("Failed to load campaign details:", campaignError.message);
        throw campaignError;
      }

      if (!campaignRow) {
        return {
          campaign: null,
          adSets: [],
        };
      }

      const { data: adSetRows, error: adSetsError } = await supabase
        .from("ad_sets")
        .select(
          `
            id,
            external_id,
            name,
            status,
            start_date,
            end_date,
            bid_strategy,
            bid_amount,
            budget_type,
            daily_budget,
            lifetime_budget,
            targeting,
            settings,
            last_synced_at,
            updated_at,
            ads:ads (
              id,
              external_id,
              name,
              status,
              metadata,
              last_synced_at,
              updated_at
            )
          `,
        )
        .eq("campaign_id", campaignId)
        .order("name", { ascending: true });

      if (adSetsError) {
        console.error("Failed to load ad sets for campaign:", adSetsError.message);
        throw adSetsError;
      }

      const campaign: CampaignDetail = {
        id: campaignRow.id,
        externalId: campaignRow.external_id ?? null,
        name: campaignRow.name,
        status: campaignRow.status,
        objective: campaignRow.objective ?? null,
        source: campaignRow.source,
        startDate: campaignRow.start_date ?? null,
        endDate: campaignRow.end_date ?? null,
        dailyBudget: campaignRow.daily_budget !== null ? Number(campaignRow.daily_budget) : null,
        lifetimeBudget: campaignRow.lifetime_budget !== null ? Number(campaignRow.lifetime_budget) : null,
        targeting: (campaignRow.targeting ?? null) as Record<string, unknown> | null,
        settings: (campaignRow.settings ?? null) as Record<string, unknown> | null,
        lastSyncedAt: campaignRow.last_synced_at ?? null,
        updatedAt: campaignRow.updated_at ?? null,
        platformAccount: campaignRow.platform_accounts
          ? {
              id: campaignRow.platform_accounts.id,
              name: campaignRow.platform_accounts.name ?? null,
              externalId: campaignRow.platform_accounts.external_id ?? null,
              currency: campaignRow.platform_accounts.currency ?? null,
              timezone: campaignRow.platform_accounts.timezone ?? null,
            }
          : null,
      };

      const adSets: CampaignAdSet[] = (adSetRows ?? []).map((row) => ({
        id: row.id,
        externalId: row.external_id ?? null,
        name: row.name,
        status: row.status,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        bidStrategy: row.bid_strategy ?? null,
        bidAmount: row.bid_amount !== null ? Number(row.bid_amount) : null,
        budgetType: row.budget_type ?? null,
        dailyBudget: row.daily_budget !== null ? Number(row.daily_budget) : null,
        lifetimeBudget: row.lifetime_budget !== null ? Number(row.lifetime_budget) : null,
        targeting: (row.targeting ?? null) as Record<string, unknown> | null,
        settings: (row.settings ?? null) as Record<string, unknown> | null,
        lastSyncedAt: row.last_synced_at ?? null,
        updatedAt: row.updated_at ?? null,
        ads: (row.ads ?? []).map((ad) => ({
          id: ad.id,
          externalId: ad.external_id ?? null,
          name: ad.name,
          status: ad.status,
          metadata: (ad.metadata ?? null) as Record<string, unknown> | null,
          lastSyncedAt: ad.last_synced_at ?? null,
          updatedAt: ad.updated_at ?? null,
        })),
      }));

      return {
        campaign,
        adSets,
      };
    },
  });
}

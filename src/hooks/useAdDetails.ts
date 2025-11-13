import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface AdDetail {
  id: string;
  externalId: string | null;
  name: string;
  status: string;
  metadata: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  updatedAt: string | null;
  platformAccountId: string;
  adSet: {
    id: string;
    name: string;
    status: string;
  } | null;
  campaign: {
    id: string;
    name: string;
    status: string;
  } | null;
  platformAccount: {
    id: string;
    name: string | null;
    currency: string | null;
    timezone: string | null;
  } | null;
  creative: {
    id: string;
    type: string;
    name: string;
    storageUrl: string | null;
    thumbnailUrl: string | null;
    metadata: Record<string, unknown> | null;
    textContent: string | null;
    durationSeconds: number | null;
    aspectRatio: string | null;
  } | null;
}

export interface AdDetailsResult {
  ad: AdDetail | null;
}

export function useAdDetails(adId?: string): UseQueryResult<AdDetailsResult> {
  return useQuery({
    queryKey: ["ad", adId, "details"],
    enabled: Boolean(adId),
    queryFn: async (): Promise<AdDetailsResult> => {
      if (!adId) {
        throw new Error("Missing ad id");
      }

      const { data, error } = await supabase
        .from("ads")
        .select(
          `
            id,
            external_id,
            name,
            status,
            metadata,
            last_synced_at,
            updated_at,
            platform_account_id,
            ad_set_id,
            creative_asset_id,
            ad_sets (
              id,
              name,
              status,
              campaign_id,
              campaigns!ad_sets_campaign_id_fkey (
                id,
                name,
                status,
                workspace_id,
                platform_account_id,
                platform_accounts!campaigns_platform_account_id_fkey (
                  id,
                  name,
                  currency,
                  timezone
                )
              )
            ),
            creative_assets (
              id,
              type,
              name,
              storage_url,
              thumbnail_url,
              metadata,
              text_content,
              duration_seconds,
              aspect_ratio
            )
          `,
        )
        .eq("id", adId)
        .eq("ad_sets.campaigns.workspace_id", WORKSPACE_ID)
        .maybeSingle();

      if (error) {
        console.error("Failed to load ad details:", error.message);
        throw error;
      }

      if (!data) {
        return { ad: null };
      }

      const campaign = data.ad_sets?.campaigns
        ? {
            id: data.ad_sets.campaigns.id,
            name: data.ad_sets.campaigns.name,
            status: data.ad_sets.campaigns.status,
          }
        : null;

      const platformAccount = data.ad_sets?.campaigns?.platform_accounts
        ? {
            id: data.ad_sets.campaigns.platform_accounts.id,
            name: data.ad_sets.campaigns.platform_accounts.name ?? null,
            currency: data.ad_sets.campaigns.platform_accounts.currency ?? null,
            timezone: data.ad_sets.campaigns.platform_accounts.timezone ?? null,
          }
        : null;

      const creative = data.creative_assets
        ? {
            id: data.creative_assets.id,
            type: data.creative_assets.type,
            name: data.creative_assets.name,
            storageUrl: data.creative_assets.storage_url ?? null,
            thumbnailUrl: data.creative_assets.thumbnail_url ?? null,
            metadata: (data.creative_assets.metadata ?? null) as Record<string, unknown> | null,
            textContent: data.creative_assets.text_content ?? null,
            durationSeconds: data.creative_assets.duration_seconds ?? null,
            aspectRatio: data.creative_assets.aspect_ratio ?? null,
          }
        : null;

      const ad: AdDetail = {
        id: data.id,
        externalId: data.external_id ?? null,
        name: data.name,
        status: data.status,
        metadata: (data.metadata ?? null) as Record<string, unknown> | null,
        lastSyncedAt: data.last_synced_at ?? null,
        updatedAt: data.updated_at ?? null,
        platformAccountId: data.platform_account_id,
        adSet: data.ad_sets
          ? {
              id: data.ad_sets.id,
              name: data.ad_sets.name,
              status: data.ad_sets.status,
            }
          : null,
        campaign,
        platformAccount,
        creative,
      };

      return { ad };
    },
  });
}

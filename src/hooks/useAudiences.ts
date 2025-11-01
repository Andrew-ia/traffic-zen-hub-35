import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface AudienceRow {
  id: string;
  name: string;
  audienceType: string;
  status: string;
  source: string;
  sizeEstimate: number | null;
  lastSyncedAt: string | null;
  updatedAt: string | null;
  platformAccountId: string | null;
  platformName: string | null;
  platformKey: string | null;
}

export interface AudienceSummary {
  total: number;
  totalSize: number;
  lookalikeCount: number;
  customCount: number;
}

export interface AudienceResponse {
  rows: AudienceRow[];
  summary: AudienceSummary;
}

export interface AudienceQueryParams {
  search?: string;
}

export function useAudiences(params: AudienceQueryParams = {}): UseQueryResult<AudienceResponse> {
  const { search = "" } = params;

  return useQuery({
    queryKey: ["audiences", WORKSPACE_ID, search],
    queryFn: async () => {
      let query = supabase
        .from("audiences")
        .select(
          `
            id,
            name,
            audience_type,
            status,
            source,
            size_estimate,
            last_synced_at,
            updated_at,
            platform_account_id,
            platform_accounts:platform_accounts!audiences_platform_account_id_fkey (
              name,
              platform_key
            )
          `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .order("updated_at", { ascending: false });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to load audiences", error.message);
        throw error;
      }

      const rows: AudienceRow[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        audienceType: row.audience_type ?? "custom",
        status: row.status ?? "active",
        source: row.source ?? "manual",
        sizeEstimate: row.size_estimate !== null ? Number(row.size_estimate) : null,
        lastSyncedAt: row.last_synced_at ?? null,
        updatedAt: row.updated_at ?? null,
        platformAccountId: row.platform_account_id ?? null,
        platformName: row.platform_accounts?.name ?? null,
        platformKey: row.platform_accounts?.platform_key ?? null,
      }));

      const summary: AudienceSummary = rows.reduce(
        (acc, audience) => {
          acc.total += 1;
          acc.totalSize += Number(audience.sizeEstimate ?? 0);

          const type = audience.audienceType.toLowerCase();
          if (type.includes("lookalike")) {
            acc.lookalikeCount += 1;
          } else {
            acc.customCount += 1;
          }

          return acc;
        },
        { total: 0, totalSize: 0, lookalikeCount: 0, customCount: 0 },
      );

      return { rows, summary } satisfies AudienceResponse;
    },
  });
}

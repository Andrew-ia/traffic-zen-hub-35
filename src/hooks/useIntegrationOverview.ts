import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface IntegrationRecord {
  id: string;
  platform_key: string;
  status: string;
  last_synced_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
  platform_category: string | null;
  platform_display_name: string | null;
}

export interface PlatformAccountRecord {
  id: string;
  platform_key: string;
  name: string | null;
  status: string;
  last_synced_at: string | null;
}

export interface IntegrationOverview {
  integrations: IntegrationRecord[];
  platformAccounts: PlatformAccountRecord[];
  connectedCount: number;
  analyticsCount: number;
  activeAccountCount: number;
  lastSyncDescription: string | null;
}

function describeLastSync(date: string | null): string | null {
  if (!date) return null;
  const syncDate = new Date(date);
  if (Number.isNaN(syncDate.getTime())) return null;
  const diffMs = Date.now() - syncDate.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Há instantes";
  if (diffMinutes < 60) return `Há ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  const diffDays = Math.round(diffHours / 24);
  return `Há ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
}

export function useIntegrationOverview(): UseQueryResult<IntegrationOverview> {
  return useQuery({
    queryKey: ["integrations", "overview", WORKSPACE_ID],
    queryFn: async () => {
      const [{ data: integrations, error: integrationsError }, { data: accounts, error: accountsError }] =
        await Promise.all([
          supabase
            .from("workspace_integrations")
            .select(
              `id, platform_key, status, last_synced_at, updated_at, metadata, platforms:platforms!workspace_integrations_platform_key_fkey ( category, display_name )`,
            )
            .eq("workspace_id", WORKSPACE_ID),
          supabase
            .from("platform_accounts")
            .select("id, platform_key, name, status, last_synced_at")
            .eq("workspace_id", WORKSPACE_ID),
        ]);

      if (integrationsError) {
        console.error("Failed to load workspace integrations", integrationsError.message);
        throw integrationsError;
      }

      if (accountsError) {
        console.error("Failed to load platform accounts", accountsError.message);
        throw accountsError;
      }

      const mappedIntegrations: IntegrationRecord[] = (integrations ?? []).map((integration) => ({
        id: integration.id,
        platform_key: integration.platform_key,
        status: integration.status,
        last_synced_at: integration.last_synced_at,
        updated_at: integration.updated_at,
        metadata: (integration.metadata ?? null) as Record<string, unknown> | null,
        platform_category: integration.platforms?.category ?? null,
        platform_display_name: integration.platforms?.display_name ?? integration.platform_key,
      }));

      const mappedAccounts: PlatformAccountRecord[] = (accounts ?? []).map((account) => ({
        id: account.id,
        platform_key: account.platform_key,
        name: account.name ?? null,
        status: account.status,
        last_synced_at: account.last_synced_at ?? null,
      }));

      const connectedCount = mappedIntegrations.filter((integration) => integration.status === "active").length;
      const analyticsCount = mappedIntegrations.filter((integration) => integration.platform_category === "analytics").length;
      const activeAccountCount = mappedAccounts.filter((account) => account.status === "active").length;

      const lastSyncCandidates: Array<string | null> = [
        ...mappedIntegrations.map((integration) => integration.last_synced_at ?? integration.updated_at ?? null),
        ...mappedAccounts.map((account) => account.last_synced_at ?? null),
      ];
      const lastSyncDate = lastSyncCandidates
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

      return {
        integrations: mappedIntegrations,
        platformAccounts: mappedAccounts,
        connectedCount,
        analyticsCount,
        activeAccountCount,
        lastSyncDescription: describeLastSync(lastSyncDate),
      } satisfies IntegrationOverview;
    },
  });
}

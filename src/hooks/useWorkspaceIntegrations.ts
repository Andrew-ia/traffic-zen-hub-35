import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface WorkspaceIntegration {
  id: string;
  platform_key: string;
  status: string;
  last_synced_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
}

export function useWorkspaceIntegrations(): UseQueryResult<WorkspaceIntegration[]> {
  return useQuery({
    queryKey: ["workspace", "integrations", WORKSPACE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_integrations")
        .select("id, platform_key, status, last_synced_at, updated_at, metadata")
        .eq("workspace_id", WORKSPACE_ID);

      if (error) {
        console.error("Failed to load workspace integrations", error.message);
        throw error;
      }

      return (data ?? []) as WorkspaceIntegration[];
    },
  });
}

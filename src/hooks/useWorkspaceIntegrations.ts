import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface WorkspaceIntegration {
  id: string;
  platform_key: string;
  status: string;
  last_synced_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
}

export function useWorkspaceIntegrations(workspaceId: string | null): UseQueryResult<WorkspaceIntegration[]> {
  return useQuery({
    queryKey: ["workspace", "integrations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("workspace_integrations")
        .select("id, platform_key, status, last_synced_at, updated_at, metadata")
        .eq("workspace_id", workspaceId);

      if (error) {
        console.error("Failed to load workspace integrations", error.message);
        throw error;
      }

      return (data ?? []) as WorkspaceIntegration[];
    },
  });
}

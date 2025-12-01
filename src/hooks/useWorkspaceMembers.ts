import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface WorkspaceMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  invitationStatus: string | null;
}

export function useWorkspaceMembers(workspaceId: string | null): UseQueryResult<WorkspaceMember[]> {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("workspace_members")
        .select(
          `
            user_id,
            role,
            invitation_status,
            users:users!workspace_members_user_id_fkey (
              id,
              email,
              full_name
            )
          `,
        )
        .eq("workspace_id", workspaceId)
        .order("role", { ascending: true });

      if (error) {
        console.error("Failed to load workspace members", error.message);
        throw error;
      }

      const rows = (data ?? []).map((row: any) => ({
        userId: row.user_id as string,
        name: row.users?.full_name ?? null,
        email: row.users?.email ?? null,
        role: row.role ?? null,
        invitationStatus: row.invitation_status ?? null,
      }));

      return rows satisfies WorkspaceMember[];
    },
  });
}

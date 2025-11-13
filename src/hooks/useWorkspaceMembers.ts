import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface WorkspaceMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  invitationStatus: string | null;
}

export function useWorkspaceMembers(): UseQueryResult<WorkspaceMember[]> {
  return useQuery({
    queryKey: ["workspace-members", WORKSPACE_ID],
    queryFn: async () => {
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
        .eq("workspace_id", WORKSPACE_ID as string)
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

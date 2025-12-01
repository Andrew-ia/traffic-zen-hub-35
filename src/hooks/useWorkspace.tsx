import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan?: string;
  timezone?: string;
  currency?: string;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  isCreating: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (input: { name: string; slug?: string }) => Promise<Workspace>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "trafficpro.workspace.selected";

function getInitialWorkspaceId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore storage read errors
  }
  const envDefault = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();
  return envDefault || null;
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const resp = await fetch("/api/workspaces", { credentials: "include" });
  if (!resp.ok) throw new Error("Falha ao carregar workspaces");
  const json = await resp.json();
  return json.workspaces || [];
}

async function postWorkspace(input: { name: string; slug?: string }): Promise<Workspace> {
  const resp = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || "Erro ao criar workspace");
  }
  const json = await resp.json();
  return json.workspace as Workspace;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(getInitialWorkspaceId);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
    staleTime: 60_000,
  });

  const { mutateAsync: createWorkspace, isPending: isCreating } = useMutation({
    mutationFn: postWorkspace,
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setSelectedId(workspace.id);
    },
  });

  const currentWorkspace = useMemo(() => {
    if (!workspaces.length) return null;
    const found = workspaces.find((w) => w.id === selectedId);
    return found || workspaces[0] || null;
  }, [workspaces, selectedId]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      try {
        localStorage.setItem(STORAGE_KEY, currentWorkspace.id);
      } catch {
        // ignore storage write errors
      }
    }
  }, [currentWorkspace?.id]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setSelectedId(workspaceId);
  }, []);

  const value: WorkspaceContextValue = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      isLoading,
      isCreating,
      switchWorkspace,
      createWorkspace,
    }),
    [workspaces, currentWorkspace, isLoading, isCreating, switchWorkspace, createWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider");
  }
  return ctx;
}

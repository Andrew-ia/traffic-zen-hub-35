import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveApiBase } from '@/lib/apiBase';

const API_BASE = resolveApiBase();

export interface TryOnImage {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  aspectRatio: string;
  metadata: any;
  createdAt: string;
}

export interface TryOnFolder {
  name: string;
  modelName: string | null;
  clothingName: string | null;
  images: TryOnImage[];
  count: number;
  lastGenerated: string;
}

export interface TryOnLooksResponse {
  success: boolean;
  folders: TryOnFolder[];
  totalFolders: number;
  totalImages: number;
}

export function useTryOnLooks(workspaceId: string | null) {
  return useQuery<TryOnLooksResponse>({
    queryKey: ['tryon-looks', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace não selecionado');
      const response = await fetch(`${API_BASE}/api/creatives/tryon-looks?workspaceId=${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch try-on looks');
      }
      return response.json();
    },
  });
}

export function useDeleteTryOnLook(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) throw new Error('Workspace não selecionado');
      const response = await fetch(`${API_BASE}/api/creatives/tryon-looks/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete look');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tryon-looks', workspaceId] });
    },
  });
}

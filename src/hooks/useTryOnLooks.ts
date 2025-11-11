import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

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

export function useTryOnLooks() {
  return useQuery<TryOnLooksResponse>({
    queryKey: ['tryon-looks', WORKSPACE_ID],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:3001/api/creatives/tryon-looks?workspaceId=${WORKSPACE_ID}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch try-on looks');
      }
      return response.json();
    },
  });
}

export function useDeleteTryOnLook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `http://localhost:3001/api/creatives/tryon-looks/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete look');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tryon-looks'] });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveApiBase } from '@/lib/apiBase';

const API_BASE = resolveApiBase();

interface GenerateCaptionParams {
  folderId?: string;
  folderName: string;
  modelName?: string | null;
  clothingName?: string | null;
  imageUrl?: string;
  brandName?: string;
}

interface GenerateCaptionResponse {
  success: boolean;
  caption: string;
  metadata?: {
    model: string;
    tokens: number;
  };
}

export function useGenerateLookCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateCaptionParams): Promise<GenerateCaptionResponse> => {
      const response = await fetch(`${API_BASE}/api/ai/generate-look-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate caption');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate looks cache to show updated captions
      queryClient.invalidateQueries({ queryKey: ['tryon-looks'] });
    },
  });
}

interface UpdateCaptionParams {
  creativeId: string;
  caption: string;
  workspaceId: string;
}

export function useUpdateCreativeCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creativeId, caption, workspaceId }: UpdateCaptionParams) => {
      const response = await fetch(`${API_BASE}/api/ai/caption/${creativeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caption, workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update caption');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tryon-looks'] });
    },
  });
}

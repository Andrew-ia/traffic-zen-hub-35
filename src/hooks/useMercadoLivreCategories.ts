import { useQuery, useMutation } from "@tanstack/react-query";
import { useMercadoLivreAuthStatus, shouldRetry } from "./useMercadoLivre";

export interface MLCategory {
    id: string;
    name: string;
    total_items_in_this_category?: number;
    path_from_root?: any[];
    predicted?: boolean;
    probability?: number;
    ai_enhanced?: boolean;
    boost_reason?: string;
}

export interface CategoryPrediction {
    id: string;
    name: string;
    probability: number;
    path_from_root?: any[];
    predicted: boolean;
    ai_enhanced?: boolean;
    boost_reason?: string;
}

/**
 * Hook para buscar todas as categorias do Mercado Livre
 */
export function useMLCategories(workspaceId?: string | null) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["ml-categories", effectiveWorkspaceId],
        queryFn: async () => {
            const params = new URLSearchParams({
                ...(effectiveWorkspaceId ? { workspaceId: effectiveWorkspaceId } : {}),
            });
            const response = await fetch(`/api/integrations/mercadolivre/categories?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch ML categories");
            return response.json();
        },
        enabled: isConnected,
        retry: shouldRetry,
        staleTime: 1000 * 60 * 60, // Cache por 1 hora
    });
}

/**
 * Hook para buscar detalhes de uma categoria específica
 */
export function useMLCategoryDetails(categoryId: string | null, workspaceId?: string | null) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["ml-category", categoryId, effectiveWorkspaceId],
        queryFn: async () => {
            if (!categoryId) throw new Error("Category ID required");
            const params = new URLSearchParams({
                ...(effectiveWorkspaceId ? { workspaceId: effectiveWorkspaceId } : {}),
            });
            const response = await fetch(`/api/integrations/mercadolivre/categories/${categoryId}?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch category details");
            return response.json();
        },
        enabled: !!categoryId && isConnected,
        retry: shouldRetry,
        staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    });
}

/**
 * Hook para predizer categoria baseada no título do produto
 */
export function usePredictCategory() {
    return useMutation({
        mutationFn: async ({ title, country = 'MLB' }: { title: string; country?: string }) => {
            const response = await fetch("/api/integrations/mercadolivre/predict-category", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, country }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to predict category");
            }

            return response.json();
        },
    });
}

/**
 * Hook para buscar categorias por texto
 */
export function useSearchCategories() {
    return useMutation({
        mutationFn: async ({ 
            query, 
            country = 'MLB', 
            limit = 10 
        }: { 
            query: string; 
            country?: string; 
            limit?: number; 
        }) => {
            const response = await fetch("/api/integrations/mercadolivre/search-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, country, limit }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to search categories");
            }

            return response.json();
        },
    });
}

/**
 * Hook combinado para seletor de categoria inteligente
 */
export function useSmartCategorySelector() {
    const predictCategory = usePredictCategory();
    const searchCategories = useSearchCategories();
    const allCategories = useMLCategories();

    const suggestCategory = async (title: string) => {
        if (!title || title.length < 3) return [];
        
        try {
            // Primeiro tentar predição baseada no título
            const prediction = await predictCategory.mutateAsync({ title });
            return prediction.predictions || [];
        } catch (error) {
            console.error("Error predicting category:", error);
            return [];
        }
    };

    const searchByText = async (query: string) => {
        if (!query || query.length < 2) return [];
        
        try {
            const result = await searchCategories.mutateAsync({ query });
            return result.categories || [];
        } catch (error) {
            console.error("Error searching categories:", error);
            return [];
        }
    };

    return {
        suggestCategory,
        searchByText,
        allCategories: allCategories.data?.categories || [],
        isLoading: predictCategory.isPending || searchCategories.isPending || allCategories.isLoading,
        isLoadingPrediction: predictCategory.isPending,
        isLoadingSearch: searchCategories.isPending,
    };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Product {
    id?: string;
    workspace_id: string;
    sku?: string;
    internal_code?: string;
    title: string;
    description?: string;
    ml_category_id?: string;
    ml_listing_type?: string;
    price: number;
    original_price?: number;
    cost_price?: number;
    currency?: string;
    available_quantity?: number;
    sold_quantity?: number;
    condition?: string;
    attributes?: any[];
    images?: string[];
    video_url?: string;
    weight_kg?: number;
    width_cm?: number;
    height_cm?: number;
    length_cm?: number;
    free_shipping?: boolean;
    shipping_mode?: string;
    local_pickup?: boolean;
    warranty_type?: string;
    warranty_time?: string;
    tags?: string[];
    keywords?: string[];
    status?: string;
    published_on_ml?: boolean;
    ml_item_id?: string;
    ml_permalink?: string;
    has_variations?: boolean;
    parent_id?: string;
    variation_attributes?: any;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    
    // Campos de sincronização
    last_synced_at?: string;
    last_updated_on_ml?: string;
    source_of_truth?: 'traffic_pro' | 'mercado_livre' | 'both';
    sync_status?: 'synced' | 'pending' | 'conflict' | 'error';
    ml_last_modified?: string;
}

export function useProducts(workspaceId: string | null, filters?: {
    search?: string;
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
}) {
    return useQuery({
        queryKey: ["products", workspaceId, filters],
        queryFn: async () => {
            if (!workspaceId) throw new Error("Workspace ID required");

            const params = new URLSearchParams({
                workspaceId,
                ...(filters?.search && { search: filters.search }),
                ...(filters?.category && { category: filters.category }),
                ...(filters?.status && { status: filters.status }),
                page: String(filters?.page || 1),
                limit: String(filters?.limit || 50),
            });

            const response = await fetch(`/api/products?${params}`);
            if (!response.ok) throw new Error("Failed to fetch products");
            return response.json();
        },
        enabled: !!workspaceId,
    });
}

export function useProduct(id: string, workspaceId: string | null) {
    return useQuery({
        queryKey: ["products", id, workspaceId],
        queryFn: async () => {
            if (!workspaceId) throw new Error("Workspace ID required");

            const response = await fetch(`/api/products/${id}?workspaceId=${workspaceId}`);
            if (!response.ok) throw new Error("Failed to fetch product");
            return response.json();
        },
        enabled: !!id && !!workspaceId,
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (product: Product) => {
            const response = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(product),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create product");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["products", variables.workspace_id] });
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, product }: { id: string; product: Product }) => {
            const response = await fetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(product),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update product");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["products", variables.product.workspace_id] });
            queryClient.invalidateQueries({ queryKey: ["products", variables.id] });
        },
    });
}

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            const response = await fetch(`/api/products/${id}?workspaceId=${workspaceId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to delete product");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["products", variables.workspaceId] });
        },
    });
}

export function useDuplicateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ 
            id, 
            workspaceId, 
            modifications = {} 
        }: { 
            id: string; 
            workspaceId: string; 
            modifications?: Partial<Product>; 
        }) => {
            const response = await fetch(`/api/products/${id}/duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId, modifications }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to duplicate product");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["products", variables.workspaceId] });
        },
    });
}

export function useDeletedProducts(workspaceId: string | null) {
    return useQuery({
        queryKey: ["products", "deleted", workspaceId],
        queryFn: async () => {
            if (!workspaceId) throw new Error("Workspace ID required");

            const response = await fetch(`/api/products/deleted/${workspaceId}`);
            if (!response.ok) throw new Error("Failed to fetch deleted products");
            return response.json();
        },
        enabled: !!workspaceId,
    });
}

export function useRestoreProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
            const response = await fetch(`/api/products/${id}/restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to restore product");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["products", variables.workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["products", "deleted", variables.workspaceId] });
        },
    });
}

export function useGenerateDescription() {
    return useMutation({
        mutationFn: async ({ title, category, price }: { title: string; category?: string; price?: number }) => {
            const response = await fetch("/api/products/generate-description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, category, price }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to generate description");
            }

            return response.json();
        },
    });
}

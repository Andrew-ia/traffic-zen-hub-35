import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Lead {
    id: string;
    name: string;
    email?: string;
    whatsapp: string;
    company: string;
    origem?: string;
    campanha?: string;
    status: string;
    revenue_range?: string;
    announces_online?: string;
    traffic_investment?: string;
    observacoes?: string;
    created_at: string;
    ultima_atualizacao?: string;
}

export interface LeadsResponse {
    success: boolean;
    data: Lead[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface LeadsFilters {
    status?: string;
    origem?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export function useLeads(workspaceId: string | null, filters: LeadsFilters = {}) {
    return useQuery<LeadsResponse>({
        queryKey: ['leads', workspaceId, filters],
        enabled: !!workspaceId,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.origem) params.append('origem', filters.origem);
            if (filters.search) params.append('search', filters.search);
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());
            if (workspaceId) params.append('workspace_id', workspaceId);

            const response = await fetch(`/api/leads?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leads');
            }
            return response.json();
        },
    });
}

export function useUpdateLead(workspaceId: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
            const response = await fetch(`/api/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error('Failed to update lead');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] });
        },
    });
}

export function useDeleteLead(workspaceId: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`/api/leads/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete lead');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] });
        },
    });
}

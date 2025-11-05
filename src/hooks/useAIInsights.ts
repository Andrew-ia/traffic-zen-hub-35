import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// TYPES
// ============================================================================

export interface AIInsight {
  id: string;
  ai_agent_id: string;
  execution_id: string | null;
  workspace_id: string;

  // Relacionamento com entidades
  platform_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  creative_asset_id: string | null;

  insight_type: 'warning' | 'opportunity' | 'recommendation' | 'alert' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';

  title: string;
  description: string;
  recommendation: string | null;

  metrics: Record<string, any>;

  status: 'new' | 'viewed' | 'actioned' | 'dismissed' | 'expired';
  actioned_at: string | null;
  actioned_by: string | null;
  action_taken: string | null;

  created_at: string;
  expires_at: string | null;

  // From detailed view
  agent_name?: string;
  agent_type?: string;
  campaign_name?: string;
  campaign_status?: string;
  campaign_objective?: string;
  ad_set_name?: string;
  ad_set_status?: string;
  ad_name?: string;
  ad_status?: string;
  creative_name?: string;
  creative_type?: string;
  creative_thumbnail?: string;
  account_name?: string;
  available_actions_count?: number;
  actioned_by_name?: string;
  actioned_by_email?: string;
}

export interface AIInsightAction {
  id: string;
  ai_insight_id: string;
  action_type: string;
  action_label: string;
  parameters: Record<string, any>;
  can_auto_apply: boolean;
  requires_approval: boolean;
  created_at: string;
}

export interface InsightsStats {
  by_status: Array<{ status: string; count: number }>;
  by_severity: Array<{ severity: string; count: number }>;
  by_type: Array<{ insight_type: string; count: number }>;
  by_agent: Array<{ ai_agent_id: string; agent_name: string; count: number }>;
  recent_insights: Array<{ date: string; count: number }>;
}

export interface InsightsFilters {
  status?: string;
  insight_type?: string;
  severity?: string;
  agent_id?: string;
  campaign_id?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// HOOKS
// ============================================================================

// Listar insights com filtros
export function useAIInsights(filters: InsightsFilters = {}) {
  return useQuery({
    queryKey: ['ai-insights', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.status) params.append('status', filters.status);
      if (filters.insight_type) params.append('insight_type', filters.insight_type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.agent_id) params.append('agent_id', filters.agent_id);
      if (filters.campaign_id) params.append('campaign_id', filters.campaign_id);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/ai/insights?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }

      const data = await response.json();
      return data as { insights: AIInsight[]; total: number };
    },
    staleTime: 30 * 1000, // 30 segundos
  });
}

// Buscar insight específico
export function useAIInsight(insightId: string | undefined) {
  return useQuery({
    queryKey: ['ai-insight', insightId],
    queryFn: async () => {
      if (!insightId) throw new Error('Insight ID is required');

      const response = await fetch(`/api/ai/insights/${insightId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch insight');
      }

      const data = await response.json();
      return data as AIInsight & { actions: AIInsightAction[] };
    },
    enabled: !!insightId,
    staleTime: 30 * 1000,
  });
}

// Atualizar status do insight
export function useUpdateInsightStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      action_taken,
      actioned_by,
    }: {
      id: string;
      status: string;
      action_taken?: string;
      actioned_by?: string;
    }) => {
      const response = await fetch(`/api/ai/insights/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, action_taken, actioned_by }),
      });

      if (!response.ok) {
        throw new Error('Failed to update insight status');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      queryClient.invalidateQueries({ queryKey: ['ai-insight', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ai-dashboard'] });
    },
  });
}

// Aplicar ação do insight
export function useApplyInsightAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      insight_id,
      action_id,
      actioned_by,
    }: {
      insight_id: string;
      action_id: string;
      actioned_by?: string;
    }) => {
      const response = await fetch(`/api/ai/insights/${insight_id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id, actioned_by }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply action');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      queryClient.invalidateQueries({ queryKey: ['ai-insight', variables.insight_id] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ai-dashboard'] });
    },
  });
}

// Estatísticas de insights
export function useInsightsStats() {
  return useQuery({
    queryKey: ['ai-insights-stats'],
    queryFn: async () => {
      const response = await fetch('/api/ai/insights/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch insights stats');
      }

      return response.json() as Promise<InsightsStats>;
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// TYPES
// ============================================================================

export interface AIAgent {
  id: string;
  workspace_id: string;
  agent_type: 'campaign_performance' | 'creative_optimizer' | 'audience_targeting' | 'budget_allocation' | 'ad_copy_quality' | 'anomaly_detector';
  name: string;
  description: string;
  status: 'active' | 'paused' | 'disabled';
  schedule_frequency: 'hourly' | 'daily' | 'weekly' | 'on_demand';
  config: Record<string, any>;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;

  // From dashboard view
  total_executions?: number;
  successful_executions?: number;
  failed_executions?: number;
  total_insights?: number;
  new_insights?: number;
  actioned_insights?: number;
  last_execution_started_at?: string;
  last_execution_status?: 'running' | 'completed' | 'failed';
  last_execution_insights_count?: number;
}

export interface AIAgentExecution {
  id: string;
  ai_agent_id: string;
  workspace_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  total_insights: number;
  error_message: string | null;
  execution_time_ms: number | null;
  metadata: Record<string, any>;
}

// ============================================================================
// HOOKS
// ============================================================================

// Listar todos os agentes
export function useAIAgents(status?: string) {
  return useQuery({
    queryKey: ['ai-agents', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.append('status', status);
      }

      const response = await fetch(`/api/ai/agents?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch AI agents');
      }

      const data = await response.json();
      return data as { agents: AIAgent[]; total: number };
    },
    staleTime: 30 * 1000, // 30 segundos
  });
}

// Buscar agente específico
export function useAIAgent(agentId: string | undefined) {
  return useQuery({
    queryKey: ['ai-agent', agentId],
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID is required');

      const response = await fetch(`/api/ai/agents/${agentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch AI agent');
      }

      return response.json() as Promise<AIAgent>;
    },
    enabled: !!agentId,
    staleTime: 30 * 1000,
  });
}

// Criar novo agente
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<AIAgent>) => {
      const response = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create agent');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
  });
}

// Atualizar agente
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AIAgent> }) => {
      const response = await fetch(`/api/ai/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update agent');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent', variables.id] });
    },
  });
}

// Deletar agente
export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/ai/agents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
  });
}

// Executar agente manualmente
export function useRunAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: string | { id: string; prompt?: string }) => {
      const id = typeof input === 'string' ? input : input.id;
      const hasBody = typeof input !== 'string' && input.prompt;
      const response = await fetch(`/api/ai/agents/${id}/run`, {
        method: 'POST',
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify({ prompt: input.prompt }) : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to run agent');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      const id = typeof variables === 'string' ? variables : variables.id;
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-executions', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', { agent_id: id }] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights-stats'] });
    },
  });
}

// Pausar agente
export function usePauseAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/ai/agents/${id}/pause`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to pause agent');
      }

      return response.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
  });
}

// Retomar agente
export function useResumeAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/ai/agents/${id}/resume`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resume agent');
      }

      return response.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
  });
}

// Histórico de execuções
export function useAgentExecutions(agentId: string | undefined, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['ai-agent-executions', agentId, limit, offset],
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID is required');

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/ai/agents/${agentId}/executions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch executions');
      }

      const data = await response.json();
      return data as { executions: AIAgentExecution[]; total: number };
    },
    enabled: !!agentId,
    staleTime: 10 * 1000, // 10 segundos
  });
}

// Dashboard de AI
export function useAIDashboard() {
  return useQuery({
    queryKey: ['ai-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/ai/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch AI dashboard');
      }

      return response.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refetch a cada minuto
  });
}

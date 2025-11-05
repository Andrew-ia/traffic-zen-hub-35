import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useAIAgents, useAIDashboard } from "@/hooks/useAIAgents";
import { AgentCard } from "@/components/ai/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AIAgents() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: agentsData, isLoading: agentsLoading } = useAIAgents(statusFilter);
  const { data: dashboardData, isLoading: dashboardLoading } = useAIDashboard();

  const agents = agentsData?.agents || [];

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Agentes de IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise automática e recomendações inteligentes
          </p>
        </div>

        <div className="flex-1" />

        {/* Filtro de Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="disabled">Desabilitados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botão Ver Insights */}
        <Button asChild>
          <a href="/insights">Ver Todos os Insights</a>
        </Button>
      </div>

      {/* Dashboard KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {dashboardLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <CompactKPICard
              title="Agentes Ativos"
              value={dashboardData?.active_agents || 0}
              icon={Play}
              loading={dashboardLoading}
            />
            <CompactKPICard
              title="Insights Novos"
              value={dashboardData?.new_insights || 0}
              icon={AlertCircle}
              loading={dashboardLoading}
            />
            <CompactKPICard
              title="Insights Críticos"
              value={dashboardData?.critical_insights || 0}
              icon={AlertCircle}
              loading={dashboardLoading}
            />
            <CompactKPICard
              title="Última Execução"
              value={
                dashboardData?.last_execution?.started_at
                  ? formatDistanceToNow(new Date(dashboardData.last_execution.started_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Nenhuma"
              }
              icon={Clock}
              loading={dashboardLoading}
            />
          </>
        )}
      </div>

      {/* Última Execução Card */}
      {dashboardData?.last_execution && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {dashboardData.last_execution.status === "completed" ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                ) : dashboardData.last_execution.status === "failed" ? (
                  <AlertCircle className="h-8 w-8 text-red-600" />
                ) : (
                  <Play className="h-8 w-8 text-blue-600 animate-pulse" />
                )}
                <div>
                  <div className="text-sm font-semibold">
                    {dashboardData.last_execution.agent_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(dashboardData.last_execution.started_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}{" "}
                    •{" "}
                    {dashboardData.last_execution.total_insights || 0} insights gerados
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/agents/${dashboardData.last_execution.ai_agent_id}`}>Ver Detalhes</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {agentsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!agentsLoading && agents.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum agente encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statusFilter !== "all"
                  ? `Não há agentes com status "${statusFilter}"`
                  : "Configure seus primeiros agentes de IA para começar"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents Grid */}
      {!agentsLoading && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

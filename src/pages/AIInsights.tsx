import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Info,
  Eye,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { useAIInsights, useUpdateInsightStatus } from "@/hooks/useAIInsights";
import { useAIAgents } from "@/hooks/useAIAgents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";
import { useAgentExecutions } from "@/hooks/useAIAgents";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const insightTypeIcons = {
  warning: AlertTriangle,
  opportunity: TrendingUp,
  recommendation: Lightbulb,
  alert: AlertTriangle,
  info: Info,
};

const insightTypeLabels = {
  warning: "Alerta",
  opportunity: "Oportunidade",
  recommendation: "Recomendação",
  alert: "Alerta Crítico",
  info: "Informação",
};

const insightTypeColors = {
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  opportunity: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  recommendation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  alert: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const severityColors = {
  critical: "border-l-red-600",
  high: "border-l-orange-600",
  medium: "border-l-yellow-600",
  low: "border-l-blue-600",
};

const severityLabels = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export default function AIInsights() {
  const [statusFilter, setStatusFilter] = useState("new");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const agentIdParam = searchParams.get('agent_id') || undefined;

  // Buscar agentes para validar o agent_id vindo da URL
  const { data: agentsData } = useAIAgents('active');
  const agents = agentsData?.agents ?? [];

  // Checagem básica de UUID e existência na lista
  const isUuid = (v: string) => /^[0-9a-fA-F-]{36}$/.test(v);
  const validAgentId = useMemo(() => {
    if (!agentIdParam) return undefined;
    if (!isUuid(agentIdParam)) return undefined;
    return agents.some(a => a.id === agentIdParam) ? agentIdParam : undefined;
  }, [agentIdParam, agents]);

  const { data, isLoading, refetch } = useAIInsights({
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
    insight_type: typeFilter === "all" ? undefined : typeFilter,
    agent_id: validAgentId,
    limit: 50,
  });

  const updateStatus = useUpdateInsightStatus();

  // Executions para saber se está rodando, completou ou falhou
  const { data: execData, refetch: refetchExec } = useAgentExecutions(validAgentId, 1, 0);
  const latestExec = execData?.executions?.[0];

  const insights = data?.insights || [];

  // Modal de carregamento: aguarda até surgir pelo menos 1 insight "new" do agente
  const shouldWaitForNew = !!validAgentId && (statusFilter === "new" || statusFilter === "all");
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const MAX_WAIT = 120; // segundos
  type LoadingState = 'waiting' | 'completed_no_insights' | 'failed' | 'timeout';
  const [loadingState, setLoadingState] = useState<LoadingState>('waiting');
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldWaitForNew) {
      setLoadingOpen(false);
      return;
    }
    // Abre se não há insights e estamos aguardando "Novos" ou "Todos"
    if (!isLoading && insights.length === 0) {
      setLoadingOpen(true);
      setLoadingState('waiting');
    }
    // Fecha ao aparecer o primeiro insight
    if (insights.length > 0) {
      setLoadingOpen(false);
    }
  }, [shouldWaitForNew, isLoading, insights.length]);

  // Polling enquanto o modal estiver aberto
  useEffect(() => {
    if (!loadingOpen) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
      return;
    }
    // Intervalo de 2s para refetch
    pollRef.current = window.setInterval(() => {
      refetch();
      refetchExec();
    }, 2000);
    // Cronômetro simples
    timerRef.current = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    setLoadingState('waiting');
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadingOpen, refetch, refetchExec]);

  // Atualiza estado do modal com base na execução
  useEffect(() => {
    if (!loadingOpen) return;
    if (elapsed >= MAX_WAIT && insights.length === 0) {
      setLoadingState('timeout');
      return;
    }
    if (latestExec?.status === 'failed') {
      setLoadingState('failed');
      return;
    }
    if (latestExec?.status === 'completed' && insights.length === 0) {
      setLoadingState('completed_no_insights');
      return;
    }
    setLoadingState('waiting');
  }, [loadingOpen, elapsed, MAX_WAIT, latestExec?.status, insights.length]);

  const handleMarkAsViewed = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "viewed" });
      toast.success("Insight marcado como visualizado");
    } catch (error) {
      toast.error("Erro ao atualizar insight");
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "dismissed" });
      toast.success("Insight dispensado");
    } catch (error) {
      toast.error("Erro ao atualizar insight");
    }
  };

  const handleMarkAsActioned = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "actioned", action_taken: "Ação manual" });
      toast.success("Insight marcado como ação tomada");
    } catch (error) {
      toast.error("Erro ao atualizar insight");
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-primary" />
            Insights & Recomendações
          </h1>
          <p className="text-sm text-muted-foreground">
            Análises e sugestões geradas pelos agentes de IA
          </p>
        </div>

        <div className="flex-1" />

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="new">Novos</SelectItem>
              <SelectItem value="viewed">Visualizados</SelectItem>
              <SelectItem value="actioned">Ações Tomadas</SelectItem>
              <SelectItem value="dismissed">Dispensados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="warning">Alertas</SelectItem>
              <SelectItem value="opportunity">Oportunidades</SelectItem>
              <SelectItem value="recommendation">Recomendações</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button asChild variant="outline">
          <a href="/agents">Ver Agentes</a>
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Aviso de agent_id inválido */}
      {agentIdParam && !validAgentId && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              O agente especificado na URL não foi encontrado ou é inválido. O filtro por agente foi ignorado.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && insights.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insight encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Aguarde os agentes executarem suas análises ou ajuste os filtros
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      {!isLoading && insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight) => {
            const Icon = insightTypeIcons[insight.insight_type];

            return (
              <Card
                key={insight.id}
                className={`border-l-4 ${severityColors[insight.severity]} hover:shadow-md transition-all`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left - Icon & Content */}
                    <div className="flex gap-3 flex-1 min-w-0">
                      <Icon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                        insight.severity === "critical" ? "text-red-600" :
                        insight.severity === "high" ? "text-orange-600" :
                        "text-primary"
                      }`} />

                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={insightTypeColors[insight.insight_type]}>
                            {insightTypeLabels[insight.insight_type]}
                          </Badge>
                          <Badge variant="outline">
                            {severityLabels[insight.severity]}
                          </Badge>
                          {insight.campaign_name && (
                            <span className="text-xs text-muted-foreground">
                              📊 {insight.campaign_name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            🤖 {insight.agent_name}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-base mb-1">{insight.title}</h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-2">
                          {insight.description}
                        </p>

                        {/* Recommendation */}
                        {insight.recommendation && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md mb-2">
                            <div className="text-xs font-semibold text-blue-900 dark:text-blue-400 mb-1">
                              💡 Recomendação:
                            </div>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                              {insight.recommendation}
                            </p>
                          </div>
                        )}

                        {/* Metrics */}
                        {insight.metrics && Object.keys(insight.metrics).length > 0 && (
                          <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                            {Object.entries(insight.metrics).slice(0, 4).map(([key, value]) => (
                              <span key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(insight.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right - Actions */}
                    <div className="flex flex-col gap-1">
                      {insight.status === "new" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsViewed(insight.id)}
                            title="Marcar como visto"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsActioned(insight.id)}
                            title="Marcar como ação tomada"
                            className="h-8 w-8 p-0 text-green-600"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(insight.id)}
                            title="Dispensar"
                            className="h-8 w-8 p-0 text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Carregamento */}
      <Dialog open={loadingOpen} onOpenChange={setLoadingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            {loadingState === 'waiting' && (
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando insight
              </DialogTitle>
            )}
            {loadingState === 'completed_no_insights' && (
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Nenhum insight gerado nesta execução
              </DialogTitle>
            )}
            {loadingState === 'failed' && (
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Execução do agente falhou
              </DialogTitle>
            )}
            {loadingState === 'timeout' && (
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Tempo de espera excedido
              </DialogTitle>
            )}
            <DialogDescription>
              {loadingState === 'waiting' && (
                <>Estamos aguardando o agente produzir um novo insight. Isso pode levar alguns segundos.</>
              )}
              {loadingState === 'completed_no_insights' && (
                <>A execução terminou e não gerou insights. Você pode fechar e tentar novamente.</>
              )}
              {loadingState === 'failed' && (
                <>A execução falhou. Verifique o agente ou tente novamente.</>
              )}
              {loadingState === 'timeout' && (
                <>Não recebemos nenhum insight dentro do tempo limite. Feche e tente novamente.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Tempo decorrido: {elapsed}s {latestExec?.status && `(status: ${latestExec.status})`}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <UIButton variant="outline" onClick={() => setLoadingOpen(false)}>Fechar</UIButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

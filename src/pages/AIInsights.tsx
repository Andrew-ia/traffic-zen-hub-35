import { useState } from "react";
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
} from "lucide-react";
import { useAIInsights, useUpdateInsightStatus } from "@/hooks/useAIInsights";
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

  const { data, isLoading } = useAIInsights({
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
    insight_type: typeFilter === "all" ? undefined : typeFilter,
    limit: 50,
  });

  const updateStatus = useUpdateInsightStatus();

  const insights = data?.insights || [];

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
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Clock, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import type { AIAgent } from "@/hooks/useAIAgents";
import { useRunAgent, usePauseAgent, useResumeAgent } from "@/hooks/useAIAgents";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentCardProps {
  agent: AIAgent;
}

const agentTypeIcons = {
  campaign_performance: "📈",
  creative_optimizer: "🎨",
  audience_targeting: "🎯",
  budget_allocation: "💰",
  ad_copy_quality: "✍️",
  anomaly_detector: "🔍",
};

const agentTypeNames = {
  campaign_performance: "Performance de Campanhas",
  creative_optimizer: "Otimização de Criativos",
  audience_targeting: "Segmentação de Público",
  budget_allocation: "Alocação de Orçamento",
  ad_copy_quality: "Qualidade de Textos",
  anomaly_detector: "Detector de Anomalias",
};

const frequencyLabels = {
  hourly: "A cada hora",
  daily: "Diariamente",
  weekly: "Semanalmente",
  on_demand: "Sob demanda",
};

export function AgentCard({ agent }: AgentCardProps) {
  const runAgent = useRunAgent();
  const pauseAgent = usePauseAgent();
  const resumeAgent = useResumeAgent();

  const handleRun = async () => {
    try {
      await runAgent.mutateAsync(agent.id);
      toast.success("Agente executado com sucesso!");
    } catch (error) {
      toast.error("Erro ao executar agente");
    }
  };

  const handlePause = async () => {
    try {
      await pauseAgent.mutateAsync(agent.id);
      toast.success("Agente pausado");
    } catch (error) {
      toast.error("Erro ao pausar agente");
    }
  };

  const handleResume = async () => {
    try {
      await resumeAgent.mutateAsync(agent.id);
      toast.success("Agente retomado");
    } catch (error) {
      toast.error("Erro ao retomar agente");
    }
  };

  const statusColor = {
    active: "bg-green-500",
    paused: "bg-yellow-500",
    disabled: "bg-gray-500",
  };

  const statusLabel = {
    active: "Ativo",
    paused: "Pausado",
    disabled: "Desabilitado",
  };

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{agentTypeIcons[agent.agent_type]}</span>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {agent.name}
                <Badge
                  variant={agent.status === "active" ? "default" : "secondary"}
                  className={`${statusColor[agent.status]} text-white border-0 text-xs`}
                >
                  {statusLabel[agent.status]}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {agentTypeNames[agent.agent_type]} • {frequencyLabels[agent.schedule_frequency]}
              </CardDescription>
            </div>
          </div>

          <div className="flex gap-1">
            {agent.status === "active" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePause}
                disabled={pauseAgent.isPending}
                className="h-8 w-8 p-0"
              >
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResume}
                disabled={resumeAgent.isPending}
                className="h-8 w-8 p-0"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              disabled={runAgent.isPending || agent.status === "disabled"}
              className="h-8 w-8 p-0"
            >
              <Play className="h-4 w-4 text-primary" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground">{agent.description}</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{agent.total_insights || 0}</div>
            <div className="text-xs text-muted-foreground">Total Insights</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{agent.new_insights || 0}</div>
            <div className="text-xs text-muted-foreground">Novos</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{agent.actioned_insights || 0}</div>
            <div className="text-xs text-muted-foreground">Ações</div>
          </div>
        </div>

        {/* Execution Info */}
        <div className="space-y-1 pt-2 border-t">
          {agent.last_run_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {agent.last_execution_status === "completed" ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : agent.last_execution_status === "failed" ? (
                <AlertCircle className="h-3 w-3 text-red-600" />
              ) : (
                <TrendingUp className="h-3 w-3 text-blue-600" />
              )}
              <span>
                Última execução:{" "}
                {formatDistanceToNow(new Date(agent.last_run_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
          )}

          {agent.next_run_at && agent.status === "active" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Próxima execução:{" "}
                {formatDistanceToNow(new Date(agent.next_run_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

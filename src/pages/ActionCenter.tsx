import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActionItems, type ActionItem, type ActionPriority } from "@/hooks/useActionItems";
import {
  AlertTriangle,
  TrendingUp,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  DollarSign,
  Image as ImageIcon,
  Users,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

// ============================================================================
// HELPERS
// ============================================================================

const PRIORITY_CONFIG: Record<ActionPriority, { color: string; icon: any; label: string }> = {
  critical: { color: "bg-red-500", icon: AlertTriangle, label: "Crítico" },
  high: { color: "bg-orange-500", icon: TrendingUp, label: "Alta" },
  medium: { color: "bg-yellow-500", icon: Zap, label: "Média" },
  low: { color: "bg-blue-500", icon: Clock, label: "Baixa" },
};

const CATEGORY_CONFIG = {
  budget: { icon: DollarSign, label: "Orçamento", color: "text-green-600" },
  performance: { icon: TrendingUp, label: "Performance", color: "text-blue-600" },
  creative: { icon: ImageIcon, label: "Criativos", color: "text-purple-600" },
  audience: { icon: Users, label: "Públicos", color: "text-pink-600" },
  optimization: { icon: Settings, label: "Otimização", color: "text-orange-600" },
};

const EFFORT_LABELS = {
  low: "Rápido (5-15 min)",
  medium: "Médio (30-60 min)",
  high: "Demorado (2+ horas)",
};

// ============================================================================
// COMPONENTS
// ============================================================================

function ActionCard({ action }: { action: ActionItem }) {
  const priorityConfig = PRIORITY_CONFIG[action.priority];
  const categoryConfig = CATEGORY_CONFIG[action.category];
  const PriorityIcon = priorityConfig.icon;
  const CategoryIcon = categoryConfig.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Priority Indicator */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-full ${priorityConfig.color} flex items-center justify-center`}>
              <PriorityIcon className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-lg leading-tight">{action.title}</h3>
                {action.campaignName && (
                  <p className="text-xs text-muted-foreground mt-1">Campanha: {action.campaignName}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  <CategoryIcon className={`h-3 w-3 mr-1 ${categoryConfig.color}`} />
                  {categoryConfig.label}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-3">{action.description}</p>

            {/* Metrics */}
            <div className="flex flex-wrap gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-green-600" />
                <span className="font-medium text-green-600">{action.impact}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-muted-foreground">{EFFORT_LABELS[action.effort]}</span>
              </div>
              {action.dueDate && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <span className="text-orange-600">
                    Até {new Date(action.dueDate).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {action.actionUrl && (
                <Link to={action.actionUrl}>
                  <Button size="sm" className="gap-1">
                    Agir Agora
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="outline">
                Adiar
              </Button>
              <Button size="sm" variant="ghost">
                Ignorar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStats({ actions }: { actions: ActionItem[] }) {
  const stats = useMemo(() => {
    const critical = actions.filter((a) => a.priority === "critical").length;
    const high = actions.filter((a) => a.priority === "high").length;
    const pending = actions.filter((a) => a.status === "pending").length;
    const quickWins = actions.filter((a) => a.effort === "low").length;

    return { critical, high, pending, quickWins };
  }, [actions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Críticas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.high}</p>
              <p className="text-xs text-muted-foreground">Alta Prioridade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.quickWins}</p>
              <p className="text-xs text-muted-foreground">Vitórias Rápidas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DailyChecklist({ actions }: { actions: ActionItem[] }) {
  const quickWins = actions.filter((a) => a.effort === "low").slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Checklist Diário - Vitórias Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {quickWins.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">Parabéns! Nenhuma ação rápida pendente.</p>
              <p className="text-sm">Continue monitorando para novas oportunidades.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quickWins.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[action.priority].color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.impact}</p>
                  </div>
                  {action.actionUrl && (
                    <Link to={action.actionUrl}>
                      <Button size="sm" variant="ghost">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActionCenter() {
  const { data: actions = [], isLoading } = useActionItems();
  const [selectedTab, setSelectedTab] = useState<string>("all");

  const filteredActions = useMemo(() => {
    if (selectedTab === "all") return actions;
    if (selectedTab === "critical") return actions.filter((a) => a.priority === "critical");
    if (selectedTab === "quick") return actions.filter((a) => a.effort === "low");
    return actions.filter((a) => a.category === selectedTab);
  }, [actions, selectedTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Centro de Ações</h1>
        <p className="text-muted-foreground mt-1">
          Tarefas priorizadas para aumentar engajamento, tráfego e conversões
        </p>
      </div>

      {/* Quick Stats */}
      {!isLoading && <QuickStats actions={actions} />}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Actions List */}
        <div className="lg:col-span-2">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="critical">Críticas</TabsTrigger>
              <TabsTrigger value="quick">Rápidas</TabsTrigger>
              <TabsTrigger value="budget">Orçamento</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="creative">Criativos</TabsTrigger>
              <TabsTrigger value="optimization">Otimização</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-full bg-muted rounded animate-pulse" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredActions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">Tudo em ordem!</h3>
                    <p className="text-muted-foreground">
                      Nenhuma ação necessária nesta categoria no momento.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[800px]">
                  <div className="space-y-4 pr-4">
                    {filteredActions.map((action) => (
                      <ActionCard key={action.id} action={action} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Daily Checklist */}
          <DailyChecklist actions={actions} />

          {/* Impact Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Impacto Potencial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ações Críticas</span>
                  <Badge variant="destructive">
                    {actions.filter((a) => a.priority === "critical").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Economia Estimada</span>
                  <span className="font-semibold text-green-600">R$ 500+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Aumento de CTR</span>
                  <span className="font-semibold text-blue-600">+15%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tempo Total</span>
                  <span className="font-semibold">~2h 30min</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardHeader>
              <CardTitle className="text-sm">💡 Dica do Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Priorize ações críticas pela manhã quando os resultados são mais impactantes. Deixe
                otimizações de baixa prioridade para o final do dia.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

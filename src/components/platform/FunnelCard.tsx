import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, ShoppingCart, MessageCircle, UserPlus, MousePointer } from "lucide-react";

export interface FunnelStep {
  label: string;
  value: number;
  subtitle?: string;
}

export type FunnelType = "traffic" | "leads" | "sales" | "engagement" | "messages";

interface FunnelTypeConfig {
  label: string;
  icon: typeof TrendingDown;
  color: string;
  steps: (metrics: any) => FunnelStep[];
}

export const FUNNEL_TYPES: Record<FunnelType, FunnelTypeConfig> = {
  traffic: {
    label: "Tráfego",
    icon: MousePointer,
    color: "text-orange-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Link Clicks", value: metrics?.linkClicks ?? 0 },
      { label: "Landing Page Views", value: metrics?.landingPageViews ?? 0 },
    ],
  },
  leads: {
    label: "Geração de Leads",
    icon: UserPlus,
    color: "text-blue-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Link Clicks", value: metrics?.linkClicks ?? 0 },
      { label: "Conversas iniciadas", value: metrics?.conversationsStarted ?? 0 },
    ],
  },
  sales: {
    label: "Vendas",
    icon: ShoppingCart,
    color: "text-emerald-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Link Clicks", value: metrics?.linkClicks ?? 0 },
      { label: "Adds to Cart", value: metrics?.addToCart ?? 0 },
      { label: "Checkouts Initiated", value: metrics?.checkouts ?? 0 },
      { label: "Purchases", value: metrics?.purchases ?? 0 },
    ],
  },
  engagement: {
    label: "Engajamento",
    icon: TrendingDown,
    color: "text-purple-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Post Engagement", value: metrics?.engagements ?? 0 },
      { label: "Post Shares / Saves", value: (metrics?.shares ?? 0) + (metrics?.saves ?? 0) },
    ],
  },
  messages: {
    label: "Mensagens",
    icon: MessageCircle,
    color: "text-pink-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Link Clicks", value: metrics?.linkClicks ?? 0 },
      { label: "Messaging Conversations Started", value: metrics?.conversationsStarted ?? 0 },
    ],
  },
};

interface FunnelCardProps {
  title?: string;
  funnelType?: FunnelType;
  metrics?: any;
  loading?: boolean;
  subtitle?: string;
}

export function FunnelCard({
  title = "Funil de Conversão",
  funnelType = "traffic",
  metrics,
  loading = false,
  subtitle
}: FunnelCardProps) {
  const typeConfig = FUNNEL_TYPES[funnelType];
  const steps = typeConfig.steps(metrics);
  const Icon = typeConfig.icon;

  if (loading) {
    return (
      <Card className="border-border/50 shadow-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground text-xs">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  // Calcular percentuais e taxa de conversão
  const firstValue = steps[0]?.value || 1;
  const lastValue = steps[steps.length - 1]?.value || 0;
  const conversionRate = firstValue > 0 ? (lastValue / firstValue) * 100 : 0;

  return (
    <Card className="border-border/50 shadow-sm h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <div className={`p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30 ${typeConfig.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 ml-9">{subtitle}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-6 space-y-6">
        <div className="space-y-6 relative">
          {/* Linha vertical de conexão (opcional, para dar ideia de fluxo) */}
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-border/50 -z-10" />

          {steps.map((step, idx) => {
            const percentage = firstValue > 0 ? (step.value / firstValue) * 100 : 0;
            const prevValue = idx > 0 ? steps[idx - 1].value : step.value;
            const dropOff = idx > 0 ? ((step.value / prevValue) * 100) : 100;

            return (
              <div key={step.label} className="relative">
                <div className="flex items-start gap-4">
                  {/* Indicador de Passo */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 z-10 bg-background
                    ${idx === 0 ? 'border-blue-500 text-blue-500' :
                      idx === steps.length - 1 ? 'border-green-500 text-green-500' : 'border-muted-foreground/30 text-muted-foreground'}
                  `}>
                    <span className="text-xs font-bold">{idx + 1}</span>
                  </div>

                  {/* Conteúdo do Passo */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">{step.label}</span>
                      <span className="text-sm font-bold text-foreground">{step.value.toLocaleString("pt-BR")}</span>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${idx === 0 ? 'bg-blue-500' :
                            idx === steps.length - 1 ? 'bg-green-500' : 'bg-blue-400/70'
                          }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Detalhes de Conversão */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        {idx === 0 ? 'Total' : `${percentage.toFixed(1)}% do total`}
                      </span>
                      {idx > 0 && (
                        <span className={`font-medium ${dropOff >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                          {dropOff.toFixed(1)}% do passo anterior
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo Final */}
        <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Taxa de Conversão Global</div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {conversionRate.toFixed(2)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

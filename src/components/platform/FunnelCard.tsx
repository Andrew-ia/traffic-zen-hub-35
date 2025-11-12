import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, ShoppingCart, MessageCircle, UserPlus, MousePointer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      { label: "Cliques", value: metrics?.clicks ?? 0 },
      { label: "Visitas", value: metrics?.visits ?? 0 },
    ],
  },
  leads: {
    label: "Geração de Leads",
    icon: UserPlus,
    color: "text-blue-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Cliques", value: metrics?.clicks ?? 0 },
      { label: "Leads", value: metrics?.leads ?? 0 },
    ],
  },
  sales: {
    label: "Vendas",
    icon: ShoppingCart,
    color: "text-emerald-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Cliques", value: metrics?.clicks ?? 0 },
      { label: "Vendas", value: metrics?.sales ?? 0 },
    ],
  },
  engagement: {
    label: "Engajamento",
    icon: TrendingDown,
    color: "text-purple-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Alcance", value: metrics?.reach ?? 0 },
      { label: "Engajamentos", value: metrics?.engagements ?? 0 },
    ],
  },
  messages: {
    label: "Mensagens",
    icon: MessageCircle,
    color: "text-pink-600",
    steps: (metrics) => [
      { label: "Impressões", value: metrics?.impressions ?? 0 },
      { label: "Cliques", value: metrics?.clicks ?? 0 },
      { label: "Conversas", value: metrics?.messages ?? 0 },
    ],
  },
};

interface FunnelCardProps {
  title?: string;
  funnelType?: FunnelType;
  metrics?: any;
  onTypeChange?: (type: FunnelType) => void;
  loading?: boolean;
}

export function FunnelCard({
  title = "Funil de Conversão",
  funnelType = "traffic",
  metrics,
  onTypeChange,
  loading = false
}: FunnelCardProps) {
  const typeConfig = FUNNEL_TYPES[funnelType];
  const steps = typeConfig.steps(metrics);
  const Icon = typeConfig.icon;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className={`h-4 w-4 ${typeConfig.color}`} />
            {title}
          </CardTitle>
          {onTypeChange && (
            <Select value={funnelType} onValueChange={onTypeChange}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FUNNEL_TYPES).map(([key, config]) => {
                  const TypeIcon = config.icon;
                  return (
                    <SelectItem key={key} value={key} className="text-xs">
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-3 w-3 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* Funil visual com forma trapezoidal real */}
        <div className="relative flex flex-col items-center space-y-0 pt-4 pb-2">
          {steps.map((step, idx) => {
            const percentage = firstValue > 0 ? (step.value / firstValue) * 100 : 0;
            // Larguras decrescentes para criar efeito de funil
            const topWidth = idx === 0 ? 100 : Math.max(40, 100 - (idx * 20));
            const bottomWidth = Math.max(40, 100 - ((idx + 1) * 20));

            const colors = [
              { bg: "from-blue-500 to-blue-600", border: "border-blue-600", shadow: "shadow-blue-500/30" },
              { bg: "from-cyan-500 to-cyan-600", border: "border-cyan-600", shadow: "shadow-cyan-500/30" },
              { bg: "from-teal-500 to-teal-600", border: "border-teal-600", shadow: "shadow-teal-500/30" },
            ];
            const color = colors[idx] || colors[colors.length - 1];

            return (
              <div key={step.label} className="w-full relative" style={{ marginTop: idx > 0 ? '8px' : '0' }}>
                {/* Badge de percentual - movido para cima */}
                {idx > 0 && (
                  <div className="flex justify-center mb-1">
                    <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-md">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                )}

                {/* Forma trapezoidal usando clip-path */}
                <div className="flex justify-center">
                  <div
                    className={`relative bg-gradient-to-br ${color.bg} shadow-lg ${color.shadow} transition-all hover:scale-[1.02] hover:shadow-xl`}
                    style={{
                      width: `${topWidth}%`,
                      height: '70px',
                      clipPath: `polygon(
                        ${(100 - topWidth) / 2}% 0%,
                        ${100 - (100 - topWidth) / 2}% 0%,
                        ${100 - (100 - bottomWidth) / 2}% 100%,
                        ${(100 - bottomWidth) / 2}% 100%
                      )`,
                      marginTop: idx === 0 ? '0' : '-2px'
                    }}
                  >
                    {/* Gradiente de brilho */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/10" />

                    {/* Conteúdo */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4">
                      <span className="text-xs font-semibold mb-0.5">{step.label}</span>
                      <span className="text-lg font-bold">{step.value.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Taxa de Conversão Total */}
        <div className="mt-4 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="text-center">
            <div className="text-xs text-muted-foreground font-medium mb-1">Taxa de Conversão Total</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {conversionRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, ShoppingCart, MessageCircle, MousePointer, Target, Eye } from "lucide-react";
import { ObjectiveMetrics } from "@/hooks/usePlatformMetrics";

interface ObjectiveKPICardProps {
  data: ObjectiveMetrics;
  loading?: boolean;
}

// Mapear objetivos para ícones e cores
const objectiveConfig: Record<string, { icon: typeof UserPlus; color: string; bgColor: string; borderColor: string }> = {
  "OUTCOME_LEADS": {
    icon: UserPlus,
    color: "text-blue-600",
    bgColor: "bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20",
    borderColor: "border-l-blue-500",
  },
  "LEAD_GENERATION": {
    icon: UserPlus,
    color: "text-blue-600",
    bgColor: "bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20",
    borderColor: "border-l-blue-500",
  },
  "OUTCOME_SALES": {
    icon: ShoppingCart,
    color: "text-emerald-600",
    bgColor: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20",
    borderColor: "border-l-emerald-500",
  },
  "SALES": {
    icon: ShoppingCart,
    color: "text-emerald-600",
    bgColor: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20",
    borderColor: "border-l-emerald-500",
  },
  "CONVERSIONS": {
    icon: ShoppingCart,
    color: "text-emerald-600",
    bgColor: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20",
    borderColor: "border-l-emerald-500",
  },
  "PURCHASE": {
    icon: ShoppingCart,
    color: "text-emerald-600",
    bgColor: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20",
    borderColor: "border-l-emerald-500",
  },
  "OUTCOME_ENGAGEMENT": {
    icon: MessageCircle,
    color: "text-purple-600",
    bgColor: "bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20",
    borderColor: "border-l-purple-500",
  },
  "MESSAGES": {
    icon: MessageCircle,
    color: "text-purple-600",
    bgColor: "bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20",
    borderColor: "border-l-purple-500",
  },
  "OUTCOME_MESSAGES": {
    icon: MessageCircle,
    color: "text-purple-600",
    bgColor: "bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20",
    borderColor: "border-l-purple-500",
  },
  "OUTCOME_TRAFFIC": {
    icon: MousePointer,
    color: "text-orange-600",
    bgColor: "bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-950/20",
    borderColor: "border-l-orange-500",
  },
  "TRAFFIC": {
    icon: MousePointer,
    color: "text-orange-600",
    bgColor: "bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-950/20",
    borderColor: "border-l-orange-500",
  },
  "VIDEO_VIEWS": {
    icon: Eye,
    color: "text-pink-600",
    bgColor: "bg-gradient-to-br from-pink-50 to-transparent dark:from-pink-950/20",
    borderColor: "border-l-pink-500",
  },
};

const defaultConfig = {
  icon: Target,
  color: "text-gray-600",
  bgColor: "bg-gradient-to-br from-gray-50 to-transparent dark:from-gray-950/20",
  borderColor: "border-l-gray-500",
};

export function ObjectiveKPICard({ data, loading }: ObjectiveKPICardProps) {
  const config = objectiveConfig[data.objective] || defaultConfig;
  const Icon = config.icon;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

  return (
    <Card className={`border-l-4 ${config.borderColor} ${config.bgColor} hover:shadow-md transition-all overflow-hidden`}>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-20" />
            <div className="h-7 bg-muted animate-pulse rounded w-24" />
            <div className="h-3 bg-muted animate-pulse rounded w-16" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header com ícone e título */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">
                {data.resultLabel}
              </div>
              <div className={`opacity-40`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
            </div>

            {/* Valor principal: Resultados */}
            <div className="text-2xl font-bold">
              {formatNumber(data.totalResults)}
            </div>

            {/* Métricas secundárias */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Investimento:</span>
                <span className="font-semibold">{formatCurrency(data.totalSpend)}</span>
              </div>

              {data.avgCostPerResult !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Custo/Resultado:</span>
                  <span className="font-semibold">{formatCurrency(data.avgCostPerResult)}</span>
                </div>
              )}

              {data.avgRoas !== null && data.avgRoas > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ROAS:</span>
                  <span className="font-semibold text-emerald-600">
                    {data.avgRoas.toFixed(2)}x
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1 border-t border-border/50">
                <span className="text-muted-foreground">{data.campaignCount} campanhas</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ObjectiveKPIGridProps {
  children: React.ReactNode;
}

export function ObjectiveKPIGrid({ children }: ObjectiveKPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  );
}

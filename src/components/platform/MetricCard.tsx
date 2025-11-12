import { Card, CardContent } from "@/components/ui/card";
import { Target, DollarSign, Eye, MousePointer, Users, Zap } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
}

// Mapear métricas para ícones e cores
const metricConfig: Record<string, { icon: typeof Target; color: string; bgColor: string; borderColor: string }> = {
  "CTR": {
    icon: Target,
    color: "text-purple-600",
    bgColor: "bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20",
    borderColor: "border-l-purple-500",
  },
  "CPC": {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20",
    borderColor: "border-l-emerald-500",
  },
  "CPM": {
    icon: DollarSign,
    color: "text-blue-600",
    bgColor: "bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20",
    borderColor: "border-l-blue-500",
  },
  "Impressões": {
    icon: Eye,
    color: "text-orange-600",
    bgColor: "bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-950/20",
    borderColor: "border-l-orange-500",
  },
  "Alcance": {
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-gradient-to-br from-pink-50 to-transparent dark:from-pink-950/20",
    borderColor: "border-l-pink-500",
  },
  "Cliques": {
    icon: MousePointer,
    color: "text-indigo-600",
    bgColor: "bg-gradient-to-br from-indigo-50 to-transparent dark:from-indigo-950/20",
    borderColor: "border-l-indigo-500",
  },
};

const defaultConfig = {
  icon: Zap,
  color: "text-gray-600",
  bgColor: "bg-gradient-to-br from-gray-50 to-transparent dark:from-gray-950/20",
  borderColor: "border-l-gray-500",
};

export function MetricCard({ label, value, loading }: MetricCardProps) {
  const config = metricConfig[label] || defaultConfig;
  const Icon = config.icon;

  return (
    <Card className={`border-l-4 ${config.borderColor} ${config.bgColor} hover:shadow-md transition-all overflow-hidden`}>
      <CardContent className="p-3">
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-2.5 bg-muted animate-pulse rounded w-12" />
            <div className="h-6 bg-muted animate-pulse rounded w-16" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Header com ícone e label */}
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground font-medium">
                {label}
              </div>
              <div className="opacity-40">
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
            </div>

            {/* Valor principal */}
            <div className="text-xl font-bold">
              {value}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricsGridProps {
  children: React.ReactNode;
  columns?: 3 | 4 | 5 | 6;
}

export function MetricsGrid({ children, columns = 6 }: MetricsGridProps) {
  const gridColsClass = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }[columns];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${gridColsClass} gap-3`}>
      {children}
    </div>
  );
}

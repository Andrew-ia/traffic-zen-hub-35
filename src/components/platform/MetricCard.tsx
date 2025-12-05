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

  // Extract base color name for background opacity
  const colorClass = config.color.split('-')[1]; // e.g., "purple" from "text-purple-600"
  const bgClass = `bg-${colorClass}-100 dark:bg-${colorClass}-900/30`;

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <CardContent className="p-3">
        {loading ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-2.5 bg-muted animate-pulse rounded w-12" />
              <div className="h-6 w-6 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="h-6 bg-muted animate-pulse rounded w-16" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${bgClass} ${config.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight">
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

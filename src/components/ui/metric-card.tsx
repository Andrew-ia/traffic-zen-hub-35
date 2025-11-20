import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  variant?: "default" | "gradient" | "compact";
  className?: string;
  iconClassName?: string;
}

const metricCardVariants = {
  default: "overflow-hidden transition-all duration-300 hover:shadow-lg",
  gradient: "border-l-4 hover:shadow-md transition-all overflow-hidden",
  compact: "transition-all hover:shadow-sm"
};

const trendColors = {
  up: {
    text: "text-success",
    bg: "bg-success/10",
    icon: "text-success"
  },
  down: {
    text: "text-destructive", 
    bg: "bg-destructive/10",
    icon: "text-destructive"
  },
  neutral: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    icon: "text-muted-foreground"
  }
};

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend = "neutral",
  loading = false,
  variant = "default",
  className,
  iconClassName
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn(metricCardVariants[variant], className)}>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded w-20" />
            <div className="h-8 bg-muted animate-pulse rounded w-24" />
            {change && <div className="h-4 bg-muted animate-pulse rounded w-16" />}
          </div>
        </CardContent>
      </Card>
    );
  }

  const showTrend = trend !== "neutral" && change;
  const trendColor = trendColors[trend];

  return (
    <Card className={cn(metricCardVariants[variant], className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold break-words">{value}</p>
            
            {showTrend && (
              <p className={cn("mt-2 text-sm font-medium flex items-center gap-1", trendColor.text)}>
                {change}
              </p>
            )}
          </div>
          
          {Icon && (
            <div className={cn(
              "rounded-full p-3 flex-shrink-0 ml-3",
              showTrend ? trendColor.bg : "bg-muted"
            )}>
              <Icon className={cn("h-6 w-6", showTrend ? trendColor.icon : "text-muted-foreground", iconClassName)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
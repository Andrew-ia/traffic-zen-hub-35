import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export interface CompactKPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
}

export function CompactKPICard({ title, value, icon: Icon, trend, trendUp, loading }: CompactKPICardProps) {
  // Mapear cores baseadas no nome do ícone
  const getIconColorClass = (icon: LucideIcon) => {
    const name = icon.name;
    const colorMap: Record<string, { bg: string; text: string }> = {
      DollarSign: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
      Target: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
      TrendingUp: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
      ShoppingCart: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400" },
      Wallet: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-600 dark:text-pink-400" },
    };
    return colorMap[name] || { bg: "bg-primary/10", text: "text-primary" };
  };

  const colors = getIconColorClass(Icon);

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <CardContent className="p-4 flex items-center justify-between">
        {loading ? (
          <div className="space-y-2 w-full">
            <div className="flex justify-between">
              <div className="h-3 bg-muted animate-pulse rounded w-16" />
              <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="h-7 bg-muted animate-pulse rounded w-24" />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="text-xl font-bold tracking-tight">{value}</div>
              {trend && (
                <div className={`text-xs font-medium flex items-center gap-1 ${trendUp ? "text-green-600" : "text-red-600"}`}>
                  <span>{trendUp ? "↑" : "↓"}</span>
                  <span>{trend}</span>
                </div>
              )}
            </div>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
              <Icon className="h-4 w-4" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface CompactKPIGridProps {
  children: React.ReactNode;
}

export function CompactKPIGrid({ children }: CompactKPIGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {children}
    </div>
  );
}

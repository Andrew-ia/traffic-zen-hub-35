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
    const colorMap: Record<string, { border: string; bg: string; text: string }> = {
      DollarSign: { border: "border-l-blue-500", bg: "bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20", text: "text-blue-500" },
      Target: { border: "border-l-green-500", bg: "bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/20", text: "text-green-500" },
      TrendingUp: { border: "border-l-purple-500", bg: "bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20", text: "text-purple-500" },
      ShoppingCart: { border: "border-l-orange-500", bg: "bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-950/20", text: "text-orange-500" },
      Wallet: { border: "border-l-pink-500", bg: "bg-gradient-to-br from-pink-50 to-transparent dark:from-pink-950/20", text: "text-pink-500" },
    };
    return colorMap[name] || { border: "border-l-primary", bg: "", text: "text-primary" };
  };

  const colors = getIconColorClass(Icon);

  return (
    <Card className={`border-l-4 ${colors.border} ${colors.bg} hover:shadow-md transition-all overflow-hidden`}>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-16" />
            <div className="h-7 bg-muted animate-pulse rounded w-24" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground font-medium mb-1 truncate">
                {title}
              </div>
              <div className="text-xl font-bold truncate mb-0.5">{value}</div>
              {trend && (
                <div className={`text-xs font-medium flex items-center gap-1 ${trendUp ? "text-green-600" : "text-red-600"}`}>
                  <span>{trendUp ? "↑" : "↓"}</span>
                  <span>{trend}</span>
                </div>
              )}
            </div>
            <div className={`flex-shrink-0 opacity-20`}>
              <Icon className={`h-10 w-10 ${colors.text}`} />
            </div>
          </div>
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, trendUp, loading }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <p className={`text-xs mt-1 font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}>
                {trendUp ? "↑" : "↓"} {trend}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const gridColsClass = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }[columns];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-4`}>
      {children}
    </div>
  );
}

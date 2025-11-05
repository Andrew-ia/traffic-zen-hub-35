import { Card, CardContent } from "@/components/ui/card";

export interface MetricCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
}

export function MetricCard({ label, value, loading }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground mb-1">{label}</div>
        {loading ? (
          <div className="h-6 bg-muted animate-pulse rounded w-20" />
        ) : (
          <div className="text-lg font-semibold">{value}</div>
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

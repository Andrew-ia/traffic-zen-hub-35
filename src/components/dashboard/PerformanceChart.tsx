import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformancePoint } from "@/hooks/usePerformanceMetrics";
import { TrendingUp, MousePointer, ShoppingCart, DollarSign } from "lucide-react";

interface PerformanceChartProps {
  data?: PerformancePoint[];
  isLoading?: boolean;
}

function formatLabel(date: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface MiniChartProps {
  data: any[];
  dataKey: string;
  title: string;
  color: string;
  icon: React.ReactNode;
  formatter?: (value: number) => string;
  total: number;
  formattedTotal: string;
}

function MiniChart({ data, dataKey, title, color, icon, formatter = formatNumber, total, formattedTotal }: MiniChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-l-4 h-full" style={{ borderLeftColor: color }}>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            {icon}
            <span className="truncate">{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex h-32 sm:h-40 lg:h-[160px] items-center justify-center text-muted-foreground text-xs sm:text-sm">
            Sem dados disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 h-full" style={{ borderLeftColor: color }}>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-medium">
          {icon}
          <span className="truncate">{title}</span>
        </CardTitle>
        <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{formattedTotal}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={120} maxHeight={160}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis
              dataKey="name"
              stroke="transparent"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              hide
            />
            <YAxis
              stroke="transparent"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              hide
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [formatter(value), title]}
              labelFormatter={(label) => label}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: '100%',
                background: `linear-gradient(to right, ${color}40, ${color})`
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceChart({ data = [], isLoading = false }: PerformanceChartProps) {
  const chartData = data.map((point) => ({
    name: formatLabel(point.date),
    impressions: point.impressions,
    clicks: point.clicks,
    conversions: point.conversions,
    spend: point.spend,
  }));

  // Calculate totals
  const totals = data.reduce(
    (acc, point) => ({
      impressions: acc.impressions + point.impressions,
      clicks: acc.clicks + point.clicks,
      conversions: acc.conversions + point.conversions,
      spend: acc.spend + point.spend,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">Performance ao Longo do Tempo</h2>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-4 border-muted h-48 sm:h-52 lg:h-56">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium">Carregando...</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex h-32 sm:h-36 lg:h-40 items-center justify-center">
                  <div className="animate-pulse text-muted-foreground text-lg">⏳</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">Performance ao Longo do Tempo</h2>
        {chartData.length > 1 && (
          <p className="text-xs sm:text-sm text-muted-foreground">
            Últimos {chartData.length} dias
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
        <MiniChart
          data={chartData}
          dataKey="impressions"
          title="Impressões"
          color="hsl(221, 83%, 53%)"
          icon={<TrendingUp className="h-4 w-4" />}
          total={totals.impressions}
          formattedTotal={formatNumber(totals.impressions)}
        />

        <MiniChart
          data={chartData}
          dataKey="clicks"
          title="Cliques"
          color="hsl(142, 76%, 36%)"
          icon={<MousePointer className="h-4 w-4" />}
          total={totals.clicks}
          formattedTotal={formatNumber(totals.clicks)}
        />

        <MiniChart
          data={chartData}
          dataKey="conversions"
          title="Conversões"
          color="hsl(262, 83%, 58%)"
          icon={<ShoppingCart className="h-4 w-4" />}
          total={totals.conversions}
          formattedTotal={formatNumber(totals.conversions)}
        />

        <MiniChart
          data={chartData}
          dataKey="spend"
          title="Investimento"
          color="hsl(24, 95%, 53%)"
          icon={<DollarSign className="h-4 w-4" />}
          formatter={formatCurrency}
          total={totals.spend}
          formattedTotal={formatCurrency(totals.spend)}
        />
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformancePoint } from "@/hooks/usePerformanceMetrics";

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

export function PerformanceChart({ data = [], isLoading = false }: PerformanceChartProps) {
  const chartData = data.map((point) => ({
    name: formatLabel(point.date),
    impressões: point.impressions,
    cliques: point.clicks,
    conversões: point.conversions,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance ao Longo do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">
            Carregando métricas...
          </div>
        ) : chartData.length <= 1 ? (
          <div className="flex h-[350px] items-center justify-center text-muted-foreground text-sm text-center px-6">
            Ainda não temos séries suficientes para desenhar o gráfico. Assim que houver novos pontos, você verá a linha completa aqui.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Line
                type="monotone"
                dataKey="impressões"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-1))" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="cliques"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-2))" }}
              />
              <Line
                type="monotone"
                dataKey="conversões"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-3))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TimeSeriesDataPoint } from "@/hooks/usePlatformMetrics";

interface PerformanceChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  description?: string;
  loading?: boolean;
  metric: "spend" | "results" | "revenue";
  labelOverride?: string;
}

const metricConfig = {
  spend: {
    label: "Investimento",
    color: "#3b82f6",
    format: (value: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value),
  },
  results: {
    label: "Resultados",
    color: "#10b981",
    format: (value: number) => new Intl.NumberFormat("pt-BR").format(value),
  },
  revenue: {
    label: "Receita",
    color: "#8b5cf6",
    format: (value: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value),
  },
};

export function PerformanceChart({
  data,
  title = "Performance ao Longo do Tempo",
  description,
  loading = false,
  metric,
  labelOverride,
}: PerformanceChartProps) {
  const config = metricConfig[metric];
  const lineLabel = labelOverride || config.label;

  // Formatar dados para o gráfico
  // Forçar interpretação da data como UTC para evitar problemas de timezone
  const chartData = data.map((point) => {
    // Parse manual para garantir que a data seja tratada como UTC
    const [year, month, day] = point.date.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      date: date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC", // Forçar UTC para manter a data original
      }),
      value: point[metric],
    };
  });

  // Se não há título ou descrição, renderize apenas o gráfico (modo compacto)
  if (!title && !description) {
    return loading ? (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-xs">Carregando...</div>
      </div>
    ) : chartData.length === 0 ? (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
        Nenhum dado disponível
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickFormatter={(value) => config.format(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [config.format(value), lineLabel]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={lineLabel}
            stroke={config.color}
            strokeWidth={2}
            dot={{ fill: config.color, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => config.format(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--foreground))",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [config.format(value), lineLabel]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name={lineLabel}
                stroke={config.color}
                strokeWidth={2}
                dot={{ fill: config.color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

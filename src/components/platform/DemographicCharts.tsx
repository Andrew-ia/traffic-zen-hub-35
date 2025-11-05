import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface DemographicData {
  name: string;
  value: number;
  percentage?: number;
}

interface DemographicChartsProps {
  ageData?: DemographicData[];
  genderData?: DemographicData[];
  loading?: boolean;
}

const AGE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];
const GENDER_COLORS = {
  Male: "#3b82f6",
  Female: "#ec4899",
  Unknown: "#94a3b8",
  Masculino: "#3b82f6",
  Feminino: "#ec4899",
  Desconhecido: "#94a3b8",
};

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

export function DemographicCharts({ ageData = [], genderData = [], loading = false }: DemographicChartsProps) {
  const hasAgeData = ageData.length > 0;
  const hasGenderData = genderData.length > 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Idade</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Gênero</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Demografia</CardTitle>
        <CardDescription className="text-xs">Distribuição do público</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        {/* Gráfico de Idade Compacto */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Faixa Etária</p>
          {!hasAgeData ? (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
              Dados não disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={ageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percentage }) => `${formatPercentage(percentage || 0)}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legenda customizada */}
          {hasAgeData && (
            <div className="grid grid-cols-2 gap-1 mt-2">
              {ageData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: AGE_COLORS[index % AGE_COLORS.length] }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="border-t" />

        {/* Gráfico de Gênero Compacto */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Gênero</p>
          {!hasGenderData ? (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
              Dados não disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percentage }) => `${formatPercentage(percentage || 0)}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={GENDER_COLORS[entry.name as keyof typeof GENDER_COLORS] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legenda customizada */}
          {hasGenderData && (
            <div className="grid grid-cols-2 gap-1 mt-2">
              {genderData.map((item) => (
                <div key={item.name} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: GENDER_COLORS[item.name as keyof typeof GENDER_COLORS] || "#94a3b8" }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

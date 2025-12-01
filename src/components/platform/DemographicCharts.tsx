import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

// Paleta de cores moderna e profissional (Traffic Pro Blue Theme)
const AGE_COLORS = [
  "#3b82f6", // Blue 500
  "#0ea5e9", // Sky 500
  "#06b6d4", // Cyan 500
  "#14b8a6", // Teal 500
  "#6366f1", // Indigo 500
  "#8b5cf6", // Violet 500
];

const GENDER_COLORS = {
  Male: "#3b82f6", // Blue 500
  Female: "#ec4899", // Pink 500
  Unknown: "#94a3b8", // Slate 400
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
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Distribuição por Idade</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
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
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Demografia</CardTitle>
        <CardDescription className="text-xs">Distribuição do público</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6 pb-6">
        {/* Gráfico de Idade Compacto */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">Faixa Etária</p>
          </div>
          {!hasAgeData ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
              Dados não disponíveis
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-[160px] w-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
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
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda customizada à direita */}
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                {ageData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: AGE_COLORS[index % AGE_COLORS.length] }}
                      />
                      <span className="text-muted-foreground truncate max-w-[80px]">{item.name}</span>
                    </div>
                    <span className="font-medium">{formatPercentage(item.percentage || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="border-t border-border/50" />

        {/* Gráfico de Gênero Compacto */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">Gênero</p>
          </div>
          {!hasGenderData ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
              Dados não disponíveis
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-[160px] w-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
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
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda customizada à direita */}
              <div className="flex-1 space-y-2">
                {genderData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: GENDER_COLORS[item.name as keyof typeof GENDER_COLORS] || "#94a3b8" }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium">{formatPercentage(item.percentage || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente separado para só Faixa Etária
export function AgeChart({ ageData = [], loading = false }: { ageData?: DemographicData[]; loading?: boolean }) {
  const hasAgeData = ageData.length > 0;

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Faixa Etária</CardTitle>
        <CardDescription className="text-xs">Distribuição por idade</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center p-6">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            Carregando dados...
          </div>
        ) : !hasAgeData ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
            Dados não disponíveis
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-[180px] w-[180px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
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
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda em Grid */}
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2">
              {ageData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: AGE_COLORS[index % AGE_COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-medium">{formatPercentage(item.percentage || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente separado para só Gênero
export function GenderChart({ genderData = [], loading = false }: { genderData?: DemographicData[]; loading?: boolean }) {
  const hasGenderData = genderData.length > 0;

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Gênero</CardTitle>
        <CardDescription className="text-xs">Distribuição por gênero</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center p-6">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            Carregando dados...
          </div>
        ) : !hasGenderData ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
            Dados não disponíveis
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-[180px] w-[180px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
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
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString("pt-BR")} (${formatPercentage(props.payload.percentage || 0)})`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda em Lista */}
            <div className="w-full max-w-[200px] space-y-2">
              {genderData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: GENDER_COLORS[item.name as keyof typeof GENDER_COLORS] || "#94a3b8" }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{formatPercentage(item.percentage || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

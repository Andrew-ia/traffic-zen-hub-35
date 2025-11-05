import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";

export interface FunnelStep {
  label: string;
  value: number;
  subtitle?: string;
}

interface FunnelCardProps {
  title?: string;
  steps: FunnelStep[];
  loading?: boolean;
}

export function FunnelCard({ title = "Funil de Conversão", steps, loading = false }: FunnelCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{ title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground text-xs">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  // Calcular percentuais e taxa de conversão
  const firstValue = steps[0]?.value || 1;
  const lastValue = steps[steps.length - 1]?.value || 0;
  const conversionRate = firstValue > 0 ? (lastValue / firstValue) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* Funil visual - barras com largura decrescente e animação */}
        <div className="relative flex flex-col items-center space-y-2">
          {steps.map((step, idx) => {
            const percentage = firstValue > 0 ? (step.value / firstValue) * 100 : 0;
            const width = Math.max(30, percentage);
            const colors = [
              "from-blue-400 to-blue-600",
              "from-cyan-400 to-cyan-600",
              "from-teal-400 to-teal-600",
            ];

            return (
              <div key={step.label} className="w-full space-y-1">
                <div className="flex items-center justify-center">
                  <div
                    className={`bg-gradient-to-r ${colors[idx]} rounded-lg py-3 px-4 flex items-center justify-between text-white shadow-lg transition-all hover:scale-[1.02] relative`}
                    style={{
                      width: `${width}%`,
                      minWidth: "120px"
                    }}
                  >
                    {/* Sombra interna */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-lg" />

                    <span className="text-xs font-semibold truncate relative z-10">{step.label}</span>
                    <span className="text-sm font-bold ml-2 relative z-10">{step.value.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                {step.subtitle && (
                  <div className="text-[10px] text-muted-foreground text-center">{step.subtitle}</div>
                )}

                {/* Seta e taxa de conversão */}
                {idx < steps.length - 1 && steps[idx + 1] && (
                  <div className="flex flex-col items-center py-1">
                    <TrendingDown className="h-4 w-4 text-muted-foreground/50" />
                    <div className="text-[11px] font-medium text-muted-foreground">
                      {((steps[idx + 1].value / step.value) * 100).toFixed(1)}% converteram
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Connect Rate Destacado */}
        <div className="mt-4 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="text-center">
            <div className="text-xs text-muted-foreground font-medium mb-1">Taxa de Conversão Total</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {conversionRate.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Ícone decorativo de moedas */}
        <div className="flex justify-center gap-1 text-2xl opacity-60">
          💰💰💰
        </div>
      </CardContent>
    </Card>
  );
}


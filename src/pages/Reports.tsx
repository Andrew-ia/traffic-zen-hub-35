import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizationInsights } from "@/components/insights/OptimizationInsights";
import { useReportsData } from "@/hooks/useReportsData";

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercentDelta(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function computeDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function getDeltaTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-muted-foreground";
  return value >= 0 ? "text-success" : "text-destructive";
}

export default function Reports() {
  const {
    data: reports,
    isLoading,
    error,
  } = useReportsData();

  const summary = reports?.summary;
  const spendDelta = summary ? computeDelta(summary.current.spend, summary.previous.spend) : null;
  const ctrDelta = summary ? computeDelta(summary.current.ctr, summary.previous.ctr) : null;
  const cpaDelta = summary ? computeDelta(summary.previous.cpa, summary.current.cpa) : null; // redução de CPA é positiva
  const roasDelta = summary ? computeDelta(summary.current.roas, summary.previous.roas) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise detalhada do desempenho das campanhas</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Investimento (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{formatCurrency(summary?.current.spend ?? 0)}</div>
            )}
            <p className={`text-sm mt-2 ${getDeltaTone(spendDelta)}`}>
              {formatPercentDelta(spendDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CTR</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{`${(summary?.current.ctr ?? 0).toFixed(2)}%`}</div>
            )}
            <p className={`text-sm mt-2 ${getDeltaTone(ctrDelta)}`}>
              {formatPercentDelta(ctrDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CPA Médio</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{formatCurrency(summary?.current.cpa ?? 0)}</div>
            )}
            <p className={`text-sm mt-2 ${getDeltaTone(cpaDelta)}`}>
              {formatPercentDelta(cpaDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>ROAS</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.roas ?? 0).toFixed(2)}x</div>
            )}
            <p className={`text-sm mt-2 ${getDeltaTone(roasDelta)}`}>
              {formatPercentDelta(roasDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversões (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.conversationsStarted ?? summary?.current.conversions ?? 0).toLocaleString("pt-BR")}</div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              Conexões de mensagem: {(summary?.current.messagingConnections ?? 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impressões (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.impressions ?? 0).toLocaleString("pt-BR")}</div>
            )}
            <p className="text-sm text-muted-foreground mt-2">Total de impressões agregadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Insights & Ações</h2>
        <OptimizationInsights />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">Não foi possível carregar os dados de relatório. {error.message}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

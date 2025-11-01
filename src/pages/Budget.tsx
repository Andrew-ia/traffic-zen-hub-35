import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { Plus } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Budget() {
  const { data, isLoading, error } = useBudgetOverview();

  const overview = data ?? {
    totalDailyBudget: 0,
    totalLifetimeBudget: 0,
    totalSpend: 0,
    availableBudget: 0,
    utilization: 0,
    items: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Orçamento</h1>
          <p className="text-muted-foreground mt-1">
            Controle e acompanhe orçamento, gastos e ritmo de investimento
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Orçamento
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">
              Não foi possível carregar os dados de orçamento. Verifique suas permissões no Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Orçamento Referência (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(overview.totalLifetimeBudget)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Gasto (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(overview.totalSpend)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-success">{formatCurrency(overview.availableBudget)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">% Utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{overview.utilization.toFixed(1)}%</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orçamento por Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : overview.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum orçamento encontrado. Sincronize suas contas para visualizar esses dados.
            </p>
          ) : (
            overview.items.map((item) => {
              const capacity = item.lifetimeBudget > 0 ? item.lifetimeBudget : item.dailyBudget * 30;
              return (
                <div key={item.platformAccountId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.platformName}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.spend)} / {formatCurrency(capacity)}
                    </span>
                  </div>
                  <Progress value={item.utilization} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {item.utilization.toFixed(1)}% do orçamento utilizado (base 30 dias)
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

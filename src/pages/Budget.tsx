import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { useBillingTransactions, type BillingTransaction } from "@/hooks/useBillingTransactions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownToLine, Loader2, MoreHorizontal, RefreshCcw } from "lucide-react";

const TIMEFRAME_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Últimos 12 meses" },
] as const;

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function humanizeStatus(status: string | null) {
  if (!status) return "Desconhecido";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "paid":
      return "Pago";
    case "pending":
      return "Pendente";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function statusVariant(status: string | null) {
  const normalized = status?.toLowerCase();
  if (normalized === "paid") return "success";
  if (normalized === "pending") return "secondary";
  if (normalized === "failed") return "destructive";
  return "outline";
}

function paymentMethodLabel(transaction: BillingTransaction | undefined) {
  if (!transaction) return "—";
  const details = transaction.paymentMethodDetails ?? {};
  const display = typeof details.display_string === "string" ? details.display_string : null;
  if (display && display.trim().length > 0) return display;

  const lastFour =
    typeof details.last_four === "string"
      ? details.last_four
      : typeof details.card_last_four === "string"
        ? details.card_last_four
        : null;

  if (transaction.paymentMethodType && lastFour) {
    return `${transaction.paymentMethodType} •••• ${lastFour}`;
  }

  return transaction.paymentMethodType ?? "—";
}

function deriveTimeRange(timeframe: string) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);

  switch (timeframe) {
    case "7":
      start.setDate(start.getDate() - 6);
      break;
    case "30":
      start.setDate(start.getDate() - 29);
      break;
    case "90":
      start.setDate(start.getDate() - 89);
      break;
    case "all":
    default:
      start.setDate(start.getDate() - 364);
      break;
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function Budget() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get("account") ?? "all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(searchParams.get("timeframe") ?? "30");

  const { startDate, endDate } = useMemo(
    () => deriveTimeRange(selectedTimeframe),
    [selectedTimeframe],
  );

  const {
    data: overview,
    isLoading: isLoadingAccounts,
    error: accountsError,
  } = useBudgetOverview();

  const accounts = useMemo(() => overview?.accounts ?? [], [overview?.accounts]);
  useEffect(() => {
    if (selectedAccountId !== "all" && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId("all");
      const next = new URLSearchParams();
      next.set("account", "all");
      next.set("timeframe", selectedTimeframe);
      setSearchParams(next, { replace: true });
    }
  }, [accounts, selectedAccountId, selectedTimeframe, setSearchParams]);
  const selectedAccount = selectedAccountId === "all" ? undefined : selectedAccountId;

  const {
    data: billingData,
    isLoading: isLoadingBilling,
    error: billingError,
    isRefetching,
    refetch,
  } = useBillingTransactions({
    accountId: selectedAccount,
    startDate,
    endDate,
  });
  const [isSyncingBilling, setIsSyncingBilling] = useState(false);

  const transactions = billingData?.transactions ?? [];
  const summary = billingData?.summary ?? {
    totalAmount: 0,
    transactionCount: 0,
    topPaymentMethod: null,
    lastTransaction: null,
    currency: "BRL",
  };

  const handleRefresh = async () => {
    const syncDays = selectedTimeframe === "all" ? 365 : Number(selectedTimeframe);
    setIsSyncingBilling(true);

    try {
      const response = await fetch("/api/integrations/billing/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ days: syncDays }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (payload && typeof payload === "object" && "error" in payload ? String(payload.error) : null) ??
          "Falha ao sincronizar cobranças no Meta.";
        throw new Error(message);
      }

      const data = payload && typeof payload === "object" && "data" in payload ? (payload as any).data : null;

      toast({
        title: "Cobranças sincronizadas",
        description: data
          ? `Foram processadas ${data.transactionsUpserted ?? 0} transações (${data.sinceDate} → ${data.untilDate}).`
          : "Transações atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Failed to sync billing transactions:", error);
      toast({
        title: "Erro ao sincronizar",
        description: error instanceof Error ? error.message : "Não foi possível atualizar as cobranças.",
        variant: "destructive",
      });
      setIsSyncingBilling(false);
      return;
    }

    try {
      const response = await refetch();
      if (response.error) {
        throw response.error;
      }
    } catch (error) {
      console.error("Failed to refresh table after sync:", error);
      toast({
        title: "Erro ao atualizar painel",
        description: "As transações foram sincronizadas, mas não foi possível recarregar a tabela.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingBilling(false);
    }
  };

  const isEmpty = !isLoadingBilling && transactions.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cobranças & Pagamentos</h1>
          <p className="text-muted-foreground mt-1">
            Visualize quanto foi debitado da conta de anúncios e acompanhe as formas de pagamento utilizadas.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Conta</span>
            <Select
              value={selectedAccountId}
              onValueChange={(value) => {
                setSelectedAccountId(value);
                const next = new URLSearchParams(searchParams);
                next.set("account", value);
                setSearchParams(next, { replace: true });
              }}
              disabled={isLoadingAccounts || accounts.length === 0}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Período</span>
            <Select
              value={selectedTimeframe}
              onValueChange={(value) => {
                setSelectedTimeframe(value);
                const next = new URLSearchParams(searchParams);
                next.set("timeframe", value);
                setSearchParams(next, { replace: true });
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={isSyncingBilling || isRefetching}>
            {isSyncingBilling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {isSyncingBilling ? "Sincronizando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {(accountsError || billingError) && (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">
              {accountsError?.message ??
                billingError?.message ??
                "Não foi possível carregar as informações de cobrança."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valor pago no período</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBilling ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalAmount, summary.currency ?? "BRL")}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Total debitado entre {formatDate(`${startDate}T00:00:00`)} e {formatDate(`${endDate}T00:00:00`)}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Número de transações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBilling ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary.transactionCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Quantidade de cobranças registradas no período.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Última cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBilling ? (
              <Skeleton className="h-8 w-40" />
            ) : summary.lastTransaction ? (
              <div>
                <p className="text-lg font-semibold">
                  {formatCurrency(summary.lastTransaction.amount, summary.lastTransaction.currency ?? "BRL")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(summary.lastTransaction.transactionTime)} •{" "}
                  {formatDistanceToNow(new Date(summary.lastTransaction.transactionTime ?? ""), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Método mais utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBilling ? (
              <Skeleton className="h-8 w-32" />
            ) : summary.topPaymentMethod ? (
              <div className="text-2xl font-bold">{summary.topPaymentMethod}</div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de pagamento suficientes.</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Método com maior recorrência nas cobranças.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
          <div>
            <CardTitle className="text-base font-semibold">Atividade de pagamento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Histórico de cobranças registradas direto da API de pagamentos do Meta Ads.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm">
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingBilling ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isEmpty ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cobrança encontrada para o período selecionado. Ajuste os filtros ou aguarde novas transações.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Forma de pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-xs">{transaction.externalId}</TableCell>
                    <TableCell>{formatDate(transaction.transactionTime)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.amount, transaction.currency ?? "BRL")}
                    </TableCell>
                    <TableCell>{paymentMethodLabel(transaction)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(transaction.paymentStatus)}>
                        {humanizeStatus(transaction.paymentStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transaction.billingReason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              void navigator.clipboard.writeText(transaction.externalId);
                              toast({
                                title: "ID copiado",
                                description: `${transaction.externalId} copiado para a área de transferência.`,
                              });
                            }}
                          >
                            Copiar ID
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => {
                              toast({
                                title: "Download indisponível",
                                description: "Integração com nota fiscal ainda não configurada.",
                                variant: "destructive",
                              });
                            }}
                          >
                            Baixar comprovante
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

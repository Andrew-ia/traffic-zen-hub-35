import { useState, useMemo, useEffect } from "react";
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Package,
    AlertCircle,
    RefreshCcw,
    Eye,
    MessageCircle,
    Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    useMercadoLivreMetrics,
    useMercadoLivreFullAnalytics,
    useMercadoLivreProducts,
    useMercadoLivreQuestions,
    useSyncMercadoLivre
} from "@/hooks/useMercadoLivre";
import { useMercadoLivreDailySales } from "@/hooks/useMercadoLivreOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { DailySalesChart } from "@/components/mercadolivre/DailySalesChart";
import { TopProductsChart } from "@/components/mercadolivre/TopProductsChart";
import { FinancialAnalysis } from "@/components/mercadolivre/FinancialAnalysis";
import { LowStockAlerts } from "@/components/mercadolivre/LowStockAlerts";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import MercadoLivreConnectButton from "@/components/MercadoLivreConnectButton";
import { supabase } from "@/lib/supabaseClient";
import { MetricComparison } from "@/components/mercadolivre/MetricComparison";
import { ExportReportButton } from "@/components/mercadolivre/ExportReportButton";
import { TodayShipments } from "@/components/mercadolivre/TodayShipments";

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const formatCurrency = (value: number, fractionDigits = 0) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: fractionDigits,
    }).format(value);

export default function MercadoLivre() {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState("30");
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        (import.meta.env.VITE_WORKSPACE_ID as string) || null
    );
    const [replaying, setReplaying] = useState(false);
    const [targetProfit, setTargetProfit] = useState<number>(5000);

    // Obter workspace_id
    useEffect(() => {
        const fetchWorkspace = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: memberData } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .single();

                if (memberData) {
                    setWorkspaceId(memberData.workspace_id);
                }
            }
        };
        fetchWorkspace();
    }, []);

    // Datas para comparação
    const dateRangeNumber = parseInt(dateRange);
    const currentDate = useMemo(() => new Date(), []);
    const startDate = subDays(currentDate, dateRangeNumber);
    const previousStartDate = subDays(startDate, dateRangeNumber);

    const period = useMemo(() => ({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(currentDate, 'yyyy-MM-dd')
    }), [startDate, currentDate]);

    const previousPeriod = useMemo(() => ({
        start_date: format(previousStartDate, 'yyyy-MM-dd'),
        end_date: format(startDate, 'yyyy-MM-dd')
    }), [previousStartDate, startDate]);

    // Hooks de dados
    const { data: metrics, isLoading: metricsLoading } = useMercadoLivreMetrics(
        workspaceId,
        dateRangeNumber,
        { dateFrom: period.start_date, dateTo: period.end_date }
    );
    const { data: previousMetrics, isLoading: previousMetricsLoading } = useMercadoLivreMetrics(
        workspaceId,
        dateRangeNumber,
        { dateFrom: previousPeriod.start_date, dateTo: previousPeriod.end_date }
    );
    const { data: products, isLoading: productsLoading } = useMercadoLivreProducts(workspaceId);
    const { data: fullAnalyticsProducts, isLoading: fullAnalyticsLoading } = useMercadoLivreFullAnalytics(workspaceId);
    const { data: questions, isLoading: questionsLoading } = useMercadoLivreQuestions(workspaceId, dateRangeNumber);
    const { data: dailySales, isLoading: dailySalesLoading } = useMercadoLivreDailySales(
        workspaceId,
        period.start_date,
        period.end_date
    );
    const syncMutation = useSyncMercadoLivre();

    const handleSyncData = async () => {
        if (!workspaceId) return;
        try {
            await syncMutation.mutateAsync(workspaceId);
            toast.success("Sincronização iniciada com sucesso!");
        } catch (error) {
            toast.error("Erro ao iniciar sincronização.");
        }
    };

    const handleReplayNotifications = async () => {
        if (!workspaceId) {
            toast.error("Workspace não identificado para reenviar notificações.");
            return;
        }
        setReplaying(true);
        try {
            const resp = await fetch("/api/integrations/mercadolivre/notifications/replay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    days: 1,
                    maxOrders: 200,
                    dryRun: false
                })
            });
            const data = await resp.json();
            if (!resp.ok || data?.error) {
                throw new Error(data?.error || "Falha ao reenviar notificações");
            }
            const sent = Number(data?.sent || 0);
            const skipped = Number(data?.skippedAlreadySent || 0);
            const period = data?.period ? `${data.period.from} até ${data.period.to}` : "hoje";
            toast.success(`Reenvio concluído: enviados ${sent}, ignorados ${skipped} (${period})`);
        } catch (e: any) {
            toast.error(e?.message || "Erro ao reenviar notificações.");
        } finally {
            setReplaying(false);
        }
    };

    // Cálculos de totais
    const totalRevenue = metrics?.totalRevenue ?? 0;
    const totalSales = metrics?.totalSales ?? 0;
    const totalVisits = metrics?.totalVisits ?? 0;
    const totalOrders = metrics?.totalOrders ?? 0;
    const conversionRate = metrics?.conversionRate ?? 0;
    const totalQuestions = questions?.total ?? 0;
    const activeProducts = products?.activeCount ?? 0;
    const averageUnitPrice = metrics?.averageUnitPrice ?? (totalSales > 0 ? totalRevenue / totalSales : 0);
    const averageOrderPrice = metrics?.averageOrderPrice ?? (totalOrders > 0 ? totalRevenue / totalOrders : 0);
    const canceledOrders = metrics?.canceledOrders ?? 0;

    const stockPlanning = useMemo(() => {
        const items = (fullAnalyticsProducts ?? []).map((item) => {
            const availableQty = Number(item.available_quantity ?? 0);
            const price = Number(item.price ?? 0);
            const unitProfit = Number(item.profit_unit ?? 0);
            const stockRevenue = price * availableQty;
            const stockProfit = unitProfit * availableQty;
            const unitsToTarget = unitProfit > 0 && targetProfit > 0
                ? Math.ceil(targetProfit / unitProfit)
                : null;
            const stockGap = unitsToTarget !== null ? Math.max(0, unitsToTarget - availableQty) : null;

            return {
                ...item,
                availableQty,
                price,
                unitProfit,
                stockRevenue,
                stockProfit,
                unitsToTarget,
                stockGap,
            };
        });

        const totalStockRevenue = items.reduce((acc, item) => acc + item.stockRevenue, 0);
        const totalStockProfit = items.reduce((acc, item) => acc + item.stockProfit, 0);
        const profitableItems = items.filter((item) => item.unitProfit > 0);
        const avgUnitProfit = profitableItems.length > 0
            ? profitableItems.reduce((acc, item) => acc + item.unitProfit, 0) / profitableItems.length
            : 0;
        const perUnitValue = averageUnitPrice > 0 ? averageUnitPrice : avgUnitProfit;
        const estimatedProfitToDate = perUnitValue * totalSales;
        const remainingValueTarget = targetProfit > 0
            ? Math.max(0, targetProfit - estimatedProfitToDate)
            : 0;

        const topRevenue = [...items].sort((a, b) => b.stockRevenue - a.stockRevenue).slice(0, 5);
        const targetRanking = items
            .filter((item) => item.unitsToTarget !== null && item.unitProfit > 0)
            .sort((a, b) => {
                const diff = (a.unitsToTarget ?? 0) - (b.unitsToTarget ?? 0);
                if (diff !== 0) return diff;
                return b.unitProfit - a.unitProfit;
            })
            .slice(0, 5);

        const unitsToTargetFromAveragePrice = perUnitValue > 0
            ? Math.ceil(remainingValueTarget / perUnitValue)
            : null;

        return {
            items,
            totalStockRevenue,
            totalStockProfit,
            topRevenue,
            targetRanking,
            estimatedProfitToDate,
            remainingProfitTarget: remainingValueTarget,
            unitsToTargetFromAveragePrice,
            avgUnitProfit,
            perUnitValue,
        };
    }, [fullAnalyticsProducts, targetProfit, totalSales, averageUnitPrice]);
    const hasFullAnalytics = (fullAnalyticsProducts?.length ?? 0) > 0;

    return (
        <div className="space-y-6 pb-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/40 pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3 text-foreground/90">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <ShoppingBag className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
                        </div>
                        Mercado Livre
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground ml-1">
                        Hub principal com as informações mais importantes do Mercado Livre
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <PlatformFilters
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        accountFilter="all"
                        onAccountFilterChange={() => { }}
                        accounts={[]}
                        statusFilter="all"
                        onStatusFilterChange={() => { }}
                        search=""
                        onSearchChange={() => { }}
                    />
                    <div className="flex items-center gap-2">
                        <MercadoLivreConnectButton size="sm" variant="outline" className="h-9" />
                        <Button
                            onClick={handleSyncData}
                            size="sm"
                            variant="default"
                            className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            disabled={syncMutation.isPending}
                        >
                            <RefreshCcw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            {syncMutation.isPending ? 'Sync' : 'Sincronizar'}
                        </Button>
                        <Button
                            onClick={handleReplayNotifications}
                            size="sm"
                            variant="outline"
                            className="gap-2 h-9"
                            disabled={replaying || !workspaceId}
                            title="Reenviar notificações de vendas de ontem e hoje para o Telegram"
                        >
                            <RefreshCcw className={`h-4 w-4 ${replaying ? 'animate-spin' : ''}`} />
                            {replaying ? 'Reenviando...' : 'Reenviar notificações (Ontem e Hoje)'}
                        </Button>
                        {workspaceId && (
                            <ExportReportButton
                                workspaceId={workspaceId}
                                dateRange={dateRange}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metricsLoading ? (
                    [...Array(4)].map((_, i) => (
                        <Card key={i} className="border-border/50 shadow-sm h-32">
                            <CardContent className="p-6">
                                <Skeleton className="h-4 w-24 mb-4" />
                                <Skeleton className="h-8 w-32" />
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <>
                        <CompactKPICard
                            title="Vendas brutas"
                            value={new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                                maximumFractionDigits: 0,
                            }).format(totalRevenue)}
                            icon={DollarSign}
                            loading={metricsLoading}
                        />
                        <CompactKPICard
                            title="Unidades vendidas"
                            value={new Intl.NumberFormat("pt-BR").format(totalSales)}
                            icon={ShoppingBag}
                            loading={metricsLoading}
                        />
                        <CompactKPICard
                            title="Visitas"
                            value={new Intl.NumberFormat("pt-BR").format(totalVisits)}
                            icon={Eye}
                            loading={metricsLoading}
                        />
                        <CompactKPICard
                            title="Conversão"
                            value={conversionRate ? `${conversionRate.toFixed(2)}%` : "-"}
                            icon={TrendingUp}
                            loading={metricsLoading}
                        />
                    </>
                )}
            </div>

            {/* Secondary KPIs */}
            {!metricsLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CompactKPICard
                        title="Preço médio por unidade"
                        value={new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 2,
                        }).format(averageUnitPrice || 0)}
                        icon={DollarSign}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Preço médio por venda"
                        value={new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 2,
                        }).format(averageOrderPrice || 0)}
                        icon={DollarSign}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Quantidade de vendas"
                        value={new Intl.NumberFormat("pt-BR").format(totalOrders)}
                        icon={Package}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Vendas canceladas"
                        value={new Intl.NumberFormat("pt-BR").format(canceledOrders)}
                        icon={AlertCircle}
                        loading={metricsLoading}
                    />
                </div>
            )}

            {/* Main Content Layout - 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Main Column (Sales & Products) - 2/3 width */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Top Products Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TopProductsChart
                            products={products?.items || []}
                            loading={productsLoading}
                            type="sales"
                        />
                        <TopProductsChart
                            products={products?.items || []}
                            loading={productsLoading}
                            type="visits"
                        />
                    </div>

                    {/* Vendas Diárias */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                                Vendas Diárias
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <DailySalesChart
                                data={dailySales?.dailySales || []}
                                loading={dailySalesLoading}
                            />
                        </CardContent>
                    </Card>

                    {/* Comparação vs Período Anterior - movido para logo abaixo das vendas diárias */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <RefreshCcw className="h-4 w-4 text-purple-500" />
                                Comparação vs Período Anterior ({dateRange} dias)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricComparison
                                    title="Receita"
                                    currentValue={totalRevenue}
                                    previousValue={previousMetrics?.totalRevenue || 0}
                                    format="currency"
                                    loading={metricsLoading || previousMetricsLoading}
                                    icon={<DollarSign className="h-4 w-4" />}
                                />
                                <MetricComparison
                                    title="Vendas"
                                    currentValue={totalSales}
                                    previousValue={previousMetrics?.totalSales || 0}
                                    format="number"
                                    loading={metricsLoading || previousMetricsLoading}
                                    icon={<ShoppingBag className="h-4 w-4" />}
                                />
                                <MetricComparison
                                    title="Visitas"
                                    currentValue={totalVisits}
                                    previousValue={previousMetrics?.totalVisits || 0}
                                    format="number"
                                    loading={metricsLoading || previousMetricsLoading}
                                    icon={<Eye className="h-4 w-4" />}
                                />
                                <MetricComparison
                                    title="Taxa de Conversão"
                                    currentValue={conversionRate}
                                    previousValue={previousMetrics?.conversionRate || 0}
                                    format="percentage"
                                    loading={metricsLoading || previousMetricsLoading}
                                    icon={<TrendingUp className="h-4 w-4" />}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Planejamento de caixa e lucro */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-amber-500" />
                                    Planejamento de caixa e lucro
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Veja quanto entra se zerar o estoque e quantas unidades faltam para bater sua meta de lucro.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">Meta de lucro</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={targetProfit}
                                    onChange={(e) => setTargetProfit(Number(e.target.value) || 0)}
                                    className="h-9 w-28 text-right"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9"
                                    onClick={() => navigate("/mercado-livre/full-analytics")}
                                >
                                    Ver Analytics Full
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9"
                                    onClick={() => navigate("/mercado-livre-price-calculator")}
                                >
                                    Simular preços
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Card className="border-border/50 shadow-sm">
                                <CardContent className="p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-blue-500" />
                                        Receita se zerar estoque
                                    </p>
                                    <p className="text-2xl font-semibold">
                                        {fullAnalyticsLoading ? "-" : hasFullAnalytics ? formatCurrency(stockPlanning.totalStockRevenue) : "—"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Considera preço atual x quantidade disponível.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 shadow-sm">
                                <CardContent className="p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        Lucro estimado ao zerar estoque
                                    </p>
                                    <p className="text-2xl font-semibold">
                                        {fullAnalyticsLoading ? "-" : hasFullAnalytics ? formatCurrency(stockPlanning.totalStockProfit) : "—"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Usa lucro unitário de cada item.
                                    </p>
                                </CardContent>
                            </Card>
                                <Card className="border-border/50 shadow-sm">
                                    <CardContent className="p-4 space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                                            <Package className="h-4 w-4 text-amber-600" />
                                            Unidades para bater a meta
                                        </p>
                                        <p className="text-2xl font-semibold">
                                            {fullAnalyticsLoading
                                                ? "-"
                                                : stockPlanning.unitsToTargetFromAveragePrice !== null
                                                    ? formatNumber(stockPlanning.unitsToTargetFromAveragePrice)
                                                    : "—"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {fullAnalyticsLoading
                                                ? ""
                                                : stockPlanning.unitsToTargetFromAveragePrice !== null && stockPlanning.perUnitValue > 0
                                                    ? stockPlanning.remainingProfitTarget > 0
                                                        ? `Falta estimado ${formatCurrency(stockPlanning.remainingProfitTarget, 0)} baseado no preço médio ${formatCurrency(stockPlanning.perUnitValue, 2)}/un do período. Já foi registrado ${formatCurrency(stockPlanning.estimatedProfitToDate, 0)}.`
                                                        : `Meta estimada já atingida neste período usando preço médio ${formatCurrency(stockPlanning.perUnitValue, 2)}/un.`
                                                    : "Defina meta e sincronize o Full Analytics."}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                    </div>
                </div>

                {/* Side Column (Financials & Stock) - 1/3 width */}
                <div className="lg:col-span-4 space-y-6">
                    <TodayShipments workspaceId={workspaceId} />

                    <FinancialAnalysis
                        totalRevenue={totalRevenue}
                        totalSales={totalSales}
                        loading={metricsLoading}
                    />

                    <LowStockAlerts
                        products={products?.items || []}
                        loading={productsLoading}
                        threshold={5}
                    />

                    {/* Perguntas Recentes - movido para a coluna lateral */}
                    <Card className="border-border/50 shadow-sm flex flex-col">
                        <CardHeader className="border-b border-border/50 bg-muted/10 pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                Perguntas Recentes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex-1">
                            {questionsLoading ? (
                                <div className="space-y-3">
                                    {[...Array(3)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            ) : questions?.items && questions.items.length > 0 ? (
                                <div className="space-y-3">
                                    {questions.items.slice(0, 3).map((question: any) => (
                                        <div
                                            key={question.id}
                                            className="p-3 bg-muted/30 rounded-lg border border-border/50 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                    {question.date}
                                                </span>
                                                {question.answered ? (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" title="Respondida" />
                                                ) : (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" title="Pendente" />
                                                )}
                                            </div>
                                            <p className="text-xs font-medium mb-1 line-clamp-2">{question.text}</p>
                                        </div>
                                    ))}
                                    <Button variant="ghost" className="w-full text-xs h-8" size="sm">
                                        Ver todas
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-8 h-full flex flex-col items-center justify-center">
                                    <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">Nenhuma pergunta</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Status Sections Grid */}
                    <div className="flex gap-4">
                        <Card className="border-border/50 shadow-sm flex-1">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-400">Integração Ativa</span>
                                <span className="text-[10px] text-muted-foreground">{metrics?.lastSync ? metrics.lastSync.split(' ')[1] : ''}</span>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50 shadow-sm flex-1 hover:bg-muted/50 cursor-pointer" onClick={() => window.open('https://www.mercadolivre.com.br/vendas/perguntas', '_blank')}>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-medium">Responder</span>
                                <span className="text-[10px] text-muted-foreground">Perguntas</span>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Bottom Section removida: comparação movida para cima; status permanece na coluna lateral */}

            {/* Avisos/Alertas Full Width if any */}
            {metrics?.alerts && metrics.alerts.length > 0 && (
                <Card className="border-orange-200 dark:border-orange-900 shadow-sm">
                    <CardHeader className="border-b border-orange-100 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-800 dark:text-orange-400">
                            <AlertCircle className="h-4 w-4" />
                            Avisos do Sistema
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {metrics.alerts.map((alert: any, index: number) => (
                                <div
                                    key={index}
                                    className="p-3 bg-background rounded-lg border border-orange-100 dark:border-orange-900/50 shadow-sm"
                                >
                                    <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                                        {alert.title}
                                    </p>
                                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                                        {alert.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

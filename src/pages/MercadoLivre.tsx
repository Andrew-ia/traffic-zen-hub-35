import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreMetrics, useMercadoLivreProducts, useMercadoLivreQuestions, useSyncMercadoLivre } from "../hooks/useMercadoLivre";
import { useMercadoLivreDailySales } from "@/hooks/useMercadoLivreOrders";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { MetricCard } from "@/components/platform/MetricCard";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
import { DailySalesChart } from "@/components/mercadolivre/DailySalesChart";
import { TopProductsChart } from "@/components/mercadolivre/TopProductsChart";
import { ConversionFunnel } from "@/components/mercadolivre/ConversionFunnel";

import { LowStockAlerts } from "@/components/mercadolivre/LowStockAlerts";
import { FinancialAnalysis } from "@/components/mercadolivre/FinancialAnalysis";
import { MetricComparison } from "@/components/mercadolivre/MetricComparison";
import { SalesHeatmap } from "@/components/mercadolivre/SalesHeatmap";
import { ExportReportButton } from "@/components/mercadolivre/ExportReportButton";
import MercadoLivreConnectButton from "@/components/MercadoLivreConnectButton";
import { toast } from "@/hooks/use-toast";
import {
    ShoppingBag,
    Eye,
    MessageCircle,
    TrendingUp,
    Package,
    DollarSign,
    RefreshCcw,
    ExternalLink,
    AlertCircle,
    Search,
    Copy
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function MercadoLivre() {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;

    const [dateRange, setDateRange] = useState("30");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Calcular intervalo de datas para vendas diárias (memorizado e estável)
    const { dateFrom, dateTo } = useMemo(() => {
        const dateTo = new Date();
        dateTo.setHours(23, 59, 59, 999); // Fim do dia

        const dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0); // Início do dia
        dateFrom.setDate(dateFrom.getDate() - (Number(dateRange) - 1)); // janela inclusiva

        return {
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
        };
    }, [dateRange]);

    // Hooks para buscar dados do Mercado Livre
    const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useMercadoLivreMetrics(
        workspaceId,
        Number(dateRange)
    );

    const {
        data: products,
        isLoading: productsLoading,
        refetch: refetchProducts
    } = useMercadoLivreProducts(workspaceId, selectedCategory);

    const {
        data: questions,
        isLoading: questionsLoading
    } = useMercadoLivreQuestions(workspaceId, Number(dateRange));

    const {
        data: dailySales,
        isLoading: dailySalesLoading
    } = useMercadoLivreDailySales(workspaceId, dateFrom, dateTo);

    // Calcular período anterior para comparação
    const { previousDateFrom, previousDateTo } = useMemo(() => {
        const days = Number(dateRange);
        const previousDateTo = new Date();
        previousDateTo.setHours(23, 59, 59, 999);
        previousDateTo.setDate(previousDateTo.getDate() - days);

        const previousDateFrom = new Date(previousDateTo);
        previousDateFrom.setHours(0, 0, 0, 0);
        previousDateFrom.setDate(previousDateFrom.getDate() - (days - 1));

        return {
            previousDateFrom: previousDateFrom.toISOString(),
            previousDateTo: previousDateTo.toISOString(),
        };
    }, [dateRange]);

    // Buscar métricas do período anterior
    const { data: previousMetrics, isLoading: previousMetricsLoading } = useMercadoLivreMetrics(
        workspaceId,
        Number(dateRange),
        { dateFrom: previousDateFrom, dateTo: previousDateTo }
    );

    const syncMutation = useSyncMercadoLivre();

    const handleSyncData = async () => {
        if (!workspaceId) return;

        try {
            await syncMutation.mutateAsync(workspaceId);
            // As queries serão automaticamente invalidadas pelo hook
        } catch (error) {
            console.error('Erro ao sincronizar dados do Mercado Livre:', error);
        }
    };

    if (!workspaceId) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Mercado Livre</h1>
                <p className="text-muted-foreground">Selecione um workspace no topo para ver os dados.</p>
            </div>
        );
    }

    // Dados mockados enquanto não há integração real
    const totalSales = metrics?.totalSales ?? 0;
    const totalOrders = metrics?.totalOrders ?? metrics?.totalSales ?? 0;
    const totalRevenue = metrics?.totalRevenue ?? 0;
    const totalVisits = metrics?.totalVisits ?? 0;
    const conversionRate = metrics?.conversionRate ?? 0;
    const totalQuestions = questions?.total ?? 0;
    const activeProducts = products?.activeCount ?? 0;
    const averageUnitPrice = metrics?.averageUnitPrice ?? (totalSales > 0 ? totalRevenue / totalSales : 0);
    const averageOrderPrice = metrics?.averageOrderPrice ?? (totalOrders > 0 ? totalRevenue / totalOrders : 0);
    const canceledOrders = metrics?.canceledOrders ?? 0;

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3">
                        <ShoppingBag className="h-10 w-10 text-yellow-500" />
                        Mercado Livre
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Dashboard de vendas e analytics do Mercado Livre
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => navigate('/mercado-livre-busca-avancada')}
                    >
                        <Search className="h-4 w-4" />
                        Busca Avançada
                    </Button>
                    <MercadoLivreConnectButton size="sm" variant="outline" />
                    <Button
                        onClick={handleSyncData}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={syncMutation.isPending}
                    >
                        <RefreshCcw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                    {workspaceId && (
                        <ExportReportButton
                            workspaceId={workspaceId}
                            dateRange={dateRange}
                        />
                    )}
                </div>
            </div>

            {/* Loading State */}
            {metricsLoading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <Card key={i} className="border-border/50 shadow-sm">
                                <CardContent className="p-4">
                                    <Skeleton className="h-3 w-20 mb-2" />
                                    <Skeleton className="h-6 w-16" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* KPIs Principais */}
            {!metricsLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        title="Visitas"
                        value={new Intl.NumberFormat("pt-BR").format(totalVisits)}
                        icon={Eye}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Quantidade de vendas"
                        value={new Intl.NumberFormat("pt-BR").format(totalOrders)}
                        icon={ShoppingBag}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Conversão"
                        value={conversionRate ? `${conversionRate.toFixed(2)}%` : "-"}
                        icon={TrendingUp}
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
                        title="Vendas canceladas"
                        value={new Intl.NumberFormat("pt-BR").format(canceledOrders)}
                        icon={AlertCircle}
                        loading={metricsLoading}
                    />
                </div>
            )}

            {/* Métricas Secundárias */}
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold">Métricas de Performance</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <MetricCard
                            label="Taxa de Conversão"
                            value={conversionRate ? `${conversionRate.toFixed(2)}%` : "-"}
                            loading={metricsLoading}
                        />
                        <MetricCard
                            label="Perguntas Recebidas"
                            value={totalQuestions ? new Intl.NumberFormat("pt-BR").format(totalQuestions) : "-"}
                            loading={questionsLoading}
                        />
                        <MetricCard
                            label="Ticket Médio"
                            value={
                                totalSales > 0
                                    ? new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                    }).format(totalRevenue / totalSales)
                                    : "-"
                            }
                            loading={metricsLoading}
                        />
                        <MetricCard
                            label="Taxa de Resposta"
                            value={metrics?.responseRate ? `${metrics.responseRate.toFixed(1)}%` : "-"}
                            loading={metricsLoading}
                        />
                        <MetricCard
                            label="Reputação"
                            value={metrics?.reputation ?? "-"}
                            loading={metricsLoading}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Comparação de Períodos */}
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Comparação vs Período Anterior ({dateRange} dias)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {/* Layout Principal em 2 Colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Coluna Esquerda - mais ampla */}
                <div className="lg:col-span-9 space-y-6">
                    {/* Gráfico de Vendas Diárias (Real) */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-base font-semibold">Vendas Diárias</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <DailySalesChart
                                data={dailySales?.dailySales || []}
                                loading={dailySalesLoading}
                            />
                        </CardContent>
                    </Card>

                    {/* Funil de Conversão */}
                    <ConversionFunnel
                        visits={totalVisits}
                        questions={totalQuestions}
                        sales={totalSales}
                        loading={metricsLoading || questionsLoading}
                    />

                    {/* Grid com 2 colunas para Top Products */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Top 5 Produtos por Vendas */}
                        <TopProductsChart
                            products={products?.items || []}
                            loading={productsLoading}
                            type="sales"
                        />

                        {/* Top 5 Produtos por Visitas */}
                        <TopProductsChart
                            products={products?.items || []}
                            loading={productsLoading}
                            type="visits"
                        />
                    </div>



                    {/* Heatmap de Vendas */}
                    <SalesHeatmap
                        data={dailySales?.dailySales || []}
                        loading={dailySalesLoading}
                    />
                </div>

                {/* Coluna Direita - ajustada */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Análise Financeira */}
                    <FinancialAnalysis
                        totalRevenue={totalRevenue}
                        totalSales={totalSales}
                        loading={metricsLoading}
                    />

                    {/* Alertas de Estoque Baixo */}
                    <LowStockAlerts
                        products={products?.items || []}
                        loading={productsLoading}
                        threshold={5}
                    />

                    {/* Status da Integração */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-base font-semibold">Status da Integração</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                                        <span className="text-sm font-medium">Conectado</span>
                                    </div>
                                    <Button variant="ghost" size="sm">
                                        Configurar
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Última sincronização:</span>
                                        <span className="font-medium">{metrics?.lastSync ?? "Nunca"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">ID do Vendedor:</span>
                                        <span className="font-medium font-mono">{metrics?.sellerId ?? "-"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Produtos sincronizados:</span>
                                        <span className="font-medium">{products?.totalCount ?? 0}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Perguntas Recentes */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                Perguntas Recentes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {questionsLoading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-20 w-full" />
                                    ))}
                                </div>
                            ) : questions?.items && questions.items.length > 0 ? (
                                <div className="space-y-4">
                                    {questions.items.slice(0, 5).map((question: any) => (
                                        <div
                                            key={question.id}
                                            className="p-3 bg-muted/30 rounded-lg border border-border/50"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {question.date}
                                                </span>
                                                {question.answered ? (
                                                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                                                        Respondida
                                                    </span>
                                                ) : (
                                                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">
                                                        Pendente
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium mb-1">{question.text}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {question.productTitle}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Nenhuma pergunta recente</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ações Rápidas */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-base font-semibold">Ações Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-2">
                                <Button variant="outline" className="w-full justify-start" asChild>
                                    <a href="https://www.mercadolivre.com.br/" target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Abrir Mercado Livre
                                    </a>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        const url = 'https://www.mercadolivre.com.br/vendas/perguntas';
                                        window.open(url, '_blank');
                                    }}
                                >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Responder Perguntas
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Avisos/Alertas */}
                    {metrics?.alerts && metrics.alerts.length > 0 && (
                        <Card className="border-orange-200 dark:border-orange-800 shadow-sm">
                            <CardHeader className="border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-orange-600" />
                                    Avisos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-3">
                                    {metrics.alerts.map((alert: any, index: number) => (
                                        <div
                                            key={index}
                                            className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800"
                                        >
                                            <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                                                {alert.title}
                                            </p>
                                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                                {alert.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>


        </div>
    );
}

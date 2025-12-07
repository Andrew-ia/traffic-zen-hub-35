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

                    {/* Lista de Produtos com Paginação */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Todos os Produtos</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {products?.items ? `${products.items.length} produtos encontrados` : 'Carregando...'}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            {productsLoading ? (
                                <div className="space-y-3">
                                    {[...Array(itemsPerPage)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            ) : products?.items && products.items.length > 0 ? (
                                <>
                                    <div className="overflow-x-auto">
                                        <Table className="w-full min-w-[800px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Produto</TableHead>
                                                    <TableHead>MLB ID</TableHead>
                                                    <TableHead className="text-right">Vendas</TableHead>
                                                    <TableHead className="text-right">Visitas</TableHead>
                                                    <TableHead className="text-right">Taxa Conv.</TableHead>
                                                    <TableHead className="text-right">Receita</TableHead>
                                                    <TableHead className="text-center">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {products.items
                                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                                    .map((product: any) => (
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {product.thumbnail && (
                                                                <img
                                                                    src={product.thumbnail}
                                                                    alt={product.title}
                                                                    className="h-10 w-10 rounded object-cover"
                                                                />
                                                            )}
                                                            <span className="truncate max-w-2xl">{product.title}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                                                {product.id || product.mlb_id || 'N/A'}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0"
                                                                onClick={async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(product.id || product.mlb_id || '');
                                                                        toast({ title: "Copiado!", description: "MLB ID copiado para a área de transferência" });
                                                                    } catch (e) {
                                                                        toast({ title: "Não foi possível copiar", variant: "destructive" });
                                                                    }
                                                                }}
                                                                title="Copiar MLB ID"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{product.sales ?? 0}</TableCell>
                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat("pt-BR").format(product.visits ?? 0)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {product.conversionRate ? `${product.conversionRate.toFixed(1)}%` : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat("pt-BR", {
                                                            style: "currency",
                                                            currency: "BRL",
                                                        }).format(product.revenue ?? 0)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs"
                                                                onClick={() => {
                                                                    const mlbId = product.id || product.mlb_id;
                                                                    if (mlbId) {
                                                                        navigate(`/mercado-livre-analyzer?mlb=${mlbId}`);
                                                                    }
                                                                }}
                                                                disabled={!product.id && !product.mlb_id}
                                                            >
                                                                <Search className="h-3 w-3 mr-1" />
                                                                Analisar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs"
                                                                onClick={() => {
                                                                    const permalink = product.permalink || `https://mercadolivre.com.br/p/${product.id || product.mlb_id}`;
                                                                    window.open(permalink, '_blank');
                                                                }}
                                                                title="Ver no Mercado Livre"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Controles de Paginação */}
                                {products.items.length > itemsPerPage && (
                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                                        <div className="text-sm text-muted-foreground">
                                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, products.items.length)} de {products.items.length} produtos
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Anterior
                                            </Button>

                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.ceil(products.items.length / itemsPerPage) }, (_, i) => i + 1)
                                                    .filter(page => {
                                                        // Mostrar primeira, última e páginas próximas à atual
                                                        const totalPages = Math.ceil(products.items.length / itemsPerPage);
                                                        return (
                                                            page === 1 ||
                                                            page === totalPages ||
                                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                                        );
                                                    })
                                                    .map((page, index, array) => (
                                                        <div key={page} className="flex items-center">
                                                            {index > 0 && array[index - 1] !== page - 1 && (
                                                                <span className="px-2 text-muted-foreground">...</span>
                                                            )}
                                                            <Button
                                                                variant={currentPage === page ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => setCurrentPage(page)}
                                                                className="min-w-[2.5rem]"
                                                            >
                                                                {page}
                                                            </Button>
                                                        </div>
                                                    ))
                                                }
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(products.items.length / itemsPerPage), prev + 1))}
                                                disabled={currentPage === Math.ceil(products.items.length / itemsPerPage)}
                                            >
                                                Próximo
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                            ) : (
                                <div className="text-center py-12">
                                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground">Nenhum produto encontrado</p>
                                    <Button variant="outline" size="sm" className="mt-4">
                                        Conectar Mercado Livre
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Coluna Direita - ajustada */}
                <div className="lg:col-span-3 space-y-6">
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
                                    onClick={() => navigate('/catalog-intelligence')}
                                >
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Ver Relatório Completo
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

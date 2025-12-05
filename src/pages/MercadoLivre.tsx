import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreMetrics, useMercadoLivreProducts, useMercadoLivreQuestions, useSyncMercadoLivre } from "../hooks/useMercadoLivre";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { MetricCard } from "@/components/platform/MetricCard";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
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

    // Hooks para buscar dados do Mercado Livre
    const {
        data: metrics,
        isLoading: metricsLoading,
        refetch: refetchMetrics
    } = useMercadoLivreMetrics(workspaceId, Number(dateRange));

    const {
        data: products,
        isLoading: productsLoading,
        refetch: refetchProducts
    } = useMercadoLivreProducts(workspaceId, selectedCategory);

    const {
        data: questions,
        isLoading: questionsLoading
    } = useMercadoLivreQuestions(workspaceId, Number(dateRange));

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
    const totalRevenue = metrics?.totalRevenue ?? 0;
    const totalVisits = metrics?.totalVisits ?? 0;
    const conversionRate = metrics?.conversionRate ?? 0;
    const totalQuestions = questions?.total ?? 0;
    const activeProducts = products?.activeCount ?? 0;

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CompactKPICard
                        title="Vendas"
                        value={totalSales.toString()}
                        icon={ShoppingBag}
                        loading={metricsLoading}
                    />
                    <CompactKPICard
                        title="Receita"
                        value={new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 0,
                        }).format(totalRevenue)}
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
                        title="Produtos Ativos"
                        value={activeProducts.toString()}
                        icon={Package}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Coluna Esquerda - 60% */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Gráfico de Vendas */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-base font-semibold">Evolução de Vendas</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {metricsLoading ? (
                                <Skeleton className="h-64 w-full" />
                            ) : (
                                <PerformanceChart
                                    data={(metrics?.salesTimeSeries ?? []).map(item => ({
                                        date: item.date,
                                        results: item.sales,
                                        impressions: item.visits,
                                        clicks: 0,
                                        revenue: item.revenue,
                                        spend: 0,
                                    }))}
                                    metric="revenue"
                                    loading={metricsLoading}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Produtos */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold">Top Produtos</CardTitle>
                            <Button variant="ghost" size="sm" className="gap-2">
                                Ver todos
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6">
                            {productsLoading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            ) : products?.items && products.items.length > 0 ? (
                                <Table>
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
                                        {products.items.slice(0, 10).map((product: any) => (
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
                                                        <span className="truncate max-w-xs">{product.title}</span>
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

                {/* Coluna Direita - 40% */}
                <div className="lg:col-span-5 space-y-6">
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
                                <Button variant="outline" className="w-full justify-start">
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Ver Relatório Completo
                                </Button>
                                <Button variant="outline" className="w-full justify-start">
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

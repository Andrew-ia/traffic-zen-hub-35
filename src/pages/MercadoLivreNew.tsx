import { useState, useMemo, useEffect } from "react";
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Package,
    AlertCircle,
    RefreshCcw,
    Eye,
    Users,
    MousePointer,
    ShoppingCart,
    Layers,
    Search,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    Star,
    Boxes,
    Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    useMercadoLivreMetrics,
    useMercadoLivreProducts,
    useMercadoLivreQuestions,
    useSyncMercadoLivre
} from "@/hooks/useMercadoLivre";
import { useMercadoLivreDailySales, useMercadoLivreOrders } from "@/hooks/useMercadoLivreOrders";
import { useMercadoLivreShipments } from "@/hooks/useMercadoLivreShipments";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import MercadoLivreConnectButton from "@/components/MercadoLivreConnectButton";
import { supabase } from "@/lib/supabaseClient";
import { ExportReportButton } from "@/components/mercadolivre/ExportReportButton";
import { PremiumKPICard } from "@/components/mercadolivre/redesign/PremiumKPICard";
import { MainPerformanceChart } from "@/components/mercadolivre/redesign/MainPerformanceChart";
import { RecentActivity } from "@/components/mercadolivre/redesign/RecentActivity";
import { FinancialAnalysis } from "@/components/mercadolivre/FinancialAnalysis";
import { useWorkspace } from "@/hooks/useWorkspace";

const formatCurrency = (value: number, fractionDigits: number = 0) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export default function MercadoLivreNew() {
    const navigate = useNavigate();
    const { workspaces, currentWorkspace, switchWorkspace, isLoading: workspacesLoading } = useWorkspace();
    const [dateRange, setDateRange] = useState("30");
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        (import.meta.env.VITE_WORKSPACE_ID as string) || null
    );
    const [replaying, setReplaying] = useState(false);
    const [recentActivityDate, setRecentActivityDate] = useState<Date | undefined>(new Date());

    // Obter workspace_id
    useEffect(() => {
        if (currentWorkspace?.id) {
            setWorkspaceId(currentWorkspace.id);
            return;
        }
        const fetchWorkspace = async () => {
            // Fallback: se o WorkspaceProvider não trouxe nada, tenta descobrir pelo usuário logado
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
    }, [currentWorkspace?.id]);

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
    const { data: questions, isLoading: questionsLoading } = useMercadoLivreQuestions(workspaceId, dateRangeNumber);
    const { data: dailySales, isLoading: dailySalesLoading } = useMercadoLivreDailySales(
        workspaceId,
        period.start_date,
        period.end_date
    );

    const ordersParams = useMemo(() => {
        const params: any = { limit: 50 };
        if (recentActivityDate) {
            const start = new Date(recentActivityDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(recentActivityDate);
            end.setHours(23, 59, 59, 999);
            
            params.dateFrom = start.toISOString();
            params.dateTo = end.toISOString();
        }
        return params;
    }, [recentActivityDate]);

    const { data: ordersData, isLoading: ordersLoading } = useMercadoLivreOrders(workspaceId, ordersParams);
    const { data: shipmentsData, isLoading: shipmentsLoading } = useMercadoLivreShipments(workspaceId, {
        // Remover filtro de status para trazer TODOS os envios do dia (Normal, Full, Shipped, etc)
        // Traz todos os envios do dia (Normal, Full, etc) para contagens corretas
        limit: 50
    });
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
        if (!workspaceId) return;
        setReplaying(true);
        try {
            const resp = await fetch("/api/integrations/mercadolivre/notifications/replay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId, days: 1, maxOrders: 200, dryRun: false })
            });
            const data = await resp.json();
            toast.success(`Reenvio concluído: enviados ${data?.sent || 0}`);
        } catch (e) {
            toast.error("Erro ao reenviar notificações.");
        } finally {
            setReplaying(false);
        }
    };

    // Cálculos
    const totalRevenue = metrics?.totalRevenue ?? 0;
    const totalOrders = metrics?.totalOrders ?? 0;
    const totalVisits = metrics?.totalVisits ?? 0;
    const conversionRate = metrics?.conversionRate ?? 0;

    const handleWorkspaceChange = (value: string) => {
        setWorkspaceId(value);
        switchWorkspace(value);
    };

    const getTrend = (current: number, previous: number) => {
        if (!previous) return { value: "0%", up: true };
        const diff = current - previous;
        const percentage = (diff / previous) * 100;
        return {
            value: `${Math.abs(percentage).toFixed(1)}%`,
            up: percentage >= 0
        };
    };

    const revenueTrend = getTrend(totalRevenue, previousMetrics?.totalRevenue || 0);
    const ordersTrend = getTrend(totalOrders, previousMetrics?.totalOrders || 0);
    const visitsTrend = getTrend(totalVisits, previousMetrics?.totalVisits || 0);
    const conversionTrend = getTrend(conversionRate, previousMetrics?.conversionRate || 0);

    // Cálculos operacionais
    const shipmentsSummary = useMemo(() => {
        if (!shipmentsData?.results) return { total: 0, pending: 0, ready_to_ship: 0 };
        const results = shipmentsData.results;
        return {
            total: shipmentsData.paging?.total || results.length,
            pending: results.filter(s => s.status === 'pending' || s.status === 'handling').length,
            ready_to_ship: results.filter(s => s.status === 'ready_to_ship').length
        };
    }, [shipmentsData]);

    const reputationLevel = metrics?.reputationMetrics?.level || metrics?.reputation || (metricsLoading ? "Carregando..." : "-");
    const reputationColor = metrics?.reputationMetrics?.color || "Verde";
    const reputationColorClass = reputationColor === "Verde" ? "text-green-500" :
        reputationColor === "Amarelo" ? "text-yellow-500" :
            reputationColor === "Laranja" ? "text-orange-500" :
                reputationColor === "Vermelho" ? "text-red-500" : (metricsLoading ? "text-muted-foreground" : "text-green-500");

    const averageTicket = (metrics?.totalRevenue && metrics?.totalSales) 
        ? metrics.totalRevenue / metrics.totalSales 
        : 0;

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F1115] text-foreground p-4 sm:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#FFF159] p-6 rounded-[2.5rem] border border-[#FFD100] shadow-2xl shadow-yellow-500/20">
                <div className="flex items-center gap-5">
                    <div className="h-16 w-16 bg-yellow-400 rounded-3xl flex items-center justify-center shadow-lg shadow-yellow-400/20 rotate-3 group hover:rotate-0 transition-transform duration-500">
                        <ShoppingBag className="h-8 w-8 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black tracking-tight text-[#2D3277]">
                                Mercado Livre Pro
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Buscar anúncio..."
                            className="pl-10 h-11 w-64 bg-background/50 border-border/40 rounded-2xl focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div className="h-11 w-[1px] bg-border/40 mx-2 hidden lg:block" />

                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2D3277]/70">Loja</div>
                        <Select
                            value={workspaceId || ""}
                            onValueChange={handleWorkspaceChange}
                            disabled={workspacesLoading || !workspaces?.length}
                        >
                            <SelectTrigger className="h-11 w-[200px] rounded-2xl bg-background/50 border-border/40">
                                <SelectValue placeholder={workspacesLoading ? "Carregando..." : "Selecionar loja"} />
                            </SelectTrigger>
                            <SelectContent>
                                {workspaces?.map((ws) => (
                                    <SelectItem key={ws.id} value={ws.id}>
                                        {ws.name || ws.slug || ws.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="h-11 w-[1px] bg-border/40 mx-2 hidden lg:block" />

                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2D3277]/70">Período</div>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="h-11 w-[180px] rounded-2xl bg-background/50 border-border/40">
                                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Últimos 30 dias" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Hoje</SelectItem>
                                <SelectItem value="7">Últimos 7 dias</SelectItem>
                                <SelectItem value="15">Últimos 15 dias</SelectItem>
                                <SelectItem value="30">Últimos 30 dias</SelectItem>
                                <SelectItem value="60">Últimos 60 dias</SelectItem>
                                <SelectItem value="90">Últimos 90 dias</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        variant="outline"
                        onClick={handleSyncData}
                        disabled={syncMutation.isPending}
                        className="h-11 px-5 rounded-2xl border-border/40 bg-background/50 hover:bg-background/80 hover:scale-105 transition-all gap-2"
                    >
                        <RefreshCcw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        <span className="font-bold text-xs uppercase tracking-tight">Sync</span>
                    </Button>

                    <MercadoLivreConnectButton
                        size="sm"
                        variant="outline"
                        className="h-11 px-4 rounded-2xl border-border/40 bg-background/50 hover:bg-background/80"
                    />

                    <div className="h-11 w-[1px] bg-border/40 mx-2 hidden lg:block" />

                    <ExportReportButton workspaceId={workspaceId || ""} dateRange={dateRange} />

                    <Button
                        className="h-11 px-6 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all shadow-xl shadow-black/10 dark:shadow-white/5 font-black text-xs uppercase tracking-widest"
                        onClick={() => navigate("/mercado-livre/full-analytics")}
                    >
                        Full Insights
                    </Button>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-primary/5 p-2 rounded-[2rem] border border-primary/10">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#3483FA]/10 flex items-center justify-center">
                        <Layers className="h-4 w-4 text-[#3483FA]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Anúncios</p>
                        <p className="text-sm font-black">{products?.activeCount || 0}</p>
                    </div>
                </div>
                
                {/* Preço Médio */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#00A650]/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-[#00A650]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Médio</p>
                        <p className="text-sm font-black">{formatCurrency(averageTicket, 2)}</p>
                    </div>
                </div>

                {/* Vendas Canceladas */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#F52F41]/10 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-[#F52F41]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Cancelados</p>
                        <p className="text-sm font-black text-[#F52F41]">{metrics?.canceledOrders || 0}</p>
                    </div>
                </div>

                {/* Unidades Vendidas */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#3483FA]/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-[#3483FA]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Und. Vendidas</p>
                        <p className="text-sm font-black">{metrics?.totalSales || 0}</p>
                    </div>
                </div>
                <div className="hidden lg:flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#F52F41]/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-[#F52F41]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Valor Cancelado</p>
                        <p className="text-sm font-black text-[#F52F41]">{formatCurrency(metrics?.canceledRevenue || 0)}</p>
                    </div>
                </div>
                <div className="hidden lg:flex items-center gap-3 px-4 py-3 rounded-2xl bg-background/40">
                    <div className="h-8 w-8 rounded-lg bg-[#3483FA]/10 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-[#3483FA]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Envios</p>
                        <p className="text-sm font-black">
                            {shipmentsLoading ? "..." : shipmentsSummary.total} Hoje
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column - Main Charts & KPIs */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Top KPIs Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PremiumKPICard
                            title="Faturamento Bruto"
                            value={formatCurrency(totalRevenue)}
                            icon={DollarSign}
                            color="green"
                            trend={revenueTrend.value}
                            trendUp={revenueTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.revenue }))}
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Vendas Realizadas"
                            value={formatNumber(totalOrders)}
                            icon={ShoppingCart}
                            color="blue"
                            trend={ordersTrend.value}
                            trendUp={ordersTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.orders }))}
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Visitas aos Anúncios"
                            value={formatNumber(totalVisits)}
                            icon={MousePointer}
                            color="purple"
                            trend={visitsTrend.value}
                            trendUp={visitsTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.sales / 10 }))} // Approximation for visits trend if not available
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Taxa de Conversão"
                            value={`${conversionRate.toFixed(2)}%`}
                            icon={Users}
                            color="orange"
                            trend={conversionTrend.value}
                            trendUp={conversionTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: (d.orders / (d.sales || 1)) * 100 }))}
                            loading={metricsLoading}
                        />
                    </div>

                    {/* Big Chart Section */}
                    <MainPerformanceChart
                        data={dailySales?.dailySales || []}
                        loading={dailySalesLoading}
                    />

                    {/* Bottom section removed (SAC/Logística/Top Produtos) */}
                </div>

                {/* Right Column - Side Panels */}
                <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
                    {/* Recent Activity Feed */}
                    <RecentActivity 
                        orders={ordersData?.orders || []} 
                        loading={ordersLoading} 
                        date={recentActivityDate}
                        onDateChange={setRecentActivityDate}
                        totalOrders={ordersData?.paging?.total}
                    />

                    {/* Financial Summary Snippet */}
                    <FinancialAnalysis
                        totalRevenue={totalRevenue}
                        totalSales={totalOrders}
                        loading={metricsLoading}
                        realTotalFees={metrics?.totalSaleFees}
                        realTotalShipping={metrics?.totalShippingCosts}
                        realNetIncome={metrics?.totalNetIncome}
                    />
                </div>
            </div>

            {/* System Notifications / Warnings Footer */}
            {metrics?.alerts && metrics.alerts.length > 0 && (
                <div className="bg-orange-500/5 border border-orange-500/20 p-6 rounded-[2.5rem] mt-12">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-orange-900 dark:text-orange-400">Notificações Críticas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {metrics.alerts.map((alert: any, idx: number) => (
                            <div key={idx} className="bg-background/40 backdrop-blur-sm p-4 rounded-3xl border border-orange-500/10 hover:border-orange-500/30 transition-colors">
                                <p className="text-sm font-black text-orange-900 dark:text-orange-200 uppercase tracking-tighter">{alert.title}</p>
                                <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-1 font-medium leading-relaxed">{alert.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

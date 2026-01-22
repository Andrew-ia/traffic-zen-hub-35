import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Package,
    AlertCircle,
    RefreshCcw,
    Users,
    MousePointer,
    ShoppingCart,
    Layers,
    Search,
    Calendar as CalendarIcon,
    CalendarRange
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    useMercadoLivreMetrics,
    useMercadoLivreProducts,
    useMercadoLivreQuestions,
    useMercadoLivreAuthStatus,
    useSyncMercadoLivre,
    useMercadoLivreAnalyticsTop,
    useSyncMercadoLivreAnalytics
} from "@/hooks/useMercadoLivre";
import { useMercadoLivreDailySales, useMercadoLivreOrders } from "@/hooks/useMercadoLivreOrders";
import { useMercadoLivreShipments } from "@/hooks/useMercadoLivreShipments";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import MercadoLivreConnectButton from "@/components/MercadoLivreConnectButton";
import { MercadoLivreManualTokenDialog } from "@/components/MercadoLivreManualTokenDialog";
import { supabase } from "@/lib/supabaseClient";
import { ExportReportButton } from "@/components/mercadolivre/ExportReportButton";
import { PremiumKPICard } from "@/components/mercadolivre/redesign/PremiumKPICard";
import { MainPerformanceChart } from "@/components/mercadolivre/redesign/MainPerformanceChart";
import { RecentActivity } from "@/components/mercadolivre/redesign/RecentActivity";
import { FinancialAnalysis } from "@/components/mercadolivre/FinancialAnalysis";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { DateRange } from "react-day-picker";

const formatCurrency = (value: number, fractionDigits: number = 0) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export default function MercadoLivreNew() {
    const { workspaces, currentWorkspace, switchWorkspace, isLoading: workspacesLoading } = useWorkspace();
    const queryClient = useQueryClient();
    const processedOrdersRef = useRef<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState("30");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(() => {
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        const from = subDays(new Date(to), 29);
        return { from, to };
    });
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        (import.meta.env.VITE_WORKSPACE_ID as string) || null
    );
    const [replaying, setReplaying] = useState(false);
    const [recentActivityDate, setRecentActivityDate] = useState<Date | undefined>(new Date());
    const [sseConnected, setSseConnected] = useState(false);

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

    const isCustomRange = dateRange === "custom";
    const dateRangeLabel = useMemo(() => {
        if (!customDateRange?.from || !customDateRange?.to) return "Selecione o período";
        const sameDay = customDateRange.from.toDateString() === customDateRange.to.toDateString();
        const formattedFrom = format(customDateRange.from, "dd/MM/yy");
        const formattedTo = format(customDateRange.to, "dd/MM/yy");
        return sameDay ? formattedFrom : `${formattedFrom} - ${formattedTo}`;
    }, [customDateRange]);

    const resolvedRange = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isCustomRange && customDateRange?.from) {
            const from = new Date(customDateRange.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(customDateRange.to ?? customDateRange.from);
            to.setHours(0, 0, 0, 0);
            const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
            return { from, to, days };
        }

        const days = Number.parseInt(dateRange, 10) || 30;
        const from = subDays(new Date(today), days - 1);
        return { from, to: today, days };
    }, [customDateRange, dateRange, isCustomRange]);

    const previousPeriod = useMemo(() => {
        const previousEnd = subDays(resolvedRange.from, 1);
        const previousStart = subDays(previousEnd, resolvedRange.days - 1);
        return {
            start_date: format(previousStart, "yyyy-MM-dd"),
            end_date: format(previousEnd, "yyyy-MM-dd"),
        };
    }, [resolvedRange]);

    const period = useMemo(() => ({
        start_date: format(resolvedRange.from, "yyyy-MM-dd"),
        end_date: format(resolvedRange.to, "yyyy-MM-dd"),
    }), [resolvedRange]);

    const { data: authStatus, isLoading: authStatusLoading } = useMercadoLivreAuthStatus(workspaceId);

    useEffect(() => {
        if (!workspaceId || authStatusLoading || authStatus?.connected) return;

        const autoConnectKey = `ml-autoconnect-${workspaceId}`;
        if (sessionStorage.getItem(autoConnectKey) === "1") return;

        const attemptAutoConnect = async () => {
            try {
                const response = await fetch(`/api/integrations/mercadolivre/auth/url?workspaceId=${workspaceId}`);
                const data = await response.json();
                if (!response.ok || !data?.authUrl) {
                    throw new Error(data?.error || "Não foi possível iniciar a conexão do Mercado Livre");
                }

                sessionStorage.setItem(autoConnectKey, "1");
                window.location.href = data.authUrl;
            } catch (error: any) {
                toast.error(error?.message || "Falha ao iniciar conexão automática do Mercado Livre");
            }
        };

        void attemptAutoConnect();
    }, [authStatus?.connected, authStatusLoading, workspaceId]);

    // Hooks de dados
    const { data: metrics, isLoading: metricsLoading } = useMercadoLivreMetrics(
        workspaceId,
        resolvedRange.days,
        { dateFrom: period.start_date, dateTo: period.end_date }
    );
    const { data: previousMetrics, isLoading: previousMetricsLoading } = useMercadoLivreMetrics(
        workspaceId,
        resolvedRange.days,
        { dateFrom: previousPeriod.start_date, dateTo: previousPeriod.end_date }
    );
    const { data: products, isLoading: productsLoading } = useMercadoLivreProducts(workspaceId);
    const { data: questions, isLoading: questionsLoading } = useMercadoLivreQuestions(workspaceId, resolvedRange.days);
    const { data: dailySales, isLoading: dailySalesLoading } = useMercadoLivreDailySales(
        workspaceId,
        period.start_date,
        period.end_date
    );

    const ordersParams = useMemo(() => {
        const params: any = { limit: 50, includeCancelled: true };
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

    useEffect(() => {
        processedOrdersRef.current.clear();
    }, [workspaceId]);

    useEffect(() => {
        if (!workspaceId) return;

        const params = new URLSearchParams({ workspaceId });
        const source = new EventSource(`/api/integrations/mercadolivre/notifications/stream?${params.toString()}`);
        let isActive = true;

        const markConnected = () => {
            if (!isActive) return;
            setSseConnected(true);
        };

        const markDisconnected = () => {
            if (!isActive) return;
            setSseConnected(false);
        };

        const inOrdersRange = (orderDate: Date | null) => {
            if (!orderDate) return false;
            const ts = orderDate.getTime();
            const from = ordersParams?.dateFrom ? new Date(ordersParams.dateFrom).getTime() : null;
            const to = ordersParams?.dateTo ? new Date(ordersParams.dateTo).getTime() : null;
            if (from !== null && !Number.isNaN(from) && ts < from) return false;
            if (to !== null && !Number.isNaN(to) && ts > to) return false;
            return true;
        };

        const inCurrentRange = (orderDate: Date | null) => {
            if (!orderDate) return false;
            const rangeStart = new Date(`${period.start_date}T00:00:00`);
            const rangeEnd = new Date(`${period.end_date}T23:59:59.999`);
            const ts = orderDate.getTime();
            return ts >= rangeStart.getTime() && ts <= rangeEnd.getTime();
        };

        const handleOrder = (event: MessageEvent) => {
            let payload: any;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }

            if (!payload?.order || payload.workspaceId !== workspaceId) return;
            const order = payload.order;
            const orderId = String(order?.id || "").trim();
            if (!orderId) return;

            const cached = queryClient.getQueryData(["mercadolivre", "orders", workspaceId, ordersParams]) as any;
            const alreadyListed = cached?.orders?.some((o: any) => String(o.id) === orderId);
            if (alreadyListed || processedOrdersRef.current.has(orderId)) {
                processedOrdersRef.current.add(orderId);
                return;
            }
            processedOrdersRef.current.add(orderId);
            const orderDate = order.dateCreated ? new Date(order.dateCreated) : null;
            const orderTotal = Number(order.totalAmount || 0);
            const itemsCount = Array.isArray(order.items)
                ? order.items.reduce((sum: number, item: any) => sum + (Number(item?.quantity || 0)), 0)
                : 0;

            if (inOrdersRange(orderDate)) {
                queryClient.setQueryData(
                    ["mercadolivre", "orders", workspaceId, ordersParams],
                    (current: any) => {
                        const limit = current?.paging?.limit || Number(ordersParams?.limit || 50);
                        const existing = current?.orders || [];
                        const exists = existing.some((o: any) => String(o.id) === orderId);
                        const nextOrders = [order, ...existing.filter((o: any) => String(o.id) !== orderId)];
                        const trimmed = nextOrders.slice(0, limit);
                        const total = current?.paging?.total ?? existing.length;
                        const nextTotal = exists ? total : total + 1;

                        return {
                            orders: trimmed,
                            paging: {
                                total: nextTotal,
                                offset: current?.paging?.offset ?? 0,
                                limit,
                            },
                        };
                    }
                );
            }

            if (inCurrentRange(orderDate)) {
                const dateKey = orderDate ? format(orderDate, "yyyy-MM-dd") : null;
                if (dateKey) {
                    queryClient.setQueryData(
                        ["mercadolivre", "daily-sales", workspaceId, period.start_date, period.end_date],
                        (current: any) => {
                            const nextEntry = {
                                date: dateKey,
                                sales: itemsCount,
                                revenue: orderTotal,
                                orders: 1,
                            };

                            if (!current) {
                                return {
                                    dailySales: [nextEntry],
                                    totalOrders: 1,
                                    totalSales: itemsCount,
                                    totalRevenue: orderTotal,
                                };
                            }

                            const existing = current.dailySales || [];
                            const idx = existing.findIndex((d: any) => d.date === dateKey);
                            const nextDailySales = [...existing];
                            if (idx >= 0) {
                                nextDailySales[idx] = {
                                    ...existing[idx],
                                    sales: Number(existing[idx]?.sales || 0) + itemsCount,
                                    revenue: Number(existing[idx]?.revenue || 0) + orderTotal,
                                    orders: Number(existing[idx]?.orders || 0) + 1,
                                };
                            } else {
                                nextDailySales.push(nextEntry);
                            }

                            nextDailySales.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

                            return {
                                ...current,
                                dailySales: nextDailySales,
                                totalOrders: Number(current.totalOrders || 0) + 1,
                                totalSales: Number(current.totalSales || 0) + itemsCount,
                                totalRevenue: Number(current.totalRevenue || 0) + orderTotal,
                            };
                        }
                    );
                }

                queryClient.setQueryData(
                    ["mercadolivre", "metrics", workspaceId, resolvedRange.days, period.start_date, period.end_date],
                    (current: any) => {
                        if (!current) return current;
                        return {
                            ...current,
                            totalRevenue: Number(current.totalRevenue || 0) + orderTotal,
                            totalSales: Number(current.totalSales || 0) + itemsCount,
                            totalOrders: Number(current.totalOrders || 0) + 1,
                            lastSync: new Date().toISOString(),
                        };
                    }
                );
            }
        };

        source.addEventListener("order", handleOrder);
        source.addEventListener("ready", markConnected);
        source.addEventListener("ping", markConnected);
        source.onopen = markConnected;
        source.onerror = markDisconnected;

        return () => {
            isActive = false;
            source.close();
            setSseConnected(false);
        };
    }, [workspaceId, ordersParams, period.start_date, period.end_date, resolvedRange.days, queryClient]);

    useEffect(() => {
        if (!workspaceId || sseConnected) return;

        const interval = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "orders", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "daily-sales", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "metrics", workspaceId] });
        }, 60000);

        return () => clearInterval(interval);
    }, [workspaceId, sseConnected, queryClient]);

    const todayMetrics = useMemo(() => {
        if (!dailySales?.dailySales || !recentActivityDate) return { revenue: 0, orders: 0, revenueTrend: 0, ordersTrend: 0 };
        
        const dateKey = format(recentActivityDate, 'yyyy-MM-dd');
        const dayData = dailySales.dailySales.find(d => d.date === dateKey);
        
        // Previous day for trend
        const prevDate = new Date(recentActivityDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevKey = format(prevDate, 'yyyy-MM-dd');
        const prevData = dailySales.dailySales.find(d => d.date === prevKey);
        
        const currentRevenue = dayData?.revenue || 0;
        const prevRevenue = prevData?.revenue || 0;
        const currentOrders = dayData?.orders || 0;
        const prevOrders = prevData?.orders || 0;
        
        const calcTrend = (curr: number, prev: number) => {
            if (!prev) return 0; // Infinite growth or first day
            return ((curr - prev) / prev) * 100;
        };

        return {
            revenue: currentRevenue,
            orders: currentOrders,
            revenueTrend: calcTrend(currentRevenue, prevRevenue),
            ordersTrend: calcTrend(currentOrders, prevOrders)
        };
    }, [dailySales, recentActivityDate]);

    const { data: ordersData, isLoading: ordersLoading } = useMercadoLivreOrders(workspaceId, ordersParams);
    const { data: shipmentsData, isLoading: shipmentsLoading } = useMercadoLivreShipments(workspaceId, {
        // Remover filtro de status para trazer TODOS os envios do dia (Normal, Full, Shipped, etc)
        // Traz todos os envios do dia (Normal, Full, etc) para contagens corretas
        limit: 50
    });
    const syncMutation = useSyncMercadoLivre();
    const analyticsSyncMutation = useSyncMercadoLivreAnalytics();
    const { data: analyticsTop, isLoading: analyticsTopLoading } = useMercadoLivreAnalyticsTop(workspaceId);

    const handleSyncData = async () => {
        if (!workspaceId) return;
        try {
            await syncMutation.mutateAsync(workspaceId);
            toast.success("Sincronização iniciada com sucesso!");
        } catch (error) {
            toast.error("Erro ao iniciar sincronização.");
        }
    };

    const handleSyncAnalytics = async () => {
        if (!workspaceId) return;
        try {
            await analyticsSyncMutation.mutateAsync(workspaceId);
            toast.success("Analytics 30d atualizada com sucesso!");
        } catch (error) {
            toast.error("Erro ao atualizar analytics 30d.");
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
    const totalSales = metrics?.totalSales ?? 0;
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
    const reputationColorClass = metricsLoading
        ? "text-muted-foreground"
        : reputationColor === "Verde"
            ? "text-success"
            : reputationColor === "Amarelo"
                ? "text-warning"
                : reputationColor === "Laranja"
                    ? "text-warning"
                    : reputationColor === "Vermelho"
                        ? "text-destructive"
                        : "text-muted-foreground";

    const averageTicket = (metrics?.totalRevenue && metrics?.totalSales) 
        ? metrics.totalRevenue / metrics.totalSales 
        : 0;

    const topSales = analyticsTop?.topSales || [];
    const topProfit = analyticsTop?.topProfit || [];
    const analyticsLastSync = analyticsTop?.lastSyncedAt
        ? new Date(analyticsTop.lastSyncedAt).toLocaleString("pt-BR")
        : null;
    const liveTimestamp = format(new Date(), "dd 'de' MMMM, HH:mm", { locale: ptBR });

    return (
        <div className="min-h-screen bg-background text-foreground px-4 pb-12 pt-4 sm:px-8 sm:pt-8 animate-in fade-in duration-700">
            <section className="relative overflow-hidden rounded-[3rem] border border-border/60 bg-gradient-to-b from-amber-200/80 via-amber-100/50 to-background shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:from-amber-500/10 dark:via-amber-500/5 dark:to-background">
                <div className="absolute -top-32 left-1/2 h-64 w-[900px] -translate-x-1/2 rounded-[999px] bg-amber-300/80 blur-3xl dark:bg-amber-500/20" />
                <div className="absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
                <div className="absolute right-12 top-16 h-24 w-24 rounded-full bg-white/70 blur-2xl dark:bg-white/10" />

                <div className="relative z-10 space-y-10 p-6 sm:p-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-5">
                            <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-black/40">
                                <ShoppingBag className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                                        Mercado Livre Pro
                                    </h1>
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] uppercase tracking-widest">
                                        Live
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground font-medium mt-0.5">
                                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-background/70 border border-border/60 p-3 backdrop-blur">
                            <div className="relative group hidden sm:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Buscar anúncio..."
                                    className="pl-10 h-11 w-64 bg-background/80 border-border/40 rounded-2xl focus:ring-primary/20 transition-all"
                                />
                            </div>

                            <div className="h-10 w-[1px] bg-border/40 mx-1 hidden lg:block" />

                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Loja</div>
                                <Select
                                    value={workspaceId || ""}
                                    onValueChange={handleWorkspaceChange}
                                    disabled={workspacesLoading || !workspaces?.length}
                                >
                                    <SelectTrigger className="h-11 w-[200px] rounded-2xl bg-background/80 border-border/40">
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

                            <div className="h-10 w-[1px] bg-border/40 mx-1 hidden lg:block" />

                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Período</div>
                                <div className="flex items-center gap-2">
                                    <Select value={dateRange} onValueChange={setDateRange}>
                                        <SelectTrigger className="h-11 w-[180px] rounded-2xl bg-background/80 border-border/40">
                                            <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                                            <SelectValue placeholder="Últimos 30 dias" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Hoje</SelectItem>
                                            <SelectItem value="7">Últimos 7 dias</SelectItem>
                                            <SelectItem value="15">Últimos 15 dias</SelectItem>
                                            <SelectItem value="30">Últimos 30 dias</SelectItem>
                                            <SelectItem value="60">Últimos 60 dias</SelectItem>
                                            <SelectItem value="90">Últimos 90 dias</SelectItem>
                                            <SelectItem value="custom">Personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {isCustomRange && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-11 rounded-2xl border-border/40 bg-background/80 gap-2"
                                                >
                                                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-semibold">{dateRangeLabel}</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="range"
                                                    selected={customDateRange}
                                                    defaultMonth={customDateRange?.from ?? new Date()}
                                                    onSelect={setCustomDateRange}
                                                    numberOfMonths={2}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={handleSyncData}
                                disabled={syncMutation.isPending}
                                className="h-11 px-5 rounded-2xl border-border/40 bg-background/80 hover:bg-background hover:scale-[1.02] transition-all gap-2"
                            >
                                <RefreshCcw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                <span className="font-bold text-xs uppercase tracking-tight">Sync</span>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleSyncAnalytics}
                                disabled={analyticsSyncMutation.isPending}
                                className="h-11 px-5 rounded-2xl border-border/40 bg-background/80 hover:bg-background hover:scale-[1.02] transition-all gap-2"
                            >
                                <TrendingUp className={`h-4 w-4 ${analyticsSyncMutation.isPending ? 'animate-pulse' : ''}`} />
                                <span className="font-bold text-xs uppercase tracking-tight">Analytics 30d</span>
                            </Button>

                            <MercadoLivreManualTokenDialog />

                            <MercadoLivreConnectButton
                                size="sm"
                                variant="outline"
                                className="h-11 px-4 rounded-2xl border-border/40 bg-background/80 hover:bg-background"
                            />

                            <ExportReportButton
                                workspaceId={workspaceId || ""}
                                dateRangeDays={String(resolvedRange.days)}
                                dateFrom={period.start_date}
                                dateTo={period.end_date}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-border/60 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                            Vendas de hoje ao vivo
                            <span className="text-foreground/70 font-semibold normal-case">{liveTimestamp}</span>
                        </div>
                        <div className="w-full max-w-3xl rounded-[2.5rem] border border-border/60 bg-card/90 backdrop-blur-md shadow-2xl p-6 sm:p-10">
                            <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Faturamento do Dia</div>
                            <div className="mt-3 text-7xl sm:text-8xl font-black tracking-tight leading-none text-foreground">
                                {formatCurrency(todayMetrics.revenue, 2)}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${todayMetrics.revenueTrend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                    {todayMetrics.revenueTrend >= 0 ? "+" : ""}{Math.abs(todayMetrics.revenueTrend).toFixed(1)}%
                                </span>
                                <span className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1 font-semibold text-muted-foreground">
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    {formatNumber(todayMetrics.orders)} pedidos hoje
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-3 space-y-6">
                    <Card className="border-border/60 bg-card/70 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-border/10 bg-muted/10">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Métricas-chave
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Layers className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Anúncios</p>
                                    <p className="text-sm font-black">{products?.activeCount || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Médio</p>
                                    <p className="text-sm font-black">{formatCurrency(averageTicket, 2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Cancelados</p>
                                    <p className="text-sm font-black text-destructive">{metrics?.canceledOrders || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Und. Vendidas</p>
                                    <p className="text-sm font-black">{metrics?.totalSales || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Compradores</p>
                                    <p className="text-sm font-black">{metrics?.totalBuyers || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border border-border/40">
                                <div className="h-8 w-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-destructive" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Valor Cancelado</p>
                                    <p className="text-sm font-black text-destructive">{formatCurrency(metrics?.canceledRevenue || 0)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        <PremiumKPICard
                            title="Vendas do Dia"
                            value={formatNumber(todayMetrics.orders)}
                            icon={ShoppingBag}
                            tone="info"
                            trend={`${Math.abs(todayMetrics.ordersTrend).toFixed(1)}%`}
                            trendUp={todayMetrics.ordersTrend >= 0}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.orders }))}
                            loading={dailySalesLoading}
                        />
                        <PremiumKPICard
                            title="Faturamento Bruto"
                            value={formatCurrency(totalRevenue)}
                            icon={DollarSign}
                            tone="primary"
                            trend={revenueTrend.value}
                            trendUp={revenueTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.revenue }))}
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Vendas Realizadas"
                            value={formatNumber(totalOrders)}
                            icon={ShoppingCart}
                            tone="info"
                            trend={ordersTrend.value}
                            trendUp={ordersTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.orders }))}
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Visitas aos Anúncios"
                            value={formatNumber(totalVisits)}
                            icon={MousePointer}
                            tone="info"
                            trend={visitsTrend.value}
                            trendUp={visitsTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: d.sales / 10 }))}
                            loading={metricsLoading}
                        />
                        <PremiumKPICard
                            title="Taxa de Conversão"
                            value={`${conversionRate.toFixed(2)}%`}
                            icon={Users}
                            tone="info"
                            trend={conversionTrend.value}
                            trendUp={conversionTrend.up}
                            chartData={dailySales?.dailySales?.map(d => ({ value: (d.orders / (d.sales || 1)) * 100 }))}
                            loading={metricsLoading}
                        />
                    </div>
                </div>

                <div className="lg:col-span-6 space-y-6">
                    <MainPerformanceChart
                        data={dailySales?.dailySales || []}
                        hourlyData={metrics?.hourlySales}
                        comparisonHourlyData={previousMetrics?.hourlySales}
                        comparisonLabel={resolvedRange.days === 1 ? "Ontem" : "Período anterior"}
                        loading={dailySalesLoading}
                        title="Tendências em vendas brutas"
                    />

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <ShoppingBag className="h-5 w-5 text-primary" />
                                        Top Vendidos (30d)
                                    </CardTitle>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                        {analyticsLastSync ? `Atualizado ${analyticsLastSync}` : "Sem sync"}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                {analyticsTopLoading ? (
                                    <Skeleton className="h-48 w-full" />
                                ) : (
                                    <div className="space-y-3">
                                        {topSales.slice(0, 5).map((product, index) => (
                                            <div
                                                key={product.id}
                                                className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 hover:bg-muted/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                                                        {index + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate">{product.title}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{product.mlItemId}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black">{formatNumber(product.sales30d)}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">vendas</p>
                                                </div>
                                            </div>
                                        ))}
                                        {topSales.length === 0 && (
                                            <div className="text-sm text-muted-foreground text-center py-8">
                                                Sem dados. Rode o Analytics 30d.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-success" />
                                        Top Lucro (30d)
                                    </CardTitle>
                                    {analyticsTop?.missingCostCount ? (
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                            {analyticsTop.missingCostCount} custos pendentes
                                        </Badge>
                                    ) : null}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                {analyticsTopLoading ? (
                                    <Skeleton className="h-48 w-full" />
                                ) : (
                                    <div className="space-y-3">
                                        {topProfit.slice(0, 5).map((product, index) => (
                                            <div
                                                key={product.id}
                                                className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 hover:bg-muted/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center text-xs font-black text-success">
                                                        {index + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate">{product.title}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{product.mlItemId}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-success">
                                                        {formatCurrency(product.profit30d, 2)}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                                        margem {(product.profitMargin * 100).toFixed(1)}%
                                                    </p>
                                                    {product.costMissing && (
                                                        <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-widest">
                                                            custo pendente
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {topProfit.length === 0 && (
                                            <div className="text-sm text-muted-foreground text-center py-8">
                                                Sem dados. Rode o Analytics 30d.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8">
                    <RecentActivity 
                        orders={ordersData?.orders || []} 
                        loading={ordersLoading} 
                        date={recentActivityDate}
                        onDateChange={setRecentActivityDate}
                        workspaceId={workspaceId}
                    />

                    <FinancialAnalysis
                        totalRevenue={totalRevenue}
                        totalSales={totalSales}
                        loading={metricsLoading}
                        realTotalFees={metrics?.totalSaleFees}
                        realTotalShippingCosts={metrics?.totalShippingCosts}
                    />
                </div>
            </div>

            {/* System Notifications / Warnings Footer */}
            {metrics?.alerts && metrics.alerts.length > 0 && (
                <div className="bg-warning/10 border border-warning/20 p-6 rounded-[2.5rem] mt-12">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-warning">Notificações Críticas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {metrics.alerts.map((alert: any, idx: number) => (
                            <div key={idx} className="bg-background/40 backdrop-blur-sm p-4 rounded-3xl border border-warning/20 hover:border-warning/40 transition-colors">
                                <p className="text-sm font-black text-warning uppercase tracking-tighter">{alert.title}</p>
                                <p className="text-xs text-warning/80 mt-1 font-medium leading-relaxed">{alert.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

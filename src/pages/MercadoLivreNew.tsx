import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Package,
    ExternalLink,
    AlertCircle,
    Users,
    MousePointer,
    ShoppingCart,
    Layers,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    useMercadoLivreMetrics,
    useMercadoLivreAdsFinance,
    useMercadoLivreProducts,
    useMercadoLivreAuthStatus,
    useMercadoLivreAnalyticsTop,
} from "@/hooks/useMercadoLivre";
import { useMercadoLivreDailySales, useMercadoLivreOrders } from "@/hooks/useMercadoLivreOrders";
import { useMercadoLivreShipments } from "@/hooks/useMercadoLivreShipments";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { PremiumKPICard } from "@/components/mercadolivre/redesign/PremiumKPICard";
import { MainPerformanceChart } from "@/components/mercadolivre/redesign/MainPerformanceChart";
import { RecentActivity } from "@/components/mercadolivre/redesign/RecentActivity";
import { FinancialAnalysis } from "@/components/mercadolivre/FinancialAnalysis";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSearchParams } from "react-router-dom";
import {
    ML_PERIOD_PARAM,
    getMercadoLivreBillingCycleRange,
    normalizeMercadoLivrePeriod,
    parseMercadoLivreCustomRange,
} from "@/lib/mercadolivre-period";

const formatCurrency = (value: number, fractionDigits: number = 0) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const formatBrazilDateKey = (date: Date) => BRAZIL_DATE_FORMATTER.format(date);
const TOP_LIST_OPTIONS = [5, 10, 20];
const SURFACE_CARD_CLASS = "relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.09)] backdrop-blur-md";
const SURFACE_HEADER_CLASS = "relative pb-4 border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]";
const getProductListingHref = (product: { mlPermalink?: string | null }) => {
    const permalink = product.mlPermalink?.trim();
    return permalink && /^https?:\/\//i.test(permalink) ? permalink : null;
};

export default function MercadoLivreNew() {
    const { currentWorkspace } = useWorkspace();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const processedOrdersRef = useRef<Set<string>>(new Set());
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        (import.meta.env.VITE_WORKSPACE_ID as string) || null
    );
    const [recentActivityDate, setRecentActivityDate] = useState<Date | undefined>(new Date());
    const [sseConnected, setSseConnected] = useState(false);
    const [topSalesDisplayCount, setTopSalesDisplayCount] = useState("5");
    const [topSalesPage, setTopSalesPage] = useState(1);
    const [topProfitDisplayCount, setTopProfitDisplayCount] = useState("5");
    const [topProfitPage, setTopProfitPage] = useState(1);
    const [lowSalesDisplayCount, setLowSalesDisplayCount] = useState("5");
    const autoConnectEnabled =
        String(import.meta.env.VITE_ML_AUTO_CONNECT || "").toLowerCase() === "true";

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

    const dateRange = useMemo(
        () => normalizeMercadoLivrePeriod(searchParams.get(ML_PERIOD_PARAM)),
        [searchParams]
    );
    const customDateRange = useMemo(
        () => parseMercadoLivreCustomRange(searchParams),
        [searchParams]
    );
    const isCustomRange = dateRange === "custom";

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

        if (dateRange === "billing") {
            const billingRange = getMercadoLivreBillingCycleRange(today);
            const from = new Date(billingRange.from ?? today);
            from.setHours(0, 0, 0, 0);
            const to = new Date(billingRange.to ?? today);
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

    const hourlyComparisonRange = useMemo(() => {
        const todayKey = formatBrazilDateKey(new Date());
        const yesterdayRef = new Date(`${todayKey}T12:00:00-03:00`);
        yesterdayRef.setDate(yesterdayRef.getDate() - 1);
        const yesterdayKey = formatBrazilDateKey(yesterdayRef);

        return {
            today: { start_date: todayKey, end_date: todayKey },
            yesterday: { start_date: yesterdayKey, end_date: yesterdayKey },
        };
    }, []);

    const { data: authStatus, isLoading: authStatusLoading } = useMercadoLivreAuthStatus(workspaceId);

    useEffect(() => {
        if (!autoConnectEnabled || !workspaceId || authStatusLoading || authStatus?.connected) return;

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
    }, [authStatus?.connected, authStatusLoading, autoConnectEnabled, workspaceId]);

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
    const { data: hourlyTodayMetrics, isLoading: hourlyTodayLoading } = useMercadoLivreMetrics(
        workspaceId,
        1,
        {
            dateFrom: hourlyComparisonRange.today.start_date,
            dateTo: hourlyComparisonRange.today.end_date,
        }
    );
    const { data: hourlyYesterdayMetrics, isLoading: hourlyYesterdayLoading } = useMercadoLivreMetrics(
        workspaceId,
        1,
        {
            dateFrom: hourlyComparisonRange.yesterday.start_date,
            dateTo: hourlyComparisonRange.yesterday.end_date,
        }
    );
    const { data: products } = useMercadoLivreProducts(workspaceId);
    const { data: adsFinance, isLoading: adsFinanceLoading } = useMercadoLivreAdsFinance(
        workspaceId,
        { days: resolvedRange.days, dateFrom: period.start_date, dateTo: period.end_date }
    );
    const { data: dailySales, isLoading: dailySalesLoading } = useMercadoLivreDailySales(
        workspaceId,
        period.start_date,
        period.end_date
    );

    const ordersParams = useMemo(() => {
        const params: any = { limit: 50, includeCancelled: true, activity: "confirmed" };
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
            const activityMode = ordersParams?.activity;
            const baseDate = activityMode === "confirmed"
                ? (order.dateClosed || order.dateCreated)
                : order.dateCreated;
            const orderDate = baseDate ? new Date(baseDate) : null;
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

    const { data: ordersData, isLoading: ordersLoading } = useMercadoLivreOrders(workspaceId, ordersParams);
    const { data: shipmentsData, isLoading: shipmentsLoading } = useMercadoLivreShipments(workspaceId, {
        // Remover filtro de status para trazer TODOS os envios do dia (Normal, Full, Shipped, etc)
        // Traz todos os envios do dia (Normal, Full, etc) para contagens corretas
        limit: 50
    });
    const { data: analyticsTop, isLoading: analyticsTopLoading } = useMercadoLivreAnalyticsTop(
        workspaceId,
        20,
        {
            days: resolvedRange.days,
            dateFrom: period.start_date,
            dateTo: period.end_date,
        }
    );

    const todayMetrics = useMemo(() => {
        if (!recentActivityDate) return { revenue: 0, orders: 0, revenueTrend: 0, ordersTrend: 0 };

        const normalizeStatus = (value?: string | null) => String(value || "").toLowerCase();
        const isCancelledStatus = (value?: string | null) => {
            const normalized = normalizeStatus(value);
            return normalized === "cancelled" || normalized === "canceled";
        };

        const dateKey = format(recentActivityDate, "yyyy-MM-dd");
        const dayData = dailySales?.dailySales?.find((d) => d.date === dateKey);

        const prevDate = new Date(recentActivityDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevKey = format(prevDate, "yyyy-MM-dd");
        const prevData = dailySales?.dailySales?.find((d) => d.date === prevKey);

        const ordersForDay = Array.isArray(ordersData?.orders) ? ordersData.orders : [];
        const liquidOrders = ordersForDay.filter((order) => !isCancelledStatus(order?.status));

        const currentRevenue = ordersForDay.length > 0
            ? liquidOrders.reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0)
            : (dayData?.revenue || 0);

        const currentOrders = ordersForDay.length > 0 ? liquidOrders.length : (dayData?.orders || 0);

        const prevRevenue = prevData?.revenue || 0;
        const prevOrders = prevData?.orders || 0;

        const calcTrend = (curr: number, prev: number) => {
            if (!prev) return 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            revenue: currentRevenue,
            orders: currentOrders,
            revenueTrend: calcTrend(currentRevenue, prevRevenue),
            ordersTrend: calcTrend(currentOrders, prevOrders),
        };
    }, [dailySales, recentActivityDate, ordersData]);

    // Cálculos
    const totalRevenue = metrics?.totalRevenue ?? 0;
    const totalOrders = metrics?.totalOrders ?? 0;
    const totalSales = metrics?.totalSales ?? 0;
    const totalVisits = metrics?.totalVisits ?? 0;
    const conversionRate = metrics?.conversionRate ?? 0;

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
    const keyMetricsItems = [
        {
            key: "anuncios",
            label: "Anúncios",
            value: formatNumber(products?.activeCount || 0),
            icon: Layers,
            iconWrapClass: "bg-blue-50",
            iconClass: "text-blue-700",
            valueClass: "text-slate-950",
        },
        {
            key: "ticket",
            label: "Ticket Médio",
            value: formatCurrency(averageTicket, 2),
            icon: DollarSign,
            iconWrapClass: "bg-blue-50",
            iconClass: "text-blue-700",
            valueClass: "text-slate-950",
        },
        {
            key: "cancelados",
            label: "Cancelados",
            value: formatNumber(metrics?.canceledOrders || 0),
            icon: AlertCircle,
            iconWrapClass: "bg-rose-50",
            iconClass: "text-rose-700",
            valueClass: "text-rose-700",
        },
        {
            key: "unidades",
            label: "Und. Vendidas",
            value: formatNumber(metrics?.totalSales || 0),
            icon: Package,
            iconWrapClass: "bg-blue-50",
            iconClass: "text-blue-700",
            valueClass: "text-slate-950",
        },
        {
            key: "visitas",
            label: "Visitas",
            value: formatNumber(totalVisits),
            icon: MousePointer,
            iconWrapClass: "bg-blue-50",
            iconClass: "text-blue-700",
            valueClass: "text-slate-950",
        },
        {
            key: "conversao",
            label: "Conversão",
            value: `${conversionRate.toFixed(2)}%`,
            icon: TrendingUp,
            iconWrapClass: "bg-emerald-50",
            iconClass: "text-emerald-700",
            valueClass: "text-emerald-700",
        },
        {
            key: "compradores",
            label: "Compradores",
            value: formatNumber(metrics?.totalBuyers || 0),
            icon: Users,
            iconWrapClass: "bg-blue-50",
            iconClass: "text-blue-700",
            valueClass: "text-slate-950",
        },
        {
            key: "valor-cancelado",
            label: "Valor Cancelado",
            value: formatCurrency(metrics?.canceledRevenue || 0),
            icon: DollarSign,
            iconWrapClass: "bg-rose-50",
            iconClass: "text-rose-700",
            valueClass: "text-rose-700",
        },
    ];

    const topSales = analyticsTop?.topSales || [];
    const topProfit = analyticsTop?.topProfit || [];
    const lowSalesWithStock = analyticsTop?.lowSalesWithStock || [];
    const topSalesPageSize = Number(topSalesDisplayCount);
    const topProfitPageSize = Number(topProfitDisplayCount);
    const topSalesTotalPages = Math.max(1, Math.ceil(topSales.length / topSalesPageSize));
    const topProfitTotalPages = Math.max(1, Math.ceil(topProfit.length / topProfitPageSize));
    const topSalesStartIndex = (topSalesPage - 1) * topSalesPageSize;
    const topProfitStartIndex = (topProfitPage - 1) * topProfitPageSize;
    const visibleTopSales = topSales.slice(topSalesStartIndex, topSalesStartIndex + topSalesPageSize);
    const visibleTopProfit = topProfit.slice(topProfitStartIndex, topProfitStartIndex + topProfitPageSize);
    const visibleLowSalesWithStock = lowSalesWithStock.slice(0, Number(lowSalesDisplayCount));
    const analyticsPeriodLabel = `${analyticsTop?.days ?? resolvedRange.days}d`;
    const analyticsLastSync = analyticsTop?.lastSyncedAt
        ? new Date(analyticsTop.lastSyncedAt).toLocaleString("pt-BR")
        : null;
    const liveTimestamp = format(new Date(), "dd 'de' MMMM, HH:mm", { locale: ptBR });

    useEffect(() => {
        setTopSalesPage(1);
    }, [topSalesDisplayCount, period.start_date, period.end_date]);

    useEffect(() => {
        setTopProfitPage(1);
    }, [topProfitDisplayCount, period.start_date, period.end_date]);

    useEffect(() => {
        setTopSalesPage((currentPage) => Math.min(currentPage, topSalesTotalPages));
    }, [topSalesTotalPages]);

    useEffect(() => {
        setTopProfitPage((currentPage) => Math.min(currentPage, topProfitTotalPages));
    }, [topProfitTotalPages]);

    return (
        <div className="min-h-screen animate-in fade-in bg-white px-4 pb-12 pt-4 text-foreground duration-700 sm:px-8 sm:pt-8">
            <section className="relative overflow-hidden rounded-[2.5rem] border border-[#ead34d] bg-[linear-gradient(180deg,#ffe600_0%,#ffe600_58%,#fff7cc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40">
                    <div className="absolute inset-x-[-8%] bottom-[-5.25rem] h-40 rounded-[100%] bg-white" />
                    <div className="absolute left-[-6%] bottom-[-4.25rem] h-24 w-[58%] rounded-[100%] bg-[#fff3b0]" />
                    <div className="absolute right-[-6%] bottom-[-4.25rem] h-24 w-[58%] rounded-[100%] bg-[#fff3b0]" />
                </div>

                <div className="relative z-10 flex flex-col items-center px-6 pb-16 pt-10 text-center sm:px-10 sm:pb-20 sm:pt-12">
                        <div className="text-3xl font-bold tracking-tight text-[#333333] sm:text-5xl">
                            Vendas de hoje ao vivo
                        </div>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ececec] px-5 py-2 text-sm font-medium text-[#333333] shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                            {liveTimestamp}
                        </div>
                        <div className="relative mt-5 w-full max-w-[600px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-6 py-7 shadow-[0_12px_28px_rgba(0,0,0,0.10)] sm:px-8 sm:py-8">
                            <div className="relative z-10 text-[11px] font-bold uppercase tracking-[0.26em] text-slate-500">Faturamento do Dia</div>
                            <div className="relative z-10 mt-3 text-5xl font-medium leading-none tracking-tight text-[#333333] sm:text-7xl">
                                {formatCurrency(todayMetrics.revenue, 2)}
                            </div>
                            <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${todayMetrics.revenueTrend >= 0 ? "border-emerald-200/80 bg-emerald-50 text-emerald-700" : "border-rose-200/80 bg-rose-50 text-rose-700"}`}>
                                    {todayMetrics.revenueTrend >= 0 ? "+" : ""}{Math.abs(todayMetrics.revenueTrend).toFixed(1)}%
                                </span>
                                <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-semibold text-slate-500">
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    {formatNumber(todayMetrics.orders)} pedidos hoje
                                </span>
                            </div>
                        </div>
                </div>
            </section>

            <div className="mt-10 space-y-8">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
                    <Card className={`${SURFACE_CARD_CLASS} flex flex-col lg:col-span-3`}>
                        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.90),rgba(125,211,252,0.65),rgba(255,255,255,0))]" />
                        <CardHeader className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] pb-3">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Layers className="h-4 w-4 text-blue-600" />
                                Métricas-chave
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid flex-1 grid-cols-2 grid-rows-4 gap-3 p-4">
                            {keyMetricsItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.key}
                                        className="flex h-full min-h-[102px] items-center gap-4 rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-4 py-3 shadow-sm"
                                    >
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.iconWrapClass}`}>
                                            <Icon className={`h-5 w-5 ${item.iconClass}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                                {item.label}
                                            </p>
                                            <p className={`mt-1 text-[1.45rem] font-black leading-none ${item.valueClass}`}>
                                                {item.value}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-6">
                        <MainPerformanceChart
                            data={dailySales?.dailySales || []}
                            hourlyData={hourlyTodayMetrics?.hourlySales}
                            comparisonHourlyData={hourlyYesterdayMetrics?.hourlySales}
                            comparisonLabel="Ontem"
                            loading={dailySalesLoading}
                            hourlyLoading={hourlyTodayLoading || hourlyYesterdayLoading}
                            title="Tendências em vendas brutas"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <RecentActivity 
                            orders={ordersData?.orders || []} 
                            loading={ordersLoading} 
                            date={recentActivityDate}
                            onDateChange={setRecentActivityDate}
                            workspaceId={workspaceId}
                            products={products?.items || []}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
                    <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1 lg:grid-rows-5">
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

                    <div className="flex h-full flex-col gap-6 lg:col-span-6">
                        <Card className={`${SURFACE_CARD_CLASS} flex flex-1 flex-col`}>
                            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.90),rgba(125,211,252,0.65),rgba(255,255,255,0))]" />
                            <CardHeader className={SURFACE_HEADER_CLASS}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <ShoppingBag className="h-5 w-5 text-blue-600" />
                                        {`Top Vendidos (${analyticsPeriodLabel})`}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                            {analyticsLastSync ? `Atualizado ${analyticsLastSync}` : "Sem sync"}
                                        </div>
                                        <Select value={topSalesDisplayCount} onValueChange={setTopSalesDisplayCount}>
                                            <SelectTrigger className="h-9 w-[110px] rounded-2xl border-slate-200/80 bg-white text-xs">
                                                <SelectValue placeholder="Mostrar 5" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TOP_LIST_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={String(option)}>
                                                        Top {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col p-6">
                                {analyticsTopLoading ? (
                                    <Skeleton className="h-48 w-full" />
                                ) : (
                                    <div className="flex min-h-0 flex-1 flex-col space-y-3">
                                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                                            {visibleTopSales.map((product, index) => {
                                                const href = getProductListingHref(product);
                                                return (
                                                    <a
                                                        key={product.id}
                                                        href={href || undefined}
                                                        target={href ? "_blank" : undefined}
                                                        rel={href ? "noreferrer" : undefined}
                                                        className={`group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 transition-colors ${
                                                            href
                                                                ? "cursor-pointer hover:border-blue-200/70 hover:bg-blue-50/50"
                                                                : "cursor-default hover:bg-slate-100"
                                                        }`}
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                                                                {topSalesStartIndex + index + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold transition-colors group-hover:text-blue-700">
                                                                    {product.title}
                                                                </p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="truncate text-[10px] text-muted-foreground">
                                                                        {product.mlItemId}
                                                                    </p>
                                                                    {href ? (
                                                                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-blue-700" />
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-sm font-black">{formatNumber(product.sales30d)}</p>
                                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">vendas</p>
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                        {topSales.length === 0 && (
                                            <div className="py-8 text-center text-sm text-muted-foreground">
                                                Sem dados. Atualize o analytics do período.
                                            </div>
                                        )}
                                        {topSales.length > 0 && (
                                            <div className="flex items-center justify-between border-t border-slate-200/70 pt-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => setTopSalesPage((currentPage) => Math.max(1, currentPage - 1))}
                                                    disabled={topSalesPage === 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <p className="text-xs font-semibold text-slate-500">
                                                    Página {topSalesPage} de {topSalesTotalPages}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => setTopSalesPage((currentPage) => Math.min(topSalesTotalPages, currentPage + 1))}
                                                    disabled={topSalesPage === topSalesTotalPages}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className={`${SURFACE_CARD_CLASS} flex flex-1 flex-col`}>
                            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(5,150,105,0.90),rgba(52,211,153,0.65),rgba(255,255,255,0))]" />
                            <CardHeader className={SURFACE_HEADER_CLASS}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-emerald-600" />
                                        {`Top Lucro (${analyticsPeriodLabel})`}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {analyticsTop?.missingCostCount ? (
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                                {analyticsTop.missingCostCount} custos pendentes
                                            </Badge>
                                        ) : null}
                                        <Select value={topProfitDisplayCount} onValueChange={setTopProfitDisplayCount}>
                                            <SelectTrigger className="h-9 w-[110px] rounded-2xl border-slate-200/80 bg-white text-xs">
                                                <SelectValue placeholder="Mostrar 5" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TOP_LIST_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={String(option)}>
                                                        Top {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col p-6">
                                {analyticsTopLoading ? (
                                    <Skeleton className="h-48 w-full" />
                                ) : (
                                    <div className="flex min-h-0 flex-1 flex-col space-y-3">
                                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                                            {visibleTopProfit.map((product, index) => {
                                                const href = getProductListingHref(product);
                                                return (
                                                    <a
                                                        key={product.id}
                                                        href={href || undefined}
                                                        target={href ? "_blank" : undefined}
                                                        rel={href ? "noreferrer" : undefined}
                                                        className={`group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 transition-colors ${
                                                            href
                                                                ? "cursor-pointer hover:border-emerald-200/70 hover:bg-emerald-50/50"
                                                                : "cursor-default hover:bg-slate-100"
                                                        }`}
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">
                                                                {topProfitStartIndex + index + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold transition-colors group-hover:text-emerald-700">
                                                                    {product.title}
                                                                </p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="truncate text-[10px] text-muted-foreground">
                                                                        {product.mlItemId}
                                                                    </p>
                                                                    {href ? (
                                                                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-emerald-700" />
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-sm font-black text-emerald-700">
                                                                {formatCurrency(product.profit30d, 2)}
                                                            </p>
                                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                                                margem {(product.profitMargin * 100).toFixed(1)}%
                                                            </p>
                                                            {product.costMissing && (
                                                                <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-widest">
                                                                    custo pendente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                        {topProfit.length === 0 && (
                                            <div className="py-8 text-center text-sm text-muted-foreground">
                                                Sem dados. Atualize o analytics do período.
                                            </div>
                                        )}
                                        {topProfit.length > 0 && (
                                            <div className="flex items-center justify-between border-t border-slate-200/70 pt-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => setTopProfitPage((currentPage) => Math.max(1, currentPage - 1))}
                                                    disabled={topProfitPage === 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <p className="text-xs font-semibold text-slate-500">
                                                    Página {topProfitPage} de {topProfitTotalPages}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => setTopProfitPage((currentPage) => Math.min(topProfitTotalPages, currentPage + 1))}
                                                    disabled={topProfitPage === topProfitTotalPages}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-3">
                        <FinancialAnalysis
                            totalRevenue={totalRevenue}
                            totalSales={totalSales}
                            periodDays={resolvedRange.days}
                            loading={metricsLoading || adsFinanceLoading}
                            realTotalNetReceivedAmount={metrics?.totalNetReceivedAmount}
                            realTotalAdsSpend={adsFinance?.usedInEstimate.amount}
                            realTotalAdsSpendLabel={adsFinance?.usedInEstimate.label}
                            realTotalAdsSpendExact={adsFinance?.usedInEstimate.exact}
                        />
                    </div>
                </div>

                <Card className={SURFACE_CARD_CLASS}>
                    <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(217,119,6,0.90),rgba(253,224,71,0.65),rgba(255,255,255,0))]" />
                    <CardHeader className={SURFACE_HEADER_CLASS}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Package className="h-5 w-5 text-amber-600" />
                                {`Menos Vendidos c/ Estoque (${analyticsPeriodLabel})`}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                    estoque ativo
                                </Badge>
                                <Select value={lowSalesDisplayCount} onValueChange={setLowSalesDisplayCount}>
                                    <SelectTrigger className="h-9 w-[110px] rounded-2xl border-slate-200/80 bg-white text-xs">
                                        <SelectValue placeholder="Mostrar 5" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TOP_LIST_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={String(option)}>
                                                Top {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        {analyticsTopLoading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : (
                            <div className="space-y-3">
                                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-2">
                                    {visibleLowSalesWithStock.map((product, index) => {
                                        const href = getProductListingHref(product);
                                        return (
                                            <a
                                                key={product.id}
                                                href={href || undefined}
                                                target={href ? "_blank" : undefined}
                                                rel={href ? "noreferrer" : undefined}
                                                className={`group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 transition-colors ${
                                                    href
                                                        ? "cursor-pointer hover:border-amber-200/70 hover:bg-amber-50/50"
                                                        : "cursor-default hover:bg-slate-100"
                                                }`}
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-xs font-black text-amber-700">
                                                        {index + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold transition-colors group-hover:text-amber-700">
                                                            {product.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="truncate text-[10px] text-muted-foreground">
                                                                {product.mlItemId}
                                                            </p>
                                                            {href ? (
                                                                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-amber-700" />
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-black">{formatNumber(product.sales30d)}</p>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">vendas</p>
                                                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                                                        estoque {formatNumber(product.availableQuantity)}
                                                    </p>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                                {lowSalesWithStock.length === 0 && (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                        Nenhum produto com estoque parado no período.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* System Notifications / Warnings Footer */}
            {metrics?.alerts && metrics.alerts.length > 0 && (
                <div className="mt-12 rounded-[2.5rem] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))] p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-5 w-5 text-amber-700" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-amber-700">Notificações Críticas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {metrics.alerts.map((alert: any, idx: number) => (
                            <div key={idx} className="rounded-3xl border border-amber-200/70 bg-white/80 p-4 backdrop-blur-sm transition-colors hover:border-amber-300/80">
                                <p className="text-sm font-black uppercase tracking-tighter text-amber-700">{alert.title}</p>
                                <p className="mt-1 text-xs font-medium leading-relaxed text-amber-700/80">{alert.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

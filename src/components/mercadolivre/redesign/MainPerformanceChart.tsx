import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface PerformanceChartProps {
    data: Array<{
        date: string;
        revenue: number;
        sales?: number;
        orders?: number;
    }>;
    hourlyData?: Array<{
        date: string;
        hour?: number;
        sales: number;
        revenue: number;
    }>;
    comparisonHourlyData?: Array<{
        date: string;
        hour?: number;
        sales: number;
        revenue: number;
    }>;
    comparisonLabel?: string;
    loading?: boolean;
    hourlyLoading?: boolean;
    title?: string;
}

const YESTERDAY_STROKE = "hsl(330 81% 60%)";

const getEntryHour = (entry: { date: string; hour?: number }) => {
    if (typeof entry.hour === "number" && entry.hour >= 0 && entry.hour <= 23) {
        return entry.hour;
    }

    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) return null;
    return date.getHours();
};

export function MainPerformanceChart({
    data,
    hourlyData,
    comparisonHourlyData,
    comparisonLabel = "Ontem",
    loading,
    hourlyLoading,
    title = "Desempenho de Vendas",
}: PerformanceChartProps) {
    type ViewMode = "daily" | "hourly";
    const [viewMode, setViewMode] = useState<ViewMode>("daily");
    const hasHourlyData = hourlyLoading || hourlyData !== undefined || comparisonHourlyData !== undefined;

    useEffect(() => {
        if (!hasHourlyData && viewMode === "hourly") {
            setViewMode("daily");
        }
    }, [hasHourlyData, viewMode]);

    const hourlySeries = useMemo(() => {
        if (!hourlyData) return [];

        const buckets = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            revenue: 0,
            sales: 0,
            yesterdayRevenue: 0,
        }));

        const comparisonByHour = new Map<number, number>();
        if (comparisonHourlyData) {
            comparisonHourlyData.forEach((entry) => {
                const hour = getEntryHour(entry);
                if (hour === null) return;
                comparisonByHour.set(hour, (comparisonByHour.get(hour) || 0) + (entry.revenue || 0));
            });
        }

        hourlyData.forEach((entry) => {
            const hour = getEntryHour(entry);
            if (hour === null) return;
            const bucket = buckets[hour];
            if (!bucket) return;
            const entryRevenue = entry.revenue || 0;
            const entrySales = entry.sales || 0;

            bucket.revenue += entryRevenue;
            bucket.sales += entrySales;
        });

        let currentRevenueRunning = 0;
        let currentSalesRunning = 0;
        let yesterdayRevenueRunning = 0;

        return buckets.map((bucket) => {
            currentRevenueRunning += bucket.revenue;
            currentSalesRunning += bucket.sales;
            yesterdayRevenueRunning += comparisonByHour.get(bucket.hour) || 0;

            return {
                ...bucket,
                revenue: currentRevenueRunning,
                sales: currentSalesRunning,
                yesterdayRevenue: yesterdayRevenueRunning,
            };
        });
    }, [hourlyData, comparisonHourlyData]);

    const isHourlyView = viewMode === "hourly" && hasHourlyData;
    const chartData = isHourlyView ? hourlySeries : data;
    const comparisonTotal = useMemo(() => {
        if (!comparisonHourlyData) return 0;
        return comparisonHourlyData.reduce((sum, entry) => sum + (entry.revenue || 0), 0);
    }, [comparisonHourlyData]);

    const showComparisonLine = isHourlyView && comparisonTotal > 0;

    const formatHourLabel = (value: number | string) => {
        const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return String(value);
        return `${String(parsed).padStart(2, "0")}h`;
    };

    if (loading || (isHourlyView && hourlyLoading)) {
        return (
            <Card className="h-full overflow-hidden border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
            <CardContent className="flex-1">
                <Skeleton className="h-[420px] w-full" />
            </CardContent>
            </Card>
        );
    }

    return (
        <Card className="group relative h-full overflow-hidden border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.90),rgba(125,211,252,0.7),rgba(255,255,255,0))]" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] pb-7">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        {title}
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                        {isHourlyView
                            ? "Faturamento acumulado por hora: hoje vs ontem"
                            : "Faturamento diário e volume de pedidos"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {hasHourlyData && (
                        <ToggleGroup
                            type="single"
                            value={viewMode}
                            onValueChange={(value) => {
                                if (value) setViewMode(value as ViewMode);
                            }}
                            variant="outline"
                            size="sm"
                            className="rounded-full border border-slate-200/70 bg-slate-100/90 p-1"
                        >
                            <ToggleGroupItem value="daily" className="text-[11px]">
                                Diário
                            </ToggleGroupItem>
                            <ToggleGroupItem value="hourly" className="text-[11px]">
                                Horário
                            </ToggleGroupItem>
                            </ToggleGroup>
                    )}
                    <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                        Live Data
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative pt-6 pb-5">
                <div className="pointer-events-none absolute inset-x-5 bottom-5 top-4 rounded-[2rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.7),rgba(239,246,255,0.28))]" />
                <div className="relative h-[420px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                            <XAxis
                                dataKey={isHourlyView ? "hour" : "date"}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickFormatter={(value) => {
                                    if (isHourlyView) {
                                        return formatHourLabel(value);
                                    }
                                    // Parse manually to avoid timezone issues with new Date("YYYY-MM-DD")
                                    // which defaults to UTC midnight and can shift to previous day in local time
                                    const [year, month, day] = String(value).split('-');
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                                }}
                                interval={isHourlyView ? 1 : undefined}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickFormatter={(value) => `R$ ${value}`}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const entry = payload[0]?.payload as {
                                            revenue?: number;
                                            sales?: number;
                                            orders?: number;
                                            hour?: number;
                                            yesterdayRevenue?: number;
                                        };
                                        const revenuePayload = payload.find((item) => item.dataKey === "revenue");
                                        const salesPayload = payload.find((item) => item.dataKey === "sales");
                                        const yesterdayPayload = payload.find((item) => item.dataKey === "yesterdayRevenue");
                                        const revenueValue = typeof entry?.revenue === "number"
                                            ? entry.revenue
                                            : Number(revenuePayload?.value ?? 0);
                                        const salesValue = typeof entry?.sales === "number"
                                            ? entry.sales
                                            : (salesPayload?.value as number | undefined);
                                        const yesterdayValue = typeof entry?.yesterdayRevenue === "number"
                                            ? entry.yesterdayRevenue
                                            : (yesterdayPayload?.value as number | undefined);
                                        const hasSalesValue = typeof salesValue === "number" && !Number.isNaN(salesValue);
                                        const hasYesterdayValue = typeof yesterdayValue === "number" && !Number.isNaN(yesterdayValue);
                                        const labelText = isHourlyView
                                            ? `Horário ${formatHourLabel(label)}`
                                            : (() => {
                                                // Parse manually to avoid timezone issues
                                                const [year, month, day] = String(label).split('-');
                                                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                                return date.toLocaleDateString('pt-BR', {
                                                    weekday: 'long',
                                                    day: '2-digit',
                                                    month: 'long'
                                                });
                                            })();
                                        
                                        return (
                                            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5 backdrop-blur-md">
                                                <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                                                    {labelText}
                                                </p>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-8">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                                            {isHourlyView ? "Hoje" : "Receita"}
                                                        </span>
                                                        <span className="text-sm font-bold">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenueValue || 0)}
                                                        </span>
                                                    </div>
                                                    {showComparisonLine && hasYesterdayValue && (
                                                        <div className="flex items-center justify-between gap-8">
                                                            <span className="text-sm font-medium flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: YESTERDAY_STROKE }} />
                                                                {comparisonLabel}
                                                            </span>
                                                            <span className="text-sm font-bold">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yesterdayValue || 0)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {hasSalesValue && (
                                                        <div className="flex items-center justify-between gap-8">
                                                            <span className="text-sm font-medium flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                                                                Vendas
                                                            </span>
                                                            <span className="text-sm font-bold">
                                                                {salesValue} un
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="hsl(var(--primary))"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                            />
                            {showComparisonLine && (
                                <Line
                                    type="monotone"
                                    dataKey="yesterdayRevenue"
                                    stroke={YESTERDAY_STROKE}
                                    strokeWidth={2.5}
                                    dot={false}
                                    animationDuration={1400}
                                    animationEasing="ease-in-out"
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

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
        sales: number;
        revenue: number;
    }>;
    comparisonHourlyData?: Array<{
        date: string;
        sales: number;
        revenue: number;
    }>;
    comparisonLabel?: string;
    loading?: boolean;
    title?: string;
}

const YESTERDAY_STROKE = "hsl(330 81% 60%)";

export function MainPerformanceChart({
    data,
    hourlyData,
    comparisonHourlyData,
    comparisonLabel = "Ontem",
    loading,
    title = "Desempenho de Vendas",
}: PerformanceChartProps) {
    type ViewMode = "daily" | "hourly";
    const [viewMode, setViewMode] = useState<ViewMode>("daily");
    const hasHourlyData = hourlyData !== undefined;

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
                const date = new Date(entry.date);
                if (Number.isNaN(date.getTime())) return;
                const hour = date.getHours();
                comparisonByHour.set(hour, (comparisonByHour.get(hour) || 0) + (entry.revenue || 0));
            });
        }

        hourlyData.forEach((entry) => {
            const date = new Date(entry.date);
            if (Number.isNaN(date.getTime())) return;
            const hour = date.getHours();
            const bucket = buckets[hour];
            if (!bucket) return;
            const entryRevenue = entry.revenue || 0;
            const entrySales = entry.sales || 0;

            bucket.revenue += entryRevenue;
            bucket.sales += entrySales;
        });

        buckets.forEach((bucket) => {
            bucket.yesterdayRevenue = comparisonByHour.get(bucket.hour) || 0;
        });

        return buckets;
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

    if (loading) {
        return (
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b border-border/10 bg-muted/5">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        {title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {isHourlyView
                            ? "Faturamento por hora do dia (somado no período)"
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
                            className="rounded-full bg-background/60 p-1"
                        >
                            <ToggleGroupItem value="daily" className="text-[11px]">
                                Diário
                            </ToggleGroupItem>
                            <ToggleGroupItem value="hourly" className="text-[11px]">
                                Horário
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        Live Data
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="h-[350px] w-full">
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
                                            <div className="bg-background/90 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5">
                                                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                                                    {labelText}
                                                </p>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-8">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                                            Receita
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Wallet } from "lucide-react";

interface PerformanceChartProps {
    data: any[];
    loading?: boolean;
    title?: string;
}

export function MainPerformanceChart({ data, loading, title = "Desempenho de Vendas" }: PerformanceChartProps) {
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
                    <p className="text-sm text-muted-foreground">Faturamento diário e volume de pedidos</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        Live Data
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
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
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickFormatter={(value) => {
                                    // Parse manually to avoid timezone issues with new Date("YYYY-MM-DD")
                                    // which defaults to UTC midnight and can shift to previous day in local time
                                    const [year, month, day] = value.split('-');
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                                }}
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
                                        // Parse manually to avoid timezone issues
                                        const [year, month, day] = label.split('-');
                                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                        
                                        return (
                                            <div className="bg-background/90 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5">
                                                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                                                    {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                                </p>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-8">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                                            Receita
                                                        </span>
                                                        <span className="text-sm font-bold">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value as number)}
                                                        </span>
                                                    </div>
                                                    {payload[1] && (
                                                        <div className="flex items-center justify-between gap-8">
                                                            <span className="text-sm font-medium flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                                                                Vendas
                                                            </span>
                                                            <span className="text-sm font-bold">
                                                                {payload[1].value} un
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
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

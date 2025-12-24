import { useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { format, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesPerformanceChartProps {
    data: Array<{
        date: string;
        sales: number;
        revenue: number;
    }>;
    loading?: boolean;
}

export function SalesPerformanceChart({ data, loading }: SalesPerformanceChartProps) {
    const chartData = useMemo(() => {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        return data.map((item) => {
            const date = parseISO(item.date);
            return {
                date: item.date,
                dayOfWeek: days[getDay(date)],
                fullDate: format(date, "dd 'de' MMMM", { locale: ptBR }),
                value: item.revenue, // Defaulting to revenue as it matches the scale 0-4000 better
            };
        });
    }, [data]);

    if (loading) {
        return (
            <Card className="border-none shadow-md h-full">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const formatValue = (value: number) => {
        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
        return value.toString();
    };

    return (
        <Card className="border-none shadow-md bg-white dark:bg-card h-full">
            <CardHeader className="pb-0 pt-6 px-6">
                <CardTitle className="text-base font-bold text-foreground">
                    Desempenho de Vendas (7 dias)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pl-2 pb-4">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} /> {/* Purple-ish */}
                                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                                dataKey="dayOfWeek"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#6B7280", fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#6B7280", fontSize: 12 }}
                                tickFormatter={formatValue}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                formatter={(value: number) => [
                                    new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                    }).format(value),
                                    "Faturamento",
                                ]}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload.length > 0) {
                                        return payload[0].payload.fullDate;
                                    }
                                    return label;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#4F46E5"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

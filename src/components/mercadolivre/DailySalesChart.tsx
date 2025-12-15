import { useMemo } from "react";
import {
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface DailySalesChartProps {
    data: Array<{
        date: string;
        sales: number;
        revenue: number;
        orders: number;
    }>;
    loading?: boolean;
}

export function DailySalesChart({ data, loading }: DailySalesChartProps) {
    const chartData = useMemo(() => {
        return data.map((item) => ({
            date: item.date,
            dateFormatted: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
            sales: item.sales,
            revenue: item.revenue,
            orders: item.orders,
        }));
    }, [data]);

    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado de vendas disponível para o período selecionado
            </div>
        );
    }

    const totalUnits = data.reduce((sum, item) => sum + item.sales, 0);
    const totalOrdersCount = data.reduce((sum, item) => sum + item.orders, 0);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat("pt-BR").format(value);
    };

    return (
        <div className="space-y-3">
            {/* Info Card */}
            <div className="flex items-center justify-center gap-6 p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--primary))]"></div>
                    <span className="font-medium">{totalUnits} unidades</span>
                    <span className="text-muted-foreground">vendidas em</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[hsl(47.9_95.8%_53.1%)]"></div>
                    <span className="font-medium">{totalOrdersCount} pedidos</span>
                </div>
                <span className="text-xs text-muted-foreground italic">
                    (1 pedido pode ter várias unidades)
                </span>
            </div>

            <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                <defs>
                    <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6D5EF7" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6D5EF7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#58C4DC" stopOpacity={0.30} />
                        <stop offset="100%" stopColor="#58C4DC" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F5D76E" stopOpacity={0.30} />
                        <stop offset="100%" stopColor="#F5D76E" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" className="stroke-muted" />
                <XAxis
                    dataKey="dateFormatted"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                    yAxisId="left"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={formatNumber}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `R$ ${formatNumber(value)}`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: any, name: string) => {
                        if (name === "revenue") {
                            return [formatCurrency(value), "Receita Total"];
                        } else if (name === "sales") {
                            return [formatNumber(value), "Unidades Vendidas"];
                        } else if (name === "orders") {
                            return [formatNumber(value), "Nº de Pedidos"];
                        }
                        return [value, name];
                    }}
                    labelFormatter={(label) => {
                        const item = chartData.find((d) => d.dateFormatted === label);
                        if (item) {
                            return format(parseISO(item.date), "dd 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                            });
                        }
                        return label;
                    }}
                />
                <Legend
                    wrapperStyle={{ paddingTop: "16px" }}
                    iconType="circle"
                    formatter={(value) => {
                        const labels: Record<string, string> = {
                            sales: "Unidades Vendidas",
                            revenue: "Receita Total (R$)",
                            orders: "Nº de Pedidos",
                        };
                        return labels[value] || value;
                    }}
                />
                <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="sales"
                    stroke="#6D5EF7"
                    strokeWidth={2.5}
                    fill="url(#gradSales)"
                    dot={{ r: 3, stroke: "#6D5EF7", fill: "transparent", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    name="sales"
                />
                <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#58C4DC"
                    strokeWidth={2.5}
                    fill="url(#gradRevenue)"
                    dot={{ r: 3, stroke: "#58C4DC", fill: "transparent", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    name="revenue"
                />
                <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="#F5D76E"
                    strokeWidth={2}
                    fill="url(#gradOrders)"
                    dot={{ r: 3, stroke: "#F5D76E", fill: "transparent", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    name="orders"
                />
            </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

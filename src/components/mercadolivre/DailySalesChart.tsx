import { useMemo } from "react";
import {
    LineChart,
    Line,
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
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                    wrapperStyle={{ paddingTop: "20px" }}
                    formatter={(value) => {
                        const labels: Record<string, string> = {
                            sales: "Unidades Vendidas",
                            revenue: "Receita Total (R$)",
                            orders: "Nº de Pedidos",
                        };
                        return labels[value] || value;
                    }}
                />
                <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="sales"
                />
                <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142.1 76.2% 36.3%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(142.1 76.2% 36.3%)", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="revenue"
                />
                <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="hsl(47.9 95.8% 53.1%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(47.9 95.8% 53.1%)", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="orders"
                />
            </LineChart>
        </ResponsiveContainer>
        </div>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Eye, ShoppingBag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Product {
    id: string;
    title: string;
    sales: number;
    visits: number;
    revenue: number;
    conversionRate?: number;
}

interface TopProductsChartProps {
    products: Product[];
    loading?: boolean;
    type?: "sales" | "visits" | "revenue";
}

export function TopProductsChart({ products, loading, type = "sales" }: TopProductsChartProps) {
    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold">
                        Top 5 Produtos
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        );
    }

    // Ordenar produtos baseado no tipo
    const sortedProducts = [...products]
        .sort((a, b) => {
            if (type === "sales") return b.sales - a.sales;
            if (type === "visits") return b.visits - a.visits;
            return b.revenue - a.revenue;
        })
        .slice(0, 5);

    // Preparar dados para o gráfico
    const chartData = sortedProducts.map((product) => ({
        name: product.title.length > 30 ? product.title.substring(0, 30) + "..." : product.title,
        value: type === "sales" ? product.sales : type === "visits" ? product.visits : product.revenue,
        fullName: product.title,
        sales: product.sales,
        visits: product.visits,
        revenue: product.revenue,
        conversionRate: product.conversionRate,
    }));

    // Cores do gráfico
    const colors = ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

    const getTitle = () => {
        if (type === "sales") return "Top 5 Produtos - Vendas";
        if (type === "visits") return "Top 5 Produtos - Visitas";
        return "Top 5 Produtos - Receita";
    };

    const getIcon = () => {
        if (type === "sales") return <ShoppingBag className="h-4 w-4" />;
        if (type === "visits") return <Eye className="h-4 w-4" />;
        return <TrendingUp className="h-4 w-4" />;
    };

    const formatValue = (value: number) => {
        if (type === "revenue") {
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
            }).format(value);
        }
        return new Intl.NumberFormat("pt-BR").format(value);
    };

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {getIcon()}
                    {getTitle()}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                stroke="#9ca3af"
                                fontSize={12}
                                width={150}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                                formatter={(value: any, name: string, props: any) => {
                                    const { payload } = props;
                                    return [
                                        <div key="tooltip" className="space-y-1">
                                            <div className="font-semibold text-sm">{payload.fullName}</div>
                                            <div className="text-xs space-y-0.5">
                                                <div>Vendas: {new Intl.NumberFormat("pt-BR").format(payload.sales)}</div>
                                                <div>Visitas: {new Intl.NumberFormat("pt-BR").format(payload.visits)}</div>
                                                <div>
                                                    Receita:{" "}
                                                    {new Intl.NumberFormat("pt-BR", {
                                                        style: "currency",
                                                        currency: "BRL",
                                                    }).format(payload.revenue)}
                                                </div>
                                                {payload.conversionRate !== undefined && (
                                                    <div>Conversão: {payload.conversionRate.toFixed(2)}%</div>
                                                )}
                                            </div>
                                        </div>,
                                    ];
                                }}
                                labelFormatter={() => ""}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Nenhum produto encontrado
                    </div>
                )}

                {/* Lista resumida abaixo do gráfico */}
                {chartData.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {chartData.map((product, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: colors[index] }}
                                    />
                                    <span className="text-sm font-medium truncate max-w-[200px]">
                                        {product.name}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold">{formatValue(product.value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

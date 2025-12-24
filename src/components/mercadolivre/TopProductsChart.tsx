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

    // Cores do gráfico baseadas no Mercado Livre
    const colors = ["#3483FA", "#FFD100", "#00A650", "#FF7733", "#F52F41"];

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

    function TopProductsTooltip({ active, payload }: any) {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0]?.payload;
        if (!d) return null;
        return (
            <div
                className="bg-background/80 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-xl shadow-black/10"
            >
                <div className="text-xs font-black mb-2 uppercase tracking-tighter">{d.fullName}</div>
                <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground flex justify-between gap-4">
                        <span className="font-bold uppercase tracking-widest">Vendas</span>
                        <span className="font-black text-foreground">{new Intl.NumberFormat("pt-BR").format(d.sales)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between gap-4">
                        <span className="font-bold uppercase tracking-widest">Visitas</span>
                        <span className="font-black text-foreground">{new Intl.NumberFormat("pt-BR").format(d.visits)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between gap-4">
                        <span className="font-bold uppercase tracking-widest">Receita</span>
                        <span className="font-black text-[#00A650]">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.revenue)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <span className="text-[#3483FA]">{getIcon()}</span>
                    {getTitle()}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {chartData.length > 0 ? (
                    <div className="space-y-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        hide
                                    />
                                    <Tooltip content={<TopProductsTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.1)' }} />
                                    <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={32}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} fillOpacity={0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="space-y-2">
                            {chartData.map((product, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 hover:bg-muted/20 transition-all border border-transparent hover:border-border/50 group/item"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white"
                                            style={{ backgroundColor: colors[index % colors.length] }}
                                        >
                                            #{index + 1}
                                        </div>
                                        <span className="text-sm font-bold truncate">
                                            {product.name}
                                        </span>
                                    </div>
                                    <span className="text-sm font-black text-[#3483FA] pl-4">{formatValue(product.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                        <ShoppingBag className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest opacity-50">Nenhum produto encontrado</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

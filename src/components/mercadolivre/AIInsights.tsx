import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

interface Insight {
    type: "success" | "warning" | "info" | "opportunity";
    title: string;
    description: string;
    action?: string;
}

interface AIInsightsProps {
    metrics: {
        totalSales: number;
        totalRevenue: number;
        totalVisits: number;
        conversionRate: number;
        totalQuestions: number;
        canceledOrders: number;
        responseRate?: number;
    };
    products?: Array<{
        id: string;
        title: string;
        sales: number;
        visits: number;
        revenue: number;
        conversionRate?: number;
        stock?: number;
    }>;
    loading?: boolean;
}

export function AIInsights({ metrics, products = [], loading }: AIInsightsProps) {
    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Insights Automáticos
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const insights: Insight[] = [];

    // Análise de conversão
    if (metrics.conversionRate < 1) {
        insights.push({
            type: "warning",
            title: "Taxa de conversão baixa",
            description: `Sua taxa de conversão está em ${metrics.conversionRate.toFixed(2)}%. A média do mercado é 2-3%.`,
            action: "Revise preços, fotos e descrições dos produtos",
        });
    } else if (metrics.conversionRate > 3) {
        insights.push({
            type: "success",
            title: "Excelente taxa de conversão!",
            description: `Sua taxa de conversão de ${metrics.conversionRate.toFixed(2)}% está acima da média do mercado.`,
        });
    }

    // Análise de produtos com alta visita e baixa conversão
    const lowConversionProducts = products.filter(
        (p) => p.visits > 50 && (p.conversionRate || 0) < 1
    );
    if (lowConversionProducts.length > 0) {
        const topProduct = lowConversionProducts.sort((a, b) => b.visits - a.visits)[0];
        insights.push({
            type: "opportunity",
            title: "Oportunidade de otimização",
            description: `"${topProduct.title.substring(0, 50)}..." tem ${topProduct.visits} visitas mas baixa conversão (${(topProduct.conversionRate || 0).toFixed(1)}%).`,
            action: "Considere ajustar preço ou melhorar fotos",
        });
    }

    // Análise de taxa de resposta
    if (metrics.responseRate !== undefined && metrics.responseRate < 90) {
        insights.push({
            type: "warning",
            title: "Taxa de resposta pode melhorar",
            description: `Sua taxa de resposta está em ${metrics.responseRate.toFixed(1)}%. O ideal é acima de 90%.`,
            action: "Responda perguntas mais rapidamente para melhorar sua reputação",
        });
    }

    // Análise de cancelamentos
    const cancelRate = metrics.totalSales > 0 ? (metrics.canceledOrders / metrics.totalSales) * 100 : 0;
    if (cancelRate > 5) {
        insights.push({
            type: "warning",
            title: "Taxa de cancelamento elevada",
            description: `${cancelRate.toFixed(1)}% das vendas foram canceladas. Isso pode afetar sua reputação.`,
            action: "Verifique estoque e prazos de entrega",
        });
    }

    // Análise de produtos sem vendas mas com visitas
    const noSalesProducts = products.filter((p) => p.visits > 20 && p.sales === 0);
    if (noSalesProducts.length > 0) {
        insights.push({
            type: "opportunity",
            title: `${noSalesProducts.length} produtos com visitas mas sem vendas`,
            description: "Esses produtos estão atraindo atenção mas não convertendo.",
            action: "Revise preços e compare com concorrentes",
        });
    }

    // Análise de produtos best sellers
    const bestSellers = products.filter((p) => (p.conversionRate || 0) > 5 && p.sales > 5);
    if (bestSellers.length > 0) {
        insights.push({
            type: "success",
            title: `${bestSellers.length} produtos com alta performance`,
            description: "Esses produtos têm excelente taxa de conversão e vendas consistentes.",
            action: "Considere aumentar estoque e investir em anúncios",
        });
    }

    // Análise de engajamento (perguntas)
    const questionRate = metrics.totalVisits > 0 ? (metrics.totalQuestions / metrics.totalVisits) * 100 : 0;
    if (questionRate > 10) {
        insights.push({
            type: "info",
            title: "Alto engajamento dos visitantes",
            description: `${questionRate.toFixed(1)}% dos visitantes fazem perguntas. Isso indica interesse nos produtos.`,
            action: "Mantenha respostas rápidas e detalhadas",
        });
    }

    // Se não houver insights, mostrar mensagem positiva
    if (insights.length === 0) {
        insights.push({
            type: "success",
            title: "Tudo funcionando bem!",
            description: "Suas métricas estão dentro dos padrões esperados. Continue assim!",
        });
    }

    const getIcon = (type: Insight["type"]) => {
        switch (type) {
            case "success":
                return <CheckCircle className="h-5 w-5 text-success" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-warning" />;
            case "opportunity":
                return <TrendingUp className="h-5 w-5 text-info" />;
            default:
                return <Lightbulb className="h-5 w-5 text-primary" />;
        }
    };

    const getBgColor = (type: Insight["type"]) => {
        switch (type) {
            case "success":
                return "bg-success/10 border-success/20";
            case "warning":
                return "bg-warning/10 border-warning/20";
            case "opportunity":
                return "bg-info/10 border-info/20";
            default:
                return "bg-primary/10 border-primary/20";
        }
    };

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Insights Automáticos
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-3">
                    {insights.slice(0, 5).map((insight, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border ${getBgColor(insight.type)} transition-all hover:shadow-md`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">{getIcon(insight.type)}</div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="font-semibold text-sm">{insight.title}</h4>
                                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                                    {insight.action && (
                                        <p className="text-xs font-medium mt-2 flex items-center gap-1">
                                            <span className="text-primary">💡</span>
                                            {insight.action}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

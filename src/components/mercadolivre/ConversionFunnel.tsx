import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ShoppingBag, MessageCircle, ArrowRight } from "lucide-react";

interface ConversionFunnelProps {
    visits: number;
    questions: number;
    sales: number;
    loading?: boolean;
}

export function ConversionFunnel({ visits, questions, sales, loading }: ConversionFunnelProps) {
    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        );
    }

    const visitToQuestionRate = visits > 0 ? (questions / visits) * 100 : 0;
    const questionToSaleRate = questions > 0 ? (sales / questions) * 100 : 0;
    const visitToSaleRate = visits > 0 ? (sales / visits) * 100 : 0;

    const stages = [
        {
            label: "Visitas",
            value: visits,
            icon: Eye,
            color: "bg-blue-500",
            percentage: 100,
        },
        {
            label: "Perguntas",
            value: questions,
            icon: MessageCircle,
            color: "bg-purple-500",
            percentage: visitToQuestionRate,
        },
        {
            label: "Vendas",
            value: sales,
            icon: ShoppingBag,
            color: "bg-green-500",
            percentage: questions > 0 ? questionToSaleRate : visitToSaleRate,
        },
    ];

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6">
                    {stages.map((stage, index) => {
                        const Icon = stage.icon;
                        const width = stage.percentage;

                        return (
                            <div key={stage.label}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${stage.color} bg-opacity-10`}>
                                            <Icon className={`h-4 w-4 ${stage.color.replace('bg-', 'text-')}`} />
                                        </div>
                                        <span className="font-medium text-sm">{stage.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg">
                                            {new Intl.NumberFormat("pt-BR").format(stage.value)}
                                        </div>
                                        {index > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                {(index === 1 ? visitToQuestionRate : visitToSaleRate).toFixed(1)}% do total
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Barra de progresso */}
                                <div className="relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                                    <div
                                        className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-end px-3`}
                                        style={{ width: `${width}%` }}
                                    >
                                        {width > 15 && (
                                            <span className="text-white text-xs font-semibold">
                                                {stage.percentage.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Seta de conversão */}
                                {index < stages.length - 1 && (
                                    <div className="flex items-center justify-center my-3">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-xs">
                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-medium">
                                                {index === 0
                                                    ? `${visitToQuestionRate.toFixed(1)}% fazem perguntas`
                                                    : (questions > 0
                                                        ? `${questionToSaleRate.toFixed(1)}% compram`
                                                        : `${visitToSaleRate.toFixed(1)}% compram (sem perguntas no período)`)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Resumo */}
                <div className="mt-6 pt-6 border-t border-border/50">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Taxa Visita → Pergunta</div>
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {visitToQuestionRate.toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Taxa Pergunta → Venda</div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                {questions > 0 ? `${questionToSaleRate.toFixed(1)}%` : "—"}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Taxa de Conversão Total</div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {visitToSaleRate.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

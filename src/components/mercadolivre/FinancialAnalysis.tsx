import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Percent, Calculator } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FinancialAnalysisProps {
    totalRevenue: number;
    totalSales: number;
    loading?: boolean;
}

export function FinancialAnalysis({ totalRevenue, totalSales, loading }: FinancialAnalysisProps) {
    // Taxas padrão do Mercado Livre (podem ser ajustadas pelo usuário)
    const [mlFeePercent, setMlFeePercent] = useState(16.5); // Taxa ML clássico
    const [shippingCostPercent, setShippingCostPercent] = useState(10); // Estimativa de frete
    const [packagingCostPercent, setPackagingCostPercent] = useState(3); // Embalagem
    const [showCalculator, setShowCalculator] = useState(false);

    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Análise Financeira
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        );
    }

    // Cálculos
    const mlFee = totalRevenue * (mlFeePercent / 100);
    const shippingCost = totalRevenue * (shippingCostPercent / 100);
    const packagingCost = totalRevenue * (packagingCostPercent / 100);
    const totalCosts = mlFee + shippingCost + packagingCost;
    const netRevenue = totalRevenue - totalCosts;
    const netMargin = totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0;

    // Projeção mensal (baseado em 30 dias)
    const dailyRevenue = totalRevenue / 30;
    const monthlyProjection = dailyRevenue * 30;
    const monthlyNetProjection = monthlyProjection - (monthlyProjection * (mlFeePercent + shippingCostPercent + packagingCostPercent) / 100);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Análise Financeira
                    </CardTitle>
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                        <Calculator className="h-3 w-3" />
                        {showCalculator ? "Ocultar" : "Ajustar"} taxas
                    </button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Calculadora de taxas */}
                {showCalculator && (
                    <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                        <h4 className="text-sm font-semibold mb-3">Ajustar Taxas e Custos</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <Label htmlFor="mlFee" className="text-xs">
                                    Taxa Mercado Livre (%)
                                </Label>
                                <Input
                                    id="mlFee"
                                    type="number"
                                    step="0.1"
                                    value={mlFeePercent}
                                    onChange={(e) => setMlFeePercent(Number(e.target.value))}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label htmlFor="shipping" className="text-xs">
                                    Custo de Frete (% da receita)
                                </Label>
                                <Input
                                    id="shipping"
                                    type="number"
                                    step="0.1"
                                    value={shippingCostPercent}
                                    onChange={(e) => setShippingCostPercent(Number(e.target.value))}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label htmlFor="packaging" className="text-xs">
                                    Custo de Embalagem (% da receita)
                                </Label>
                                <Input
                                    id="packaging"
                                    type="number"
                                    step="0.1"
                                    value={packagingCostPercent}
                                    onChange={(e) => setPackagingCostPercent(Number(e.target.value))}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Métricas principais */}
                <div className="space-y-4">
                    {/* Receita Bruta */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <div>
                            <div className="text-xs text-muted-foreground">Receita Bruta</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(totalRevenue)}
                            </div>
                        </div>
                        <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400 opacity-50" />
                    </div>

                    {/* Custos */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">Custos Estimados</h4>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                                <span className="text-muted-foreground">Taxa ML ({mlFeePercent}%)</span>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    -{formatCurrency(mlFee)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                                <span className="text-muted-foreground">Frete ({shippingCostPercent}%)</span>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    -{formatCurrency(shippingCost)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                                <span className="text-muted-foreground">Embalagem ({packagingCostPercent}%)</span>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    -{formatCurrency(packagingCost)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/50 font-semibold border-t border-border/50 mt-2 pt-2">
                                <span>Total de Custos</span>
                                <span className="text-red-600 dark:text-red-400">
                                    -{formatCurrency(totalCosts)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Receita Líquida */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-800">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Receita Líquida Estimada</div>
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(netRevenue)}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <Percent className="h-3 w-3 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                    Margem: {netMargin.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <TrendingUp className="h-10 w-10 text-green-600 dark:text-green-400 opacity-50" />
                    </div>

                    {/* Projeção Mensal */}
                    <div className="pt-4 border-t border-border/50">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                            Projeção Mensal (30 dias)
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted/30 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Receita Bruta</div>
                                <div className="text-lg font-bold">{formatCurrency(monthlyProjection)}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Receita Líquida</div>
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(monthlyNetProjection)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Métricas adicionais */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
                        <div className="text-center p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Ticket Médio Líquido</div>
                            <div className="text-lg font-bold">
                                {totalSales > 0 ? formatCurrency(netRevenue / totalSales) : "-"}
                            </div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Custo por Venda</div>
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                {totalSales > 0 ? formatCurrency(totalCosts / totalSales) : "-"}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

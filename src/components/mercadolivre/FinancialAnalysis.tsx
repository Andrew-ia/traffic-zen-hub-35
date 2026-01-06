import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Calculator } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FinancialAnalysisProps {
    totalRevenue: number;
    totalSales: number;
    loading?: boolean;
    realTotalFees?: number;
}

export function FinancialAnalysis({ 
    totalRevenue, 
    totalSales, 
    loading,
    realTotalFees
}: FinancialAnalysisProps) {
    // Taxas padrão do Mercado Livre (podem ser ajustadas pelo usuário)
    const [mlFeePercent, setMlFeePercent] = useState(19); // Taxa ML clássico
    const [fixedCostPerSale, setFixedCostPerSale] = useState(6.5); // Taxa fixa por unidade
    const [productCostPercent, setProductCostPercent] = useState(20); // Custo dos produtos
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
    const hasRealData = realTotalFees !== undefined;
    const salesCount = totalSales || 0;
    const mlFeePercentValue = totalRevenue * (mlFeePercent / 100);
    const mlFeeFixedValue = fixedCostPerSale * salesCount;
    const mlFeeTotal = mlFeePercentValue + mlFeeFixedValue;
    const productCost = totalRevenue * (productCostPercent / 100);
    
    // Total costs including product and packaging
    const totalCosts = mlFeeTotal + productCost;
    
    // Net Revenue (Profit)
    const netRevenue = totalRevenue - totalCosts;
    const netMargin = totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0;
    
    // Receita Líquida ML (Payout) - O que sobra na mão do vendedor antes de pagar produto/embalagem
    const payoutML = totalRevenue - mlFeeTotal;

    // Projeção mensal (baseado em 30 dias)
    const dailyRevenue = totalRevenue / 30;
    const monthlyProjection = dailyRevenue * 30;
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const monthlySalesProjection = averageTicket > 0 ? monthlyProjection / averageTicket : 0;
    // Projeção de lucro precisa considerar a margem atual
    const currentMarginPercent = totalRevenue > 0 ? netRevenue / totalRevenue : 0;
    const monthlyNetProjection = monthlyProjection * currentMarginPercent;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="pb-3 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Análise Financeira
                        {hasRealData && (
                            <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full border border-info/20 uppercase tracking-wider">
                                Dados Reais API
                            </span>
                        )}
                    </CardTitle>
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                        <Calculator className="h-3 w-3" />
                        {showCalculator ? "Ocultar" : "Ajustar"}
                    </button>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-5">
                {/* Calculadora de taxas */}
                {showCalculator && (
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/20 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Parâmetros de Custo</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="mlFee" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Taxa Mercado Livre (%)
                                </Label>
                                <Input
                                    id="mlFee"
                                    type="number"
                                    step="0.1"
                                    value={mlFeePercent}
                                    onChange={(e) => setMlFeePercent(Number(e.target.value))}
                                    className="h-9 bg-background/50 border-border/40 rounded-xl text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fixedCost" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Taxa fixa por unidade (R$)
                                </Label>
                                <Input
                                    id="fixedCost"
                                    type="number"
                                    step="0.01"
                                    value={fixedCostPerSale}
                                    onChange={(e) => setFixedCostPerSale(Number(e.target.value))}
                                    className="h-9 bg-background/50 border-border/40 rounded-xl text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="productCost" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Custo Produto (% da receita)
                                </Label>
                                <Input
                                    id="productCost"
                                    type="number"
                                    step="0.1"
                                    value={productCostPercent}
                                    onChange={(e) => setProductCostPercent(Number(e.target.value))}
                                    className="h-9 bg-background/50 border-border/40 rounded-xl text-sm font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Métricas principais */}
                <div className="space-y-5">
                    {/* Receita Bruta */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20">
                        <div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Faturamento Bruto</div>
                            <div className="text-2xl font-black text-primary">
                                {formatCurrency(totalRevenue)}
                            </div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                    </div>

                    {/* Deduções */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {hasRealData ? "Deduções Reais & Custos" : "Deduções Estimadas"}
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                <span className="font-medium">Taxas ML ({mlFeePercent.toFixed(1)}%)</span>
                                <span className="font-bold text-destructive">
                                    -{formatCurrency(mlFeePercentValue)}
                                </span>
                            </div>
                            {mlFeeFixedValue > 0 && (
                                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                    <span className="font-medium">Taxa fixa ML (R$ {fixedCostPerSale.toFixed(2)} x {salesCount})</span>
                                    <span className="font-bold text-destructive">
                                        -{formatCurrency(mlFeeFixedValue)}
                                    </span>
                                </div>
                            )}
                            {/* Repasse ML (Payout) */}
                            <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-success/10 border border-success/20">
                                <span className="font-bold text-success uppercase tracking-wider text-[10px]">Repasse Mercado Livre</span>
                                <span className="font-black text-success">
                                    {formatCurrency(payoutML)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                <span className="font-medium">Custo de Mercadoria (Est.)</span>
                                <span className="font-bold text-destructive">
                                    -{formatCurrency(productCost)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Receita Líquida */}
                    <div className="relative p-5 rounded-3xl bg-success/10 border border-success/20 overflow-hidden shadow-sm">
                        <div className="relative z-10">
                            <div className="text-[10px] font-bold text-success uppercase tracking-widest mb-2">Lucro Líquido Final</div>
                            <div className="text-3xl font-black text-success">
                                {formatCurrency(netRevenue)}
                            </div>
                            <div className="flex items-center gap-2 mt-3 text-success">
                                <div className="px-2 py-0.5 rounded-full bg-success/10 text-[10px] font-black uppercase tracking-tighter">
                                    Margem: {netMargin.toFixed(1)}%
                                </div>
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                    </div>

                    {/* Projeção Mensal */}
                    <div className="p-4 rounded-2xl bg-muted/5 border border-border/10">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Projeção Próximos 30 Dias</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Faturamento</div>
                                <div className="text-sm font-black">{formatCurrency(monthlyProjection)}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[9px] font-bold text-success/80 uppercase mb-1">Lucro Projetado</div>
                                <div className="text-sm font-black text-success">{formatCurrency(monthlyNetProjection)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

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
    realTotalNetReceivedAmount?: number;
    realTotalAdsSpend?: number;
}

export function FinancialAnalysis({ 
    totalRevenue, 
    totalSales,
    loading,
    realTotalNetReceivedAmount,
    realTotalAdsSpend
}: FinancialAnalysisProps) {
    const [productCostPercent, setProductCostPercent] = useState(30); // Custo dos produtos
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
    const hasRealNetReceivedAmount = typeof realTotalNetReceivedAmount === "number";
    const hasRealAdsSpend = typeof realTotalAdsSpend === "number";
    const hasRealData = hasRealNetReceivedAmount || hasRealAdsSpend;
    const salesCount = totalSales || 0;
    const packagingCostPerUnit = 1;
    const companyTaxRate = 10;

    const totalReceivedAmount = hasRealNetReceivedAmount
        ? (realTotalNetReceivedAmount ?? 0)
        : totalRevenue;
    const adsSpend = hasRealAdsSpend ? (realTotalAdsSpend ?? 0) : 0;
    const productCost = totalReceivedAmount * (productCostPercent / 100);
    const packagingCost = salesCount * packagingCostPerUnit;
    const companyTaxes = totalReceivedAmount * (companyTaxRate / 100);

    // Lucro estimado baseado no recebido líquido do ML
    const netRevenue = totalReceivedAmount - productCost - adsSpend - packagingCost - companyTaxes;
    const netMargin = totalReceivedAmount > 0 ? (netRevenue / totalReceivedAmount) * 100 : 0;

    // Projeção mensal (baseado em 30 dias)
    const dailyRevenue = totalRevenue / 30;
    const dailyReceivedAmount = totalReceivedAmount / 30;
    const monthlyProjection = dailyRevenue * 30;
    const monthlyReceivedProjection = dailyReceivedAmount * 30;
    const adsSpendRate = totalReceivedAmount > 0 ? adsSpend / totalReceivedAmount : 0;
    const averageUnitsPerDay = salesCount / 30;
    const monthlyPackagingProjection = averageUnitsPerDay * 30 * packagingCostPerUnit;
    const monthlyNetProjection = monthlyReceivedProjection
        - (monthlyReceivedProjection * (productCostPercent / 100))
        - (monthlyReceivedProjection * adsSpendRate)
        - (monthlyReceivedProjection * (companyTaxRate / 100))
        - monthlyPackagingProjection;

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
                                <Label htmlFor="productCost" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Custo Produto (% dos recebidos)
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
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            O lucro usa recebidos liquidos do ML como base.
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
                            {hasRealData ? "Base do Lucro" : "Base Estimada"}
                        </h4>
                        <div className="space-y-2">
                            {/* Somatória dos recebidos do ML */}
                            <div className="space-y-2 p-3 rounded-xl bg-success/10 border border-success/20">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-success uppercase tracking-wider text-[10px]">
                                    {hasRealNetReceivedAmount ? "Somatória dos Recebidos" : "Somatória dos Recebidos (Est.)"}
                                    </span>
                                    <span className="font-black text-success">
                                        {formatCurrency(totalReceivedAmount)}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium leading-relaxed text-success/80">
                                    Valor liquido real recebido do Mercado Livre no periodo. Taxas e frete ja ficam refletidos nessa base.
                                </p>
                            </div>

                            {hasRealAdsSpend && (
                                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                    <span className="font-medium">Gasto com Ads (API)</span>
                                    <span className="font-bold text-destructive">
                                        -{formatCurrency(adsSpend)}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                <span className="font-medium">Custo de Mercadoria (Est. sobre recebidos)</span>
                                <span className="font-bold text-destructive">
                                    -{formatCurrency(productCost)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                <span className="font-medium">Embalagem (R$ 1,00 por unidade)</span>
                                <span className="font-bold text-destructive">
                                    -{formatCurrency(packagingCost)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/10">
                                <span className="font-medium">Impostos da Empresa (10% dos recebidos)</span>
                                <span className="font-bold text-destructive">
                                    -{formatCurrency(companyTaxes)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Receita Líquida */}
                    <div className="relative p-5 rounded-3xl bg-success/10 border border-success/20 overflow-hidden shadow-sm">
                        <div className="relative z-10">
                            <div className="text-[10px] font-bold text-success uppercase tracking-widest mb-2">Lucro Estimado Final</div>
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
                                <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Recebido</div>
                                <div className="text-sm font-black">{formatCurrency(monthlyReceivedProjection)}</div>
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

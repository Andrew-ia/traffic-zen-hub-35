import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Calculator } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FinancialAnalysisProps {
    totalRevenue: number;
    totalSales: number;
    periodDays?: number;
    loading?: boolean;
    realTotalNetReceivedAmount?: number;
    realTotalAdsSpend?: number;
    realTotalAdsSpendLabel?: string;
    realTotalAdsSpendExact?: boolean;
}

export function FinancialAnalysis({ 
    totalRevenue, 
    totalSales,
    periodDays = 30,
    loading,
    realTotalNetReceivedAmount,
    realTotalAdsSpend,
    realTotalAdsSpendLabel,
    realTotalAdsSpendExact
}: FinancialAnalysisProps) {
    const [productCostPercent, setProductCostPercent] = useState(30); // Custo dos produtos
    const [showCalculator, setShowCalculator] = useState(false);

    if (loading) {
        return (
            <Card className="h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                <CardHeader className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))]">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Análise Financeira
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-6">
                    <Skeleton className="h-full min-h-[420px] w-full" />
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
    const normalizedPeriodDays = Math.max(1, periodDays);

    const totalReceivedAmount = hasRealNetReceivedAmount
        ? (realTotalNetReceivedAmount ?? 0)
        : totalRevenue;
    const adsSpend = hasRealAdsSpend ? (realTotalAdsSpend ?? 0) : 0;
    const adsSpendLabel = realTotalAdsSpendLabel || "Gasto com Ads (API)";
    const productCost = totalReceivedAmount * (productCostPercent / 100);
    const packagingCost = salesCount * packagingCostPerUnit;
    const companyTaxes = totalReceivedAmount * (companyTaxRate / 100);

    // Lucro estimado baseado no recebido líquido do ML
    const netRevenue = totalReceivedAmount - productCost - adsSpend - packagingCost - companyTaxes;
    const netMargin = totalReceivedAmount > 0 ? (netRevenue / totalReceivedAmount) * 100 : 0;

    // Projeção mensal normalizada pela média do período selecionado
    const dailyReceivedAmount = totalReceivedAmount / normalizedPeriodDays;
    const monthlyReceivedProjection = dailyReceivedAmount * 30;
    const adsSpendRate = totalReceivedAmount > 0 ? adsSpend / totalReceivedAmount : 0;
    const averageUnitsPerDay = salesCount / normalizedPeriodDays;
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
        <Card className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.90),rgba(16,185,129,0.65),rgba(255,255,255,0))]" />
            <CardHeader className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                        Análise Financeira
                        {hasRealData && (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-700">
                                Dados Reais API
                            </span>
                        )}
                    </CardTitle>
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-700"
                    >
                        <Calculator className="h-3 w-3" />
                        {showCalculator ? "Ocultar" : "Ajustar"}
                    </button>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-4">
                {/* Calculadora de taxas */}
                {showCalculator && (
                    <div className="animate-in slide-in-from-top-2 space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 duration-300">
                        <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Parâmetros de Custo</h4>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="productCost" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Custo Produto (% dos recebidos)
                                </Label>
                                <Input
                                    id="productCost"
                                    type="number"
                                    step="0.1"
                                    value={productCostPercent}
                                    onChange={(e) => setProductCostPercent(Number(e.target.value))}
                                    className="h-9 rounded-xl border-slate-200/80 bg-white text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            O lucro usa recebidos liquidos do ML como base.
                        </div>
                    </div>
                )}

                {/* Métricas principais */}
                <div className="flex flex-1 flex-col gap-4">
                    {/* Receita Bruta */}
                    <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,252,0.96))] p-4">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_35%,rgba(15,23,42,0.02)_100%)]" />
                        <div className="relative z-10 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Faturamento Bruto</div>
                                <div className="text-2xl font-black text-slate-950">
                                    {formatCurrency(totalRevenue)}
                                </div>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                                <DollarSign className="h-5 w-5 text-blue-700" />
                            </div>
                        </div>
                    </div>

                    {/* Deduções */}
                    <div className="flex flex-1 flex-col">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {hasRealData ? "Base do Lucro" : "Base Estimada"}
                        </h4>
                        <div className="mt-3 flex flex-1 flex-col gap-3">
                            {/* Somatória dos recebidos do ML */}
                            <div className="space-y-2 rounded-xl border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.94))] p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                    {hasRealNetReceivedAmount ? "Somatória dos Recebidos" : "Somatória dos Recebidos (Est.)"}
                                    </span>
                                    <span className="font-black text-emerald-700">
                                        {formatCurrency(totalReceivedAmount)}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium leading-relaxed text-emerald-700/80">
                                    Valor liquido real recebido do Mercado Livre no periodo. Taxas e frete ja ficam refletidos nessa base.
                                </p>
                            </div>

                            <div className="grid flex-1 auto-rows-fr gap-3">
                                {hasRealAdsSpend && (
                                    <div className="flex min-h-[64px] items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
                                        <div className="space-y-1">
                                            <span className="font-medium block">{adsSpendLabel}</span>
                                            {realTotalAdsSpendExact === false && (
                                                <span className="block text-[10px] uppercase tracking-widest text-slate-500">
                                                    valor estimado por ciclo
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-bold text-rose-700">-{formatCurrency(adsSpend)}</span>
                                    </div>
                                )}

                                <div className="flex min-h-[56px] items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
                                    <div className="space-y-1">
                                        <span className="font-medium block">Custo de Mercadoria (Est. sobre recebidos)</span>
                                    </div>
                                    <span className="font-bold text-rose-700">
                                        -{formatCurrency(productCost)}
                                    </span>
                                </div>

                                <div className="flex min-h-[56px] items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
                                    <span className="font-medium">Embalagem (R$ 1,00 por unidade)</span>
                                    <span className="font-bold text-rose-700">
                                        -{formatCurrency(packagingCost)}
                                    </span>
                                </div>

                                <div className="flex min-h-[56px] items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
                                    <span className="font-medium">Impostos da Empresa (10% dos recebidos)</span>
                                    <span className="font-bold text-rose-700">
                                        -{formatCurrency(companyTaxes)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {/* Receita Líquida */}
                        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(135deg,rgba(236,253,245,0.98),rgba(220,252,231,0.80))] p-5 shadow-sm">
                            <div className="relative z-10">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Lucro Estimado Final</div>
                                <div className="text-3xl font-black text-emerald-700">
                                    {formatCurrency(netRevenue)}
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-emerald-700">
                                    <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter">
                                        Margem: {netMargin.toFixed(1)}%
                                    </div>
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        {/* Projeção Mensal */}
                        <div className="rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] p-4">
                            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Projeção Próximos 30 Dias</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center">
                                    <div className="mb-1 text-[9px] font-bold uppercase text-slate-500">Recebido</div>
                                    <div className="text-sm font-black">{formatCurrency(monthlyReceivedProjection)}</div>
                                </div>
                                <div className="text-center">
                                    <div className="mb-1 text-[9px] font-bold uppercase text-emerald-700/80">Lucro Projetado</div>
                                    <div className="text-sm font-black text-emerald-700">{formatCurrency(monthlyNetProjection)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

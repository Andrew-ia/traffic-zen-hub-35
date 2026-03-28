import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRunMercadoLivrePriceStockAutomation } from "@/hooks/useMercadoLivre";
import type { MercadoLivrePriceStockAutomationResult } from "@/hooks/useMercadoLivre";

const formatCurrency = (value: number, fractionDigits: number = 0) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

const getPriceReasonLabel = (reason: string | null) => {
    switch (reason) {
        case "low_stock_protection":
            return "Proteção de margem (estoque baixo)";
        case "unit_loss_recovery":
            return "Recuperar prejuízo unitário";
        case "target_margin_recovery":
            return "Recuperar margem-alvo";
        case "high_stock_acceleration":
            return "Acelerar giro (estoque alto)";
        default:
            return "Sem ajuste";
    }
};

interface AutoPriceStockPlanCardProps {
    workspaceId: string | null;
    periodDays?: number;
}

export function AutoPriceStockPlanCard({
    workspaceId,
    periodDays = 30,
}: AutoPriceStockPlanCardProps) {
    const [automationPreview, setAutomationPreview] = useState<MercadoLivrePriceStockAutomationResult | null>(null);
    const priceStockAutomationMutation = useRunMercadoLivrePriceStockAutomation();

    const range = useMemo(() => {
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        const from = subDays(new Date(to), Math.max(1, periodDays) - 1);

        return {
            dateFrom: format(from, "yyyy-MM-dd"),
            dateTo: format(to, "yyyy-MM-dd"),
        };
    }, [periodDays]);

    useEffect(() => {
        setAutomationPreview(null);
    }, [workspaceId, range.dateFrom, range.dateTo]);

    const handleRunPreview = async () => {
        if (!workspaceId) return;
        try {
            const result = await priceStockAutomationMutation.mutateAsync({
                workspaceId,
                mode: "dry-run",
                source: "topSales",
                days: periodDays,
                dateFrom: range.dateFrom,
                dateTo: range.dateTo,
                topN: 20,
                lowStockThreshold: 3,
                highStockThreshold: 20,
                sendTelegramStockAlerts: false,
                sendTelegramPriceSuggestions: false,
            });
            setAutomationPreview(result);

            const summary = result?.summary;
            toast.success(
                `Automação pronta: ${summary?.priceSuggestions || 0} sugestões de preço e ${summary?.stockAlerts || 0} alertas de estoque.`
            );
        } catch (error: any) {
            toast.error(error?.message || "Erro ao rodar automação de preço/estoque.");
        }
    };

    const handleApplySuggestions = async () => {
        if (!workspaceId) return;
        try {
            const result = await priceStockAutomationMutation.mutateAsync({
                workspaceId,
                mode: "apply",
                source: "topSales",
                days: periodDays,
                dateFrom: range.dateFrom,
                dateTo: range.dateTo,
                topN: 20,
                lowStockThreshold: 3,
                highStockThreshold: 20,
                sendTelegramStockAlerts: false,
                sendTelegramPriceSuggestions: false,
            });
            setAutomationPreview(result);

            const summary = result?.summary;
            toast.success(
                `Aplicado: ${summary?.priceUpdatesApplied || 0} preços atualizados, ${summary?.priceUpdatesFailed || 0} falhas.`
            );
        } catch (error: any) {
            toast.error(error?.message || "Erro ao aplicar automação de preço/estoque.");
        }
    };

    const automationPeriodLabel = `${automationPreview?.params?.days ?? periodDays}d`;
    const automationGeneratedAt = automationPreview?.summary?.generatedAt
        ? new Date(automationPreview.summary.generatedAt).toLocaleString("pt-BR")
        : null;
    const automationItems = automationPreview?.items || [];

    return (
        <Card className="overflow-hidden rounded-3xl border border-border/40 bg-card/60 shadow-lg backdrop-blur-md">
            <CardHeader className="border-b border-border/10 bg-muted/5 pb-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Plano de Ações: Auto Preço + Estoque
                        </CardTitle>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                            Últimos {periodDays} dias
                        </Badge>
                        <div className="text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                            {automationGeneratedAt ? `Última execução ${automationGeneratedAt}` : "Sem execução"}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleRunPreview}
                        disabled={!workspaceId || priceStockAutomationMutation.isPending}
                        className="rounded-2xl"
                    >
                        {priceStockAutomationMutation.isPending ? "Gerando..." : "Gerar prévia"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleApplySuggestions}
                        disabled={
                            !workspaceId ||
                            priceStockAutomationMutation.isPending ||
                            !automationPreview ||
                            (automationPreview.summary?.priceSuggestions || 0) <= 0
                        }
                        className="rounded-2xl"
                    >
                        {priceStockAutomationMutation.isPending ? "Aplicando..." : "Aplicar sugestões"}
                    </Button>
                </div>

                {!automationPreview ? (
                    <div className="text-sm text-muted-foreground">
                        Clique em <span className="font-semibold">Gerar prévia</span> para analisar os anúncios dos últimos {periodDays} dias e montar o plano de ações.
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
                                Modo {automationPreview.mode}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                Período {automationPeriodLabel}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                Avaliados {automationPreview.summary.evaluatedCount}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                Sugestões {automationPreview.summary.priceSuggestions}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                Alertas estoque {automationPreview.summary.stockAlerts}
                            </Badge>
                            {automationPreview.mode === "apply" && (
                                <>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-success">
                                        Aplicados {automationPreview.summary.priceUpdatesApplied}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-destructive">
                                        Falhas {automationPreview.summary.priceUpdatesFailed}
                                    </Badge>
                                </>
                            )}
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-border/40">
                            <table className="w-full min-w-[980px] text-xs">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">SKU</th>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">Produto</th>
                                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest">Estoque</th>
                                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest">Preço Atual</th>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">Ação Sugerida</th>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">Motivo</th>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">Alerta</th>
                                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {automationItems.slice(0, 40).map((item) => {
                                        const hasSuggestion = item.suggestedPrice !== null;
                                        const deltaPct = Number(item.priceDelta?.pct || 0);
                                        const deltaLabel = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%`;
                                        const actionLabel = hasSuggestion
                                            ? `${item.priceAction === "increase" ? "Aumentar" : "Reduzir"} para ${formatCurrency(item.suggestedPrice as number, 2)} (${deltaLabel})`
                                            : "Manter preço";
                                        const resultLabel = automationPreview.mode === "apply"
                                            ? (item.updateApplied ? "Aplicado" : (item.updateError ? "Falhou" : "Sem alteração"))
                                            : "Prévia";

                                        return (
                                            <tr key={item.mlItemId} className="border-t border-border/30 hover:bg-slate-50/70">
                                                <td className="px-3 py-2 font-semibold">{item.mlItemId}</td>
                                                <td className="max-w-[280px] px-3 py-2">
                                                    <div className="truncate font-medium">{item.title || "-"}</div>
                                                    <div className="text-[10px] uppercase text-muted-foreground">{item.sales30d} vendas/{automationPeriodLabel}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">{item.stock}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(item.currentPrice, 2)}</td>
                                                <td className="px-3 py-2">
                                                    <span className={hasSuggestion ? "font-semibold text-primary" : "text-muted-foreground"}>
                                                        {actionLabel}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">{getPriceReasonLabel(item.priceReason)}</td>
                                                <td className="px-3 py-2">
                                                    {item.stockAlert ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] uppercase tracking-widest ${
                                                                item.stockAlert.level === "critical" ? "text-destructive" : "text-warning"
                                                            }`}
                                                        >
                                                            {item.stockAlert.level === "critical" ? "Ruptura" : "Baixo"}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={
                                                            resultLabel === "Aplicado"
                                                                ? "font-semibold text-success"
                                                                : resultLabel === "Falhou"
                                                                    ? "font-semibold text-destructive"
                                                                    : "text-muted-foreground"
                                                        }
                                                    >
                                                        {resultLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {automationItems.length > 40 && (
                            <p className="text-xs text-muted-foreground">
                                Mostrando 40 de {automationItems.length} ações.
                            </p>
                        )}
                    </>
                )}

                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Base: {format(new Date(`${range.dateFrom}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(`${range.dateTo}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                </p>
            </CardContent>
        </Card>
    );
}

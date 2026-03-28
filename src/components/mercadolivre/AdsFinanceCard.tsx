import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Receipt, Radar, Scale } from "lucide-react";
import type { MercadoLivreAdsFinanceSummary } from "@/hooks/useMercadoLivre";

interface AdsFinanceCardProps {
    summary?: MercadoLivreAdsFinanceSummary | null;
    loading?: boolean;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value || 0);

export function AdsFinanceCard({ summary, loading }: AdsFinanceCardProps) {
    if (loading) {
        return (
            <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Ads Operacional x Faturado
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-40 w-full rounded-2xl" />
                </CardContent>
            </Card>
        );
    }

    if (!summary) {
        return (
            <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Ads Operacional x Faturado
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="rounded-2xl border border-border/20 bg-muted/10 p-4 text-sm text-muted-foreground">
                        Nenhum dado de Ads disponivel para o periodo.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Ads Operacional x Faturado
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                        {summary.billedMode === "exact"
                            ? "Billing exato"
                            : summary.billedMode === "estimated"
                                ? "Billing estimado"
                                : "Billing indisponivel"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                            Ads Operacional
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-2xl font-black text-primary">
                                -{formatCurrency(summary.operationalTotal)}
                            </div>
                            <Radar className="h-5 w-5 text-primary" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                            {summary.billedMode === "estimated" ? "Ads Faturado Est." : "Ads Faturado"}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-2xl font-black text-destructive">
                                -{formatCurrency(summary.billedTotal)}
                            </div>
                            <Receipt className="h-5 w-5 text-destructive" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                            Usado no Lucro
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-2xl font-black text-success">
                                    -{formatCurrency(summary.usedInEstimate.amount)}
                                </div>
                                <div className="text-[10px] uppercase tracking-widest text-success/80 mt-1">
                                    {summary.usedInEstimate.label}
                                </div>
                            </div>
                            <Scale className="h-5 w-5 text-success" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border/20 bg-muted/10 overflow-hidden">
                    <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 border-b border-border/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span>Canal</span>
                        <span className="text-right">Operacional</span>
                        <span className="text-right">Faturado</span>
                    </div>
                    <div className="divide-y divide-border/10">
                        {summary.channels.map((channel) => (
                            <div
                                key={channel.key}
                                className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 px-4 py-3 text-sm"
                            >
                                <div className="min-w-0">
                                    <div className="font-semibold">{channel.label}</div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        {channel.operationalAvailable ? "API" : "Sem API"}
                                        {channel.billedAvailable
                                            ? channel.billedExact
                                                ? " • Billing exato"
                                                : " • Billing estimado"
                                            : " • Sem billing"}
                                    </div>
                                </div>
                                <div className="text-right font-semibold text-primary">
                                    {channel.operationalAvailable ? `-${formatCurrency(channel.operationalAmount)}` : "—"}
                                </div>
                                <div className="text-right font-semibold text-destructive">
                                    {channel.billedAvailable ? `-${formatCurrency(channel.billedAmount)}` : "—"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {(summary.notes.length > 0 || summary.periods.length > 0) && (
                    <div className="space-y-3">
                        {summary.periods.length > 0 && (
                            <div className="rounded-2xl border border-border/20 bg-background/40 p-3">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Ciclos de faturamento usados
                                </div>
                                <div className="space-y-2">
                                    {summary.periods.map((period) => (
                                        <div key={period.key} className="flex items-center justify-between gap-3 text-xs">
                                            <div>
                                                <div className="font-semibold">
                                                    {period.dateFrom} a {period.coveredDateTo}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                                    chave {period.key} • {period.periodStatus || "sem status"}
                                                    {period.coveredDateTo !== period.dateTo ? ` • ciclo ML ate ${period.dateTo}` : ""}
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                                {period.exact
                                                    ? "Periodo completo"
                                                    : `${period.overlapDays}/${period.totalDays} dias`}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {summary.notes.length > 0 && (
                            <div className="rounded-2xl border border-border/20 bg-muted/10 p-3 space-y-2">
                                {summary.notes.map((note, index) => (
                                    <p key={index} className="text-xs text-muted-foreground leading-relaxed">
                                        {note}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {summary.lastOperationalSyncAt ? (
                        <span>API: {new Date(summary.lastOperationalSyncAt).toLocaleString("pt-BR")}</span>
                    ) : null}
                    {summary.lastBillingSyncAt ? (
                        <span>Billing: {new Date(summary.lastBillingSyncAt).toLocaleString("pt-BR")}</span>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

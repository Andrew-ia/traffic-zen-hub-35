import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
    useMercadoLivreProducts,
    useMercadoLivreQuestions,
} from "@/hooks/useMercadoLivre";
import { useMercadoLivreOrders } from "@/hooks/useMercadoLivreOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SalesBoostBoard } from "@/components/mercadolivre/SalesBoostBoard";
import { AutoPriceStockPlanCard } from "@/components/mercadolivre/AutoPriceStockPlanCard";
import { ExportReportButton } from "@/components/mercadolivre/ExportReportButton";
import { AlertCircle } from "lucide-react";

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value || 0);

export default function MercadoLivreOperations() {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;

    const ordersParams = useMemo(() => {
        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        return {
            limit: 50,
            includeCancelled: true,
            activity: "confirmed" as const,
            dateFrom: start.toISOString(),
            dateTo: end.toISOString(),
        };
    }, []);

    const { data: ordersData, isLoading: ordersLoading } = useMercadoLivreOrders(workspaceId, ordersParams);
    const { data: questions, isLoading: questionsLoading } = useMercadoLivreQuestions(workspaceId, 7);
    const { data: products, isLoading: productsLoading } = useMercadoLivreProducts(workspaceId);
    const exportRange = useMemo(() => {
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        const from = subDays(new Date(to), 29);

        return {
            days: "30",
            dateFrom: format(from, "yyyy-MM-dd"),
            dateTo: format(to, "yyyy-MM-dd"),
        };
    }, []);

    const unansweredCount = Number(questions?.unanswered || 0);
    const ordersTodayCount = ordersData?.orders?.length || 0;
    const lowStockSummary = useMemo(() => {
        const items = (products?.items || []) as any[];
        let lowStock = 0;
        let outOfStock = 0;

        items.forEach((item) => {
            const rawStock = Number(item?.stock);
            if (!Number.isFinite(rawStock)) return;
            if (rawStock <= 0) {
                outOfStock += 1;
            } else if (rawStock <= 5) {
                lowStock += 1;
            }
        });

        return {
            lowStock,
            outOfStock,
            total: lowStock + outOfStock,
        };
    }, [products?.items]);

    if (!workspaceId) {
        return (
            <div className="p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Central de Operações</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Selecione um workspace para visualizar as ações do dia.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Central de Operações</h1>
                    <p className="text-sm text-muted-foreground">
                        Pendências e ações rápidas para o dia a dia do analista/vendedor.
                    </p>
                </div>
            </div>

            <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            Ações do Dia
                        </CardTitle>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] uppercase tracking-widest">
                            Operação
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-border/30 bg-background/60 p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Perguntas pendentes</p>
                                <p className="text-2xl font-black">
                                    {questionsLoading ? "—" : formatNumber(unansweredCount)}
                                </p>
                                <p className="text-xs text-muted-foreground">Responda para ganhar conversão</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/30 bg-background/60 p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Pedidos do dia</p>
                                <p className="text-2xl font-black">
                                    {ordersLoading ? "—" : formatNumber(ordersTodayCount)}
                                </p>
                                <p className="text-xs text-muted-foreground">Acompanhe o que entrou hoje</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/30 bg-background/60 p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Estoque crítico</p>
                                <p className="text-2xl font-black">
                                    {productsLoading ? "—" : formatNumber(lowStockSummary.total)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {productsLoading ? "Carregando estoque" : `${lowStockSummary.outOfStock} zerados`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-background/60 p-4">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                            Ferramentas rápidas
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => navigate("/mercado-livre-analyzer")}>
                                Analisador MLB
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => navigate("/mercado-livre-price-calculator")}>
                                Calc. de Preço ML
                            </Button>
                            <ExportReportButton
                                workspaceId={workspaceId}
                                dateRangeDays={exportRange.days}
                                dateFrom={exportRange.dateFrom}
                                dateTo={exportRange.dateTo}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <div>
                    <SalesBoostBoard workspaceId={workspaceId} limit={12} showFilters itemsPerPage={3} />
                </div>

                <AutoPriceStockPlanCard workspaceId={workspaceId} periodDays={30} />
            </div>
        </div>
    );
}

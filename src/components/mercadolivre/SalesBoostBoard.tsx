import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
    useMercadoLivreGrowthReport,
    useSyncMercadoLivre,
    useUpdateMercadoLivrePrice,
    type MercadoLivreSkuPlan,
} from "@/hooks/useMercadoLivre";
import {
    Copy,
    ExternalLink,
    Flame,
    RotateCw,
    Sparkles,
    Tag,
    TrendingUp,
} from "lucide-react";

interface SalesBoostBoardProps {
    workspaceId: string | null;
    limit?: number;
    showFilters?: boolean;
}

const PRIORITY_META: Record<string, { label: string; className: string }> = {
    A: { label: "Prioridade A", className: "bg-emerald-500/10 text-emerald-600" },
    B: { label: "Prioridade B", className: "bg-amber-500/10 text-amber-600" },
    C: { label: "Prioridade C", className: "bg-blue-500/10 text-blue-600" },
    D: { label: "Monitorar", className: "bg-muted/40 text-muted-foreground" },
};

const formatCurrency = (value: number, fractionDigits: number = 2) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value || 0);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value || 0);

const formatPct = (value: number | null, digits = 2) => {
    if (value === null || Number.isNaN(value)) return "—";
    return `${(value * 100).toFixed(digits)}%`;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const diffInDays = (from: Date, to: Date) => {
    const startFrom = startOfDay(from).getTime();
    const startTo = startOfDay(to).getTime();
    return Math.floor((startTo - startFrom) / DAY_MS);
};
const formatShortDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR");
};

const COOLDOWN_OPTIONS = [
    { label: "3 dias", value: 3 },
    { label: "7 dias", value: 7 },
    { label: "14 dias", value: 14 },
];

export function SalesBoostBoard({ workspaceId, limit = 8, showFilters = true }: SalesBoostBoardProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data, isLoading, error, refetch, isFetching } = useMercadoLivreGrowthReport(workspaceId, {
        periods: [30],
        topN: 20,
    });
    const syncMutation = useSyncMercadoLivre();

    const updatePriceMutation = useUpdateMercadoLivrePrice();
    const [pendingPrice, setPendingPrice] = useState<{
        plan: MercadoLivreSkuPlan;
        price: number;
        label: string;
    } | null>(null);
    const [search, setSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("priority");
    const [cooldownDays, setCooldownDays] = useState<number>(7);
    const [adjustments, setAdjustments] = useState<Record<string, { adjustedAt: string }>>({});

    useEffect(() => {
        if (!workspaceId) return;
        try {
            const storedCooldown = window.localStorage.getItem(`ml-adjustment-cooldown:${workspaceId}`);
            if (storedCooldown) {
                const parsed = Number(storedCooldown);
                if (Number.isFinite(parsed) && parsed > 0) {
                    setCooldownDays(parsed);
                }
            }
            const raw = window.localStorage.getItem(`ml-adjustments:${workspaceId}`);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, { adjustedAt: string }>;
                if (parsed && typeof parsed === "object") {
                    setAdjustments(parsed);
                }
            }
        } catch {
            // ignore storage errors
        }
    }, [workspaceId]);

    const persistAdjustments = (next: Record<string, { adjustedAt: string }>) => {
        if (!workspaceId) return;
        setAdjustments(next);
        try {
            window.localStorage.setItem(`ml-adjustments:${workspaceId}`, JSON.stringify(next));
        } catch {
            // ignore storage errors
        }
    };

    const handleToggleAdjusted = (mlbId: string, checked: boolean) => {
        if (!workspaceId) return;
        const next = { ...adjustments };
        if (checked) {
            next[mlbId] = { adjustedAt: new Date().toISOString() };
        } else {
            delete next[mlbId];
        }
        persistAdjustments(next);
    };

    const handleCooldownChange = (value: string) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        setCooldownDays(parsed);
        if (!workspaceId) return;
        try {
            window.localStorage.setItem(`ml-adjustment-cooldown:${workspaceId}`, String(parsed));
        } catch {
            // ignore storage errors
        }
    };

    const rawPlans = useMemo(() => {
        if (!data?.skuPlans) return [];
        const priorityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

        return [...data.skuPlans]
            .filter((plan) => plan.status !== "closed")
            .sort((a, b) => {
                const rankDiff = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
                if (rankDiff !== 0) return rankDiff;
                return Number(b.visits || 0) - Number(a.visits || 0);
            })
            .slice(0, 50);
    }, [data?.skuPlans]);

    const filteredPlans = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const items = rawPlans.filter((plan) => {
            if (priorityFilter !== "all" && plan.priority !== priorityFilter) return false;
            if (!needle) return true;
            const haystack = `${plan.title || ""} ${plan.ml_item_id || ""}`.toLowerCase();
            return haystack.includes(needle);
        });

        const sorters: Record<string, (a: MercadoLivreSkuPlan, b: MercadoLivreSkuPlan) => number> = {
            priority: (a, b) => {
                const rank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
                const diff = (rank[a.priority] ?? 99) - (rank[b.priority] ?? 99);
                if (diff !== 0) return diff;
                return Number(b.visits || 0) - Number(a.visits || 0);
            },
            visits: (a, b) => Number(b.visits || 0) - Number(a.visits || 0),
            sales: (a, b) => Number(b.units || 0) - Number(a.units || 0),
            conversion: (a, b) => Number(b.conversion || 0) - Number(a.conversion || 0),
            revenue: (a, b) => Number(b.revenue || 0) - Number(a.revenue || 0),
        };

        const sorter = sorters[sortBy] || sorters.priority;
        return [...items].sort(sorter);
    }, [rawPlans, priorityFilter, search, sortBy]);

    const visiblePlans = useMemo(() => {
        if (!limit || limit <= 0) return filteredPlans;
        return filteredPlans.slice(0, limit);
    }, [filteredPlans, limit]);

    const handleApplyPrice = async () => {
        if (!pendingPrice || !workspaceId) return;

        try {
            await updatePriceMutation.mutateAsync({
                workspaceId,
                productId: pendingPrice.plan.ml_item_id,
                price: pendingPrice.price,
            });
            handleToggleAdjusted(pendingPrice.plan.ml_item_id, true);
            toast({
                title: "Preço atualizado",
                description: `${pendingPrice.plan.title || pendingPrice.plan.ml_item_id} → ${formatCurrency(pendingPrice.price)}`,
            });
            setPendingPrice(null);
        } catch (err: any) {
            toast({
                title: "Falha ao atualizar preço",
                description: err?.message || "Não foi possível aplicar o teste de preço.",
                variant: "destructive",
            });
        }
    };

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Flame className="h-5 w-5 text-primary" />
                        Oportunidades de Volume
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={String(cooldownDays)} onValueChange={handleCooldownChange}>
                            <SelectTrigger className="h-7 w-[120px] text-[10px] uppercase tracking-widest">
                                <SelectValue placeholder="Cooldown" />
                            </SelectTrigger>
                            <SelectContent>
                                {COOLDOWN_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={String(option.value)}>
                                        Esperar {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] uppercase tracking-widest">
                            30d
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                            {filteredPlans.length} itens
                        </Badge>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] uppercase tracking-widest"
                            onClick={async () => {
                                if (!workspaceId) {
                                    toast({
                                        title: "Workspace não encontrado",
                                        description: "Selecione um workspace para sincronizar.",
                                        variant: "destructive",
                                    });
                                    return;
                                }
                                try {
                                    await syncMutation.mutateAsync(workspaceId);
                                    await refetch();
                                    toast({
                                        title: "Oportunidades atualizadas",
                                        description: "Dados sincronizados com o Mercado Livre.",
                                    });
                                } catch (err: any) {
                                    toast({
                                        title: "Falha ao atualizar",
                                        description: err?.message || "Não foi possível sincronizar agora.",
                                        variant: "destructive",
                                    });
                                }
                            }}
                            disabled={isFetching || syncMutation.isPending}
                        >
                            <RotateCw className={`h-3 w-3 mr-1 ${(isFetching || syncMutation.isPending) ? "animate-spin" : ""}`} />
                            Atualizar
                        </Button>
                        {isFetching && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                Atualizando
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {showFilters && (
                    <div className="flex flex-wrap gap-3">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por título ou MLB..."
                            className="h-10 w-full md:max-w-[260px]"
                        />
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-10 w-[160px]">
                                <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="A">Prioridade A</SelectItem>
                                <SelectItem value="B">Prioridade B</SelectItem>
                                <SelectItem value="C">Prioridade C</SelectItem>
                                <SelectItem value="D">Monitorar</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-10 w-[180px]">
                                <SelectValue placeholder="Ordenar por" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="priority">Prioridade</SelectItem>
                                <SelectItem value="visits">Mais visitas</SelectItem>
                                <SelectItem value="sales">Mais vendas</SelectItem>
                                <SelectItem value="conversion">Maior conversão</SelectItem>
                                <SelectItem value="revenue">Maior receita</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {isLoading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                        ))}
                    </div>
                )}

                {!isLoading && error && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                        <p className="font-semibold">Erro ao carregar oportunidades.</p>
                        <p className="text-xs mt-1 opacity-80">{(error as Error).message}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => refetch()}
                        >
                            Tentar novamente
                        </Button>
                    </div>
                )}

                {!isLoading && !error && rawPlans.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-6">
                        Nenhuma oportunidade forte encontrada. Rode o relatório executivo.
                    </div>
                )}

                {!isLoading && !error && visiblePlans.map((plan) => {
                    const priority = PRIORITY_META[plan.priority] || PRIORITY_META.D;
                    const priceTests = plan.priceTests;
                    const mlLink = `https://www.mercadolivre.com.br/itm/${plan.ml_item_id}`;
                    const adjustment = adjustments[plan.ml_item_id];
                    const adjustedAt = adjustment?.adjustedAt ? new Date(adjustment.adjustedAt) : null;
                    const daysSince = adjustedAt ? diffInDays(adjustedAt, new Date()) : null;
                    const daysRemaining = adjustedAt ? Math.max(0, cooldownDays - (daysSince ?? 0)) : null;
                    const isLocked = typeof daysRemaining === "number" && daysRemaining > 0;

                    return (
                        <div
                            key={plan.ml_item_id}
                            className="rounded-2xl border border-border/20 bg-background/40 p-4 space-y-3"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">
                                        {plan.title || "Anúncio"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                                        {plan.ml_item_id}
                                    </p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`border-none px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${priority.className}`}
                                >
                                    {priority.label}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    {formatNumber(plan.visits)} visitas
                                </span>
                                <span>{formatNumber(plan.units)} vendas</span>
                                <span>conv. {formatPct(plan.conversion, 2)}</span>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                {plan.diagnosis}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={Boolean(adjustment)}
                                        onCheckedChange={(checked) => handleToggleAdjusted(plan.ml_item_id, Boolean(checked))}
                                    />
                                    <span className="text-[11px] font-semibold">Anúncio mexido</span>
                                </div>
                                {adjustedAt && (
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                        <span>Ajustado em {formatShortDate(adjustment.adjustedAt)}</span>
                                        {isLocked ? (
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                                                Aguardar {daysRemaining}d
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
                                                Pode mexer
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            {plan.actions?.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {plan.actions.slice(0, 3).map((action, idx) => (
                                        <Badge
                                            key={`${plan.ml_item_id}-${idx}`}
                                            variant="outline"
                                            className="text-[10px] uppercase tracking-widest"
                                        >
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            {action}
                                        </Badge>
                                    ))}
                                </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-full"
                                    onClick={() => navigate(`/mercado-livre-analyzer?mlb=${plan.ml_item_id}`)}
                                >
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    Analisar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => navigate(`/mercado-livre-price-calculator?mlb=${plan.ml_item_id}`)}
                                >
                                    <Tag className="h-3.5 w-3.5 mr-1" />
                                    Margem
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={() => window.open(mlLink, "_blank")}
                                >
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                    Ver no ML
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(mlLink);
                                            toast({
                                                title: "Link copiado",
                                                description: "Cole no navegador ou abra em aba anônima.",
                                            });
                                        } catch {
                                            toast({
                                                title: "Não foi possível copiar",
                                                description: "Tente copiar manualmente o link.",
                                                variant: "destructive",
                                            });
                                        }
                                    }}
                                >
                                    <Copy className="h-3.5 w-3.5 mr-1" />
                                    Copiar link
                                </Button>
                            </div>

                            {priceTests && (
                                <div className="rounded-xl bg-muted/20 border border-border/10 p-3 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                                        <span>Teste rápido de preço</span>
                                        <span className="font-bold text-foreground">Atual {formatCurrency(priceTests.current)}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { label: "T1", value: priceTests.t1 },
                                            { label: "T2", value: priceTests.t2 },
                                            { label: "T3", value: priceTests.t3 },
                                        ] as const).map((test) => (
                                            <Button
                                                key={`${plan.ml_item_id}-${test.label}`}
                                                size="sm"
                                                variant="outline"
                                                className="rounded-full"
                                                onClick={() => setPendingPrice({ plan, price: test.value, label: test.label })}
                                                disabled={!workspaceId || updatePriceMutation.isPending || isLocked}
                                            >
                                                {test.label} {formatCurrency(test.value)}
                                            </Button>
                                        ))}
                                    </div>
                                    {isLocked && (
                                        <div className="text-[10px] text-muted-foreground">
                                            Em observação: espere {daysRemaining} dia(s) para novo ajuste.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>

            <AlertDialog open={Boolean(pendingPrice)} onOpenChange={(open) => !open && setPendingPrice(null)}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Aplicar teste de preço?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingPrice ? (
                                <span>
                                    Você vai atualizar <strong>{pendingPrice.plan.title || pendingPrice.plan.ml_item_id}</strong> para {" "}
                                    <strong>{formatCurrency(pendingPrice.price)}</strong> ({pendingPrice.label}).
                                </span>
                            ) : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={updatePriceMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApplyPrice} disabled={updatePriceMutation.isPending}>
                            {updatePriceMutation.isPending ? "Aplicando..." : "Confirmar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

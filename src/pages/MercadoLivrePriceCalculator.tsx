import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Percent, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Settings2, Truck } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type MLItem = {
    id: string;
    title: string;
    price: number;
    listing_type_id?: string;
    shipping?: { free_shipping?: boolean; logistic_type?: string; mode?: string; dimensions?: string };
    available_quantity?: number;
    sold_quantity?: number;
    permalink?: string;
    thumbnail?: string;
    attributes?: Array<{ id: string; name: string; value_name?: string }>;
};

const LISTING_FEE_TABLE: Record<string, number> = {
    gold_special: 0.19, // Premium
    gold_pro: 0.19,
    gold: 0.19,
    silver: 0.14, // Clássico
    bronze: 0.09,
    free: 0,
};

function getFeePercent(listingType?: string): number {
    if (!listingType) return 0.19;
    const key = listingType.toLowerCase();
    return LISTING_FEE_TABLE[key] ?? 0.19;
}

export default function MercadoLivrePriceCalculator() {
    const { currentWorkspace } = useWorkspace();
    const [searchParams] = useSearchParams();
    const mlbFromQuery = searchParams.get("mlb")?.trim();
    const autoLoadedRef = useRef<string | null>(null);
    const [mlbId, setMlbId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [item, setItem] = useState<MLItem | null>(null);

    const [feePercent, setFeePercent] = useState(0.19);
    const [productCost, setProductCost] = useState(0);
    const [shippingCost, setShippingCost] = useState(0);
    const [shippingMode, setShippingMode] = useState<"buyer" | "seller">("buyer");
    const [packagingCost, setPackagingCost] = useState(0);
    const [otherCost, setOtherCost] = useState(0);
    const [desiredMargin, setDesiredMargin] = useState(0.2);
    const [manualPrice, setManualPrice] = useState<number | null>(null);
    const [paymentFeePercent, setPaymentFeePercent] = useState(0.04);
    const [overheadPercent, setOverheadPercent] = useState(0.03);
    const [cacCost, setCacCost] = useState(2);
    const [competitorPrice, setCompetitorPrice] = useState<number | null>(null);
    const [originalPrice, setOriginalPrice] = useState<number | null>(null);
    const [mlShippingCost, setMlShippingCost] = useState<number | null>(null);
    const [mlFlatFeePerUnit, setMlFlatFeePerUnit] = useState(6.5);
    const [unitsPerOrder, setUnitsPerOrder] = useState(1);

    useEffect(() => {
        if (item?.price) {
            setFeePercent(getFeePercent(item.listing_type_id));
            setManualPrice(item.price);
            setShippingMode(item.shipping?.free_shipping ? "seller" : "buyer");
            try {
                const costTag = item.shipping?.tags?.find?.((t: string) => /^cost:/.test(t));
                if (costTag) {
                    const value = Number(costTag.split(":")[1]);
                    if (Number.isFinite(value)) {
                        setMlShippingCost(value);
                    }
                }
            } catch { /* ignore */ }
        }
    }, [item]);

    const priceToUse = manualPrice ?? Number(item?.price || 0);
    const effectiveShippingCost = shippingMode === "seller"
        ? (shippingCost || mlShippingCost || 0)
        : 0;

    const totals = useMemo(() => {
        const price = priceToUse;
        const feeMl = price * feePercent;
        const feePayment = price * paymentFeePercent;
        const feeOverhead = price * overheadPercent;
        const feeFlat = mlFlatFeePerUnit * Math.max(1, unitsPerOrder);
        const totalFees = feeMl + feePayment + feeOverhead + feeFlat;
        const costs = productCost + effectiveShippingCost + packagingCost + otherCost + cacCost;
        const profit = price - totalFees - costs;
        const marginPct = price > 0 ? profit / price : 0;
        const feeBase = 1 - (feePercent + paymentFeePercent + overheadPercent);
        const breakeven = feeBase > 0 ? (costs + feeFlat) / feeBase : 0;
        const targetPrice = feeBase - desiredMargin > 0 ? (costs + feeFlat) / (feeBase - desiredMargin) : 0;
        return {
            price,
            fee: totalFees,
            feeMl,
            feePayment,
            feeOverhead,
            feeFlat,
            costs,
            profit,
            marginPct,
            breakeven: Math.max(0, breakeven),
            targetPrice: Math.max(0, targetPrice),
        };
    }, [priceToUse, feePercent, paymentFeePercent, overheadPercent, productCost, effectiveShippingCost, packagingCost, otherCost, cacCost, desiredMargin, mlFlatFeePerUnit, unitsPerOrder]);

    const simulatePrice = (price: number) => {
        const fee = price * (feePercent + paymentFeePercent + overheadPercent);
        const costs = productCost + effectiveShippingCost + packagingCost + otherCost + cacCost + (mlFlatFeePerUnit * Math.max(1, unitsPerOrder));
        const profit = price - fee - costs;
        const marginPct = price > 0 ? profit / price : 0;
        return { price, fee, profit, marginPct };
    };

    const loadItem = useCallback(async (overrideId?: string) => {
        const targetId = (overrideId || mlbId).trim().toUpperCase();
        if (!targetId || !currentWorkspace?.id) return;
        if (targetId !== mlbId) {
            setMlbId(targetId);
        }
        setLoading(true);
        setError(null);
        try {
            const resp = await fetch(`/api/integrations/mercadolivre/items/${targetId}?workspaceId=${currentWorkspace.id}`);
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data?.error || "Falha ao buscar item");
            }
            const data = await resp.json();
            setItem(data);
        } catch (e: any) {
            setError(e?.message || "Erro ao buscar item");
            setItem(null);
        } finally {
            setLoading(false);
        }
    }, [currentWorkspace?.id, mlbId]);

    useEffect(() => {
        if (!mlbFromQuery || !currentWorkspace?.id) return;
        const normalized = mlbFromQuery.toUpperCase();
        if (!normalized) return;
        if (autoLoadedRef.current === normalized) return;
        autoLoadedRef.current = normalized;
        void loadItem(normalized);
    }, [mlbFromQuery, currentWorkspace?.id, loadItem]);

    return (
        <div className="container mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
            <div className="flex items-center gap-3">
                <TrendingUp className="w-10 h-10 text-amber-500" />
                <div>
                    <h1 className="text-4xl font-bold">Calculadora de Margem ML</h1>
                    <p className="text-muted-foreground text-sm">Veja taxas, custos e preço alvo para manter margem saudável.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Buscar anúncio</CardTitle>
                    <CardDescription>Informe o MLB ID para puxar preço, tipo de anúncio e frete.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <Label htmlFor="mlbId">MLB ID</Label>
                        <Input
                            id="mlbId"
                            value={mlbId}
                            onChange={(e) => setMlbId(e.target.value.toUpperCase())}
                            placeholder="Ex: MLB123456789"
                        />
                    </div>
                    <Button className="mt-6 md:mt-auto" onClick={loadItem} disabled={loading || !mlbId || !currentWorkspace?.id}>
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buscar
                    </Button>
                </CardContent>
                {error && (
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </CardContent>
                )}
            </Card>

            {item && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>{item.title}</CardTitle>
                            <CardDescription>{item.id}</CardDescription>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {item.listing_type_id && (
                                    <Badge variant="outline" className="uppercase">
                                        {item.listing_type_id}
                                    </Badge>
                                )}
                                {item.shipping?.free_shipping && <Badge variant="secondary">Frete grátis</Badge>}
                                {item.shipping?.logistic_type && <Badge variant="secondary">{item.shipping.logistic_type}</Badge>}
                                {item.shipping?.mode && <Badge variant="secondary">{item.shipping.mode}</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="text-3xl font-bold">R$ {(priceToUse || 0).toFixed(2)}</div>
                            <div className="grid md:grid-cols-2 gap-3">
                                <div>
                                    <Label>Preço simulado</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            value={priceToUse}
                                            onChange={(e) => setManualPrice(Number(e.target.value))}
                                        />
                                        <Button type="button" variant="outline" onClick={() => setManualPrice(item?.price ?? 0)}>
                                            Usar preço do anúncio
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Altere para simular variações de preço.</p>
                                </div>
                                <div>
                                    <Label>Presets de taxa/anúncio</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <Button size="sm" variant="outline" type="button" onClick={() => setFeePercent(0.19)}>Premium ~19%</Button>
                                        <Button size="sm" variant="outline" type="button" onClick={() => setFeePercent(0.14)}>Clássico ~14%</Button>
                                        <Button size="sm" variant="outline" type="button" onClick={() => setFeePercent(getFeePercent(item?.listing_type_id))}>Taxa do anúncio</Button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="space-y-3">
                                    <Label>Taxa ML (%)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={feePercent}
                                            onChange={(e) => setFeePercent(Number(e.target.value))}
                                        />
                                        <Button variant="outline" type="button" onClick={() => setFeePercent(getFeePercent(item.listing_type_id))}>
                                            Padrão do anúncio
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Somente o percentual da comissão (ex.: 19% Premium, 14% Clássico). A tarifa fixa é configurada abaixo.
                                    </p>
                                    <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                                        <Truck className="w-4 h-4" />
                                        <span>Frete padrão: {item.shipping?.mode || 'N/A'} • {item.shipping?.logistic_type || 'logística'}</span>
                                        <Badge variant="outline">{shippingMode === "seller" ? "Vendedor paga frete" : "Comprador paga frete"}</Badge>
                                        {item.shipping?.dimensions && <span>Dimensões: {item.shipping.dimensions}</span>}
                                        {mlShippingCost !== null && <Badge variant="outline">Custo ML: R$ {mlShippingCost.toFixed(2)}</Badge>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label>Custo produto</Label>
                                        <Input type="number" value={productCost} onChange={(e) => setProductCost(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Frete (custo)</Label>
                                        <Input type="number" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} />
                                        {mlShippingCost !== null && (
                                            <p className="text-xs text-muted-foreground">Sugestão (ML): R$ {mlShippingCost.toFixed(2)}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label>Embalagem</Label>
                                        <Input type="number" value={packagingCost} onChange={(e) => setPackagingCost(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Outros custos</Label>
                                        <Input type="number" value={otherCost} onChange={(e) => setOtherCost(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Tarifa fixa ML (R$ /unidade)</Label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {[6.25, 6.5].map((value) => (
                                                <Button
                                                    key={value}
                                                    size="sm"
                                                    type="button"
                                                    variant={mlFlatFeePerUnit === value ? "default" : "outline"}
                                                    onClick={() => setMlFlatFeePerUnit(value)}
                                                >
                                                    R$ {value.toFixed(2).replace(".", ",")}
                                                </Button>
                                            ))}
                                        </div>
                                        <Input
                                            type="number"
                                            step={0.01}
                                            value={mlFlatFeePerUnit}
                                            onChange={(e) => setMlFlatFeePerUnit(Number(e.target.value))}
                                            className="mt-2"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Valores padrão: 6,25 ou 6,50 por unidade. Não entra na % acima; é somada separadamente por unidade.
                                        </p>
                                    </div>
                                    <div>
                                        <Label>Unidades por pedido</Label>
                                        <Input type="number" value={unitsPerOrder} onChange={(e) => setUnitsPerOrder(Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                                <div>
                                    <Label>Margem alvo (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                    step={0.01}
                                    value={desiredMargin}
                                    onChange={(e) => setDesiredMargin(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id="buyer-pays"
                                        checked={shippingMode === "buyer"}
                                        onChange={() => setShippingMode("buyer")}
                                    />
                                    <Label htmlFor="buyer-pays" className="cursor-pointer">Comprador paga frete</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id="seller-pays"
                                        checked={shippingMode === "seller"}
                                        onChange={() => setShippingMode("seller")}
                                    />
                                    <Label htmlFor="seller-pays" className="cursor-pointer">Vendedor paga frete</Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Se vendedor paga frete, usamos o custo informado em “Frete (custo)” nos cálculos.
                                </p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label>Taxa pagamento (%)</Label>
                                        <Input type="number" step={0.005} value={paymentFeePercent} onChange={(e) => setPaymentFeePercent(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Overhead (%)</Label>
                                        <Input type="number" step={0.005} value={overheadPercent} onChange={(e) => setOverheadPercent(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>CAC / pedido</Label>
                                        <Input type="number" value={cacCost} onChange={(e) => setCacCost(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Preço original</Label>
                                        <Input type="number" value={originalPrice ?? ""} onChange={(e) => setOriginalPrice(Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label>Preço concorrente</Label>
                                        <Input type="number" value={competitorPrice ?? ""} onChange={(e) => setCompetitorPrice(Number(e.target.value))} />
                                    </div>
                                    <div className="flex items-end">
                                        <Button variant="outline" type="button" className="w-full" onClick={() => {
                                            const parsed = competitorPrice ?? 0;
                                            if (!Number.isFinite(parsed) || parsed <= 0) return;
                                            setManualPrice(parsed);
                                        }}>
                                            Usar preço concorrente
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Resumo financeiro</CardTitle>
                            <CardDescription>Margem com o preço atual do anúncio</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span>Preço atual</span>
                                <span className="font-semibold">R$ {totals.price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Taxa ML (%)</span>
                                <span>R$ {totals.feeMl.toFixed(2)} ({(feePercent * 100).toFixed(1)}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Taxa pagamento</span>
                                <span>R$ {totals.feePayment.toFixed(2)} ({(paymentFeePercent * 100).toFixed(1)}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Overhead</span>
                                <span>R$ {totals.feeOverhead.toFixed(2)} ({(overheadPercent * 100).toFixed(1)}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Tarifa fixa ML</span>
                                <span>R$ {totals.feeFlat.toFixed(2)} ({unitsPerOrder} un.)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Custos (produto+frete+outros+CAC)</span>
                                <span>R$ {totals.costs.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">Lucro</span>
                                <span className={`font-bold ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    R$ {totals.profit.toFixed(2)} ({(totals.marginPct * 100).toFixed(1)}%)
                                </span>
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                                <div className="text-sm flex items-center gap-2">
                                    <Wallet className="w-4 h-4" />
                                    <div>
                                        <div className="font-semibold">Preço de equilíbrio</div>
                                        <div className="text-muted-foreground text-xs">Para cobrir custos+taxa: R$ {totals.breakeven.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="text-sm flex items-center gap-2">
                                    <Percent className="w-4 h-4" />
                                    <div>
                                        <div className="font-semibold">Preço alvo ({(desiredMargin * 100).toFixed(0)}% margem)</div>
                                        <div className="text-muted-foreground text-xs">Sugerido: R$ {totals.targetPrice.toFixed(2)}</div>
                                    </div>
                                </div>
                                {originalPrice && (
                                    <div className="text-sm">
                                        <div className="font-semibold">Desconto vs preço original</div>
                                        <div className="text-muted-foreground text-xs">
                                            {((1 - totals.price / originalPrice) * 100).toFixed(1)}% off (R$ {(originalPrice - totals.price).toFixed(2)})
                                        </div>
                                    </div>
                                )}
                                {competitorPrice && (
                                    <div className="text-sm">
                                        <div className="font-semibold">Diferença para concorrente</div>
                                        <div className="text-muted-foreground text-xs">
                                            {((totals.price - competitorPrice) / competitorPrice * 100).toFixed(1)}% vs R$ {competitorPrice.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {item && (
                <Card>
                    <CardHeader>
                        <CardTitle>Simulações rápidas</CardTitle>
                        <CardDescription>Compare cenários de preço sem editar os campos principais</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-3 gap-3">
                        {(() => {
                            const feeBase = 1 - (feePercent + paymentFeePercent + overheadPercent);
                            const getPriceForMargin = (margin: number) => {
                                return feeBase - margin > 0 ? (totals.costs + totals.feeFlat) / (feeBase - margin) : 0;
                            };

                            return [
                                { label: "Atual", price: priceToUse, icon: <Settings2 className="w-4 h-4" /> },
                                { label: "+5%", price: priceToUse * 1.05, icon: <ArrowUpRight className="w-4 h-4" /> },
                                { label: "-5%", price: priceToUse * 0.95, icon: <ArrowDownRight className="w-4 h-4" /> },
                                { label: "Margem 30%", price: getPriceForMargin(0.30), icon: <Percent className="w-4 h-4" /> },
                                { label: "Margem 40%", price: getPriceForMargin(0.40), icon: <Percent className="w-4 h-4" /> },
                                { label: `Preço alvo (${(desiredMargin * 100).toFixed(0)}%)`, price: totals.targetPrice, icon: <Percent className="w-4 h-4" />, className: "bg-green-50 border-green-200" },
                            ].map((scenario, idx) => {
                                const sim = simulatePrice(scenario.price);
                                return (
                                    <div key={idx} className={`p-3 rounded-lg border space-y-1 ${scenario.className || "bg-muted/40"}`}>
                                        <div className="flex items-center justify-between text-sm font-semibold">
                                            <span className="flex items-center gap-2">{scenario.icon}{scenario.label}</span>
                                            <span>R$ {scenario.price.toFixed(2)}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">Lucro: R$ {sim.profit.toFixed(2)}</div>
                                        <div className={`text-xs ${sim.marginPct >= 0 ? "text-green-700" : "text-red-700"}`}>
                                            Margem: {(sim.marginPct * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ChevronRight, ChevronLeft, Clock, Box, Calendar as CalendarIcon, ExternalLink, User, Truck, CreditCard, Package, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMercadoLivreOrderDetails } from "@/hooks/useMercadoLivreOrders";
import type { MercadoLivreProduct } from "@/hooks/useMercadoLivre";

const formatCurrency = (value: number | null | undefined, currencyId?: string) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    const currency = currencyId || "BRL";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatShortDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const normalizeStatus = (value?: string | null) => String(value || "").toLowerCase();

const getStatusLabel = (value?: string | null) => {
    const normalized = normalizeStatus(value);
    if (!normalized) return "-";
    if (normalized === "paid") return "PAGO";
    if (normalized === "cancelled" || normalized === "canceled") return "CANCELADO";
    return normalized.toUpperCase();
};

const InfoRow = ({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) => (
    <div className="flex items-start justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("text-right font-medium", mono && "font-mono text-[11px]")}>{value ?? "-"}</span>
    </div>
);

interface RecentActivityProps {
    orders: any[];
    loading?: boolean;
    date?: Date;
    onDateChange?: (date: Date | undefined) => void;
    workspaceId?: string | null;
    products?: MercadoLivreProduct[];
}

export function RecentActivity({ orders, loading, date, onDateChange, workspaceId, products = [] }: RecentActivityProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const itemsPerPage = 3;
    const productsById = useMemo(
        () => new Map(products.map((product) => [String(product.id || '').trim().toUpperCase(), product])),
        [products]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [date, orders]);

    useEffect(() => {
        setDetailsOpen(false);
        setSelectedOrder(null);
        setSelectedOrderId(null);
    }, [date]);

    const { data: orderDetails, isLoading: detailsLoading, error: detailsError } = useMercadoLivreOrderDetails(
        workspaceId || null,
        selectedOrderId
    );

    const detailsOrder = orderDetails?.order;
    const summary = orderDetails?.summary;
    const items = orderDetails?.items || selectedOrder?.items || [];
    const orderId = detailsOrder?.id ?? selectedOrder?.id;
    const status = detailsOrder?.status || selectedOrder?.status;
    const normalizedStatus = normalizeStatus(status);
    const statusLabel = getStatusLabel(status);
    const currencyId = summary?.currencyId || selectedOrder?.currencyId || "BRL";
    const createdAt = detailsOrder?.date_created || selectedOrder?.dateCreated;
    const updatedAt = detailsOrder?.last_updated || selectedOrder?.lastUpdated;
    const cancelledAt = detailsOrder?.date_closed || selectedOrder?.dateClosed;
    const buyer = detailsOrder?.buyer;
    const shipping = detailsOrder?.shipping;
    const payments = Array.isArray(detailsOrder?.payments) ? detailsOrder.payments : [];
    const orderLink = orderId ? `https://www.mercadolivre.com.br/vendas/${orderId}/detalhe` : null;

    const handleOpenDetails = (order: any) => {
        if (!order?.id) return;
        setSelectedOrder(order);
        setSelectedOrderId(String(order.id));
        setDetailsOpen(true);
    };

    const handleDetailsOpenChange = (open: boolean) => {
        setDetailsOpen(open);
        if (!open) {
            setSelectedOrder(null);
            setSelectedOrderId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil((orders?.length || 0) / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentOrders = orders?.slice(startIndex, startIndex + itemsPerPage) || [];
    const topProfitProduct = useMemo(() => {
        if (!orders?.length || !products?.length) return null;
        const aggregatedByItem = new Map<string, {
            itemId: string;
            title: string;
            thumbnail?: string | null;
            permalink?: string | null;
            units: number;
            revenue: number;
            profitAmount: number;
        }>();

        orders.forEach((order) => {
            const normalizedOrderStatus = normalizeStatus(order?.status);
            if (normalizedOrderStatus === "cancelled" || normalizedOrderStatus === "canceled") return;

            const orderItems = Array.isArray(order?.items) ? order.items : [];
            orderItems.forEach((item: any) => {
                const itemId = String(item?.itemId || "").trim().toUpperCase();
                if (!itemId) return;

                const quantity = Number(item?.quantity || 0);
                if (quantity <= 0) return;

                const product = productsById.get(itemId);
                const profitPerUnit = Number(product?.pricing_summary?.profitPerUnitCurrentPrice ?? 0);
                if (!(profitPerUnit > 0)) return;

                const unitPrice = Number(item?.unitPrice ?? item?.fullUnitPrice ?? 0);
                const existing = aggregatedByItem.get(itemId) || {
                    itemId,
                    title: item?.title || product?.title || itemId,
                    thumbnail: item?.thumbnail || product?.thumbnail || null,
                    permalink: item?.permalink || product?.permalink || null,
                    units: 0,
                    revenue: 0,
                    profitAmount: 0,
                };

                existing.units += quantity;
                existing.revenue += Math.max(0, unitPrice * quantity);
                existing.profitAmount += profitPerUnit * quantity;
                if (!existing.thumbnail) {
                    existing.thumbnail = item?.thumbnail || product?.thumbnail || null;
                }
                if (!existing.permalink) {
                    existing.permalink = item?.permalink || product?.permalink || null;
                }
                aggregatedByItem.set(itemId, existing);
            });
        });

        return Array.from(aggregatedByItem.values())
            .sort((a, b) => {
                if (b.profitAmount !== a.profitAmount) return b.profitAmount - a.profitAmount;
                if (b.revenue !== a.revenue) return b.revenue - a.revenue;
                return b.units - a.units;
            })[0] || null;
    }, [orders, products, productsById]);

    // If date is provided, we display it.
    // We rely on the parent to pass the correct filtered orders.

    if (loading) {
        return (
            <Card className="h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white/88 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-md lg:min-h-[560px]">
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-md lg:min-h-[560px]">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.90),rgba(16,185,129,0.55),rgba(255,255,255,0))]" />
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] pb-4">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-blue-600" />
                            Atividade Recente
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "h-8 w-[140px] justify-start border-slate-200/80 bg-white text-left text-xs font-normal shadow-sm",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {date ? format(date, "dd/MM/yyyy") : <span>Hoje</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={onDateChange}
                                    initialFocus
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                        <Badge variant="secondary" className="border-none bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            Live
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                    {topProfitProduct && (
                        <>
                            <div className="p-4 pb-0">
                                <div className="overflow-hidden rounded-[1.75rem] border border-emerald-200/80 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
                                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                                                <TrendingUp className="h-4 w-4 text-emerald-700" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900">
                                                    Top Lucro
                                                </p>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                                                    Melhor desempenho do dia
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Separator className="bg-emerald-100" />
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className="relative shrink-0">
                                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-emerald-100">
                                                {topProfitProduct.thumbnail ? (
                                                    <img src={topProfitProduct.thumbnail} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-white shadow-[0_6px_14px_rgba(245,158,11,0.18)]">
                                                <span
                                                    aria-hidden="true"
                                                    className="text-[20px] leading-none drop-shadow-[0_2px_4px_rgba(245,158,11,0.35)]"
                                                >
                                                    🔥
                                                </span>
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-slate-900" title={topProfitProduct.title}>
                                                {topProfitProduct.title}
                                            </p>
                                            <div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                                                <span>{topProfitProduct.itemId}</span>
                                                {topProfitProduct.permalink && (
                                                    <a
                                                        href={topProfitProduct.permalink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        Abrir
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-black text-emerald-700">
                                                {formatCurrency(topProfitProduct.revenue)}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500">
                                                {topProfitProduct.units} {topProfitProduct.units === 1 ? "unidade" : "unidades"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="px-4 pt-4">
                                <Separator className="bg-border/10" />
                            </div>
                        </>
                    )}
                    <div className="flex-1 divide-y divide-border/10">
                        {currentOrders.length > 0 ? (
                            currentOrders.map((order) => {
                                const item = order.items?.[0];
                                const itemId = String(item?.itemId || '').trim().toUpperCase();
                                const currentProduct = itemId ? productsById.get(itemId) : null;
                                const remainingStock = typeof currentProduct?.stock === 'number' ? currentProduct.stock : null;
                                const imageUrl = item?.thumbnail;
                                const title = item?.title || `Pedido #${order.id}`;
                                const quantity = item?.quantity || 1;
                                const currency = order.currencyId || "BRL";
                                const receivedFromMl = order.netReceivedAmount ?? order.paidAmount ?? order.totalAmount;
                                const discountAmount = Number(order.discountAmount || 0);
                                const normalizedOrderStatus = normalizeStatus(order.status);
                                const statusLabel = getStatusLabel(order.status);
                                const isCancelled = normalizedOrderStatus === "cancelled" || normalizedOrderStatus === "canceled";
                                const createdAtLabel = formatShortDateTime(order.dateCreated);
                                const cancelledAtLabel = formatShortDateTime(order.dateClosed);
                                const badgeClass = isCancelled ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500";

                                return (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => handleOpenDetails(order)}
                                        className="group/item flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-all hover:bg-slate-50/80"
                                        aria-label={`Ver detalhes do pedido ${order.id}`}
                                    >
                                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100/90 transition-all group-hover/item:ring-2 ring-blue-200/60">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="h-4 w-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-foreground/90" title={title}>{title}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className="text-sm font-black text-blue-700">
                                                    {formatCurrency(order.totalAmount, currency)}
                                                </p>
                                                <p
                                                    className="text-[10px] font-bold text-emerald-700"
                                                    title={`Taxas: ${formatCurrency(order.saleFee || 0, currency)} | Envio: ${formatCurrency(order.shippingCost || 0, currency)}${discountAmount > 0 ? ` | Desconto: ${formatCurrency(discountAmount, currency)}` : ""}`}
                                                >
                                                    Recebido ML: {formatCurrency(receivedFromMl, currency)}
                                                </p>
                                                {discountAmount > 0 && (
                                                    <p className="text-[10px] font-bold text-amber-600">
                                                        Desconto: {formatCurrency(discountAmount, currency)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5">
                                                    <Box className="h-3 w-3 text-muted-foreground" />
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        {quantity} {quantity === 1 ? "un" : "uns"}
                                                    </p>
                                                </div>
                                                {remainingStock !== null && (
                                                    <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5">
                                                        <Package className="h-3 w-3 text-amber-700" />
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                            {remainingStock === 0 ? "Sem estoque" : `${remainingStock} un. restantes`}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground font-medium shrink-0">
                                                    <Clock className="h-3 w-3 text-muted-foreground/70 mt-0.5" />
                                                    <div className="flex flex-col leading-tight">
                                                        <span>Comprado: {createdAtLabel}</span>
                                                        {isCancelled && (
                                                            <span className="text-destructive">Cancelado: {cancelledAtLabel}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <Badge className={cn("text-[9px] h-4 border-none font-black uppercase px-1.5", badgeClass)}>
                                                    {statusLabel}
                                                </Badge>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                                    </button>
                                );
                            })
                        ) : (
                            <div className="flex h-full min-h-[220px] items-center justify-center p-10 text-center">
                              <div>
                                <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                                    {date && (date.getDate() !== new Date().getDate() || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())
                                        ? "Sem vendas nesta data"
                                        : "Sem vendas hoje"}
                                </p>
                              </div>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="mt-auto flex items-center justify-between border-t border-border/10 bg-muted/5 p-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 hover:bg-background/80"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground font-medium">
                                Página {currentPage} de {totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-8 w-8 p-0 hover:bg-background/80"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Sheet open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
                <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
                    <div className="space-y-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pedido</div>
                                <div className="text-xl font-black text-foreground">#{orderId || "-"}</div>
                                <div className="text-xs text-muted-foreground">
                                    Criado: {formatDateTime(createdAt)}
                                    {updatedAt ? ` • Atualizado: ${formatDateTime(updatedAt)}` : ""}
                                    {(normalizedStatus === "cancelled" || normalizedStatus === "canceled") ? ` • Cancelado: ${formatDateTime(cancelledAt)}` : ""}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge
                                    className={cn(
                                        "text-[10px] h-5 border-none font-black uppercase px-2",
                                        (normalizedStatus === "cancelled" || normalizedStatus === "canceled")
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {statusLabel}
                                </Badge>
                                {orderLink && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" asChild>
                                        <a href={orderLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                            Abrir no ML
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {detailsLoading && (
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        )}

                        {detailsError && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                                Não foi possível carregar todos os detalhes deste pedido.
                            </div>
                        )}

                        {!detailsLoading && (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bruto</div>
                                        <div className="text-sm font-bold">
                                            {formatCurrency(summary?.grossAmount ?? selectedOrder?.grossAmount, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Desconto</div>
                                        <div className="text-sm font-bold text-warning">
                                            {formatCurrency(summary?.discountAmount ?? selectedOrder?.discountAmount, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Venda final</div>
                                        <div className="text-sm font-bold">
                                            {formatCurrency(summary?.totalAmount ?? selectedOrder?.totalAmount, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pago</div>
                                        <div className="text-sm font-bold">
                                            {formatCurrency(summary?.paidAmount ?? selectedOrder?.paidAmount, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recebido ML</div>
                                        <div className="text-sm font-bold text-success">
                                            {formatCurrency(summary?.netReceivedAmount ?? selectedOrder?.netReceivedAmount, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Taxas</div>
                                        <div className="text-sm font-bold">
                                            {formatCurrency(summary?.saleFee ?? selectedOrder?.saleFee, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Envio</div>
                                        <div className="text-sm font-bold">
                                            {formatCurrency(summary?.shippingCost ?? selectedOrder?.shippingCost, currencyId)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Líquido após frete</div>
                                        <div className="text-sm font-bold text-success">
                                            {formatCurrency(summary?.netIncome ?? selectedOrder?.netIncome, currencyId)}
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        Comprador
                                    </div>
                                    {detailsOrder?.buyer ? (
                                        <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-4">
                                            <InfoRow label="Nome" value={[buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ") || buyer?.nickname || "-"} />
                                            <InfoRow label="Nickname" value={buyer?.nickname} />
                                            <InfoRow label="ID" value={buyer?.id} mono />
                                            <InfoRow label="Email" value={buyer?.email} />
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                                            Detalhes do comprador indisponíveis para este pedido.
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm font-bold">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                            Itens
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-bold">
                                            {items.length}
                                        </Badge>
                                    </div>
                                    {items.length > 0 ? (
                                        <div className="space-y-3">
                                            {items.map((item: any) => (
                                                <div key={item.itemId || item.id} className="flex gap-3 rounded-2xl border border-border/40 bg-background/60 p-3">
                                                    <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                                                        {item.thumbnail ? (
                                                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <div className="text-sm font-semibold line-clamp-2">{item.title || "Item"}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.quantity || 1} un • {formatCurrency(item.unitPrice, currencyId)}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground font-mono">
                                                            {item.itemId}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start">
                                                        {item.permalink && (
                                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                                                                <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                                    Ver anúncio
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                                            Nenhum item encontrado neste pedido.
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                        Pagamentos
                                    </div>
                                    {payments.length > 0 ? (
                                        <div className="space-y-3">
                                            {payments.map((payment: any, index: number) => (
                                                <div key={payment.id || index} className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
                                                    <InfoRow
                                                        label="Status"
                                                        value={[
                                                            payment.status,
                                                            payment.status_detail ? `(${payment.status_detail})` : "",
                                                        ].filter(Boolean).join(" ")}
                                                    />
                                                    <InfoRow
                                                        label="Método"
                                                        value={[
                                                            payment.payment_method_id,
                                                            payment.payment_type_id ? `(${payment.payment_type_id})` : "",
                                                        ].filter(Boolean).join(" ")}
                                                    />
                                                    <InfoRow
                                                        label="Pago"
                                                        value={formatCurrency(payment.transaction_amount || payment.total_paid_amount, currencyId)}
                                                    />
                                                    <InfoRow
                                                        label="Recebido ML"
                                                        value={formatCurrency(payment.transaction_details?.net_received_amount, currencyId)}
                                                    />
                                                    {Number(payment.coupon_amount || 0) > 0 && (
                                                        <InfoRow
                                                            label="Cupom"
                                                            value={formatCurrency(payment.coupon_amount, currencyId)}
                                                        />
                                                    )}
                                                    <InfoRow
                                                        label="Parcelas"
                                                        value={payment.installments ? `${payment.installments}x ${formatCurrency(payment.installment_amount, currencyId)}` : "-"}
                                                    />
                                                    <InfoRow
                                                        label="Criado em"
                                                        value={formatDateTime(payment.date_created)}
                                                    />
                                                    <InfoRow
                                                        label="Aprovado em"
                                                        value={formatDateTime(payment.date_approved)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                                            Nenhum pagamento detalhado disponível.
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <Truck className="h-4 w-4 text-muted-foreground" />
                                        Envio
                                    </div>
                                    {shipping ? (
                                        <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
                                            <InfoRow label="ID" value={shipping.id} mono />
                                            <InfoRow label="Status" value={shipping.status} />
                                            <InfoRow label="Modo" value={shipping.mode || shipping.shipping_mode} />
                                            <InfoRow label="Logística" value={shipping.logistic_type} />
                                            <InfoRow label="Serviço" value={shipping.shipping_option?.name || shipping.shipping_option?.shipping_method_id} />
                                            <InfoRow label="Rastreamento" value={shipping.tracking_number || shipping.tracking_id || shipping.tracking_method} />
                                            {shipping.receiver_address && (
                                                <>
                                                    <Separator className="my-2" />
                                                    <InfoRow
                                                        label="Endereço"
                                                        value={
                                                            shipping.receiver_address.address_line ||
                                                            [shipping.receiver_address.street_name, shipping.receiver_address.street_number]
                                                                .filter(Boolean)
                                                                .join(", ")
                                                        }
                                                    />
                                                    <InfoRow label="Bairro" value={shipping.receiver_address.neighborhood?.name || shipping.receiver_address.neighborhood} />
                                                    <InfoRow
                                                        label="Cidade/UF"
                                                        value={[
                                                            shipping.receiver_address.city?.name,
                                                            shipping.receiver_address.state?.name,
                                                        ].filter(Boolean).join(" - ")}
                                                    />
                                                    <InfoRow label="CEP" value={shipping.receiver_address.zip_code} mono />
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                                            Nenhuma informação de envio disponível.
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {orderDetails?.order ? (
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value="raw">
                                            <AccordionTrigger className="text-sm">Dados brutos do pedido</AccordionTrigger>
                                            <AccordionContent>
                                                <pre className="text-[11px] bg-muted/40 border rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                                                    {JSON.stringify(orderDetails, null, 2)}
                                                </pre>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                                        Dados brutos indisponíveis.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}

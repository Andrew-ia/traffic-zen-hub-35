import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ChevronRight, ChevronLeft, Clock, Box, Calendar as CalendarIcon, ExternalLink, User, Truck, CreditCard, Package } from "lucide-react";
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
}

export function RecentActivity({ orders, loading, date, onDateChange, workspaceId }: RecentActivityProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const itemsPerPage = 6;

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

    const totalPages = Math.ceil((orders?.length || 0) / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentOrders = orders?.slice(startIndex, startIndex + itemsPerPage) || [];

    // If date is provided, we display it.
    // We rely on the parent to pass the correct filtered orders.

    if (loading) {
        return (
            <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-primary" />
                            Atividade Recente
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "h-8 w-[140px] justify-start text-left font-normal text-xs border-dashed",
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
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-2.5 py-0.5 font-bold uppercase text-[10px]">
                            Live
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/10">
                        {currentOrders.length > 0 ? (
                            currentOrders.map((order) => {
                                const item = order.items?.[0];
                                const imageUrl = item?.thumbnail;
                                const title = item?.title || `Pedido #${order.id}`;
                                const quantity = item?.quantity || 1;
                                const normalizedOrderStatus = normalizeStatus(order.status);
                                const statusLabel = getStatusLabel(order.status);
                                const isCancelled = normalizedOrderStatus === "cancelled" || normalizedOrderStatus === "canceled";
                                const createdAtLabel = formatShortDateTime(order.dateCreated);
                                const cancelledAtLabel = formatShortDateTime(order.dateClosed);
                                const badgeClass = isCancelled ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";

                                return (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => handleOpenDetails(order)}
                                        className="w-full p-5 hover:bg-muted/10 transition-all cursor-pointer flex items-center gap-4 group/item text-left"
                                        aria-label={`Ver detalhes do pedido ${order.id}`}
                                    >
                                        <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden relative group-hover/item:ring-2 ring-primary/20 transition-all">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="h-5 w-5 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate text-foreground/90" title={title}>{title}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className="text-sm font-black text-primary">
                                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.totalAmount)}
                                                </p>
                                                {order.netIncome !== undefined && (
                                                    <p className="text-[10px] font-bold text-success" title={`Taxas: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.saleFee || 0)} | Envio: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.shippingCost || 0)}`}>
                                                        Lucro: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.netIncome)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md shrink-0">
                                                    <Box className="h-3 w-3 text-muted-foreground" />
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        {quantity} {quantity === 1 ? "un" : "uns"}
                                                    </p>
                                                </div>
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
                            <div className="p-12 text-center">
                                <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                                    {date && (date.getDate() !== new Date().getDate() || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())
                                        ? "Sem vendas nesta data"
                                        : "Sem vendas hoje"}
                                </p>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-border/10 bg-muted/5">
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
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
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Lucro</div>
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
                                                        label="Valor"
                                                        value={formatCurrency(payment.transaction_amount || payment.total_paid_amount, currencyId)}
                                                    />
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

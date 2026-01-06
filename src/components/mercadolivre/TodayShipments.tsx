import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, ExternalLink } from "lucide-react";
import { useMercadoLivreShipments } from "@/hooks/useMercadoLivreShipments";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

interface TodayShipmentsProps {
    workspaceId: string | null;
}

export function TodayShipments({ workspaceId }: TodayShipmentsProps) {
    // Busca envios com status que indicam que precisam ser enviados
    // pending, handling, ready_to_ship
    const { data, isLoading } = useMercadoLivreShipments(workspaceId, {
        status: 'pending,handling,ready_to_ship',
        limit: 50
    });

    const shipments = data?.results || [];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ready_to_ship':
            case 'handling':
            case 'pending':
                return "bg-warning/10 text-warning border-warning/20";
            case 'shipped':
                return "bg-info/10 text-info border-info/20";
            case 'delivered':
                return "bg-success/10 text-success border-success/20";
            case 'cancelled':
                return "bg-destructive/10 text-destructive border-destructive/20";
            default:
                return "bg-muted/20 text-muted-foreground border-border/40";
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            ready_to_ship: 'Pronto para envio',
            handling: 'Preparando',
            pending: 'Pendente',
            shipped: 'Enviado',
            delivered: 'Entregue',
            cancelled: 'Cancelado',
            not_delivered: 'Não entregue',
        };
        return labels[status] || status;
    };

    if (isLoading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Envios do Dia
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (shipments.length === 0) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Envios do Dia
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                            <Truck className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-muted-foreground font-medium">Nenhum envio pendente encontrado</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Envios do Dia
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono">
                        {shipments.length}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
                    {shipments.map((shipment) => (
                        <div key={shipment.id} className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                            #{shipment.id}
                                        </span>
                                        <Badge variant="outline" className={`text-xs ${getStatusColor(shipment.status)}`}>
                                            {getStatusLabel(shipment.status)}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        {shipment.shipping_items?.[0]?.description || "Produto não identificado"}
                                        {shipment.shipping_items?.length > 1 && ` +${shipment.shipping_items.length - 1} outros`}
                                    </div>
                                </div>
                                <div className="text-right">
                                     <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        {shipment.mode === 'me2' ? 'Mercado Envios' : shipment.mode}
                                    </div>
                                    {shipment.substatus && (
                                         <span className="text-[10px] text-muted-foreground block mt-1">
                                            {shipment.substatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                                <div className="flex items-center gap-3">
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Criado: </span>
                                        <span className="font-medium">
                                            {shipment.date_created ? format(parseISO(shipment.date_created), "dd/MM HH:mm") : "-"}
                                        </span>
                                    </div>
                                </div>
                                
                                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                                    <a 
                                        href={`https://www.mercadolivre.com.br/vendas/${shipment.order_id || ''}/detalhe`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1"
                                    >
                                        Ver pedido
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

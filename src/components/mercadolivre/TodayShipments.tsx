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
                return "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
            case 'shipped':
                return "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
            case 'delivered':
                return "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
            case 'cancelled':
                return "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
            default:
                return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700";
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
                        <Truck className="h-4 w-4 text-blue-500" />
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
                        <Truck className="h-4 w-4 text-blue-500" />
                        Envios do Dia
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                            <Truck className="h-6 w-6 text-blue-500" />
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
                        <Truck className="h-4 w-4 text-blue-500" />
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

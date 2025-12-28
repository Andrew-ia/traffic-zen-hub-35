import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ChevronRight, ChevronLeft, Clock, Box, Calendar as CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentActivityProps {
    orders: any[];
    loading?: boolean;
    date?: Date;
    onDateChange?: (date: Date | undefined) => void;
}

export function RecentActivity({ orders, loading, date, onDateChange }: RecentActivityProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        setCurrentPage(1);
    }, [date, orders]);

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
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-[#3483FA]" />
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
                    <Badge variant="secondary" className="bg-[#3483FA]/10 text-[#3483FA] border-none px-2.5 py-0.5 font-bold uppercase text-[10px]">
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
                            const status = order.status === 'paid' ? 'PAGO' : order.status;

                            return (
                                <div key={order.id} className="p-5 hover:bg-muted/10 transition-all cursor-pointer flex items-center gap-4 group/item">
                                    <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden relative group-hover/item:ring-2 ring-[#3483FA]/20 transition-all">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <ShoppingBag className="h-5 w-5 text-muted-foreground group-hover/item:text-[#3483FA] transition-colors" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate text-foreground/90" title={title}>{title}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className="text-sm font-black text-[#3483FA]">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalAmount)}
                                            </p>
                                            {order.netIncome !== undefined && (
                                                <p className="text-[10px] font-bold text-green-600 dark:text-green-400" title={`Taxas: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.saleFee || 0)} | Envio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.shippingCost || 0)}`}>
                                                    Lucro: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.netIncome)}
                                                </p>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md shrink-0">
                                                <Box className="h-3 w-3 text-muted-foreground" />
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {quantity} {quantity === 1 ? 'un' : 'uns'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Clock className="h-3 w-3 text-muted-foreground/70" />
                                                <p className="text-[10px] text-muted-foreground font-medium">
                                                    {order.dateCreated ? new Date(order.dateCreated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="text-right">
                                            <Badge className="text-[9px] h-4 bg-muted text-muted-foreground border-none font-black uppercase px-1.5">
                                                {status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                                </div>
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
    );
}

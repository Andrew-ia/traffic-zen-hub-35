import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    MessageCircle,
    Truck,
    AlertCircle,
    CheckCircle2,
    Clock,
    ArrowRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatusHubProps {
    questions: any;
    shipments: any;
    loading?: boolean;
    asColumns?: boolean;
}

export function StatusHub({ questions, shipments: shipmentsData, loading, asColumns = false }: StatusHubProps) {
    if (loading) {
        return <Skeleton className="h-[400px] w-full rounded-3xl" />;
    }

    const shipments = shipmentsData?.results || [];
    const total = shipmentsData?.paging?.total || shipments.length;
    const pending = shipments.filter((s: any) => s.status === 'pending' || s.status === 'handling').length;
    const readyToShip = shipments.filter((s: any) => s.status === 'ready_to_ship').length;
    const delayed = shipments.filter((s: any) =>
        s.substatus?.toLowerCase().includes('delayed') ||
        s.substatus?.toLowerCase().includes('atrasado')
    ).length;

    // Calcula se há coletas pendentes (logistic_type: cross_docking ou xd_drop_off e pronto para envio)
    const coletaPendente = shipments.filter((s: any) =>
        (s.logistic_type === 'cross_docking' || s.logistic_type === 'xd_drop_off') &&
        s.status === 'ready_to_ship'
    ).length;

    // Contagem de Normal vs Full
    const fullShipments = shipments.filter((s: any) => s.logistic_type === 'fulfillment').length;
    const normalShipments = shipments.filter((s: any) => s.logistic_type !== 'fulfillment').length;

    const openMLQuestions = () => {
        window.open('https://www.mercadolivre.com.br/questions/seller', '_blank');
    };

    const openMLMessages = () => {
        window.open('https://www.mercadolivre.com.br/messaging/v2/seller/orders', '_blank');
    };

    const questionsCard = (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 bg-muted/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    SAC & Perguntas
                </CardTitle>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-2.5 py-0.5">
                    {questions?.unanswered || 0} Pendentes
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/10">
                    {questions?.items?.length > 0 ? (
                        questions.items.slice(0, 4).map((q: any) => (
                            <div key={q.id} className="p-4 hover:bg-muted/10 transition-colors flex items-start gap-3 cursor-pointer" onClick={openMLQuestions}>
                                <div className="mt-1">
                                    {q.answered ? (
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                    ) : (
                                        <Clock className="h-4 w-4 text-warning animate-pulse" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium line-clamp-2 leading-relaxed">
                                        {q.text}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1.5 font-semibold">
                                        {q.date} • {q.item_id || 'Anúncio'}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" className="shrink-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            Nenhuma pergunta pendente
                        </div>
                    )}
                </div>
                <div className="p-4 bg-muted/5">
                    <Button
                        variant="ghost"
                        className="w-full text-xs font-bold text-muted-foreground hover:text-primary"
                        onClick={openMLQuestions}
                    >
                        Ver Todas as Perguntas
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    const shipmentsCard = (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 bg-muted/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Logística & Envios
                </CardTitle>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-2.5 py-0.5">
                    {total} Hoje
                </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/20 flex flex-col items-center text-center gap-1 hover:border-primary/30 transition-colors">
                        <Clock className="h-5 w-5 text-warning mb-1" />
                        <span className="text-2xl font-black">{pending}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preparando</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/20 flex flex-col items-center text-center gap-1 hover:border-primary/30 transition-colors" onClick={openMLMessages} style={{ cursor: 'pointer' }}>
                        <CheckCircle2 className="h-5 w-5 text-success mb-1" />
                        <span className="text-2xl font-black">{readyToShip}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pronto Envio</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2 border-t border-border/10 border-b border-border/10">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Normal</span>
                        <span className="text-lg font-black">{normalShipments}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-0.5 border-l border-border/10">
                        <span className="text-xs font-bold text-success uppercase tracking-widest flex items-center gap-1">Full ⚡️</span>
                        <span className="text-lg font-black">{fullShipments}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Alertas Rápidos</h4>
                    <div className="flex flex-wrap gap-2">
                        {delayed > 0 && (
                            <Badge variant="outline" className="rounded-lg py-1 px-3 border-destructive/30 bg-destructive/10 text-destructive text-[10px] font-bold flex gap-2">
                                <AlertCircle className="h-3 w-3" /> {delayed} {delayed === 1 ? 'Atraso' : 'Atrasos'}
                            </Badge>
                        )}
                        {coletaPendente > 0 && (
                            <Badge variant="outline" className="rounded-lg py-1 px-3 border-warning/30 bg-warning/10 text-warning text-[10px] font-bold flex gap-2">
                                <Truck className="h-3 w-3" /> {coletaPendente} {coletaPendente === 1 ? 'Coleta Pendente' : 'Coletas Pendentes'}
                            </Badge>
                        )}
                        <Badge
                            variant="outline"
                            className="rounded-lg py-1 px-3 border-muted-foreground/20 bg-muted/5 text-muted-foreground text-[10px] font-bold flex gap-2 cursor-pointer hover:bg-muted/10"
                            onClick={openMLMessages}
                        >
                            <ArrowRight className="h-3 w-3" /> Ver Mensagens
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (asColumns) {
        return (
            <>
                {questionsCard}
                {shipmentsCard}
            </>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {questionsCard}
            {shipmentsCard}
        </div>
    );
}

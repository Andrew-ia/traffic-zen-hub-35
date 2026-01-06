import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { MercadoLivreQuestion } from "@/hooks/useMercadoLivre";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MercadoLivreQuestionsListProps {
    questions: MercadoLivreQuestion[];
    loading: boolean;
    totalUnanswered: number;
}

export function MercadoLivreQuestionsList({ 
    questions, 
    loading,
    totalUnanswered 
}: MercadoLivreQuestionsListProps) {
    if (loading) {
        return (
            <Card className="h-full border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="space-y-4 p-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col gap-2 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const recentQuestions = questions.slice(0, 10); // Show last 10

    return (
        <Card className="h-full border-border/50 shadow-sm flex flex-col">
            <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        Perguntas Recentes
                    </CardTitle>
                    {totalUnanswered > 0 && (
                        <Badge variant="destructive" className="h-6 px-2">
                            {totalUnanswered} pendente{totalUnanswered > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-[300px]">
                <ScrollArea className="h-[400px]">
                    {recentQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-6">
                            <MessageCircle className="h-8 w-8 mb-2 opacity-20" />
                            <p>Nenhuma pergunta recente encontrada.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {recentQuestions.map((q) => (
                                <div key={q.id} className="p-4 hover:bg-muted/5 transition-colors">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground line-clamp-1" title={q.productTitle}>
                                                {q.productTitle}
                                            </p>
                                            <p className="text-sm font-medium text-foreground">
                                                "{q.text}"
                                            </p>
                                        </div>
                                        <Badge 
                                            variant={q.answered ? "outline" : "default"}
                                            className={q.answered ? "text-success border-success/30 bg-success/10" : "bg-warning/10 hover:bg-warning/20 text-warning border border-warning/20"}
                                        >
                                            {q.answered ? (
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                            ) : (
                                                <AlertCircle className="h-3 w-3 mr-1" />
                                            )}
                                            {q.answered ? "Respondida" : "Pendente"}
                                        </Badge>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-muted-foreground">
                                            {q.date}
                                        </span>
                                        <a 
                                            href={`https://questions.mercadolivre.com.br/question/${q.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
                                        >
                                            Responder
                                            <MessageCircle className="h-3 w-3" />
                                        </a>
                                    </div>
                                    
                                    {q.answered && q.answer && (
                                        <div className="mt-2 bg-muted/30 p-2 rounded-md border border-border/30">
                                            <p className="text-xs text-muted-foreground italic">
                                                <span className="font-medium not-italic mr-1">Resposta:</span> 
                                                {q.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

import { useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
    type MercadoLivreQuestion,
    useAnswerMercadoLivreQuestion,
} from "@/hooks/useMercadoLivre";
import {
    ExternalLink,
    MessageCircle,
    Send,
    Sparkles,
} from "lucide-react";

interface QuickReplyQuestionsProps {
    workspaceId: string | null;
    questions: MercadoLivreQuestion[];
    totalUnanswered: number;
    loading?: boolean;
}

const TEMPLATES = [
    {
        id: "envio",
        label: "Prazo de envio",
        text: "Olá! Enviamos em até 24h úteis após a compra e você recebe o código de rastreio automaticamente. 😊",
    },
    {
        id: "material",
        label: "Material & qualidade",
        text: "Olá! A peça é de bijuteria premium com acabamento antialérgico e ótima durabilidade. Com cuidados básicos ela mantém o brilho por muito mais tempo.",
    },
    {
        id: "tamanho",
        label: "Tamanho/ajuste",
        text: "Olá! As medidas estão na descrição do anúncio. Se quiser, me diga a dúvida exata (tamanho/diâmetro) que confirmo para você.",
    },
    {
        id: "garantia",
        label: "Garantia e troca",
        text: "Olá! Garantia de 30 dias contra defeitos. Qualquer problema é só nos chamar por aqui que resolvemos rápido.",
    },
    {
        id: "conteudo",
        label: "Conteúdo da embalagem",
        text: "Olá! A embalagem inclui 1 unidade do produto e vai pronta para presente. ✨",
    },
];

export function QuickReplyQuestions({
    workspaceId,
    questions,
    totalUnanswered,
    loading,
}: QuickReplyQuestionsProps) {
    const { toast } = useToast();
    const answerMutation = useAnswerMercadoLivreQuestion();
    const [activeQuestion, setActiveQuestion] = useState<MercadoLivreQuestion | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [draftAnswer, setDraftAnswer] = useState<string>("");

    const unanswered = useMemo(
        () => questions.filter((q) => !q.answered),
        [questions]
    );

    const visibleQuestions = unanswered.slice(0, 6);

    const resetDialog = () => {
        setSelectedTemplate("");
        setDraftAnswer("");
        setActiveQuestion(null);
    };

    const handleTemplateChange = (value: string) => {
        setSelectedTemplate(value);
        const template = TEMPLATES.find((t) => t.id === value);
        setDraftAnswer(template?.text || "");
    };

    const handleSend = async () => {
        if (!activeQuestion || !workspaceId) return;
        if (!draftAnswer.trim()) {
            toast({
                title: "Resposta vazia",
                description: "Escreva ou selecione um template antes de enviar.",
                variant: "destructive",
            });
            return;
        }

        try {
            await answerMutation.mutateAsync({
                workspaceId,
                questionId: activeQuestion.id,
                answer: draftAnswer.trim(),
            });
            toast({
                title: "Resposta enviada",
                description: "O cliente já recebeu sua resposta.",
            });
            resetDialog();
        } catch (err: any) {
            toast({
                title: "Falha ao responder",
                description: err?.message || "Não foi possível enviar a resposta.",
                variant: "destructive",
            });
        }
    };

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        Respostas Rápidas
                    </CardTitle>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-2.5 py-0.5">
                        {totalUnanswered} pendentes
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {loading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                        ))}
                    </div>
                )}

                {!loading && visibleQuestions.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-6">
                        Nenhuma pergunta pendente hoje.
                    </div>
                )}

                {!loading && visibleQuestions.length > 0 && (
                    <div className="space-y-3">
                        {visibleQuestions.map((question) => (
                            <div
                                key={question.id}
                                className="rounded-2xl border border-border/20 bg-background/40 p-4 space-y-2"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold line-clamp-2">"{question.text}"</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                            {question.productTitle} • {question.date}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="rounded-full"
                                        onClick={() => setActiveQuestion(question)}
                                    >
                                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                                        Responder
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <ExternalLink className="h-3 w-3" />
                                    <button
                                        type="button"
                                        className="hover:text-primary"
                                        onClick={() => window.open(`https://questions.mercadolivre.com.br/question/${question.id}`, "_blank")}
                                    >
                                        Abrir no Mercado Livre
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={Boolean(activeQuestion)} onOpenChange={(open) => !open && resetDialog()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Responder pergunta</DialogTitle>
                        <DialogDescription>
                            {activeQuestion ? (
                                <span>
                                    {activeQuestion.productTitle} • {activeQuestion.date}
                                </span>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-lg bg-muted/30 p-3 text-sm text-foreground/80">
                            {activeQuestion?.text}
                        </div>

                        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Escolher template de resposta" />
                            </SelectTrigger>
                            <SelectContent>
                                {TEMPLATES.map((template) => (
                                    <SelectItem key={template.id} value={template.id}>
                                        {template.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Textarea
                            value={draftAnswer}
                            onChange={(event) => setDraftAnswer(event.target.value)}
                            placeholder="Escreva sua resposta..."
                            className="min-h-[140px]"
                        />
                    </div>

                    <DialogFooter className="flex items-center justify-between gap-3">
                        <Button
                            variant="outline"
                            onClick={() => resetDialog()}
                            disabled={answerMutation.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSend} disabled={answerMutation.isPending}>
                            {answerMutation.isPending ? "Enviando..." : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Enviar resposta
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

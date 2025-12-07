import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, MessageCircle, Send, Check, X, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface TelegramSettings {
    id: string;
    platform: string;
    enabled: boolean;
    config: {
        bot_token: string;
        chat_id: string;
    };
    created_at: string;
    updated_at: string;
}

export default function Notifications() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [botToken, setBotToken] = useState("");
    const [chatId, setChatId] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Buscar configurações
    const { data: settings, isLoading } = useQuery({
        queryKey: ["notification-settings", workspaceId],
        queryFn: async () => {
            if (!workspaceId) throw new Error("Workspace não selecionado");

            const response = await fetch(
                `/api/notification-settings?workspaceId=${workspaceId}&platform=telegram`
            );

            if (!response.ok) throw new Error("Erro ao buscar configurações");

            const data = await response.json();
            return data.settings[0] as TelegramSettings | undefined;
        },
        enabled: !!workspaceId,
    });

    // Mutation para salvar configuração
    const saveMutation = useMutation({
        mutationFn: async (data: { botToken: string; chatId: string; enabled: boolean }) => {
            if (!workspaceId) throw new Error("Workspace não selecionado");

            const response = await fetch("/api/notification-settings/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    botToken: data.botToken,
                    chatId: data.chatId,
                    enabled: data.enabled,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || "Erro ao salvar configuração");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-settings", workspaceId] });
            toast({
                title: "Configuração salva!",
                description: "Uma mensagem de teste foi enviada para o seu Telegram.",
            });
            setIsEditing(false);
            setBotToken("");
            setChatId("");
        },
        onError: (error: Error) => {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Mutation para toggle enabled
    const toggleMutation = useMutation({
        mutationFn: async (enabled: boolean) => {
            if (!workspaceId) throw new Error("Workspace não selecionado");

            const response = await fetch("/api/notification-settings/telegram/toggle", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId, enabled }),
            });

            if (!response.ok) throw new Error("Erro ao alterar status");
            return response.json();
        },
        onSuccess: (_, enabled) => {
            queryClient.invalidateQueries({ queryKey: ["notification-settings", workspaceId] });
            toast({
                title: enabled ? "Notificações ativadas" : "Notificações desativadas",
                description: enabled
                    ? "Você receberá notificações no Telegram"
                    : "Notificações pausadas temporariamente",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Mutation para testar
    const testMutation = useMutation({
        mutationFn: async () => {
            if (!workspaceId) throw new Error("Workspace não selecionado");

            const response = await fetch("/api/notification-settings/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId, platform: "telegram" }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Erro ao enviar teste");
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Teste enviado!",
                description: "Verifique seu Telegram para confirmar o recebimento.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Erro no teste",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSave = () => {
        if (!botToken || !chatId) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha o Bot Token e Chat ID",
                variant: "destructive",
            });
            return;
        }

        saveMutation.mutate({ botToken, chatId, enabled: true });
    };

    if (!workspaceId) {
        return (
            <div className="p-8">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Workspace não selecionado</AlertTitle>
                    <AlertDescription>Selecione um workspace para configurar notificações.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Bell className="h-8 w-8" />
                    Notificações
                </h1>
                <p className="text-muted-foreground mt-2">
                    Configure notificações em tempo real para ficar por dentro de tudo que acontece no Mercado Livre
                </p>
            </div>

            {/* Telegram Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <CardTitle>Telegram</CardTitle>
                                <CardDescription>Receba notificações instantâneas no Telegram</CardDescription>
                            </div>
                        </div>
                        {settings && (
                            <div className="flex items-center gap-3">
                                <Badge variant={settings.enabled ? "default" : "secondary"}>
                                    {settings.enabled ? "Ativo" : "Inativo"}
                                </Badge>
                                <Switch
                                    checked={settings.enabled}
                                    onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                                    disabled={toggleMutation.isPending}
                                />
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : settings && !isEditing ? (
                        <>
                            {/* Configuração existente */}
                            <Alert>
                                <Check className="h-4 w-4" />
                                <AlertTitle>Configuração ativa</AlertTitle>
                                <AlertDescription>
                                    Suas notificações Telegram estão configuradas e funcionando.
                                    <br />
                                    <strong>Chat ID:</strong> {settings.config.chat_id}
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-2">
                                <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                                    <Send className="h-4 w-4 mr-2" />
                                    {testMutation.isPending ? "Enviando..." : "Enviar Teste"}
                                </Button>
                                <Button variant="outline" onClick={() => setIsEditing(true)}>
                                    Reconfigurar
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Formulário de configuração */}
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Como configurar</AlertTitle>
                                <AlertDescription className="space-y-2">
                                    <p>1. Abra o Telegram e busque por <strong>@BotFather</strong></p>
                                    <p>2. Envie <code className="bg-muted px-1 rounded">/newbot</code> e siga as instruções</p>
                                    <p>3. Copie o <strong>Bot Token</strong> fornecido</p>
                                    <p>4. Abra seu bot e envie <code className="bg-muted px-1 rounded">/start</code></p>
                                    <p>5. Busque por <strong>@userinfobot</strong> para obter seu <strong>Chat ID</strong></p>
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="botToken">Bot Token</Label>
                                    <Input
                                        id="botToken"
                                        type="password"
                                        placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                                        value={botToken}
                                        onChange={(e) => setBotToken(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Token fornecido pelo @BotFather
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="chatId">Chat ID</Label>
                                    <Input
                                        id="chatId"
                                        placeholder="123456789"
                                        value={chatId}
                                        onChange={(e) => setChatId(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Seu ID de usuário do Telegram (obtenha com @userinfobot)
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={saveMutation.isPending}
                                >
                                    {saveMutation.isPending ? "Salvando..." : "Salvar e Testar"}
                                </Button>
                                {isEditing && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setBotToken("");
                                            setChatId("");
                                        }}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Tipos de notificação */}
            <Card>
                <CardHeader>
                    <CardTitle>O que você receberá</CardTitle>
                    <CardDescription>Notificações em tempo real sobre eventos importantes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        <div className="flex items-start gap-3 p-4 border rounded-lg">
                            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Novas Vendas</h3>
                                <p className="text-sm text-muted-foreground">
                                    Receba alerta instantâneo sempre que um pedido for criado, com detalhes completos da venda
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 border rounded-lg">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Novas Perguntas</h3>
                                <p className="text-sm text-muted-foreground">
                                    Seja notificado quando clientes fizerem perguntas em seus produtos
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

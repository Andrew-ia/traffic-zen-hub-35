import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function MercadoLivreCallback() {
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [tokens, setTokens] = useState<{
        accessToken?: string;
        refreshToken?: string;
        userId?: string;
    }>({});
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;

        const code = searchParams.get("code");
        const state = searchParams.get("state"); // workspace ID
        const error = searchParams.get("error");

        if (error) {
            setStatus("error");
            setMessage(`Erro na autenticação: ${error}`);
            return;
        }

        if (!code || !state) {
            setStatus("error");
            setMessage("Código de autorização ou workspace ID não encontrado");
            return;
        }

        hasFetched.current = true;
        setWorkspaceId(state);
        // Trocar código por tokens
        exchangeCodeForTokens(code, state);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const runPostAuthSync = async (workspaceId: string) => {
        setSyncing(true);
        try {
            const authToken = localStorage.getItem("token");
            await fetch("/api/integrations/mercadolivre/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({ workspaceId }),
            });
            await queryClient.invalidateQueries({ queryKey: ["mercadolivre"] });
        } catch (error) {
            console.warn("Falha ao disparar sync pós-auth do Mercado Livre:", error);
        } finally {
            setSyncing(false);
        }
    };

    const exchangeCodeForTokens = async (code: string, workspaceId: string) => {
        try {
            const redirectUri = `${window.location.origin}${window.location.pathname}`;
            const response = await fetch("/api/integrations/mercadolivre/auth/callback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code, workspaceId, redirectUri }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStatus("success");
                setMessage("Autenticado! Aplicando credenciais e sincronizando dados...");
                setTokens({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    userId: data.userId,
                });
                await runPostAuthSync(workspaceId);
                setMessage("Tokens aplicados. Dados do Mercado Livre serão atualizados em instantes.");
            } else {
                setStatus("error");
                setMessage(data.error || "Erro ao processar autenticação");
            }
        } catch (error: any) {
            setStatus("error");
            setMessage(`Erro na comunicação com o servidor: ${error.message}`);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="w-full px-4 md:px-6 py-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
                        {status === "success" && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                        {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
                        Autenticação Mercado Livre
                    </CardTitle>
                    <CardDescription>
                        {status === "loading" && "Processando autenticação..."}
                        {status === "success" && "Autenticação concluída com sucesso!"}
                        {status === "error" && "Ocorreu um erro na autenticação"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant={status === "error" ? "destructive" : "default"}>
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>

                    {status === "success" && tokens.accessToken && (
                        <div className="space-y-4 mt-6">
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                <h3 className="font-semibold mb-3 text-sm text-slate-700 dark:text-slate-300">
                                    📝 Adicione estas variáveis ao seu arquivo .env.local:
                                </h3>

                                <div className="space-y-2 font-mono text-xs">
                                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded border">
                                        <code className="flex-1 overflow-x-auto">
                                            MERCADO_LIVRE_ACCESS_TOKEN={tokens.accessToken}
                                        </code>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(`MERCADO_LIVRE_ACCESS_TOKEN=${tokens.accessToken}`)}
                                        >
                                            Copiar
                                        </Button>
                                    </div>

                                    {tokens.refreshToken && (
                                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded border">
                                            <code className="flex-1 overflow-x-auto">
                                                MERCADO_LIVRE_REFRESH_TOKEN={tokens.refreshToken}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => copyToClipboard(`MERCADO_LIVRE_REFRESH_TOKEN=${tokens.refreshToken}`)}
                                            >
                                                Copiar
                                            </Button>
                                        </div>
                                    )}

                                    {tokens.userId && (
                                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded border">
                                            <code className="flex-1 overflow-x-auto">
                                                MERCADO_LIVRE_USER_ID={tokens.userId}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => copyToClipboard(`MERCADO_LIVRE_USER_ID=${tokens.userId}`)}
                                            >
                                                Copiar
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-4">
                                    Sincronizamos automaticamente para o workspace selecionado. Você pode continuar sem atualizar o .env.local no ambiente atual.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={() => navigate("/")} className="flex-1" disabled={syncing}>
                                    {syncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    Ir para Mercado Livre
                                </Button>
                                <Button onClick={() => navigate("/integrations")} variant="outline" className="flex-1">
                                    Voltar para Integrações
                                </Button>
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex gap-2 mt-4">
                            <Button onClick={() => navigate("/integrations")} className="flex-1">
                                Voltar para Integrações
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
                                Tentar Novamente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

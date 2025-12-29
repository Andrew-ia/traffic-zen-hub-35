import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrayCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        const stateParam = searchParams.get("state");
        const error = searchParams.get("error");
        const error_description = searchParams.get("error_description");

        // Tenta recuperar api_url dos parametros ou do state decodificado
        let storeUrl = searchParams.get("api_url") || searchParams.get("store");
        let workspaceId = stateParam;

        try {
             if (stateParam) {
                // Tenta decodificar base64
                const decoded = atob(stateParam);
                // Tenta parsear JSON
                if (decoded.startsWith("{")) {
                    const parsed = JSON.parse(decoded);
                    if (parsed.workspaceId) {
                        workspaceId = parsed.workspaceId;
                        if (parsed.storeUrl && !storeUrl) {
                            storeUrl = parsed.storeUrl;
                        }
                    }
                }
             }
        } catch (e) {
            // Se falhar, assume que state é apenas o workspaceId
            console.warn("State não é um JSON base64 válido, usando como string simples");
        }

        if (error) {
            setStatus("error");
            setMessage(`Erro na autenticação: ${error_description || error}`);
            return;
        }

        if (!code || !storeUrl || !workspaceId) {
            setStatus("error");
            setMessage("Código, URL da loja ou workspace ID não encontrado");
            return;
        }

        exchangeCodeForTokens(code, storeUrl, workspaceId);
    }, [searchParams]);

    const exchangeCodeForTokens = async (code: string, storeUrl: string, workspaceId: string) => {
        try {
            const response = await fetch("/api/integrations/tray/auth/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, storeUrl, workspaceId }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus("success");
                setMessage("Integração com Tray realizada com sucesso!");
                // Redireciona para a página de integrações ou dashboard da Tray
                setTimeout(() => navigate("/tray"), 3000); 
            } else {
                setStatus("error");
                setMessage(data.error || "Erro ao processar autenticação");
            }
        } catch (error: any) {
            setStatus("error");
            setMessage(`Erro na comunicação com o servidor: ${error.message}`);
        }
    };

    return (
        <div className="container flex items-center justify-center min-h-screen py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Integração Tray</CardTitle>
                    <CardDescription>Processando autenticação...</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === "loading" && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-muted-foreground">{message || "Aguarde..."}</p>
                        </div>
                    )}
                    {status === "success" && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                            <p className="text-center font-medium">{message}</p>
                            <Button onClick={() => navigate("/tray")}>Ir para Dashboard</Button>
                        </div>
                    )}
                    {status === "error" && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <p className="text-center font-medium text-destructive">{message}</p>
                            <Button onClick={() => navigate("/tray")}>Voltar</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

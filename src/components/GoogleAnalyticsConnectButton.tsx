import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

interface GoogleAnalyticsConnectButtonProps {
    size?: "default" | "sm" | "lg" | "icon";
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export default function GoogleAnalyticsConnectButton({
    size = "default",
    variant = "default"
}: GoogleAnalyticsConnectButtonProps) {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleConnect = async () => {
        if (!currentWorkspace?.id) {
            toast({
                title: "Erro",
                description: "Selecione um workspace para conectar o Google Analytics",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);

            // Chamar endpoint de autenticação OAuth do Google Analytics
            const response = await fetch(`${API_BASE}/api/integrations/google-analytics/auth-url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workspaceId: currentWorkspace.id,
                }),
            });

            if (!response.ok) {
                throw new Error("Não foi possível gerar URL de autenticação");
            }

            const data = await response.json();

            if (data.authUrl) {
                // Redirecionar para página de autorização do Google
                window.location.href = data.authUrl;
            } else {
                throw new Error("URL de autenticação não foi retornada");
            }
        } catch (error: any) {
            console.error("Error connecting to Google Analytics:", error);
            toast({
                title: "Erro ao conectar",
                description: error.message || "Não foi possível conectar ao Google Analytics",
                variant: "destructive",
            });
            setIsLoading(false);
        }
    };

    return (
        <Button
            onClick={handleConnect}
            disabled={isLoading || !currentWorkspace?.id}
            size={size}
            variant={variant}
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                </>
            ) : (
                <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Conectar Google Analytics
                </>
            )}
        </Button>
    );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FullscreenLoader from "@/components/ui/fullscreen-loader";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

interface GoogleAdsSyncButtonProps {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    days?: number;
}

export default function GoogleAdsSyncButton({
    variant = "outline",
    size = "default",
    className = "",
    days = 7,
}: GoogleAdsSyncButtonProps) {
    const [syncing, setSyncing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [currentStage, setCurrentStage] = useState(0);
    const { toast } = useToast();

    const syncStages = [
        "Conectando com Google Ads API",
        "Buscando contas de anúncios",
        "Sincronizando campanhas",
        "Processando grupos e anúncios",
        "Coletando métricas de performance",
        "Finalizando sincronização",
    ];

    const handleGoogleSync = async () => {
        if (syncing) return;
        const workspaceId = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

        if (!workspaceId) {
            toast({
                title: "Configuração ausente",
                description: "Defina VITE_WORKSPACE_ID para usar a sincronização.",
                variant: "destructive",
            });
            return;
        }

        try {
            setSyncing(true);
            setCurrentStage(0);
            setStatusMessage(`Preparando sincronização (${days} dias)...`);
            setProgress(0);

            const response = await fetch(`${API_BASE}/api/google-ads/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ workspaceId, days }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                const msg = payload?.error || `Falha ao sincronizar: ${response.statusText}`;
                throw new Error(msg);
            }

            toast({ title: "Sincronização iniciada", description: `Buscando dados dos últimos ${days} dias.` });
            setCurrentStage(1);
            setStatusMessage("Conectando com Google Ads API...");
            setProgress(30);

            setTimeout(() => {
                setProgress(100);
                setCurrentStage(syncStages.length - 1);
                setStatusMessage("Sincronização concluída");
                setTimeout(() => {
                    setSyncing(false);
                    setStatusMessage(null);
                    setProgress(null);
                    setCurrentStage(0);
                }, 800);
            }, 1200);
        } catch (error) {
            setSyncing(false);
            toast({ title: "Erro na sincronização", description: error instanceof Error ? error.message : "Não foi possível iniciar a sincronização.", variant: "destructive" });
        }
    };

    return (
        <>
            {syncing && (
                <FullscreenLoader
                    title="Sincronizando Google Ads"
                    subtitle={statusMessage ?? `Buscando últimos ${days} dias`}
                    progress={progress}
                    stages={syncStages}
                    currentStage={currentStage}
                />
            )}
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={handleGoogleSync}
                disabled={syncing}
            >
                {syncing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                    </>
                ) : (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sincronizar Google
                    </>
                )}
            </Button>
        </>
    );
}

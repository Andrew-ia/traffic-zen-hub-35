import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FullscreenLoader from "@/components/ui/fullscreen-loader";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

const formatNumber = (value?: number | null) =>
    new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));

const formatCurrency = (value?: number | null, currency?: string) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));

interface GoogleAdsSyncButtonProps {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    days?: number;
    workspaceId?: string | null;
}

export default function GoogleAdsSyncButton({
    variant = "outline",
    size = "default",
    className = "",
    days = 7,
    workspaceId,
}: GoogleAdsSyncButtonProps) {
    const [syncing, setSyncing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [currentStage, setCurrentStage] = useState(0);
    const { toast } = useToast();

    const syncStages = [
        "Preparando requisição",
        "Consultando API do Google",
        "Salvando métricas no Supabase",
        "Sincronização concluída",
    ];

    const handleGoogleSync = async () => {
        if (syncing) return;
        const resolvedWorkspace = workspaceId || (import.meta.env.VITE_WORKSPACE_ID as string | undefined);

        if (!resolvedWorkspace) {
            toast({
                title: "Configuração ausente",
                description: "Selecione um workspace ou defina VITE_WORKSPACE_ID para usar a sincronização.",
                variant: "destructive",
            });
            return;
        }

        try {
            setSyncing(true);
            setCurrentStage(0);
            setStatusMessage(`Preparando sincronização (${days} dias)...`);
            setProgress(5);

            const response = await fetch(`${API_BASE}/api/google-ads/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ workspaceId: resolvedWorkspace, days }),
            });

            setCurrentStage(1);
            setStatusMessage("Consultando API do Google Ads...");
            setProgress(35);

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                const msg = payload?.error || `Falha ao sincronizar: ${response.statusText}`;
                throw new Error(msg);
            }

            if (payload?.needsAuth) {
                throw new Error(payload?.error || "Conclua a autenticação do Google Ads para sincronizar.");
            }

            setCurrentStage(2);
            setStatusMessage("Processando e salvando métricas...");
            setProgress(70);

            const summary = payload?.data?.summary;
            const persisted = payload?.data?.persisted;
            const accountName = payload?.data?.account?.name as string | undefined;

            setCurrentStage(syncStages.length - 1);
            setProgress(100);
            setStatusMessage(summary
                ? `Concluído: ${formatNumber(summary.clicks)} cliques • ${formatCurrency(summary.cost, summary.currency)}`
                : "Sincronização concluída");

            const descriptionParts: string[] = [];
            if (summary) {
                descriptionParts.push(`${formatCurrency(summary.cost, summary.currency)} em ${formatNumber(summary.clicks)} cliques (${formatNumber(summary.impressions)} impr.)`);
            }
            if (persisted) {
                descriptionParts.push(`Linhas atualizadas: ${persisted.adsSpendRows ?? 0} spend / ${persisted.performanceRows ?? 0} métricas`);
            }

            toast({
                title: accountName ? `Google Ads (${accountName}) sincronizado` : "Google Ads sincronizado",
                description: descriptionParts.join(" · ") || `Dados dos últimos ${days} dias sincronizados.`,
            });

            setTimeout(() => {
                setSyncing(false);
                setStatusMessage(null);
                setProgress(null);
                setCurrentStage(0);
            }, 900);
        } catch (error) {
            setSyncing(false);
            setStatusMessage(null);
            setProgress(null);
            setCurrentStage(0);

            toast({
                title: "Erro na sincronização",
                description: error instanceof Error ? error.message : "Não foi possível iniciar a sincronização.",
                variant: "destructive",
            });
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

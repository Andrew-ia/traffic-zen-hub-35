import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FullscreenLoader from "@/components/ui/fullscreen-loader";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

interface MetaSyncButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  days?: number;
}

export default function MetaSyncButton({
  variant = "outline",
  size = "default",
  className = "",
  days = 7,
}: MetaSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { toast } = useToast();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const clearPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    const workspaceId = import.meta.env.VITE_WORKSPACE_ID;

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
      setStatusMessage(`Preparando sincronização (${days} dias)...`);
      setProgress(null);

      try {
        const health = await fetch(`${API_BASE}/health`, { headers: { Accept: 'application/json' } });
        if (!health.ok) {
          throw new Error('API indisponível');
        }
      } catch (e) {
        setSyncing(false);
        setStatusMessage(null);
        toast({
          title: 'API indisponível',
          description: 'Configure VITE_API_URL no ambiente de produção apontando para sua API.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${API_BASE}/api/integrations/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          platformKey: "meta",
          days,
          type: "all",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao iniciar sincronização");
      }

      const jobId = payload?.data?.jobId;
      if (!jobId) {
        throw new Error("Resposta da API não retornou jobId");
      }

      toast({
        title: "Sincronização iniciada",
        description: `Buscando dados dos últimos ${days} dias.`,
      });

      setStatusMessage("Sincronizando dados do Meta...");

      let attempts = 0;
      const maxAttempts = 120; // 4 minutos (2s * 120)

      pollRef.current = window.setInterval(async () => {
        attempts += 1;
        if (attempts > maxAttempts) {
          clearPolling();
          setSyncing(false);
          toast({
            title: "Tempo excedido",
            description: "A sincronização está demorando. Verifique novamente em alguns minutos.",
            variant: "destructive",
          });
          return;
        }

        try {
          const statusResponse = await fetch(`${API_BASE}/api/integrations/sync/${jobId}`);
          const statusPayload = await statusResponse.json().catch(() => ({}));

          if (!statusResponse.ok) {
            throw new Error(statusPayload?.error || "Não foi possível verificar o status.");
          }

          const status = statusPayload?.data?.status;
          const pct = statusPayload?.data?.progress;
          if (typeof pct === "number") {
            setProgress(Math.max(0, Math.min(100, Math.round(pct))));
          }

          if (status === "completed") {
            clearPolling();
            setStatusMessage("Sincronização concluída. Atualizando dashboards...");
            setProgress(100);
            toast({
              title: "Sincronização concluída",
              description: "Os dados do Meta foram atualizados com sucesso.",
            });
            setTimeout(() => {
              setSyncing(false);
              setStatusMessage(null);
              setProgress(null);
            }, 1200);
          } else if (status === "failed") {
            clearPolling();
            setSyncing(false);
            setStatusMessage(null);
            setProgress(null);
            toast({
              title: "Erro na sincronização",
              description: statusPayload?.data?.error_message || "Falha ao sincronizar dados.",
              variant: "destructive",
            });
          } else {
            setStatusMessage(
              status === "processing" ? "Processando dados do Meta..." : "Sincronização em andamento..."
            );
          }
        } catch (error) {
          console.error("Erro ao verificar status da sincronização:", error);
        }
      }, 2000);
    } catch (error) {
      clearPolling();
      setSyncing(false);
      setStatusMessage(null);
      setProgress(null);
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
          title="Sincronizando Meta Ads"
          subtitle={statusMessage ?? `Buscando últimos ${days} dias`}
          progress={progress}
        />
      )}
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleSync}
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
            Sincronizar Meta
          </>
        )}
      </Button>
    </>
  );
}

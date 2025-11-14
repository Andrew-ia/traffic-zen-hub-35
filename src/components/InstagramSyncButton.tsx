import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FullscreenLoader from "@/components/ui/fullscreen-loader";
import { resolveApiBase } from "@/lib/apiBase";

const API_BASE = resolveApiBase();

interface InstagramSyncButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  days?: number;
}

export default function InstagramSyncButton({
  variant = "outline",
  size = "default",
  className = "",
  days = 7,
}: InstagramSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const { toast } = useToast();
  const pollRef = useRef<number | null>(null);

  // Define Instagram-specific sync stages
  const syncStages = [
    "Conectando com Instagram API",
    "Autenticando conta business",
    "Buscando posts e stories",
    "Coletando métricas de engajamento",
    "Processando insights de audiência",
    "Finalizando sincronização"
  ];

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

  const resetSyncState = () => {
    setSyncing(false);
    setStatusMessage(null);
    setProgress(null);
    setCurrentStage(0);
  };

  const handleSync = async () => {
    if (syncing) return;
    const workspaceId = import.meta.env.VITE_WORKSPACE_ID;

    if (!workspaceId) {
      toast({
        title: "Configuração ausente",
        description: "Defina VITE_WORKSPACE_ID para sincronizar o Instagram.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSyncing(true);
      setCurrentStage(0);
      setStatusMessage(`Preparando sincronização (${days} dias)...`);
      setProgress(0);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);
      let response: Response | null = null;
      try {
        const health = await fetch(`${API_BASE}/health`, { headers: { Accept: 'application/json' } });
        if (!health.ok) throw new Error('API indisponível');
        response = await fetch(`${API_BASE}/api/integrations/simple-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            workspaceId,
            platformKey: "instagram",
            days,
            type: "all",
          }),
          signal: controller.signal,
        });
      } catch (e) {
        window.clearTimeout(timeoutId);
        setCurrentStage(1);
        setStatusMessage('API principal indisponível. Tentando rota alternativa...');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (supabaseUrl && anonKey) {
          try {
            setCurrentStage(2);
            setStatusMessage('Usando Edge Function para sincronização...');
            setProgress(15);
            const ef = await fetch(`${supabaseUrl}/functions/v1/instagram-sync`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ days, sync_type: 'all' }),
            });
            const efPayload = await ef.json().catch(() => ({}));
            if (!ef.ok || efPayload?.success === false) {
              throw new Error(efPayload?.error || 'Falha na Edge Function');
            }
            toast({
              title: 'Sincronização iniciada (Edge Function)',
              description: `Instagram em atualização nos últimos ${days} dias.`,
            });
            setProgress(100);
            setCurrentStage(syncStages.length - 1);
            setTimeout(() => {
              resetSyncState();
            }, 1500);
            return;
          } catch (efError) {
            toast({
              title: 'API indisponível',
              description: 'Falha ao usar Edge Function também. Verifique VITE_API_URL/VITE_SUPABASE_*',
              variant: 'destructive',
            });
            resetSyncState();
            return;
          }
        }

        toast({
          title: 'API indisponível',
          description: 'Configure VITE_API_URL no ambiente de produção apontando para sua API.',
          variant: 'destructive',
        });
        resetSyncState();
        return;
      } finally {
        window.clearTimeout(timeoutId);
      }
      

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
        description: `Buscando dados do Instagram dos últimos ${days} dias.`,
      });

      setCurrentStage(1);
      setStatusMessage("Conectando com Instagram API...");
      setProgress(10);

      let attempts = 0;
      const maxAttempts = 120;

      pollRef.current = window.setInterval(async () => {
        attempts += 1;
        if (attempts > maxAttempts) {
          clearPolling();
          resetSyncState();
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
          
          // Update progress and stage based on percentage
          if (typeof pct === "number") {
            const progressValue = Math.max(0, Math.min(100, Math.round(pct)));
            setProgress(progressValue);
            
            // Update stage based on progress for Instagram-specific flow
            const stageIndex = Math.floor((progressValue / 100) * (syncStages.length - 1));
            setCurrentStage(Math.min(stageIndex, syncStages.length - 1));
            
            // Set appropriate message based on stage for Instagram
            if (progressValue < 15) {
              setStatusMessage("Conectando com Instagram API...");
            } else if (progressValue < 30) {
              setStatusMessage("Autenticando conta business...");
            } else if (progressValue < 60) {
              setStatusMessage("Buscando posts e stories...");
            } else if (progressValue < 80) {
              setStatusMessage("Coletando métricas de engajamento...");
            } else if (progressValue < 95) {
              setStatusMessage("Processando insights de audiência...");
            } else {
              setStatusMessage("Finalizando sincronização...");
            }
          }

          if (status === "completed") {
            clearPolling();
            setCurrentStage(syncStages.length - 1);
            setStatusMessage("Sincronização concluída. Atualizando dashboards...");
            setProgress(100);
            toast({
              title: "Sincronização concluída",
              description: "Os dados do Instagram foram atualizados com sucesso.",
            });
            setTimeout(() => {
              resetSyncState();
            }, 1200);
          } else if (status === "failed") {
            clearPolling();
            resetSyncState();
            toast({
              title: "Erro na sincronização",
              description: statusPayload?.data?.error_message || "Falha ao sincronizar dados.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Erro ao verificar status da sincronização do Instagram:", error);
        }
      }, 2000);
    } catch (error) {
      clearPolling();
      resetSyncState();
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
          title="Sincronizando Instagram"
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
            Sincronizar Instagram
          </>
        )}
      </Button>
    </>
  );
}

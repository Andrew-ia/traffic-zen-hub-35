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
  const [currentStage, setCurrentStage] = useState(0);
  const { toast } = useToast();
  const pollRef = useRef<number | null>(null);

  // Define the sync stages
  const syncStages = [
    "Conectando com Meta API",
    "Buscando contas de anúncios", 
    "Sincronizando campanhas",
    "Processando conjuntos de anúncios",
    "Coletando métricas de performance",
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

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);
      let response: Response | null = null;
      try {
        const health = await fetch(`${API_BASE}/health`, { headers: { Accept: 'application/json' } });
        if (!health.ok) throw new Error('API indisponível');

        response = await fetch(`${API_BASE}/api/integrations/sync`, {
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
            const ef = await fetch(`${supabaseUrl}/functions/v1/meta-sync`, {
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
              description: `Campanhas em atualização nos últimos ${days} dias.`,
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
            return;
          }
        }

        toast({
          title: 'API indisponível',
          description: 'Configure VITE_API_URL no ambiente de produção apontando para sua API.',
          variant: 'destructive',
        });
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
        description: `Buscando dados dos últimos ${days} dias.`,
      });

      setCurrentStage(1);
      setStatusMessage("Conectando com Meta API...");
      setProgress(10);

      let attempts = 0;
      const maxAttempts = 120; // 4 minutos (2s * 120)

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
            
            // Update stage based on progress
            const stageIndex = Math.floor((progressValue / 100) * (syncStages.length - 1));
            setCurrentStage(Math.min(stageIndex, syncStages.length - 1));
            
            // Set appropriate message based on stage
            if (progressValue < 20) {
              setStatusMessage("Conectando com Meta API...");
            } else if (progressValue < 40) {
              setStatusMessage("Buscando contas de anúncios...");
            } else if (progressValue < 60) {
              setStatusMessage("Sincronizando campanhas...");
            } else if (progressValue < 80) {
              setStatusMessage("Processando conjuntos de anúncios...");
            } else if (progressValue < 95) {
              setStatusMessage("Coletando métricas de performance...");
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
              description: "Os dados do Meta foram atualizados com sucesso.",
            });
            try {
              const names: string[] = statusPayload?.data?.result?.summary?.campaignNames ?? [];
              if (Array.isArray(names) && names.length > 0) {
                const preview = names.slice(0, 10).join(" • ");
                toast({
                  title: `Campanhas sincronizadas (${names.length})`,
                  description: preview,
                });
              }
            } catch {}
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
          console.error("Erro ao verificar status da sincronização:", error);
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
          title="Sincronizando Meta Ads"
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
            Sincronizar Meta
          </>
        )}
      </Button>
    </>
  );
}

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
    "Iniciando sincronização otimizada",
    "Validando permissões Instagram API",
    "Processando dados em batches",
    "Coletando métricas de engajamento",
    "Armazenando dados no banco",
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
    clearPolling();
    setSyncing(false);
    setStatusMessage(null);
    setProgress(null);
    setCurrentStage(0);
  };

  const updateProgressStage = (value: number, customMessage?: string) => {
    const progressValue = Math.max(0, Math.min(100, Math.round(value)));
    setProgress(progressValue);
    const stageIndex = Math.min(
      syncStages.length - 1,
      Math.floor((progressValue / 100) * (syncStages.length - 1))
    );
    setCurrentStage(stageIndex);
    setStatusMessage(customMessage ?? syncStages[stageIndex]);
  };

  const finalizeSuccess = (message?: string) => {
    clearPolling();
    updateProgressStage(100, message ?? "Sincronização concluída!");
    toast({
      title: "Sincronização concluída",
      description: message ?? "Os dados do Instagram foram atualizados com sucesso.",
    });
    setTimeout(() => {
      resetSyncState();
    }, 1200);
  };

  const pollOptimizedSyncStatus = (workspaceId: string) => {
    let attempts = 0;
    const maxAttempts = 300; // 10 minutos (2 seg * 300 = 600 seg = 10 min)

    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearPolling();
        resetSyncState();
        toast({
          title: "Tempo excedido",
          description: "A sincronização está demorando mais que o esperado. Verifique novamente em alguns minutos.",
          variant: "destructive",
        });
        return;
      }

      try {
        const statusResponse = await fetch(`${API_BASE}/api/integrations/instagram/sync-status/${workspaceId}`);
        const statusPayload = await statusResponse.json().catch(() => ({}));

        if (!statusResponse.ok) {
          throw new Error(statusPayload?.error || "Não foi possível verificar o status.");
        }

        const statusData = statusPayload?.data;
        
        // Update progress if we have it
        if (typeof statusData?.progress === "number") {
          updateProgressStage(statusData.progress, `Progresso: ${statusData.progress}% - ${statusData.status}`);
        }

        // Check status
        if (statusData?.status === "completed") {
          const recordsProcessed = statusData?.processedItems || 0;
          finalizeSuccess(`Sincronização concluída! ${recordsProcessed} registros processados.`);
        } else if (statusData?.status === "failed" || statusData?.status === "timeout") {
          clearPolling();
          resetSyncState();
          toast({
            title: "Erro na sincronização",
            description: statusData?.errorMessage || "Falha ao sincronizar dados do Instagram.",
            variant: "destructive",
          });
        } else if (statusData?.isStuck) {
          clearPolling();
          resetSyncState();
          toast({
            title: "Sincronização travada",
            description: "A sincronização parece ter travado. Tente novamente.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Erro ao verificar status da sincronização otimizada:", error);
      }
    }, 2000);
  };

  const pollJobStatus = (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 4 minutos

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

        const statusData = statusPayload?.data;
        if (typeof statusData?.progress === "number") {
          updateProgressStage(statusData.progress);
        }

        if (statusData?.status === "completed") {
          finalizeSuccess("Sincronização concluída. Atualizando dashboards...");
        } else if (statusData?.status === "failed") {
          clearPolling();
          resetSyncState();
          toast({
            title: "Erro na sincronização",
            description:
              statusData?.error || statusPayload?.error || "Falha ao sincronizar dados do Instagram.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Erro ao verificar status da sincronização:", error);
      }
    }, 2000);
  };

  const runOptimizedSync = async (workspaceId: string) => {
    updateProgressStage(10, "Iniciando sync otimizado com batching...");
    const controller = new AbortController();
    // Timeout reduzido pois agora retorna rapidamente com syncId: 30s
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    let response: Response;

    try {
      response = await fetch(`${API_BASE}/api/integrations/instagram/sync-optimized`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          totalDays: days,
          batchDays: Math.min(days, 7), // Batches de até 7 dias
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "Erro desconhecido");
      if (/aborted/i.test(msg)) {
        throw new Error("Timeout ao iniciar sincronização otimizada. Tentando método alternativo...");
      }
      throw new Error("Não foi possível conectar com a API. Verifique se o servidor está rodando.");
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || "Falha na sincronização otimizada do Instagram.");
    }

    // Start polling for progress using workspaceId
    const syncId = payload?.data?.syncId;
    if (syncId) {
      updateProgressStage(20, "Sincronização iniciada. Monitorando progresso...");
      pollOptimizedSyncStatus(workspaceId);
    } else {
      updateProgressStage(95, "Finalizando sincronização...");
      finalizeSuccess(payload?.message || `Sincronização concluída! ${payload?.data?.recordsProcessed || 0} registros processados.`);
    }
  };

  const runDirectSync = async (workspaceId: string) => {
    updateProgressStage(15, "Executando sync direto (fallback)...");
    const controller = new AbortController();
    // O fallback direto mantém timeout menor: 120s
    const timeoutId = window.setTimeout(() => controller.abort(), 120000);
    let response: Response;

    try {
      response = await fetch(`${API_BASE}/api/integrations/direct-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          days,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "Erro desconhecido");
      if (/aborted/i.test(msg)) {
        throw new Error("Tempo excedido na sincronização direta. Tente novamente ou aguarde alguns minutos.");
      }
      throw new Error("Não foi possível conectar com a API. Verifique se o servidor está rodando.");
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || "Falha na sincronização direta do Instagram.");
    }

    updateProgressStage(95, "Finalizando sincronização...");
    finalizeSuccess(payload?.message || `Os dados do Instagram foram atualizados com sucesso.`);
  };

  const startJobSync = async (workspaceId: string) => {
    const controller = new AbortController();
    // Timeout padrão para a API principal (job-based): 20s
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    let response: Response;

    try {
      response = await fetch(`${API_BASE}/api/integrations/sync`, {
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
    } catch (error) {
      console.warn("API principal indisponível. Usando fallback direto.", error);
      await runDirectSync(workspaceId);
      return;
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 404) {
        await runDirectSync(workspaceId);
        return;
      }
      throw new Error(payload?.error || "Falha ao iniciar sincronização");
    }

    if (payload?.success === false) {
      throw new Error(payload?.error || "Falha ao iniciar sincronização");
    }

    const jobData = payload?.data;
    const jobId = jobData?.jobId;

    toast({
      title: "Sincronização iniciada",
      description: `Buscando dados dos últimos ${days} dias.`,
    });

    updateProgressStage(
      typeof jobData?.progress === "number" ? jobData.progress : 10,
      "Conectando com Instagram API..."
    );

    if (jobData?.status === "completed" && jobId) {
      finalizeSuccess("Sincronização concluída. Atualizando dashboards...");
      return;
    }

    if (!jobId) {
      throw new Error("Resposta da API não retornou jobId");
    }

    pollJobStatus(jobId);
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
      updateProgressStage(5, `Preparando sincronização (${days} dias)...`);

      // Try optimized sync first, fallback to direct sync (skip job-based for Vercel)
      try {
        await runOptimizedSync(workspaceId);
      } catch (optimizedError) {
        console.warn("Sync otimizado falhou, usando fallback direto:", optimizedError);
        await runDirectSync(workspaceId);
      }
    } catch (error) {
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

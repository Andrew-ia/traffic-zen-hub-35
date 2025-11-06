import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RefreshCw, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SyncInsightsDialog } from "./SyncInsightsDialog";
import type { SyncInsightsSummary } from "@/types/sync";
import FullscreenLoader from "@/components/ui/fullscreen-loader";

interface InstagramSyncButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function InstagramSyncButton({
  variant = "outline",
  size = "default",
  className = ""
}: InstagramSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState("7");
  const [resultOpen, setResultOpen] = useState(false);
  const [resultInsights, setResultInsights] = useState<SyncInsightsSummary | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { toast } = useToast();

  const parseJsonSafe = async (response: Response) => {
    const raw = await response.text();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setOpen(false); // fechar modal e mostrar loader em tela cheia

    try {
      const workspaceId = import.meta.env.VITE_WORKSPACE_ID;

      if (!workspaceId) {
        throw new Error('Workspace ID não configurado');
      }

      toast({
        title: "Sincronização Iniciada",
        description: `Sincronizando insights dos últimos ${syncPeriod} dias...`,
      });

      // Start the sync job using simpleSync endpoint
      const response = await fetch('/api/integrations/simple-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          platformKey: 'instagram',
          days: Number(syncPeriod),
          type: 'all', // Instagram only supports 'all' type
        }),
      });

      const startPayload = await parseJsonSafe(response);

      if (!response.ok) {
        const message =
          (startPayload && typeof startPayload === 'object' && 'error' in startPayload
            ? String(startPayload.error)
            : typeof startPayload === 'string'
              ? startPayload
              : null) || 'Falha ao iniciar sincronização';

        throw new Error(message);
      }

      const jobId =
        startPayload && typeof startPayload === 'object' && 'data' in startPayload
          ? (startPayload as any).data?.jobId
          : undefined;

      if (!jobId) {
        throw new Error('Resposta inválida do servidor ao iniciar sincronização');
      }

      // Poll for job status
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max (2s * 60)

      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          setSyncing(false);
          toast({
            title: "Timeout",
            description: "A sincronização está demorando mais do que o esperado. Verifique a página de Integrações.",
            variant: "destructive",
          });
          return;
        }

        try {
          const statusResponse = await fetch(`/api/integrations/sync/${jobId}`);
          const statusPayload = await parseJsonSafe(statusResponse);

          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            setSyncing(false);
            toast({
              title: "Erro",
              description: "Falha ao verificar status da sincronização",
              variant: "destructive",
            });
            return;
          }

          const status = statusPayload?.data?.status;
          const result = statusPayload?.data?.result;
          const pct = statusPayload?.data?.progress;
          if (typeof pct === 'number') setProgress(Math.max(0, Math.min(100, Math.round(pct))));

          if (status === 'completed') {
            clearInterval(pollInterval);
            setSyncing(false);
            setOpen(false);

            // Extract insights from result
            const insights = result?.insights;
            if (insights) {
              setResultInsights(insights);
              setResultOpen(true);
            } else {
              toast({
                title: "Sincronização Concluída",
                description: "Os dados do Instagram foram atualizados com sucesso.",
              });
            }
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setSyncing(false);
            setOpen(false);
            toast({
              title: "Erro na Sincronização",
              description: statusPayload?.data?.error_message || "Falha ao sincronizar dados",
              variant: "destructive",
            });
          } else if (status === 'processing') {
            // apenas atualiza o progresso e mantém o loader
          }
        } catch (pollError) {
          console.error('Erro ao verificar status:', pollError);
        }
      }, 2000); // Poll every 2 seconds

    } catch (error) {
      setSyncing(false);
      setOpen(false);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {syncing && (
        <FullscreenLoader 
          title="Sincronizando Instagram"
          subtitle={`Últimos ${syncPeriod} dias`}
          progress={progress}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={variant} size={size} className={className} disabled={syncing}>
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
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Sincronizar Insights do Instagram
            </DialogTitle>
            <DialogDescription>
              Escolha o período dos dados que deseja sincronizar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Período de sincronização</Label>
              <RadioGroup value={syncPeriod} onValueChange={setSyncPeriod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="7" id="period-7" />
                  <Label htmlFor="period-7" className="font-normal cursor-pointer">
                    Últimos 7 dias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="14" id="period-14" />
                  <Label htmlFor="period-14" className="font-normal cursor-pointer">
                    Últimos 14 dias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="30" id="period-30" />
                  <Label htmlFor="period-30" className="font-normal cursor-pointer">
                    Últimos 30 dias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="60" id="period-60" />
                  <Label htmlFor="period-60" className="font-normal cursor-pointer">
                    Últimos 60 dias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="90" id="period-90" />
                  <Label htmlFor="period-90" className="font-normal cursor-pointer">
                    Últimos 90 dias
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Nota:</strong> Os dados do Instagram podem ter até 48 horas de latência.
                A sincronização pode levar alguns minutos dependendo do período selecionado.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={syncing}
            >
              Cancelar
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                "Iniciar Sincronização"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resultInsights && (
        <SyncInsightsDialog
          open={resultOpen}
          onOpenChange={setResultOpen}
          insights={resultInsights}
          platformName="Instagram"
        />
      )}
    </>
  );
}

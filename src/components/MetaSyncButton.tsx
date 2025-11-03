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

interface MetaSyncButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function MetaSyncButton({
  variant = "outline",
  size = "default",
  className = ""
}: MetaSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState("7");
  const [syncType, setSyncType] = useState("all");
  const [resultOpen, setResultOpen] = useState(false);
  const [resultInsights, setResultInsights] = useState<SyncInsightsSummary | null>(null);
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

    try {
      const workspaceId = import.meta.env.VITE_WORKSPACE_ID;

      if (!workspaceId) {
        throw new Error('Workspace ID não configurado');
      }

      toast({
        title: "Sincronização Iniciada",
        description: `Sincronizando dados dos últimos ${syncPeriod} dias...`,
      });

      // Start the sync job
      const response = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          platformKey: 'meta',
          days: Number(syncPeriod),
          type: syncType,
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
      const maxAttempts = 120; // 4 minutes with 2 second intervals

      const checkStatus = async (): Promise<boolean> => {
        if (attempts >= maxAttempts) {
          throw new Error('Tempo limite excedido. A sincronização pode ainda estar em andamento.');
        }

        attempts++;

        const statusResponse = await fetch(`/api/integrations/sync/${jobId}`, {
          headers: {
            Accept: 'application/json',
          },
        });

        const statusPayload = await parseJsonSafe(statusResponse);

        if (!statusResponse.ok || !statusPayload || typeof statusPayload !== 'object') {
          const errorMessage =
            (statusPayload && typeof statusPayload === 'object' && 'error' in statusPayload
              ? String(statusPayload.error)
              : typeof statusPayload === 'string'
                ? statusPayload
                : null) || 'Erro ao verificar status da sincronização';
          throw new Error(errorMessage);
        }

        const statusData = (statusPayload as any).data;

        if (!statusData) {
          throw new Error('Formato de status inválido recebido do servidor');
        }

        if (statusData.status === 'completed') {
          toast({
            title: "Sincronização Concluída!",
            description: `Dados dos últimos ${syncPeriod} dias sincronizados com sucesso.`,
          });
          setOpen(false);

          const insights = statusData.result?.insights ?? null;
          if (insights) {
            setResultInsights(insights);
            setResultOpen(true);
          } else {
            setTimeout(() => {
              window.location.reload();
            }, 800);
          }

          return true;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Sincronização falhou');
        } else if (statusData.status === 'processing') {
          toast({
            title: "Processando...",
            description: `Progresso: ${statusData.progress}%`,
          });
        }

        // Continue polling
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkStatus();
      };

      await checkStatus();

    } catch (error) {
      console.error("Sync error:", error);
      toast({
        title: "Erro na Sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Dados
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Sincronizar Dados do Meta
            </DialogTitle>
            <DialogDescription>
              Escolha o período e tipo de dados para sincronizar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Período */}
            <div className="space-y-3">
              <Label>Período de Sincronização</Label>
              <RadioGroup value={syncPeriod} onValueChange={setSyncPeriod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="period-1" />
                  <Label htmlFor="period-1" className="cursor-pointer font-normal">
                    Último dia
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="period-3" />
                  <Label htmlFor="period-3" className="cursor-pointer font-normal">
                    Últimos 3 dias
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="7" id="period-7" />
                  <Label htmlFor="period-7" className="cursor-pointer font-normal">
                    Última semana (7 dias) <span className="text-muted-foreground">— Recomendado</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="15" id="period-15" />
                  <Label htmlFor="period-15" className="cursor-pointer font-normal">
                    Últimas 2 semanas (15 dias)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="30" id="period-30" />
                  <Label htmlFor="period-30" className="cursor-pointer font-normal">
                    Último mês (30 dias)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Tipo de sincronização */}
            <div className="space-y-3">
              <Label>Tipo de Sincronização</Label>
              <RadioGroup value={syncType} onValueChange={setSyncType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="type-all" />
                  <Label htmlFor="type-all" className="cursor-pointer font-normal">
                    Tudo (Campanhas + Métricas)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="campaigns" id="type-campaigns" />
                  <Label htmlFor="type-campaigns" className="cursor-pointer font-normal">
                    Apenas Campanhas e Anúncios
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="metrics" id="type-metrics" />
                  <Label htmlFor="type-metrics" className="cursor-pointer font-normal">
                    Apenas Métricas de Performance
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Info box */}
            <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ℹ️ Sobre a sincronização</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Períodos menores são mais rápidos</li>
                <li>Apenas dados alterados serão atualizados</li>
                <li>A sincronização não apaga dados anteriores</li>
                <li>O processo roda em segundo plano via job queue</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={syncing}>
              Cancelar
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SyncInsightsDialog
        open={resultOpen}
        onOpenChange={(value) => {
          setResultOpen(value);
          if (!value) {
            setResultInsights(null);
          }
        }}
        insights={resultInsights}
        onReload={() => window.location.reload()}
      />
    </>
  );
}

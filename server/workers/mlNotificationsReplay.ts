import fetch from 'node-fetch';

type StopFn = () => void;

export interface MLReplayOptions {
  workspaceId: string;
  apiBaseUrl: string;
  intervalMinutes?: number;
  days?: number;
  maxOrders?: number;
  dryRun?: boolean;
}

/**
 * Simple interval worker to replay ML order notifications periodically.
 * Uses the existing HTTP endpoint to avoid duplicating logic.
 */
export function startMLNotificationsReplayWorker(opts: MLReplayOptions): StopFn | null {
  const workspaceId = (opts.workspaceId || '').trim();
  const apiBaseUrl = (opts.apiBaseUrl || '').replace(/\/+$/, '');

  if (!workspaceId || !apiBaseUrl) {
    console.warn('[ML Replay Worker] workspaceId ou apiBaseUrl ausentes; worker não iniciado.');
    return null;
  }

  const intervalMinutes = Math.max(5, Number(opts.intervalMinutes || 60)); // mínimo 5 min
  const days = Math.max(0.1, Number(opts.days || 1)); // default 1 dia (24h), min 0.1
  const maxOrders = Math.min(500, Math.max(1, Number(opts.maxOrders || 200)));
  const dryRun = Boolean(opts.dryRun);

  const runReplay = async () => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/integrations/mercadolivre/notifications/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          days,
          dryRun,
          maxOrders,
        }),
      });
      const json: any = await resp.json().catch(() => ({} as any));
      if (!resp.ok || json?.error) {
        console.warn('[ML Replay Worker] Falha ao reenviar notificações:', resp.status, json?.error || json);
        return;
      }
      console.log(
        `[ML Replay Worker] Sucesso: found=${json.totalFound ?? 'n/a'}, sent=${json.sent ?? 'n/a'}, skipped=${json.skippedAlreadySent ?? 'n/a'}, period=${json.period?.from || '?'}..${json.period?.to || '?'}`
      );
    } catch (error: any) {
      console.warn('[ML Replay Worker] Erro ao reenviar notificações:', error?.message || String(error));
    }
  };

  // Dispara imediatamente na inicialização
  void runReplay();
  // Agenda intervalos
  const intervalMs = intervalMinutes * 60 * 1000;
  const id = setInterval(runReplay, intervalMs);
  console.log(
    `[ML Replay Worker] Iniciado: cada ${intervalMinutes}min, days=${days}, maxOrders=${maxOrders}, dryRun=${dryRun}, workspace=${workspaceId}`
  );

  return () => clearInterval(id);
}

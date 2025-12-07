// Edge Function: ML Replay
// Dispara o endpoint interno de replay de notificações do Mercado Livre.
// Agende esta função a cada 10 minutos no Supabase (cron) para garantir reenvio.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const API_BASE = (Deno.env.get('API_INTERNAL_URL') || Deno.env.get('API_URL') || '').replace(/\/+$/, '');
const REPLAY_URL = Deno.env.get('ML_REPLAY_URL') || (API_BASE ? `${API_BASE}/api/integrations/mercadolivre/notifications/replay` : '');
const WORKSPACE_ID =
  Deno.env.get('MERCADO_LIVRE_DEFAULT_WORKSPACE_ID') ||
  Deno.env.get('WORKSPACE_ID') ||
  Deno.env.get('VITE_WORKSPACE_ID') ||
  '00000000-0000-0000-0000-000000000010';

const DAYS = Number(Deno.env.get('ML_REPLAY_DAYS') || 2);
const MAX_ORDERS = Number(Deno.env.get('ML_REPLAY_MAX_ORDERS') || 200);
const DRY_RUN = String(Deno.env.get('ML_REPLAY_DRY_RUN') || '').toLowerCase() === 'true';

serve(async () => {
  if (!REPLAY_URL) {
    return new Response(JSON.stringify({ error: 'ML_REPLAY_URL ou API_INTERNAL_URL/API_URL ausente' }), { status: 500 });
  }

  try {
    const body = {
      workspaceId: WORKSPACE_ID,
      days: DAYS > 0 ? DAYS : 2,
      maxOrders: Math.min(500, MAX_ORDERS > 0 ? MAX_ORDERS : 200),
      dryRun: DRY_RUN,
    };

    const resp = await fetch(REPLAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    return new Response(text, { status: resp.status });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
});

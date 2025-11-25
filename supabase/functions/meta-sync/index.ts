// =============================================================================
// EDGE FUNCTION: META ADS SYNC
// =============================================================================
// Sincroniza dados do Meta Ads (campanhas, ad sets, ads, métricas)
//
// Endpoint: https://[PROJECT].supabase.co/functions/v1/meta-sync
//
// Uso:
// POST /meta-sync
// {
//   "workspace_id": "uuid",
//   "days": 7,  // opcional, default 7
//   "sync_type": "all" | "campaigns" | "metrics"  // opcional, default "all"
// }
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH_VERSION = 'v19.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface SyncRequest {
  workspace_id?: string;
  days?: number;
  sync_type?: 'all' | 'campaigns' | 'metrics';
}

// =============================================================================
// HELPERS
// =============================================================================

function mapMetaStatus(status: string): string {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
    case 'IN_PROCESS':
    case 'PENDING':
    case 'WITH_ISSUES':
      return 'active';
    case 'PAUSED':
    case 'INACTIVE':
      return 'paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'archived';
    default:
      return 'draft';
  }
}

function resolveDeliveryStatus(primaryStatus: string, effectiveStatus?: string | null): string {
  const mappedEffective = effectiveStatus ? mapMetaStatus(effectiveStatus) : null;
  if (mappedEffective === 'paused' || mappedEffective === 'archived') {
    return mappedEffective;
  }
  if (mappedEffective === 'active') {
    return 'active';
  }
  return mapMetaStatus(primaryStatus);
}

function centsToNumber(value: string | number | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (isNaN(asNumber)) return null;
  return asNumber / 100;
}

// =============================================================================
// META API CALLS
// =============================================================================

async function fetchMetaApi(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function fetchCampaigns(accessToken: string, adAccountId: string, since: string): Promise<any[]> {
  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'objective',
    'start_time',
    'stop_time',
    'daily_budget',
    'lifetime_budget',
    'created_time',
    'updated_time',
  ].join(',');

  const url = `${GRAPH_URL}/act_${adAccountId}/campaigns?fields=${fields}&filtering=[{"field":"updated_time","operator":"GREATER_THAN","value":"${since}"}]&access_token=${accessToken}&limit=500`;

  const data = await fetchMetaApi(url);
  return data.data || [];
}

async function fetchAdSets(accessToken: string, adAccountId: string, campaignIds: string[]): Promise<any[]> {
  if (campaignIds.length === 0) return [];

  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'campaign_id',
    'start_time',
    'end_time',
    'daily_budget',
    'lifetime_budget',
    'bid_strategy',
    'bid_amount',
    'targeting',
    'created_time',
    'updated_time',
  ].join(',');

  const idsFilter = campaignIds.map((id) => `"${id}"`).join(',');
  const url = `${GRAPH_URL}/act_${adAccountId}/adsets?fields=${fields}&filtering=[{"field":"campaign_id","operator":"IN","value":[${idsFilter}]}]&access_token=${accessToken}&limit=500`;

  const data = await fetchMetaApi(url);
  return data.data || [];
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function syncCampaigns(
  supabase: any,
  workspaceId: string,
  platformAccountId: string,
  campaigns: any[]
): Promise<void> {
  for (const campaign of campaigns) {
    const campaignData = {
      workspace_id: workspaceId,
      platform_account_id: platformAccountId,
      external_id: campaign.id,
      name: campaign.name,
      objective: campaign.objective || null,
      status: resolveDeliveryStatus(campaign.status, campaign.effective_status),
      start_date: campaign.start_time ? new Date(campaign.start_time).toISOString().split('T')[0] : null,
      end_date: campaign.stop_time ? new Date(campaign.stop_time).toISOString().split('T')[0] : null,
      daily_budget: centsToNumber(campaign.daily_budget),
      lifetime_budget: centsToNumber(campaign.lifetime_budget),
      settings: {
        effective_status: campaign.effective_status,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
      },
      source: 'synced',
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('campaigns')
      .upsert(campaignData, {
        onConflict: 'workspace_id,platform_account_id,external_id',
      });

    if (error) {
      console.error(`Error syncing campaign ${campaign.id}:`, error);
    }
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Inicializa Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const body: SyncRequest = await req.json();
    const days = body.days || 7;
    const syncType = body.sync_type || 'all';

    // Usar variáveis de ambiente diretamente (mais confiável)
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const workspaceId = body.workspace_id || Deno.env.get('WORKSPACE_ID') || Deno.env.get('VITE_WORKSPACE_ID');

    console.log('🔍 Credentials check:', {
      accessToken: !!accessToken,
      adAccountId: !!adAccountId, 
      workspaceId: !!workspaceId,
      envVars: Object.keys(Deno.env.toObject()).filter(k => k.includes('META')).length
    });

    if (!accessToken || !adAccountId || !workspaceId) {
      throw new Error(`Missing required credentials. AccessToken: ${!!accessToken}, AdAccountId: ${!!adAccountId}, WorkspaceId: ${!!workspaceId}`);
    }

    // Busca platform_account_id (com e sem prefixo "act_")
    const adAccountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const adAccountIdWithoutPrefix = adAccountId.replace('act_', '');

    const { data: platformAccount } = await supabase
      .from('platform_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('platform_key', 'meta')
      .or(`external_id.eq.${adAccountId},external_id.eq.${adAccountIdWithPrefix},external_id.eq.${adAccountIdWithoutPrefix}`)
      .single();

    if (!platformAccount) {
      throw new Error(`Platform account not found for workspace ${workspaceId} and account ${adAccountId}`);
    }

    const platformAccountId = platformAccount.id;

    // Calcula data de início
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result: { success: boolean; campaigns_synced?: number } = { success: true };

    // Sync campanhas
    if (syncType === 'all' || syncType === 'campaigns') {
      console.log(`Fetching campaigns updated since ${since}...`);
      const campaigns = await fetchCampaigns(accessToken, adAccountId, since);
      console.log(`Found ${campaigns.length} campaigns`);

      await syncCampaigns(supabase, workspaceId, platformAccountId, campaigns);

      result.campaigns_synced = campaigns.length;
    }

    // TODO: Sync ad sets, ads, metrics

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in meta-sync:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

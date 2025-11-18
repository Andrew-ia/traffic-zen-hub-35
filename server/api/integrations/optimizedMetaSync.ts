import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { decryptCredentials } from '../../services/encryption.js';
import type { ApiResponse } from '../../types/index.js';

/**
 * Sync Meta Ads otimizado - sem worker local, com batching inteligente
 * POST /api/integrations/meta/sync-optimized
 */

interface MetaSyncRequest {
  workspaceId: string;
  days?: number;
  type?: 'all' | 'campaigns' | 'metrics';
}

interface MetaSyncProgress {
  status: 'running' | 'completed' | 'failed';
  progress: number;
  stage: string;
  totalItems: number;
  processedItems: number;
  error?: string;
}

const GRAPH_VERSION = 'v19.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo
const BATCH_SIZE = 50; // campanhas por batch

// Rate limiting: Meta permite 25 requests/segundo
const RATE_LIMIT_DELAY = 50; // 50ms entre requests = 20 req/s (margem de segurança)

class MetaSyncOptimized {
  private pool = getPool();
  private workspaceId: string;
  private platformAccountId: string | null = null;
  private accessToken: string;
  private adAccountId: string;
  private startTime: number;

  constructor(workspaceId: string, accessToken: string, adAccountId: string) {
    this.workspaceId = workspaceId;
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
    this.startTime = Date.now();
  }

  // Helper para rate limiting
  private async rateLimit() {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  // Helper para retry com backoff exponencial
  private async withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.warn(`Retry attempt. Remaining: ${retries - 1}. Error:`, error instanceof Error ? error.message : error);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return this.withRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') || 
             message.includes('network') || 
             message.includes('econnreset') ||
             message.includes('rate limit');
    }
    return false;
  }

  // Buscar Meta API com retry e rate limiting
  private async fetchMetaApi(url: string): Promise<any> {
    return this.withRetry(async () => {
      await this.rateLimit();
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        // Timeout de 30 segundos por request
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Meta API error ${response.status}: ${text}`);
      }

      return response.json();
    });
  }

  // Obter platform_account_id
  private async getPlatformAccountId(): Promise<string> {
    if (this.platformAccountId) return this.platformAccountId;

    const adAccountIdWithPrefix = this.adAccountId.startsWith('act_') ? this.adAccountId : `act_${this.adAccountId}`;
    const adAccountIdWithoutPrefix = this.adAccountId.replace('act_', '');

    const { rows } = await this.pool.query(
      `SELECT id FROM platform_accounts 
       WHERE workspace_id = $1 AND platform_key = 'meta' 
       AND (external_id = $2 OR external_id = $3 OR external_id = $4)`,
      [this.workspaceId, this.adAccountId, adAccountIdWithPrefix, adAccountIdWithoutPrefix]
    );

    if (rows.length === 0) {
      throw new Error(`Platform account not found for workspace ${this.workspaceId} and account ${this.adAccountId}`);
    }

    this.platformAccountId = rows[0].id;
    return this.platformAccountId;
  }

  // Atualizar progresso no banco
  private async updateProgress(progress: number, stage: string, processedItems: number, totalItems: number) {
    await this.pool.query(
      `SELECT update_sync_progress($1, $2, $3, $4)`,
      ['meta', this.workspaceId, processedItems, totalItems]
    );

    console.log(`📊 Meta Sync Progress: ${progress}% - ${stage} (${processedItems}/${totalItems})`);
  }

  // Buscar campanhas com filtro de data otimizado
  private async fetchCampaigns(since: string): Promise<any[]> {
    const platformAccountId = await this.getPlatformAccountId();
    
    const fields = [
      'id', 'name', 'status', 'effective_status', 'objective',
      'start_time', 'stop_time', 'daily_budget', 'lifetime_budget',
      'created_time', 'updated_time'
    ].join(',');

    // Buscar campanhas em lotes para evitar timeouts
    const allCampaigns: any[] = [];
    let after = '';
    let hasNextPage = true;
    let batchCount = 0;

    while (hasNextPage && batchCount < 20) { // máximo 20 batches para segurança
      const url = `${GRAPH_URL}/act_${this.adAccountId}/campaigns?` +
        `fields=${fields}&` +
        `filtering=[{"field":"updated_time","operator":"GREATER_THAN","value":"${since}"}]&` +
        `limit=${BATCH_SIZE}&` +
        `access_token=${this.accessToken}` +
        (after ? `&after=${after}` : '');

      const data = await this.fetchMetaApi(url);
      
      if (data.data && data.data.length > 0) {
        allCampaigns.push(...data.data);
        await this.updateProgress(
          Math.min(90, 10 + (batchCount * 10)), 
          'Buscando campanhas...', 
          allCampaigns.length, 
          Math.max(allCampaigns.length, 100)
        );
      }

      hasNextPage = data.paging && data.paging.cursors && data.paging.cursors.after;
      after = data.paging?.cursors?.after || '';
      batchCount++;

      if (!data.data || data.data.length === 0) break;
    }

    console.log(`✅ Encontradas ${allCampaigns.length} campanhas Meta em ${batchCount} batches`);
    return allCampaigns;
  }

  // Mapear status do Meta para nosso padrão
  private mapMetaStatus(status: string): string {
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

  // Converter centavos para reais
  private centsToNumber(value: string | number | null): number | null {
    if (!value) return null;
    const asNumber = Number(value);
    if (isNaN(asNumber)) return null;
    return asNumber / 100;
  }

  // Sincronizar campanhas em lotes
  private async syncCampaigns(campaigns: any[]): Promise<void> {
    const platformAccountId = await this.getPlatformAccountId();
    const SYNC_BATCH_SIZE = 25; // inserções por lote

    for (let i = 0; i < campaigns.length; i += SYNC_BATCH_SIZE) {
      const batch = campaigns.slice(i, i + SYNC_BATCH_SIZE);
      
      // Preparar dados do lote
      const campaignValues = batch.map((campaign) => ({
        workspace_id: this.workspaceId,
        platform_account_id: platformAccountId,
        external_id: campaign.id,
        name: campaign.name,
        objective: campaign.objective || null,
        status: this.mapMetaStatus(campaign.status),
        start_date: campaign.start_time ? new Date(campaign.start_time).toISOString().split('T')[0] : null,
        end_date: campaign.stop_time ? new Date(campaign.stop_time).toISOString().split('T')[0] : null,
        daily_budget: this.centsToNumber(campaign.daily_budget),
        lifetime_budget: this.centsToNumber(campaign.lifetime_budget),
        settings: {
          effective_status: campaign.effective_status,
          created_time: campaign.created_time,
          updated_time: campaign.updated_time,
        },
        source: 'synced',
        last_synced_at: new Date().toISOString(),
      }));

      // Executar upsert em lote
      for (const campaignData of campaignValues) {
        await this.pool.query(
          `INSERT INTO campaigns (
            workspace_id, platform_account_id, external_id, name, objective, status,
            start_date, end_date, daily_budget, lifetime_budget, settings, source, last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (workspace_id, platform_account_id, external_id) 
          DO UPDATE SET 
            name = EXCLUDED.name,
            objective = EXCLUDED.objective,
            status = EXCLUDED.status,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            daily_budget = EXCLUDED.daily_budget,
            lifetime_budget = EXCLUDED.lifetime_budget,
            settings = EXCLUDED.settings,
            last_synced_at = EXCLUDED.last_synced_at`,
          [
            campaignData.workspace_id, campaignData.platform_account_id, campaignData.external_id,
            campaignData.name, campaignData.objective, campaignData.status, campaignData.start_date,
            campaignData.end_date, campaignData.daily_budget, campaignData.lifetime_budget,
            JSON.stringify(campaignData.settings), campaignData.source, campaignData.last_synced_at
          ]
        );
      }

      await this.updateProgress(
        Math.min(95, 50 + ((i + batch.length) / campaigns.length * 45)),
        'Salvando campanhas...',
        i + batch.length,
        campaigns.length
      );
    }

    console.log(`✅ ${campaigns.length} campanhas Meta sincronizadas com sucesso`);
  }

  // Método principal de sincronização
  public async sync(days = 7, type: 'all' | 'campaigns' | 'metrics' = 'all'): Promise<MetaSyncProgress> {
    try {
      // Iniciar tracking
      await this.pool.query(
        `SELECT start_sync_tracking($1, $2, $3, $4)`,
        ['meta', this.workspaceId, type, 0]
      );

      await this.updateProgress(0, 'Iniciando sincronização...', 0, 100);

      // Calcular data de início
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`🚀 Iniciando sync Meta Ads otimizado`);
      console.log(`   Workspace: ${this.workspaceId}`);
      console.log(`   Período: últimos ${days} dias (desde ${since.split('T')[0]})`);
      console.log(`   Tipo: ${type}`);

      let totalSynced = 0;

      if (type === 'all' || type === 'campaigns') {
        await this.updateProgress(5, 'Buscando campanhas do Meta...', 0, 100);
        const campaigns = await this.fetchCampaigns(since);
        
        await this.updateProgress(30, 'Sincronizando campanhas...', 0, campaigns.length);
        await this.syncCampaigns(campaigns);
        
        totalSynced += campaigns.length;
        await this.updateProgress(60, `${campaigns.length} campanhas sincronizadas`, campaigns.length, campaigns.length);
      }

      // TODO: Implementar sync de AdSets, Ads e Métricas se type === 'all' ou 'metrics'

      // Finalizar
      const duration = Date.now() - this.startTime;
      await this.pool.query(
        `SELECT complete_sync_tracking($1, $2, $3, $4, $5)`,
        ['meta', this.workspaceId, true, null, duration]
      );

      await this.updateProgress(100, 'Sincronização concluída!', totalSynced, totalSynced);

      console.log(`✅ Meta Ads sync concluído em ${(duration / 1000).toFixed(1)}s`);
      console.log(`   Total de itens sincronizados: ${totalSynced}`);

      return {
        status: 'completed',
        progress: 100,
        stage: 'Concluído com sucesso',
        totalItems: totalSynced,
        processedItems: totalSynced
      };

    } catch (error) {
      const duration = Date.now() - this.startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // Registrar erro
      await this.pool.query(
        `SELECT complete_sync_tracking($1, $2, $3, $4, $5)`,
        ['meta', this.workspaceId, false, errorMessage, duration]
      );

      console.error(`❌ Erro no sync Meta Ads:`, errorMessage);
      
      return {
        status: 'failed',
        progress: 0,
        stage: 'Falha na sincronização',
        totalItems: 0,
        processedItems: 0,
        error: errorMessage
      };
    }
  }
}

export async function optimizedMetaSync(req: Request, res: Response) {
  try {
    const { workspaceId, days = 7, type = 'all' }: MetaSyncRequest = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'workspaceId é obrigatório'
      } as ApiResponse);
    }

    // Buscar credenciais
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT encrypted_credentials, encryption_iv 
       FROM integration_credentials 
       WHERE workspace_id = $1 AND platform_key = 'meta'`,
      [workspaceId]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais do Meta não encontradas'
      } as ApiResponse);
    }

    const credentials = await decryptCredentials(rows[0].encrypted_credentials, rows[0].encryption_iv);
    const { access_token: accessToken, ad_account_id: adAccountId } = credentials;

    if (!accessToken || !adAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais do Meta incompletas (access_token ou ad_account_id)'
      } as ApiResponse);
    }

    // Executar sync otimizado
    const metaSync = new MetaSyncOptimized(workspaceId, accessToken, adAccountId);
    const result = await metaSync.sync(days, type);

    return res.json({
      success: result.status === 'completed',
      data: result
    } as ApiResponse);

  } catch (error) {
    console.error('Erro no optimizedMetaSync:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    } as ApiResponse);
  }
}

// Endpoint para obter status do sync em tempo real
export async function getMetaSyncStatus(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'workspaceId é obrigatório'
      });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM sync_metadata 
       WHERE platform_key = 'meta' AND workspace_id = $1`,
      [workspaceId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          status: 'idle',
          progress: 0,
          stage: 'Nenhuma sincronização executada',
          totalItems: 0,
          processedItems: 0
        }
      });
    }

    const metadata = rows[0];
    return res.json({
      success: true,
      data: {
        status: metadata.sync_status,
        progress: metadata.progress || 0,
        stage: metadata.sync_status === 'running' ? 'Sincronizando...' : 
               metadata.sync_status === 'completed' ? 'Concluído' : 
               metadata.sync_status === 'failed' ? 'Falhou' : 'Aguardando',
        totalItems: metadata.total_items || 0,
        processedItems: metadata.processed_items || 0,
        lastSyncAt: metadata.last_sync_at,
        duration: metadata.sync_duration_ms,
        error: metadata.error_message
      }
    });

  } catch (error) {
    console.error('Erro ao obter status do sync Meta:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}
import { getPool } from '../../config/database.js';
import { getMercadoLivreCredentials, requestWithAuth } from '../../api/integrations/mercadolivre.js';

const ADS_PRODUCT_API_BASE = 'https://api.mercadolibre.com/advertising/product_ads';
// API v2 usa o mesmo prefixo para campanhas e ads: /advertising/product_ads/advertisers/{id}
const ADS_ADVERTISER_API_BASE = `${ADS_PRODUCT_API_BASE}/advertisers`;
const MKT_ADS_API_BASE = 'https://api.mercadolibre.com/advertising';
const MKT_ADS_MARKETPLACE_BASE = 'https://api.mercadolibre.com/marketplace/advertising';
const BRAZIL_CURRENCY = 'BRL';
const DEFAULT_SITE = process.env.MERCADO_LIVRE_SITE_ID || 'MLB';
let schemaReady: Promise<void> | null = null;

type CurveRow = {
  id: string;
  workspace_id: string;
  curve: 'A' | 'B' | 'C';
  name: string;
  campaign_type: string;
  daily_budget: number;
  min_revenue_30d: number;
  min_orders_30d: number;
  min_roas: number;
  min_conversion: number;
  priority: number;
};

type CampaignRow = {
  id: string;
  workspace_id: string;
  curve: 'A' | 'B' | 'C';
  campaign_type: string;
  advertiser_id: string;
  ml_campaign_id: string | null;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived' | 'error';
  daily_budget: number | null;
  automation_status: 'managed' | 'manual' | 'sync_only';
  last_synced_at: string | null;
  last_automation_at: string | null;
  metadata?: any;
};

type ClassifiedProduct = {
  productId: string;
  mlItemId: string;
  curve: 'A' | 'B' | 'C';
  title?: string | null;
  sku?: string | null;
  reason?: string;
  action?: 'active' | 'paused';
  sales30d?: number;
  revenue30d?: number;
  cost30d?: number;
  acos?: number;
  mlAdId?: string | null;
};

type PlanInput = {
  budgets?: Partial<Record<'A' | 'B' | 'C', number>>;
  names?: Partial<Record<'A' | 'B' | 'C', string>>;
};

type CampaignPlan = {
  curve: 'A' | 'B' | 'C';
  name: string;
  budget: number;
  action: 'create' | 'update';
  currentCampaignId?: string | null;
  mlCampaignId?: string | null;
};

type MovementPlan = {
  productId: string;
  mlItemId: string;
  curve: 'A' | 'B' | 'C';
  targetCampaignId?: string | null;
  title?: string | null;
  sku?: string | null;
  reason?: string;
  sales30d?: number;
  revenue30d?: number;
  cost30d?: number;
  acos?: number;
};

export class MercadoAdsAutomationService {
  private async ensureSchema() {
    if (schemaReady) return schemaReady;
    schemaReady = (async () => {
      const pool = getPool();
      // Tables and indexes used by automation (keeps runtime safe if migration not applied)
      await pool.query(`
        create table if not exists ml_ads_curves (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          curve text not null,
          name text not null,
          campaign_type text not null,
          daily_budget numeric(14,2) not null default 0,
          min_revenue_30d numeric(18,2) default 0,
          min_orders_30d integer default 0,
          min_roas numeric(10,2) default 0,
          min_conversion numeric(10,4) default 0,
          priority integer not null default 100,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (workspace_id, curve),
          constraint ml_ads_curves_curve_chk check (curve in ('A','B','C'))
        );
        create index if not exists idx_ml_ads_curves_workspace on ml_ads_curves (workspace_id);
        create index if not exists idx_ml_ads_curves_priority on ml_ads_curves (workspace_id, priority);

        create table if not exists ml_ads_campaigns (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          curve_id uuid references ml_ads_curves(id) on delete set null,
          curve text,
          campaign_type text not null,
          advertiser_id text not null,
          ml_campaign_id text,
          name text not null,
          status text not null default 'draft' check (status in ('draft','active','paused','archived','error')),
          daily_budget numeric(14,2),
          bidding_strategy text,
          automation_status text not null default 'managed' check (automation_status in ('managed','manual','sync_only')),
          last_synced_at timestamptz,
          last_automation_at timestamptz,
          metadata jsonb default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (workspace_id, ml_campaign_id),
          unique (workspace_id, curve)
        );
        create index if not exists idx_ml_ads_campaigns_workspace on ml_ads_campaigns (workspace_id);
        create index if not exists idx_ml_ads_campaigns_status on ml_ads_campaigns (workspace_id, status);
        create index if not exists idx_ml_ads_campaigns_curve on ml_ads_campaigns (workspace_id, curve);

        create table if not exists ml_ads_campaign_products (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          campaign_id uuid not null references ml_ads_campaigns(id) on delete cascade,
          product_id uuid references products(id) on delete set null,
          ml_item_id text,
          ml_ad_id text,
          curve text not null,
          source text not null default 'automation' check (source in ('automation','manual','import')),
          status text not null default 'active' check (status in ('active','paused','removed')),
          added_at timestamptz not null default now(),
          last_moved_at timestamptz,
          unique (campaign_id, product_id),
          unique (campaign_id, ml_item_id),
          unique (workspace_id, ml_ad_id)
        );
        create index if not exists idx_ml_ads_campaign_products_workspace on ml_ads_campaign_products (workspace_id);
        create index if not exists idx_ml_ads_campaign_products_ml_item on ml_ads_campaign_products (ml_item_id);

        create table if not exists ml_ads_curve_history (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          product_id uuid references products(id) on delete set null,
          ml_item_id text,
          previous_curve text,
          new_curve text not null,
          revenue_30d numeric(18,2),
          orders_30d integer,
          roas_30d numeric(10,2),
          conversion_rate numeric(10,4),
          campaign_id uuid references ml_ads_campaigns(id) on delete set null,
          reason text,
          created_at timestamptz not null default now()
        );
        create index if not exists idx_ml_ads_curve_history_workspace on ml_ads_curve_history (workspace_id, created_at desc);
      `);
    })();
    return schemaReady;
  }

  private resolveAdvertiserId(creds: any): string {
    const envAdvertiser = (process.env.MERCADO_ADS_ADVERTISER_ID || '').trim();
    if (envAdvertiser) return envAdvertiser;
    const userId = String(creds?.userId || creds?.user_id || '').trim();
    if (!userId) {
      throw new Error('ml_ads_missing_advertiser');
    }
    return userId;
  }

  private async resolveAdvertiserContext(workspaceId: string): Promise<{ advertiserId: string; siteId: string }> {
    // Primeiro, consulta a lista de advertisers habilitados para Product Ads
    try {
      const resp = await requestWithAuth<any>(
        workspaceId,
        `https://api.mercadolibre.com/advertising/advertisers`,
        {
          params: { product_id: 'PADS' },
          headers: { 'Api-Version': '1', 'Content-Type': 'application/json' },
        },
      );
      const advertiser = resp?.advertisers?.[0];
      if (advertiser?.advertiser_id) {
        return {
          advertiserId: String(advertiser.advertiser_id),
          siteId: advertiser.site_id || DEFAULT_SITE,
        };
      }
    } catch (err: any) {
      // Se 404 not_found (sem permissão), seguimos para fallback
      if (err?.response?.status !== 404) {
        console.warn('[MercadoAds] Falha ao listar advertisers PADS:', err?.message || err);
      }
    }

    // Fallback para userId/env
    const creds = await getMercadoLivreCredentials(workspaceId);
    const advertiserId = this.resolveAdvertiserId(creds);
    return { advertiserId, siteId: DEFAULT_SITE };
  }

  private resolveBudget(curve: 'A' | 'B' | 'C'): number {
    // Orçamento recomendado: A (60-70%), B (20-25%), C (5-10%)
    // Base 100 para manter a proporção
    const fallback = { A: 65, B: 25, C: 10 };
    const envKey = `ML_ADS_BUDGET_${curve}`;
    const raw = process.env[envKey];
    if (!raw) return fallback[curve];
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback[curve];
  }

  private resolveBid(curve: 'A' | 'B' | 'C'): number {
    const fallback = { A: 1.5, B: 0.9, C: 0.5 };
    const envKey = `ML_ADS_MAX_CPC_${curve}`;
    const raw = process.env[envKey];
    if (!raw) return fallback[curve];
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback[curve];
  }

  private async ensureCurveDefaults(workspaceId: string): Promise<CurveRow[]> {
    await this.ensureSchema();
    const pool = getPool();
    const defaults: Array<Omit<CurveRow, 'id' | 'workspace_id'>> = [
      {
        curve: 'A',
        name: 'Curva A',
        campaign_type: 'PERFORMANCE',
        daily_budget: this.resolveBudget('A'),
        min_revenue_30d: 5000,
        min_orders_30d: 15,
        min_roas: 3,
        min_conversion: 0.02,
        priority: 1,
      },
      {
        curve: 'B',
        name: 'Curva B',
        campaign_type: 'OTIMIZACAO',
        daily_budget: this.resolveBudget('B'),
        min_revenue_30d: 1500,
        min_orders_30d: 5,
        min_roas: 1.5,
        min_conversion: 0.012,
        priority: 2,
      },
      {
        curve: 'C',
        name: 'Curva C',
        campaign_type: 'TESTE',
        daily_budget: this.resolveBudget('C'),
        min_revenue_30d: 0,
        min_orders_30d: 0,
        min_roas: 0,
        min_conversion: 0,
        priority: 3,
      },
    ];

    for (const cfg of defaults) {
      await pool.query(
        `insert into ml_ads_curves (
          workspace_id, curve, name, campaign_type, daily_budget,
          min_revenue_30d, min_orders_30d, min_roas, min_conversion, priority
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (workspace_id, curve) do update set
          name = excluded.name,
          campaign_type = excluded.campaign_type,
          daily_budget = excluded.daily_budget,
          min_revenue_30d = excluded.min_revenue_30d,
          min_orders_30d = excluded.min_orders_30d,
          min_roas = excluded.min_roas,
          min_conversion = excluded.min_conversion,
          priority = excluded.priority,
          updated_at = now()`,
        [
          workspaceId,
          cfg.curve,
          cfg.name,
          cfg.campaign_type,
          cfg.daily_budget,
          cfg.min_revenue_30d,
          cfg.min_orders_30d,
          cfg.min_roas,
          cfg.min_conversion,
          cfg.priority,
        ],
      );
    }

    const { rows } = await pool.query<CurveRow>(
      `select * from ml_ads_curves where workspace_id = $1 order by priority asc`,
      [workspaceId],
    );
    return rows;
  }

  async listCurves(workspaceId: string): Promise<CurveRow[]> {
    return this.ensureCurveDefaults(workspaceId);
  }

  private async fetchAdsMetricsByItem(workspaceId: string, itemIds: string[]): Promise<Map<string, {
    cost: number;
    clicks: number;
    prints: number;
    sales: number;
    revenue: number;
    cpc: number;
    ctr: number;
  }>> {
    const result = new Map<string, { cost: number; clicks: number; prints: number; sales: number; revenue: number; cpc: number; ctr: number }>();
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
    const { dateFrom, dateTo } = this.getDateRange(30);

    // Initialize with zeros
    for (const id of itemIds) {
      result.set(id, { cost: 0, clicks: 0, prints: 0, sales: 0, revenue: 0, cpc: 0, ctr: 0 });
    }

    try {
      let offset = 0;
      const limit = 50;
      while (true) {
        // Busca métricas de TODOS os anúncios (ativos/pausados) nos últimos 30 dias
        // Isso garante que a classificação use dados reais do período, não lifetime
        const resp = await requestWithAuth<any>(
          workspaceId,
          `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads/search`,
          {
            params: {
              limit,
              offset,
              date_from: dateFrom,
              date_to: dateTo,
              metrics: 'clicks,prints,cost,units_quantity,total_amount',
              // Não filtramos por status para pegar histórico recente mesmo se pausado
            },
            headers: { 'api-version': '2' },
          },
        );

        const results = resp?.results || [];
        if (results.length === 0) break;

        for (const ad of results) {
          const itemId = ad.item_id;
          if (itemId && result.has(itemId)) {
            const current = result.get(itemId)!;
            // Acumula métricas (pode haver mais de um ad para o mesmo item em campanhas diferentes ou recriações)
            current.clicks += Number(ad.clicks || 0);
            current.prints += Number(ad.prints || 0);
            current.cost += Number(ad.cost || 0);
            current.sales += Number(ad.units_quantity || 0);
            current.revenue += Number(ad.total_amount || 0);
          } else if (itemId) {
            // Se o item não estava na lista inicial (itemIds), podemos ignorar ou adicionar?
            // Vamos adicionar para garantir completude se itemIds for apenas um subset
             const current = { cost: 0, clicks: 0, prints: 0, sales: 0, revenue: 0, cpc: 0, ctr: 0 };
             current.clicks += Number(ad.clicks || 0);
             current.prints += Number(ad.prints || 0);
             current.cost += Number(ad.cost || 0);
             current.sales += Number(ad.units_quantity || 0);
             current.revenue += Number(ad.total_amount || 0);
             result.set(itemId, current);
          }
        }

        if (results.length < limit) break;
        offset += limit;
      }

      // Calcula derivados (CPC, CTR)
      for (const m of result.values()) {
        m.cpc = m.clicks > 0 ? m.cost / m.clicks : 0;
        m.ctr = m.prints > 0 ? m.clicks / m.prints : 0;
      }

    } catch (err) {
      console.warn('[MercadoAds] Falha ao buscar métricas em lote (ads/search):', (err as any)?.message || err);
      // Fallback silencioso (retorna zeros) ou poderia tentar fallback individual
    }

    return result;
  }

  private pickCurve(metrics: { 
    revenue: number; 
    sales: number; 
    cost: number; 
    clicks: number;
    profitUnit?: number | null 
  }) {
    // Métricas de ADS (30d)
    const { sales, revenue, cost, clicks } = metrics;
    
    // Métricas calculadas
    const avgTicket = sales > 0 ? revenue / sales : 0;
    const profitUnit = typeof metrics.profitUnit === 'number' ? metrics.profitUnit : 5;
    // Margem para ACOS: se não tem receita, assume 20%
    const allowedAcos = revenue > 0 ? Math.min(0.6, Math.max(0.05, profitUnit / avgTicket)) : 0.2;
    const acos = revenue > 0 ? cost / revenue : cost > 0 ? Infinity : 0;

    // --- LÓGICA PADRÃO PROFISSIONAL ML ADS ---

    // 🔴 CURVA C (TESTE CONTROLADO)
    // Objetivo: validação rápida ou descarte
    // Regra dura: 15-20 cliques sem venda -> PAUSA
    if (sales === 0 && clicks >= 15) {
      // Retorna C mas com indicação de pausa (será tratado no classifyProducts)
      return { curve: 'C' as const, action: 'paused' as const, reason: `Teste falhou: ${clicks} cliques sem venda` };
    }
    
    // 🟢 CURVA A (ESCALA / PERFORMANCE)
    // Objetivo: lucro + volume
    // Critério: >= 2 vendas em Ads E ACOS dentro da margem
    // Regra: Nunca misturar produto fraco aqui
    if (sales >= 2 && acos <= allowedAcos * 1.2) {
      return { curve: 'A' as const, action: 'active' as const, reason: `Performance: ${sales} vendas, ACOS ${acos.toFixed(2)}` };
    }

    // 🟡 CURVA B (OTIMIZAÇÃO / PROMESSA)
    // Objetivo: descobrir próximos vencedores
    // Critério: 1 venda (ou mais mas ACOS ainda não ideal para A)
    // Regra: Produto bate 2 vendas -> PROMOVE para A (se ACOS permitir)
    if (sales >= 1) {
      // Se tiver 2 vendas mas ACOS ruim, fica na B (Otimização)
      return { curve: 'B' as const, action: 'active' as const, reason: `Otimização: ${sales} vendas` };
    }

    // Se sales === 0 e clicks < 15:
    // Produto novo, refeito ou sazonal -> Entra em C
    return { curve: 'C' as const, action: 'active' as const, reason: `Teste: ${clicks} cliques (novo/sazonal)` };
  }

  async classifyProducts(workspaceId: string): Promise<{ items: ClassifiedProduct[]; summary: Record<string, number> }> {
    const pool = getPool();
    const { rows } = await pool.query(
      `select id, ml_item_id, classification, revenue_30d, sales_30d, conversion_rate_30d, profit_unit, ads_active, title, sku
       from products
       where workspace_id = $1
         and status != 'deleted'
         and ml_item_id is not null`,
      [workspaceId],
    );

    const mlItemIds = rows.map((r) => r.ml_item_id as string);
    const metricsByItem = await this.fetchAdsMetricsByItem(workspaceId, mlItemIds);
    const items: ClassifiedProduct[] = [];
    const summary: Record<string, number> = { A: 0, B: 0, C: 0 };

    for (const row of rows) {
      // NOTE: Estamos usando as métricas do Ads (metricsByItem) para decidir a curva, 
      // e não mais o revenue_30d/sales_30d gerais do produto que vinham do banco.
      const adsMetrics = metricsByItem.get(row.ml_item_id) || { cost: 0, clicks: 0, prints: 0, sales: 0, revenue: 0, cpc: 0, ctr: 0 };
      
      const revenue = adsMetrics.revenue;
      const sales = adsMetrics.sales;
      const cost = adsMetrics.cost;
      const clicks = adsMetrics.clicks;
      const profitUnit = typeof row.profit_unit === 'number' ? row.profit_unit : null;
      const classification = String(row.classification || '').toUpperCase();

      // Prefer the classification calculated pelo Analytics Full
      const decision = (() => {
        if (['A', 'B', 'C'].includes(classification)) {
          // Só temos curvas A/B/C nas campanhas
          const curve: 'A' | 'B' | 'C' = classification === 'A'
            ? 'A'
            : classification === 'B'
              ? 'B'
              : 'C';
          return { curve, action: 'active' as const, reason: `Classificação Full: ${classification}` };
        }
        // Fallback para heurística baseada em ACOS se não houver classificação
        return this.pickCurve({ revenue, sales, cost, clicks, profitUnit });
      })();

      const productCurve = decision.curve;
      const acos = revenue > 0 ? cost / revenue : cost > 0 ? Infinity : 0;

      items.push({
        productId: row.id,
        mlItemId: row.ml_item_id,
        curve: productCurve,
        title: row.title,
        sku: row.sku,
        reason: decision.reason,
        action: decision.action,
        sales30d: sales,
        revenue30d: revenue,
        cost30d: cost,
        acos,
      });
      summary[productCurve] = (summary[productCurve] || 0) + 1;
    }

    return { items, summary };
  }

  private buildCampaignName(curve: 'A' | 'B' | 'C', override?: string | null) {
    if (override) return override;
    if (curve === 'A') return '[Curva A] Performance';
    if (curve === 'B') return '[Curva B] Otimizacao';
    return '[Curva C] Teste Controlado';
  }

  async testCreateCampaign(workspaceId: string) {
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
    const pool = getPool();
    const { rows } = await pool.query(`select * from ml_ads_curves where workspace_id = $1 limit 1`, [workspaceId]);
    const curve: CurveRow = (rows[0] as CurveRow) || {
       id: 'test-curve-id',
       workspace_id: workspaceId,
       curve: 'C',
       name: 'Curve C',
       campaign_type: 'PRODUCT_ADS',
       daily_budget: 10,
       min_revenue_30d: 0,
       min_orders_30d: 0,
       min_roas: 5,
       min_conversion: 0,
       priority: 3
     };
    
    // if (!curve) throw new Error('No curves found for workspace');

    console.log('Testing campaign creation for:', { workspaceId, advertiserId, siteId, curve });

    const campaign = await this.createOrUpdateCampaign(
      workspaceId,
      advertiserId,
      siteId,
      curve,
      null, // existing
      { name: 'Trae Test Campaign ' + new Date().toISOString(), budget: 10 } // override
    );

    console.log('Campaign created:', campaign);

    // Find a product to add
    const prodRes = await pool.query(`select id, ml_item_id, title from products where workspace_id = $1 limit 1`, [workspaceId]);
    if (prodRes.rows.length > 0) {
        const p = prodRes.rows[0];
        console.log('Adding product to campaign:', p);
        
        const classifiedProduct: ClassifiedProduct = {
            productId: p.id,
            mlItemId: p.ml_item_id,
            curve: curve.curve,
            title: p.title
        };

        try {
            const adId = await this.upsertProductAd(
                workspaceId,
                advertiserId,
                siteId,
                campaign,
                curve.curve,
                classifiedProduct
            );
            console.log('Product added with Ad ID:', adId);
            return { campaign, adId };
        } catch (error: any) {
            console.error('Error adding product to campaign:', error);
            // Return campaign even if product addition fails
            return { campaign, error: error.message };
        }
    } else {
        console.warn('No products found to add to campaign');
        return { campaign, adId: null };
    }
  }

  private async createOrUpdateCampaign(
    workspaceId: string,
    advertiserId: string,
    siteId: string,
    curve: CurveRow,
    existing?: CampaignRow | null,
    override?: { name?: string; budget?: number },
  ): Promise<CampaignRow> {
    const pool = getPool();
    const name = this.buildCampaignName(curve.curve, override?.name);
    const dailyBudget = typeof override?.budget === 'number' && Number.isFinite(override.budget)
      ? override.budget
      : curve.daily_budget;
    let mlCampaignId = existing?.ml_campaign_id || null;

    // Se já existe uma campanha vinculada, não altere nome/orçamento remoto (pedido do usuário:
    // "não mexa na campanha já existente"). Apenas garanta o registro local.
    if (!mlCampaignId) {
      // Mapeamento de estratégia baseado na curva
      let strategy = 'visibility';
      let roasTarget: number | undefined;

      if (curve.curve === 'A') {
        strategy = 'profitability';
        roasTarget = Math.max(1, curve.min_roas || 3);
      } else if (curve.curve === 'B') {
        strategy = 'growth';
        roasTarget = Math.max(1, curve.min_roas || 1.5);
      } else {
        // C -> Test -> Visibility
        strategy = 'visibility';
      }

      const createPayload: any = {
        name,
        status: 'active',
        budget: dailyBudget,
        strategy,
        channel: 'marketplace',
      };
      
      if (roasTarget) {
        createPayload.roas_target = roasTarget;
      }

      try {
        const created = await requestWithAuth<any>(
          workspaceId,
          `${ADS_ADVERTISER_API_BASE}/${advertiserId}/campaigns`,
          {
            method: 'POST',
            data: createPayload,
            headers: { 'api-version': '2' },
          },
        );
        mlCampaignId = created?.id || created?.campaign_id || null;
      } catch (err: any) {
        const status = err?.response?.status;
        const data = err?.response?.data;
        console.warn(`[MercadoAds] Create campaign via Standard API failed (${status}). Trying Marketplace API...`);

        // Fallback: Tentar via Marketplace API se a API padrão falhar (401/403)
        if (status === 401 || status === 403) {
            try {
                const created = await requestWithAuth<any>(
                    workspaceId,
                    `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns`,
                    {
                        method: 'POST',
                        data: createPayload,
                        headers: { 'api-version': '2' },
                    },
                );
                mlCampaignId = created?.id || created?.campaign_id || null;
            } catch (err2: any) {
                const status2 = err2?.response?.status;
                const data2 = err2?.response?.data;
                console.error('[MercadoAds] Create campaign via Marketplace API failed:', status2, JSON.stringify(data2, null, 2));
                
                // Se ambas falharem com erro de permissão, lançar erro específico
                if (status2 === 401 || status2 === 403) {
                    throw new Error('ml_ads_permission_denied_write');
                }
                // Se retornar 404, assume que não suporta criação
                if (status2 === 404 || status2 === 405) {
                    throw new Error('ml_ads_campaign_create_not_supported');
                }
                throw err2;
            }
        } else {
             // Se API retorna 404/405 na API padrão, provavelmente a conta está em modo automático ou sem permissão de Product Ads.
            if (status === 404 || status === 405) {
                throw new Error('ml_ads_campaign_create_not_supported');
            }
            throw err;
        }
      }
    }

    const { rows } = await pool.query<CampaignRow>(
      `insert into ml_ads_campaigns (
         workspace_id, curve_id, curve, campaign_type, advertiser_id,
         ml_campaign_id, name, status, daily_budget, automation_status,
         last_synced_at, last_automation_at
       ) values ($1,$2,$3,$4,$5,$6,$7,'active',$8,'managed', now(), now())
       on conflict (workspace_id, curve) do update set
         curve_id = excluded.curve_id,
         curve = excluded.curve,
         campaign_type = excluded.campaign_type,
         name = excluded.name,
         ml_campaign_id = excluded.ml_campaign_id,
         status = excluded.status,
         daily_budget = excluded.daily_budget,
         last_synced_at = now(),
         last_automation_at = now()
       returning *`,
      [
        workspaceId,
        null, // curve.id might be invalid UUID or not needed
        curve.curve,
        curve.campaign_type,
        advertiserId,
        mlCampaignId,
        name,
        dailyBudget,
      ],
    );

    return rows[0];
  }

  private async ensureCampaigns(
    workspaceId: string,
    advertiserId: string,
    siteId: string,
    curves: CurveRow[],
    overrides?: PlanInput,
  ): Promise<Map<'A' | 'B' | 'C', CampaignRow>> {
    const pool = getPool();
    const { rows: existing } = await pool.query<CampaignRow>(
      `select * from ml_ads_campaigns where workspace_id = $1`,
      [workspaceId],
    );
    const byCurve = new Map<'A' | 'B' | 'C', CampaignRow>();

    for (const curve of curves) {
      const current = existing.find((c) => c.curve === curve.curve) || null;
      const campaign = await this.createOrUpdateCampaign(
        workspaceId,
        advertiserId,
        siteId,
        curve,
        current,
        {
          name: overrides?.names?.[curve.curve],
          budget: overrides?.budgets?.[curve.curve],
        },
      );
      byCurve.set(curve.curve, campaign);
    }
    return byCurve;
  }

  private async upsertProductAd(
    workspaceId: string,
    advertiserId: string,
    siteId: string,
    campaign: CampaignRow,
    curve: 'A' | 'B' | 'C',
    product: ClassifiedProduct,
  ): Promise<string | null> {
    const pool = getPool();
    const bid = this.resolveBid(curve);

    const existing = await pool.query(
      `select id, ml_ad_id from ml_ads_campaign_products
       where workspace_id = $1 and ml_item_id = $2
       order by added_at desc
       limit 1`,
      [workspaceId, product.mlItemId],
    );
    const currentAdId = existing.rows[0]?.ml_ad_id || null;

    let remoteId = currentAdId;
    const status = product.action === 'paused' ? 'paused' : 'active';
    const payload = {
      campaign_id: campaign.ml_campaign_id,
      item_id: product.mlItemId,
      status,
      bid: { max_cpc: bid },
    };

    if (remoteId) {
      try {
        await requestWithAuth(
          workspaceId,
          `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads/${remoteId}`,
          { method: 'PUT', data: payload, headers: { 'api-version': '2' } },
        );
      } catch (err: any) {
        if (err?.response?.status === 404) {
          remoteId = null; // força recriação
        } else {
          throw err;
        }
      }
    } else {
      try {
        const created = await requestWithAuth<any>(
          workspaceId,
          `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads`,
          { method: 'POST', data: payload, headers: { 'api-version': '2' } },
        );
        remoteId = created?.id || created?.product_ad_id || null;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
           console.warn(`[MercadoAds] Create ad via Standard API failed (${status}). Trying Marketplace API...`);
           try {
             const created = await requestWithAuth<any>(
                workspaceId,
                `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads`,
                { method: 'POST', data: payload, headers: { 'api-version': '2' } },
             );
             remoteId = created?.id || created?.product_ad_id || null;
           } catch (err2: any) {
             console.error('[MercadoAds] Create ad via Marketplace API failed:', err2?.response?.status, JSON.stringify(err2?.response?.data, null, 2));
             throw err2;
           }
        } else {
            throw err;
        }
      }
    }

    if (!remoteId) {
      throw new Error('ml_ads_product_ad_create_failed');
    }

    await pool.query(
      `delete from ml_ads_campaign_products
       where workspace_id = $1 and ml_item_id = $2 and campaign_id <> $3`,
      [workspaceId, product.mlItemId, campaign.id],
    );

    await pool.query(
      `insert into ml_ads_campaign_products (
         workspace_id, campaign_id, product_id, ml_item_id, ml_ad_id, curve, source, status, added_at, last_moved_at
       ) values ($1,$2,$3,$4,$5,$6,'automation',$7, now(), now())
       on conflict (campaign_id, ml_item_id) do update set
         product_id = excluded.product_id,
         ml_ad_id = coalesce(excluded.ml_ad_id, ml_ads_campaign_products.ml_ad_id),
         curve = excluded.curve,
         status = excluded.status,
         last_moved_at = now()`,
      [
        workspaceId,
        campaign.id,
        product.productId,
        product.mlItemId,
        remoteId,
        curve,
        status,
      ],
    );

    return remoteId;
  }

  async planAutomation(workspaceId: string, input?: PlanInput) {
    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) throw new Error('ml_not_connected');
    const { advertiserId } = await this.resolveAdvertiserContext(workspaceId);
    const curves = await this.ensureCurveDefaults(workspaceId);
    const classification = await this.classifyProducts(workspaceId);
    const pool = getPool();
    const { rows: existing } = await pool.query<CampaignRow>(
      `select * from ml_ads_campaigns where workspace_id = $1`,
      [workspaceId],
    );

    const planCampaigns: CampaignPlan[] = curves.map((c) => {
      const current = existing.find((x) => x.curve === c.curve);
      const budget = typeof input?.budgets?.[c.curve] === 'number' && Number.isFinite(input?.budgets?.[c.curve])
        ? Number(input?.budgets?.[c.curve])
        : c.daily_budget;
      const name = this.buildCampaignName(c.curve, input?.names?.[c.curve]);
      return {
        curve: c.curve,
        name,
        budget,
        action: current ? 'update' : 'create',
        currentCampaignId: current?.id,
        mlCampaignId: current?.ml_campaign_id,
      };
    });

    const movements: MovementPlan[] = classification.items.map((p) => ({
      productId: p.productId,
      mlItemId: p.mlItemId,
      curve: p.curve,
      targetCampaignId: existing.find((c) => c.curve === p.curve)?.id || null,
      title: p.title,
      sku: p.sku,
      reason: p.reason,
      sales30d: p.sales30d,
      revenue30d: p.revenue30d,
      cost30d: p.cost30d,
      acos: p.acos,
    }));

    return {
      summary: classification.summary,
      planCampaigns,
      movements,
      advertiserId,
    };
  }

  private async fetchCampaignHistory(
    workspaceId: string,
    advertiserId: string,
    siteId: string,
    mlCampaignId: string,
    days: number
  ) {
    const { dateFrom, dateTo } = this.getDateRange(days);
    try {
      const resp = await requestWithAuth<any>(
        workspaceId,
        `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/${mlCampaignId}/search`,
        {
          params: {
            date_from: dateFrom,
            date_to: dateTo,
            metrics: 'roas',
            aggregation_type: 'DAILY',
          },
          headers: { 'api-version': '2' },
        },
      );
      return resp?.results || [];
    } catch (err) {
      console.warn(`[MercadoAds] Failed to fetch history for campaign ${mlCampaignId}`, err);
      return [];
    }
  }

  private async optimizeBudgets(
    workspaceId: string,
    advertiserId: string,
    siteId: string,
    campaigns: Map<'A' | 'B' | 'C', CampaignRow>
  ) {
    const curveA = campaigns.get('A');
    if (!curveA?.ml_campaign_id || !curveA.daily_budget) return;

    // Check frequency: only run once every 24h
    const lastOpt = curveA.metadata?.last_budget_opt;
    if (lastOpt) {
      const lastDate = new Date(lastOpt);
      const now = new Date();
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24) {
        console.log('[MercadoAds] Skipping budget optimization (last run < 24h ago)');
        return;
      }
    }

    // Regras apenas para Curva A por enquanto
    // Se ROAS >= 3 por 7 dias → +20% orçamento
    // Se ROAS < 2 por 3 dias → −30% orçamento

    const history7d = await this.fetchCampaignHistory(workspaceId, advertiserId, siteId, curveA.ml_campaign_id, 7);
    
    if (history7d.length === 0) return;

    // Ordenar por data (mais recente por último)
    const sorted = history7d.sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    // Check last 7 days for ROAS >= 3
    // Precisa ter dados de 7 dias
    const last7 = sorted.slice(-7);
    const allAbove3 = last7.length >= 7 && last7.every((d: any) => Number(d.roas || 0) >= 3);

    // Check last 3 days for ROAS < 2
    const last3 = sorted.slice(-3);
    const allBelow2 = last3.length >= 3 && last3.every((d: any) => Number(d.roas || 0) < 2);

    let newBudget = Number(curveA.daily_budget);
    let changed = false;

    if (allAbove3) {
      newBudget = newBudget * 1.2;
      changed = true;
      console.log(`[MercadoAds] Increasing Curve A budget: ${curveA.daily_budget} -> ${newBudget} (ROAS >= 3 for 7 days)`);
    } else if (allBelow2) {
      newBudget = newBudget * 0.7;
      changed = true;
      console.log(`[MercadoAds] Decreasing Curve A budget: ${curveA.daily_budget} -> ${newBudget} (ROAS < 2 for 3 days)`);
    }

    if (changed) {
      try {
        await this.updateCampaignBudget(workspaceId, curveA.id, Math.round(newBudget));
        // Update metadata
        const pool = getPool();
        const newMeta = { ...(curveA.metadata || {}), last_budget_opt: new Date().toISOString() };
        await pool.query(`update ml_ads_campaigns set metadata = $1 where id = $2`, [newMeta, curveA.id]);
      } catch (err) {
        console.error('[MercadoAds] Failed to update budget:', err);
      }
    }
  }

  async applyAutomation(workspaceId: string, input?: PlanInput) {
    const credentials = await getMercadoLivreCredentials(workspaceId);
    if (!credentials) {
      throw new Error('ml_not_connected');
    }
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
    const curves = await this.ensureCurveDefaults(workspaceId);
    const classification = await this.classifyProducts(workspaceId);
    let campaigns: Map<'A' | 'B' | 'C', CampaignRow>;
    try {
      campaigns = await this.ensureCampaigns(workspaceId, advertiserId, siteId, curves, input);
    } catch (err: any) {
      const message = err?.message || '';
      // Fallback: se não pode criar/atualizar campanha, usa as existentes para anexar/pause anúncios
      if (message === 'ml_ads_campaign_create_not_supported') {
        await this.syncExistingCampaigns(workspaceId).catch(() => {});
        campaigns = await this.getExistingCampaignsMap(workspaceId);
        if (campaigns.size === 0) {
          throw new Error('ml_ads_no_existing_campaigns');
        }
        
        // Se a criação falhou e estamos usando fallback, precisamos garantir que as curvas
        // estão devidamente mapeadas. O getExistingCampaignsMap pode ter colapsado tudo
        // em uma única campanha, o que não é desejado para a automação completa.
        const missing = curves.filter(c => {
             const camp = campaigns.get(c.curve);
             return !camp || camp.curve !== c.curve;
        });
        
        if (missing.length > 0) {
           console.warn('[MercadoAds] Falta mapeamento para curvas:', missing.map(c => c.curve));
           throw new Error('ml_ads_manual_campaign_creation_required');
        }
      } else {
        throw err;
      }
    }

    // Otimização de Orçamento (Regras da Curva A)
    await this.optimizeBudgets(workspaceId, advertiserId, siteId, campaigns);

    const errors: Array<{ productId: string; error: string }> = [];
    let processedCount = 0;

    for (const product of classification.items) {
      const targetCampaign = campaigns.get(product.curve);
      if (!targetCampaign?.ml_campaign_id) continue;
      
      try {
        await this.upsertProductAd(workspaceId, advertiserId, siteId, targetCampaign, product.curve, product);
        processedCount++;
      } catch (err: any) {
        console.warn(`[MercadoAds] Failed to upsert ad for product ${product.productId} (item: ${product.mlItemId}):`, err?.message);
        errors.push({
          productId: product.productId,
          error: err?.message || 'Unknown error'
        });
      }
    }

    return {
      summary: classification.summary,
      campaigns: Array.from(campaigns.values()),
      curves,
      totalProducts: classification.items.length,
      processedCount,
      errors
    };
  }

  async listCampaigns(workspaceId: string) {
    const pool = getPool();
    // Sincroniza campanhas existentes a partir da API oficial (não cria nem altera remoto)
    await this.syncExistingCampaigns(workspaceId).catch((err) => {
      console.warn('[MercadoAds] Não foi possível sincronizar campanhas existentes:', err?.message || err);
    });
    // Sincroniza anúncios das campanhas existentes (popular contagem na UI)
    await this.syncCampaignProducts(workspaceId).catch((err) => {
      console.warn('[MercadoAds] Não foi possível sincronizar anúncios das campanhas:', err?.message || err);
    });
    const metrics = await this.fetchCampaignMetrics(workspaceId).catch((err) => {
      console.warn('[MercadoAds] Não foi possível trazer métricas de campanhas:', err?.message || err);
      return null;
    });
    await this.ensureCurveDefaults(workspaceId);
    const { rows } = await pool.query(
      `select
         c.*,
         cv.daily_budget as curve_daily_budget,
         cv.min_revenue_30d,
         cv.min_orders_30d,
         cv.min_roas,
         cv.min_conversion,
         count(cp.id) as total_products,
         coalesce(sum(case when cp.status = 'active' then 1 else 0 end), 0) as active_products,
         coalesce(avg(p.conversion_rate_30d), 0) as avg_conversion,
         coalesce(avg(p.revenue_30d), 0) as avg_revenue
       from ml_ads_campaigns c
       left join ml_ads_curves cv on cv.id = c.curve_id
       left join ml_ads_campaign_products cp on cp.campaign_id = c.id
       left join products p on p.id = cp.product_id
       where c.workspace_id = $1
       group by c.id, cv.daily_budget, cv.min_revenue_30d, cv.min_orders_30d, cv.min_roas, cv.min_conversion`,
      [workspaceId],
    );
    return { campaigns: rows, metrics };
  }

  private async syncExistingCampaigns(workspaceId: string) {
    const pool = getPool();
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);

    try {
      const fetchCampaigns = async (url: string) => {
        const campaigns: any[] = [];
        let offset = 0;
        const limit = 50;
        while (true) {
          const data = await requestWithAuth<any>(
            workspaceId,
            url,
            {
              params: { limit, offset },
              headers: { 'api-version': '2' },
            },
          );
          const page = data?.results || [];
          campaigns.push(...page);
          if (page.length < limit) break;
          offset += limit;
        }
        return campaigns;
      };

      const resultsById = new Map<string, any>();
      let standardFailed = false;
      try {
        const standard = await fetchCampaigns(`${ADS_ADVERTISER_API_BASE}/${advertiserId}/campaigns/search`);
        for (const camp of standard) {
          const remoteId = camp?.id || camp?.campaign_id || camp?.ml_campaign_id;
          if (!remoteId) continue;
          resultsById.set(String(remoteId), camp);
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          console.warn(`[MercadoAds] Search campaigns via Standard API failed (${status}). Trying Marketplace API...`);
          standardFailed = true;
        } else {
          throw err;
        }
      }

      const marketplaceUrl = `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/search`;
      if (standardFailed || resultsById.size === 0) {
        try {
          const marketplace = await fetchCampaigns(marketplaceUrl);
          for (const camp of marketplace) {
            const remoteId = camp?.id || camp?.campaign_id || camp?.ml_campaign_id;
            if (!remoteId) continue;
            if (!resultsById.has(String(remoteId))) {
              resultsById.set(String(remoteId), camp);
            }
          }
        } catch (err2: any) {
          console.error('[MercadoAds] Search campaigns via Marketplace API failed:', err2?.message);
          if (standardFailed) throw err2;
        }
      } else {
        try {
          const marketplace = await fetchCampaigns(marketplaceUrl);
          for (const camp of marketplace) {
            const remoteId = camp?.id || camp?.campaign_id || camp?.ml_campaign_id;
            if (!remoteId) continue;
            if (!resultsById.has(String(remoteId))) {
              resultsById.set(String(remoteId), camp);
            }
          }
        } catch (err2: any) {
          console.warn('[MercadoAds] Marketplace campaigns fetch skipped:', err2?.message);
        }
      }

      const { rows: existingRows } = await pool.query<{ id: string; ml_campaign_id: string | null; curve: string | null }>(
        `select id, ml_campaign_id, curve from ml_ads_campaigns where workspace_id = $1`,
        [workspaceId],
      );
      const existingByRemoteId = new Map<string, { id: string; curve: string | null }>();
      const existingByCurve = new Map<string, { id: string; ml_campaign_id: string | null }>();
      existingRows.forEach((row) => {
        if (row.ml_campaign_id) existingByRemoteId.set(String(row.ml_campaign_id), { id: row.id, curve: row.curve });
        if (row.curve) existingByCurve.set(row.curve, { id: row.id, ml_campaign_id: row.ml_campaign_id });
      });

      for (const camp of resultsById.values()) {
        const remoteId = camp.id || camp.campaign_id || camp.ml_campaign_id;
        if (!remoteId) continue;
        const status = camp.status || 'active';
        const budget = typeof camp.budget === 'number' ? camp.budget : null;
        const name = camp.name || `Campanha ${remoteId}`;

        // Auto-detect curve from name (Manual workaround support)
        let detectedCurve: string | null = null;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('curva a')) detectedCurve = 'A';
        else if (lowerName.includes('curva b')) detectedCurve = 'B';
        else if (lowerName.includes('curva c')) detectedCurve = 'C';

        const existing = existingByRemoteId.get(String(remoteId));
        if (existing) {
          await pool.query(
            `update ml_ads_campaigns
               set name = $1,
                   status = $2,
                   daily_budget = $3,
                   advertiser_id = $4,
                   automation_status = 'manual',
                   curve = coalesce(curve, $5),
                   last_synced_at = now(),
                   updated_at = now()
             where id = $6`,
            [
              name,
              status,
              budget,
              advertiserId,
              detectedCurve,
              existing.id,
            ],
          );
          continue;
        }

        if (detectedCurve && existingByCurve.has(detectedCurve)) {
          const existingCurve = existingByCurve.get(detectedCurve)!;
          const { rows } = await pool.query<{ id: string }>(
            `update ml_ads_campaigns
               set ml_campaign_id = $1,
                   name = $2,
                   status = $3,
                   daily_budget = $4,
                   advertiser_id = $5,
                   automation_status = 'manual',
                   last_synced_at = now(),
                   updated_at = now()
             where workspace_id = $6 and curve = $7
             returning id`,
            [
              String(remoteId),
              name,
              status,
              budget,
              advertiserId,
              workspaceId,
              detectedCurve,
            ],
          );
          const updatedId = rows[0]?.id || existingCurve.id;
          existingByRemoteId.set(String(remoteId), { id: updatedId, curve: detectedCurve });
          continue;
        }

        if (detectedCurve) {
          const { rows } = await pool.query<{ id: string }>(
            `insert into ml_ads_campaigns (
               workspace_id, curve, campaign_type, advertiser_id, ml_campaign_id, name, status, daily_budget,
               automation_status, last_synced_at, updated_at
             ) values ($1, $7, 'PRODUCT_ADS', $2, $3, $4, $5, $6, 'manual', now(), now())
             on conflict (workspace_id, curve) do update set
               ml_campaign_id = excluded.ml_campaign_id,
               name = excluded.name,
               status = excluded.status,
               daily_budget = excluded.daily_budget,
               advertiser_id = excluded.advertiser_id,
               automation_status = excluded.automation_status,
               last_synced_at = now(),
               updated_at = now()
             returning id`,
            [
              workspaceId,
              advertiserId,
              String(remoteId),
              name,
              status,
              budget,
              detectedCurve,
            ],
          );
          if (rows[0]?.id) {
            existingByRemoteId.set(String(remoteId), { id: rows[0].id, curve: detectedCurve });
            existingByCurve.set(detectedCurve, { id: rows[0].id, ml_campaign_id: String(remoteId) });
          }
          continue;
        }

        const { rows } = await pool.query<{ id: string }>(
          `insert into ml_ads_campaigns (
             workspace_id, curve, campaign_type, advertiser_id, ml_campaign_id, name, status, daily_budget,
             automation_status, last_synced_at, updated_at
           ) values ($1, $7, 'PRODUCT_ADS', $2, $3, $4, $5, $6, 'manual', now(), now())
           on conflict (workspace_id, ml_campaign_id) do update set
             name = excluded.name,
             status = excluded.status,
             daily_budget = excluded.daily_budget,
             advertiser_id = excluded.advertiser_id,
             automation_status = excluded.automation_status,
             curve = coalesce(ml_ads_campaigns.curve, excluded.curve),
             last_synced_at = now(),
             updated_at = now()
           returning id`,
          [
            workspaceId,
            advertiserId,
            String(remoteId),
            name,
            status,
            budget,
            detectedCurve,
          ],
        );
        if (rows[0]?.id) {
          existingByRemoteId.set(String(remoteId), { id: rows[0].id, curve: detectedCurve });
          if (detectedCurve) existingByCurve.set(detectedCurve, { id: rows[0].id, ml_campaign_id: String(remoteId) });
        }
      }
    } catch (err: any) {
      console.error('[MercadoAds] Sync existing campaigns failed:', err?.message, err?.response?.data);
      // 404/405 indicam que a conta/token não tem permissões para Product Ads API
      const status = err?.response?.status;
      if (status === 404 || status === 405) return;
      throw err;
    }
  }

  private async getExistingCampaignsMap(workspaceId: string): Promise<Map<'A' | 'B' | 'C', CampaignRow>> {
    const pool = getPool();
    const { rows } = await pool.query<CampaignRow>(
      `select * from ml_ads_campaigns where workspace_id = $1 and ml_campaign_id is not null and status != 'archived'`,
      [workspaceId],
    );
    const map = new Map<'A' | 'B' | 'C', CampaignRow>();
    // Preenche por curva quando existir
    rows.forEach((c) => {
      if (c.curve && ['A', 'B', 'C'].includes(c.curve)) {
        map.set(c.curve as 'A' | 'B' | 'C', c);
      }
    });
    // Se faltar curva, usa a primeira campanha disponível como fallback
    const first = rows[0] || null;
    (['A', 'B', 'C'] as const).forEach((curve) => {
      if (!map.has(curve) && first) {
        map.set(curve, first);
      }
    });
    return map;
  }

  private getDateRange(days: number = 30) {
    const timeZone = 'America/Sao_Paulo';
    
    // 1. Get current date components in Brazil Time
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    
    const parts = fmt.formatToParts(new Date());
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '1970', 10);

    // 2. Construct "Noon" date object to safely perform arithmetic
    // Using local server time for the Date object is fine because we just want to subtract 24h chunks
    // and we already have the correct "Brazil" day/month/year as starting point.
    // Noon (12:00) avoids any edge cases with midnight boundaries.
    const dateToObj = new Date(year, month - 1, day, 12, 0, 0);
    
    const dateFromObj = new Date(dateToObj);
    // Subtract days-1 to include today in the count (e.g., 30 days = Today + 29 past days)
    dateFromObj.setDate(dateFromObj.getDate() - (days - 1));

    // 3. Format back to YYYY-MM-DD
    const toStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const fDay = dateFromObj.getDate();
    const fMonth = dateFromObj.getMonth() + 1;
    const fYear = dateFromObj.getFullYear();
    const fromStr = `${fYear}-${String(fMonth).padStart(2, '0')}-${String(fDay).padStart(2, '0')}`;
    
    return { dateFrom: fromStr, dateTo: toStr };
  }

  private async syncCampaignProducts(workspaceId: string) {
    const pool = getPool();
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);

    try {
      // Mapeia campanhas existentes (ml_campaign_id -> id, curve)
      const { rows: campaigns } = await pool.query(
        `select id, ml_campaign_id, curve from ml_ads_campaigns where workspace_id = $1 and ml_campaign_id is not null`,
        [workspaceId],
      );
      const campaignByRemoteId = new Map<string, { id: string; curve: string | null }>();
      campaigns.forEach((c) => {
        if (c.ml_campaign_id) campaignByRemoteId.set(String(c.ml_campaign_id), { id: c.id, curve: c.curve });
      });

      const productIdCache = new Map<string, string | null>();
      const { dateFrom, dateTo } = this.getDateRange(30);
      const limit = 200;

      let useMarketplace = false;
      const fetchAdsPage = async (params: Record<string, any>) => {
        if (useMarketplace) {
          return requestWithAuth<any>(
            workspaceId,
            `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads/search`,
            { params, headers: { 'api-version': '2' } },
          );
        }
        try {
          return await requestWithAuth<any>(
            workspaceId,
            `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads/search`,
            { params, headers: { 'api-version': '2' } },
          );
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 401 || status === 403 || status === 404) {
            useMarketplace = true;
            return requestWithAuth<any>(
              workspaceId,
              `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/ads/search`,
              { params, headers: { 'api-version': '2' } },
            );
          }
          throw err;
        }
      };

      const needsDateRange = (err: any) => {
        const status = err?.response?.status;
        if (status !== 400) return false;
        const message = String(err?.response?.data?.message || err?.response?.data?.error || err?.message || '').toLowerCase();
        return message.includes('date_from') || message.includes('date_to') || message.includes('date');
      };

      const runSearch = async (withDateRange: boolean) => {
        const byCampaign = new Map<string, { total: number; active: number }>();
        let offset = 0;
        while (true) {
          const params: Record<string, any> = {
            limit,
            offset,
            'filters[statuses]': 'active,paused,idle',
          };
          if (withDateRange) {
            params.date_from = dateFrom;
            params.date_to = dateTo;
            params.metrics = 'clicks,prints,cost,cpc,acos,roas,units_quantity,total_amount';
          }

          const data = await fetchAdsPage(params);
          const results = data?.results || [];
          for (const ad of results) {
            const cid = ad.campaign_id ? String(ad.campaign_id) : null;
            if (!cid) continue;
            const campaignRef = campaignByRemoteId.get(cid);
            // Upsert vínculo produto-campanha quando soubermos o campaign_id interno
            if (campaignRef) {
              const mlItemId = ad.item_id || ad.itemId || ad.id;
              const mlAdId = ad.id || ad.ad_id || ad.product_ad_id || null;
              let productId: string | null = null;
              if (mlItemId) {
                if (productIdCache.has(mlItemId)) {
                  productId = productIdCache.get(mlItemId) as string | null;
                } else {
                  const { rows: prodRows } = await pool.query(
                    `select id from products where workspace_id = $1 and ml_item_id = $2 limit 1`,
                    [workspaceId, mlItemId],
                  );
                  productId = prodRows[0]?.id || null;
                  productIdCache.set(mlItemId, productId);
                }
              }

              await pool.query(
                `insert into ml_ads_campaign_products (
                   workspace_id, campaign_id, product_id, ml_item_id, ml_ad_id, curve, source, status, added_at, last_moved_at
                 ) values ($1,$2,$3,$4,$5,$6,'manual',$7, now(), now())
                 on conflict (campaign_id, ml_item_id) do update set
                   product_id = coalesce(excluded.product_id, ml_ads_campaign_products.product_id),
                   ml_ad_id = coalesce(excluded.ml_ad_id, ml_ads_campaign_products.ml_ad_id),
                   curve = excluded.curve,
                   status = excluded.status,
                   last_moved_at = now()`,
                [
                  workspaceId,
                  campaignRef.id,
                  productId,
                  mlItemId || null,
                  mlAdId,
                  campaignRef.curve || 'C',
                  (ad.status || 'active').toLowerCase(),
                ],
              );
            }

            const bucket = byCampaign.get(cid) || { total: 0, active: 0 };
            bucket.total += 1;
            if ((ad.status || '').toLowerCase() === 'active') bucket.active += 1;
            byCampaign.set(cid, bucket);
          }

          if (!results.length || results.length < limit) break;
          offset += limit;
        }

        return byCampaign;
      };

      let byCampaign: Map<string, { total: number; active: number }>;
      try {
        byCampaign = await runSearch(false);
      } catch (err: any) {
        if (needsDateRange(err)) {
          byCampaign = await runSearch(true);
        } else {
          throw err;
        }
      }

      for (const [cid, counts] of byCampaign.entries()) {
        await pool.query(
          `update ml_ads_campaigns
             set total_products = $1,
                 active_products = $2,
                 last_synced_at = now(),
                 updated_at = now()
           where workspace_id = $3 and ml_campaign_id = $4`,
          [counts.total, counts.active, workspaceId, cid],
        );
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) return;
      throw err;
    }
  }

  private async fetchCampaignMetrics(workspaceId: string): Promise<{
    summary: Record<string, number>;
    daily: Array<{ date: string; clicks: number; prints: number; cost: number; acos: number; roas: number; revenue: number; units: number }>;
    date_from: string;
    date_to: string;
  } | null> {
    const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
    const metricsList = 'clicks,prints,cost,cpc,acos,roas,units_quantity,total_amount,organic_units_quantity,organic_units_amount';
    const { dateFrom: date_from, dateTo: date_to } = this.getDateRange(30);

    // Summary
    let summary: Record<string, number> = {
      clicks: 0, prints: 0, cost: 0, cpc: 0, acos: 0, roas: 0, units: 0, revenue: 0, organic_units: 0, organic_revenue: 0,
    };

    try {
      const resp = await requestWithAuth<any>(
        workspaceId,
        `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/search`,
        {
          params: {
            limit: 50,
            offset: 0,
            date_from,
            date_to,
            metrics: metricsList,
            metrics_summary: true,
          },
          headers: { 'api-version': '2' },
        },
      );

      const ms = resp?.metrics_summary;
      if (ms) {
        summary = {
          clicks: Number(ms.clicks || 0),
          prints: Number(ms.prints || 0),
          cost: Number(ms.cost || 0),
          cpc: Number(ms.cpc || 0),
          acos: Number(ms.acos || 0),
          roas: Number(ms.roas || 0),
          units: Number(ms.units_quantity || 0),
          revenue: Number(ms.total_amount || 0),
          organic_units: Number(ms.organic_units_quantity || 0),
          organic_revenue: Number(ms.organic_units_amount || 0),
        };
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) return null;
      throw err;
    }

    // Daily
    const dailyMap = new Map<string, { clicks: number; prints: number; cost: number; acos: number; roas: number; revenue: number; units: number; organic_units: number; organic_revenue: number }>();
    try {
      let offset = 0;
      const limit = 50;
      while (true) {
        const resp = await requestWithAuth<any>(
          workspaceId,
          `${MKT_ADS_API_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/search`,
          {
            params: {
              limit,
              offset,
              date_from,
              date_to,
              metrics: metricsList,
              aggregation_type: 'DAILY',
            },
            headers: { 'api-version': '2' },
          },
        );

        const results = resp?.results || [];
        for (const row of results) {
          const date = row.date;
          if (!date) continue;
          const existing = dailyMap.get(date) || { clicks: 0, prints: 0, cost: 0, acos: 0, roas: 0, revenue: 0, units: 0, organic_units: 0, organic_revenue: 0 };
          existing.clicks += Number(row.clicks || 0);
          existing.prints += Number(row.prints || 0);
          existing.cost += Number(row.cost || 0);
          existing.acos += Number(row.acos || 0);
          existing.roas += Number(row.roas || 0);
          existing.revenue += Number(row.total_amount || 0);
          existing.units += Number(row.units_quantity || 0);
          existing.organic_units += Number(row.organic_units_quantity || 0);
          existing.organic_revenue += Number(row.organic_units_amount || 0);
          dailyMap.set(date, existing);
        }

        if (!results.length || results.length < limit) break;
        offset += limit;
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 405) {
        throw err;
      }
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { summary, daily, date_from, date_to };
  }

  async updateCampaignStatus(workspaceId: string, campaignId: string, status: 'active' | 'paused') {
    const pool = getPool();
    const { rows } = await pool.query<CampaignRow>(
      `select * from ml_ads_campaigns where id = $1 and workspace_id = $2`,
      [campaignId, workspaceId],
    );
    const campaign = rows[0];
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.ml_campaign_id) {
      const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
      try {
        await requestWithAuth(
          workspaceId,
          `${ADS_ADVERTISER_API_BASE}/${advertiserId}/campaigns/${campaign.ml_campaign_id}`,
          { method: 'PUT', data: { status }, headers: { 'api-version': '2' } },
        );
      } catch (err: any) {
         const statusCode = err?.response?.status;
         if (statusCode === 401 || statusCode === 403) {
             console.warn(`[MercadoAds] Update status via Standard API failed (${statusCode}). Trying Marketplace API...`);
             try {
                await requestWithAuth(
                  workspaceId,
                  `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/${campaign.ml_campaign_id}`,
                  { method: 'PUT', data: { status }, headers: { 'api-version': '2' } },
                );
             } catch (err2: any) {
                 console.error('[MercadoAds] Update status via Marketplace API failed:', err2?.response?.status, JSON.stringify(err2?.response?.data, null, 2));
                 throw err2;
             }
         } else {
             throw err;
         }
      }
    }

    await pool.query(
      `update ml_ads_campaigns set status = $1, last_synced_at = now() where id = $2`,
      [status, campaignId],
    );
    return this.listCampaigns(workspaceId);
  }

  async updateCampaignBudget(workspaceId: string, campaignId: string, dailyBudget: number) {
    const pool = getPool();
    const { rows } = await pool.query<CampaignRow>(
      `select * from ml_ads_campaigns where id = $1 and workspace_id = $2`,
      [campaignId, workspaceId],
    );
    const campaign = rows[0];
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.ml_campaign_id) {
      const { advertiserId, siteId } = await this.resolveAdvertiserContext(workspaceId);
      try {
          await requestWithAuth(
            workspaceId,
            `${ADS_ADVERTISER_API_BASE}/${advertiserId}/campaigns/${campaign.ml_campaign_id}`,
            {
              method: 'PUT',
              data: { budget: dailyBudget },
              headers: { 'api-version': '2' },
            },
          );
      } catch (err: any) {
          const statusCode = err?.response?.status;
          if (statusCode === 401 || statusCode === 403) {
              console.warn(`[MercadoAds] Update budget via Standard API failed (${statusCode}). Trying Marketplace API...`);
              try {
                  await requestWithAuth(
                    workspaceId,
                    `${MKT_ADS_MARKETPLACE_BASE}/${siteId}/advertisers/${advertiserId}/product_ads/campaigns/${campaign.ml_campaign_id}`,
                    {
                      method: 'PUT',
                      data: { budget: dailyBudget },
                      headers: { 'api-version': '2' },
                    },
                  );
              } catch (err2: any) {
                  console.error('[MercadoAds] Update budget via Marketplace API failed:', err2?.response?.status, JSON.stringify(err2?.response?.data, null, 2));
                  throw err2;
              }
          } else {
              throw err;
          }
      }
    }

    await pool.query(
      `update ml_ads_campaigns
         set daily_budget = $1,
             last_synced_at = now()
       where id = $2`,
      [dailyBudget, campaignId],
    );
    return this.listCampaigns(workspaceId);
  }
}

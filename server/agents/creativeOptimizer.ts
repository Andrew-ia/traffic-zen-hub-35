import { getPool } from '../config/database.js';

interface CreativeMetrics {
  creative_id: string;
  creative_name: string;
  creative_type: string;
  thumbnail_url: string | null;
  campaigns_count: number;
  ads_count: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
  first_seen: string;
  last_seen: string;
  days_active: number;
}

interface AgentConfig {
  min_ctr?: number;
  min_spend?: number;
  top_performer_percentile?: number;
  fatigue_days?: number;
  fatigue_threshold?: number;
}

export async function analyzeCreativePerformance(
  agentId: string,
  executionId: string,
  workspaceId: string,
  config: AgentConfig
) {
  const pool = getPool();
  const insights: any[] = [];

  try {
    // Configurações padrão
    const minCtr = config.min_ctr || 1.0;
    const minSpend = config.min_spend || 50;
    const topPerformerPercentile = config.top_performer_percentile || 0.2; // Top 20%
    const fatigueDays = config.fatigue_days || 14;
    const fatigueThreshold = config.fatigue_threshold || 0.3; // 30% de queda

    // Buscar criativos e suas métricas dos últimos 30 dias
    const query = `
      WITH creative_metrics AS (
        SELECT
          ca.id as creative_id,
          ca.name as creative_name,
          ca.type as creative_type,
          ca.thumbnail_url,
          COUNT(DISTINCT pm.campaign_id) as campaigns_count,
          COUNT(DISTINCT pm.ad_id) as ads_count,
          COALESCE(SUM(pm.spend), 0) as spend,
          COALESCE(SUM(pm.impressions), 0) as impressions,
          COALESCE(SUM(pm.clicks), 0) as clicks,
          COALESCE(SUM(pm.conversions), 0) as conversions,
          COALESCE(SUM(pm.conversion_value), 0) as revenue,
          CASE
            WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::numeric / SUM(pm.impressions) * 100)
            ELSE 0
          END as ctr,
          CASE
            WHEN SUM(pm.clicks) > 0 THEN (SUM(pm.spend) / SUM(pm.clicks))
            ELSE 0
          END as cpc,
          CASE
            WHEN SUM(pm.spend) > 0 THEN (SUM(pm.conversion_value) / SUM(pm.spend))
            ELSE 0
          END as roas,
          MIN(pm.metric_date) as first_seen,
          MAX(pm.metric_date) as last_seen,
          (MAX(pm.metric_date) - MIN(pm.metric_date)) + 1 as days_active
        FROM creative_assets ca
        INNER JOIN ads ad ON ad.creative_asset_id = ca.id
        INNER JOIN performance_metrics pm ON pm.ad_id = ad.id
          AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
        WHERE ca.workspace_id = $1
          AND ca.status = 'active'
        GROUP BY ca.id, ca.name, ca.type, ca.thumbnail_url
        HAVING SUM(pm.spend) > 0
      )
      SELECT * FROM creative_metrics
      ORDER BY spend DESC
    `;

    const result = await pool.query(query, [workspaceId]);
    const creatives: CreativeMetrics[] = result.rows;

    console.log(`🎨 Analisando ${creatives.length} criativos ativos`);

    if (creatives.length === 0) {
      console.log('ℹ️ Nenhum criativo com dados suficientes para análise');
      return 0;
    }

    // Calcular percentis para identificar top performers
    const sortedByCtr = [...creatives].sort((a, b) => b.ctr - a.ctr);
    const sortedByRoas = [...creatives].sort((a, b) => b.roas - a.roas);
    const topCtrThreshold = sortedByCtr[Math.floor(creatives.length * topPerformerPercentile)]?.ctr || 0;
    const topRoasThreshold = sortedByRoas[Math.floor(creatives.length * topPerformerPercentile)]?.roas || 0;

    // Analisar cada criativo
    for (const creative of creatives) {
      // 1. TOP PERFORMER: Criativo com excelente performance
      if (
        creative.ctr >= topCtrThreshold &&
        creative.roas >= topRoasThreshold &&
        creative.spend >= minSpend * 2
      ) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          creative_asset_id: creative.creative_id,
          insight_type: 'opportunity',
          severity: 'high',
          title: `Top Performer: ${creative.creative_name}`,
          description: `Este criativo está entre os ${(topPerformerPercentile * 100).toFixed(0)}% melhores! CTR de ${creative.ctr.toFixed(2)}% e ROAS de ${creative.roas.toFixed(2)}x. Já gerou R$ ${creative.spend.toFixed(2)} em ${creative.campaigns_count} campanhas.`,
          recommendation: 'ESCALAR: Criar mais anúncios usando este criativo e aumentar orçamento nas campanhas onde está sendo usado. Considerar criar variações testando diferentes CTAs e headlines.',
          metrics: {
            ctr: creative.ctr,
            roas: creative.roas,
            spend_30d: creative.spend,
            conversions_30d: creative.conversions,
            revenue_30d: creative.revenue,
            campaigns_count: creative.campaigns_count,
            ads_count: creative.ads_count,
            creative_type: creative.creative_type,
          },
        });
      }

      // 2. ALERTA: CTR muito baixo
      if (
        creative.ctr < minCtr &&
        creative.impressions > 1000 &&
        creative.spend >= minSpend
      ) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          creative_asset_id: creative.creative_id,
          insight_type: 'warning',
          severity: creative.ctr < minCtr * 0.5 ? 'high' : 'medium',
          title: `CTR baixo: ${creative.creative_name}`,
          description: `Criativo com CTR de apenas ${creative.ctr.toFixed(2)}% (meta: ${minCtr}%) apesar de ${creative.impressions.toLocaleString()} impressões. Gastou R$ ${creative.spend.toFixed(2)} com apenas ${creative.clicks} cliques.`,
          recommendation: creative.creative_type === 'image'
            ? 'Criar nova versão com design mais impactante, cores contrastantes e CTA mais visível. Considerar testar formato de vídeo.'
            : 'Revisar os primeiros 3 segundos do vídeo - hook não está capturando atenção. Testar variações com diferentes aberturas.',
          metrics: {
            ctr: creative.ctr,
            impressions_30d: creative.impressions,
            clicks_30d: creative.clicks,
            spend_30d: creative.spend,
            creative_type: creative.creative_type,
            min_ctr_target: minCtr,
          },
        });
      }

      // 3. FADIGA CRIATIVA: Detectar queda de performance ao longo do tempo
      if (creative.days_active >= fatigueDays && creative.spend >= minSpend * 2) {
        // Buscar métricas das primeiras e últimas semanas
        const fatigueQuery = `
          SELECT
            CASE
              WHEN pm.metric_date <= $2 THEN 'first_week'
              ELSE 'last_week'
            END as period,
            COALESCE(SUM(pm.impressions), 0) as impressions,
            COALESCE(SUM(pm.clicks), 0) as clicks,
            CASE
              WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::numeric / SUM(pm.impressions) * 100)
              ELSE 0
            END as ctr
          FROM performance_metrics pm
          INNER JOIN ads ad ON ad.id = pm.ad_id
          WHERE ad.creative_asset_id = $1
            AND (
              pm.metric_date BETWEEN $2 - INTERVAL '6 days' AND $2
              OR pm.metric_date >= CURRENT_DATE - INTERVAL '6 days'
            )
          GROUP BY period
        `;

        const fatigueResult = await pool.query(fatigueQuery, [
          creative.creative_id,
          creative.first_seen,
        ]);

        const firstWeek = fatigueResult.rows.find((r) => r.period === 'first_week');
        const lastWeek = fatigueResult.rows.find((r) => r.period === 'last_week');

        if (firstWeek && lastWeek && firstWeek.ctr > 0) {
          const ctrDrop = (firstWeek.ctr - lastWeek.ctr) / firstWeek.ctr;

          if (ctrDrop >= fatigueThreshold) {
            insights.push({
              ai_agent_id: agentId,
              execution_id: executionId,
              workspace_id: workspaceId,
              creative_asset_id: creative.creative_id,
              insight_type: 'alert',
              severity: ctrDrop >= 0.5 ? 'high' : 'medium',
              title: `Fadiga criativa detectada: ${creative.creative_name}`,
              description: `CTR caiu ${(ctrDrop * 100).toFixed(0)}% ao longo de ${creative.days_active} dias (de ${firstWeek.ctr.toFixed(2)}% para ${lastWeek.ctr.toFixed(2)}%). Público já viu este criativo muitas vezes.`,
              recommendation: 'URGENTE: Criar nova versão do criativo com elementos visuais diferentes. Pausar este criativo e rotacionar com versões frescas para evitar saturação do público.',
              metrics: {
                days_active: creative.days_active,
                first_week_ctr: firstWeek.ctr,
                last_week_ctr: lastWeek.ctr,
                ctr_drop_percent: ctrDrop * 100,
                spend_30d: creative.spend,
                creative_type: creative.creative_type,
              },
            });
          }
        }
      }

      // 4. ALERTA: Alto gasto com baixo retorno
      if (
        creative.spend >= minSpend * 3 &&
        creative.roas < 1.0 &&
        creative.conversions < 5
      ) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          creative_asset_id: creative.creative_id,
          insight_type: 'alert',
          severity: 'critical',
          title: `Criativo ineficiente: ${creative.creative_name}`,
          description: `Gastou R$ ${creative.spend.toFixed(2)} com ROAS de apenas ${creative.roas.toFixed(2)}x e ${creative.conversions} conversões. CTR: ${creative.ctr.toFixed(2)}%.`,
          recommendation: 'PAUSAR IMEDIATAMENTE: Este criativo não está convertendo. Substituir por criativos com melhor histórico de performance ou criar nova versão com abordagem diferente.',
          metrics: {
            spend_30d: creative.spend,
            roas: creative.roas,
            conversions_30d: creative.conversions,
            ctr: creative.ctr,
            revenue_30d: creative.revenue,
            creative_type: creative.creative_type,
          },
        });
      }

      // 5. RECOMENDAÇÃO: Criativo promissor para testar variações
      if (
        creative.ctr >= minCtr * 1.2 &&
        creative.spend >= minSpend &&
        creative.spend < minSpend * 3 &&
        creative.ads_count <= 2
      ) {
        const variations: string[] = [];

        if (creative.creative_type === 'image') {
          variations.push('Testar versão com CTA diferente');
          variations.push('Criar variação com cores alternativas');
          variations.push('Adicionar badge de urgência ou scarcity');
        } else if (creative.creative_type === 'video') {
          variations.push('Testar versão com hook diferente nos primeiros 3s');
          variations.push('Criar cut de 6s para Stories');
          variations.push('Adicionar legendas se não tiver');
        }

        if (variations.length > 0) {
          insights.push({
            ai_agent_id: agentId,
            execution_id: executionId,
            workspace_id: workspaceId,
            creative_asset_id: creative.creative_id,
            insight_type: 'recommendation',
            severity: 'low',
            title: `Potencial para variações: ${creative.creative_name}`,
            description: `Criativo com bom CTR (${creative.ctr.toFixed(2)}%) e apenas ${creative.ads_count} anúncios usando ele. Há oportunidade para testar variações e escalar.`,
            recommendation: variations.join('. ') + '.',
            metrics: {
              ctr: creative.ctr,
              spend_30d: creative.spend,
              ads_count: creative.ads_count,
              campaigns_count: creative.campaigns_count,
              creative_type: creative.creative_type,
            },
          });
        }
      }

      // 6. INFO: Criativo novo com bom desempenho inicial
      if (
        creative.days_active <= 7 &&
        creative.ctr >= minCtr * 1.5 &&
        creative.impressions >= 500
      ) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          creative_asset_id: creative.creative_id,
          insight_type: 'info',
          severity: 'low',
          title: `Criativo novo promissor: ${creative.creative_name}`,
          description: `Lançado há ${creative.days_active} dias com CTR excelente de ${creative.ctr.toFixed(2)}% em ${creative.impressions.toLocaleString()} impressões.`,
          recommendation: 'Monitorar de perto nos próximos dias. Se performance se mantiver, considerar escalar para mais campanhas.',
          metrics: {
            days_active: creative.days_active,
            ctr: creative.ctr,
            impressions_30d: creative.impressions,
            clicks_30d: creative.clicks,
            creative_type: creative.creative_type,
          },
        });
      }
    }

    // Salvar insights no banco
    if (insights.length > 0) {
      const insertQuery = `
        INSERT INTO ai_insights (
          ai_agent_id,
          execution_id,
          workspace_id,
          creative_asset_id,
          insight_type,
          severity,
          title,
          description,
          recommendation,
          metrics,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '14 days')
      `;

      for (const insight of insights) {
        await pool.query(insertQuery, [
          insight.ai_agent_id,
          insight.execution_id,
          insight.workspace_id,
          insight.creative_asset_id,
          insight.insight_type,
          insight.severity,
          insight.title,
          insight.description,
          insight.recommendation,
          JSON.stringify(insight.metrics),
        ]);
      }

      console.log(`✅ ${insights.length} insights gerados e salvos`);
    } else {
      console.log('ℹ️ Nenhum insight gerado - todos os criativos dentro dos parâmetros esperados');
    }

    return insights.length;
  } catch (error) {
    console.error('Erro ao analisar performance de criativos:', error);
    throw error;
  }
}

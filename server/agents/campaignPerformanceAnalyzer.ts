import { getPool } from '../config/database.js';

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string;
  daily_budget: number;
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

interface AgentConfig {
  target_roas?: number;
  min_spend?: number;
  alert_threshold?: number;
  scale_threshold?: number;
  min_budget_utilization?: number;
}

export async function analyzeCampaignPerformance(
  agentId: string,
  executionId: string,
  workspaceId: string,
  config: AgentConfig
) {
  const pool = getPool();
  const insights: any[] = [];

  try {
    // Configurações padrão
    const targetRoas = config.target_roas || 3.0;
    const minSpend = config.min_spend || 100;
    const alertThreshold = config.alert_threshold || 0.5;
    const scaleThreshold = config.scale_threshold || 1.5;
    const minBudgetUtilization = config.min_budget_utilization || 0.8;

    // Buscar campanhas ativas e suas métricas dos últimos 7 dias
    const query = `
      SELECT
        c.id as campaign_id,
        c.name as campaign_name,
        c.status,
        c.objective,
        c.daily_budget,
        COALESCE(SUM(pm.spend), 0) as spend,
        COALESCE(SUM(pm.conversion_value), 0) as revenue,
        COALESCE(SUM(pm.conversions), 0) as conversions,
        CASE
          WHEN SUM(pm.spend) > 0 THEN SUM(pm.conversion_value) / SUM(pm.spend)
          ELSE 0
        END as roas,
        COALESCE(SUM(pm.impressions), 0) as impressions,
        COALESCE(SUM(pm.clicks), 0) as clicks,
        CASE
          WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::numeric / SUM(pm.impressions) * 100)
          ELSE 0
        END as ctr,
        CASE
          WHEN SUM(pm.clicks) > 0 THEN (SUM(pm.spend) / SUM(pm.clicks))
          ELSE 0
        END as cpc
      FROM campaigns c
      LEFT JOIN performance_metrics pm ON pm.campaign_id = c.id
        AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
      WHERE c.workspace_id = $1
        AND c.status = 'active'
        AND c.archived = false
      GROUP BY c.id, c.name, c.status, c.objective, c.daily_budget
      HAVING SUM(pm.spend) > 0
      ORDER BY spend DESC
    `;

    const result = await pool.query(query, [workspaceId]);
    const campaigns: CampaignMetrics[] = result.rows;

    console.log(`📊 Analisando ${campaigns.length} campanhas ativas`);

    // Analisar cada campanha
    for (const campaign of campaigns) {
      // 1. ALERTA: ROAS abaixo da meta
      if (campaign.spend >= minSpend && campaign.roas < targetRoas * alertThreshold) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          campaign_id: campaign.campaign_id,
          insight_type: 'warning',
          severity: campaign.roas < targetRoas * 0.3 ? 'critical' : 'high',
          title: `ROAS muito abaixo da meta: ${campaign.campaign_name}`,
          description: `Esta campanha tem ROAS de ${campaign.roas.toFixed(2)}x, bem abaixo da meta de ${targetRoas}x. Gastou R$ ${campaign.spend.toFixed(2)} nos últimos 7 dias com apenas ${campaign.conversions} conversões.`,
          recommendation: campaign.roas < targetRoas * 0.3
            ? 'URGENTE: Pausar esta campanha imediatamente e revisar segmentação e criativos.'
            : 'Revisar segmentação de público, criativos e copy dos anúncios. Considerar pausar se não houver melhora em 48h.',
          metrics: {
            current_roas: campaign.roas,
            target_roas: targetRoas,
            spend_7d: campaign.spend,
            conversions_7d: campaign.conversions,
            revenue_7d: campaign.revenue,
            daily_budget: campaign.daily_budget,
          },
        });
      }

      // 2. OPORTUNIDADE: ROAS alto com orçamento sub-utilizado
      if (campaign.roas >= targetRoas * scaleThreshold && campaign.daily_budget) {
        const budgetUtilization = campaign.spend / (campaign.daily_budget * 7);

        if (budgetUtilization < minBudgetUtilization) {
          const recommendedIncrease = Math.round((1 - budgetUtilization) * 100);

          insights.push({
            ai_agent_id: agentId,
            execution_id: executionId,
            workspace_id: workspaceId,
            campaign_id: campaign.campaign_id,
            insight_type: 'opportunity',
            severity: 'medium',
            title: `Oportunidade de escala: ${campaign.campaign_name}`,
            description: `Campanha com excelente ROAS de ${campaign.roas.toFixed(2)}x (meta: ${targetRoas}x) mas está gastando apenas ${(budgetUtilization * 100).toFixed(0)}% do orçamento diário disponível.`,
            recommendation: `Aumentar orçamento diário em ${recommendedIncrease}% para capturar mais conversões rentáveis. ROAS atual sugere potencial de escala sem perda de eficiência.`,
            metrics: {
              current_roas: campaign.roas,
              target_roas: targetRoas,
              spend_7d: campaign.spend,
              conversions_7d: campaign.conversions,
              revenue_7d: campaign.revenue,
              daily_budget: campaign.daily_budget,
              budget_utilization: budgetUtilization,
              recommended_budget_increase_percent: recommendedIncrease,
            },
          });
        }
      }

      // 3. RECOMENDAÇÃO: ROAS acima da meta mas com potencial de otimização
      if (
        campaign.roas >= targetRoas &&
        campaign.roas < targetRoas * scaleThreshold &&
        campaign.spend >= minSpend
      ) {
        const recommendations: string[] = [];

        // CTR baixo?
        if (campaign.ctr < 1.0 && campaign.clicks > 50) {
          recommendations.push('CTR baixo (<1%) - testar novos criativos e copies mais impactantes');
        }

        // CPC alto?
        if (campaign.cpc > 5.0 && campaign.clicks > 50) {
          recommendations.push('CPC elevado (>R$ 5) - revisar segmentação e estratégia de lance');
        }

        if (recommendations.length > 0) {
          insights.push({
            ai_agent_id: agentId,
            execution_id: executionId,
            workspace_id: workspaceId,
            campaign_id: campaign.campaign_id,
            insight_type: 'recommendation',
            severity: 'low',
            title: `Oportunidades de otimização: ${campaign.campaign_name}`,
            description: `Campanha com ROAS de ${campaign.roas.toFixed(2)}x (meta: ${targetRoas}x) pode ser otimizada para melhorar ainda mais os resultados.`,
            recommendation: recommendations.join('. ') + '.',
            metrics: {
              current_roas: campaign.roas,
              target_roas: targetRoas,
              ctr: campaign.ctr,
              cpc: campaign.cpc,
              spend_7d: campaign.spend,
              conversions_7d: campaign.conversions,
            },
          });
        }
      }

      // 4. ALERTA: Gasto alto sem conversões
      if (campaign.spend >= minSpend * 2 && campaign.conversions === 0) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          campaign_id: campaign.campaign_id,
          insight_type: 'alert',
          severity: 'critical',
          title: `ALERTA: Sem conversões apesar de alto gasto - ${campaign.campaign_name}`,
          description: `Campanha gastou R$ ${campaign.spend.toFixed(2)} nos últimos 7 dias sem gerar nenhuma conversão. ${campaign.clicks} cliques foram registrados (CTR: ${campaign.ctr.toFixed(2)}%).`,
          recommendation: 'AÇÃO IMEDIATA: Pausar campanha e investigar possíveis problemas de tracking/pixel, página de destino ou correspondência entre anúncio e oferta.',
          metrics: {
            spend_7d: campaign.spend,
            conversions_7d: 0,
            clicks_7d: campaign.clicks,
            impressions_7d: campaign.impressions,
            ctr: campaign.ctr,
          },
        });
      }

      // 5. INFO: Campanha nova com bom desempenho inicial
      if (
        campaign.spend < minSpend &&
        campaign.spend > minSpend / 2 &&
        campaign.roas >= targetRoas * 1.2
      ) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          campaign_id: campaign.campaign_id,
          insight_type: 'info',
          severity: 'low',
          title: `Início promissor: ${campaign.campaign_name}`,
          description: `Campanha nova mostra resultados iniciais excelentes com ROAS de ${campaign.roas.toFixed(2)}x nos primeiros R$ ${campaign.spend.toFixed(2)} gastos.`,
          recommendation: 'Monitorar de perto e considerar aumentar orçamento gradualmente após estabilização dos resultados.',
          metrics: {
            current_roas: campaign.roas,
            target_roas: targetRoas,
            spend_7d: campaign.spend,
            conversions_7d: campaign.conversions,
          },
        });
      }
    }

    // Salvar todos os insights no banco
    if (insights.length > 0) {
      const insertQuery = `
        INSERT INTO ai_insights (
          ai_agent_id,
          execution_id,
          workspace_id,
          campaign_id,
          insight_type,
          severity,
          title,
          description,
          recommendation,
          metrics,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '7 days')
      `;

      for (const insight of insights) {
        await pool.query(insertQuery, [
          insight.ai_agent_id,
          insight.execution_id,
          insight.workspace_id,
          insight.campaign_id,
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
      console.log('ℹ️ Nenhum insight gerado - todas as campanhas dentro dos parâmetros esperados');
    }

    return insights.length;
  } catch (error) {
    console.error('Erro ao analisar performance de campanhas:', error);
    throw error;
  }
}

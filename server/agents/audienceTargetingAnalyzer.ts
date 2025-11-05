import { getPool } from '../config/database.js';

interface DemographicMetrics {
  breakdown_key: string;
  breakdown_value: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
}

interface AgentConfig {
  max_frequency?: number;
  min_roas?: number;
  high_cpm_threshold?: number;
  low_ctr_threshold?: number;
}

export async function analyzeAudienceTargeting(
  agentId: string,
  executionId: string,
  workspaceId: string,
  config: AgentConfig
) {
  const pool = getPool();
  const insights: any[] = [];

  try {
    // Configurações padrão
    const maxFrequency = config.max_frequency || 3.0;
    const minRoas = config.min_roas || 2.0;
    const highCpmThreshold = config.high_cpm_threshold || 50;
    const lowCtrThreshold = config.low_ctr_threshold || 0.8;

    // Buscar métricas por breakdown (idade, gênero) dos últimos 14 dias
    const query = `
      SELECT
        breakdown_key,
        breakdown_value_key as breakdown_value,
        COALESCE(SUM(impressions), 0) as impressions,
        COALESCE(SUM(clicks), 0) as clicks,
        COALESCE(SUM(spend), 0) as spend,
        COALESCE(SUM(conversions), 0) as conversions,
        COALESCE(SUM(conversion_value), 0) as revenue,
        CASE
          WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions) * 100)
          ELSE 0
        END as ctr,
        CASE
          WHEN SUM(clicks) > 0 THEN (SUM(spend) / SUM(clicks))
          ELSE 0
        END as cpc,
        CASE
          WHEN SUM(impressions) > 0 THEN (SUM(spend) / SUM(impressions) * 1000)
          ELSE 0
        END as cpm,
        CASE
          WHEN SUM(spend) > 0 THEN (SUM(conversion_value) / SUM(spend))
          ELSE 0
        END as roas,
        COALESCE(AVG((extra_metrics->>'frequency')::numeric), 0) as frequency
      FROM performance_metric_breakdowns
      WHERE workspace_id = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '14 days'
        AND breakdown_key IN ('age', 'gender')
      GROUP BY breakdown_key, breakdown_value_key
      HAVING SUM(impressions) > 100
      ORDER BY spend DESC
    `;

    const result = await pool.query(query, [workspaceId]);
    const demographics: DemographicMetrics[] = result.rows;

    console.log(`🎯 Analisando ${demographics.length} segmentos demográficos`);

    if (demographics.length === 0) {
      console.log('ℹ️ Nenhum dado demográfico com volume suficiente para análise');
      return 0;
    }

    // Agrupar por tipo de breakdown
    const ageSegments = demographics.filter((d) => d.breakdown_key === 'age');
    const genderSegments = demographics.filter((d) => d.breakdown_key === 'gender');

    // Normalizar valores de gênero
    const normalizeGender = (value: string): string => {
      const v = value.toLowerCase();
      if (v.includes('male') && !v.includes('female')) return 'Masculino';
      if (v.includes('female')) return 'Feminino';
      return 'Outros';
    };

    // Analisar segmentos de idade
    for (const segment of ageSegments) {
      // 1. ALERTA: Alta frequência (saturação)
      if (segment.frequency >= maxFrequency && segment.spend >= 100) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'warning',
          severity: segment.frequency >= maxFrequency * 1.5 ? 'high' : 'medium',
          title: `Saturação de público: Idade ${segment.breakdown_value}`,
          description: `Faixa etária ${segment.breakdown_value} com frequência de ${segment.frequency.toFixed(2)} (limite: ${maxFrequency}). Público está vendo anúncios repetidamente, indicando saturação.`,
          recommendation: 'Expandir segmentação para outras faixas etárias ou criar públicos lookalike. Considerar aumentar budget para ampliar alcance ou pausar temporariamente para "descansar" o público.',
          metrics: {
            age_range: segment.breakdown_value,
            frequency: segment.frequency,
            max_frequency: maxFrequency,
            impressions_14d: segment.impressions,
            spend_14d: segment.spend,
            ctr: segment.ctr,
          },
        });
      }

      // 2. OPORTUNIDADE: Segmento com excelente ROAS
      if (segment.roas >= minRoas * 1.5 && segment.conversions >= 3) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'opportunity',
          severity: 'high',
          title: `Alto ROAS: Idade ${segment.breakdown_value}`,
          description: `Faixa etária ${segment.breakdown_value} com ROAS excelente de ${segment.roas.toFixed(2)}x (meta: ${minRoas}x). ${segment.conversions} conversões com R$ ${segment.spend.toFixed(2)} de gasto.`,
          recommendation: 'ESCALAR: Aumentar investimento nesta faixa etária. Criar campanhas dedicadas focadas neste público. Considerar criar lookalike baseado neste segmento.',
          metrics: {
            age_range: segment.breakdown_value,
            roas: segment.roas,
            min_roas_target: minRoas,
            conversions_14d: segment.conversions,
            revenue_14d: segment.revenue,
            spend_14d: segment.spend,
            ctr: segment.ctr,
          },
        });
      }

      // 3. ALERTA: CPM muito alto
      if (segment.cpm >= highCpmThreshold && segment.impressions >= 1000) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'warning',
          severity: 'medium',
          title: `CPM elevado: Idade ${segment.breakdown_value}`,
          description: `Faixa etária ${segment.breakdown_value} com CPM de R$ ${segment.cpm.toFixed(2)} (threshold: R$ ${highCpmThreshold}). Custo para alcançar este público está muito alto.`,
          recommendation: 'Revisar competitividade neste segmento. Considerar expandir para faixas etárias adjacentes onde CPM pode ser menor. Testar criativos mais relevantes para melhorar relevance score.',
          metrics: {
            age_range: segment.breakdown_value,
            cpm: segment.cpm,
            high_cpm_threshold: highCpmThreshold,
            impressions_14d: segment.impressions,
            spend_14d: segment.spend,
          },
        });
      }

      // 4. WARNING: CTR muito baixo
      if (segment.ctr < lowCtrThreshold && segment.impressions >= 1000) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'warning',
          severity: 'medium',
          title: `CTR baixo: Idade ${segment.breakdown_value}`,
          description: `Faixa etária ${segment.breakdown_value} com CTR de apenas ${segment.ctr.toFixed(2)}% em ${segment.impressions.toLocaleString()} impressões.`,
          recommendation: 'Criativos não estão ressoando com este público. Criar anúncios específicos para esta faixa etária ou considerar excluir se performance não melhorar.',
          metrics: {
            age_range: segment.breakdown_value,
            ctr: segment.ctr,
            low_ctr_threshold: lowCtrThreshold,
            impressions_14d: segment.impressions,
            clicks_14d: segment.clicks,
          },
        });
      }
    }

    // Analisar segmentos de gênero
    for (const segment of genderSegments) {
      const genderLabel = normalizeGender(segment.breakdown_value);

      // 1. OPORTUNIDADE: Gênero com ótimo desempenho
      if (segment.roas >= minRoas * 1.5 && segment.conversions >= 5) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'opportunity',
          severity: 'high',
          title: `Público ${genderLabel} com alta conversão`,
          description: `Público ${genderLabel} com ROAS de ${segment.roas.toFixed(2)}x e ${segment.conversions} conversões. CTR: ${segment.ctr.toFixed(2)}%.`,
          recommendation: 'Criar campanhas dedicadas para este público. Considerar aumentar % de budget alocado. Criar criativos específicos que ressoem ainda mais com este gênero.',
          metrics: {
            gender: genderLabel,
            roas: segment.roas,
            conversions_14d: segment.conversions,
            revenue_14d: segment.revenue,
            spend_14d: segment.spend,
            ctr: segment.ctr,
          },
        });
      }

      // 2. ALERTA: Gênero com alto gasto e baixo retorno
      if (segment.spend >= 200 && segment.roas < minRoas * 0.5) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'alert',
          severity: 'high',
          title: `Baixo retorno: Público ${genderLabel}`,
          description: `Público ${genderLabel} gastou R$ ${segment.spend.toFixed(2)} com ROAS de apenas ${segment.roas.toFixed(2)}x (meta: ${minRoas}x).`,
          recommendation: 'Considerar excluir este gênero da segmentação ou criar criativos específicos que sejam mais relevantes. Se não melhorar em 48h, pausar anúncios direcionados a este público.',
          metrics: {
            gender: genderLabel,
            roas: segment.roas,
            min_roas_target: minRoas,
            spend_14d: segment.spend,
            conversions_14d: segment.conversions,
            revenue_14d: segment.revenue,
          },
        });
      }
    }

    // Análise comparativa entre segmentos
    if (ageSegments.length >= 2) {
      const sortedByRoas = [...ageSegments].sort((a, b) => b.roas - a.roas);
      const best = sortedByRoas[0];
      const worst = sortedByRoas[sortedByRoas.length - 1];

      if (best.roas > worst.roas * 2 && best.spend >= 100 && worst.spend >= 100) {
        insights.push({
          ai_agent_id: agentId,
          execution_id: executionId,
          workspace_id: workspaceId,
          insight_type: 'recommendation',
          severity: 'medium',
          title: 'Grande disparidade entre faixas etárias',
          description: `Faixa ${best.breakdown_value} tem ROAS de ${best.roas.toFixed(2)}x vs ${worst.breakdown_value} com ${worst.roas.toFixed(2)}x. Diferença de ${((best.roas / worst.roas - 1) * 100).toFixed(0)}%.`,
          recommendation: `Realocar orçamento de ${worst.breakdown_value} para ${best.breakdown_value}. Criar campanhas separadas para melhor controle de budget por segmento.`,
          metrics: {
            best_age: best.breakdown_value,
            best_roas: best.roas,
            worst_age: worst.breakdown_value,
            worst_roas: worst.roas,
            difference_percent: ((best.roas / worst.roas - 1) * 100),
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
          insight_type,
          severity,
          title,
          description,
          recommendation,
          metrics,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '14 days')
      `;

      for (const insight of insights) {
        await pool.query(insertQuery, [
          insight.ai_agent_id,
          insight.execution_id,
          insight.workspace_id,
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
      console.log('ℹ️ Nenhum insight gerado - segmentação dentro dos parâmetros esperados');
    }

    return insights.length;
  } catch (error) {
    console.error('Erro ao analisar segmentação de público:', error);
    throw error;
  }
}

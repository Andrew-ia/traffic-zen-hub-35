-- 0020_ai_agents.sql
-- Schema para Agentes de IA que analisam campanhas, ad sets e criativos

-- ============================================================================
-- AI AGENTS (Agentes de IA)
-- ============================================================================
CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL CHECK (agent_type IN (
        'campaign_performance',
        'creative_optimizer',
        'audience_targeting',
        'budget_allocation',
        'ad_copy_quality',
        'anomaly_detector'
    )),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
    schedule_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (schedule_frequency IN ('hourly', 'daily', 'weekly', 'on_demand')),
    config JSONB DEFAULT '{}'::JSONB,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agents_workspace ON ai_agents(workspace_id);
CREATE INDEX idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX idx_ai_agents_status ON ai_agents(status) WHERE status = 'active';
CREATE INDEX idx_ai_agents_next_run ON ai_agents(next_run_at) WHERE status = 'active' AND next_run_at IS NOT NULL;

COMMENT ON TABLE ai_agents IS 'Agentes de IA que analisam campanhas, ad sets e criativos';
COMMENT ON COLUMN ai_agents.agent_type IS 'Tipo do agente: campaign_performance, creative_optimizer, audience_targeting, budget_allocation, ad_copy_quality, anomaly_detector';
COMMENT ON COLUMN ai_agents.schedule_frequency IS 'Frequência de execução: hourly, daily, weekly, on_demand';
COMMENT ON COLUMN ai_agents.config IS 'Configurações específicas do agente (thresholds, parâmetros, etc.)';

-- ============================================================================
-- AI AGENT EXECUTIONS (Execuções dos Agentes)
-- ============================================================================
CREATE TABLE ai_agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_insights INTEGER DEFAULT 0,
    error_message TEXT,
    execution_time_ms INTEGER,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_ai_agent_executions_agent ON ai_agent_executions(ai_agent_id, started_at DESC);
CREATE INDEX idx_ai_agent_executions_workspace ON ai_agent_executions(workspace_id, started_at DESC);
CREATE INDEX idx_ai_agent_executions_status ON ai_agent_executions(status) WHERE status = 'running';

COMMENT ON TABLE ai_agent_executions IS 'Histórico de execuções dos agentes de IA';
COMMENT ON COLUMN ai_agent_executions.total_insights IS 'Número de insights gerados nesta execução';
COMMENT ON COLUMN ai_agent_executions.execution_time_ms IS 'Tempo de execução em milissegundos';

-- ============================================================================
-- AI INSIGHTS (Insights e Recomendações)
-- ============================================================================
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES ai_agent_executions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Relacionamento com entidades (opcional - pode ser NULL se for insight geral)
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    creative_asset_id UUID REFERENCES creative_assets(id) ON DELETE CASCADE,

    insight_type TEXT NOT NULL CHECK (insight_type IN ('warning', 'opportunity', 'recommendation', 'alert', 'info')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,

    -- Métricas associadas ao insight (para contexto)
    metrics JSONB DEFAULT '{}'::JSONB,

    -- Status do insight
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'actioned', 'dismissed', 'expired')),
    actioned_at TIMESTAMPTZ,
    actioned_by UUID REFERENCES users(id),
    action_taken TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ -- Insights podem expirar após X dias
);

CREATE INDEX idx_ai_insights_workspace ON ai_insights(workspace_id, created_at DESC);
CREATE INDEX idx_ai_insights_agent ON ai_insights(ai_agent_id, created_at DESC);
CREATE INDEX idx_ai_insights_execution ON ai_insights(execution_id);
CREATE INDEX idx_ai_insights_status ON ai_insights(status) WHERE status = 'new';
CREATE INDEX idx_ai_insights_severity ON ai_insights(severity) WHERE severity IN ('high', 'critical');
CREATE INDEX idx_ai_insights_campaign ON ai_insights(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_ai_insights_ad_set ON ai_insights(ad_set_id) WHERE ad_set_id IS NOT NULL;
CREATE INDEX idx_ai_insights_ad ON ai_insights(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX idx_ai_insights_creative ON ai_insights(creative_asset_id) WHERE creative_asset_id IS NOT NULL;

COMMENT ON TABLE ai_insights IS 'Insights e recomendações gerados pelos agentes de IA';
COMMENT ON COLUMN ai_insights.insight_type IS 'Tipo: warning (alerta), opportunity (oportunidade), recommendation (recomendação), alert (alerta crítico), info (informação)';
COMMENT ON COLUMN ai_insights.severity IS 'Severidade: low, medium, high, critical';
COMMENT ON COLUMN ai_insights.metrics IS 'Métricas associadas ao insight em formato JSON (ex: {"current_roas": 2.5, "target_roas": 4.0})';
COMMENT ON COLUMN ai_insights.status IS 'Status: new (novo), viewed (visualizado), actioned (ação tomada), dismissed (dispensado), expired (expirado)';

-- ============================================================================
-- AI INSIGHT ACTIONS (Ações Sugeridas pelos Insights)
-- ============================================================================
CREATE TABLE ai_insight_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_insight_id UUID NOT NULL REFERENCES ai_insights(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_label TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::JSONB,
    can_auto_apply BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_insight_actions_insight ON ai_insight_actions(ai_insight_id);

COMMENT ON TABLE ai_insight_actions IS 'Ações aplicáveis sugeridas pelos insights';
COMMENT ON COLUMN ai_insight_actions.action_type IS 'Tipo da ação: increase_budget, pause_campaign, create_variation, adjust_bid, etc.';
COMMENT ON COLUMN ai_insight_actions.action_label IS 'Label amigável da ação para exibir na UI';
COMMENT ON COLUMN ai_insight_actions.parameters IS 'Parâmetros da ação em formato JSON';
COMMENT ON COLUMN ai_insight_actions.can_auto_apply IS 'Se true, a ação pode ser aplicada automaticamente pelo sistema';
COMMENT ON COLUMN ai_insight_actions.requires_approval IS 'Se true, requer aprovação do usuário antes de aplicar';

-- ============================================================================
-- VIEW: AI AGENTS DASHBOARD
-- ============================================================================
CREATE OR REPLACE VIEW v_ai_agents_dashboard AS
SELECT
  aa.id,
  aa.workspace_id,
  aa.agent_type,
  aa.name,
  aa.description,
  aa.status,
  aa.schedule_frequency,
  aa.last_run_at,
  aa.next_run_at,
  aa.created_at,
  aa.updated_at,

  -- Estatísticas de execuções
  (SELECT COUNT(*) FROM ai_agent_executions WHERE ai_agent_id = aa.id) AS total_executions,
  (SELECT COUNT(*) FROM ai_agent_executions WHERE ai_agent_id = aa.id AND status = 'completed') AS successful_executions,
  (SELECT COUNT(*) FROM ai_agent_executions WHERE ai_agent_id = aa.id AND status = 'failed') AS failed_executions,

  -- Estatísticas de insights
  (SELECT COUNT(*) FROM ai_insights WHERE ai_agent_id = aa.id) AS total_insights,
  (SELECT COUNT(*) FROM ai_insights WHERE ai_agent_id = aa.id AND status = 'new') AS new_insights,
  (SELECT COUNT(*) FROM ai_insights WHERE ai_agent_id = aa.id AND status = 'actioned') AS actioned_insights,

  -- Última execução
  (SELECT started_at FROM ai_agent_executions WHERE ai_agent_id = aa.id ORDER BY started_at DESC LIMIT 1) AS last_execution_started_at,
  (SELECT status FROM ai_agent_executions WHERE ai_agent_id = aa.id ORDER BY started_at DESC LIMIT 1) AS last_execution_status,
  (SELECT total_insights FROM ai_agent_executions WHERE ai_agent_id = aa.id ORDER BY started_at DESC LIMIT 1) AS last_execution_insights_count

FROM ai_agents aa;

COMMENT ON VIEW v_ai_agents_dashboard IS 'Dashboard view com estatísticas dos agentes de IA';

-- ============================================================================
-- VIEW: AI INSIGHTS WITH DETAILS
-- ============================================================================
CREATE OR REPLACE VIEW v_ai_insights_detailed AS
SELECT
  ai.id,
  ai.workspace_id,
  ai.ai_agent_id,
  ai.execution_id,
  ai.insight_type,
  ai.severity,
  ai.title,
  ai.description,
  ai.recommendation,
  ai.metrics,
  ai.status,
  ai.actioned_at,
  ai.actioned_by,
  ai.action_taken,
  ai.created_at,
  ai.expires_at,

  -- Informações do agente
  aa.name AS agent_name,
  aa.agent_type AS agent_type,

  -- Informações de campanha
  c.name AS campaign_name,
  c.status AS campaign_status,
  c.objective AS campaign_objective,

  -- Informações de ad set
  ads.name AS ad_set_name,
  ads.status AS ad_set_status,

  -- Informações de anúncio
  ad.name AS ad_name,
  ad.status AS ad_status,

  -- Informações de criativo
  ca.name AS creative_name,
  ca.type AS creative_type,
  ca.thumbnail_url AS creative_thumbnail,

  -- Informações da conta
  pa.name AS account_name,

  -- Ações disponíveis
  (SELECT COUNT(*) FROM ai_insight_actions WHERE ai_insight_id = ai.id) AS available_actions_count,

  -- Usuário que tomou ação
  u.full_name AS actioned_by_name,
  u.email AS actioned_by_email

FROM ai_insights ai
LEFT JOIN ai_agents aa ON aa.id = ai.ai_agent_id
LEFT JOIN campaigns c ON c.id = ai.campaign_id
LEFT JOIN ad_sets ads ON ads.id = ai.ad_set_id
LEFT JOIN ads ad ON ad.id = ai.ad_id
LEFT JOIN creative_assets ca ON ca.id = ai.creative_asset_id
LEFT JOIN platform_accounts pa ON pa.id = ai.platform_account_id
LEFT JOIN users u ON u.id = ai.actioned_by;

COMMENT ON VIEW v_ai_insights_detailed IS 'View detalhada de insights com informações de agentes, campanhas, etc.';

-- ============================================================================
-- FUNCTION: MARCAR INSIGHTS EXPIRADOS
-- ============================================================================
CREATE OR REPLACE FUNCTION expire_old_insights()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE ai_insights
  SET status = 'expired'
  WHERE status = 'new'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_old_insights IS 'Marca insights como expirados baseado na data de expiração';

-- ============================================================================
-- SEED: AGENTES PADRÃO PARA WORKSPACE
-- ============================================================================
-- Criar agentes padrão para o workspace de exemplo
INSERT INTO ai_agents (workspace_id, agent_type, name, description, schedule_frequency, config, next_run_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    'campaign_performance',
    'Analisador de Performance de Campanhas',
    'Analisa ROAS, tendências de gasto e identifica campanhas com potencial de escala ou que precisam ser pausadas.',
    'daily',
    '{"target_roas": 3.0, "min_spend": 100, "alert_threshold": 0.5}'::JSONB,
    NOW() + INTERVAL '1 hour'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'creative_optimizer',
    'Otimizador de Criativos',
    'Identifica criativos com melhor performance, detecta fadiga criativa e sugere variações.',
    'daily',
    '{"min_ctr": 1.0, "fatigue_days": 14, "top_performer_percentile": 0.2}'::JSONB,
    NOW() + INTERVAL '2 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'audience_targeting',
    'Analisador de Segmentação',
    'Analisa performance por demografia, identifica públicos saturados e sugere expansões.',
    'weekly',
    '{"max_frequency": 3.0, "min_audience_size": 1000}'::JSONB,
    NOW() + INTERVAL '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'budget_allocation',
    'Otimizador de Orçamento',
    'Recomenda realocação de orçamento entre campanhas baseado em performance e oportunidades.',
    'daily',
    '{"min_roas_for_increase": 4.0, "budget_increase_percent": 20}'::JSONB,
    NOW() + INTERVAL '3 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'anomaly_detector',
    'Detector de Anomalias',
    'Detecta padrões anormais em métricas (picos, quedas, problemas de tracking).',
    'hourly',
    '{"anomaly_threshold": 2.0, "check_metrics": ["spend", "conversions", "ctr"]}'::JSONB,
    NOW() + INTERVAL '30 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'ad_copy_quality',
    'Verificador de Qualidade de Textos',
    'Analisa headlines, descriptions e CTAs para identificar oportunidades de melhoria.',
    'on_demand',
    '{"min_headline_length": 20, "max_headline_length": 60, "preferred_ctas": ["Comprar Agora", "Saiba Mais", "Aproveite"]}'::JSONB,
    NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insight_actions ENABLE ROW LEVEL SECURITY;

-- Policies for ai_agents
CREATE POLICY ai_agents_select ON ai_agents FOR SELECT USING (true);
CREATE POLICY ai_agents_insert ON ai_agents FOR INSERT WITH CHECK (true);
CREATE POLICY ai_agents_update ON ai_agents FOR UPDATE USING (true);
CREATE POLICY ai_agents_delete ON ai_agents FOR DELETE USING (true);

-- Policies for ai_agent_executions
CREATE POLICY ai_agent_executions_select ON ai_agent_executions FOR SELECT USING (true);
CREATE POLICY ai_agent_executions_insert ON ai_agent_executions FOR INSERT WITH CHECK (true);
CREATE POLICY ai_agent_executions_update ON ai_agent_executions FOR UPDATE USING (true);

-- Policies for ai_insights
CREATE POLICY ai_insights_select ON ai_insights FOR SELECT USING (true);
CREATE POLICY ai_insights_insert ON ai_insights FOR INSERT WITH CHECK (true);
CREATE POLICY ai_insights_update ON ai_insights FOR UPDATE USING (true);
CREATE POLICY ai_insights_delete ON ai_insights FOR DELETE USING (true);

-- Policies for ai_insight_actions
CREATE POLICY ai_insight_actions_select ON ai_insight_actions FOR SELECT USING (true);
CREATE POLICY ai_insight_actions_insert ON ai_insight_actions FOR INSERT WITH CHECK (true);
CREATE POLICY ai_insight_actions_update ON ai_insight_actions FOR UPDATE USING (true);
CREATE POLICY ai_insight_actions_delete ON ai_insight_actions FOR DELETE USING (true);

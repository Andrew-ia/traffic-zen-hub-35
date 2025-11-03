-- Migration: Creative Folders, Variants, Tags and Performance Tracking
-- Purpose: Organize creatives in folders with size variants and performance recommendations

-- ============================================================================
-- CREATIVE FOLDERS (Pastas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creative_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES creative_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- hex color for UI: #FF5733
  icon TEXT, -- lucide icon name: 'folder', 'image', 'video'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT creative_folders_name_unique UNIQUE (workspace_id, parent_folder_id, name)
);

CREATE INDEX idx_creative_folders_workspace ON creative_folders(workspace_id);
CREATE INDEX idx_creative_folders_parent ON creative_folders(parent_folder_id);

COMMENT ON TABLE creative_folders IS 'Pastas para organizar criativos em hierarquia';
COMMENT ON COLUMN creative_folders.parent_folder_id IS 'NULL = pasta raiz, permite estrutura de árvore';
COMMENT ON COLUMN creative_folders.color IS 'Cor da pasta na UI (ex: #FF5733)';

-- ============================================================================
-- ADD FOLDER REFERENCE TO CREATIVE_ASSETS
-- ============================================================================
ALTER TABLE creative_assets
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES creative_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creative_assets_folder ON creative_assets(folder_id);

COMMENT ON COLUMN creative_assets.folder_id IS 'Pasta onde o criativo está organizado';

-- ============================================================================
-- CREATIVE VARIANTS (Variações de Tamanho)
-- ============================================================================
-- Permite ter múltiplas versões do mesmo criativo em diferentes tamanhos
-- Ex: 1 criativo "Banner Black Friday" com versões 1:1, 9:16, 16:9

CREATE TABLE IF NOT EXISTS creative_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, -- '1:1', '9:16 Stories', '16:9 Feed', etc
  aspect_ratio TEXT, -- '1:1', '9:16', '16:9'
  width INTEGER, -- pixels
  height INTEGER, -- pixels
  storage_url TEXT,
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT creative_variants_unique UNIQUE (creative_asset_id, variant_name)
);

CREATE INDEX idx_creative_variants_asset ON creative_variants(creative_asset_id);

COMMENT ON TABLE creative_variants IS 'Variações de tamanho do mesmo criativo (1:1, 9:16, etc)';
COMMENT ON COLUMN creative_variants.variant_name IS 'Nome descritivo: "1:1 Feed", "9:16 Stories"';

-- ============================================================================
-- CREATIVE TAGS (Tags)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creative_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT, -- hex color: #3B82F6
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT creative_tags_unique UNIQUE (workspace_id, name)
);

CREATE INDEX idx_creative_tags_workspace ON creative_tags(workspace_id);

COMMENT ON TABLE creative_tags IS 'Tags para classificar criativos (ex: "Black Friday", "Produto X", "Testimonial")';

-- ============================================================================
-- CREATIVE_ASSETS <-> TAGS (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creative_asset_tags (
  creative_asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES creative_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (creative_asset_id, tag_id)
);

CREATE INDEX idx_creative_asset_tags_asset ON creative_asset_tags(creative_asset_id);
CREATE INDEX idx_creative_asset_tags_tag ON creative_asset_tags(tag_id);

-- ============================================================================
-- CREATIVE PERFORMANCE SCORES (Indicadores de Performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creative_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Period of analysis
  days_analyzed INTEGER NOT NULL, -- 7, 30, 90

  -- Raw metrics (last N days)
  total_spend NUMERIC(18,4) DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  total_conversions BIGINT DEFAULT 0,
  total_revenue NUMERIC(18,4) DEFAULT 0,

  -- Calculated KPIs
  avg_ctr NUMERIC(10,4), -- %
  avg_cpc NUMERIC(18,4),
  avg_cpa NUMERIC(18,4),
  avg_roas NUMERIC(10,4),

  -- Performance ranking (0-100)
  performance_score INTEGER, -- Overall score
  engagement_score INTEGER, -- Based on CTR
  conversion_score INTEGER, -- Based on CVR
  efficiency_score INTEGER, -- Based on CPA/ROAS

  -- Status flags
  is_top_performer BOOLEAN DEFAULT FALSE, -- Top 20%
  is_underperforming BOOLEAN DEFAULT FALSE, -- Bottom 20%
  has_recent_data BOOLEAN DEFAULT FALSE, -- Has data in last 7 days

  -- Recommendations
  recommendation TEXT, -- 'use_more', 'optimize', 'pause', 'test_variant'
  recommendation_reason TEXT,

  CONSTRAINT creative_performance_scores_unique UNIQUE (creative_asset_id, days_analyzed)
);

CREATE INDEX idx_creative_performance_scores_asset ON creative_performance_scores(creative_asset_id);
CREATE INDEX idx_creative_performance_scores_top ON creative_performance_scores(is_top_performer) WHERE is_top_performer = TRUE;

COMMENT ON TABLE creative_performance_scores IS 'Scores de performance calculados para cada criativo';
COMMENT ON COLUMN creative_performance_scores.performance_score IS 'Score geral 0-100 baseado em múltiplos KPIs';
COMMENT ON COLUMN creative_performance_scores.recommendation IS 'use_more, optimize, pause, test_variant';

-- ============================================================================
-- VIEW: CREATIVE LIBRARY WITH FOLDERS AND PERFORMANCE
-- ============================================================================
CREATE OR REPLACE VIEW v_creative_library AS
SELECT
  ca.id,
  ca.workspace_id,
  ca.folder_id,
  cf.name AS folder_name,
  cf.color AS folder_color,
  ca.name,
  ca.type,
  ca.status,
  ca.storage_url,
  ca.thumbnail_url,
  ca.aspect_ratio,
  ca.duration_seconds,
  ca.file_size_bytes,
  ca.text_content,
  ca.created_at,
  ca.updated_at,

  -- Count variants
  (SELECT COUNT(*) FROM creative_variants cv WHERE cv.creative_asset_id = ca.id) AS variant_count,

  -- Tags (array)
  COALESCE(
    (SELECT json_agg(json_build_object('id', ct.id, 'name', ct.name, 'color', ct.color))
     FROM creative_asset_tags cat
     JOIN creative_tags ct ON ct.id = cat.tag_id
     WHERE cat.creative_asset_id = ca.id),
    '[]'::json
  ) AS tags,

  -- Performance (last 30 days)
  cps.performance_score,
  cps.engagement_score,
  cps.conversion_score,
  cps.efficiency_score,
  cps.is_top_performer,
  cps.is_underperforming,
  cps.has_recent_data,
  cps.recommendation,
  cps.recommendation_reason,
  cps.avg_ctr,
  cps.avg_cpc,
  cps.avg_roas,
  cps.total_spend,
  cps.total_impressions,
  cps.total_clicks,
  cps.total_conversions,

  -- Usage count
  (SELECT COUNT(DISTINCT ad.id) FROM ads ad WHERE ad.creative_asset_id = ca.id) AS times_used

FROM creative_assets ca
LEFT JOIN creative_folders cf ON cf.id = ca.folder_id
LEFT JOIN creative_performance_scores cps ON cps.creative_asset_id = ca.id AND cps.days_analyzed = 30;

COMMENT ON VIEW v_creative_library IS 'Biblioteca completa de criativos com pastas, tags e performance';

-- ============================================================================
-- FUNCTION: CALCULATE PERFORMANCE SCORES
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_creative_performance_scores(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_creative RECORD;
  v_metrics RECORD;
  v_perf_score INTEGER;
  v_eng_score INTEGER;
  v_conv_score INTEGER;
  v_eff_score INTEGER;
  v_recommendation TEXT;
  v_reason TEXT;
BEGIN
  -- Loop through all creatives in workspace
  FOR v_creative IN
    SELECT ca.id
    FROM creative_assets ca
    WHERE ca.workspace_id = p_workspace_id
  LOOP
    -- Aggregate metrics from v_creative_performance
    SELECT
      COALESCE(SUM(spend::numeric), 0) AS total_spend,
      COALESCE(SUM(impressions::numeric), 0) AS total_impressions,
      COALESCE(SUM(clicks::numeric), 0) AS total_clicks,
      COALESCE(SUM(conversions::numeric), 0) AS total_conversions,
      COALESCE(SUM(revenue::numeric), 0) AS total_revenue,
      CASE WHEN SUM(impressions::numeric) > 0
        THEN (SUM(clicks::numeric) / SUM(impressions::numeric) * 100)::numeric(10,4)
        ELSE NULL
      END AS avg_ctr,
      CASE WHEN SUM(clicks::numeric) > 0
        THEN (SUM(spend::numeric) / SUM(clicks::numeric))::numeric(18,4)
        ELSE NULL
      END AS avg_cpc,
      CASE WHEN SUM(conversions::numeric) > 0
        THEN (SUM(spend::numeric) / SUM(conversions::numeric))::numeric(18,4)
        ELSE NULL
      END AS avg_cpa,
      CASE WHEN SUM(spend::numeric) > 0 AND SUM(revenue::numeric) > 0
        THEN (SUM(revenue::numeric) / SUM(spend::numeric))::numeric(10,4)
        ELSE NULL
      END AS avg_roas,
      MAX(metric_date) AS last_metric_date
    INTO v_metrics
    FROM v_creative_performance
    WHERE creative_id = v_creative.id
      AND workspace_id = p_workspace_id
      AND metric_date >= CURRENT_DATE - p_days
    GROUP BY creative_id;

    -- Calculate scores (0-100)
    -- Engagement Score (based on CTR)
    v_eng_score := CASE
      WHEN v_metrics.avg_ctr IS NULL THEN 0
      WHEN v_metrics.avg_ctr >= 3.0 THEN 100
      WHEN v_metrics.avg_ctr >= 2.0 THEN 80
      WHEN v_metrics.avg_ctr >= 1.0 THEN 60
      WHEN v_metrics.avg_ctr >= 0.5 THEN 40
      ELSE 20
    END;

    -- Conversion Score (based on conversions)
    v_conv_score := CASE
      WHEN v_metrics.total_conversions = 0 THEN 0
      WHEN v_metrics.total_conversions >= 100 THEN 100
      WHEN v_metrics.total_conversions >= 50 THEN 80
      WHEN v_metrics.total_conversions >= 20 THEN 60
      WHEN v_metrics.total_conversions >= 5 THEN 40
      ELSE 20
    END;

    -- Efficiency Score (based on ROAS or CPA)
    v_eff_score := CASE
      WHEN v_metrics.avg_roas IS NOT NULL AND v_metrics.avg_roas >= 4.0 THEN 100
      WHEN v_metrics.avg_roas IS NOT NULL AND v_metrics.avg_roas >= 2.0 THEN 80
      WHEN v_metrics.avg_roas IS NOT NULL AND v_metrics.avg_roas >= 1.0 THEN 60
      WHEN v_metrics.avg_cpa IS NOT NULL AND v_metrics.avg_cpa <= 50 THEN 80
      WHEN v_metrics.avg_cpa IS NOT NULL AND v_metrics.avg_cpa <= 100 THEN 60
      WHEN v_metrics.avg_cpa IS NOT NULL THEN 40
      ELSE 0
    END;

    -- Overall Performance Score (weighted average)
    v_perf_score := (v_eng_score * 0.4 + v_conv_score * 0.3 + v_eff_score * 0.3)::INTEGER;

    -- Recommendations
    IF v_perf_score >= 80 THEN
      v_recommendation := 'use_more';
      v_reason := 'Alto desempenho - escalar investimento';
    ELSIF v_perf_score >= 60 THEN
      v_recommendation := 'optimize';
      v_reason := 'Performance OK - testar variações para melhorar';
    ELSIF v_perf_score >= 40 THEN
      v_recommendation := 'test_variant';
      v_reason := 'Performance mediana - criar nova versão';
    ELSIF v_metrics.total_spend > 0 THEN
      v_recommendation := 'pause';
      v_reason := 'Baixa performance - pausar e substituir';
    ELSE
      v_recommendation := 'ready';
      v_reason := 'Criativo novo - pronto para usar';
    END IF;

    -- Upsert score
    INSERT INTO creative_performance_scores (
      creative_asset_id,
      calculated_at,
      days_analyzed,
      total_spend,
      total_impressions,
      total_clicks,
      total_conversions,
      total_revenue,
      avg_ctr,
      avg_cpc,
      avg_cpa,
      avg_roas,
      performance_score,
      engagement_score,
      conversion_score,
      efficiency_score,
      is_top_performer,
      is_underperforming,
      has_recent_data,
      recommendation,
      recommendation_reason
    ) VALUES (
      v_creative.id,
      NOW(),
      p_days,
      v_metrics.total_spend,
      v_metrics.total_impressions,
      v_metrics.total_clicks,
      v_metrics.total_conversions,
      v_metrics.total_revenue,
      v_metrics.avg_ctr,
      v_metrics.avg_cpc,
      v_metrics.avg_cpa,
      v_metrics.avg_roas,
      v_perf_score,
      v_eng_score,
      v_conv_score,
      v_eff_score,
      v_perf_score >= 80,
      v_perf_score < 40 AND v_metrics.total_spend > 0,
      v_metrics.last_metric_date >= CURRENT_DATE - 7,
      v_recommendation,
      v_reason
    )
    ON CONFLICT (creative_asset_id, days_analyzed)
    DO UPDATE SET
      calculated_at = NOW(),
      total_spend = EXCLUDED.total_spend,
      total_impressions = EXCLUDED.total_impressions,
      total_clicks = EXCLUDED.total_clicks,
      total_conversions = EXCLUDED.total_conversions,
      total_revenue = EXCLUDED.total_revenue,
      avg_ctr = EXCLUDED.avg_ctr,
      avg_cpc = EXCLUDED.avg_cpc,
      avg_cpa = EXCLUDED.avg_cpa,
      avg_roas = EXCLUDED.avg_roas,
      performance_score = EXCLUDED.performance_score,
      engagement_score = EXCLUDED.engagement_score,
      conversion_score = EXCLUDED.conversion_score,
      efficiency_score = EXCLUDED.efficiency_score,
      is_top_performer = EXCLUDED.is_top_performer,
      is_underperforming = EXCLUDED.is_underperforming,
      has_recent_data = EXCLUDED.has_recent_data,
      recommendation = EXCLUDED.recommendation,
      recommendation_reason = EXCLUDED.recommendation_reason;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION calculate_creative_performance_scores IS 'Calcula scores de performance para todos os criativos';

-- ============================================================================
-- SEED: DEFAULT FOLDERS
-- ============================================================================
INSERT INTO creative_folders (id, workspace_id, parent_folder_id, name, description, color, icon, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000010', NULL, 'Top Performers', 'Criativos com melhor desempenho', '#22C55E', 'trophy', 1),
  ('00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-000000000010', NULL, 'Em Uso', 'Criativos atualmente em campanhas ativas', '#3B82F6', 'play', 2),
  ('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000010', NULL, 'Prontos', 'Criativos prontos para usar', '#F59E0B', 'clock', 3),
  ('00000000-0000-0000-0000-000000000f04', '00000000-0000-0000-0000-000000000010', NULL, 'Arquivo', 'Criativos antigos ou pausados', '#6B7280', 'archive', 4)
ON CONFLICT (workspace_id, parent_folder_id, name) DO NOTHING;

-- ============================================================================
-- SEED: DEFAULT TAGS
-- ============================================================================
INSERT INTO creative_tags (workspace_id, name, color)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'Black Friday', '#000000'),
  ('00000000-0000-0000-0000-000000000010', 'Natal', '#DC2626'),
  ('00000000-0000-0000-0000-000000000010', 'Testimonial', '#3B82F6'),
  ('00000000-0000-0000-0000-000000000010', 'Produto X', '#8B5CF6'),
  ('00000000-0000-0000-0000-000000000010', 'Vídeo UGC', '#EC4899')
ON CONFLICT (workspace_id, name) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE creative_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_performance_scores ENABLE ROW LEVEL SECURITY;

-- Policies for creative_folders
CREATE POLICY creative_folders_select ON creative_folders FOR SELECT USING (true);
CREATE POLICY creative_folders_insert ON creative_folders FOR INSERT WITH CHECK (true);
CREATE POLICY creative_folders_update ON creative_folders FOR UPDATE USING (true);
CREATE POLICY creative_folders_delete ON creative_folders FOR DELETE USING (true);

-- Policies for creative_variants
CREATE POLICY creative_variants_select ON creative_variants FOR SELECT USING (true);
CREATE POLICY creative_variants_insert ON creative_variants FOR INSERT WITH CHECK (true);
CREATE POLICY creative_variants_update ON creative_variants FOR UPDATE USING (true);
CREATE POLICY creative_variants_delete ON creative_variants FOR DELETE USING (true);

-- Policies for creative_tags
CREATE POLICY creative_tags_select ON creative_tags FOR SELECT USING (true);
CREATE POLICY creative_tags_insert ON creative_tags FOR INSERT WITH CHECK (true);
CREATE POLICY creative_tags_update ON creative_tags FOR UPDATE USING (true);
CREATE POLICY creative_tags_delete ON creative_tags FOR DELETE USING (true);

-- Policies for creative_asset_tags
CREATE POLICY creative_asset_tags_select ON creative_asset_tags FOR SELECT USING (true);
CREATE POLICY creative_asset_tags_insert ON creative_asset_tags FOR INSERT WITH CHECK (true);
CREATE POLICY creative_asset_tags_delete ON creative_asset_tags FOR DELETE USING (true);

-- Policies for creative_performance_scores
CREATE POLICY creative_performance_scores_select ON creative_performance_scores FOR SELECT USING (true);
CREATE POLICY creative_performance_scores_insert ON creative_performance_scores FOR INSERT WITH CHECK (true);
CREATE POLICY creative_performance_scores_update ON creative_performance_scores FOR UPDATE USING (true);

-- 0005_performance_metric_breakdowns.sql
-- Armazena métricas por breakdown (idade, gênero, placement, etc.).

CREATE TABLE performance_metric_breakdowns (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    granularity TEXT NOT NULL CHECK (granularity IN ('day', 'week', 'month', 'lifetime')),
    metric_date DATE NOT NULL,
    breakdown_key TEXT NOT NULL,
    breakdown_value_key TEXT NOT NULL,
    dimension_values JSONB NOT NULL,
    currency TEXT,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend NUMERIC(18, 4) DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    conversion_value NUMERIC(18, 4) DEFAULT 0,
    extra_metrics JSONB DEFAULT '{}'::JSONB,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (
        workspace_id,
        platform_account_id,
        campaign_id,
        ad_set_id,
        ad_id,
        granularity,
        metric_date,
        breakdown_key,
        breakdown_value_key
    )
);

CREATE INDEX idx_metric_breakdown_lookup
    ON performance_metric_breakdowns (workspace_id, platform_account_id, metric_date, breakdown_key);

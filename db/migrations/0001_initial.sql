-- 0001_initial.sql
-- Foundational schema for the TrafficPro platform

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'password',
    auth_provider_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    plan TEXT NOT NULL DEFAULT 'personal',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'manager', 'analyst', 'viewer')),
    invitation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE platforms (
    key TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('ads', 'analytics', 'crm', 'messaging')),
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platforms (key, category, display_name) VALUES
    ('meta', 'ads', 'Meta Ads'),
    ('google_ads', 'ads', 'Google Ads'),
    ('tiktok', 'ads', 'TikTok Ads'),
    ('linkedin', 'ads', 'LinkedIn Ads'),
    ('youtube', 'ads', 'YouTube Ads'),
    ('whatsapp', 'messaging', 'WhatsApp'),
    ('ga4', 'analytics', 'Google Analytics 4'),
    ('gtm', 'analytics', 'Google Tag Manager'),
    ('meta_pixel', 'analytics', 'Meta Pixel'),
    ('hubspot', 'crm', 'HubSpot'),
    ('salesforce', 'crm', 'Salesforce')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE workspace_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_key TEXT NOT NULL REFERENCES platforms(key),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    auth_type TEXT NOT NULL DEFAULT 'oauth',
    external_organization_id TEXT,
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::JSONB,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, platform_key)
);

CREATE TABLE platform_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
    platform_key TEXT NOT NULL REFERENCES platforms(key),
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT,
    currency TEXT,
    timezone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, external_id)
);

CREATE INDEX idx_platform_accounts_workspace ON platform_accounts (workspace_id);
CREATE INDEX idx_platform_accounts_external ON platform_accounts (external_id);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    objective TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'synced')),
    start_date DATE,
    end_date DATE,
    daily_budget NUMERIC(18, 4),
    lifetime_budget NUMERIC(18, 4),
    targeting JSONB DEFAULT '{}'::JSONB,
    settings JSONB DEFAULT '{}'::JSONB,
    last_synced_at TIMESTAMPTZ,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_account_id, external_id)
);

CREATE INDEX idx_campaigns_workspace ON campaigns (workspace_id);
CREATE INDEX idx_campaigns_platform_account ON campaigns (platform_account_id);
CREATE INDEX idx_campaigns_status ON campaigns (status);

CREATE TABLE campaign_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'synced', 'automation')),
    change_summary TEXT,
    payload JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, version_number)
);

CREATE INDEX idx_campaign_versions_campaign ON campaign_versions (campaign_id, version_number DESC);

CREATE TABLE creative_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE creative_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    creative_set_id UUID REFERENCES creative_sets(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'text', 'carousel', 'html', 'template')),
    name TEXT NOT NULL,
    storage_url TEXT,
    thumbnail_url TEXT,
    original_file_name TEXT,
    file_size_bytes BIGINT,
    duration_seconds NUMERIC(10, 2),
    aspect_ratio TEXT,
    text_content TEXT,
    hash TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creative_assets_workspace ON creative_assets (workspace_id);
CREATE INDEX idx_creative_assets_type ON creative_assets (type);

CREATE TABLE creative_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creative_asset_id UUID NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
    variant_type TEXT NOT NULL DEFAULT 'default',
    headline TEXT,
    primary_text TEXT,
    description TEXT,
    call_to_action TEXT,
    parameters JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE creative_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE creative_ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    creative_asset_id UUID REFERENCES creative_assets(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    generated_by TEXT NOT NULL DEFAULT 'internal',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE ad_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    start_date DATE,
    end_date DATE,
    bid_strategy TEXT,
    bid_amount NUMERIC(18, 4),
    budget_type TEXT,
    daily_budget NUMERIC(18, 4),
    lifetime_budget NUMERIC(18, 4),
    targeting JSONB DEFAULT '{}'::JSONB,
    settings JSONB DEFAULT '{}'::JSONB,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, external_id)
);

CREATE INDEX idx_ad_sets_campaign ON ad_sets (campaign_id);
CREATE INDEX idx_ad_sets_status ON ad_sets (status);

CREATE TABLE ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    creative_asset_id UUID REFERENCES creative_assets(id),
    external_id TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ad_set_id, external_id)
);

CREATE INDEX idx_ads_ad_set ON ads (ad_set_id);
CREATE INDEX idx_ads_status ON ads (status);

CREATE TABLE audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE SET NULL,
    external_id TEXT,
    name TEXT NOT NULL,
    audience_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    size_estimate BIGINT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'synced', 'imported')),
    description TEXT,
    filters JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    last_synced_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_account_id, external_id)
);

CREATE INDEX idx_audiences_workspace ON audiences (workspace_id);

CREATE TABLE audience_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    definition JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (audience_id, version_number)
);

CREATE TABLE utm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_url TEXT,
    defaults JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_utm_templates_default ON utm_templates (workspace_id) WHERE is_default = true;

CREATE TABLE utm_template_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utm_template_id UUID NOT NULL REFERENCES utm_templates(id) ON DELETE CASCADE,
    param_key TEXT NOT NULL,
    param_value TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (utm_template_id, param_key)
);

CREATE TABLE utm_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    utm_template_id UUID REFERENCES utm_templates(id) ON DELETE SET NULL,
    base_url TEXT NOT NULL,
    parameters JSONB NOT NULL,
    generated_url TEXT NOT NULL,
    context TEXT,
    generated_for_type TEXT,
    generated_for_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_utm_links_workspace ON utm_links (workspace_id);

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    scope TEXT NOT NULL DEFAULT 'campaign' CHECK (scope IN ('account', 'campaign', 'ad_set', 'ad')),
    evaluation_window_minutes INTEGER DEFAULT 60,
    schedule JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_rule_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    operator TEXT NOT NULL,
    threshold NUMERIC(18, 4),
    lookback_minutes INTEGER DEFAULT 1440,
    additional_filters JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_rule_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_rule_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id),
    campaign_id UUID REFERENCES campaigns(id),
    ad_set_id UUID REFERENCES ad_sets(id),
    ad_id UUID REFERENCES ads(id),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    result TEXT NOT NULL CHECK (result IN ('success', 'skipped', 'failed')),
    message TEXT,
    payload JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_automation_executions_rule ON automation_executions (automation_rule_id, executed_at DESC);

CREATE TABLE bidding_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    objective TEXT,
    strategy_type TEXT NOT NULL,
    target_value NUMERIC(18, 4),
    min_bid NUMERIC(18, 4),
    max_bid NUMERIC(18, 4),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bidding_strategy_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bidding_strategy_id UUID NOT NULL REFERENCES bidding_strategies(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    result TEXT NOT NULL CHECK (result IN ('success', 'skipped', 'failed')),
    summary TEXT,
    metrics JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_bidding_strategy_runs_strategy ON bidding_strategy_runs (bidding_strategy_id, executed_at DESC);

CREATE TABLE performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    creative_asset_id UUID REFERENCES creative_assets(id) ON DELETE SET NULL,
    granularity TEXT NOT NULL CHECK (granularity IN ('hour', 'day', 'week', 'month', 'lifetime')),
    metric_date DATE NOT NULL,
    metric_hour SMALLINT,
    currency TEXT,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    reach BIGINT,
    frequency NUMERIC(10, 4),
    spend NUMERIC(18, 4) DEFAULT 0,
    cpm NUMERIC(18, 4),
    cpc NUMERIC(18, 4),
    ctr NUMERIC(18, 4),
    cpa NUMERIC(18, 4),
    roas NUMERIC(18, 4),
    conversions BIGINT,
    conversion_value NUMERIC(18, 4),
    leads BIGINT,
    ltv_estimated NUMERIC(18, 4),
    extra_metrics JSONB DEFAULT '{}'::JSONB,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_performance_metrics_lookup ON performance_metrics (workspace_id, granularity, metric_date);
CREATE INDEX idx_performance_metrics_entities ON performance_metrics (campaign_id, ad_set_id, ad_id);

CREATE TABLE attribution_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    lookback_window_days INTEGER NOT NULL DEFAULT 7,
    config JSONB DEFAULT '{}'::JSONB,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attribution_results (
    id BIGSERIAL PRIMARY KEY,
    attribution_model_id UUID NOT NULL REFERENCES attribution_models(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    conversions BIGINT,
    revenue NUMERIC(18, 4),
    credit_distribution JSONB DEFAULT '{}'::JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attribution_results_model_date ON attribution_results (attribution_model_id, metric_date);

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    delivery_channel TEXT NOT NULL,
    recipients TEXT[] NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('csv', 'pdf', 'dashboard')),
    cadence TEXT NOT NULL,
    next_run_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
    report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    file_url TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_report_runs_template ON report_runs (report_template_id, run_at DESC);

CREATE TABLE analytics_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
    platform_key TEXT NOT NULL REFERENCES platforms(key),
    external_id TEXT NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_integration_id, external_id)
);

CREATE TABLE crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_integration_id, external_id)
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    ad_set_id UUID REFERENCES ad_sets(id) ON DELETE SET NULL,
    ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
    external_lead_id TEXT,
    source_platform TEXT,
    source_detail TEXT,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    value NUMERIC(18, 4),
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'disqualified', 'converted')),
    stage TEXT,
    assigned_to UUID REFERENCES users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, external_lead_id)
);

CREATE INDEX idx_leads_workspace_status ON leads (workspace_id, status);

CREATE TABLE lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    performed_by UUID REFERENCES users(id),
    payload JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_lead_events_lead ON lead_events (lead_id, event_at DESC);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    config JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    severity TEXT NOT NULL,
    message TEXT,
    subjects JSONB DEFAULT '{}'::JSONB,
    delivered BOOLEAN NOT NULL DEFAULT false,
    delivery_channels TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_alert_events_alert ON alert_events (alert_id, triggered_at DESC);

CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    hypothesis TEXT,
    primary_metric TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
    traffic_allocation_strategy TEXT NOT NULL DEFAULT 'even',
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    allocation_percent NUMERIC(5, 2),
    associated_ad_set_id UUID REFERENCES ad_sets(id) ON DELETE SET NULL,
    associated_ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (experiment_id, name)
);

CREATE TABLE experiment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES experiment_variants(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    metric_date DATE NOT NULL,
    sample_size BIGINT,
    value NUMERIC(18, 4),
    standard_error NUMERIC(18, 6),
    p_value NUMERIC(18, 6),
    is_winner BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (experiment_id, variant_id, metric_type, metric_date)
);

CREATE TABLE budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    allocation_date DATE NOT NULL,
    target_spend NUMERIC(18, 4),
    actual_spend NUMERIC(18, 4),
    budget_cap NUMERIC(18, 4),
    pacing_status TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, allocation_date)
);

CREATE TABLE budget_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    projected_spend NUMERIC(18, 4),
    projected_conversions NUMERIC(18, 4),
    projected_revenue NUMERIC(18, 4),
    assumptions JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_workspace ON activity_logs (workspace_id, created_at DESC);

CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    event_types TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    delivered_at TIMESTAMPTZ,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE data_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    parameters JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_sync_jobs_workspace ON data_sync_jobs (workspace_id, scheduled_at DESC);

CREATE TABLE data_sync_cursors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    cursor JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_account_id, entity_type)
);

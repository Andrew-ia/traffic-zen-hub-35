-- Seed de desenvolvimento para TrafficPro
-- Executar apenas em ambientes de testes / desenvolvimento

WITH upsert_user AS (
  INSERT INTO users (id, email, full_name, password_hash, auth_provider, status)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'founder@trafficpro.dev',
    'Founder TrafficPro',
    crypt('admin123', gen_salt('bf')),
    'password',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        status = 'active'
  RETURNING id AS user_id
),
upsert_workspace AS (
  INSERT INTO workspaces (id, name, slug, plan, timezone, currency)
  VALUES ('00000000-0000-0000-0000-000000000010', 'TrafficPro Sandbox', 'trafficpro-sandbox', 'personal', 'America/Sao_Paulo', 'BRL')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        timezone = EXCLUDED.timezone,
        currency = EXCLUDED.currency
  RETURNING id AS workspace_id
),
workspace_owner AS (
  INSERT INTO workspace_members (workspace_id, user_id, role, invitation_status)
  SELECT upsert_workspace.workspace_id, upsert_user.user_id, 'owner', 'accepted'
  FROM upsert_workspace, upsert_user
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'owner',
        invitation_status = 'accepted'
  RETURNING workspace_id, user_id
),
meta_integration AS (
  INSERT INTO workspace_integrations (id, workspace_id, platform_key, status, auth_type, metadata)
  SELECT
    '00000000-0000-0000-0000-000000000020',
    workspace_id,
    'meta',
    'active',
    'oauth',
    jsonb_build_object('environment', 'sandbox')
  FROM upsert_workspace
  ON CONFLICT (id) DO UPDATE
    SET status = 'active',
        metadata = EXCLUDED.metadata
  RETURNING id AS integration_id, workspace_id
),
meta_account AS (
  INSERT INTO platform_accounts (
    id,
    workspace_id,
    integration_id,
    platform_key,
    external_id,
    name,
    account_type,
    currency,
    timezone,
    status,
    metadata
  )
  SELECT
    '00000000-0000-0000-0000-000000000030',
    meta_integration.workspace_id,
    meta_integration.integration_id,
    'meta',
    'acc_demo_001',
    'Meta Demo Account',
    'business',
    'BRL',
    'America/Sao_Paulo',
    'active',
    jsonb_build_object('notes', 'Conta fictícia para testes do dashboard')
  FROM meta_integration
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'active'
  RETURNING id AS platform_account_id, workspace_id
),
demo_campaign AS (
  INSERT INTO campaigns (
    id,
    workspace_id,
    platform_account_id,
    external_id,
    name,
    objective,
    status,
    source,
    start_date,
    end_date,
    daily_budget,
    targeting,
    settings,
    created_by
  )
  SELECT
    '00000000-0000-0000-0000-000000000040',
    meta_account.workspace_id,
    meta_account.platform_account_id,
    'camp_demo_001',
    'Lançamento Produto X',
    'SALES',
    'active',
    'manual',
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '21 days',
    150.00,
    jsonb_build_object(
      'geo', jsonb_build_object('countries', ARRAY['BR']),
      'age_range', jsonb_build_object('min', 25, 'max', 45)
    ),
    jsonb_build_object('optimization_goal', 'conversions'),
    workspace_owner.user_id
  FROM meta_account
  JOIN workspace_owner USING (workspace_id)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'active',
        daily_budget = EXCLUDED.daily_budget
  RETURNING id AS campaign_id, workspace_id, platform_account_id
),
demo_ad_set AS (
  INSERT INTO ad_sets (
    id,
    campaign_id,
    platform_account_id,
    external_id,
    name,
    status,
    start_date,
    end_date,
    bid_strategy,
    bid_amount,
    budget_type,
    daily_budget,
    targeting
  )
  SELECT
    '00000000-0000-0000-0000-000000000050',
    demo_campaign.campaign_id,
    demo_campaign.platform_account_id,
    'adset_demo_001',
    'Remarketing Site 30d',
    'active',
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '21 days',
    'lowest_cost',
    NULL,
    'daily',
    150.00,
    jsonb_build_object('remarketing_window_days', 30)
  FROM demo_campaign
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'active'
  RETURNING id AS ad_set_id, campaign_id, platform_account_id
),
demo_creative_asset AS (
  INSERT INTO creative_assets (
    id,
    workspace_id,
    type,
    name,
    storage_url,
    thumbnail_url,
    original_file_name,
    file_size_bytes,
    duration_seconds,
    aspect_ratio,
    text_content,
    metadata,
    created_by
  )
  SELECT
    '00000000-0000-0000-0000-000000000060',
    workspace_owner.workspace_id,
    'image',
    'Banner Lançamento Produto X',
    'https://placehold.co/1200x1200',
    'https://placehold.co/200x200',
    'banner_produto_x.png',
    245678,
    NULL,
    '1:1',
    'Descubra o novo Produto X com frete grátis hoje.',
    jsonb_build_object('performance_note', '+24% CTR vs baseline'),
    workspace_owner.user_id
  FROM workspace_owner
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        metadata = EXCLUDED.metadata
  RETURNING id AS creative_asset_id, workspace_id
),
demo_ad AS (
  INSERT INTO ads (
    id,
    ad_set_id,
    platform_account_id,
    creative_asset_id,
    external_id,
    name,
    status,
    metadata
  )
  SELECT
    '00000000-0000-0000-0000-000000000070',
    demo_ad_set.ad_set_id,
    demo_ad_set.platform_account_id,
    demo_creative_asset.creative_asset_id,
    'ad_demo_001',
    'Produto X | Conversões',
    'active',
    jsonb_build_object('format', 'single_image')
  FROM demo_ad_set
  JOIN demo_campaign USING (campaign_id)
  JOIN demo_creative_asset ON demo_creative_asset.workspace_id = demo_campaign.workspace_id
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'active'
  RETURNING id AS ad_id, ad_set_id, platform_account_id, creative_asset_id
),
metrics_insert AS (
  INSERT INTO performance_metrics (
    workspace_id,
    platform_account_id,
    campaign_id,
    ad_set_id,
    ad_id,
    creative_asset_id,
    granularity,
    metric_date,
    currency,
    impressions,
    clicks,
    spend,
    ctr,
    cpc,
    cpa,
    roas,
    conversions,
    conversion_value,
    leads,
    ltv_estimated,
    extra_metrics
  )
  SELECT
    demo_campaign.workspace_id,
    demo_campaign.platform_account_id,
    demo_campaign.campaign_id,
    demo_ad_set.ad_set_id,
    demo_ad.ad_id,
    demo_ad.creative_asset_id,
    'day',
    CURRENT_DATE - INTERVAL '1 day',
    'BRL',
    125500,
    4200,
    3200.00,
    3.35,
    0.76,
    20.51,
    4.8,
    156,
    6240.00,
    35,
    7200.00,
    jsonb_build_object('frequency', 2.1, 'reach', 59800)
  FROM demo_campaign
  JOIN demo_ad_set USING (campaign_id)
  JOIN demo_ad ON demo_ad.ad_set_id = demo_ad_set.ad_set_id
  ON CONFLICT DO NOTHING
)
SELECT 'Seed executado com sucesso' AS message;

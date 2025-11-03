-- 0014_fix_campaign_kpi_uuid.sql
-- Fix UUID conversion in v_campaign_kpi view to handle text IDs

DROP VIEW IF EXISTS v_campaign_kpi;

CREATE OR REPLACE VIEW v_campaign_kpi AS
SELECT
  f.d AS metric_date,
  '67bdea74-50a7-485f-813b-4090c9ddb98c'::uuid AS workspace_id,
  f.platform AS platform_key,
  f.account_id AS account_external_id,
  NULL::uuid AS platform_account_id,
  -- Try to convert campaign_id to UUID, fallback to NULL if invalid
  CASE
    WHEN f.campaign_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN f.campaign_id::uuid
    ELSE NULL
  END AS campaign_id,
  -- Try to convert ad_set_id to UUID, fallback to NULL if invalid
  CASE
    WHEN f.adset_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN f.adset_id::uuid
    ELSE NULL
  END AS ad_set_id,
  -- Try to convert ad_id to UUID, fallback to NULL if invalid
  CASE
    WHEN f.ad_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN f.ad_id::uuid
    ELSE NULL
  END AS ad_id,
  f.campaign_id AS campaign_external_id,
  UPPER(COALESCE(f.objective, 'UNKNOWN')) AS objective,
  f.spend,
  f.clicks,
  f.revenue,
  -- Result label based on objective
  CASE
    WHEN UPPER(f.objective) IN ('OUTCOME_LEADS', 'LEAD_GENERATION') THEN 'Leads'
    WHEN UPPER(f.objective) IN ('MESSAGES', 'OUTCOME_MESSAGES') THEN 'Conversas'
    WHEN UPPER(f.objective) IN ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') THEN 'Cliques'
    WHEN UPPER(f.objective) IN ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') THEN 'Engajamentos'
    WHEN UPPER(f.objective) IN ('VIDEO_VIEWS') THEN 'Views'
    WHEN UPPER(f.objective) IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') THEN 'Compras'
    WHEN f.platform = 'google_ads' THEN 'Cliques'
    ELSE 'Resultados'
  END AS result_label,
  -- Result value based on objective
  CASE
    WHEN UPPER(f.objective) IN ('OUTCOME_LEADS', 'LEAD_GENERATION') THEN NULLIF(f.conv_primary, 0)
    WHEN UPPER(f.objective) IN ('MESSAGES', 'OUTCOME_MESSAGES') THEN NULLIF(f.messages_started, 0)
    WHEN UPPER(f.objective) IN ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') THEN NULLIF(f.clicks, 0)
    WHEN UPPER(f.objective) IN ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') THEN NULLIF(f.conv_primary, 0)
    WHEN UPPER(f.objective) IN ('VIDEO_VIEWS') THEN NULLIF(f.conv_primary, 0)
    WHEN UPPER(f.objective) IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') THEN NULLIF(f.purchases, 0)
    WHEN f.platform = 'google_ads' THEN NULLIF(f.clicks, 0)
    ELSE NULLIF(f.conv_primary, 0)
  END AS result_value,
  -- Cost per result
  CASE
    WHEN UPPER(f.objective) IN ('OUTCOME_LEADS', 'LEAD_GENERATION') AND f.conv_primary > 0 THEN f.spend / f.conv_primary
    WHEN UPPER(f.objective) IN ('MESSAGES', 'OUTCOME_MESSAGES') AND f.messages_started > 0 THEN f.spend / f.messages_started
    WHEN UPPER(f.objective) IN ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') AND f.clicks > 0 THEN f.spend / f.clicks
    WHEN UPPER(f.objective) IN ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') AND f.conv_primary > 0 THEN f.spend / f.conv_primary
    WHEN UPPER(f.objective) IN ('VIDEO_VIEWS') AND f.conv_primary > 0 THEN f.spend / f.conv_primary
    WHEN UPPER(f.objective) IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') AND f.purchases > 0 THEN f.spend / f.purchases
    WHEN f.platform = 'google_ads' AND f.clicks > 0 THEN f.spend / f.clicks
    WHEN f.conv_primary > 0 THEN f.spend / f.conv_primary
    ELSE NULL
  END AS cost_per_result,
  -- ROAS (only for SALES objectives)
  CASE
    WHEN UPPER(f.objective) IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE')
      AND f.revenue > 0 AND f.spend > 0
      THEN f.revenue / f.spend
    ELSE NULL
  END AS roas
FROM fact_ads_daily f;

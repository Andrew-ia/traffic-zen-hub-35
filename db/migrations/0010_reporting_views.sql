-- 0010_reporting_views.sql
-- Cria views analíticas para IA e dashboards

CREATE OR REPLACE VIEW reporting_channel_totals AS
SELECT
  pm.workspace_id,
  'meta'::text AS channel,
  pm.metric_date,
  SUM(pm.spend) AS spend,
  SUM(pm.impressions) AS impressions,
  SUM(pm.clicks) AS clicks,
  SUM(pm.conversions) AS conversions,
  SUM(pm.conversion_value) AS conversion_value
FROM performance_metrics pm
JOIN platform_accounts pa ON pm.platform_account_id = pa.id
WHERE pa.platform_key = 'meta'
GROUP BY pm.workspace_id, pm.metric_date
UNION ALL
SELECT
  g.workspace_id,
  'google_ads'::text AS channel,
  g.metric_date,
  SUM(g.cost_micros) / 1000000::numeric AS spend,
  SUM(g.impressions) AS impressions,
  SUM(g.clicks) AS clicks,
  SUM(g.conversions) AS conversions,
  SUM(g.conversions_value) AS conversion_value
FROM ads_spend_google g
GROUP BY g.workspace_id, g.metric_date;


CREATE OR REPLACE VIEW reporting_campaign_daily AS
SELECT
  pm.workspace_id,
  pa.platform_key,
  pm.metric_date,
  c.id AS campaign_id,
  COALESCE(c.name, pm.campaign_id::text) AS campaign_name,
  SUM(pm.spend) AS spend,
  SUM(pm.impressions) AS impressions,
  SUM(pm.clicks) AS clicks,
  SUM(pm.conversions) AS conversions,
  SUM(pm.conversion_value) AS conversion_value
FROM performance_metrics pm
JOIN platform_accounts pa ON pm.platform_account_id = pa.id
LEFT JOIN campaigns c ON pm.campaign_id = c.id
WHERE pm.campaign_id IS NOT NULL
GROUP BY pm.workspace_id, pa.platform_key, pm.metric_date, c.id, campaign_name
UNION ALL
SELECT
  g.workspace_id,
  'google_ads' AS platform_key,
  g.metric_date,
  g.campaign_id::uuid AS campaign_id,
  COALESCE(g.campaign_name, g.campaign_id::text) AS campaign_name,
  SUM(g.cost_micros) / 1000000::numeric AS spend,
  SUM(g.impressions) AS impressions,
  SUM(g.clicks) AS clicks,
  SUM(g.conversions) AS conversions,
  SUM(g.conversions_value) AS conversion_value
FROM ads_spend_google g
GROUP BY g.workspace_id, g.metric_date, g.campaign_id, campaign_name;


CREATE OR REPLACE VIEW reporting_objective_summary AS
SELECT
  pm.workspace_id,
  c.objective,
  pm.metric_date,
  SUM(pm.spend) AS spend,
  SUM(pm.impressions) AS impressions,
  SUM(pm.clicks) AS clicks,
  SUM(pm.conversions) AS conversions,
  SUM(pm.conversion_value) AS conversion_value
FROM performance_metrics pm
JOIN campaigns c ON pm.campaign_id = c.id
JOIN platform_accounts pa ON pm.platform_account_id = pa.id
WHERE pa.platform_key = 'meta'
GROUP BY pm.workspace_id, c.objective, pm.metric_date;


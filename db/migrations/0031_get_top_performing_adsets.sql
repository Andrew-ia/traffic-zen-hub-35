CREATE OR REPLACE FUNCTION public.get_top_performing_adsets(
  p_workspace_id uuid,
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  name text,
  campaign_name text,
  avg_ctr numeric,
  avg_cpc numeric,
  total_conversions numeric,
  total_spend numeric,
  total_clicks numeric,
  total_impressions numeric,
  total_conversion_value numeric,
  primary_conversion_action text
)
LANGUAGE sql
STABLE
AS $$
WITH pm AS (
  SELECT
    pm.ad_set_id,
    pm.spend,
    pm.impressions,
    pm.clicks,
    pm.conversions,
    pm.conversion_value,
    pm.extra_metrics
  FROM performance_metrics pm
  WHERE pm.workspace_id = p_workspace_id
    AND pm.metric_date >= CURRENT_DATE - p_days::int
    AND pm.granularity = 'day'
    AND pm.ad_set_id IS NOT NULL
), agg AS (
  SELECT
    ad_set_id,
    SUM(spend) AS total_spend,
    SUM(impressions) AS total_impressions,
    SUM(clicks) AS total_clicks,
    SUM(conversions) AS total_conversions,
    SUM(conversion_value) AS total_conversion_value,
    MAX(CASE WHEN extra_metrics ? 'derived_metrics' THEN extra_metrics->'derived_metrics'->>'primary_conversion_action' ELSE NULL END) AS primary_conversion_action
  FROM pm
  GROUP BY ad_set_id
), calc AS (
  SELECT
    agg.ad_set_id AS id,
    s.name,
    c.name AS campaign_name,
    CASE WHEN agg.total_impressions > 0 THEN (agg.total_clicks::numeric / agg.total_impressions::numeric) * 100 ELSE NULL END AS avg_ctr,
    CASE WHEN agg.total_clicks > 0 THEN agg.total_spend::numeric / agg.total_clicks::numeric ELSE NULL END AS avg_cpc,
    agg.total_conversions,
    agg.total_spend,
    agg.total_clicks,
    agg.total_impressions,
    agg.total_conversion_value,
    agg.primary_conversion_action
  FROM agg
  LEFT JOIN ad_sets s ON s.id = agg.ad_set_id
  LEFT JOIN campaigns c ON c.id = s.campaign_id
  WHERE c.workspace_id = p_workspace_id
)
SELECT *
FROM calc
WHERE avg_ctr IS NOT NULL AND avg_cpc IS NOT NULL
ORDER BY avg_ctr DESC
LIMIT p_limit;
$$;

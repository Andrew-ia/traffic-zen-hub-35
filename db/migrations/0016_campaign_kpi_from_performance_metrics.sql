-- 0016_campaign_kpi_from_performance_metrics.sql
-- Final version: Use performance_metrics with correct workspace ID

DROP VIEW IF EXISTS v_campaign_kpi;

CREATE OR REPLACE VIEW v_campaign_kpi AS
WITH metrics AS (
  SELECT
    pm.metric_date,
    pm.workspace_id,
    pa.platform_key,
    pa.external_id AS account_external_id,
    pm.platform_account_id,
    pm.campaign_id,
    pm.ad_set_id,
    pm.ad_id,
    UPPER(COALESCE(c.objective, 'UNKNOWN')) AS objective,
    pm.spend::numeric AS spend,
    pm.clicks::numeric AS clicks,
    pm.conversion_value::numeric AS conversion_value,
    pm.conversions::numeric AS conversions,
    pm.extra_metrics
  FROM performance_metrics pm
  JOIN platform_accounts pa ON pa.id = pm.platform_account_id
  LEFT JOIN campaigns c ON c.id = pm.campaign_id
  WHERE pm.granularity = 'day'
),
metrics_with_actions AS (
  SELECT
    m.*,
    COALESCE((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'conversations_started')::numeric, 0) AS conversations_started_derived,
    COALESCE((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'messaging_connections')::numeric, 0) AS messaging_connections_derived,
    acts.leads,
    acts.video_views,
    acts.engagements,
    acts.conversations,
    acts.purchases
  FROM metrics m
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM((action ->> 'value')::numeric) FILTER (
        WHERE action ->> 'action_type' IN (
          'lead',
          'fb_pixel_lead',
          'omni_lead',
          'complete_registration',
          'omni_complete_registration',
          'onsite_conversion.lead',
          'lead_generation',
          'offsite_conversion.fb_pixel_lead'
        )
      ), 0) AS leads,
      COALESCE(SUM((action ->> 'value')::numeric) FILTER (
        WHERE action ->> 'action_type' IN (
          'video_view',
          'three_second_video_view',
          'throughplay',
          'thruplay',
          'omni_video_play',
          'omni_video_view'
        )
      ), 0) AS video_views,
      COALESCE(SUM((action ->> 'value')::numeric) FILTER (
        WHERE action ->> 'action_type' IN (
          'post_engagement',
          'page_engagement',
          'post_interaction_gross',
          'post_reaction',
          'comment',
          'like',
          'omni_engagement',
          'post'
        )
      ), 0) AS engagements,
      COALESCE(SUM((action ->> 'value')::numeric) FILTER (
        WHERE action ->> 'action_type' IN (
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.whatsapp_conversation_started_7d'
        )
      ), 0) AS conversations,
      COALESCE(SUM((action ->> 'value')::numeric) FILTER (
        WHERE action ->> 'action_type' IN (
          'purchase',
          'omni_purchase',
          'onsite_conversion.purchase',
          'offsite_conversion.fb_pixel_purchase'
        )
      ), 0) AS purchases
    FROM jsonb_array_elements(COALESCE(m.extra_metrics -> 'actions', '[]'::jsonb)) AS action
  ) acts ON TRUE
),
aggregated AS (
  SELECT
    mwa.metric_date,
    mwa.workspace_id,
    mwa.platform_key,
    mwa.platform_account_id,
    mwa.account_external_id,
    mwa.campaign_id,
    mwa.objective,
    SUM(mwa.spend)::numeric AS spend,
    SUM(mwa.clicks)::numeric AS clicks,
    SUM(mwa.conversion_value)::numeric AS conversion_value,
    SUM(mwa.conversions)::numeric AS conversions,
    SUM(mwa.conversations_started_derived)::numeric AS conversations_started_derived,
    SUM(mwa.messaging_connections_derived)::numeric AS messaging_connections_derived,
    SUM(mwa.leads)::numeric AS leads,
    SUM(mwa.video_views)::numeric AS video_views,
    SUM(mwa.engagements)::numeric AS engagements,
    SUM(mwa.conversations)::numeric AS conversations,
    SUM(mwa.purchases)::numeric AS purchases
  FROM metrics_with_actions mwa
  GROUP BY
    mwa.metric_date,
    mwa.workspace_id,
    mwa.platform_key,
    mwa.platform_account_id,
    mwa.account_external_id,
    mwa.campaign_id,
    mwa.objective
),
final AS (
  SELECT
    agg.metric_date,
    agg.workspace_id,
    agg.platform_key,
    agg.platform_account_id,
    agg.account_external_id,
    agg.campaign_id,
    NULL::uuid AS ad_set_id,
    NULL::uuid AS ad_id,
    agg.objective,
    agg.spend,
    agg.clicks,
    agg.conversion_value,
    agg.conversions,
    CASE
      WHEN agg.objective IN ('OUTCOME_LEADS', 'LEAD_GENERATION') THEN 'Leads'
      WHEN agg.objective IN ('MESSAGES', 'OUTCOME_MESSAGES') THEN 'Conversas'
      WHEN agg.objective IN ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') THEN 'Cliques'
      WHEN agg.objective IN ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') THEN 'Engajamentos'
      WHEN agg.objective IN ('VIDEO_VIEWS') THEN 'Views'
      WHEN agg.objective IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') THEN 'Compras'
      WHEN agg.platform_key = 'google_ads' THEN 'Cliques'
      ELSE 'Resultados'
    END AS result_label,
    CASE
      WHEN agg.objective IN ('OUTCOME_LEADS', 'LEAD_GENERATION') THEN NULLIF(agg.leads, 0)
      WHEN agg.objective IN ('MESSAGES', 'OUTCOME_MESSAGES') THEN NULLIF(GREATEST(agg.conversations_started_derived, agg.conversations), 0)
      WHEN agg.objective IN ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') THEN NULLIF(agg.clicks, 0)
      WHEN agg.objective IN ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') THEN NULLIF(agg.engagements, 0)
      WHEN agg.objective IN ('VIDEO_VIEWS') THEN NULLIF(agg.video_views, 0)
      WHEN agg.objective IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') THEN NULLIF(agg.purchases, 0)
      WHEN agg.platform_key = 'google_ads' THEN NULLIF(agg.clicks, 0)
      ELSE NULLIF(agg.conversions, 0)
    END AS result_value
  FROM aggregated agg
)
SELECT
  metric_date,
  workspace_id,
  platform_key,
  platform_account_id,
  account_external_id,
  campaign_id,
  ad_set_id,
  ad_id,
  objective,
  spend,
  clicks,
  conversion_value AS revenue,
  result_label,
  result_value,
  CASE WHEN result_value IS NOT NULL AND result_value > 0 THEN spend / result_value ELSE NULL END AS cost_per_result,
  CASE
    WHEN objective IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') AND conversion_value > 0 AND spend > 0
      THEN conversion_value / spend
    ELSE NULL
  END AS roas,
  NULL::numeric AS instagram_follows
FROM final;

-- 0041_create_performance_daily_view.sql
-- Create a view to aggregate performance metrics by workspace and date
-- This moves the aggregation logic from the frontend to the database
-- Includes extraction of key messaging metrics from JSONB

CREATE OR REPLACE VIEW vw_performance_daily AS
WITH expanded_metrics AS (
    SELECT
        workspace_id,
        metric_date,
        impressions,
        clicks,
        spend,
        conversions,
        conversion_value,
        -- Extract Conversation Started
        COALESCE((
            SELECT SUM((x->>'value')::numeric)
            FROM jsonb_array_elements(extra_metrics->'actions') t(x)
            WHERE x->>'action_type' = 'onsite_conversion.messaging_conversation_started_7d'
        ), 0) as conversations_started,
        -- Extract Messaging Connections
        COALESCE((
            SELECT SUM((x->>'value')::numeric)
            FROM jsonb_array_elements(extra_metrics->'actions') t(x)
            WHERE x->>'action_type' = 'onsite_conversion.total_messaging_connection'
        ), 0) as messaging_connections,
        synced_at
    FROM performance_metrics
)
SELECT
    workspace_id,
    metric_date,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks,
    SUM(spend) as spend,
    SUM(conversions) as conversions,
    SUM(conversion_value) as conversion_value,
    SUM(conversations_started) as conversations_started,
    SUM(messaging_connections) as messaging_connections,
    CASE 
        WHEN SUM(spend) > 0 THEN SUM(conversion_value) / SUM(spend)
        ELSE 0 
    END as roas,
    MAX(synced_at) as last_synced_at
FROM
    expanded_metrics
GROUP BY
    workspace_id,
    metric_date;

-- Grant access to authenticated users
GRANT SELECT ON vw_performance_daily TO authenticated;
GRANT SELECT ON vw_performance_daily TO service_role;

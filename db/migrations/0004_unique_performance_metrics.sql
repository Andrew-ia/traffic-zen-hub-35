-- 0004_unique_performance_metrics.sql
-- Índice único para suportar upsert das métricas diárias.

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_metrics_unique_day
  ON performance_metrics (workspace_id, platform_account_id, campaign_id, ad_set_id, ad_id, granularity, metric_date);

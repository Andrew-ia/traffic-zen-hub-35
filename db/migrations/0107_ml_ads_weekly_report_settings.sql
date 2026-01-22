-- Weekly report settings for Mercado Ads

CREATE TABLE IF NOT EXISTS ml_ads_weekly_report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_day INTEGER NOT NULL DEFAULT 1,
  send_hour INTEGER NOT NULL DEFAULT 9,
  channel TEXT NOT NULL DEFAULT 'telegram',
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_ads_weekly_report_workspace
  ON ml_ads_weekly_report_settings (workspace_id);

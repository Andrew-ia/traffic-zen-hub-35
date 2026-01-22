-- Add action rules for Mercado Ads automation

CREATE TABLE IF NOT EXISTS ml_ads_action_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_ml_ads_action_rules_workspace
  ON ml_ads_action_rules (workspace_id);

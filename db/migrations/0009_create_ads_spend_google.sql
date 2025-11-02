-- Migration: Create ads_spend_google table for Google Ads metrics
-- Created: 2025-11-02

CREATE TABLE IF NOT EXISTS ads_spend_google (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,

  -- Google Ads hierarchy
  customer_id TEXT NOT NULL, -- Google Ads Customer ID
  campaign_id_google TEXT, -- Campaign ID in Google Ads
  ad_group_id_google TEXT, -- Ad Group ID in Google Ads
  ad_id_google TEXT, -- Ad ID in Google Ads

  -- Internal references (if synced to our campaigns table)
  campaign_id UUID REFERENCES campaigns(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  ad_id UUID REFERENCES ads(id),

  -- Time dimension
  metric_date DATE NOT NULL,
  granularity TEXT NOT NULL DEFAULT 'day',

  -- Basic metrics
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0, -- Cost in micros (divide by 1,000,000)
  conversions NUMERIC(18,4) DEFAULT 0,
  conversions_value NUMERIC(18,4) DEFAULT 0,

  -- Calculated metrics
  ctr NUMERIC(18,6), -- Click-through rate
  cpc_micros BIGINT, -- Cost per click in micros
  average_cpc NUMERIC(18,4), -- Average CPC in currency
  cpa_micros BIGINT, -- Cost per acquisition in micros

  -- Metadata
  currency TEXT DEFAULT 'BRL',
  campaign_name TEXT,
  ad_group_name TEXT,
  ad_name TEXT,
  campaign_status TEXT,
  extra_metrics JSONB, -- view_through_conversions, all_conversions, etc
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ads_spend_google_workspace_date
  ON ads_spend_google(workspace_id, metric_date DESC);

CREATE INDEX idx_ads_spend_google_campaign
  ON ads_spend_google(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_ads_spend_google_customer
  ON ads_spend_google(customer_id, metric_date DESC);

CREATE INDEX idx_ads_spend_google_synced
  ON ads_spend_google(synced_at DESC);

-- RLS (Row Level Security) - Commented out for now
-- ALTER TABLE ads_spend_google ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view Google Ads data from their workspaces"
--   ON ads_spend_google FOR SELECT
--   USING (workspace_id IN (
--     SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
--   ));

-- Comments
COMMENT ON TABLE ads_spend_google IS 'Google Ads metrics and performance data';
COMMENT ON COLUMN ads_spend_google.cost_micros IS 'Cost in micros - divide by 1,000,000 to get actual currency value';
COMMENT ON COLUMN ads_spend_google.customer_id IS 'Google Ads Customer ID (without dashes)';
COMMENT ON COLUMN ads_spend_google.campaign_id_google IS 'Campaign ID from Google Ads API';

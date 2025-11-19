-- Migration: Fix ads_spend_google unique constraint
-- Created: 2025-11-19
-- Description: Adds UNIQUE constraint to support ON CONFLICT in sync operations

-- Add unique constraint for upsert operations
ALTER TABLE ads_spend_google
ADD CONSTRAINT unique_ads_spend_google_metric 
UNIQUE (workspace_id, campaign_id_google, metric_date);

-- Comment
COMMENT ON CONSTRAINT unique_ads_spend_google_metric ON ads_spend_google 
IS 'Ensures one metric record per campaign per day for upsert operations';

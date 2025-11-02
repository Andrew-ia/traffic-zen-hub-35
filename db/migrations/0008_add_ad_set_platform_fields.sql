-- Add destination_type and promoted_object fields to ad_sets table
ALTER TABLE ad_sets
ADD COLUMN IF NOT EXISTS destination_type text,
ADD COLUMN IF NOT EXISTS promoted_object jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ad_sets_destination_type ON ad_sets(destination_type);

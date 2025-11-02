-- Migration: Integration Credentials and Sync Jobs
-- Description: Creates tables for secure credential storage and job tracking

-- Table for storing encrypted integration credentials
CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_key TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL, -- AES-256 encrypted JSON
  encryption_iv TEXT NOT NULL, -- Initialization vector for decryption
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform_key)
);

-- Table for tracking sync jobs
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_key TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'sync', 'backfill', etc.
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  parameters JSONB DEFAULT '{}'::jsonb, -- Job-specific parameters (days, type, etc.)
  result JSONB, -- Job result data
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_credentials_workspace
  ON integration_credentials(workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_workspace
  ON sync_jobs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status
  ON sync_jobs(status) WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_sync_jobs_created
  ON sync_jobs(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON integration_credentials TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sync_jobs TO authenticated;

-- Row Level Security (RLS)
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their workspace's data
CREATE POLICY integration_credentials_workspace_isolation
  ON integration_credentials
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY sync_jobs_workspace_isolation
  ON sync_jobs
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER integration_credentials_updated_at_trigger
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_credentials_updated_at();

CREATE TRIGGER sync_jobs_updated_at_trigger
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_jobs_updated_at();

-- Comments
COMMENT ON TABLE integration_credentials IS 'Stores encrypted credentials for external platform integrations (Meta, Google Ads, etc.)';
COMMENT ON TABLE sync_jobs IS 'Tracks background sync jobs with status, progress, and results';
COMMENT ON COLUMN integration_credentials.encrypted_credentials IS 'AES-256-GCM encrypted JSON containing API keys, tokens, etc.';
COMMENT ON COLUMN integration_credentials.encryption_iv IS 'Initialization vector used for AES-256-GCM encryption';

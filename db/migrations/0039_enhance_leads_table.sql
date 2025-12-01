-- Enhance leads table with complete CRM fields
DO $$
BEGIN
  -- Add email column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'email'
  ) THEN
    ALTER TABLE leads ADD COLUMN email TEXT;
  END IF;

  -- Add origem (source) column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'origem'
  ) THEN
    ALTER TABLE leads ADD COLUMN origem TEXT DEFAULT 'landing';
  END IF;

  -- Add campanha (campaign) column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'campanha'
  ) THEN
    ALTER TABLE leads ADD COLUMN campanha TEXT;
  END IF;

  -- Add observacoes (notes) column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE leads ADD COLUMN observacoes TEXT;
  END IF;

  -- Add ultima_atualizacao (last updated) column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'ultima_atualizacao'
  ) THEN
    ALTER TABLE leads ADD COLUMN ultima_atualizacao TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add announces_online column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'announces_online'
  ) THEN
    ALTER TABLE leads ADD COLUMN announces_online TEXT;
  END IF;

  -- Add traffic_investment column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'traffic_investment'
  ) THEN
    ALTER TABLE leads ADD COLUMN traffic_investment TEXT;
  END IF;

  -- Create index on status for filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_status'
  ) THEN
    CREATE INDEX idx_leads_status ON leads(status);
  END IF;

  -- Create index on origem for filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_origem'
  ) THEN
    CREATE INDEX idx_leads_origem ON leads(origem);
  END IF;

  -- Create index on created_at for sorting
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_created_at'
  ) THEN
    CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
  END IF;

  -- Create composite index on workspace_id and status for common queries
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_workspace_status'
  ) THEN
    CREATE INDEX idx_leads_workspace_status ON leads(workspace_id, status) WHERE workspace_id IS NOT NULL;
  END IF;

  -- Add RLS policy for UPDATE if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_admins_update'
  ) THEN
    CREATE POLICY leads_admins_update
      ON leads
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Add RLS policy for DELETE if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_admins_delete'
  ) THEN
    CREATE POLICY leads_admins_delete
      ON leads
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;

END $$;

-- Create trigger to auto-update ultima_atualizacao
CREATE OR REPLACE FUNCTION update_leads_ultima_atualizacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_atualizacao = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_leads_ultima_atualizacao ON leads;
CREATE TRIGGER trigger_update_leads_ultima_atualizacao
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_ultima_atualizacao();

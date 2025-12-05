-- Add missing columns for landing page compatibility
DO $$
BEGIN
  -- Add company column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company'
  ) THEN
    ALTER TABLE leads ADD COLUMN company TEXT;
  END IF;

  -- Add revenue_range column if not exists  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'revenue_range'
  ) THEN
    ALTER TABLE leads ADD COLUMN revenue_range TEXT;
  END IF;

END $$;

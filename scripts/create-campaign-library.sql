-- Create campaign_library table for marketing campaign management
CREATE TABLE IF NOT EXISTS campaign_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  objective TEXT CHECK (objective IN ('Engajamento', 'Mensagens', 'Conversões', 'Tráfego', 'Reconhecimento', 'Vendas')),
  schedule_days TEXT,
  audience TEXT,
  budget NUMERIC(10, 2),
  budget_type TEXT DEFAULT 'total' CHECK (budget_type IN ('total', 'daily')),
  copy_primary TEXT,
  copy_title TEXT,
  cta TEXT,
  creative_url TEXT,
  creative_type TEXT CHECK (creative_type IN ('image', 'video', 'carousel')),
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'pausado', 'arquivado')),
  notes TEXT,
  tags TEXT[], -- Array for categorization (e.g., ['Black Friday', 'Verão 2024'])
  platform TEXT DEFAULT 'Meta' CHECK (platform IN ('Meta', 'Google', 'TikTok', 'Multi-plataforma')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  last_used_at TIMESTAMP WITH TIME ZONE -- Track when campaign was last copied/used
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaign_library_workspace ON campaign_library(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_library_status ON campaign_library(status);
CREATE INDEX IF NOT EXISTS idx_campaign_library_objective ON campaign_library(objective);
CREATE INDEX IF NOT EXISTS idx_campaign_library_tags ON campaign_library USING GIN(tags);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_campaign_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_library_updated_at
  BEFORE UPDATE ON campaign_library
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_library_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE campaign_library ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view campaigns from their workspace
CREATE POLICY campaign_library_select_policy ON campaign_library
  FOR SELECT
  USING (true); -- Adjust based on your auth setup

-- Policy: Users can insert campaigns to their workspace
CREATE POLICY campaign_library_insert_policy ON campaign_library
  FOR INSERT
  WITH CHECK (true); -- Adjust based on your auth setup

-- Policy: Users can update campaigns in their workspace
CREATE POLICY campaign_library_update_policy ON campaign_library
  FOR UPDATE
  USING (true); -- Adjust based on your auth setup

-- Policy: Users can delete campaigns from their workspace
CREATE POLICY campaign_library_delete_policy ON campaign_library
  FOR DELETE
  USING (true); -- Adjust based on your auth setup

-- Create storage bucket for creatives (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('creatives', 'creatives', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for creatives bucket (adjust based on your auth setup)
-- CREATE POLICY "Public read access for creatives" ON storage.objects
--   FOR SELECT USING (bucket_id = 'creatives');
--
-- CREATE POLICY "Authenticated users can upload creatives" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'creatives');
--
-- CREATE POLICY "Users can update their own creatives" ON storage.objects
--   FOR UPDATE USING (bucket_id = 'creatives');
--
-- CREATE POLICY "Users can delete their own creatives" ON storage.objects
--   FOR DELETE USING (bucket_id = 'creatives');

COMMENT ON TABLE campaign_library IS 'Library of marketing campaigns for planning and reuse';
COMMENT ON COLUMN campaign_library.name IS 'Campaign name (e.g., "Live Vermezzo - 23/10")';
COMMENT ON COLUMN campaign_library.objective IS 'Campaign objective (Engajamento, Mensagens, Conversões, etc.)';
COMMENT ON COLUMN campaign_library.schedule_days IS 'Days and hours (e.g., "Seg, Qua, Sex - 15h às 22h")';
COMMENT ON COLUMN campaign_library.audience IS 'Target audience description (e.g., "Mulheres 25-55, Santos +10km")';
COMMENT ON COLUMN campaign_library.budget IS 'Campaign budget amount';
COMMENT ON COLUMN campaign_library.budget_type IS 'Whether budget is total or daily';
COMMENT ON COLUMN campaign_library.copy_primary IS 'Primary ad copy text';
COMMENT ON COLUMN campaign_library.copy_title IS 'Short ad title';
COMMENT ON COLUMN campaign_library.cta IS 'Call to action button text';
COMMENT ON COLUMN campaign_library.creative_url IS 'URL to creative asset (Supabase storage or external)';
COMMENT ON COLUMN campaign_library.creative_type IS 'Type of creative (image, video, carousel)';
COMMENT ON COLUMN campaign_library.status IS 'Campaign status (rascunho, ativo, pausado, arquivado)';
COMMENT ON COLUMN campaign_library.notes IS 'General notes (e.g., A/B test results, performance notes)';
COMMENT ON COLUMN campaign_library.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN campaign_library.platform IS 'Target platform (Meta, Google, TikTok, Multi-plataforma)';
COMMENT ON COLUMN campaign_library.last_used_at IS 'Timestamp of when campaign was last copied/used';

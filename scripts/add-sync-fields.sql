-- =====================================================
-- Adicionar campos para sincronização bidirecional
-- =====================================================

-- Adicionar campos de controle de sincronização
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_updated_on_ml TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_of_truth VARCHAR(20) DEFAULT 'traffic_pro';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_last_modified TIMESTAMP WITH TIME ZONE;

-- Adicionar comentários
COMMENT ON COLUMN products.last_synced_at IS 'Última vez que o produto foi sincronizado com o ML';
COMMENT ON COLUMN products.last_updated_on_ml IS 'Última atualização detectada no ML';
COMMENT ON COLUMN products.source_of_truth IS 'Fonte de verdade: traffic_pro, mercado_livre, both';
COMMENT ON COLUMN products.sync_status IS 'Status da sincronização: synced, pending, conflict, error';
COMMENT ON COLUMN products.ml_last_modified IS 'Timestamp de modificação no ML';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);
CREATE INDEX IF NOT EXISTS idx_products_source_of_truth ON products(source_of_truth);
CREATE INDEX IF NOT EXISTS idx_products_last_synced ON products(last_synced_at);

-- Trigger para marcar como pending quando houver alterações
CREATE OR REPLACE FUNCTION mark_product_sync_pending()
RETURNS TRIGGER AS $$
BEGIN
    -- Se não for uma sincronização (não tem bypass), marcar como pending
    IF NOT (TG_ARGV[0] = 'sync_bypass') THEN
        NEW.sync_status = 'pending';
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em updates
DROP TRIGGER IF EXISTS products_sync_pending ON products;
CREATE TRIGGER products_sync_pending
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION mark_product_sync_pending();

-- Atualizar produtos existentes
UPDATE products 
SET 
    source_of_truth = 'traffic_pro',
    sync_status = CASE 
        WHEN ml_item_id IS NOT NULL THEN 'synced'
        ELSE 'pending'
    END,
    last_synced_at = CASE 
        WHEN ml_item_id IS NOT NULL THEN created_at
        ELSE NULL
    END
WHERE source_of_truth IS NULL;

-- =====================================================
-- Tabela para log de sincronização
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    sync_type VARCHAR(50) NOT NULL, -- 'import_from_ml', 'export_to_ml', 'resolve_conflict'
    direction VARCHAR(20) NOT NULL, -- 'ml_to_traffic', 'traffic_to_ml', 'bidirectional'
    
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'conflict', 'skipped'
    
    -- Dados antes da sincronização
    before_data JSONB,
    after_data JSONB,
    
    -- Dados do ML (se aplicável)
    ml_data JSONB,
    
    error_message TEXT,
    conflict_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_sync_logs_product ON sync_logs(product_id);
CREATE INDEX idx_sync_logs_workspace ON sync_logs(workspace_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at);

COMMENT ON TABLE sync_logs IS 'Log de todas as operações de sincronização entre Traffic Pro e Mercado Livre';

-- =====================================================
-- View para produtos com conflitos
-- =====================================================

CREATE OR REPLACE VIEW vw_products_conflicts AS
SELECT 
    p.*,
    u.email as created_by_email,
    sl.error_message,
    sl.conflict_reason,
    sl.created_at as conflict_detected_at
FROM products p
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN LATERAL (
    SELECT * FROM sync_logs 
    WHERE product_id = p.id 
    AND status = 'conflict'
    ORDER BY created_at DESC 
    LIMIT 1
) sl ON true
WHERE p.sync_status = 'conflict';

GRANT SELECT ON vw_products_conflicts TO authenticated;

-- =====================================================
-- Configurações de sincronização por workspace
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_sync_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Configurações de sincronização
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_interval_hours INTEGER DEFAULT 24,
    
    -- Estratégias de resolução de conflitos
    conflict_resolution_strategy VARCHAR(50) DEFAULT 'manual', -- 'manual', 'traffic_pro_wins', 'ml_wins', 'newest_wins'
    
    -- Configurações específicas
    sync_images BOOLEAN DEFAULT true,
    sync_prices BOOLEAN DEFAULT true,
    sync_inventory BOOLEAN DEFAULT true,
    sync_descriptions BOOLEAN DEFAULT true,
    
    -- Última sincronização
    last_full_sync TIMESTAMP WITH TIME ZONE,
    last_sync_result VARCHAR(20), -- 'success', 'partial', 'error'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id)
);

-- Inserir configuração padrão para workspace existente
INSERT INTO workspace_sync_settings (workspace_id, auto_sync_enabled)
VALUES ('00000000-0000-0000-0000-000000000010', false)
ON CONFLICT (workspace_id) DO NOTHING;

COMMENT ON TABLE workspace_sync_settings IS 'Configurações de sincronização por workspace';
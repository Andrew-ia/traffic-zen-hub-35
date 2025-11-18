-- Migration 0037: Sync Metadata Table
-- Data: 2025-11-18
-- Descrição: Criar tabela para tracking de sincronizações e performance

-- Tabela para metadados de sincronização
CREATE TABLE IF NOT EXISTS sync_metadata (
    platform_key TEXT NOT NULL,
    workspace_id UUID NOT NULL,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'running', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER,
    sync_type TEXT, -- 'all', 'campaigns', 'metrics', 'incremental'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (platform_key, workspace_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_sync ON sync_metadata(last_sync_at);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_workspace ON sync_metadata(workspace_id);

-- RLS (Row Level Security)
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Policy para permitir acesso baseado no workspace
CREATE POLICY sync_metadata_workspace_policy ON sync_metadata
    FOR ALL 
    USING (workspace_id = current_setting('app.workspace_id')::UUID)
    WITH CHECK (workspace_id = current_setting('app.workspace_id')::UUID);

-- Policy para service role (bypass RLS)
CREATE POLICY sync_metadata_service_role_policy ON sync_metadata
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_sync_metadata_updated_at_trigger
    BEFORE UPDATE ON sync_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_metadata_updated_at();

-- Função para iniciar sync
CREATE OR REPLACE FUNCTION start_sync_tracking(
    p_platform_key TEXT,
    p_workspace_id UUID,
    p_sync_type TEXT DEFAULT 'all',
    p_total_items INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
    INSERT INTO sync_metadata (
        platform_key, workspace_id, sync_status, sync_type, total_items, 
        processed_items, progress, last_sync_at
    ) VALUES (
        p_platform_key, p_workspace_id, 'running', p_sync_type, p_total_items,
        0, 0, NOW()
    ) 
    ON CONFLICT (platform_key, workspace_id) 
    DO UPDATE SET 
        sync_status = 'running',
        sync_type = p_sync_type,
        total_items = p_total_items,
        processed_items = 0,
        progress = 0,
        last_sync_at = NOW(),
        error_message = NULL,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar progresso
CREATE OR REPLACE FUNCTION update_sync_progress(
    p_platform_key TEXT,
    p_workspace_id UUID,
    p_processed_items INTEGER,
    p_total_items INTEGER DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE sync_metadata 
    SET 
        processed_items = p_processed_items,
        total_items = COALESCE(p_total_items, total_items),
        progress = CASE 
            WHEN COALESCE(p_total_items, total_items) > 0 
            THEN LEAST(100, ROUND((p_processed_items * 100.0) / COALESCE(p_total_items, total_items)))
            ELSE 0 
        END,
        updated_at = NOW()
    WHERE platform_key = p_platform_key AND workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Função para finalizar sync
CREATE OR REPLACE FUNCTION complete_sync_tracking(
    p_platform_key TEXT,
    p_workspace_id UUID,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE sync_metadata 
    SET 
        sync_status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
        progress = CASE WHEN p_success THEN 100 ELSE progress END,
        error_message = p_error_message,
        sync_duration_ms = p_duration_ms,
        updated_at = NOW()
    WHERE platform_key = p_platform_key AND workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE sync_metadata IS 'Metadados de sincronização para tracking de progresso e performance';
COMMENT ON COLUMN sync_metadata.platform_key IS 'Chave da plataforma: meta, instagram, google_ads, etc.';
COMMENT ON COLUMN sync_metadata.sync_status IS 'Status atual: idle, running, completed, failed';
COMMENT ON COLUMN sync_metadata.progress IS 'Progresso em porcentagem (0-100)';
COMMENT ON COLUMN sync_metadata.sync_duration_ms IS 'Duração da sincronização em milissegundos';
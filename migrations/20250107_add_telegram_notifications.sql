-- Migração para adicionar suporte a notificações Telegram
-- Data: 2025-01-07

-- Tabela para configurações de notificação por workspace
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'telegram', 'slack', 'email', etc
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL, -- { "bot_token": "...", "chat_id": "..." }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, platform)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_workspace
    ON notification_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_platform
    ON notification_settings(platform) WHERE enabled = true;

-- Tabela para log de notificações enviadas
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    notification_type VARCHAR(100) NOT NULL, -- 'order_created', 'question_received', etc
    reference_id VARCHAR(255), -- ID do pedido, pergunta, etc
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'pending'
    payload JSONB, -- Dados enviados
    response JSONB, -- Resposta da API
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para log
CREATE INDEX IF NOT EXISTS idx_notification_logs_workspace
    ON notification_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at
    ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_reference
    ON notification_logs(reference_id);

-- Comentários
COMMENT ON TABLE notification_settings IS 'Configurações de notificações por workspace';
COMMENT ON TABLE notification_logs IS 'Log de todas as notificações enviadas';
COMMENT ON COLUMN notification_settings.config IS 'Configuração específica do canal (bot_token, chat_id, etc)';
COMMENT ON COLUMN notification_logs.payload IS 'Dados que foram enviados na notificação';

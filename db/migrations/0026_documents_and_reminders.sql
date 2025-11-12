-- =====================================================
-- DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES pm_folders(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES pm_lists(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    content TEXT,

    -- Metadata
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_documents_workspace ON pm_documents(workspace_id);
CREATE INDEX idx_pm_documents_folder ON pm_documents(folder_id);
CREATE INDEX idx_pm_documents_list ON pm_documents(list_id);

-- =====================================================
-- DOCUMENT ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_document_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES pm_documents(id) ON DELETE CASCADE,

    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT, -- in bytes

    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_document_attachments_document ON pm_document_attachments(document_id);

-- =====================================================
-- REMINDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES pm_folders(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES pm_lists(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,

    -- Notification settings
    notify_via TEXT NOT NULL DEFAULT 'email' CHECK (notify_via IN ('email', 'whatsapp', 'telegram', 'all')),
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),

    -- Contact info for notifications
    email TEXT,
    phone TEXT, -- for WhatsApp
    telegram_chat_id TEXT,

    position INTEGER NOT NULL DEFAULT 0,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_reminders_workspace ON pm_reminders(workspace_id);
CREATE INDEX idx_pm_reminders_folder ON pm_reminders(folder_id);
CREATE INDEX idx_pm_reminders_list ON pm_reminders(list_id);
CREATE INDEX idx_pm_reminders_due_date ON pm_reminders(due_date) WHERE status = 'pending';
CREATE INDEX idx_pm_reminders_notification ON pm_reminders(notification_sent, due_date) WHERE status = 'pending';

-- =====================================================
-- UPDATE HIERARCHY VIEW TO INCLUDE DOCUMENTS AND REMINDERS
-- =====================================================
CREATE OR REPLACE VIEW pm_hierarchy_view AS
SELECT
    w.id as workspace_id,
    w.name as workspace_name,

    f.id as folder_id,
    f.name as folder_name,
    f.icon as folder_icon,
    f.color as folder_color,
    f.position as folder_position,

    l.id as list_id,
    l.name as list_name,
    l.icon as list_icon,
    l.color as list_color,
    l.position as list_position,

    -- Count tasks
    (SELECT COUNT(*) FROM pm_tasks WHERE list_id = l.id) as task_count,

    -- Count documents
    (SELECT COUNT(*) FROM pm_documents WHERE list_id = l.id) as document_count,

    -- Count reminders
    (SELECT COUNT(*) FROM pm_reminders WHERE list_id = l.id) as reminder_count

FROM workspaces w
LEFT JOIN pm_folders f ON w.id = f.workspace_id
LEFT JOIN pm_lists l ON f.id = l.folder_id
WHERE f.status = 'active' AND l.status = 'active'
ORDER BY f.position, l.position;

COMMENT ON TABLE pm_documents IS 'Stores documents with rich content and file attachments';
COMMENT ON TABLE pm_document_attachments IS 'File attachments for documents';
COMMENT ON TABLE pm_reminders IS 'Reminders with multi-channel notifications (email, WhatsApp, Telegram)';

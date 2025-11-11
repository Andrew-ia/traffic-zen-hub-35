-- 0024_project_management.sql
-- Project Management System (ClickUp-style)
-- Hierarchical structure: Workspaces → Folders → Lists → Tasks

-- =====================================================
-- FOLDERS (within workspaces)
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_folders_workspace ON pm_folders(workspace_id);
CREATE INDEX idx_pm_folders_position ON pm_folders(workspace_id, position);

-- =====================================================
-- LISTS (within folders)
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES pm_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_lists_workspace ON pm_lists(workspace_id);
CREATE INDEX idx_pm_lists_folder ON pm_lists(folder_id);
CREATE INDEX idx_pm_lists_position ON pm_lists(folder_id, position);

-- =====================================================
-- TASKS (within lists)
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES pm_folders(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES pm_lists(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE, -- for subtasks

    name TEXT NOT NULL,
    description TEXT,

    -- Status & Priority
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'bloqueado', 'cancelado')),
    priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),

    -- Assignment & Dates
    assignee_id UUID REFERENCES users(id),
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Organization
    position INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Tracking
    estimated_hours NUMERIC(10,2),
    actual_hours NUMERIC(10,2),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_tasks_workspace ON pm_tasks(workspace_id);
CREATE INDEX idx_pm_tasks_folder ON pm_tasks(folder_id);
CREATE INDEX idx_pm_tasks_list ON pm_tasks(list_id);
CREATE INDEX idx_pm_tasks_assignee ON pm_tasks(assignee_id);
CREATE INDEX idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX idx_pm_tasks_due_date ON pm_tasks(due_date);
CREATE INDEX idx_pm_tasks_parent ON pm_tasks(parent_task_id);
CREATE INDEX idx_pm_tasks_position ON pm_tasks(list_id, position);

-- =====================================================
-- SUBTASKS / CHECKLIST ITEMS (within tasks)
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    assignee_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_subtasks_task ON pm_subtasks(task_id);
CREATE INDEX idx_pm_subtasks_position ON pm_subtasks(task_id, position);

-- =====================================================
-- TASK COMMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB, -- for mentions, attachments, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_task_comments_task ON pm_task_comments(task_id);
CREATE INDEX idx_pm_task_comments_user ON pm_task_comments(user_id);
CREATE INDEX idx_pm_task_comments_created ON pm_task_comments(task_id, created_at DESC);

-- =====================================================
-- TASK ATTACHMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    metadata JSONB DEFAULT '{}'::JSONB,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_task_attachments_task ON pm_task_attachments(task_id);

-- =====================================================
-- TASK ACTIVITY LOG (for history/audit)
-- =====================================================
CREATE TABLE IF NOT EXISTS pm_task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL, -- 'created', 'updated', 'assigned', 'status_changed', 'commented', etc.
    field_name TEXT, -- which field was changed
    old_value TEXT,
    new_value TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_task_activity_task ON pm_task_activity(task_id, created_at DESC);
CREATE INDEX idx_pm_task_activity_user ON pm_task_activity(user_id);

-- =====================================================
-- VIEWS FOR EASIER QUERYING
-- =====================================================

-- View: Tasks with full hierarchy context
CREATE OR REPLACE VIEW pm_tasks_full AS
SELECT
    t.id,
    t.workspace_id,
    t.folder_id,
    t.list_id,
    t.parent_task_id,
    t.name,
    t.description,
    t.status,
    t.priority,
    t.assignee_id,
    t.due_date,
    t.start_date,
    t.completed_at,
    t.position,
    t.tags,
    t.metadata,
    t.estimated_hours,
    t.actual_hours,
    t.created_by,
    t.created_at,
    t.updated_at,
    -- Hierarchy context
    w.name as workspace_name,
    f.name as folder_name,
    f.icon as folder_icon,
    f.color as folder_color,
    l.name as list_name,
    l.icon as list_icon,
    l.color as list_color,
    -- Assignee info
    u.full_name as assignee_name,
    u.email as assignee_email,
    -- Creator info
    uc.full_name as created_by_name,
    -- Subtask count
    (SELECT COUNT(*) FROM pm_subtasks WHERE task_id = t.id) as subtask_count,
    (SELECT COUNT(*) FROM pm_subtasks WHERE task_id = t.id AND completed = true) as subtask_completed_count,
    -- Comment count
    (SELECT COUNT(*) FROM pm_task_comments WHERE task_id = t.id) as comment_count,
    -- Attachment count
    (SELECT COUNT(*) FROM pm_task_attachments WHERE task_id = t.id) as attachment_count
FROM pm_tasks t
JOIN workspaces w ON t.workspace_id = w.id
JOIN pm_folders f ON t.folder_id = f.id
JOIN pm_lists l ON t.list_id = l.id
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN users uc ON t.created_by = uc.id;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_pm_folders_updated_at BEFORE UPDATE ON pm_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pm_lists_updated_at BEFORE UPDATE ON pm_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pm_tasks_updated_at BEFORE UPDATE ON pm_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pm_subtasks_updated_at BEFORE UPDATE ON pm_subtasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pm_task_comments_updated_at BEFORE UPDATE ON pm_task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (example structure)
-- =====================================================

-- This will be populated via API or separate seed file
-- Example:
-- INSERT INTO pm_folders (workspace_id, name, icon, color, position)
-- VALUES ('workspace-uuid', 'MÍDIA PAGA - OPERACIONAL', '📁', '#3B82F6', 1);

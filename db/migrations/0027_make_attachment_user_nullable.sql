-- Make user_id nullable in pm_task_attachments to allow attachments without user attribution
ALTER TABLE pm_task_attachments
ALTER COLUMN user_id DROP NOT NULL;

-- Also make it optional in pm_document_attachments if it has the same constraint
ALTER TABLE pm_document_attachments
ALTER COLUMN uploaded_by DROP NOT NULL;

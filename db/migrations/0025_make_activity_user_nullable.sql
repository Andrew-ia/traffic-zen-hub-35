-- Make user_id nullable in pm_task_activity to support system-generated activities
ALTER TABLE pm_task_activity
ALTER COLUMN user_id DROP NOT NULL;

-- Add comment to explain nullable user_id
COMMENT ON COLUMN pm_task_activity.user_id IS 'User who performed the action. NULL for system-generated activities.';

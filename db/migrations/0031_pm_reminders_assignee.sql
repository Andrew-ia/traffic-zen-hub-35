-- Add assignee to pm_reminders
ALTER TABLE pm_reminders
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_pm_reminders_assignee ON pm_reminders(assignee_id);
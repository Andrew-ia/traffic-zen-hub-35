// Project Management Types

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado' | 'cancelado';
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface PMFolder {
  id: string;
  workspace_id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  position: number;
  status: 'active' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PMList {
  id: string;
  workspace_id: string;
  folder_id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  position: number;
  status: 'active' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PMTask {
  id: string;
  workspace_id: string;
  folder_id: string;
  list_id: string;
  parent_task_id?: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  completed_at?: string;
  position: number;
  tags?: string[];
  metadata?: Record<string, any>;
  estimated_hours?: number;
  actual_hours?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PMTaskFull extends PMTask {
  workspace_name: string;
  folder_name: string;
  folder_icon?: string;
  folder_color?: string;
  list_name: string;
  list_icon?: string;
  list_color?: string;
  assignee_name?: string;
  assignee_email?: string;
  created_by_name?: string;
  subtask_count: number;
  subtask_completed_count: number;
  comment_count: number;
  attachment_count: number;
}

export interface PMSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  assignee_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PMTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PMTaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  metadata?: Record<string, any>;
  uploaded_at: string;
}

export interface PMTaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// DTO types for creating/updating

export interface CreatePMFolderDTO {
  workspace_id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  position?: number;
}

export interface UpdatePMFolderDTO {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  position?: number;
  status?: 'active' | 'archived';
}

export interface CreatePMListDTO {
  workspace_id: string;
  folder_id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  position?: number;
}

export interface UpdatePMListDTO {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  position?: number;
  status?: 'active' | 'archived';
}

export interface CreatePMTaskDTO {
  workspace_id: string;
  folder_id: string;
  list_id: string;
  parent_task_id?: string;
  name: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  position?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  estimated_hours?: number;
}

export interface UpdatePMTaskDTO {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  completed_at?: string;
  position?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

// ========================================
// DOCUMENTS
// ========================================

export interface PMDocument {
  id: string;
  workspace_id: string;
  folder_id: string;
  list_id: string;
  name: string;
  content: string | null;
  position: number;
  status: 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMDocumentAttachment {
  id: string;
  document_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CreatePMDocumentDTO {
  workspace_id: string;
  folder_id: string;
  list_id: string;
  name: string;
  content?: string;
  position?: number;
}

export interface UpdatePMDocumentDTO {
  name?: string;
  content?: string;
  position?: number;
  status?: 'active' | 'archived';
}

// ========================================
// REMINDERS
// ========================================

export type ReminderNotifyVia = 'email' | 'whatsapp' | 'telegram' | 'all';
export type ReminderStatus = 'pending' | 'sent' | 'cancelled';

export interface PMReminder {
  id: string;
  workspace_id: string;
  folder_id: string;
  list_id: string;
  name: string;
  description: string | null;
  due_date: string;
  notify_via: ReminderNotifyVia;
  notification_sent: boolean;
  notification_sent_at: string | null;
  status: ReminderStatus;
  email: string | null;
  phone: string | null;
  telegram_chat_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePMReminderDTO {
  workspace_id: string;
  folder_id: string;
  list_id: string;
  name: string;
  description?: string;
  due_date: string;
  notify_via: ReminderNotifyVia;
  email?: string;
  phone?: string;
  telegram_chat_id?: string;
  position?: number;
  estimated_hours?: number;
  actual_hours?: number;
}

export interface CreatePMSubtaskDTO {
  task_id: string;
  title: string;
  assignee_id?: string;
  position?: number;
}

export interface UpdatePMSubtaskDTO {
  title?: string;
  completed?: boolean;
  assignee_id?: string;
  position?: number;
}

// Hierarchy data structure for UI
export interface PMHierarchy {
  folders: PMFolder[];
  lists: PMList[];
  tasks: PMTask[];
}

export interface PMFolderWithLists extends PMFolder {
  lists: PMListWithTasks[];
}

export interface PMListWithTasks extends PMList {
  tasks: PMTask[];
}

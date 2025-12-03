import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveApiBase } from '@/lib/apiBase';
import type {
  PMFolder,
  PMList,
  PMTask,
  PMTaskFull,
  CreatePMFolderDTO,
  UpdatePMFolderDTO,
  CreatePMListDTO,
  UpdatePMListDTO,
  CreatePMTaskDTO,
  UpdatePMTaskDTO,
} from '../types/project-management';

const API_BASE = resolveApiBase();
const PM_API = `${API_BASE}/api/pm`;

// ========================================
// HIERARCHY
// ========================================

export interface PMHierarchyResponse {
  success: boolean;
  data: {
    workspace_id: string;
    folders: Array<PMFolder & {
      lists: Array<PMList & {
        tasks: PMTaskFull[];
        task_count: number;
      }>;
      list_count: number;
      task_count: number;
    }>;
    stats: {
      folder_count: number;
      list_count: number;
      task_count: number;
    };
  };
}

export function usePMHierarchy(workspaceId: string | null) {
  return useQuery<PMHierarchyResponse>({
    queryKey: ['pm-hierarchy', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace não selecionado');
      const response = await fetch(`${PM_API}/hierarchy/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hierarchy');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes 
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

// ========================================
// FOLDERS
// ========================================

export interface PMFoldersResponse {
  success: boolean;
  data: PMFolder[];
}

export function usePMFolders(workspaceId: string | null) {
  return useQuery<PMFoldersResponse>({
    queryKey: ['pm-folders', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace não selecionado');
      const response = await fetch(`${PM_API}/folders/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      return response.json();
    },
  });
}

export function usePMFolder(workspaceId: string | null, folderId: string) {
  return useQuery<{ success: boolean; data: PMFolder }>({
    queryKey: ['pm-folder', workspaceId, folderId],
    enabled: !!workspaceId && !!folderId,
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace não selecionado');
      const response = await fetch(`${PM_API}/folders/${workspaceId}/${folderId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch folder');
      }
      return response.json();
    },
  });
}

export function useCreatePMFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMFolderDTO) => {
      const response = await fetch(`${PM_API}/folders/${data.workspace_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-folders', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspace_id] });
    },
  });
}

export function useUpdatePMFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, folderId, data }: {
      workspaceId: string;
      folderId: string;
      data: UpdatePMFolderDTO;
    }) => {
      const response = await fetch(`${PM_API}/folders/${workspaceId}/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update folder');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-folders', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-folder', variables.workspaceId, variables.folderId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

export function useDeletePMFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, folderId }: {
      workspaceId: string;
      folderId: string;
    }) => {
      const response = await fetch(`${PM_API}/folders/${workspaceId}/${folderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete folder');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-folders', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

// ========================================
// LISTS
// ========================================

export interface PMListsResponse {
  success: boolean;
  data: PMList[];
}

export function usePMLists(workspaceId: string, folderId?: string) {
  return useQuery<PMListsResponse>({
    queryKey: ['pm-lists', workspaceId, folderId],
    queryFn: async () => {
      const url = folderId
        ? `${PM_API}/lists/${workspaceId}/${folderId}`
        : `${PM_API}/lists/${workspaceId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }
      return response.json();
    },
  });
}

export function usePMList(workspaceId: string, listId: string) {
  return useQuery<{ success: boolean; data: PMList }>({
    queryKey: ['pm-list', workspaceId, listId],
    queryFn: async () => {
      const response = await fetch(`${PM_API}/lists/${workspaceId}/list/${listId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch list');
      }
      return response.json();
    },
    enabled: !!listId,
  });
}

export function useCreatePMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMListDTO) => {
      const response = await fetch(`${PM_API}/lists/${data.workspace_id}/${data.folder_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create list');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-lists', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspace_id] });
    },
  });
}

export function useUpdatePMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, listId, data }: {
      workspaceId: string;
      listId: string;
      data: UpdatePMListDTO;
    }) => {
      const response = await fetch(`${PM_API}/lists/${workspaceId}/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update list');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-lists', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-list', variables.workspaceId, variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

export function useDeletePMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, listId }: {
      workspaceId: string;
      listId: string;
    }) => {
      const response = await fetch(`${PM_API}/lists/${workspaceId}/${listId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-lists', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

// ========================================
// TASKS
// ========================================

export interface PMTasksResponse {
  success: boolean;
  data: PMTaskFull[];
}

export function usePMTasks(workspaceId: string, listId?: string, filters?: {
  status?: string;
  priority?: string;
  assignee_id?: string;
  folder_id?: string;
}) {
  return useQuery<PMTasksResponse>({
    queryKey: ['pm-tasks', workspaceId, listId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.assignee_id) params.append('assignee_id', filters.assignee_id);
      if (filters?.folder_id) params.append('folder_id', filters.folder_id);

      const url = listId
        ? `${PM_API}/tasks/${workspaceId}/${listId}?${params.toString()}`
        : `${PM_API}/tasks/${workspaceId}?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
  });
}

export function usePMTask(workspaceId: string, taskId: string) {
  return useQuery<{ success: boolean; data: PMTaskFull }>({
    queryKey: ['pm-task', workspaceId, taskId],
    queryFn: async () => {
      const response = await fetch(`${PM_API}/tasks/${workspaceId}/${taskId}/details`);
      if (!response.ok) {
        throw new Error('Failed to fetch task');
      }
      return response.json();
    },
    enabled: !!taskId,
  });
}

export function useCreatePMTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMTaskDTO) => {
      const response = await fetch(`${PM_API}/tasks/${data.workspace_id}/${data.list_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-tasks', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspace_id] });
    },
  });
}

export function useUpdatePMTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, taskId, data }: {
      workspaceId: string;
      taskId: string;
      data: UpdatePMTaskDTO;
    }) => {
      const response = await fetch(`${PM_API}/tasks/${workspaceId}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-tasks', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-task', variables.workspaceId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

export function useDeletePMTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, taskId }: {
      workspaceId: string;
      taskId: string;
    }) => {
      const response = await fetch(`${PM_API}/tasks/${workspaceId}/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-tasks', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
    },
  });
}

// ========================================
// DOCUMENTS
// ========================================

import type { PMDocument, PMDocumentAttachment, CreatePMDocumentDTO } from '../types/project-management';

export interface PMDocumentsResponse {
  success: boolean;
  data: PMDocument[];
}

export function usePMDocuments(workspaceId: string, listId?: string, options?: { enabled?: boolean }) {
  return useQuery<PMDocumentsResponse>({
    queryKey: ['pm-documents', workspaceId, listId],
    queryFn: async () => {
      const url = listId
        ? `${PM_API}/documents/${workspaceId}/${listId}`
        : `${PM_API}/documents/${workspaceId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
    enabled: options?.enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreatePMDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMDocumentDTO) => {
      const response = await fetch(`${PM_API}/documents/${data.workspace_id}/${data.list_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-documents', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspace_id] });
    },
  });
}

export function useUploadPMDocumentAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documentId: string;
      data: {
        file_name: string;
        file_url: string; // Data URL or public URL
        file_type?: string;
        file_size?: number;
      };
      workspaceId?: string;
    }) => {
      const response = await fetch(`${PM_API}/documents/${params.documentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.data),
      });

      if (!response.ok) {
        throw new Error('Failed to upload attachment');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['pm-documents', variables.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspaceId] });
      }
    },
  });
}

export function useUploadPMTaskAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: { file_name: string; file_url: string; file_type?: string; file_size?: number } }) => {
      const res = await fetch(`${PM_API}/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error('Falha ao enviar anexo da tarefa');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate tasks and hierarchy to reflect new attachment_count
      queryClient.invalidateQueries({ queryKey: ['pm-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['pm-task-attachments', variables.taskId] });
    },
  });
}

export function usePMTaskAttachments(taskId?: string) {
  return useQuery({
    queryKey: ['pm-task-attachments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const res = await fetch(`${PM_API}/tasks/${taskId}/attachments`);
      if (!res.ok) {
        throw new Error('Falha ao listar anexos da tarefa');
      }
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!taskId,
  });
}

export function useDeletePMTaskAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: string; attachmentId: string }) => {
      const res = await fetch(`${PM_API}/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Falha ao remover anexo da tarefa');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-task-attachments', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['pm-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy'] });
    },
  });
}

// ========================================
// REMINDERS
// ========================================

import type { PMReminder, CreatePMReminderDTO } from '../types/project-management';

export interface PMRemindersResponse {
  success: boolean;
  data: PMReminder[];
}

export function usePMReminders(workspaceId: string, listId?: string) {
  return useQuery<PMRemindersResponse>({
    queryKey: ['pm-reminders', workspaceId, listId],
    queryFn: async () => {
      const url = listId
        ? `${PM_API}/reminders/${workspaceId}/${listId}`
        : `${PM_API}/reminders/${workspaceId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch reminders');
      }
      return response.json();
    },
  });
}

export function useCreatePMReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMReminderDTO) => {
      const response = await fetch(`${PM_API}/reminders/${data.workspace_id}/${data.list_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create reminder');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-reminders', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['pm-hierarchy', variables.workspace_id] });
    },
  });
}

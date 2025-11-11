import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const API_BASE_URL = 'http://localhost:3001/api/pm';
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

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

export function usePMHierarchy(workspaceId: string = WORKSPACE_ID) {
  return useQuery<PMHierarchyResponse>({
    queryKey: ['pm-hierarchy', workspaceId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/hierarchy/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hierarchy');
      }
      return response.json();
    },
  });
}

// ========================================
// FOLDERS
// ========================================

export interface PMFoldersResponse {
  success: boolean;
  data: PMFolder[];
}

export function usePMFolders(workspaceId: string = WORKSPACE_ID) {
  return useQuery<PMFoldersResponse>({
    queryKey: ['pm-folders', workspaceId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/folders/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      return response.json();
    },
  });
}

export function usePMFolder(workspaceId: string, folderId: string) {
  return useQuery<{ success: boolean; data: PMFolder }>({
    queryKey: ['pm-folder', workspaceId, folderId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/folders/${workspaceId}/${folderId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch folder');
      }
      return response.json();
    },
    enabled: !!folderId,
  });
}

export function useCreatePMFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePMFolderDTO) => {
      const response = await fetch(`${API_BASE_URL}/folders/${data.workspace_id}`, {
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
      const response = await fetch(`${API_BASE_URL}/folders/${workspaceId}/${folderId}`, {
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
      const response = await fetch(`${API_BASE_URL}/folders/${workspaceId}/${folderId}`, {
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
        ? `${API_BASE_URL}/lists/${workspaceId}/${folderId}`
        : `${API_BASE_URL}/lists/${workspaceId}`;
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
      const response = await fetch(`${API_BASE_URL}/lists/${workspaceId}/list/${listId}`);
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
      const response = await fetch(`${API_BASE_URL}/lists/${data.workspace_id}/${data.folder_id}`, {
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
      const response = await fetch(`${API_BASE_URL}/lists/${workspaceId}/${listId}`, {
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
      const response = await fetch(`${API_BASE_URL}/lists/${workspaceId}/${listId}`, {
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
        ? `${API_BASE_URL}/tasks/${workspaceId}/${listId}?${params.toString()}`
        : `${API_BASE_URL}/tasks/${workspaceId}?${params.toString()}`;

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
      const response = await fetch(`${API_BASE_URL}/tasks/${workspaceId}/${taskId}/details`);
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
      const response = await fetch(`${API_BASE_URL}/tasks/${data.workspace_id}/${data.list_id}`, {
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
      const response = await fetch(`${API_BASE_URL}/tasks/${workspaceId}/${taskId}`, {
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
      const response = await fetch(`${API_BASE_URL}/tasks/${workspaceId}/${taskId}`, {
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

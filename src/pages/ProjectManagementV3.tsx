import { useState, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  List as ListIcon,
  LayoutList,
  Kanban as KanbanIcon,
  Calendar as CalendarIcon,
  Eye,
  Filter,
  Trash2,
  Edit,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker from '@/components/pm/EmojiPicker';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/pm/KanbanBoardV2';
import { CalendarView } from '@/components/pm/CalendarView';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Removed KanbanBoard and Select imports after removing Quadro/Kanban view
import { TaskDetailModal } from '@/components/pm/TaskDetailModal';
import { CreateItemModal } from '@/components/pm/CreateItemModal';
import { EmojiPicker } from '@/components/pm/EmojiPicker';
import type { PMTaskFull } from '@/types/project-management';
import { usePMHierarchy, useCreatePMFolder, useCreatePMList, useCreatePMTask, useDeletePMList, useCreatePMDocument, useCreatePMReminder, useUpdatePMList, useUploadPMDocumentAttachment, useDeletePMFolder, usePMDocuments, useUploadPMTaskAttachment, useUpdatePMFolder } from '@/hooks/useProjectManagement';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { toast } from '@/hooks/use-toast';
import type { TaskStatus, TaskPriority } from '@/types/project-management';

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || '';

const statusColors: Record<TaskStatus, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  concluido: 'bg-green-500',
  bloqueado: 'bg-red-500',
  cancelado: 'bg-gray-400',
};

const priorityColors: Record<TaskPriority, string> = {
  baixa: 'bg-gray-400',
  media: 'bg-yellow-500',
  alta: 'bg-orange-500',
  urgente: 'bg-red-600',
};

export default function ProjectManagementV3() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: hierarchyData, isLoading, error: hierarchyError } = usePMHierarchy(WORKSPACE_ID);
  // Only load documents when hierarchy is loaded and successful
  const { data: documentsData } = usePMDocuments(WORKSPACE_ID, undefined, {
    enabled: !!hierarchyData?.success && !isLoading
  });
  const createFolder = useCreatePMFolder();
  const createList = useCreatePMList();
  const createTask = useCreatePMTask();
  const deleteList = useDeletePMList();
  const deleteFolder = useDeletePMFolder();
  const createDocument = useCreatePMDocument();
  const createReminder = useCreatePMReminder();
  const uploadTaskAttachment = useUploadPMTaskAttachment();
  const uploadDocumentAttachment = useUploadPMDocumentAttachment();
  const updateFolder = useUpdatePMFolder();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  // Visão inicial (Overview): estados de recolher/expandir
  const [collapsedFoldersOverview, setCollapsedFoldersOverview] = useState<Set<string>>(new Set());
  const [collapsedListsOverview, setCollapsedListsOverview] = useState<Set<string>>(new Set());

  // Removido: criação automática do exemplo Black Friday

  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<PMTaskFull | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Removed Quadro filters (status/priority) after removing Kanban view

  // New folder dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');

  // New list dialog state
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListIcon, setNewListIcon] = useState('📋');
  const [newListColor, setNewListColor] = useState('#8B5CF6');

  // New item modal state (replaces old task dialog)
  const [newItemOpen, setNewItemOpen] = useState(false);

  // Edit list dialog state
  const [editListOpen, setEditListOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListIcon, setEditListIcon] = useState('📋');
  const [editListColor, setEditListColor] = useState('#8B5CF6');
  const updateList = useUpdatePMList();

  const handleOpenEditList = (list: { id: string; name: string; icon?: string; color?: string }) => {
    setEditingListId(list.id);
    setEditListName(list.name);
    setEditListIcon(list.icon || '📋');
    setEditListColor(list.color || '#8B5CF6');
    setEditListOpen(true);
  };

  // Edit folder dialog state
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderIcon, setEditFolderIcon] = useState('📁');
  const [editFolderColor, setEditFolderColor] = useState('#3B82F6');

  const handleOpenEditFolder = (folder: { id: string; name: string; icon?: string; color?: string }) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setEditFolderIcon(folder.icon || '📁');
    setEditFolderColor(folder.color || '#3B82F6');
    setEditFolderOpen(true);
  };

  const handleUpdateList = async () => {
    if (!editingListId) return;
    try {
      await updateList.mutateAsync({
        workspaceId: WORKSPACE_ID,
        listId: editingListId,
        data: {
          name: editListName,
          icon: editListIcon,
          color: editListColor,
        },
      });
      toast({
        title: 'Lista atualizada!',
        description: `A lista foi atualizada com sucesso.`,
      });
      setEditListOpen(false);
      setEditingListId(null);
    } catch (error) {
      console.error('Error updating list:', error);
      toast({
        title: 'Erro ao atualizar lista',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar a lista.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolderId) return;
    try {
      await updateFolder.mutateAsync({
        workspaceId: WORKSPACE_ID,
        folderId: editingFolderId,
        data: {
          name: editFolderName,
          icon: editFolderIcon,
          color: editFolderColor,
        },
      });
      toast({
        title: 'Pasta atualizada!',
        description: `A pasta foi atualizada com sucesso.`,
      });
      setEditFolderOpen(false);
      setEditingFolderId(null);
    } catch (error) {
      console.error('Error updating folder:', error);
      toast({
        title: 'Erro ao atualizar pasta',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar a pasta.',
        variant: 'destructive',
      });
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleList = (listId: string) => {
    const newExpanded = new Set(expandedLists);
    if (newExpanded.has(listId)) {
      newExpanded.delete(listId);
    } else {
      newExpanded.add(listId);
    }
    setExpandedLists(newExpanded);
  };

  // Overview: recolher/expandir Pasta
  const toggleFolderOverview = (folderId: string) => {
    const next = new Set(collapsedFoldersOverview);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    setCollapsedFoldersOverview(next);
  };

  // Overview: recolher/expandir Lista dentro do card
  const toggleListOverview = (listId: string) => {
    const next = new Set(collapsedListsOverview);
    if (next.has(listId)) {
      next.delete(listId);
    } else {
      next.add(listId);
    }
    setCollapsedListsOverview(next);
  };

  const handleCreateFolder = async () => {
    try {
      await createFolder.mutateAsync({
        workspace_id: WORKSPACE_ID,
        name: newFolderName,
        icon: newFolderIcon,
        color: newFolderColor,
      });
      toast({
        title: 'Pasta criada!',
        description: `A pasta "${newFolderName}" foi criada com sucesso.`,
      });
      setNewFolderOpen(false);
      setNewFolderName('');
      setNewFolderIcon('📁');
      setNewFolderColor('#3B82F6');
    } catch (error) {
      toast({
        title: 'Erro ao criar pasta',
        description: 'Não foi possível criar a pasta.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateList = async () => {
    if (!selectedFolderId) {
      toast({
        title: 'Selecione uma pasta',
        description: 'Selecione uma pasta antes de criar uma lista.',
        variant: 'destructive',
      });
      return;
    }

      try {
        const created = await createList.mutateAsync({
          workspace_id: WORKSPACE_ID,
          folder_id: selectedFolderId,
          name: newListName,
          icon: newListIcon,
          color: newListColor,
        });
      toast({
        title: 'Lista criada!',
        description: `A lista "${newListName}" foi criada com sucesso.`,
      });
      // Após criar a lista, crie automaticamente a primeira tarefa em "pendente"
      try {
        const createdListId = (created as any)?.data?.id ?? (created as any)?.id;
        if (createdListId) {
          await createTask.mutateAsync({
            workspace_id: WORKSPACE_ID,
            folder_id: selectedFolderId,
            list_id: createdListId,
            name: `Primeira tarefa de ${newListName}`,
            description: 'Criada automaticamente ao criar a lista',
            status: 'pendente',
            priority: 'media',
            assignee_id: user?.id || null,
            created_by: user?.id || null,
          });
          toast({
            title: 'Tarefa inicial criada',
            description: `Uma tarefa pendente foi criada em "${newListName}" para aparecer no Kanban.`,
          });
        }
      } catch (err) {
        console.error('Erro ao criar tarefa inicial da lista:', err);
      }
      setNewListOpen(false);
      setNewListName('');
      setNewListIcon('📋');
      setNewListColor('#8B5CF6');
    } catch (error) {
      toast({
        title: 'Erro ao criar lista',
        description: 'Não foi possível criar a lista.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTask = async (data: {
    name: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    attachments?: File[];
    metadata?: Record<string, any>;
    assignee_id?: string;
    due_date?: string;
  }) => {
    console.log('Creating task with:', {
      selectedFolderId,
      selectedListId,
      ...data,
    });

    if (!selectedFolderId || !selectedListId) {
      toast({
        title: 'Selecione uma lista',
        description: `Pasta ID: ${selectedFolderId || 'vazio'}, Lista ID: ${selectedListId || 'vazio'}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createTask.mutateAsync({
        workspace_id: WORKSPACE_ID,
        folder_id: selectedFolderId,
        list_id: selectedListId,
        name: data.name,
        description: data.description,
        status: data.status,
        priority: data.priority,
        metadata: data.metadata || {},
        assignee_id: (data.assignee_id ?? user?.id) || null,
        due_date: data.due_date || null,
        created_by: user?.id || null,
      });

      const createdTaskId = result?.data?.id ?? result?.id;

      // Se houver anexos, fazer upload para cada um (somente se Supabase estiver configurado)
      if (data.attachments && data.attachments.length > 0 && createdTaskId) {
        if (!hasSupabase || !supabase) {
          toast({
            title: 'Armazenamento indisponível',
            description: 'Uploads de anexos estão desativados (Supabase não configurado).',
            variant: 'destructive',
          });
        } else {
          for (const file of data.attachments) {
            try {
              const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
              const timestamp = Date.now();
              const path = `pm/${WORKSPACE_ID}/tasks/${createdTaskId}/${timestamp}-${sanitize(file.name)}`;

              const { error: uploadError } = await supabase.storage
                .from('creatives')
                .upload(path, file, { contentType: file.type });

              if (uploadError) {
                console.error('Erro ao enviar anexo:', uploadError);
                continue;
              }

              const { data: publicUrlData } = supabase.storage
                .from('creatives')
                .getPublicUrl(path);

              const publicUrl = publicUrlData.publicUrl;

              await uploadTaskAttachment.mutateAsync({
                taskId: createdTaskId,
                data: {
                  file_name: file.name,
                  file_url: publicUrl,
                  file_type: file.type,
                  file_size: file.size,
                },
              });
            } catch (err) {
              console.error('Erro ao processar anexo:', err);
            }
          }
        }
      }

      toast({
        title: 'Tarefa criada!',
        description: `A tarefa "${data.name}" foi criada com sucesso.`,
      });
      setNewItemOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateDocument = async (data: { name: string; content: string; file?: File }) => {
    if (!selectedFolderId || !selectedListId) {
      toast({ title: 'Selecione uma lista', variant: 'destructive' });
      return;
    }
    try {
      const result = await createDocument.mutateAsync({
        workspace_id: WORKSPACE_ID,
        folder_id: selectedFolderId,
        list_id: selectedListId,
        name: data.name,
        content: data.content,
      });

      // Se houver arquivo anexado, enviar para Storage e salvar URL pública (somente se Supabase estiver configurado)
      if (data.file) {
        if (!hasSupabase || !supabase) {
          toast({
            title: 'Armazenamento indisponível',
            description: 'Uploads de anexos estão desativados (Supabase não configurado).',
            variant: 'destructive',
          });
        } else {
          try {
            const createdDocId = result?.data?.id ?? result?.id; // handle both wrapped and direct response
            if (createdDocId) {
              const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
              const ext = data.file.name.split('.').pop() || 'bin';
              const timestamp = Date.now();
              const path = `pm/${WORKSPACE_ID}/documents/${createdDocId}/${timestamp}-${sanitize(data.file.name)}`;

              const { error: uploadError } = await supabase.storage
                .from('creatives')
                .upload(path, data.file, { contentType: data.file.type });

              if (uploadError) {
                throw uploadError;
              }

              const { data: publicUrlData } = supabase.storage
                .from('creatives')
                .getPublicUrl(path);

              const publicUrl = publicUrlData.publicUrl;

              await uploadDocumentAttachment.mutateAsync({
                documentId: createdDocId,
                workspaceId: WORKSPACE_ID,
                data: {
                  file_name: data.file.name,
                  file_url: publicUrl,
                  file_type: data.file.type,
                  file_size: data.file.size,
                },
              });
            }
          } catch (err) {
            console.error('Erro ao enviar anexo:', err);
            toast({
              title: 'Anexo não salvo',
              description: 'O documento foi criado, mas houve erro ao enviar o anexo.',
              variant: 'destructive',
            });
          }
        }
      }
      toast({
        title: 'Documento criado!',
        description: `O documento "${data.name}" foi criado com sucesso.`,
      });
      setNewItemOpen(false);
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: 'Erro ao criar documento',
        description: error instanceof Error ? error.message : 'Não foi possível criar o documento.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateReminder = async (data: {
    name: string;
    description: string;
    dueDate: string;
    notifyVia: string;
    email?: string;
    phone?: string;
    telegram_chat_id?: string;
    assignee_id?: string;
  }) => {
    if (!selectedFolderId || !selectedListId) {
      toast({ title: 'Selecione uma lista', variant: 'destructive' });
      return;
    }
    try {
      await createReminder.mutateAsync({
        workspace_id: WORKSPACE_ID,
        folder_id: selectedFolderId,
        list_id: selectedListId,
        name: data.name,
        description: data.description,
        due_date: data.dueDate,
        notify_via: data.notifyVia as any,
        email: data.email,
        phone: data.phone,
        telegram_chat_id: data.telegram_chat_id,
        assignee_id: data.assignee_id,
      });
      toast({
        title: 'Lembrete criado!',
        description: `O lembrete "${data.name}" foi criado com sucesso.`,
      });
      setNewItemOpen(false);
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast({
        title: 'Erro ao criar lembrete',
        description: error instanceof Error ? error.message : 'Não foi possível criar o lembrete.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a lista "${listName}"? Todas as tarefas serão excluídas.`)) {
      return;
    }

    try {
      await deleteList.mutateAsync({
        workspaceId: WORKSPACE_ID,
        listId,
      });
      toast({
        title: 'Lista excluída!',
        description: `A lista "${listName}" foi removida com sucesso.`,
      });
      // Clear selection if deleted list was selected
      if (selectedListId === listId) {
        setSelectedListId(null);
      }
    } catch (error) {
      console.error('Error deleting list:', error);
      toast({
        title: 'Erro ao excluir lista',
        description: 'Não foi possível excluir a lista.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando projetos...</p>
        </div>
      </div>
    );
  }

  // Error handling
  const error = hierarchyData?.success === false;
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">Erro ao carregar projetos</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="mt-4"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const folders = hierarchyData?.data?.folders || [];
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // Get all tasks for selected folder
  const allTasks = selectedFolder?.lists.flatMap((list) => list.tasks) || [];

  // Removed filteredTasks (used only by Quadro/Kanban view)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="px-3 py-2.5 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Vermezzo - HUB</h2>
            <Button size="icon" variant="ghost" onClick={() => setNewFolderOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          <div className="space-y-0.5">
            {folders.map((folder) => {
              const isExpanded = expandedFolders.has(folder.id);
              const isSelected = selectedFolderId === folder.id;

              return (
                <div key={folder.id}>
                  {/* Folder */}
                  <div
                    onClick={() => {
                      toggleFolder(folder.id);
                      setSelectedFolderId(folder.id);
                      setSelectedListId(null);
                    }}
                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm hover:bg-muted transition-colors cursor-pointer ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="text-sm">{folder.icon}</span>
                    <span className="truncate flex-1 text-left text-xs">{folder.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 h-4">
                      {folder.task_count}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditFolder(folder);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Pasta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deleteFolder.isPending}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = confirm(`Excluir a pasta "${folder.name}"? Todas as listas e tarefas serão removidas.`);
                            if (!ok) return;
                            try {
                              await deleteFolder.mutateAsync({ workspaceId: WORKSPACE_ID, folderId: folder.id });
                              toast({ title: 'Pasta excluída', description: 'A pasta foi removida com sucesso.' });
                              if (selectedFolderId === folder.id) {
                                setSelectedFolderId(null);
                                setSelectedListId(null);
                              }
                            } catch (err) {
                              console.error('Erro ao excluir pasta:', err);
                              toast({ title: 'Falha ao excluir pasta', variant: 'destructive' });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Pasta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Lists */}
                  {isExpanded && (
                    <div className="ml-5 mt-0.5 space-y-0.5">
                      {folder.lists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setSelectedListId(list.id);
                          }}
                          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm hover:bg-muted transition-colors ${
                            selectedListId === list.id ? 'bg-muted' : ''
                          }`}
                        >
                          <span className="text-sm">{list.icon}</span>
                          <span className="truncate flex-1 text-left text-xs">{list.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1 h-4">
                            {list.tasks.length}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global Top Bar */}
        {!selectedFolder && (
          <div className="border-b bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <KanbanIcon className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Projetos</h1>
            </div>
          </div>
        )}

        {/* Header quando há pasta selecionada */}
        {selectedFolder && (
          <div className="border-b bg-card px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedFolder.icon}</span>
                  <h1 className="text-2xl font-bold">{selectedFolder.name}</h1>
                </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Voltar para a tela principal da própria página (Overview)
                    setSelectedFolderId(null);
                    setSelectedListId(null);
                    setExpandedFolders(new Set());
                    setExpandedLists(new Set());
                  }}
                > 
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Início
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label="Excluir pasta"
                  disabled={deleteFolder.isPending}
                  onClick={async () => {
                    const ok = confirm(`Excluir a pasta "${selectedFolder.name}"? Todas as listas e tarefas serão removidas.`);
                    if (!ok) return;
                    try {
                      await deleteFolder.mutateAsync({ workspaceId: WORKSPACE_ID, folderId: selectedFolder.id });
                      toast({ title: 'Pasta excluída!', description: 'A pasta foi removida com sucesso.' });
                      setSelectedFolderId(null);
                      setSelectedListId(null);
                    } catch (error) {
                      console.error('Erro ao excluir pasta:', error);
                      toast({ title: 'Erro ao excluir pasta', description: 'Não foi possível excluir a pasta.', variant: 'destructive' });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNewListOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Lista
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="lista" className="mt-2">
              <TabsList>
                <TabsTrigger value="overview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="lista" className="gap-2">
                  <LayoutList className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2">
                  <KanbanIcon className="h-4 w-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="calendario" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
              </TabsList>

              {/* Lista View */}
              <TabsContent value="lista" className="mt-2">
                <div className="space-y-2">
                  {selectedFolder.lists.map((list) => {
                    const isListExpanded = expandedLists.has(list.id);

                    return (
                      <Card key={list.id}>
                        <div
                          className="p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleList(list.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isListExpanded ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
                              <span className="text-xl">{list.icon}</span>
                              <h3 className="font-semibold text-lg">{list.name}</h3>
                              <Badge variant="secondary">{list.tasks.length}</Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedFolder) {
                                    setSelectedFolderId(selectedFolder.id);
                                    setSelectedListId(list.id);
                                    setNewItemOpen(true);
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditList({ id: list.id, name: list.name, icon: list.icon, color: list.color });
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar Lista
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteList(list.id, list.name);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir Lista
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>

                        {isListExpanded && list.tasks.length > 0 && (
                          <CardContent className="pt-0 space-y-2">
                            {list.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setTaskModalOpen(true);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{task.name}</h4>
                                      <Badge className={`${statusColors[task.status]} text-xs`}>
                                        {task.status}
                                      </Badge>
                                      {task.priority && (
                                        <Badge
                                          className={`${priorityColors[task.priority]} text-xs`}
                                          variant="outline"
                                        >
                                          {task.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    {/* Ocultado a pedido: não exibir a descrição abaixo do título */}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        )}

                        {isListExpanded && list.tasks.length === 0 && (
                          <CardContent className="pt-0">
                            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                              Nenhuma tarefa. Clique no + para adicionar.
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}

                  {selectedFolder.lists.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ListIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma lista criada. Clique em "Nova Lista" para começar.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Kanban View */}
              <TabsContent value="kanban" className="mt-2">
                <div className="h-[calc(100vh-12rem)]">
                  <KanbanBoard tasks={allTasks} workspaceId={WORKSPACE_ID} />
                </div>
              </TabsContent>

              {/* Calendário View */}
              <TabsContent value="calendario" className="mt-2">
                <div className="h-[calc(100vh-12rem)]">
                  <CalendarView
                    tasks={allTasks}
                    onTaskClick={(task) => {
                      setSelectedTask(task);
                      setTaskModalOpen(true);
                    }}
                  />
                </div>
              </TabsContent>

              {/* Overview */}
              <TabsContent value="overview" className="mt-2">
                <div className="grid grid-cols-3 gap-2">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-2xl font-bold">{selectedFolder.list_count}</div>
                      <div className="text-sm text-muted-foreground">Listas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-2xl font-bold">{selectedFolder.task_count}</div>
                      <div className="text-sm text-muted-foreground">Tarefas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-2xl font-bold">
                        {allTasks.filter((t) => t.status === 'concluido').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Concluídas</div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!selectedFolder && (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{hierarchyData?.data?.stats.folder_count ?? (hierarchyData?.data?.folders?.length || 0)}</div>
                  <div className="text-sm text-muted-foreground">Pastas</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{hierarchyData?.data?.stats.list_count || 0}</div>
                  <div className="text-sm text-muted-foreground">Listas</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{hierarchyData?.data?.stats.task_count || 0}</div>
                  <div className="text-sm text-muted-foreground">Tarefas</div>
                </CardContent>
              </Card>
            </div>

            {/* Workspace Overview: Folders → Lists → Tasks */}
            <div className="space-y-3">
              {folders.map((folder) => (
                <Card key={folder.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{folder.icon}</span>
                      <CardTitle className="text-base">{folder.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{folder.list_count} listas</Badge>
                      <Badge variant="secondary" className="text-xs">{folder.task_count} tarefas</Badge>
                      {/* Criar lista diretamente da visão inicial */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Seleciona a pasta e abre o modal de nova lista
                          setSelectedFolderId(folder.id);
                          setSelectedListId(null);
                          setNewListOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Lista
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Recolher/Expandir pasta"
                        onClick={() => toggleFolderOverview(folder.id)}
                      >
                        {collapsedFoldersOverview.has(folder.id) ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {!collapsedFoldersOverview.has(folder.id) && (
                    <CardContent className="space-y-2 p-3 pt-0">
                      {folder.lists.map((list) => (
                        <div key={list.id} className="border rounded-lg">
                          <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Recolher/Expandir lista"
                              onClick={() => toggleListOverview(list.id)}
                              className="h-7 w-7"
                            >
                              {collapsedListsOverview.has(list.id) ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <span>{list.icon}</span>
                            <span className="font-medium">{list.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{list.task_count} tarefas</Badge>
                            {/* Botão para adicionar nova tarefa diretamente na lista (visão inicial) */}
                            <Button
                              size="icon"
                              variant="outline"
                              aria-label="Adicionar tarefa"
                              className="h-7 w-7"
                              onClick={() => {
                                // Pré-seleciona a pasta e a lista e abre o modal de criação
                                setSelectedFolderId(folder.id);
                                setSelectedListId(list.id);
                                setNewItemOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          </div>
                          {!collapsedListsOverview.has(list.id) && (
                            <div className="divide-y">
                              {list.tasks.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma tarefa</div>
                              ) : (
                                list.tasks.map((t) => (
                                  <button
                                    key={t.id}
                                    className="w-full text-left px-3 py-2 hover:bg-muted/30 flex items-center justify-between"
                                    onClick={() => {
                                      setSelectedTask(t);
                                      setTaskModalOpen(true);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2 w-2 rounded-full ${statusColors[t.status]}`} />
                                      <span>{t.name}</span>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                      <span className="text-muted-foreground">{(t.metadata?.responsavel_nome as string) || t.assignee_name || 'Sem responsável'}</span>
                                      <span className="text-muted-foreground">{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Sem prazo'}</span>
                                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${priorityColors[t.priority || 'media']}`}>{t.priority || 'media'}</span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Documents */}
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Documentos</CardTitle>
                  <CardDescription>Últimos documentos do workspace</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {documentsData?.data?.length ? (
                      documentsData.data.slice(0, 10).map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{doc.name}</span>
                          <span className="text-muted-foreground">
                            {(folders.flatMap((f) => f.lists).find((l) => l.id === doc.list_id)?.name) || '—'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhum documento</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Pasta</DialogTitle>
            <DialogDescription>Crie uma pasta para organizar suas listas e tarefas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: MÍDIA PAGA - OPERACIONAL"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newFolderIcon}
                    onChange={(e) => setNewFolderIcon(e.target.value)}
                    placeholder="📁"
                    className="flex-1"
                  />
                  <EmojiPicker value={newFolderIcon} onSelect={(emoji) => setNewFolderIcon(emoji)} />
                </div>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName}>
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={editListOpen} onOpenChange={setEditListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lista</DialogTitle>
            <DialogDescription>Atualize o nome, ícone e cor da lista</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
                placeholder="Ex: Campanhas Ativas"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <Input value={editListIcon} onChange={(e) => setEditListIcon(e.target.value)} placeholder="📋" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={editListColor} onChange={(e) => setEditListColor(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditListOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateList} disabled={!editListName}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={editFolderOpen} onOpenChange={setEditFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pasta</DialogTitle>
            <DialogDescription>Atualize o nome, ícone e cor da pasta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Ex: MÍDIA PAGA"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <div className="flex items-center gap-2">
                  <EmojiPicker value={editFolderIcon || '📁'} onSelect={(emoji) => setEditFolderIcon(emoji)} triggerLabel="Escolher emoji" display="button" />
                  <Input value={editFolderIcon} onChange={(e) => setEditFolderIcon(e.target.value)} placeholder="📁" />
                </div>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={editFolderColor} onChange={(e) => setEditFolderColor(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateFolder} disabled={!editFolderName}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Lista</DialogTitle>
            <DialogDescription>
              Crie uma lista dentro da pasta {selectedFolder?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ex: Campanhas Ativas"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <div className="flex items-center gap-2">
                  <EmojiPicker value={newListIcon || '📋'} onSelect={(emoji) => setNewListIcon(emoji)} triggerLabel="Escolher emoji" display="button" />
                  <Input value={newListIcon} onChange={(e) => setNewListIcon(e.target.value)} placeholder="📋" />
                </div>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={newListColor} onChange={(e) => setNewListColor(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewListOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName}>
              Criar Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Item Modal (Task, Document, Reminder) */}
      <CreateItemModal
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        onCreateTask={handleCreateTask}
        onCreateDocument={handleCreateDocument}
        onCreateReminder={handleCreateReminder}
        folderName={selectedFolderId ? hierarchyData?.data.folders.find(f => f.id === selectedFolderId)?.name : undefined}
        listName={selectedListId ? hierarchyData?.data.folders
          .find(f => f.id === selectedFolderId)?.lists
          .find(l => l.id === selectedListId)?.name : undefined}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal task={selectedTask} open={taskModalOpen} onOpenChange={setTaskModalOpen} workspaceId={WORKSPACE_ID} />
    </div>
  );
}

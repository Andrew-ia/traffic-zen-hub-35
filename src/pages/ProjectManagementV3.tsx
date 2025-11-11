import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KanbanBoard } from '@/components/pm/KanbanBoardV2';
import { TaskDetailModal } from '@/components/pm/TaskDetailModal';
import type { PMTaskFull } from '@/types/project-management';
import { usePMHierarchy, useCreatePMFolder, useCreatePMList, useCreatePMTask } from '@/hooks/useProjectManagement';
import { toast } from '@/hooks/use-toast';
import type { TaskStatus, TaskPriority } from '@/types/project-management';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

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
  const { data: hierarchyData, isLoading } = usePMHierarchy(WORKSPACE_ID);
  const createFolder = useCreatePMFolder();
  const createList = useCreatePMList();
  const createTask = useCreatePMTask();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<PMTaskFull | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

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

  // New task dialog state
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('pendente');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('media');

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
      await createList.mutateAsync({
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

  const handleCreateTask = async () => {
    if (!selectedFolderId || !selectedListId) {
      toast({
        title: 'Selecione uma lista',
        description: 'Selecione uma lista antes de criar uma tarefa.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createTask.mutateAsync({
        workspace_id: WORKSPACE_ID,
        folder_id: selectedFolderId,
        list_id: selectedListId,
        name: newTaskName,
        description: newTaskDescription,
        status: newTaskStatus,
        priority: newTaskPriority,
      });
      toast({
        title: 'Tarefa criada!',
        description: `A tarefa "${newTaskName}" foi criada com sucesso.`,
      });
      setNewTaskOpen(false);
      setNewTaskName('');
      setNewTaskDescription('');
      setNewTaskStatus('pendente');
      setNewTaskPriority('media');
    } catch (error) {
      toast({
        title: 'Erro ao criar tarefa',
        description: 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const folders = hierarchyData?.data?.folders || [];
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // Get all tasks for selected folder
  const allTasks = selectedFolder?.lists.flatMap((list) => list.tasks) || [];

  // Apply filters
  const filteredTasks = allTasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Vermezzo - HUB</h2>
            <Button size="icon" variant="ghost" onClick={() => setNewFolderOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {folders.map((folder) => {
              const isExpanded = expandedFolders.has(folder.id);
              const isSelected = selectedFolderId === folder.id;

              return (
                <div key={folder.id}>
                  {/* Folder */}
                  <button
                    onClick={() => {
                      toggleFolder(folder.id);
                      setSelectedFolderId(folder.id);
                      setSelectedListId(null);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span>{folder.icon}</span>
                    <span className="truncate flex-1 text-left">{folder.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {folder.task_count}
                    </Badge>
                  </button>

                  {/* Lists */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {folder.lists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setSelectedListId(list.id);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors ${
                            selectedListId === list.id ? 'bg-muted' : ''
                          }`}
                        >
                          <span>{list.icon}</span>
                          <span className="truncate flex-1 text-left">{list.name}</span>
                          <Badge variant="secondary" className="text-xs">
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
        {/* Header */}
        {selectedFolder && (
          <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedFolder.icon}</span>
                <h1 className="text-2xl font-bold">{selectedFolder.name}</h1>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setNewListOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Lista
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="lista" className="mt-4">
              <TabsList>
                <TabsTrigger value="overview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="lista" className="gap-2">
                  <LayoutList className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="quadro" className="gap-2">
                  <KanbanIcon className="h-4 w-4" />
                  Quadro
                </TabsTrigger>
                <TabsTrigger value="calendario" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
              </TabsList>

              {/* Lista View */}
              <TabsContent value="lista" className="mt-4">
                <div className="space-y-4">
                  {selectedFolder.lists.map((list) => {
                    const isListExpanded = expandedLists.has(list.id);

                    return (
                      <Card key={list.id}>
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
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
                                  setSelectedFolderId(selectedFolder.id);
                                  setSelectedListId(list.id);
                                  setNewTaskOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
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
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                        {task.description}
                                      </p>
                                    )}
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

              {/* Quadro/Kanban View */}
              <TabsContent value="quadro" className="mt-4 h-[calc(100vh-250px)]">
                <div className="flex gap-2 mb-4">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Prioridades</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <KanbanBoard tasks={filteredTasks} workspaceId={WORKSPACE_ID} />
              </TabsContent>

              {/* Calendário View */}
              <TabsContent value="calendario" className="mt-4">
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Vista de calendário em desenvolvimento...</p>
                </div>
              </TabsContent>

              {/* Overview */}
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-2xl font-bold">{selectedFolder.list_count}</div>
                      <div className="text-sm text-muted-foreground">Listas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-2xl font-bold">{selectedFolder.task_count}</div>
                      <div className="text-sm text-muted-foreground">Tarefas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Gerenciamento de Projetos</h2>
              <p>Selecione uma pasta na sidebar para começar</p>
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
                <Input value={newFolderIcon} onChange={(e) => setNewFolderIcon(e.target.value)} placeholder="📁" />
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
                <Input value={newListIcon} onChange={(e) => setNewListIcon(e.target.value)} placeholder="📋" />
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

      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Tarefa</DialogTitle>
            <DialogDescription>Adicione uma tarefa à lista selecionada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Ex: Criar campanha de Black Friday"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Detalhes da tarefa..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={newTaskStatus} onValueChange={(v) => setNewTaskStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskName}>
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      <TaskDetailModal task={selectedTask} open={taskModalOpen} onOpenChange={setTaskModalOpen} workspaceId={WORKSPACE_ID} />
    </div>
  );
}

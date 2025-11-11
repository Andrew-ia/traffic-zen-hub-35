import { useState } from 'react';
import { Plus, FolderOpen, List, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
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

export default function ProjectManagement() {
  const { data: hierarchyData, isLoading } = usePMHierarchy(WORKSPACE_ID);
  const createFolder = useCreatePMFolder();
  const createList = useCreatePMList();
  const createTask = useCreatePMTask();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

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
        description: 'Não foi possível criar a pasta. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateList = async () => {
    if (!selectedFolderId) {
      toast({
        title: 'Selecione uma pasta',
        description: 'Você precisa selecionar uma pasta antes de criar uma lista.',
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
        description: 'Não foi possível criar a lista. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTask = async () => {
    if (!selectedFolderId || !selectedListId) {
      toast({
        title: 'Selecione uma lista',
        description: 'Você precisa selecionar uma lista antes de criar uma tarefa.',
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
        description: 'Não foi possível criar a tarefa. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  const folders = hierarchyData?.data?.folders || [];
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Projetos</h1>
          <p className="text-muted-foreground">
            Organize suas campanhas, tarefas e projetos
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Pasta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Pasta</DialogTitle>
                <DialogDescription>
                  Crie uma pasta para organizar suas listas e tarefas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folder-name">Nome</Label>
                  <Input
                    id="folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ex: MÍDIA PAGA - OPERACIONAL"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="folder-icon">Ícone</Label>
                    <Input
                      id="folder-icon"
                      value={newFolderIcon}
                      onChange={(e) => setNewFolderIcon(e.target.value)}
                      placeholder="📁"
                    />
                  </div>
                  <div>
                    <Label htmlFor="folder-color">Cor</Label>
                    <Input
                      id="folder-color"
                      type="color"
                      value={newFolderColor}
                      onChange={(e) => setNewFolderColor(e.target.value)}
                    />
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
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pastas</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hierarchyData?.data?.stats.folder_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Listas</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hierarchyData?.data?.stats.list_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hierarchyData?.data?.stats.task_count || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Folders */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pastas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setSelectedListId(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFolderId === folder.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{folder.icon}</span>
                    <span className="font-medium text-sm truncate">{folder.name}</span>
                  </div>
                  <div className="text-xs mt-1 opacity-75">
                    {folder.list_count} listas • {folder.task_count} tarefas
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Lists and Tasks */}
        <div className="col-span-9">
          {selectedFolder ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>{selectedFolder.icon}</span>
                      {selectedFolder.name}
                    </CardTitle>
                    <CardDescription>
                      {selectedFolder.list_count} listas • {selectedFolder.task_count} tarefas
                    </CardDescription>
                  </div>
                  <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Lista
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Nova Lista</DialogTitle>
                        <DialogDescription>
                          Crie uma lista dentro da pasta {selectedFolder.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="list-name">Nome</Label>
                          <Input
                            id="list-name"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="Ex: Campanhas Ativas"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="list-icon">Ícone</Label>
                            <Input
                              id="list-icon"
                              value={newListIcon}
                              onChange={(e) => setNewListIcon(e.target.value)}
                              placeholder="📋"
                            />
                          </div>
                          <div>
                            <Label htmlFor="list-color">Cor</Label>
                            <Input
                              id="list-color"
                              type="color"
                              value={newListColor}
                              onChange={(e) => setNewListColor(e.target.value)}
                            />
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
                </div>
              </CardHeader>
              <CardContent>
                {selectedFolder.lists.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhuma lista criada. Clique em "Nova Lista" para começar.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedFolder.lists.map((list) => (
                      <div key={list.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{list.icon}</span>
                            <h3 className="font-semibold">{list.name}</h3>
                            <Badge variant="secondary">{list.tasks.length}</Badge>
                          </div>
                          <Dialog open={newTaskOpen && selectedListId === list.id} onOpenChange={(open) => {
                            setNewTaskOpen(open);
                            if (open) setSelectedListId(list.id);
                          }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Tarefa
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Criar Nova Tarefa</DialogTitle>
                                <DialogDescription>
                                  Adicione uma tarefa à lista {list.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="task-name">Nome</Label>
                                  <Input
                                    id="task-name"
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                    placeholder="Ex: Criar campanha de Black Friday"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="task-description">Descrição</Label>
                                  <Input
                                    id="task-description"
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="Detalhes da tarefa..."
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="task-status">Status</Label>
                                    <select
                                      id="task-status"
                                      className="w-full p-2 border rounded-md"
                                      value={newTaskStatus}
                                      onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                                    >
                                      <option value="pendente">Pendente</option>
                                      <option value="em_andamento">Em Andamento</option>
                                      <option value="concluido">Concluído</option>
                                      <option value="bloqueado">Bloqueado</option>
                                    </select>
                                  </div>
                                  <div>
                                    <Label htmlFor="task-priority">Prioridade</Label>
                                    <select
                                      id="task-priority"
                                      className="w-full p-2 border rounded-md"
                                      value={newTaskPriority}
                                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                                    >
                                      <option value="baixa">Baixa</option>
                                      <option value="media">Média</option>
                                      <option value="alta">Alta</option>
                                      <option value="urgente">Urgente</option>
                                    </select>
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
                        </div>

                        {list.tasks.length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                            Nenhuma tarefa. Clique em "Nova Tarefa" para adicionar.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {list.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{task.name}</h4>
                                      <Badge className={statusColors[task.status]}>
                                        {task.status}
                                      </Badge>
                                      {task.priority && (
                                        <Badge className={priorityColors[task.priority]} variant="outline">
                                          {task.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma pasta para ver as listas e tarefas</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

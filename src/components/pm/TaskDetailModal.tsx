import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, User, Trash2, Save } from 'lucide-react';
import { useUpdatePMTask, useDeletePMTask } from '@/hooks/useProjectManagement';
import { toast } from '@/hooks/use-toast';
import type { PMTaskFull, TaskStatus, TaskPriority } from '@/types/project-management';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDetailModalProps {
  task: PMTaskFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const statusColors: Record<TaskStatus, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  concluido: 'bg-green-500',
  bloqueado: 'bg-red-500',
  cancelado: 'bg-gray-400',
};

const statusLabels: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
  cancelado: 'Cancelado',
};

const priorityColors: Record<TaskPriority, string> = {
  baixa: 'bg-gray-400',
  media: 'bg-yellow-500',
  alta: 'bg-orange-500',
  urgente: 'bg-red-600',
};

const priorityLabels: Record<TaskPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export function TaskDetailModal({ task, open, onOpenChange, workspaceId }: TaskDetailModalProps) {
  const updateTask = useUpdatePMTask();
  const deleteTask = useDeletePMTask();

  const [name, setName] = useState(task?.name || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'pendente');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'media');

  // Update local state when task changes
  useState(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority || 'media');
    }
  });

  if (!task) return null;

  const handleSave = async () => {
    try {
      await updateTask.mutateAsync({
        workspaceId,
        taskId: task.id,
        data: {
          name,
          description,
          status,
          priority,
        },
      });
      toast({
        title: 'Tarefa atualizada!',
        description: 'As alterações foram salvas com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar tarefa',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
      await deleteTask.mutateAsync({
        workspaceId,
        taskId: task.id,
      });
      toast({
        title: 'Tarefa excluída!',
        description: 'A tarefa foi removida com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: 'Não foi possível excluir a tarefa.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Tarefa</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <span>{task.folder_icon}</span>
              <span>{task.folder_name}</span>
              <span className="text-muted-foreground">/</span>
              <span>{task.list_icon}</span>
              <span>{task.list_name}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="task-name">Nome da Tarefa</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da tarefa"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição..."
              rows={4}
            />
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusColors[value as TaskStatus]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${priorityColors[value as TaskPriority]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t pt-4 space-y-2">
            <h4 className="font-semibold text-sm">Informações</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Criado por:</span>
                <span className="font-medium text-foreground">
                  {task.created_by_name || 'Desconhecido'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Criado em:</span>
                <span className="font-medium text-foreground">
                  {format(new Date(task.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>

              {task.assignee_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Responsável:</span>
                  <span className="font-medium text-foreground">{task.assignee_name}</span>
                </div>
              )}

              {task.due_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Vencimento:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {/* Counters */}
            <div className="flex gap-4 pt-2">
              <Badge variant="secondary">
                {task.subtask_count} subtarefa(s)
              </Badge>
              <Badge variant="secondary">
                {task.comment_count} comentário(s)
              </Badge>
              <Badge variant="secondary">
                {task.attachment_count} anexo(s)
              </Badge>
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateTask.isPending || !name}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

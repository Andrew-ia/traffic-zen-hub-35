import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KanbanCard } from './KanbanCardV2';
import { TaskDetailModal } from './TaskDetailModal';
import { useUpdatePMTask } from '@/hooks/useProjectManagement';
import type { PMTaskFull, TaskStatus } from '@/types/project-management';
import { toast } from '@/hooks/use-toast';

interface KanbanBoardProps {
  tasks: PMTaskFull[];
  workspaceId: string;
}

const STATUSES: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pendente', label: 'Pendente', color: 'bg-gray-500' },
  { status: 'em_andamento', label: 'Em Andamento', color: 'bg-blue-500' },
  { status: 'concluido', label: 'Concluído', color: 'bg-green-500' },
  { status: 'bloqueado', label: 'Bloqueado', color: 'bg-red-500' },
  { status: 'cancelado', label: 'Cancelado', color: 'bg-yellow-600' },
];

export function KanbanBoard({ tasks, workspaceId }: KanbanBoardProps) {
  const [selectedTask, setSelectedTask] = useState<PMTaskFull | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null);
  const updateTask = useUpdatePMTask();

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(status);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(null);

    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task || task.status === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    // Atualiza o status da tarefa
    updateTask.mutate(
      {
        workspaceId,
        taskId: draggedTaskId,
        data: { status: newStatus },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Tarefa atualizada',
            description: `Status alterado para "${STATUSES.find((s) => s.status === newStatus)?.label}"`,
          });
        },
        onError: () => {
          toast({
            title: 'Erro ao atualizar tarefa',
            description: 'Não foi possível mover a tarefa.',
            variant: 'destructive',
          });
        },
      }
    );

    setDraggedTaskId(null);
  };

  const handleTaskClick = (task: PMTaskFull) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-5 gap-2 h-full">
        {STATUSES.map(({ status, label, color }) => {
          const columnTasks = tasks
            .filter((task) => task.status === status)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at));

          const isDragging = Boolean(draggedTaskId);
          const isOver = draggedOverColumn === status;

          return (
            <Card key={status} className="flex flex-col h-full">
              <CardHeader className="pb-2 pt-2.5 px-3">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span>{label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{columnTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
                className={`flex-1 space-y-1.5 overflow-y-auto transition-colors px-2 pb-2 ${
                  isOver ? 'ring-2 ring-primary/50 bg-primary/5' : isDragging ? 'ring-1 ring-muted' : ''
                }`}
              >
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                    className={`cursor-move ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                  >
                    <KanbanCard task={task} onClick={() => handleTaskClick(task)} />
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div
                    className={`text-center py-6 text-xs border-2 border-dashed rounded-md transition-colors ${
                      isDragging
                        ? isOver
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted-foreground/40 text-muted-foreground'
                        : 'text-muted-foreground border-muted-foreground/20'
                    }`}
                  >
                    Arraste aqui
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onOpenChange={setModalOpen}
        workspaceId={workspaceId}
      />
    </>
  );
}

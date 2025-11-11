import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
];

export function KanbanBoard({ tasks, workspaceId }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<PMTaskFull | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const updateTask = useUpdatePMTask();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Update task status
    updateTask.mutate(
      {
        workspaceId,
        taskId,
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
            description: 'Não foi possível alterar o status da tarefa.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleTaskClick = (task: PMTaskFull) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4 h-full">
          {STATUSES.map(({ status, label, color }) => {
            const columnTasks = tasks.filter((task) => task.status === status);

            return (
              <SortableContext
                key={status}
                id={status}
                items={columnTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <Card className="flex flex-col h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        {label}
                      </div>
                      <Badge variant="secondary">{columnTasks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 overflow-y-auto">
                    {columnTasks.map((task) => (
                      <KanbanCard key={task.id} task={task} onClick={() => handleTaskClick(task)} />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        Arraste tarefas aqui
                      </div>
                    )}
                  </CardContent>
                </Card>
              </SortableContext>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-50">
              <KanbanCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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

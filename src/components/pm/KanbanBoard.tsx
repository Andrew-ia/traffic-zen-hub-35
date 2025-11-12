import { useMemo, useCallback, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KanbanCard } from './KanbanCard';
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

// Componente separado para a coluna (evita chamar hooks dentro de map)
interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: PMTaskFull[];
  getTaskStatus: (task: PMTaskFull) => TaskStatus;
}

function KanbanColumn({ status, label, color, tasks, getTaskStatus }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
    data: { type: 'column', column: status },
  });

  const columnTasks = tasks
    .map((t) => ({ ...t, status: getTaskStatus(t) }))
    .filter((task) => task.status === status);

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
        <CardContent ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto">
          {columnTasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
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
}

export function KanbanBoard({ tasks, workspaceId }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Mapa local para atualização otimista de status por tarefa
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const updateTask = useUpdatePMTask();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    console.debug('[Kanban] drag start', { activeId: event.active.id, data: event.active.data?.current });
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.debug('[Kanban] drag end', {
      activeId: active?.id,
      activeData: active?.data?.current,
      overId: over?.id,
      overData: over?.data?.current,
    });
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;

    // Resolver coluna destino de forma robusta
    let newStatus: TaskStatus | null = null;
    const overData = over.data?.current as any;

    if (overData?.type === 'column' && overData?.column) {
      newStatus = overData.column as TaskStatus;
    } else if (overData?.type === 'card' && overData?.column) {
      newStatus = overData.column as TaskStatus;
    } else {
      // Fallback: se o alvo for um card sem data, inferir pela tarefa alvo
      const overTask = tasks.find((t) => t.id === (over.id as string));
      if (overTask) newStatus = overTask.status;
      // Fallback adicional: se o id do alvo for exatamente o nome da coluna
      if (!newStatus && ['pendente', 'em_andamento', 'concluido', 'bloqueado'].includes(String(over.id))) {
        newStatus = over.id as TaskStatus;
      }
    }

    console.debug('[Kanban] resolved newStatus', newStatus);
    if (!newStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentStatus = statusOverrides[taskId] ?? task.status;
    if (currentStatus === newStatus) return;

    // Atualização otimista: refletir mudança imediatamente no UI
    setStatusOverrides((prev) => ({ ...prev, [taskId]: newStatus }));

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
          console.debug('[Kanban] server update success', { taskId, newStatus });
        },
        onError: () => {
          // Mantém override para experiência visual mesmo com backend indisponível
          toast({
            title: 'Erro ao atualizar tarefa',
            description: 'Mudança exibida no quadro, mas não foi salva no servidor.',
            variant: 'destructive',
          });
          console.warn('[Kanban] server update failed; optimistic UI shown', { taskId, newStatus });
        },
      }
    );
  };

  const getTaskStatus = useCallback((task: PMTaskFull): TaskStatus => statusOverrides[task.id] ?? task.status, [statusOverrides]);

  const activeTask = useMemo(() => {
    const found = activeId ? tasks.find((t) => t.id === activeId) : null;
    return found ? { ...found, status: getTaskStatus(found) } : null;
  }, [activeId, tasks, getTaskStatus]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 h-full">
        {STATUSES.map(({ status, label, color }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            color={color}
            tasks={tasks}
            getTaskStatus={getTaskStatus}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-50">
            <KanbanCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

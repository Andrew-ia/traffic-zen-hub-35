import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MessageSquare, Paperclip, User, GripVertical } from 'lucide-react';
import type { PMTaskFull, TaskPriority } from '@/types/project-management';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanCardProps {
  task: PMTaskFull;
  onClick?: () => void;
}

const priorityColors: Record<TaskPriority, string> = {
  baixa: 'bg-gray-400 text-white',
  media: 'bg-yellow-500 text-white',
  alta: 'bg-orange-500 text-white',
  urgente: 'bg-red-600 text-white',
};

const priorityLabels: Record<TaskPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="hover:shadow-md transition-shadow relative group"
    >
      <CardContent className="p-3 space-y-2">
        {/* Drag Handle - apenas este elemento tem o drag */}
        <div
          {...listeners}
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Conteúdo clicável */}
        <div onClick={onClick} className="cursor-pointer">
          <div className="flex items-start justify-between gap-2 pr-6">
            <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
            {task.priority && (
              <Badge className={`${priorityColors[task.priority]} text-xs shrink-0`}>
                {priorityLabels[task.priority]}
              </Badge>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          {/* Task metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), 'dd/MM', { locale: ptBR })}
              </div>
            )}

            {task.assignee_name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{task.assignee_name}</span>
              </div>
            )}

            {Number(task.comment_count) > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {task.comment_count}
              </div>
            )}

            {Number(task.attachment_count) > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {task.attachment_count}
              </div>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{task.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Folder and List info */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>{task.folder_icon}</span>
            <span className="truncate">{task.list_name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

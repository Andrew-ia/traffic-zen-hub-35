import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MessageSquare, Paperclip, User } from 'lucide-react';
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
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-2.5 space-y-1.5" onClick={onClick}>
        {/* Header com título e prioridade */}
        <div className="flex items-start justify-between gap-1.5">
          <h4 className="font-medium text-xs leading-tight line-clamp-2 flex-1">{task.name}</h4>
          {task.priority && (
            <Badge className={`${priorityColors[task.priority]} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
              {priorityLabels[task.priority]}
            </Badge>
          )}
        </div>

        {/* Descrição (opcional, removida para economizar espaço) */}

        {/* Metadata compacta */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {task.due_date && (
            <div className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              <span>{format(new Date(task.due_date), 'dd/MM', { locale: ptBR })}</span>
            </div>
          )}

          {task.assignee_name && (
            <div className="flex items-center gap-0.5 max-w-[60px]">
              <User className="h-2.5 w-2.5" />
              <span className="truncate">{task.assignee_name.split(' ')[0]}</span>
            </div>
          )}

          {Number(task.comment_count) > 0 && (
            <div className="flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              <span>{task.comment_count}</span>
            </div>
          )}

          {Number(task.attachment_count) > 0 && (
            <div className="flex items-center gap-0.5">
              <Paperclip className="h-2.5 w-2.5" />
              <span>{task.attachment_count}</span>
            </div>
          )}
        </div>

        {/* Tags compactas */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {task.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 2 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                +{task.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Lista origem */}
        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 pt-0.5 border-t">
          <span>{task.folder_icon}</span>
          <span className="truncate">{task.list_name}</span>
        </div>
      </CardContent>
    </Card>
  );
}

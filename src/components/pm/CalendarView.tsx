import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { PMTaskFull, TaskStatus } from '@/types/project-management';

interface CalendarViewProps {
  tasks: PMTaskFull[];
  onTaskClick: (task: PMTaskFull) => void;
}

const statusColors: Record<TaskStatus, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  concluido: 'bg-green-500',
  bloqueado: 'bg-red-500',
  cancelado: 'bg-gray-400',
};

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button size="sm" variant="outline" onClick={goToToday}>
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {/* Week days header */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="bg-muted p-2 text-center text-sm font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, idx) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <div
                key={idx}
                className={`bg-card p-2 min-h-[120px] ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isTodayDate ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex flex-col h-full">
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-semibold ${
                        isTodayDate
                          ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                          : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayTasks.length}
                      </Badge>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className="w-full text-left p-1 rounded text-xs hover:bg-muted transition-colors truncate flex items-center gap-1"
                      >
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${statusColors[task.status]}`}
                        />
                        <span className="truncate">{task.name}</span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayTasks.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Em Andamento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Concluído</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Bloqueado</span>
        </div>
      </div>
    </div>
  );
}

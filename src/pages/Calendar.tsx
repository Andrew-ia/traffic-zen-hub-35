import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMonthlyEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Flag,
  Sparkles,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================================================
// HELPERS
// ============================================================================

const EVENT_ICONS: Record<CalendarEvent["type"], any> = {
  campaign_start: Rocket,
  campaign_end: Flag,
  campaign_created: Sparkles,
  budget_change: DollarSign,
  performance_alert: AlertCircle,
};

const EVENT_LABELS: Record<CalendarEvent["type"], string> = {
  campaign_start: "Início",
  campaign_end: "Término",
  campaign_created: "Criada",
  budget_change: "Orçamento",
  performance_alert: "Alerta",
};

function formatCurrency(value: number | undefined, currency = "BRL") {
  if (value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function EventBadge({ event }: { event: CalendarEvent }) {
  const Icon = EVENT_ICONS[event.type];
  const color = event.metadata.color || "#3B82F6";

  return (
    <div
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{event.campaignName || "Evento"}</span>
    </div>
  );
}

function EventDetailsDialog({
  event,
  open,
  onOpenChange,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!event) return null;

  const Icon = EVENT_ICONS[event.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: event.metadata.color }} />
            {event.title}
          </DialogTitle>
          <DialogDescription>{format(event.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Tipo de Evento</p>
            <Badge variant="outline" className="mt-1">
              {EVENT_LABELS[event.type]}
            </Badge>
          </div>

          {event.campaignName && (
            <div>
              <p className="text-sm font-medium">Campanha</p>
              <p className="text-sm text-muted-foreground mt-1">{event.campaignName}</p>
            </div>
          )}

          {event.platform && (
            <div>
              <p className="text-sm font-medium">Plataforma</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {event.platform}
              </Badge>
            </div>
          )}

          {event.metadata.objective && (
            <div>
              <p className="text-sm font-medium">Objetivo</p>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {event.metadata.objective.toLowerCase().replace(/_/g, " ")}
              </p>
            </div>
          )}

          {event.metadata.status && (
            <div>
              <p className="text-sm font-medium">Status</p>
              <Badge
                variant={event.metadata.status === "ACTIVE" ? "default" : "secondary"}
                className="mt-1 capitalize"
              >
                {event.metadata.status.toLowerCase()}
              </Badge>
            </div>
          )}

          {event.metadata.budget && (
            <div>
              <p className="text-sm font-medium">Orçamento</p>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrency(event.metadata.budget)}</p>
            </div>
          )}

          {event.metadata.spend && (
            <div>
              <p className="text-sm font-medium">Investimento</p>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrency(event.metadata.spend)}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Descrição</p>
            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
          </div>

          {event.campaignId && (
            <Button className="w-full" onClick={() => window.location.href = `/campaigns/${event.campaignId}`}>
              Ver Campanha
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: events = [], isLoading } = useMonthlyEvents(currentMonth);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const dateKey = format(event.date, "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    }

    return map;
  }, [events]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return events
      .filter((event) => event.date >= now && event.date <= sevenDaysLater)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [events]);

  // Stats
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const campaignStarts = events.filter((e) => e.type === "campaign_start").length;
    const campaignEnds = events.filter((e) => e.type === "campaign_end").length;
    const alerts = events.filter((e) => e.type === "performance_alert").length;

    return { totalEvents, campaignStarts, campaignEnds, alerts };
  }, [events]);

  function handleEventClick(event: CalendarEvent) {
    setSelectedEvent(event);
    setDialogOpen(true);
  }

  function handlePreviousMonth() {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }

  function handleNextMonth() {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendário de Campanhas</h1>
          <p className="text-muted-foreground mt-1">Visualize e organize todos os eventos das suas campanhas</p>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>Total: {stats.totalEvents}</span>
            <span className="text-green-600">Inícios: {stats.campaignStarts}</span>
            <span className="text-red-600">Términos: {stats.campaignEnds}</span>
            <span className="text-purple-600">Alertas: {stats.alerts}</span>
          </div>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Agendar Evento
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">Carregando eventos...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  locale={ptBR}
                  className="rounded-md border"
                  modifiers={{
                    hasEvents: (date) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      return eventsByDate.has(dateKey);
                    },
                  }}
                  modifiersClassNames={{
                    hasEvents: "bg-primary/10 font-bold",
                  }}
                />

                {/* Events for selected date */}
                {selectedDateEvents.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      Eventos em {format(selectedDate!, "d 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="space-y-2">
                      {selectedDateEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                          onClick={() => handleEventClick(event)}
                        >
                          <EventBadge event={event} />
                          <span className="text-sm text-muted-foreground">{event.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {upcomingEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum evento nos próximos 7 dias
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const Icon = EVENT_ICONS[event.type];
                    return (
                      <div
                        key={event.id}
                        className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: event.metadata.color }} />
                            <Badge variant="outline" className="text-xs">
                              {EVENT_LABELS[event.type]}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(event.date, "dd/MM")}
                          </span>
                        </div>
                        <p className="font-medium text-sm line-clamp-1">{event.campaignName}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                        {event.platform && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {event.platform}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Event Details Dialog */}
      <EventDetailsDialog event={selectedEvent} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

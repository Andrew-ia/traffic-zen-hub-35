import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon } from "lucide-react";

const scheduledPosts = [
  {
    id: 1,
    date: "2025-11-05",
    time: "14:00",
    platform: "Facebook",
    campaign: "Black Friday",
    status: "Agendado",
  },
  {
    id: 2,
    date: "2025-11-06",
    time: "10:00",
    platform: "Instagram",
    campaign: "Lançamento Produto X",
    status: "Agendado",
  },
  {
    id: 3,
    date: "2025-11-07",
    time: "16:30",
    platform: "Google",
    campaign: "Remarketing",
    status: "Agendado",
  },
];

export default function Calendar() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendário de Publicações</h1>
          <p className="text-muted-foreground mt-1">
            Organize e agende suas campanhas
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Agendar Publicação
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Novembro 2025</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <div className="text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Calendário visual será implementado em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Publicações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="p-4 rounded-lg border border-border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{post.platform}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {post.time}
                  </span>
                </div>
                <p className="font-medium">{post.campaign}</p>
                <p className="text-sm text-muted-foreground">{post.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

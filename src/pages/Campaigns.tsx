import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Campaigns() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Campanhas</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie todas as suas campanhas de tráfego
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Ativas</TabsTrigger>
          <TabsTrigger value="paused">Pausadas</TabsTrigger>
          <TabsTrigger value="completed">Concluídas</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <CampaignsTable />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-center py-10">
              <p className="text-muted-foreground">Campanhas ativas aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paused" className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-center py-10">
              <p className="text-muted-foreground">Campanhas pausadas aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-center py-10">
              <p className="text-muted-foreground">Campanhas concluídas aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

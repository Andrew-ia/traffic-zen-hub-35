import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Upload, Image, Video, FileText, Copy } from "lucide-react";

const creatives = [
  {
    id: 1,
    type: "image",
    name: "Banner Black Friday",
    format: "1080x1080",
    size: "245 KB",
    campaigns: 3,
    performance: "+24% CTR",
    status: "Ativo",
  },
  {
    id: 2,
    type: "video",
    name: "Vídeo Produto X",
    format: "1920x1080",
    size: "12.4 MB",
    campaigns: 2,
    performance: "+18% Conv.",
    status: "Ativo",
  },
  {
    id: 3,
    type: "text",
    name: "Copy Principal",
    format: "Texto",
    size: "1 KB",
    campaigns: 5,
    performance: "+31% Eng.",
    status: "Ativo",
  },
];

export default function Creatives() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Biblioteca de Criativos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os seus ativos criativos em um só lugar
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Criativo
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar criativos..." className="pl-10" />
        </div>
        <Button variant="outline">Filtros</Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="images">Imagens</TabsTrigger>
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
          <TabsTrigger value="text">Textos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {creatives.map((creative) => (
              <Card key={creative.id} className="group cursor-pointer hover:shadow-lg transition-all">
                <CardContent className="p-4">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center mb-4">
                    {creative.type === "image" && <Image className="h-12 w-12 text-muted-foreground" />}
                    {creative.type === "video" && <Video className="h-12 w-12 text-muted-foreground" />}
                    {creative.type === "text" && <FileText className="h-12 w-12 text-muted-foreground" />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{creative.name}</h3>
                        <p className="text-sm text-muted-foreground">{creative.format}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{creative.size}</span>
                      <Badge variant="outline">{creative.campaigns} campanhas</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-success">{creative.performance}</span>
                      <Badge>{creative.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Análise de Performance por Criativo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                  <Image className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">Banner Black Friday</p>
                  <p className="text-sm text-muted-foreground">Imagem • 1080x1080</p>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold">3.8%</p>
                  <p className="text-sm text-muted-foreground">CTR</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">R$ 12,40</p>
                  <p className="text-sm text-muted-foreground">CPC</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">5.2x</p>
                  <p className="text-sm text-muted-foreground">ROAS</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Download, Upload, Target } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const audiences = [
  {
    id: 1,
    name: "Compradores Últimos 30 Dias",
    type: "Custom Audience",
    size: "12.5K",
    platforms: ["Facebook", "Instagram"],
    status: "Ativo",
    lastUpdate: "Hoje",
  },
  {
    id: 2,
    name: "Lookalike 1% - Compradores",
    type: "Lookalike",
    size: "450K",
    platforms: ["Facebook", "Google"],
    status: "Ativo",
    lastUpdate: "2 dias atrás",
  },
  {
    id: 3,
    name: "Visitantes Site - 90 Dias",
    type: "Custom Audience",
    size: "28.3K",
    platforms: ["Facebook", "Google", "TikTok"],
    status: "Ativo",
    lastUpdate: "Hoje",
  },
  {
    id: 4,
    name: "Carrinho Abandonado",
    type: "Custom Audience",
    size: "5.8K",
    platforms: ["Facebook", "Instagram"],
    status: "Pausado",
    lastUpdate: "5 dias atrás",
  },
];

export default function Audiences() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Públicos</h1>
          <p className="text-muted-foreground mt-1">
            Crie, gerencie e versione seus públicos personalizados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Público
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Públicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground mt-1">+12 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alcance Total</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4M</div>
            <p className="text-xs text-muted-foreground mt-1">Pessoas únicas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lookalikes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground mt-1">Ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custom Audiences</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">104</div>
            <p className="text-xs text-muted-foreground mt-1">Ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar públicos..." className="pl-10" />
        </div>
        <Button variant="outline">Filtros</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Públicos Personalizados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Plataformas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audiences.map((audience) => (
                <TableRow key={audience.id}>
                  <TableCell className="font-medium">{audience.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{audience.type}</Badge>
                  </TableCell>
                  <TableCell>{audience.size}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {audience.platforms.map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={audience.status === "Ativo" ? "default" : "secondary"}>
                      {audience.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {audience.lastUpdate}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <Users className="h-6 w-6" />
              <span>Custom Audience</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <Target className="h-6 w-6" />
              <span>Lookalike</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <Upload className="h-6 w-6" />
              <span>Upload Lista</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

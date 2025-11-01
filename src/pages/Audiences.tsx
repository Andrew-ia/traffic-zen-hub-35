import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Search, Download, Upload, Target } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAudiences } from "@/hooks/useAudiences";

function formatNumber(value: number | null | undefined) {
  if (!value) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString("pt-BR");
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("look")) return "Lookalike";
  if (normalized.includes("custom")) return "Custom Audience";
  if (normalized.includes("saved")) return "Saved Audience";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Audiences() {
  const [search, setSearch] = useState("");
  const {
    data,
    isLoading,
    error,
  } = useAudiences({ search });

  const audiences = data?.rows ?? [];
  const summary = data?.summary;

  const activeAudiences = useMemo(() => audiences.filter((audience) => audience.status === "active"), [audiences]);

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
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{summary?.total ?? 0}</div>}
            <p className="text-xs text-muted-foreground mt-1">{activeAudiences.length} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alcance Total</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatNumber(summary?.totalSize ?? 0)}</div>}
            <p className="text-xs text-muted-foreground mt-1">Pessoas únicas estimadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lookalikes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary?.lookalikeCount ?? 0}</div>}
            <p className="text-xs text-muted-foreground mt-1">Total cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custom Audiences</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary?.customCount ?? 0}</div>}
            <p className="text-xs text-muted-foreground mt-1">Total cadastrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar públicos..."
            className="pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline">Filtros</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Públicos Personalizados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : audiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum público encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audiences.map((audience) => {
                  const isActive = audience.status.toLowerCase() === "active";
                  return (
                    <TableRow key={audience.id}>
                      <TableCell className="font-medium">{audience.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatType(audience.audienceType)}</Badge>
                      </TableCell>
                      <TableCell>{formatNumber(audience.sizeEstimate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {audience.platformName ?? audience.platformKey ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "Ativo" : "Arquivado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateLabel(audience.lastSyncedAt ?? audience.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">Não foi possível carregar os públicos. {error.message}</p>
          </CardContent>
        </Card>
      ) : null}

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

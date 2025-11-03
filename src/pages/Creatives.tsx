import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreativeLibrary } from "@/hooks/useCreativeLibrary";
import {
  Plus,
  Search,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Copy,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_TAB_MAP: Record<string, string | null> = {
  all: null,
  images: "image",
  videos: "video",
  text: "text",
  templates: "template",
};

function formatCurrency(value: number, currency = "BRL") {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function formatPercent(value: number | null, fractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatBytes(bytes: number | null) {
  if (!bytes || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function renderPreview(
  type: string | null,
  thumbnailUrl: string | null,
  storageUrl: string | null,
  name: string,
  textContent: string | null,
) {
  if (thumbnailUrl) {
    return <img src={thumbnailUrl} alt={name} className="h-full w-full rounded-lg object-cover" />;
  }

  if (storageUrl && type !== "video") {
    return <img src={storageUrl} alt={name} className="h-full w-full rounded-lg object-cover" />;
  }

  if (type === "video") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
        <Video className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  if (type === "text" && textContent) {
    return (
      <ScrollArea className="h-full w-full rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {textContent}
      </ScrollArea>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
      <FileText className="h-10 w-10 text-muted-foreground" />
    </div>
  );
}

export default function Creatives() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<keyof typeof TYPE_TAB_MAP>("all");
  const { data: creativeData, isLoading, error } = useCreativeLibrary({ days: 30 });

  const filteredCreatives = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const typeFilter = TYPE_TAB_MAP[activeTab];

    return (creativeData ?? []).filter((creative) => {
      const matchesSearch =
        !term ||
        creative.name.toLowerCase().includes(term) ||
        (creative.textContent ?? "").toLowerCase().includes(term);

      const metadataTemplate = creative.metadata && "template_id" in creative.metadata;
      const matchesType =
        typeFilter === null
          ? true
          : typeFilter === "template"
            ? Boolean(metadataTemplate)
            : creative.type?.toLowerCase() === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [creativeData, activeTab, searchTerm]);

  const sortedCreatives = useMemo(() => {
    return [...filteredCreatives].sort((a, b) => {
      if (b.metrics.spend !== a.metrics.spend) {
        return b.metrics.spend - a.metrics.spend;
      }
      return (b.metrics.impressions ?? 0) - (a.metrics.impressions ?? 0);
    });
  }, [filteredCreatives]);

  const topCreatives = useMemo(() => {
    return [...sortedCreatives]
      .sort((a, b) => {
        const bCtr = b.metrics.ctr ?? 0;
        const aCtr = a.metrics.ctr ?? 0;
        return bCtr === aCtr ? b.metrics.spend - a.metrics.spend : bCtr - aCtr;
      })
      .slice(0, 3);
  }, [sortedCreatives]);

  const totalCreatives = creativeData?.length ?? 0;
  const filteredCount = sortedCreatives.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Biblioteca de Criativos</h1>
          <p className="text-muted-foreground mt-1">Gerencie todos os seus ativos criativos em um só lugar</p>
          {totalCreatives > 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              Exibindo {filteredCount} de {totalCreatives} criativos
            </p>
          ) : null}
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar criativos..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Período: últimos 30 dias</span>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar criativos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} className="space-y-4">
        <TabsList className="flex-wrap">
          {Object.keys(TYPE_TAB_MAP).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              onClick={() => setActiveTab(key as keyof typeof TYPE_TAB_MAP)}
            >
              {key === "all" && "Todos"}
              {key === "images" && "Imagens"}
              {key === "videos" && "Vídeos"}
              {key === "text" && "Textos"}
              {key === "templates" && "Templates"}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-4 p-4">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedCreatives.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10" />
                <p>Nenhum criativo encontrado para os filtros selecionados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sortedCreatives.map((creative) => (
                <Card key={creative.id} className="group flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col gap-4 p-4">
                    <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                      {renderPreview(
                        creative.type,
                        creative.thumbnailUrl,
                        creative.storageUrl,
                        creative.name,
                        creative.textContent,
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold line-clamp-2">{creative.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">
                              {creative.type ? creative.type.replace("_", " ") : "Tipo indefinido"}
                            </span>
                            {creative.aspectRatio ? <span>• {creative.aspectRatio}</span> : null}
                            {creative.durationSeconds ? <span>• {creative.durationSeconds.toFixed(0)}s</span> : null}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{creative.campaignCount} campanhas</Badge>
                          <Badge variant="outline">{creative.adsCount} anúncios</Badge>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          {creative.status ?? "desconhecido"}
                        </Badge>
                      </div>
                      <div className="grid gap-2 rounded-md border p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span>Investimento</span>
                          <span className="font-semibold">{formatCurrency(creative.metrics.spend)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>CTR</span>
                          <span className="font-semibold">{formatPercent(creative.metrics.ctr, 1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>CPC</span>
                          <span className="font-semibold">{formatCurrency(creative.metrics.cpc ?? 0)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Conversões</span>
                          <span className="font-semibold">{formatNumber(creative.metrics.conversions)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Tamanho: {formatBytes(creative.fileSizeBytes)}</span>
                        <span className="flex items-center gap-1">
                          {creative.metrics.lastMetricDate ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />
                              {formatDistanceToNow(new Date(creative.metrics.lastMetricDate), {
                                locale: ptBR,
                                addSuffix: true,
                              })}
                            </>
                          ) : (
                            "Sem métricas recentes"
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Análise de Performance por Criativo</CardTitle>
        </CardHeader>
        <CardContent>
          {topCreatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há métricas suficientes para calcular rankings.</p>
          ) : (
            <div className="space-y-3">
              {topCreatives.map((creative, index) => (
                <div
                  key={creative.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
                      {creative.type === "image" && <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                      {creative.type === "video" && <Video className="h-6 w-6 text-muted-foreground" />}
                      {creative.type === "text" && <FileText className="h-6 w-6 text-muted-foreground" />}
                      {!["image", "video", "text"].includes(creative.type ?? "") && (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">#{index + 1}</span>
                        <p className="font-medium line-clamp-1">{creative.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {creative.metrics.platforms.length > 0
                          ? `Plataforma: ${creative.metrics.platforms.join(", ")}`
                          : "Plataforma indefinida"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold">{formatPercent(creative.metrics.ctr, 1)}</p>
                      <p className="text-xs text-muted-foreground">CTR</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">{formatCurrency(creative.metrics.cpc ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">CPC</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">
                        {creative.metrics.roas ? creative.metrics.roas.toFixed(2) : "—"}x
                      </p>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useCreativeFolders,
  useCreativeLibraryEnhanced,
  useCreativeTags,
  useCalculatePerformanceScores,
  type CreativeLibraryItem,
} from "@/hooks/useCreativeFolders";
import {
  Plus,
  Search,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Folder,
  FolderOpen,
  Trophy,
  Play,
  Clock,
  Archive,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  Sparkles,
  LayoutGrid,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const FOLDER_ICONS: Record<string, any> = {
  trophy: Trophy,
  play: Play,
  clock: Clock,
  archive: Archive,
  folder: Folder,
};

const RECOMMENDATION_CONFIG: Record<
  string,
  { label: string; color: string; icon: any; description: string }
> = {
  use_more: {
    label: "Usar Mais",
    color: "text-green-600 bg-green-50 border-green-200",
    icon: TrendingUp,
    description: "Alto desempenho - escalar investimento",
  },
  optimize: {
    label: "Otimizar",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: Sparkles,
    description: "Performance OK - testar variações",
  },
  test_variant: {
    label: "Testar Variação",
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    icon: LayoutGrid,
    description: "Performance mediana - criar nova versão",
  },
  pause: {
    label: "Pausar",
    color: "text-red-600 bg-red-50 border-red-200",
    icon: TrendingDown,
    description: "Baixa performance - pausar e substituir",
  },
  ready: {
    label: "Pronto",
    color: "text-gray-600 bg-gray-50 border-gray-200",
    icon: Clock,
    description: "Criativo novo - pronto para usar",
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(value: number | null, currency = "BRL") {
  if (value === null || !Number.isFinite(value)) return "—";
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

function formatPercent(value: number | null, fractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
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

function renderPreview(creative: CreativeLibraryItem) {
  if (creative.thumbnailUrl) {
    return (
      <img
        src={creative.thumbnailUrl}
        alt={creative.name}
        className="h-full w-full rounded-lg object-cover"
      />
    );
  }

  if (creative.storageUrl && creative.type !== "video") {
    return (
      <img
        src={creative.storageUrl}
        alt={creative.name}
        className="h-full w-full rounded-lg object-cover"
      />
    );
  }

  if (creative.type === "video") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
        <Video className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  if (creative.type === "text" && creative.textContent) {
    return (
      <ScrollArea className="h-full w-full rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {creative.textContent}
      </ScrollArea>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
      <FileText className="h-10 w-10 text-muted-foreground" />
    </div>
  );
}

function getScoreBadgeColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-700";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-blue-100 text-blue-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// ============================================================================
// COMPONENTS
// ============================================================================

function FolderSidebar({
  selectedFolderId,
  onSelectFolder,
}: {
  selectedFolderId: string | null | undefined;
  onSelectFolder: (folderId: string | null) => void;
}) {
  const { data: folders, isLoading } = useCreativeFolders();

  return (
    <div className="w-64 border-r bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Pastas</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        <button
          onClick={() => onSelectFolder(undefined)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
            selectedFolderId === undefined && "bg-accent font-medium",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Todos</span>
        </button>

        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
            selectedFolderId === null && "bg-accent font-medium",
          )}
        >
          <Minus className="h-4 w-4" />
          <span>Sem Pasta</span>
        </button>

        <Separator className="my-2" />

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))
        ) : (
          <>
            {folders?.map((folder) => {
              const Icon = FOLDER_ICONS[folder.icon || "folder"] || Folder;
              return (
                <button
                  key={folder.id}
                  onClick={() => onSelectFolder(folder.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                    selectedFolderId === folder.id && "bg-accent font-medium",
                  )}
                  style={{
                    color: selectedFolderId === folder.id ? folder.color || undefined : undefined,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 truncate text-left">{folder.name}</span>
                  {folder.creativeCount !== undefined && folder.creativeCount > 0 && (
                    <Badge variant="secondary" className="h-5 text-xs">
                      {folder.creativeCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function CreativeCard({ creative }: { creative: CreativeLibraryItem }) {
  const recommendationConfig = creative.recommendation
    ? RECOMMENDATION_CONFIG[creative.recommendation]
    : null;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden">
      {/* Performance Badge */}
      {creative.isTopPerformer && (
        <div className="absolute right-2 top-2 z-10">
          <Badge className="bg-green-600 text-white shadow-lg">
            <Trophy className="mr-1 h-3 w-3" />
            Top Performer
          </Badge>
        </div>
      )}

      {creative.isUnderperforming && (
        <div className="absolute right-2 top-2 z-10">
          <Badge variant="destructive" className="shadow-lg">
            <TrendingDown className="mr-1 h-3 w-3" />
            Baixa Performance
          </Badge>
        </div>
      )}

      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        {/* Preview */}
        <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          {renderPreview(creative)}
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold line-clamp-2">{creative.name}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">
                  {creative.type ? creative.type.replace("_", " ") : "Tipo indefinido"}
                </span>
                {creative.aspectRatio && <span>• {creative.aspectRatio}</span>}
                {creative.durationSeconds && (
                  <span>• {creative.durationSeconds.toFixed(0)}s</span>
                )}
                {creative.variantCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {creative.variantCount} variações
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Folder */}
          {creative.folderName && (
            <div className="flex items-center gap-1 text-xs">
              <FolderOpen className="h-3 w-3" style={{ color: creative.folderColor || undefined }} />
              <span className="text-muted-foreground">{creative.folderName}</span>
            </div>
          )}

          {/* Tags */}
          {creative.tags && creative.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {creative.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: tag.color || undefined, color: tag.color || undefined }}
                >
                  <Tag className="mr-1 h-2.5 w-2.5" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Performance Scores */}
        {creative.performanceScore !== null && (
          <div className="grid grid-cols-4 gap-2 rounded-md border p-2">
            <div className="text-center">
              <div
                className={cn("mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", getScoreBadgeColor(creative.performanceScore))}
              >
                {creative.performanceScore}
              </div>
              <p className="text-xs text-muted-foreground">Geral</p>
            </div>
            <div className="text-center">
              <div
                className={cn("mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", getScoreBadgeColor(creative.engagementScore))}
              >
                {creative.engagementScore || 0}
              </div>
              <p className="text-xs text-muted-foreground">Eng.</p>
            </div>
            <div className="text-center">
              <div
                className={cn("mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", getScoreBadgeColor(creative.conversionScore))}
              >
                {creative.conversionScore || 0}
              </div>
              <p className="text-xs text-muted-foreground">Conv.</p>
            </div>
            <div className="text-center">
              <div
                className={cn("mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", getScoreBadgeColor(creative.efficiencyScore))}
              >
                {creative.efficiencyScore || 0}
              </div>
              <p className="text-xs text-muted-foreground">Efic.</p>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid gap-2 rounded-md border p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Investimento</span>
            <span className="font-semibold">{formatCurrency(creative.totalSpend)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">CTR</span>
            <span className="font-semibold">{formatPercent(creative.avgCtr, 2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">CPC</span>
            <span className="font-semibold">{formatCurrency(creative.avgCpc)}</span>
          </div>
          {creative.avgRoas !== null && creative.avgRoas > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ROAS</span>
              <span className="font-semibold">{creative.avgRoas.toFixed(2)}x</span>
            </div>
          )}
        </div>

        {/* Recommendation */}
        {recommendationConfig && (
          <div className={cn("rounded-md border p-3", recommendationConfig.color)}>
            <div className="flex items-center gap-2">
              <recommendationConfig.icon className="h-4 w-4" />
              <span className="font-semibold text-xs">{recommendationConfig.label}</span>
            </div>
            <p className="mt-1 text-xs opacity-90">{creative.recommendationReason}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{formatBytes(creative.fileSizeBytes)}</span>
          {creative.timesUsed !== null && creative.timesUsed > 0 && (
            <span>Usado {creative.timesUsed}x</span>
          )}
          {creative.hasRecentData && (
            <Badge variant="outline" className="text-xs">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500"></span>
              Ativo
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreativesV2() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [recommendationFilter, setRecommendationFilter] = useState<string | undefined>(undefined);

  const { data: creatives, isLoading, error } = useCreativeLibraryEnhanced({
    folderId: selectedFolderId,
    tagIds: selectedTagIds,
    search: searchTerm,
    recommendation: recommendationFilter,
  });

  const { data: tags } = useCreativeTags();
  const calculateScores = useCalculatePerformanceScores();

  const sortedCreatives = useMemo(() => {
    if (!creatives) return [];

    return [...creatives].sort((a, b) => {
      // Top performers first
      if (a.isTopPerformer && !b.isTopPerformer) return -1;
      if (!a.isTopPerformer && b.isTopPerformer) return 1;

      // Then by performance score
      const scoreA = a.performanceScore || 0;
      const scoreB = b.performanceScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;

      // Then by spend
      const spendA = a.totalSpend || 0;
      const spendB = b.totalSpend || 0;
      return spendB - spendA;
    });
  }, [creatives]);

  const stats = useMemo(() => {
    if (!creatives) return { total: 0, topPerformers: 0, underperforming: 0, ready: 0 };

    return {
      total: creatives.length,
      topPerformers: creatives.filter((c) => c.isTopPerformer).length,
      underperforming: creatives.filter((c) => c.isUnderperforming).length,
      ready: creatives.filter((c) => c.recommendation === "ready").length,
    };
  }, [creatives]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <FolderSidebar selectedFolderId={selectedFolderId} onSelectFolder={setSelectedFolderId} />

      {/* Main Content */}
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Biblioteca de Criativos</h1>
            <p className="text-muted-foreground mt-1">
              Organize seus criativos por pastas e acompanhe performance
            </p>
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>Total: {stats.total}</span>
              <span className="text-green-600">Top: {stats.topPerformers}</span>
              <span className="text-red-600">Baixa: {stats.underperforming}</span>
              <span>Prontos: {stats.ready}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => calculateScores.mutate()}
              disabled={calculateScores.isPending}
            >
              {calculateScores.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Recalcular Scores
            </Button>
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

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar criativos..."
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {Object.entries(RECOMMENDATION_CONFIG).map(([key, config]) => (
                <Badge
                  key={key}
                  variant={recommendationFilter === key ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setRecommendationFilter(recommendationFilter === key ? undefined : key)
                  }
                >
                  <config.icon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tags Filter */}
        {tags && tags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedTagIds((prev) =>
                      prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                    );
                  }}
                  style={{
                    borderColor: tag.color || undefined,
                    color: selectedTagIds.includes(tag.id) ? "white" : tag.color || undefined,
                    backgroundColor: selectedTagIds.includes(tag.id)
                      ? tag.color || undefined
                      : undefined,
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro ao carregar criativos</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
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
        )}

        {/* Empty */}
        {!isLoading && sortedCreatives.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10" />
              <p>Nenhum criativo encontrado para os filtros selecionados.</p>
            </CardContent>
          </Card>
        )}

        {/* Grid */}
        {!isLoading && sortedCreatives.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedCreatives.map((creative) => (
              <CreativeCard key={creative.id} creative={creative} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGroupedCreatives, type CreativeGroup } from "@/hooks/useGroupedCreatives";
import { type CreativeOverview } from "@/hooks/useCreativeLibrary";
import {
  Plus,
  Search,
  Upload,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Video,
  FileText,
  Folder,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// HELPERS
// ============================================================================

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

function renderPreview(creative: CreativeOverview, size: "sm" | "md" | "lg" = "md") {
  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "aspect-video w-full",
  };

  if (creative.thumbnailUrl) {
    return (
      <img
        src={creative.thumbnailUrl}
        alt={creative.name}
        className={cn("rounded-lg object-cover", sizeClasses[size])}
      />
    );
  }

  if (creative.storageUrl && creative.type !== "video") {
    return (
      <img
        src={creative.storageUrl}
        alt={creative.name}
        className={cn("rounded-lg object-cover", sizeClasses[size])}
      />
    );
  }

  if (creative.type === "video") {
    return (
      <div className={cn("flex items-center justify-center rounded-lg bg-muted", sizeClasses[size])}>
        <Video className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (creative.type === "text" && creative.textContent) {
    return (
      <ScrollArea className={cn("rounded-lg border bg-muted/40 p-2 text-xs", sizeClasses[size])}>
        {creative.textContent.slice(0, 100)}...
      </ScrollArea>
    );
  }

  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-muted", sizeClasses[size])}>
      <FileText className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function CreativeGroupCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: CreativeGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasMultipleVariants = group.totalVariants > 1;

  return (
    <Card className={cn("overflow-hidden transition-all", isExpanded && "ring-2 ring-primary/20")}>
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="flex-shrink-0">
            {renderPreview(group.mainCreative, "md")}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {hasMultipleVariants && (
                    <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <h3 className="font-semibold truncate">{group.groupName}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasMultipleVariants ? (
                    <>
                      {group.totalVariants} variações • {group.totalAdsCount} anúncios • {group.totalCampaignCount}{" "}
                      campanhas
                    </>
                  ) : (
                    <>
                      {group.totalAdsCount} anúncios • {group.totalCampaignCount} campanhas
                    </>
                  )}
                </p>
              </div>

              {hasMultipleVariants && (
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Investimento</p>
                <p className="font-semibold">{formatCurrency(group.aggregatedMetrics.totalSpend)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CTR Médio</p>
                <p className="font-semibold">{formatPercent(group.aggregatedMetrics.avgCtr, 1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Melhor CTR</p>
                <p className="font-semibold text-green-600">{formatPercent(group.aggregatedMetrics.bestCtr, 1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversões</p>
                <p className="font-semibold">{formatNumber(group.aggregatedMetrics.totalConversions)}</p>
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content - Variações */}
      {isExpanded && hasMultipleVariants && (
        <div className="border-t bg-muted/30 p-4 space-y-2">
          <h4 className="text-sm font-medium mb-3">Variações ({group.totalVariants})</h4>

          <div className="space-y-2">
            {group.variants.map((variant, index) => (
              <div
                key={variant.id}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 hover:bg-accent/50 transition-colors"
              >
                {/* Preview small */}
                <div className="flex-shrink-0">
                  {renderPreview(variant, "sm")}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                    {variant.aspectRatio && (
                      <Badge variant="outline" className="text-xs">
                        {variant.aspectRatio}
                      </Badge>
                    )}
                    {index === 0 && (
                      <Badge className="text-xs bg-green-600">Melhor</Badge>
                    )}
                  </div>
                  <p className="text-sm truncate">{variant.name}</p>
                </div>

                {/* Metrics */}
                <div className="flex gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-muted-foreground">CTR</p>
                    <p className="font-medium">{formatPercent(variant.metrics.ctr, 1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">CPC</p>
                    <p className="font-medium">{formatCurrency(variant.metrics.cpc ?? 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Gasto</p>
                    <p className="font-medium">{formatCurrency(variant.metrics.spend)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Anúncios</p>
                    <p className="font-medium">{variant.adsCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreativesGrouped() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "all">("grouped");

  const { groups, stats, isLoading, error } = useGroupedCreatives({ days: 30 });

  // Debug: Log groups on mount
  React.useEffect(() => {
    if (groups.length > 0) {
      console.log('[CreativesGrouped] Total groups:', groups.length);
      console.log('[CreativesGrouped] Groups with multiple variants:',
        groups.filter(g => g.totalVariants > 1).length);
      console.log('[CreativesGrouped] Sample groups:',
        groups.slice(0, 3).map(g => ({
          id: g.id,
          name: g.groupName,
          variants: g.totalVariants,
          creatives: g.variants.map(v => v.name)
        }))
      );
    }
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;

    const term = searchTerm.toLowerCase();
    return groups.filter((group) => {
      return (
        group.groupName.toLowerCase().includes(term) ||
        group.variants.some((v) => v.name.toLowerCase().includes(term))
      );
    });
  }, [groups, searchTerm]);

  function toggleGroup(groupId: string) {
    console.log('[CreativesGrouped] Toggling group:', groupId);
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        console.log('[CreativesGrouped] Collapsing group:', groupId);
        next.delete(groupId);
      } else {
        console.log('[CreativesGrouped] Expanding group:', groupId);
        next.add(groupId);
      }
      console.log('[CreativesGrouped] New expanded groups:', Array.from(next));
      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(new Set(filteredGroups.map((g) => g.id)));
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Biblioteca de Criativos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus criativos organizados por grupo e variações
          </p>
          {!isLoading && (
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{stats.totalGroups}</span> grupos
              </span>
              <span>
                <span className="font-medium text-foreground">{stats.totalCreatives}</span> criativos
              </span>
              <span>
                <span className="font-medium text-foreground">{stats.groupsWithMultipleVariants}</span> com variações
              </span>
              <span>
                Média: <span className="font-medium text-foreground">{stats.avgVariantsPerGroup.toFixed(1)}</span>{" "}
                variações/grupo
              </span>
            </div>
          )}
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

      {/* Filters and controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar criativos..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir Todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Recolher Todos
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button
            variant={viewMode === "grouped" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grouped")}
          >
            <Folder className="mr-2 h-4 w-4" />
            Agrupados
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Todos
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Erro ao carregar criativos: {error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <div className="h-12 bg-muted rounded animate-pulse" />
                      <div className="h-12 bg-muted rounded animate-pulse" />
                      <div className="h-12 bg-muted rounded animate-pulse" />
                      <div className="h-12 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Creative groups */}
      {!isLoading && !error && filteredGroups.length > 0 && (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <CreativeGroupCard
              key={group.id}
              group={group}
              isExpanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredGroups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm ? "Nenhum criativo encontrado para os filtros selecionados." : "Nenhum criativo encontrado."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

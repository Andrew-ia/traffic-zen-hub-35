import { useMemo } from "react";
import { useCreativeLibrary, type CreativeOverview } from "./useCreativeLibrary";

export interface CreativeGroup {
  id: string; // ID do criativo principal (primeiro da lista)
  groupName: string; // Nome do grupo (baseado no nome comum)
  mainCreative: CreativeOverview; // Criativo principal (melhor performance ou primeiro)
  variants: CreativeOverview[]; // Todas as variações
  totalVariants: number;

  // Métricas agregadas do grupo
  aggregatedMetrics: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    avgCtr: number | null;
    avgCpc: number | null;
    bestCtr: number | null;
    bestRoas: number | null;
  };

  // Contadores
  totalAdsCount: number;
  totalAdSetsCount: number;
  totalCampaignCount: number;
}

/**
 * Agrupa criativos similares baseado no nome
 * Remove sufixos como " - 1:1", " - 9:16", " (1)", IDs únicos, etc
 */
function extractBaseName(name: string): string {
  let baseName = name;

  // Remove IDs hexadecimais longos (32+ caracteres) do final
  // Ex: "2025-10-22-481b1e449066a8a1335bb3b21a05f878" → "2025-10-22"
  baseName = baseName.replace(/[-_][a-f0-9]{32,}\s*$/i, '');

  // Remove UUIDs (8-4-4-4-12 formato)
  baseName = baseName.replace(/[-_][a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\s*$/i, '');

  // Remove timestamps e IDs numéricos longos (10+ dígitos)
  baseName = baseName.replace(/[-_]\d{10,}\s*$/i, '');

  // Remove aspect ratios comuns
  baseName = baseName
    .replace(/\s*-\s*(1:1|9:16|16:9|4:5|1080x1080|1080x1920|1920x1080)\s*$/i, '')
    .replace(/\s*\((1:1|9:16|16:9|4:5)\)\s*$/i, '')
    .replace(/\s*\[\s*(1:1|9:16|16:9|4:5)\s*\]\s*$/i, '');

  // Remove números entre parênteses no final: " (1)", " (2)"
  baseName = baseName.replace(/\s*\(\d+\)\s*$/,  '');

  // Remove números com traço no final: " - 1", " - 2"
  baseName = baseName.replace(/\s*-\s*\d+\s*$/, '');

  // Remove "quadrado", "vertical", "horizontal"
  baseName = baseName.replace(/\s*(quadrado|vertical|horizontal|story|stories|feed)\s*$/i, '');

  return baseName.trim();
}

/**
 * Agrupa criativos por nome base similar
 */
function groupCreatives(creatives: CreativeOverview[]): CreativeGroup[] {
  const groups = new Map<string, CreativeOverview[]>();

  console.log('[useGroupedCreatives] Grouping', creatives.length, 'creatives');

  // Agrupar por nome base
  for (const creative of creatives) {
    const baseName = extractBaseName(creative.name);
    const existing = groups.get(baseName) || [];
    existing.push(creative);
    groups.set(baseName, existing);

    // Debug: Log first 3 creative name transformations
    if (groups.size <= 3) {
      console.log('[useGroupedCreatives] Grouped:', {
        original: creative.name,
        baseName,
        groupSize: existing.length
      });
    }
  }

  console.log('[useGroupedCreatives] Created', groups.size, 'groups from', creatives.length, 'creatives');

  // Converter para CreativeGroup[]
  const result: CreativeGroup[] = [];

  for (const [groupName, variants] of groups.entries()) {
    // Ordenar variantes por performance (CTR ou spend)
    const sortedVariants = [...variants].sort((a, b) => {
      // Priorizar por CTR primeiro
      if (a.metrics.ctr !== null && b.metrics.ctr !== null) {
        if (Math.abs(b.metrics.ctr - a.metrics.ctr) > 0.1) {
          return b.metrics.ctr - a.metrics.ctr;
        }
      }
      // Depois por spend
      return b.metrics.spend - a.metrics.spend;
    });

    const mainCreative = sortedVariants[0];

    // Calcular métricas agregadas
    const totalSpend = variants.reduce((sum, v) => sum + v.metrics.spend, 0);
    const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);
    const totalClicks = variants.reduce((sum, v) => sum + v.metrics.clicks, 0);
    const totalConversions = variants.reduce((sum, v) => sum + v.metrics.conversions, 0);
    const totalRevenue = variants.reduce((sum, v) => sum + v.metrics.revenue, 0);

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : null;

    const ctrs = variants.map(v => v.metrics.ctr).filter(ctr => ctr !== null) as number[];
    const roas = variants.map(v => v.metrics.roas).filter(r => r !== null) as number[];

    const bestCtr = ctrs.length > 0 ? Math.max(...ctrs) : null;
    const bestRoas = roas.length > 0 ? Math.max(...roas) : null;

    const totalAdsCount = variants.reduce((sum, v) => sum + v.adsCount, 0);
    const totalAdSetsCount = variants.reduce((sum, v) => sum + v.adSetsCount, 0);
    const totalCampaignCount = new Set(
      variants.flatMap(v => Array(v.campaignCount).fill(0).map((_, i) => `${v.id}-${i}`))
    ).size;

    result.push({
      id: mainCreative.id,
      groupName,
      mainCreative,
      variants: sortedVariants,
      totalVariants: variants.length,
      aggregatedMetrics: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        avgCtr,
        avgCpc,
        bestCtr,
        bestRoas,
      },
      totalAdsCount,
      totalAdSetsCount,
      totalCampaignCount,
    });
  }

  // Ordenar grupos por spend total (maior primeiro)
  return result.sort((a, b) => b.aggregatedMetrics.totalSpend - a.aggregatedMetrics.totalSpend);
}

/**
 * Hook que retorna criativos agrupados
 */
export function useGroupedCreatives(options: { days?: number; platformKey?: string } = {}) {
  const { data: creatives, isLoading, error } = useCreativeLibrary(options);

  const groups = useMemo(() => {
    if (!creatives || creatives.length === 0) return [];
    return groupCreatives(creatives);
  }, [creatives]);

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      totalCreatives: creatives?.length || 0,
      groupsWithMultipleVariants: groups.filter(g => g.totalVariants > 1).length,
      avgVariantsPerGroup: groups.length > 0
        ? groups.reduce((sum, g) => sum + g.totalVariants, 0) / groups.length
        : 0,
    };
  }, [groups, creatives]);

  return {
    groups,
    stats,
    isLoading,
    error,
  };
}

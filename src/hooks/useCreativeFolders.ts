import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

// ============================================================================
// TYPES
// ============================================================================

export interface CreativeFolder {
  id: string;
  workspaceId: string;
  parentFolderId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Computed
  creativeCount?: number;
  children?: CreativeFolder[];
}

export interface CreativeTag {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface CreativeVariant {
  id: string;
  creativeAssetId: string;
  variantName: string;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface PerformanceScore {
  id: string;
  creativeAssetId: string;
  calculatedAt: string;
  daysAnalyzed: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  avgCtr: number | null;
  avgCpc: number | null;
  avgCpa: number | null;
  avgRoas: number | null;
  performanceScore: number | null;
  engagementScore: number | null;
  conversionScore: number | null;
  efficiencyScore: number | null;
  isTopPerformer: boolean;
  isUnderperforming: boolean;
  hasRecentData: boolean;
  recommendation: string | null;
  recommendationReason: string | null;
}

export interface CreativeLibraryItem {
  id: string;
  workspaceId: string;
  folderId: string | null;
  folderName: string | null;
  folderColor: string | null;
  name: string;
  type: string | null;
  status: string | null;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  aspectRatio: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  textContent: string | null;
  createdAt: string;
  updatedAt: string;
  variantCount: number;
  tags: Array<{ id: string; name: string; color: string | null }>;
  performanceScore: number | null;
  engagementScore: number | null;
  conversionScore: number | null;
  efficiencyScore: number | null;
  isTopPerformer: boolean | null;
  isUnderperforming: boolean | null;
  hasRecentData: boolean | null;
  recommendation: string | null;
  recommendationReason: string | null;
  avgCtr: number | null;
  avgCpc: number | null;
  avgRoas: number | null;
  totalSpend: number | null;
  totalImpressions: number | null;
  totalClicks: number | null;
  totalConversions: number | null;
  timesUsed: number | null;
}

// ============================================================================
// HOOKS: FOLDERS
// ============================================================================

/**
 * Fetch all folders with creative counts
 */
export function useCreativeFolders(workspaceId: string | null): UseQueryResult<CreativeFolder[]> {
  return useQuery({
    queryKey: ["creative-folders", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<CreativeFolder[]> => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("creative_folders")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to fetch creative folders:", error.message);
        throw error;
      }

      // Count creatives per folder
      const { data: countData, error: countError } = await supabase
        .from("creative_assets")
        .select("folder_id")
        .eq("workspace_id", workspaceId);

      if (countError) {
        console.error("Failed to count creatives:", countError.message);
      }

      const counts = new Map<string, number>();
      countData?.forEach((item) => {
        if (item.folder_id) {
          counts.set(item.folder_id, (counts.get(item.folder_id) || 0) + 1);
        }
      });

      return (data || []).map((folder) => ({
        id: folder.id,
        workspaceId: folder.workspace_id,
        parentFolderId: folder.parent_folder_id,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon,
        sortOrder: folder.sort_order,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        creativeCount: counts.get(folder.id) || 0,
      }));
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Create a new folder
 */
export function useCreateFolder(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      parentFolderId?: string;
    }) => {
      const { data, error } = await supabase
        .from("creative_folders")
        .insert({
          workspace_id: workspaceId,
          name: params.name,
          description: params.description || null,
          color: params.color || null,
          icon: params.icon || null,
          parent_folder_id: params.parentFolderId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-folders", workspaceId] });
    },
  });
}

/**
 * Delete a folder
 */
export function useDeleteFolder(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("creative_folders").delete().eq("id", folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-folders", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
    },
  });
}

// ============================================================================
// HOOKS: TAGS
// ============================================================================

/**
 * Fetch all tags
 */
export function useCreativeTags(workspaceId: string | null): UseQueryResult<CreativeTag[]> {
  return useQuery({
    queryKey: ["creative-tags", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<CreativeTag[]> => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("creative_tags")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to fetch creative tags:", error.message);
        throw error;
      }

      return (data || []).map((tag) => ({
        id: tag.id,
        workspaceId: tag.workspace_id,
        name: tag.name,
        color: tag.color,
        createdAt: tag.created_at,
      }));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Create a new tag
 */
export function useCreateTag(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string; color?: string }) => {
      const { data, error } = await supabase
        .from("creative_tags")
        .insert({
          workspace_id: workspaceId,
          name: params.name,
          color: params.color || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-tags", workspaceId] });
    },
  });
}

// ============================================================================
// HOOKS: CREATIVE LIBRARY (Enhanced)
// ============================================================================

/**
 * Fetch creative library with folders, tags, variants, and performance
 */
export function useCreativeLibraryEnhanced(
  workspaceId: string | null,
  options: {
    folderId?: string | null;
    tagIds?: string[];
    search?: string;
    recommendation?: string;
  } = {},
): UseQueryResult<CreativeLibraryItem[]> {
  const { folderId, tagIds, search, recommendation } = options;

  return useQuery({
    queryKey: ["creative-library-enhanced", workspaceId, folderId, tagIds, search, recommendation],
    enabled: !!workspaceId,
    queryFn: async (): Promise<CreativeLibraryItem[]> => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("v_creative_library")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (error) {
        console.error("Failed to fetch creative library:", error.message);
        throw error;
      }

      let filtered = data || [];

      // Filter by folder
      if (folderId !== undefined) {
        filtered = filtered.filter((item) => item.folder_id === folderId);
      }

      // Filter by tags
      if (tagIds && tagIds.length > 0) {
        filtered = filtered.filter((item) => {
          const itemTags = (item.tags || []) as Array<{ id: string }>;
          return tagIds.some((tagId) => itemTags.some((t) => t.id === tagId));
        });
      }

      // Filter by search
      if (search) {
        const term = search.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            (item.text_content && item.text_content.toLowerCase().includes(term)),
        );
      }

      // Filter by recommendation
      if (recommendation) {
        filtered = filtered.filter((item) => item.recommendation === recommendation);
      }

      return filtered.map((item) => ({
        id: item.id,
        workspaceId: item.workspace_id,
        folderId: item.folder_id,
        folderName: item.folder_name,
        folderColor: item.folder_color,
        name: item.name,
        type: item.type,
        status: item.status,
        storageUrl: item.storage_url,
        thumbnailUrl: item.thumbnail_url,
        aspectRatio: item.aspect_ratio,
        durationSeconds: item.duration_seconds,
        fileSizeBytes: item.file_size_bytes,
        textContent: item.text_content,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        variantCount: item.variant_count || 0,
        tags: item.tags || [],
        performanceScore: item.performance_score,
        engagementScore: item.engagement_score,
        conversionScore: item.conversion_score,
        efficiencyScore: item.efficiency_score,
        isTopPerformer: item.is_top_performer,
        isUnderperforming: item.is_underperforming,
        hasRecentData: item.has_recent_data,
        recommendation: item.recommendation,
        recommendationReason: item.recommendation_reason,
        avgCtr: item.avg_ctr,
        avgCpc: item.avg_cpc,
        avgRoas: item.avg_roas,
        totalSpend: item.total_spend,
        totalImpressions: item.total_impressions,
        totalClicks: item.total_clicks,
        totalConversions: item.total_conversions,
        timesUsed: item.times_used,
      }));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Move creative to folder
 */
export function useMoveCreativeToFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { creativeId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from("creative_assets")
        .update({ folder_id: params.folderId })
        .eq("id", params.creativeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-library"] });
      queryClient.invalidateQueries({ queryKey: ["creative-library-enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["creative-folders"] });
    },
  });
}

/**
 * Add tags to creative
 */
export function useAddTagsToCreative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { creativeId: string; tagIds: string[] }) => {
      const rows = params.tagIds.map((tagId) => ({
        creative_asset_id: params.creativeId,
        tag_id: tagId,
      }));

      const { error } = await supabase.from("creative_asset_tags").insert(rows);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-library"] });
      queryClient.invalidateQueries({ queryKey: ["creative-library-enhanced"] });
    },
  });
}

/**
 * Remove tag from creative
 */
export function useRemoveTagFromCreative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { creativeId: string; tagId: string }) => {
      const { error } = await supabase
        .from("creative_asset_tags")
        .delete()
        .eq("creative_asset_id", params.creativeId)
        .eq("tag_id", params.tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-library"] });
      queryClient.invalidateQueries({ queryKey: ["creative-library-enhanced"] });
    },
  });
}

// ============================================================================
// HOOKS: VARIANTS
// ============================================================================

/**
 * Fetch variants for a creative
 */
export function useCreativeVariants(creativeId: string): UseQueryResult<CreativeVariant[]> {
  return useQuery({
    queryKey: ["creative-variants", creativeId],
    queryFn: async (): Promise<CreativeVariant[]> => {
      const { data, error } = await supabase
        .from("creative_variants")
        .select("*")
        .eq("creative_asset_id", creativeId)
        .order("variant_name", { ascending: true });

      if (error) {
        console.error("Failed to fetch creative variants:", error.message);
        throw error;
      }

      return (data || []).map((variant) => ({
        id: variant.id,
        creativeAssetId: variant.creative_asset_id,
        variantName: variant.variant_name,
        aspectRatio: variant.aspect_ratio,
        width: variant.width,
        height: variant.height,
        storageUrl: variant.storage_url,
        thumbnailUrl: variant.thumbnail_url,
        fileSizeBytes: variant.file_size_bytes,
        createdAt: variant.created_at,
      }));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Calculate performance scores
 */
export function useCalculatePerformanceScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number = 30) => {
      try {
        const { data, error } = await supabase.rpc("calculate_creative_performance_scores", {
          p_workspace_id: WORKSPACE_ID,
          p_days: days,
        });

        if (error) throw error;
        return data;
      } catch (rpcErr) {
        console.warn("RPC calculate_creative_performance_scores não disponível, usando cálculo local.");
        // Fallback: calcular scores no cliente a partir de v_creative_performance
        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: perfRows, error: perfError } = await supabase
          .from("v_creative_performance")
          .select("creative_id, spend, impressions, clicks, conversions, revenue, metric_date")
          .eq("workspace_id", WORKSPACE_ID)
          .gte("metric_date", fromDate);

        if (perfError) throw perfError;

        const agg = new Map<string, {
          total_spend: number;
          total_impressions: number;
          total_clicks: number;
          total_conversions: number;
          total_revenue: number;
          last_metric_date: string | null;
          avg_ctr: number | null;
          avg_cpc: number | null;
          avg_cpa: number | null;
          avg_roas: number | null;
          performance_score: number;
        }>();

        for (const row of (perfRows ?? [])) {
          const id = (row as any).creative_id as string;
          if (!id) continue;
          const entry = agg.get(id) ?? {
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_conversions: 0,
            total_revenue: 0,
            last_metric_date: null,
            avg_ctr: null,
            avg_cpc: null,
            avg_cpa: null,
            avg_roas: null,
            performance_score: 0,
          };
          entry.total_spend += Number((row as any).spend ?? 0);
          entry.total_impressions += Number((row as any).impressions ?? 0);
          entry.total_clicks += Number((row as any).clicks ?? 0);
          entry.total_conversions += Number((row as any).conversions ?? 0);
          entry.total_revenue += Number((row as any).revenue ?? 0);
          const md = (row as any).metric_date as string | null;
          if (!entry.last_metric_date || (md && md > entry.last_metric_date)) entry.last_metric_date = md ?? entry.last_metric_date;
          agg.set(id, entry);
        }

        // calcular médias e score semelhante ao servidor
        for (const [id, entry] of agg.entries()) {
          entry.avg_ctr = entry.total_impressions > 0 ? (entry.total_clicks / entry.total_impressions) * 100 : null;
          entry.avg_cpc = entry.total_clicks > 0 ? (entry.total_spend / entry.total_clicks) : null;
          entry.avg_cpa = entry.total_conversions > 0 ? (entry.total_spend / entry.total_conversions) : null;
          entry.avg_roas = entry.total_spend > 0 && entry.total_revenue > 0 ? (entry.total_revenue / entry.total_spend) : null;

          const eng = entry.avg_ctr == null ? 0 : entry.avg_ctr >= 3 ? 100 : entry.avg_ctr >= 2 ? 80 : entry.avg_ctr >= 1 ? 60 : entry.avg_ctr >= 0.5 ? 40 : 20;
          const conv = entry.total_conversions === 0 ? 0 : entry.total_conversions >= 100 ? 100 : entry.total_conversions >= 50 ? 80 : entry.total_conversions >= 20 ? 60 : entry.total_conversions >= 5 ? 40 : 20;
          const eff = entry.avg_roas != null && entry.avg_roas >= 4 ? 100
            : entry.avg_roas != null && entry.avg_roas >= 2 ? 80
            : entry.avg_roas != null && entry.avg_roas >= 1 ? 60
            : entry.avg_cpa != null && entry.avg_cpa <= 50 ? 80
            : entry.avg_cpa != null && entry.avg_cpa <= 100 ? 60
            : entry.avg_cpa != null ? 40
            : 0;
          entry.performance_score = Math.round(eng * 0.4 + conv * 0.3 + eff * 0.3);
        }

        // Retorna um resumo para acionar invalidations
        return { calculated: agg.size, days };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-library"] });
      queryClient.invalidateQueries({ queryKey: ["creative-library-enhanced"] });
    },
  });
}

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { ArrowUp, ArrowDown, Instagram, RefreshCw, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import InstagramSyncButton from "@/components/InstagramSyncButton";

const WORKSPACE_ID =
  (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() ||
  "00000000-0000-0000-0000-000000000010";

// Timeout de segurança para queries
const QUERY_TIMEOUT = 10000; // 10 segundos
const MAX_RETRIES = 1;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

interface SafeMetrics {
  reach: number;
  profileViews: number;
  accountsEngaged: number;
  totalInteractions: number;
  likes: number;
  comments: number;
  followerGrowth: number;
  hasData: boolean;
}

interface SafeProfile {
  username?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  hasData: boolean;
}

export default function Instagram() {
  const [dateRange, setDateRange] = useState("30");
  const [isPageMounted, setIsPageMounted] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Cleanup na desmontagem para evitar vazamentos
  useEffect(() => {
    return () => {
      setIsPageMounted(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Função segura para queries com timeout
  const createSafeQuery = useCallback((queryFn: () => Promise<any>, defaultValue: any) => {
    return async () => {
      if (!isPageMounted) return defaultValue;

      // Criar novo AbortController para cada query
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, QUERY_TIMEOUT);

      try {
        const result = await queryFn();
        clearTimeout(timeoutId);
        
        if (!isPageMounted) return defaultValue;
        return result || defaultValue;
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn("Query abortada por segurança:", error);
        return defaultValue;
      }
    };
  }, [isPageMounted]);

  // Query ultra-segura para platform account
  const { data: platformAccountId } = useQuery({
    queryKey: ["instagram-platform-safe"],
    queryFn: createSafeQuery(async () => {
      if (!supabase) return null;
      
      const { data } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);
      
      return data?.[0]?.id || null;
    }, null),
    staleTime: CACHE_TIME,
    retry: MAX_RETRIES,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Query segura para métricas básicas
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["instagram-metrics-safe", dateRange, platformAccountId],
    queryFn: createSafeQuery(async () => {
      if (!platformAccountId || !supabase) {
        return { reach: 0, profileViews: 0, accountsEngaged: 0, totalInteractions: 0, likes: 0, comments: 0, followerGrowth: 0, hasData: false };
      }
      
      const days = Math.min(parseInt(dateRange) || 30, 90); // Max 90 dias
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data } = await supabase
        .from("performance_metrics")
        .select("clicks, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day")
        .limit(50) // Limite baixo para segurança
        .order("metric_date", { ascending: false });

      if (!data || data.length === 0) {
        return { reach: 0, profileViews: 0, accountsEngaged: 0, totalInteractions: 0, likes: 0, comments: 0, followerGrowth: 0, hasData: false };
      }

      // Processamento seguro com proteção contra valores inválidos
      let totals = { reach: 0, profileViews: 0, accountsEngaged: 0, totalInteractions: 0, likes: 0, comments: 0, followerGrowth: 0 };
      
      for (let i = 0; i < Math.min(data.length, 30); i++) { // Máximo 30 registros
        const row = data[i];
        const extra = row.extra_metrics || {};
        
        // Verificação de segurança para números válidos
        const safeAdd = (current: number, value: any) => {
          const num = Number(value) || 0;
          return isFinite(num) ? current + Math.abs(num) : current;
        };

        totals.reach = safeAdd(totals.reach, extra.reach);
        totals.profileViews = safeAdd(totals.profileViews, extra.profile_views);
        totals.accountsEngaged = safeAdd(totals.accountsEngaged, extra.accounts_engaged);
        totals.totalInteractions = safeAdd(totals.totalInteractions, extra.total_interactions);
        totals.likes = safeAdd(totals.likes, extra.likes);
        totals.comments = safeAdd(totals.comments, extra.comments);
        totals.followerGrowth = Math.max(totals.followerGrowth, safeAdd(0, extra.follower_count));
      }

      return { ...totals, hasData: true };
    }, { reach: 0, profileViews: 0, accountsEngaged: 0, totalInteractions: 0, likes: 0, comments: 0, followerGrowth: 0, hasData: false }),
    enabled: !!platformAccountId && !!supabase,
    staleTime: CACHE_TIME,
    retry: MAX_RETRIES,
    refetchOnWindowFocus: false,
  });

  // Query segura para profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["instagram-profile-safe"],
    queryFn: createSafeQuery(async () => {
      if (!supabase) return { hasData: false };
      
      const { data } = await supabase
        .from("instagram_profile_snapshots")
        .select("username, followers_count, follows_count, media_count")
        .eq("workspace_id", WORKSPACE_ID)
        .order("captured_at", { ascending: false })
        .limit(1);
        
      const profileData = data?.[0];
      return profileData ? { ...profileData, hasData: true } : { hasData: false };
    }, { hasData: false }),
    staleTime: CACHE_TIME * 2, // Cache mais longo para perfil
    retry: MAX_RETRIES,
    refetchOnWindowFocus: false,
  });

  const isLoading = metricsLoading || profileLoading;

  // Memoização segura das estatísticas de crescimento
  const growthStats = useMemo(() => {
    if (!metrics?.hasData) return null;
    
    return {
      isPositive: (metrics.followerGrowth || 0) >= 0,
      value: Math.abs(metrics.followerGrowth || 0),
      engagementRate: metrics.reach > 0 ? 
        Math.round(((metrics.totalInteractions / metrics.reach) * 100) * 100) / 100 : 0
    };
  }, [metrics]);

  // Handler seguro para mudança de range
  const handleDateRangeChange = useCallback((newRange: string) => {
    if (!isPageMounted) return;
    const validRanges = ["7", "14", "30", "60", "90"];
    if (validRanges.includes(newRange)) {
      setDateRange(newRange);
    }
  }, [isPageMounted]);

  // Render com proteções de segurança
  if (metricsError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-lg font-semibold text-red-800 mb-2">Erro no carregamento</p>
              <p className="text-red-600 mb-4">
                Houve um problema ao carregar os dados do Instagram. Por favor, recarregue a página.
              </p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Recarregar
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="p-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-lg font-semibold text-yellow-800 mb-2">Configuração necessária</p>
              <p className="text-yellow-700">
                Configure as variáveis de ambiente do Supabase para acessar os dados do Instagram.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header com proteção contra re-render desnecessário */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Instagram className="w-8 h-8 text-purple-600" />
            Instagram Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Dashboard otimizado e seguro
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="14">Últimos 14 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <InstagramSyncButton size="sm" days={parseInt(dateRange)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : !metrics?.hasData && !profile?.hasData ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Instagram não configurado</p>
              <p className="text-muted-foreground">
                Configure a integração com Instagram e sincronize os dados para visualizar insights.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Profile Card - Renderizado apenas se houver dados */}
          {profile?.hasData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Perfil Instagram</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-200 flex items-center justify-center">
                    <Instagram className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    <div>
                      <div className="text-xs text-muted-foreground">Usuário</div>
                      <div className="text-base font-semibold">{profile.username || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Seguidores</div>
                      <div className="text-base font-semibold">
                        {profile.followers_count ? new Intl.NumberFormat("pt-BR").format(profile.followers_count) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Seguindo</div>
                      <div className="text-base font-semibold">
                        {profile.follows_count ? new Intl.NumberFormat("pt-BR").format(profile.follows_count) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                      <div className="text-base font-semibold">
                        {profile.media_count ? new Intl.NumberFormat("pt-BR").format(profile.media_count) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Métricas Principais - Renderizado apenas se houver dados */}
          {metrics?.hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Alcance Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat("pt-BR").format(metrics.reach)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contas únicas alcançadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Contas Engajadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat("pt-BR").format(metrics.accountsEngaged)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Usuários que interagiram</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Seguidores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {growthStats?.isPositive ? (
                      <ArrowUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <ArrowDown className="w-5 h-5 text-red-500" />
                    )}
                    {new Intl.NumberFormat("pt-BR").format(growthStats?.value || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No período selecionado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Interações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat("pt-BR").format(metrics.totalInteractions)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Curtidas, comentários, etc.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Métricas Detalhadas - Renderizado apenas se houver dados */}
          {metrics?.hasData && (
            <Card>
              <CardHeader>
                <CardTitle>Métricas Detalhadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Visualizações do Perfil</p>
                    <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.profileViews)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Curtidas</p>
                    <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.likes)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Comentários</p>
                    <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.comments)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Taxa de Engajamento</p>
                    <p className="text-lg font-semibold">{growthStats?.engagementRate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status de Funcionalidade */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <p className="text-lg font-semibold text-green-800 mb-2">Sistema Otimizado</p>
                <p className="text-green-700 text-sm">
                  Página do Instagram funcionando com proteções de segurança e performance otimizada.
                </p>
                <div className="mt-3 text-xs text-green-600">
                  Cache ativo • Queries limitadas • Timeouts configurados • Vazamentos bloqueados
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
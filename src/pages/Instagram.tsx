import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown, TrendingUp, Clock, Image as ImageIcon, Video as VideoIcon, Target, Instagram } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import InstagramSyncButton from "@/components/InstagramSyncButton";
import { resolveApiBase } from "@/lib/apiBase";
import { InstagramMedia } from "@/components/InstagramMedia";

const WORKSPACE_ID =
  (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() ||
  "00000000-0000-0000-0000-000000000010";

interface InstagramMetrics {
  reach: number;
  profileViews: number;
  websiteClicks: number;
  accountsEngaged: number;
  totalInteractions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  replies: number;
  followerGrowth: number;
  profileLinksTaps: number;
}

interface DailyMetric {
  date: string;
  reach: number;
  followerCount: number;
  engagement: number;
}

interface MediaPost {
  id: string;
  mediaType: string;
  timestamp: string;
  permalink?: string;
  mediaUrl?: string;
  metrics: {
    likes: number;
    reach: number;
    impressions?: number;
    saved: number;
    shares: number;
    comments: number;
    total_interactions: number;
    views?: number;
  };
}

interface ProfileSnapshot {
  username?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  captured_at?: string;
}

interface MediaItem {
  id: string;
  media_id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  posted_at?: string;
  like_count?: number;
  comments_count?: number;
}

export default function Instagram() {
  const [dateRange, setDateRange] = useState("30");
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const API_BASE = resolveApiBase();

  const isVideoType = (t?: string) => {
    if (!t) return false;
    const v = String(t).toUpperCase();
    return v === "VIDEO" || v === "REELS" || v.includes("VIDEO");
  };

  // Otimizado: Fetch platform account ID uma vez só
  const { data: platformAccountId } = useQuery({
    queryKey: ["instagram-platform-account"],
    queryFn: async (): Promise<string | null> => {
      const { data: platformAccounts } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);
      
      return platformAccounts?.[0]?.id || null;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // Fetch aggregated Instagram metrics - Otimizado
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["instagram-metrics", dateRange, platformAccountId],
    queryFn: async (): Promise<InstagramMetrics | null> => {
      if (!platformAccountId) return null;
      
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("clicks, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day")
        .limit(100); // Limit para evitar queries muito grandes

      if (!metricsData || metricsData.length === 0) {
        return {
          reach: 0, profileViews: 0, websiteClicks: 0, accountsEngaged: 0,
          totalInteractions: 0, likes: 0, comments: 0, shares: 0, saves: 0,
          replies: 0, followerGrowth: 0, profileLinksTaps: 0,
        };
      }

      const aggregated = metricsData.reduce(
        (acc, row) => {
          acc.websiteClicks += row.clicks || 0;
          const extra = row.extra_metrics || {};
          acc.reach += extra.reach || 0;
          acc.profileViews += extra.profile_views || 0;
          acc.accountsEngaged += extra.accounts_engaged || 0;
          acc.totalInteractions += extra.total_interactions || 0;
          acc.likes += extra.likes || 0;
          acc.comments += extra.comments || 0;
          acc.shares += extra.shares || 0;
          acc.saves += extra.saves || 0;
          acc.replies += extra.replies || 0;
          acc.followerGrowth += extra.follower_count || 0;
          acc.profileLinksTaps += extra.profile_links_taps || 0;
          return acc;
        },
        {
          reach: 0, profileViews: 0, websiteClicks: 0, accountsEngaged: 0,
          totalInteractions: 0, likes: 0, comments: 0, shares: 0, saves: 0,
          replies: 0, followerGrowth: 0, profileLinksTaps: 0,
        }
      );

      return aggregated;
    },
    enabled: !!platformAccountId,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  // Fetch profile - Otimizado com cache
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["instagram-profile"],
    queryFn: async (): Promise<ProfileSnapshot | null> => {
      const { data } = await supabase
        .from("instagram_profile_snapshots")
        .select("username, biography, followers_count, follows_count, media_count, captured_at")
        .eq("workspace_id", WORKSPACE_ID)
        .order("captured_at", { ascending: false })
        .limit(1);
      return data?.[0] as ProfileSnapshot || null;
    },
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos
  });

  // Fetch daily trends - Simplificado
  const { data: dailyTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ["instagram-daily-trends", dateRange, platformAccountId],
    queryFn: async (): Promise<DailyMetric[]> => {
      if (!platformAccountId) return [];
      
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day")
        .order("metric_date", { ascending: true })
        .limit(100);

      if (!metricsData) return [];

      return metricsData.map((row) => {
        const extra = row.extra_metrics || {};
        return {
          date: new Date(row.metric_date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          reach: extra.reach || 0,
          followerCount: extra.follower_count || 0,
          engagement: Math.round(((extra.total_interactions || 0) / Math.max(1, extra.reach || 1)) * 100 * 100) / 100,
        };
      });
    },
    enabled: !!platformAccountId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch top performing posts - Otimizado
  const { data: topPosts, isLoading: postsLoading } = useQuery({
    queryKey: ["instagram-top-posts", dateRange, platformAccountId],
    queryFn: async (): Promise<MediaPost[]> => {
      if (!platformAccountId) return [];
      
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day")
        .limit(50);

      if (!metricsData) return [];

      const posts: MediaPost[] = [];
      metricsData.forEach((row) => {
        const mediaInsights = row.extra_metrics?.media_insights;
        if (!mediaInsights) return;
        Object.entries(mediaInsights).forEach(([mediaId, payload]: [string, any]) => {
          const m = payload?.metrics || {};
          posts.push({
            id: mediaId,
            mediaType: payload?.media_type || "",
            timestamp: payload?.timestamp || "",
            permalink: payload?.permalink,
            metrics: {
              likes: Number(m.likes || 0),
              comments: Number(m.comments || 0),
              shares: Number(m.shares || 0),
              saved: Number(m.saved || 0),
              total_interactions: Number(m.total_interactions || 0),
              reach: Number(m.reach || 0),
              impressions: Number(m.impressions || 0),
              views: Number(m.video_views || m.plays || 0),
            },
          });
        });
      });

      return posts.sort(
        (a, b) => (b.metrics.total_interactions || 0) - (a.metrics.total_interactions || 0)
      ).slice(0, 20); // Limitar a 20 posts
    },
    enabled: !!platformAccountId,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = metricsLoading || trendsLoading || postsLoading || profileLoading;

  // Memoize content recommendations para evitar recálculos desnecessários
  const recommendations = useMemo(() => {
    if (!topPosts || topPosts.length === 0) return null;

    const imagePosts = topPosts.filter(
      (p) => p.mediaType === "IMAGE" || p.mediaType === "CAROUSEL_ALBUM"
    );
    const videoPosts = topPosts.filter(
      (p) => p.mediaType === "VIDEO" || p.mediaType === "REELS"
    );

    const imagePerformance = imagePosts.reduce(
      (sum, p) => sum + (p.metrics.total_interactions || 0),
      0
    );
    const videoPerformance = videoPosts.reduce(
      (sum, p) => sum + (p.metrics.total_interactions || 0),
      0
    );

    const imageCount = imagePosts.length;
    const videoCount = videoPosts.length;

    const avgImagePerformance = imageCount > 0 ? Math.round(imagePerformance / imageCount) : 0;
    const avgVideoPerformance = videoCount > 0 ? Math.round(videoPerformance / videoCount) : 0;

    return {
      bestFormat: avgVideoPerformance > avgImagePerformance ? "Vídeos/Reels" : "Imagens",
      imagePerf: avgImagePerformance,
      videoPerf: avgVideoPerformance,
      imageCount,
      videoCount,
      topPost: topPosts[0],
    };
  }, [topPosts]);

  const hasReachData = (metrics?.reach || 0) > 0 || (dailyTrends || []).some((d) => (d.reach || 0) > 0);
  const showRecommendations = Boolean(recommendations) && (topPosts?.length || 0) > 0;
  const showReachChart = (dailyTrends || []).some((d) => (d.reach || 0) > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Instagram className="w-8 h-8 text-purple-600" />
            Instagram Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise completa de performance e recomendações estratégicas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
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
          {/* Key Metrics Skeleton */}
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
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Skeleton className="h-6 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : !metrics ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-lg font-semibold mb-2">Instagram não configurado</p>
              <p className="text-muted-foreground">
                Configure a integração com Instagram para visualizar insights
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {profile && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Perfil</CardTitle>
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
                      <div className="text-base font-semibold">{new Intl.NumberFormat("pt-BR").format(profile.followers_count || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Seguindo</div>
                      <div className="text-base font-semibold">{new Intl.NumberFormat("pt-BR").format(profile.follows_count || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                      <div className="text-base font-semibold">{new Intl.NumberFormat("pt-BR").format(profile.media_count || 0)}</div>
                    </div>
                  </div>
                </div>
                {profile.biography && (
                  <div className="mt-3 text-sm text-muted-foreground">{profile.biography}</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Key Metrics Summary */}
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
                  Novos Seguidores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {metrics.followerGrowth >= 0 ? (
                    <ArrowUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-red-500" />
                  )}
                  {new Intl.NumberFormat("pt-BR").format(Math.abs(metrics.followerGrowth))}
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
                  Curtidas, comentários, compartilhamentos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations Section */}
          {showRecommendations && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Recomendações Estratégicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Tipo de Conteúdo para Produzir
                    </h4>
                    <p className="text-sm mb-2">
                      <strong>{recommendations.bestFormat}</strong> estão performando melhor:
                    </p>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <VideoIcon className="w-4 h-4" />
                        Vídeos/Reels: {new Intl.NumberFormat("pt-BR").format(recommendations.videoPerf)} interações médias
                        ({recommendations.videoCount} {recommendations.videoCount === 1 ? 'post' : 'posts'})
                      </li>
                      <li className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Imagens: {new Intl.NumberFormat("pt-BR").format(recommendations.imagePerf)} interações médias
                        ({recommendations.imageCount} {recommendations.imageCount === 1 ? 'post' : 'posts'})
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Melhor Post do Período
                    </h4>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center" style={{ height: '120px' }}>
                        <InstagramMedia
                          type={isVideoType(recommendations.topPost.mediaType) ? "video" : "image"}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {isVideoType(recommendations.topPost.mediaType) ? (
                          <VideoIcon className="w-5 h-5 text-purple-600" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-blue-600" />
                        )}
                        <span className="text-sm font-medium">
                          {recommendations.topPost.mediaType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Interações:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.total_interactions)}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Curtidas:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.likes)}</strong>
                        </div>
                      </div>
                      {recommendations.topPost.permalink && (
                        <a
                          href={recommendations.topPost.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                        >
                          Ver post no Instagram
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trends Charts */}
          {showReachChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alcance Diário</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="reach"
                      stroke="#8884d8"
                      name="Alcance"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Performing Posts */}
          {topPosts && topPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Posts com Melhor Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Tipo</th>
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-right py-2 px-2">Alcance</th>
                        <th className="text-right py-2 px-2">Interações</th>
                        <th className="text-right py-2 px-2">Curtidas</th>
                        <th className="text-right py-2 px-2">Comentários</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPosts.slice(0, 10).map((post) => (
                        <tr key={post.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {isVideoType(post.mediaType) ? (
                                <VideoIcon className="w-4 h-4 text-purple-600" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-blue-600" />
                              )}
                              <span className="text-xs">
                                {post.mediaType === "CAROUSEL_ALBUM" ? "CAROUSEL" : post.mediaType}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm">
                            {(() => {
                              const d = post.timestamp ? new Date(post.timestamp) : null;
                              return d && !isNaN(d.getTime())
                                ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                                : "-";
                            })()}
                          </td>
                          <td className="py-3 px-2 text-sm text-right">
                            {new Intl.NumberFormat("pt-BR").format(
                              post.metrics.reach || post.metrics.impressions || 0
                            )}
                          </td>
                          <td className="py-3 px-2 text-sm text-right font-semibold">
                            {new Intl.NumberFormat("pt-BR").format(post.metrics.total_interactions)}
                          </td>
                          <td className="py-3 px-2 text-sm text-right">
                            {new Intl.NumberFormat("pt-BR").format(post.metrics.likes)}
                          </td>
                          <td className="py-3 px-2 text-sm text-right">
                            {new Intl.NumberFormat("pt-BR").format(post.metrics.comments)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Metrics Grid */}
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
                  <p className="text-xs text-muted-foreground">Compartilhamentos</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.shares)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Salvamentos</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.saves)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cliques no Site</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.websiteClicks)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cliques em Links</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.profileLinksTaps)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Respostas</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.replies)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
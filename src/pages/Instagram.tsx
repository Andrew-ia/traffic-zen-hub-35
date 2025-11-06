import { useState } from "react";
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
import { ArrowUp, ArrowDown, TrendingUp, Clock, Image as ImageIcon, Video as VideoIcon, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

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
    saved: number;
    shares: number;
    comments: number;
    total_interactions: number;
    views?: number;
  };
}

export default function Instagram() {
  const [dateRange, setDateRange] = useState("7");

  // Fetch aggregated Instagram metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["instagram-metrics", dateRange],
    queryFn: async (): Promise<InstagramMetrics | null> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: platformAccounts } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);

      if (!platformAccounts || platformAccounts.length === 0) return null;

      const platformAccountId = platformAccounts[0].id;

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("clicks, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day");

      if (!metricsData || metricsData.length === 0) {
        return {
          reach: 0,
          profileViews: 0,
          websiteClicks: 0,
          accountsEngaged: 0,
          totalInteractions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          replies: 0,
          followerGrowth: 0,
          profileLinksTaps: 0,
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
          reach: 0,
          profileViews: 0,
          websiteClicks: 0,
          accountsEngaged: 0,
          totalInteractions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          replies: 0,
          followerGrowth: 0,
          profileLinksTaps: 0,
        }
      );

      return aggregated;
    },
  });

  // Fetch daily trends
  const { data: dailyTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ["instagram-daily-trends", dateRange],
    queryFn: async (): Promise<DailyMetric[]> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: platformAccounts } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);

      if (!platformAccounts || platformAccounts.length === 0) return [];

      const platformAccountId = platformAccounts[0].id;

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day")
        .order("metric_date", { ascending: true });

      if (!metricsData) return [];

      return metricsData
        .map((row) => {
          const extra = row.extra_metrics || {};
          const reach = extra.reach || 0;
          const totalInteractions = extra.total_interactions || 0;

          // Calculate engagement from media insights if available
          let engagement = 0;
          if (reach > 0 && totalInteractions > 0) {
            engagement = (totalInteractions / reach) * 100;
          } else if (extra.media_insights) {
            // Calculate from individual posts
            let postReach = 0;
            let postInteractions = 0;
            Object.values(extra.media_insights).forEach((media: any) => {
              postReach += media.metrics?.reach || 0;
              postInteractions += media.metrics?.total_interactions || 0;
            });
            if (postReach > 0) {
              engagement = (postInteractions / postReach) * 100;
            }
          }

          return {
            date: new Date(row.metric_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            reach: reach,
            followerCount: extra.follower_count || 0,
            engagement: Math.round(engagement * 100) / 100,
          };
        })
        .filter((item) => item.reach > 0 || item.engagement > 0); // Only show days with data
    },
  });

  // Fetch top performing posts
  const { data: topPosts, isLoading: postsLoading } = useQuery({
    queryKey: ["instagram-top-posts", dateRange],
    queryFn: async (): Promise<MediaPost[]> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data: platformAccounts } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);

      if (!platformAccounts || platformAccounts.length === 0) return [];

      const platformAccountId = platformAccounts[0].id;

      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day");

      if (!metricsData) return [];

      const posts: MediaPost[] = [];
      metricsData.forEach((row) => {
        const mediaInsights = row.extra_metrics?.media_insights;
        if (mediaInsights) {
          Object.entries(mediaInsights).forEach(([mediaId, data]: [string, any]) => {
            posts.push({
              id: mediaId,
              mediaType: data.media_type,
              timestamp: data.timestamp,
              permalink: data.permalink,
              mediaUrl: data.media_url,
              metrics: data.metrics,
            });
          });
        }
      });

      return posts.sort(
        (a, b) =>
          (b.metrics.total_interactions || 0) - (a.metrics.total_interactions || 0)
      );
    },
  });

  const isLoading = metricsLoading || trendsLoading || postsLoading;

  // Calculate content recommendations
  const getContentRecommendations = () => {
    if (!topPosts || topPosts.length === 0) return null;

    // Separate posts by type
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

    // Calculate engagement rates for better recommendation
    const avgImageEngagement = imageCount > 0
      ? imagePosts.reduce((sum, p) => {
          const rate = p.metrics.reach > 0 ? (p.metrics.total_interactions / p.metrics.reach) * 100 : 0;
          return sum + rate;
        }, 0) / imageCount
      : 0;

    const avgVideoEngagement = videoCount > 0
      ? videoPosts.reduce((sum, p) => {
          const rate = p.metrics.reach > 0 ? (p.metrics.total_interactions / p.metrics.reach) * 100 : 0;
          return sum + rate;
        }, 0) / videoCount
      : 0;

    return {
      bestFormat:
        avgVideoEngagement > avgImageEngagement
          ? "Vídeos/Reels"
          : avgImageEngagement > avgVideoEngagement
          ? "Imagens"
          : "Vídeos/Reels e Imagens têm performance similar",
      imagePerf: avgImagePerformance,
      videoPerf: avgVideoPerformance,
      imageEngagement: avgImageEngagement.toFixed(1),
      videoEngagement: avgVideoEngagement.toFixed(1),
      imageCount,
      videoCount,
      topPost: topPosts[0],
    };
  };

  const recommendations = getContentRecommendations();

  // Calculate average engagement rate
  const avgEngagement =
    metrics && metrics.reach > 0
      ? ((metrics.totalInteractions / metrics.reach) * 100).toFixed(2)
      : "0";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instagram Insights</h1>
          <p className="text-muted-foreground mt-1">
            Análise completa de performance e recomendações estratégicas
          </p>
        </div>

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

          {/* Recommendations Skeleton */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <div className="bg-white rounded-lg p-3 border space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-4 w-32" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Skeleton */}
          <div className="grid md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
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
                  Taxa de Engajamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgEngagement}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Interações / Alcance
                </p>
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
                  Cliques no Site
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat("pt-BR").format(metrics.websiteClicks)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Conversões para o site
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations Section */}
          {recommendations && (
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
                        <span className="text-xs text-green-600 font-medium ml-1">
                          {recommendations.videoEngagement}% engajamento
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Imagens: {new Intl.NumberFormat("pt-BR").format(recommendations.imagePerf)} interações médias
                        ({recommendations.imageCount} {recommendations.imageCount === 1 ? 'post' : 'posts'})
                        <span className="text-xs text-green-600 font-medium ml-1">
                          {recommendations.imageEngagement}% engajamento
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Melhor Post do Período
                    </h4>
                    <div className="bg-white rounded-lg p-3 border">
                      {recommendations.topPost.mediaUrl && (
                        <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center" style={{ height: '120px' }}>
                          {recommendations.topPost.mediaType.includes("VIDEO") ? (
                            <video
                              src={recommendations.topPost.mediaUrl}
                              className="max-w-full max-h-full object-contain"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={recommendations.topPost.mediaUrl}
                              alt="Post preview"
                              className="max-w-full max-h-full object-contain"
                            />
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        {recommendations.topPost.mediaType.includes("VIDEO") ? (
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
                          <span className="text-muted-foreground">Alcance:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.reach)}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Interações:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.total_interactions)}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Curtidas:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.likes)}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Comentários:</span>{" "}
                          <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.comments)}</strong>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Publicado em: {new Date(recommendations.topPost.timestamp).toLocaleDateString("pt-BR")} às {new Date(recommendations.topPost.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {recommendations.topPost.permalink && (
                        <a
                          href={recommendations.topPost.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                        >
                          Ver post no Instagram
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trends Charts */}
          {dailyTrends && dailyTrends.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Taxa de Engajamento (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="engagement" fill="#82ca9d" name="Engajamento (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
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
                        <th className="text-right py-2 px-2">Compartilh.</th>
                        <th className="text-right py-2 px-2">Engajamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPosts.slice(0, 10).map((post) => {
                        const engagementRate = post.metrics.reach > 0
                          ? ((post.metrics.total_interactions / post.metrics.reach) * 100).toFixed(1)
                          : "0.0";

                        return (
                          <tr key={post.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                {post.mediaType.includes("VIDEO") || post.mediaType === "REELS" ? (
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
                              {new Date(post.timestamp).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-2 text-sm text-right">
                              {new Intl.NumberFormat("pt-BR").format(post.metrics.reach)}
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
                            <td className="py-3 px-2 text-sm text-right">
                              {new Intl.NumberFormat("pt-BR").format(post.metrics.shares || 0)}
                            </td>
                            <td className="py-3 px-2 text-sm text-right font-medium text-green-600">
                              {engagementRate}%
                            </td>
                          </tr>
                        );
                      })}
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
                  <p className="text-xs text-muted-foreground">Contas Engajadas</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.accountsEngaged)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total de Interações</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.totalInteractions)}</p>
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
                  <p className="text-xs text-muted-foreground">Respostas</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.replies)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cliques em Links do Perfil</p>
                  <p className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(metrics.profileLinksTaps)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

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
import InstagramSyncButton from "@/components/InstagramSyncButton";
import { resolveApiBase } from "@/lib/apiBase";

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

interface MediaComment {
  id: string;
  comment_id: string;
  username?: string;
  text?: string;
  commented_at?: string;
}

export default function Instagram() {
  const [dateRange, setDateRange] = useState("30");
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const API_BASE = resolveApiBase();

  // Helper function to proxy Instagram images to avoid 403 errors
  const getProxiedImageUrl = (originalUrl?: string) => {
    if (!originalUrl) return undefined;
    // Check if it's an Instagram CDN URL that needs proxying
    if (originalUrl.includes('scontent.cdninstagram.com') || originalUrl.includes('instagram.com')) {
      return `${API_BASE}/api/creatives/download-proxy?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
  };

  const isVideoType = (t?: string) => {
    if (!t) return false;
    const v = String(t).toUpperCase();
    return v === "VIDEO" || v === "REELS" || v.includes("VIDEO");
  };

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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["instagram-profile"],
    queryFn: async (): Promise<ProfileSnapshot | null> => {
      const { data } = await supabase
        .from("instagram_profile_snapshots")
        .select("username, biography, profile_picture_url, followers_count, follows_count, media_count, captured_at")
        .eq("workspace_id", WORKSPACE_ID)
        .order("captured_at", { ascending: false })
        .limit(1);
      if (!data || data.length === 0) return null;
      return data[0] as ProfileSnapshot;
    },
  });

  const { data: mediaList, isLoading: mediaLoading } = useQuery({
    queryKey: ["instagram-media", dateRange],
    queryFn: async (): Promise<MediaItem[]> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];
      const { data } = await supabase
        .from("instagram_media")
        .select("id, media_id, caption, media_type, media_url, thumbnail_url, permalink, posted_at, like_count, comments_count")
        .eq("workspace_id", WORKSPACE_ID)
        .gte("posted_at", startDateStr)
        .order("posted_at", { ascending: false })
        .limit(50);
      return (data || []) as MediaItem[];
    },
  });

  const { data: mediaInsightsMap } = useQuery({
    queryKey: ["instagram-media-insights", dateRange],
    queryFn: async (): Promise<Record<string, MediaPost["metrics"]>> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];
      const { data } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("granularity", "day")
        .gte("metric_date", startDateStr);
      const map: Record<string, MediaPost["metrics"]> = {};
      (data || []).forEach((row: any) => {
        const mi = row?.extra_metrics?.media_insights || null;
        if (!mi) return;
        Object.entries(mi).forEach(([mid, payload]: [string, any]) => {
          const m = payload?.metrics || {};
          const cur = map[mid] || {
            likes: 0,
            reach: 0,
            impressions: 0,
            saved: 0,
            shares: 0,
            comments: 0,
            total_interactions: 0,
            views: 0,
          };
          cur.likes += Number(m.likes || 0);
          cur.comments += Number(m.comments || 0);
          cur.shares += Number(m.shares || 0);
          cur.saved += Number(m.saved || 0);
          cur.total_interactions += Number(m.total_interactions || 0);
          cur.reach += Number(m.reach || 0);
          cur.impressions += Number(m.impressions || 0);
          cur.views = Number(cur.views || 0) + Number(m.video_views || m.views || 0);
          map[mid] = cur;
        });
      });
      return map;
    },
  });

  const { data: mediaFallbackMap } = useQuery({
    queryKey: ["instagram-media-fallback", dateRange, (mediaList || []).length],
    enabled: !!mediaList && mediaList.length > 0,
    queryFn: async (): Promise<Record<string, { shares: number; saved: number; reach: number }>> => {
      const ids = (mediaList || []).map((m) => m.media_id);
      if (!ids || ids.length === 0) return {};
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const { data, error } = await supabase
        .from("instagram_media_insights_daily")
        .select("media_id, shares, saved, reach, metric_date")
        .eq("workspace_id", WORKSPACE_ID)
        .in("media_id", ids)
        .gte("metric_date", oneYearAgo);
      if (error || !data) return {};
      const map: Record<string, { shares: number; saved: number; reach: number }> = {};
      (data || []).forEach((row: any) => {
        const cur = map[row.media_id] || { shares: 0, saved: 0, reach: 0 };
        cur.shares += Number(row.shares || 0);
        cur.saved += Number(row.saved || 0);
        cur.reach += Number(row.reach || 0);
        map[row.media_id] = cur;
      });
      return map;
    },
  });

  const fetchComments = async (mediaId: string): Promise<MediaComment[]> => {
    const { data } = await supabase
      .from("instagram_media_comments")
      .select("id, comment_id, username, text, commented_at")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("media_id", mediaId)
      .order("commented_at", { ascending: false })
      .limit(20);
    return (data || []) as MediaComment[];
  };

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

      const metricsByDate = new Map<string, DailyMetric>();

      metricsData.forEach((row) => {
        const extra = row.extra_metrics || {};
        const reach = extra.reach || 0;
        const totalInteractionsBase = extra.total_interactions || 0;
        const interactionsFallback =
          (extra.likes || 0) +
          (extra.comments || 0) +
          (extra.shares || 0) +
          (extra.saves || 0) +
          (extra.replies || 0);
        const interactionsAlt = extra.accounts_engaged || 0;
        const totalInteractions =
          totalInteractionsBase > 0
            ? totalInteractionsBase
            : interactionsFallback > 0
            ? interactionsFallback
            : interactionsAlt;

        // Calculate engagement using (likes + comments) / views from media insights
        let engagement = 0;
        if (extra.media_insights) {
          let sumLikesComments = 0;
          let sumViews = 0;
          Object.values(extra.media_insights).forEach((media: any) => {
            const mm = media.metrics || {};
            sumLikesComments += Number((mm.likes || 0) + (mm.comments || 0));
            sumViews += Number(mm.video_views || mm.plays || mm.views || 0);
          });
          if (sumViews > 0) {
            engagement = (sumLikesComments / sumViews) * 100;
          }
        }

        metricsByDate.set(row.metric_date, {
          date: new Date(row.metric_date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          reach,
          followerCount: extra.follower_count || 0,
          engagement: Math.round(engagement * 100) / 100,
        });
      });

      const dailySeries: DailyMetric[] = [];
      const rangeEnd = new Date();

      for (
        let current = new Date(startDate);
        current <= rangeEnd;
        current.setDate(current.getDate() + 1)
      ) {
        const isoDate = current.toISOString().split("T")[0];
        const formattedDate = current.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        const existingMetrics = metricsByDate.get(isoDate);

        dailySeries.push(
          existingMetrics
            ? { ...existingMetrics, date: formattedDate }
            : {
                date: formattedDate,
                reach: 0,
                followerCount: 0,
                engagement: 0,
              }
        );
      }

      return dailySeries;
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

      // Load media meta to enrich posts (type, url, permalink, counts)
      const { data: mediaRows } = await supabase
        .from("instagram_media")
        .select("media_id, media_type, media_url, thumbnail_url, permalink, posted_at, like_count, comments_count")
        .eq("workspace_id", WORKSPACE_ID)
        .gte("posted_at", startDateStr);
      const mediaMap: Record<string, any> = {};
      (mediaRows || []).forEach((m: any) => {
        mediaMap[m.media_id] = m;
      });

      const posts: MediaPost[] = [];
      metricsData.forEach((row) => {
        const mediaInsights = row.extra_metrics?.media_insights;
        if (!mediaInsights) return;
        Object.entries(mediaInsights).forEach(([mediaId, payload]: [string, any]) => {
          const m = payload?.metrics || {};
          const meta = mediaMap[mediaId] || {};
          const ts = payload?.timestamp || meta.posted_at || null;
          posts.push({
            id: mediaId,
            mediaType: payload?.media_type || meta.media_type || "",
            timestamp: ts || "",
            permalink: payload?.permalink || meta.permalink || undefined,
            mediaUrl: payload?.media_url || meta.media_url || meta.thumbnail_url || undefined,
            metrics: {
              likes: Number(m.likes || meta.like_count || 0),
              comments: Number(m.comments || meta.comments_count || 0),
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
        (a, b) =>
          (b.metrics.total_interactions || 0) - (a.metrics.total_interactions || 0)
      );
    },
  });

  const isLoading = metricsLoading || trendsLoading || postsLoading;
  const extendedLoading = isLoading || profileLoading || mediaLoading;

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
          const denom = p.metrics.views || 0;
          const num = (p.metrics.likes || 0) + (p.metrics.comments || 0);
          const rate = denom > 0 ? (num / denom) * 100 : 0;
          return sum + rate;
        }, 0) / imageCount
      : 0;

    const avgVideoEngagement = videoCount > 0
      ? videoPosts.reduce((sum, p) => {
          const denom = p.metrics.views || 0;
          const num = (p.metrics.likes || 0) + (p.metrics.comments || 0);
          const rate = denom > 0 ? (num / denom) * 100 : 0;
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

  // Calculate average engagement rate using (likes + comments) / views
  const totalViews = Object.values(mediaInsightsMap || {}).reduce((sum, m: any) => sum + Number((m as any).views || 0), 0);
  const totalLikesComments = Object.values(mediaInsightsMap || {}).reduce((sum, m: any) => sum + Number(((m as any).likes || 0) + ((m as any).comments || 0)), 0);
  const avgEngagement = totalViews > 0 ? ((totalLikesComments / totalViews) * 100).toFixed(2) : "0";

  const { data: engagementApi } = useQuery({
    queryKey: ["instagram-engagement-api", dateRange, "views"],
    queryFn: async (): Promise<{ averageEngagementRate: number; denominator: string; posts: Array<{ id: string; date: string; type?: string; likes: number; comments: number; reach?: number; views?: number; engagementRate: number; permalink?: string; caption?: string }>; } | null> => {
      const wid = (import.meta.env.VITE_WORKSPACE_ID as string | undefined) || "";
      if (!wid) return null;
      const url = `${API_BASE}/api/instagram/engagement?workspaceId=${encodeURIComponent(wid)}&days=${encodeURIComponent(dateRange)}&denominator=views`;
      let j: any = null;
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        j = await r.json().catch(() => null);
      } catch {
        return null;
      }
      const avg = Number(j?.data?.averageEngagementRate || 0);
      const denom = String(j?.data?.denominator || "views");
      const posts = Array.isArray(j?.data?.posts) ? j.data.posts : [];
      return { averageEngagementRate: avg, denominator: denom, posts };
    },
  });

  const hasReachData =
    (metrics?.reach || 0) > 0 ||
    (dailyTrends || []).some((d) => (d.reach || 0) > 0) ||
    (topPosts || []).some((p) => (p.metrics.reach || p.metrics.impressions || p.metrics.views || 0) > 0);

  const hasEngagementData =
    (dailyTrends || []).some((d) => (d.engagement || 0) > 0) ||
    (topPosts || []).some((p) => {
      const denom = p.metrics.views || 0;
      const num = (p.metrics.likes || 0) + (p.metrics.comments || 0);
      return denom > 0 && num > 0;
    });

  const showRecommendations = Boolean(recommendations) && hasEngagementData;
  const showReachChart = (dailyTrends || []).some((d) => (d.reach || 0) > 0);
  const showEngChart = false;
  const allDenomsZero = true;
  const showEngagementColumn = false;

  let showAccountInsightsCard = false;
  let showInteractionSummary = false;

  const exportTopPostsCSV = () => {
    if (!topPosts || topPosts.length === 0) return;
    const rows = [
      ["media_id","type","date","reach","impressions","views","likes","comments","shares","saved","interactions","engagement_pct"],
      ...topPosts.slice(0, 50).map((post) => {
        const d = post.timestamp ? new Date(post.timestamp) : null;
        const dd = d && !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "";
        const denom = (post.metrics.views || 0);
        const num = (post.metrics.likes || 0) + (post.metrics.comments || 0);
        const eng = denom > 0 ? ((num / denom) * 100).toFixed(2) : "0.00";
        return [
          post.id,
          post.mediaType,
          dd,
          String(post.metrics.reach || 0),
          String(post.metrics.impressions || 0),
          String(post.metrics.views || 0),
          String(post.metrics.likes || 0),
          String(post.metrics.comments || 0),
          String(post.metrics.shares || 0),
          String(post.metrics.saved || 0),
          String(post.metrics.total_interactions || 0),
          String(eng),
        ];
      }),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `instagram-top-posts-${dateRange}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const { data: accountInsights } = useQuery({
    queryKey: ["instagram-account-insights", dateRange],
    queryFn: async (): Promise<any> => {
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
      const { data: pm } = await supabase
        .from("performance_metrics")
        .select("metric_date, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day");
      const agg = {
        impressions: 0,
        reach: 0,
        interactions: 0,
        profile_views: 0,
        website_clicks: 0,
        profile_links_taps: 0,
        views: 0,
        followers_count: 0,
        breakdown_followers: { followers: 0, non_followers: 0 },
        breakdown_content_type: { stories: 0, reels: 0, posts: 0, live: 0, videos: 0 },
        online_followers: [] as number[],
      };
      (pm || []).forEach((row: any) => {
        const e = row.extra_metrics || {};
        agg.impressions += Number(e.impressions || 0);
        agg.reach += Number(e.reach || 0);
        agg.interactions += Number(e.total_interactions || 0);
        agg.profile_views += Number(e.profile_views || 0);
        agg.website_clicks += Number(e.website_clicks || 0);
        agg.profile_links_taps += Number(e.profile_links_taps || 0);
        agg.views += Number(e.views || 0);
        // Fallback: aggregate per-media insights when top-level is missing
        const mi = e.media_insights || null;
        if (mi && typeof mi === 'object') {
          Object.values(mi).forEach((payload: any) => {
            const m = payload?.metrics || {};
            agg.impressions += Number(m.impressions || 0);
            agg.reach += Number(m.reach || 0);
            agg.interactions += Number(m.total_interactions || 0);
            agg.profile_views += Number(m.profile_views || 0);
            agg.website_clicks += Number(m.website_clicks || 0);
            agg.profile_links_taps += Number(m.profile_links_taps || 0);
            agg.views += Number(m.video_views || m.views || m.plays || 0);
          });
        }
        agg.followers_count = Math.max(agg.followers_count, Number(e.follower_count || 0));
        const b = e.breakdown || null;
        const tv = e.total_value || null;
        const vb = e.value_breakdown || null;
        const bx: any = b || tv || vb || {};
        const ft = bx.follow_type || bx.followers || null;
        if (ft) {
          agg.breakdown_followers.followers += Number(ft.followers || ft.followers_count || 0);
          agg.breakdown_followers.non_followers += Number(ft.non_followers || ft.non_followers_count || 0);
        }
        const ct = bx.content_type || null;
        if (ct) {
          agg.breakdown_content_type.stories += Number(ct.stories || 0);
          agg.breakdown_content_type.reels += Number(ct.reels || 0);
          agg.breakdown_content_type.posts += Number(ct.posts || 0);
          agg.breakdown_content_type.live += Number(ct.live || 0);
          agg.breakdown_content_type.videos += Number(ct.videos || 0);
        }
        const of = e.online_followers || null;
        if (Array.isArray(of) && agg.online_followers.length === 0) agg.online_followers = of.map((x: any) => Number(x || 0));
      });

      // Fallback: aggregate media-level daily insights when account-level aggregates are missing in period
      try {
        const { data: mediaDaily } = await supabase
          .from("instagram_media_insights_daily")
          .select("reach, impressions, video_views, total_interactions, shares, saved")
          .eq("workspace_id", WORKSPACE_ID)
          .gte("metric_date", startDateStr);
        (mediaDaily || []).forEach((row: any) => {
          agg.impressions += Number(row.impressions || 0);
          agg.reach += Number(row.reach || 0);
          agg.interactions += Number(row.total_interactions || 0);
          agg.views += Number(row.video_views || 0);
          // shares/saved não são exibidos neste card, mas podem ser úteis no futuro
        });
      } catch (err) {
        console.warn('Instagram media daily fallback failed');
      }
      return agg;
    },
  });

  if (accountInsights) {
    // Sempre mostrar o card se temos dados do Instagram (mesmo que sejam zeros)
    showAccountInsightsCard = Boolean(accountInsights);

    showInteractionSummary = (
      (accountInsights.interactions || 0) > 0 ||
      (accountInsights.profile_views || 0) > 0 ||
      ((accountInsights.profile_links_taps || accountInsights.website_clicks || 0) > 0)
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instagram Insights</h1>
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
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="all">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="video">Vídeos</option>
            <option value="reels">Reels</option>
            <option value="carousel">Carrossel</option>
          </select>
          <InstagramSyncButton size="sm" days={parseInt(dateRange)} />
        </div>
      </div>

      {extendedLoading ? (
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
          {profile && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {profile.profile_picture_url ? (
                    <img src={getProxiedImageUrl(profile.profile_picture_url)} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted" />
                  )}
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


          {showAccountInsightsCard && (
            <Card>
              <CardHeader>
                <CardTitle>Insights sobre a Conta</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Métricas de alcance e segmentação dos últimos {dateRange} dias
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Métricas principais de alcance */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Impressões</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {new Intl.NumberFormat("pt-BR").format(accountInsights.impressions || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Exibições totais</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Alcance</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat("pt-BR").format(accountInsights.reach || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Contas únicas</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Visualizações</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {new Intl.NumberFormat("pt-BR").format(accountInsights.views || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Vídeos/Stories</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Interações</div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {new Intl.NumberFormat("pt-BR").format(accountInsights.interactions || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Total de engajamento</div>
                  </div>
                </div>

                {/* Breakdown de audiência */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Seguidores vs Não Seguidores
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        const total = (accountInsights.breakdown_followers.followers || 0) + (accountInsights.breakdown_followers.non_followers || 0);
                        const followersPerc = total > 0 ? ((accountInsights.breakdown_followers.followers || 0) / total) * 100 : 0;
                        const nonFollowersPerc = total > 0 ? ((accountInsights.breakdown_followers.non_followers || 0) / total) * 100 : 0;
                        
                        return (
                          <>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-sm">Seguidores</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{new Intl.NumberFormat("pt-BR").format(accountInsights.breakdown_followers.followers || 0)}</div>
                                <div className="text-xs text-muted-foreground">{followersPerc.toFixed(1)}%</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                <span className="text-sm">Não seguidores</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{new Intl.NumberFormat("pt-BR").format(accountInsights.breakdown_followers.non_followers || 0)}</div>
                                <div className="text-xs text-muted-foreground">{nonFollowersPerc.toFixed(1)}%</div>
                              </div>
                            </div>
                            
                            {total > 0 && (
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${followersPerc}%` }}
                                ></div>
                              </div>
                            )}
                            
                            {total === 0 && (
                              <div className="text-center py-4 text-sm text-muted-foreground">
                                Sem dados de segmentação de audiência
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Por Tipo de Conteúdo
                    </h4>
                    <div className="space-y-2">
                      {[
                        { label: "Stories", value: accountInsights.breakdown_content_type.stories || 0, color: "bg-pink-500" },
                        { label: "Reels", value: accountInsights.breakdown_content_type.reels || 0, color: "bg-purple-500" },
                        { label: "Posts", value: accountInsights.breakdown_content_type.posts || 0, color: "bg-blue-500" },
                        { label: "Vídeos", value: accountInsights.breakdown_content_type.videos || 0, color: "bg-green-500" },
                        { label: "Lives", value: accountInsights.breakdown_content_type.live || 0, color: "bg-red-500" }
                      ].map(({ label, value, color }) => {
                        const total = (accountInsights.breakdown_content_type.stories || 0) + 
                                    (accountInsights.breakdown_content_type.reels || 0) + 
                                    (accountInsights.breakdown_content_type.posts || 0) + 
                                    (accountInsights.breakdown_content_type.videos || 0) + 
                                    (accountInsights.breakdown_content_type.live || 0);
                        const percentage = total > 0 ? (value / total) * 100 : 0;
                        
                        return (
                          <div key={label} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 ${color} rounded-full`}></div>
                              <span className="text-sm">{label}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-sm">{new Intl.NumberFormat("pt-BR").format(value)}</div>
                              {total > 0 && (
                                <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {(() => {
                        const total = (accountInsights.breakdown_content_type.stories || 0) + 
                                    (accountInsights.breakdown_content_type.reels || 0) + 
                                    (accountInsights.breakdown_content_type.posts || 0) + 
                                    (accountInsights.breakdown_content_type.videos || 0) + 
                                    (accountInsights.breakdown_content_type.live || 0);
                        
                        if (total === 0) {
                          return (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              Sem dados de breakdown por tipo de conteúdo
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showInteractionSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Resumo de Interações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Interações</div>
                    <div className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(accountInsights.interactions)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Visitas ao perfil</div>
                    <div className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(accountInsights.profile_views)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Cliques em links</div>
                    <div className="text-lg font-semibold">{new Intl.NumberFormat("pt-BR").format(accountInsights.profile_links_taps || accountInsights.website_clicks)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {accountInsights?.online_followers && accountInsights.online_followers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Horários mais ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 gap-2">
                  {accountInsights.online_followers.map((v: number, i: number) => (
                    <div key={i} className="text-center">
                      <div className="h-16 w-6 mx-auto bg-muted relative">
                        <div className="absolute bottom-0 left-0 right-0 bg-primary" style={{ height: `${Math.min(100, Math.round((v / Math.max(...accountInsights.online_followers)) * 100))}%` }} />
                      </div>
                      <div className="text-[10px] mt-1">{i}h</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          

          {mediaList && mediaList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conteúdo principal por interações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-3">
                  {Array.from(mediaList)
                    .filter((m) => mediaFilter === "all" || (mediaFilter === "image" && m.media_type === "IMAGE") || (mediaFilter === "video" && m.media_type === "VIDEO") || (mediaFilter === "reels" && (m.media_type === "REELS" || m.media_type === "VIDEO")) || (mediaFilter === "carousel" && m.media_type === "CAROUSEL_ALBUM"))
                    .map((m) => {
                      const mi = mediaInsightsMap?.[m.media_id];
                      const inter = mi?.total_interactions || 0;
                      return { m, inter };
                    })
                    .sort((a, b) => (b.inter - a.inter))
                    .slice(0, 5)
                    .map(({ m, inter }) => (
                      <div key={m.id} className="rounded-lg border overflow-hidden">
                        <div className="bg-muted flex items-center justify-center" style={{ height: 120 }}>
                          {isVideoType(m.media_type) ? (
                            <video src={getProxiedImageUrl(m.media_url)} className="max-w-full max-h-full object-contain" muted playsInline preload="none" poster={getProxiedImageUrl(m.thumbnail_url)} referrerPolicy="no-referrer" controls />
                          ) : (
                            <img src={getProxiedImageUrl(m.media_url || m.thumbnail_url)} className="max-w-full max-h-full object-cover" />
                          )}
                        </div>
                        <div className="p-2 text-xs">
                          <div className="font-semibold">{new Intl.NumberFormat("pt-BR").format(inter)} interações</div>
                          <div className="text-muted-foreground">{m.posted_at ? new Date(m.posted_at).toLocaleDateString("pt-BR") : "-"}</div>
                        </div>
                      </div>
                    ))}
                </div>
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
                        {(Number(recommendations.videoEngagement) > 0) && (
                          <span className="text-xs text-green-600 font-medium ml-1">
                            {recommendations.videoEngagement}% engajamento
                          </span>
                        )}
                      </li>
                      <li className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Imagens: {new Intl.NumberFormat("pt-BR").format(recommendations.imagePerf)} interações médias
                        ({recommendations.imageCount} {recommendations.imageCount === 1 ? 'post' : 'posts'})
                        {(Number(recommendations.imageEngagement) > 0) && (
                          <span className="text-xs text-green-600 font-medium ml-1">
                            {recommendations.imageEngagement}% engajamento
                          </span>
                        )}
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
                          {isVideoType(recommendations.topPost.mediaType) ? (
                            <video
                              src={getProxiedImageUrl(recommendations.topPost.mediaUrl)}
                              className="max-w-full max-h-full object-contain"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={getProxiedImageUrl(recommendations.topPost.mediaUrl)}
                              alt="Post preview"
                              className="max-w-full max-h-full object-contain"
                            />
                          )}
                        </div>
                      )}
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
                        {(recommendations.topPost.metrics.views || 0) > 0 && (
                          <div>
                            <span className="text-muted-foreground">Visualizações:</span>{" "}
                            <strong>{new Intl.NumberFormat("pt-BR").format(recommendations.topPost.metrics.views || 0)}</strong>
                          </div>
                        )}
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
          {(showReachChart || showEngChart) && (
            <div className="grid md:grid-cols-2 gap-4">
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
              {showEngChart && (
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
              )}
            </div>
          )}

          {/* Top Performing Posts */}
          {topPosts && topPosts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Posts com Melhor Performance</CardTitle>
                  <button className="text-sm px-2 py-1 border rounded-md hover:bg-muted" onClick={exportTopPostsCSV}>Exportar CSV</button>
                </div>
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
                        {showEngagementColumn && (
                          <th className="text-right py-2 px-2">Engajamento</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {topPosts.slice(0, 10).map((post) => {
                        const reachDisplay = (post.metrics.views || 0);
                        const engagementRate = reachDisplay > 0
                          ? ((((post.metrics.likes || 0) + (post.metrics.comments || 0)) / reachDisplay) * 100).toFixed(1)
                          : "0.0";

                        return (
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
                                (post.metrics.reach || 0) || (mediaFallbackMap?.[post.id]?.reach || 0) || (post.metrics.impressions || 0) || (post.metrics.views || 0)
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
                            <td className="py-3 px-2 text-sm text-right">
                              {new Intl.NumberFormat("pt-BR").format((post.metrics.shares || 0) || (mediaFallbackMap?.[post.id]?.shares || 0))}
                            </td>
                            {showEngagementColumn && (
                              <td className="py-3 px-2 text-sm text-right font-medium text-green-600">
                                {engagementRate}%
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          

          {mediaList && mediaList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Galeria de Mídias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mediaList.map((m) => {
                    const metrics = mediaInsightsMap?.[m.media_id] || {
                      likes: 0,
                      comments: 0,
                      shares: 0,
                      saved: 0,
                      total_interactions: 0,
                      reach: 0,
                      views: 0,
                    };
                    return (
                      <div key={m.id} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted flex items-center justify-center" style={{ height: 180 }}>
                          {isVideoType(m.media_type) ? (
                            <video src={getProxiedImageUrl(m.media_url)} className="max-w-full max-h-full object-contain" muted playsInline />
                          ) : (
                            <img src={getProxiedImageUrl(m.media_url || m.thumbnail_url)} className="max-w-full max-h-full object-cover" />
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="text-sm font-semibold line-clamp-2">{m.caption || ""}</div>
                          <div className="text-xs text-muted-foreground">
                            Publicado em {m.posted_at ? new Date(m.posted_at).toLocaleDateString("pt-BR") : "-"}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {((metrics.views || 0) > 0) && (
                              <div>
                                <span className="text-muted-foreground">Visualizações:</span> <strong>{new Intl.NumberFormat("pt-BR").format(metrics.views || 0)}</strong>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Interações:</span> <strong>{new Intl.NumberFormat("pt-BR").format(metrics.total_interactions || 0)}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Curtidas:</span> <strong>{new Intl.NumberFormat("pt-BR").format(metrics.likes || m.like_count || 0)}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Comentários:</span> <strong>{new Intl.NumberFormat("pt-BR").format(metrics.comments || m.comments_count || 0)}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Compartilh.:</span> <strong>{new Intl.NumberFormat("pt-BR").format((metrics.shares || 0) || (mediaFallbackMap?.[m.media_id]?.shares || 0))}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Salvos:</span> <strong>{new Intl.NumberFormat("pt-BR").format((metrics.saved || 0) || (mediaFallbackMap?.[m.media_id]?.saved || 0))}</strong>
                            </div>
                            {((metrics.views || 0) > 0) && (
                              <div>
                                <span className="text-muted-foreground">Engajamento (%):</span> <strong>{(() => { const denom = metrics.views || 0; const num = (metrics.likes || 0) + (metrics.comments || 0); return ((num / denom) * 100).toFixed(1); })()}</strong>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {m.permalink && (
                              <a href={m.permalink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:text-blue-800">Abrir no Instagram</a>
                            )}
                            <button
                              className="text-xs px-2 py-1 border rounded-md hover:bg-muted"
                              onClick={async () => {
                                const comments = await fetchComments(m.media_id);
                                alert(
                                  comments.length
                                    ? comments
                                        .slice(0, 10)
                                        .map((c) => `${c.username || ""}: ${c.text || ""}`)
                                        .join("\n")
                                    : "Sem comentários recentes"
                                );
                              }}
                            >
                              Ver comentários
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

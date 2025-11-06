export type RecommendationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RecommendationInsight {
  id: string;
  ruleId: string;
  date: string;
  severity: RecommendationSeverity;
  title: string;
  explanation: string;
  actionKind: string;
  actionParams: Record<string, unknown> | null;
  expectedGainPct: number | null;
  status: string;
  account: {
    id: string;
    name: string | null;
  };
  entities: {
    campaign?: { id: string | null; name: string | null };
    adset?: { id: string | null; name: string | null };
    ad?: { id: string | null; name: string | null };
  };
}

export interface SyncInsightsSummary {
  generatedAt: string;
  workspaceId: string;
  platformKey: string;
  period: {
    requestedDays: number;
    startDate: string | null;
    endDate: string | null;
    daysCovered: number;
    dataFreshness: string | null;
  };
  performance: {
    totalSpend: number;
    totalResults: number;
    totalRevenue: number;
    costPerResult: number | null;
    roas: number | null;
    avgDailySpend: number | null;
    avgHealthScore: number | null;
    trend?: {
      recentWindowDays: number;
      recentSpend: number;
      previousSpend: number;
      spendDeltaPct: number | null;
      recentResults: number;
      previousResults: number;
      resultsDeltaPct: number | null;
    };
    topCampaigns: Array<{
      name: string;
      spend: number;
      results: number;
      costPerResult: number | null;
    }>;
    underperformingCampaigns: Array<{
      name: string;
      spend: number;
      results: number;
      costPerResult: number | null;
    }>;
    extra?: {
      ig?: {
        totals: {
          reach: number;
          impressions: number;
          clicks: number;
          profileViews: number;
          accountsEngaged: number;
          totalInteractions: number;
          emailContacts: number;
          phoneCallClicks: number;
          getDirectionsClicks: number;
          textMessageClicks: number;
        };
        recent: {
          impressions: number;
          clicks: number;
          reach: number;
        };
      };
    };
  };
  counts: {
    totalRecommendations: number;
    bySeverity: Record<string, number>;
    opportunities: number;
    risks: number;
  };
  opportunities: RecommendationInsight[];
  risks: RecommendationInsight[];
  notes: string[];
}

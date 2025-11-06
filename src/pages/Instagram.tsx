import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

interface InstagramMetrics {
  impressions: number;
  reach: number;
  profileViews: number;
  websiteClicks: number;
  emailContacts: number;
  phoneCallClicks: number;
}

export default function Instagram() {
  const [dateRange, setDateRange] = useState("7");

  // Fetch Instagram metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["instagram-metrics", dateRange],
    queryFn: async (): Promise<InstagramMetrics | null> => {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      // Get Instagram platform account
      const { data: platformAccounts } = await supabase
        .from("platform_accounts")
        .select("id")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_key", "instagram")
        .limit(1);

      if (!platformAccounts || platformAccounts.length === 0) {
        return null;
      }

      const platformAccountId = platformAccounts[0].id;

      // Fetch metrics from performance_metrics
      const { data: metricsData } = await supabase
        .from("performance_metrics")
        .select("impressions, clicks, extra_metrics")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("platform_account_id", platformAccountId)
        .gte("metric_date", startDateStr)
        .eq("granularity", "day");

      if (!metricsData || metricsData.length === 0) {
        return {
          impressions: 0,
          reach: 0,
          profileViews: 0,
          websiteClicks: 0,
          emailContacts: 0,
          phoneCallClicks: 0,
        };
      }

      // Aggregate metrics
      const aggregated = metricsData.reduce(
        (acc, row) => {
          acc.impressions += row.impressions || 0;
          acc.websiteClicks += row.clicks || 0;

          const extra = row.extra_metrics || {};
          acc.reach += extra.reach || 0;
          acc.profileViews += extra.profile_views || 0;
          acc.emailContacts += extra.email_contacts || 0;
          acc.phoneCallClicks += extra.phone_call_clicks || 0;

          return acc;
        },
        {
          impressions: 0,
          reach: 0,
          profileViews: 0,
          websiteClicks: 0,
          emailContacts: 0,
          phoneCallClicks: 0,
        }
      );

      return aggregated;
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instagram Insights</h1>
          <p className="text-muted-foreground mt-1">
            Métricas e insights do Instagram Business
          </p>
        </div>

        {/* Date Range Selector */}
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

      {/* Metrics Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
      ) : !metrics ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-lg font-semibold mb-2">
                Instagram não configurado
              </p>
              <p className="text-muted-foreground">
                Configure a integração com Instagram para visualizar insights
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Impressões */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Impressões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR").format(metrics.impressions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de vezes que posts foram vistos
              </p>
            </CardContent>
          </Card>

          {/* Alcance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alcance
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

          {/* Visualizações do Perfil */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visualizações do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR").format(metrics.profileViews)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Visitas ao perfil
              </p>
            </CardContent>
          </Card>

          {/* Cliques no Site */}
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
                Cliques no link do site
              </p>
            </CardContent>
          </Card>

          {/* Contatos por Email */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contatos por Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR").format(metrics.emailContacts)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cliques no botão de email
              </p>
            </CardContent>
          </Card>

          {/* Ligações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ligações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR").format(
                  metrics.phoneCallClicks
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cliques no botão de telefone
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Box */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">
                Sobre os Insights do Instagram
              </h3>
              <p className="text-sm text-muted-foreground">
                Os dados do Instagram podem ter até 48 horas de latência. Para
                sincronizar novos dados, use a página de Integrações. Os
                insights incluem métricas de perfil e engajamento de posts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

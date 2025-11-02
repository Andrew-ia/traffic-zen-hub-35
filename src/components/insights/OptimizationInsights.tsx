import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Rocket,
  Target,
  DollarSign,
  MousePointer,
  Calendar,
  Zap
} from "lucide-react";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID;

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeTopPerformerEntry(entry: any): TopPerformer {
  const totalSpend = toNumber(entry.total_spend ?? entry.spend);
  const totalClicks = toNumber(entry.total_clicks ?? entry.clicks);
  const totalImpressions = toNumber(entry.total_impressions ?? entry.impressions);
  const totalConversions = toNumber(entry.total_conversions ?? entry.conversions);
  const totalConversionValue = toNumber(entry.total_conversion_value ?? entry.conversion_value);

  const avgCtrSource = toNumber(entry.avg_ctr);
  const avgCpcSource = toNumber(entry.avg_cpc);

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : avgCtrSource;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : avgCpcSource;

  const primaryConversionAction =
    entry.primary_conversion_action ??
    entry?.derived_metrics?.primary_conversion_action ??
    entry?.extra_metrics?.derived_metrics?.primary_conversion_action ??
    null;

  return {
    ...entry,
    total_spend: totalSpend,
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    total_conversions: totalConversions,
    total_conversion_value: totalConversionValue,
    avg_ctr: avgCtr,
    avg_cpc: avgCpc,
    primary_conversion_action: primaryConversionAction,
  } as TopPerformer;
}

interface TopPerformer {
  id: string;
  name: string;
  campaign_name: string;
  avg_ctr: number;
  avg_cpc: number;
  total_conversions: number;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversion_value?: number;
  primary_conversion_action?: string | null;
}

interface PlatformPerformance {
  platform: string;
  total_spend: number;
  avg_ctr: number;
  avg_cpc: number;
}

interface DailyPerformance {
  day: Date;
  day_name: string;
  daily_conversions: number;
  avg_ctr: number;
}

interface Alert {
  id: string;
  name: string;
  type: 'declining' | 'wasteful';
  severity: 'high' | 'medium';
  metric?: string;
}

export function OptimizationInsights() {
  const { data: topPerformers = [], isLoading: loadingTop } = useQuery({
    queryKey: ['insights', 'top-performers', WORKSPACE_ID],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_performing_adsets', {
        p_workspace_id: WORKSPACE_ID,
        p_days: 30,
        p_limit: 5
      });

      if (error) {
        // Fallback query se RPC não existir
        const { data: fallbackData } = await supabase
          .from('performance_metrics')
          .select(`
            ad_set_id,
            ad_sets!inner(id, name, campaign_id, campaigns!inner(name)),
            spend,
            impressions,
            clicks,
            conversions,
            conversion_value,
            extra_metrics
          `)
          .eq('workspace_id', WORKSPACE_ID)
          .gte('metric_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(100);

        // Process manually
        const grouped = new Map<string, any>();
        fallbackData?.forEach((row: any) => {
          const key = row.ad_set_id;
          const extraRaw = row.extra_metrics;
          const extra =
            typeof extraRaw === 'string'
              ? (() => {
                  try {
                    return JSON.parse(extraRaw);
                  } catch {
                    return {};
                  }
                })()
              : extraRaw ?? {};
          const derivedMetrics = extra?.derived_metrics ?? {};

          if (!grouped.has(key)) {
            grouped.set(key, {
              id: key,
              name: row.ad_sets?.name || 'Unknown',
              campaign_name: row.ad_sets?.campaigns?.name || 'Unknown',
              total_spend: 0,
              total_clicks: 0,
              total_impressions: 0,
              total_conversions: 0,
              total_conversion_value: 0,
              primary_conversion_action: derivedMetrics?.primary_conversion_action ?? null,
            });
          }

          const item = grouped.get(key);
          item.total_spend += Number(row.spend || 0);
          item.total_clicks += Number(row.clicks || 0);
          item.total_impressions += Number(row.impressions || 0);
          item.total_conversions += Number(row.conversions || 0);
          item.total_conversion_value += Number(row.conversion_value || 0);

          if (!item.primary_conversion_action && derivedMetrics?.primary_conversion_action) {
            item.primary_conversion_action = derivedMetrics.primary_conversion_action;
          }
        });

        return Array.from(grouped.values())
          .map((item) => normalizeTopPerformerEntry(item))
          .filter((item) => item.avg_ctr > 1.5 && item.avg_cpc < 3.0)
          .sort((a, b) => b.avg_ctr - a.avg_ctr)
          .slice(0, 5);
      }

      return (data ?? []).map((entry: any) => normalizeTopPerformerEntry(entry));
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const { data: platformPerf = [], isLoading: loadingPlatform } = useQuery({
    queryKey: ['insights', 'platform-performance', WORKSPACE_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('performance_metrics')
        .select(`
          spend,
          ctr,
          cpc,
          ad_sets!inner(targeting)
        `)
        .eq('workspace_id', WORKSPACE_ID)
        .gte('metric_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Group by platform
      const platforms = new Map<string, { spend: number; ctr: number; cpc: number; count: number }>();

      data?.forEach((row: any) => {
        const publishers = row.ad_sets?.targeting?.publisher_platforms || [];
        let platform = 'Outros';

        if (publishers.includes('instagram') && !publishers.includes('facebook')) {
          platform = 'Instagram';
        } else if (publishers.includes('facebook')) {
          platform = 'Facebook';
        } else if (publishers.includes('whatsapp')) {
          platform = 'WhatsApp';
        }

        if (!platforms.has(platform)) {
          platforms.set(platform, { spend: 0, ctr: 0, cpc: 0, count: 0 });
        }

        const p = platforms.get(platform)!;
        p.spend += Number(row.spend || 0);
        p.ctr += Number(row.ctr || 0);
        p.cpc += Number(row.cpc || 0);
        p.count += 1;
      });

      return Array.from(platforms.entries())
        .map(([platform, stats]) => ({
          platform,
          total_spend: stats.spend,
          avg_ctr: stats.ctr / stats.count,
          avg_cpc: stats.cpc / stats.count
        }))
        .filter(p => p.total_spend > 10)
        .sort((a, b) => b.total_spend - a.total_spend) as PlatformPerformance[];
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['insights', 'alerts', WORKSPACE_ID],
    queryFn: async () => {
      // Check for campaigns with declining performance
      const { data } = await supabase
        .from('performance_metrics')
        .select(`
          campaign_id,
          campaigns!inner(id, name, status),
          clicks,
          metric_date
        `)
        .eq('workspace_id', WORKSPACE_ID)
        .eq('campaigns.status', 'active')
        .gte('metric_date', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString())
        .order('metric_date', { ascending: false });

      const campaignStats = new Map<string, { recent: number; previous: number; name: string }>();

      data?.forEach((row: any) => {
        const daysDiff = Math.floor((Date.now() - new Date(row.metric_date).getTime()) / (24 * 60 * 60 * 1000));

        if (!campaignStats.has(row.campaign_id)) {
          campaignStats.set(row.campaign_id, {
            recent: 0,
            previous: 0,
            name: row.campaigns?.name || 'Unknown'
          });
        }

        const stats = campaignStats.get(row.campaign_id)!;
        if (daysDiff < 3) {
          stats.recent += Number(row.clicks || 0);
        } else {
          stats.previous += Number(row.clicks || 0);
        }
      });

      const alertList: Alert[] = [];
      campaignStats.forEach((stats, id) => {
        if (stats.previous > 20 && stats.recent < stats.previous * 0.5) {
          alertList.push({
            id,
            name: stats.name,
            type: 'declining',
            severity: 'high',
            metric: `${stats.recent} vs ${stats.previous} cliques`
          });
        }
      });

      return alertList;
    },
    staleTime: 5 * 60 * 1000
  });

  const bestPlatform = platformPerf.reduce((best, current) =>
    current.avg_ctr > (best?.avg_ctr || 0) ? current : best
  , platformPerf[0]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  if (loadingTop || loadingPlatform || loadingAlerts) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          Insights e Recomendações
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Análise automática com ações recomendadas para otimizar suas campanhas
        </p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Alertas Urgentes ({alerts.length})
            </CardTitle>
            <CardDescription>Campanhas que precisam de atenção imediata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className="p-4 bg-background rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium">{alert.name}</p>
                  <Button size="sm" variant="outline">
                    Revisar
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {alert.type === 'declining' && 'Queda de performance nos últimos 3 dias'}
                    {alert.metric && ` • ${alert.metric}`}
                  </p>
                  <div className="flex items-start gap-2 p-3 bg-orange-50/50 dark:bg-orange-950/30 rounded-md border border-orange-200/50">
                    <div className="mt-0.5">💡</div>
                    <div className="text-sm">
                      <p className="font-medium text-orange-900 dark:text-orange-100 mb-1">Por que agir:</p>
                      <p className="text-orange-800 dark:text-orange-200">
                        {alert.type === 'declining' &&
                          'Campanhas em queda podem estar sofrendo de fadiga de criativo, público saturado ou lance inadequado. Ação rápida evita desperdício de orçamento.'}
                        {alert.type === 'wasteful' &&
                          'Gasto alto sem retorno indica problema sério de segmentação ou criativo. Pausar evita prejuízo maior.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Performers */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Rocket className="h-5 w-5" />
            Oportunidades de Escala ({topPerformers.length})
          </CardTitle>
          <CardDescription>
            Ad sets com excelente performance - considere aumentar orçamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topPerformers.map((adset, idx) => (
            <div key={adset.id} className="flex items-start justify-between p-4 bg-background rounded-lg border hover:shadow-md transition-shadow">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    #{idx + 1}
                  </Badge>
                  <p className="font-medium">{adset.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{adset.campaign_name}</p>

                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatPercent(adset.avg_ctr)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CPC</p>
                    <p className="font-semibold">{formatCurrency(adset.avg_cpc)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Conversões</p>
                    <p className="font-semibold">{Math.floor(adset.total_conversions)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-green-50/50 dark:bg-green-950/30 rounded-md border border-green-200/50">
                  <div className="mt-0.5 text-xs">💡</div>
                  <p className="text-xs text-green-800 dark:text-green-200">
                    <span className="font-medium">Por que escalar:</span> {' '}
                    {adset.avg_ctr > 5
                      ? 'CTR excepcional indica criativos e público muito bem alinhados. Aumente orçamento para maximizar resultados.'
                      : adset.avg_cpc < 1
                      ? 'CPC muito baixo significa alta eficiência. Há espaço para investir mais mantendo lucratividade.'
                      : 'Performance consistente com conversões sólidas. Escalar pode multiplicar resultados sem aumentar risco.'}
                  </p>
                </div>
              </div>

              <div className="ml-4">
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Escalar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform Performance */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Melhor Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestPlatform ? (
              <>
                <div className="text-2xl font-bold mb-2">{bestPlatform.platform}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CTR Médio:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatPercent(bestPlatform.avg_ctr)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPC Médio:</span>
                    <span className="font-semibold">{formatCurrency(bestPlatform.avg_cpc)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Investimento:</span>
                    <span className="font-semibold">{formatCurrency(bestPlatform.total_spend)}</span>
                  </div>
                </div>
                <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                  💡 Considere investir mais nesta plataforma
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Performance Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Badge variant={alerts.length === 0 ? "default" : "destructive"} className="mb-2">
                  {alerts.length === 0 ? "Saudável" : "Precisa Atenção"}
                </Badge>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Oportunidades</p>
                    <p className="text-lg font-bold text-green-600">{topPerformers.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alertas</p>
                    <p className="text-lg font-bold text-orange-600">{alerts.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointer className="h-4 w-4" />
              Próximas Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {topPerformers.length > 0 && (
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5"></div>
                  <span>Aumentar orçamento de {topPerformers.length} ad sets</span>
                </li>
              )}
              {alerts.length > 0 && (
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5"></div>
                  <span>Revisar {alerts.length} campanha(s) em queda</span>
                </li>
              )}
              {bestPlatform && (
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5"></div>
                  <span>Focar mais em {bestPlatform.platform}</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5"></div>
                <span>Monitorar métricas diariamente</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* All Platforms Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo por Plataforma</CardTitle>
          <CardDescription>Performance detalhada de cada plataforma nos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {platformPerf.map(platform => {
              const isBest = platform.platform === bestPlatform?.platform;
              return (
                <div key={platform.platform} className={`p-4 rounded-lg border ${isBest ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'bg-muted/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {platform.platform}
                      {isBest && <Badge variant="default" className="text-xs">Melhor CTR</Badge>}
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(platform.total_spend)} investido
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">CTR Médio</p>
                      <p className="font-semibold">{formatPercent(platform.avg_ctr)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">CPC Médio</p>
                      <p className="font-semibold">{formatCurrency(platform.avg_cpc)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Eficiência</p>
                      <p className="font-semibold">
                        {platform.avg_ctr > 2 && platform.avg_cpc < 2 ? '🔥 Excelente' :
                         platform.avg_ctr > 1 ? '✅ Boa' : '⚠️ Revisar'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

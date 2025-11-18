import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  Users, 
  MousePointer, 
  ShoppingCart, 
  Target, 
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Calendar,
  Globe,
  Smartphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveApiBase } from "@/lib/apiBase";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
import { MetricCard } from "@/components/platform/MetricCard";

const API_BASE = resolveApiBase();

interface GA4Metrics {
  // Overview metrics
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  
  // Google Ads metrics (via GA4)
  googleAds: {
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
    conversionValue: number;
    ctr: number;
    cpc: number;
    roas: number;
  };
  
  // Top pages
  topPages: Array<{
    path: string;
    views: number;
    uniqueViews: number;
  }>;
  
  // Traffic sources
  trafficSources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
  }>;
  
  // Device breakdown
  devices: Array<{
    category: string;
    sessions: number;
    percentage: number;
  }>;
  
  // Conversions
  conversions: Array<{
    eventName: string;
    count: number;
    value: number;
  }>;
}

interface TimeSeriesData {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  googleAdsClicks: number;
  googleAdsCost: number;
  conversions: number;
}

export default function GoogleAnalytics() {
  const [metrics, setMetrics] = useState<GA4Metrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const fetchGA4Data = async (days: string) => {
    setLoading(true);
    try {
      // Fetch main metrics
      const metricsResponse = await fetch(`${API_BASE}/api/ga4/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: process.env.VITE_GA4_PROPERTY_ID,
          startDate: `${days}daysAgo`,
          endDate: "today",
          metrics: ["sessions", "users", "pageviews", "bounceRate", "avgSessionDuration"]
        })
      });

      // Fetch Google Ads data via GA4
      const googleAdsResponse = await fetch(`${API_BASE}/api/ga4/google-ads`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: process.env.VITE_GA4_PROPERTY_ID,
          startDate: `${days}daysAgo`,
          endDate: "today"
        })
      });

      // Fetch time series data
      const timeSeriesResponse = await fetch(`${API_BASE}/api/ga4/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: process.env.VITE_GA4_PROPERTY_ID,
          startDate: `${days}daysAgo`,
          endDate: "today",
          dimensions: ["date"],
          metrics: ["sessions", "users", "pageviews"]
        })
      });

      const [metricsData, googleAdsData, timeSeriesData] = await Promise.all([
        metricsResponse.json(),
        googleAdsResponse.json(),
        timeSeriesResponse.json()
      ]);

      // Mock data structure for now - replace with real API responses
      setMetrics({
        sessions: metricsData.sessions || 1250,
        users: metricsData.users || 892,
        pageviews: metricsData.pageviews || 3420,
        bounceRate: metricsData.bounceRate || 0.35,
        avgSessionDuration: metricsData.avgSessionDuration || 180,
        
        googleAds: {
          clicks: googleAdsData.clicks || 456,
          impressions: googleAdsData.impressions || 12340,
          cost: googleAdsData.cost || 1250.75,
          conversions: googleAdsData.conversions || 23,
          conversionValue: googleAdsData.conversionValue || 2890.50,
          ctr: googleAdsData.ctr || 3.7,
          cpc: googleAdsData.cpc || 2.74,
          roas: googleAdsData.roas || 2.31
        },
        
        topPages: [
          { path: "/", views: 1200, uniqueViews: 980 },
          { path: "/produtos", views: 850, uniqueViews: 720 },
          { path: "/sobre", views: 420, uniqueViews: 380 },
          { path: "/contato", views: 320, uniqueViews: 290 },
          { path: "/blog", views: 280, uniqueViews: 250 }
        ],
        
        trafficSources: [
          { source: "google", medium: "cpc", sessions: 520, users: 450 },
          { source: "google", medium: "organic", sessions: 380, users: 320 },
          { source: "direct", medium: "(none)", sessions: 180, users: 150 },
          { source: "facebook", medium: "social", sessions: 120, users: 100 },
          { source: "instagram", medium: "social", sessions: 50, users: 42 }
        ],
        
        devices: [
          { category: "mobile", sessions: 650, percentage: 52 },
          { category: "desktop", sessions: 480, percentage: 38.4 },
          { category: "tablet", sessions: 120, percentage: 9.6 }
        ],
        
        conversions: [
          { eventName: "purchase", count: 23, value: 2890.50 },
          { eventName: "generate_lead", count: 45, value: 450.00 },
          { eventName: "sign_up", count: 67, value: 0 },
          { eventName: "add_to_cart", count: 156, value: 0 }
        ]
      });

      // Mock time series data
      const mockTimeSeries: TimeSeriesData[] = [];
      const today = new Date();
      for (let i = parseInt(days) - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        mockTimeSeries.push({
          date: date.toISOString().split('T')[0],
          sessions: Math.floor(Math.random() * 200) + 100,
          users: Math.floor(Math.random() * 150) + 80,
          pageviews: Math.floor(Math.random() * 500) + 200,
          googleAdsClicks: Math.floor(Math.random() * 80) + 20,
          googleAdsCost: Math.random() * 200 + 50,
          conversions: Math.floor(Math.random() * 5) + 1
        });
      }
      setTimeSeries(mockTimeSeries);

    } catch (error) {
      console.error("Error fetching GA4 data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do Google Analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGA4Data(dateRange);
  }, [dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Google Analytics 4</h1>
          <p className="text-muted-foreground">Analytics e dados de Google Ads via GA4</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fetchGA4Data(dateRange)} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="googleads">Google Ads</TabsTrigger>
          <TabsTrigger value="traffic">Tráfego</TabsTrigger>
          <TabsTrigger value="conversions">Conversões</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Main Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Sessões"
              value={formatNumber(metrics?.sessions || 0)}
              icon={<Users className="w-5 h-5" />}
              trend={{ value: 12.5, isPositive: true }}
            />
            <MetricCard
              title="Usuários"
              value={formatNumber(metrics?.users || 0)}
              icon={<Globe className="w-5 h-5" />}
              trend={{ value: 8.3, isPositive: true }}
            />
            <MetricCard
              title="Visualizações"
              value={formatNumber(metrics?.pageviews || 0)}
              icon={<BarChart3 className="w-5 h-5" />}
              trend={{ value: 15.2, isPositive: true }}
            />
            <MetricCard
              title="Taxa de Rejeição"
              value={formatPercentage(metrics?.bounceRate || 0)}
              icon={<TrendingUp className="w-5 h-5" />}
              trend={{ value: 2.1, isPositive: false }}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tráfego ao Longo do Tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart
                  data={timeSeries}
                  xAxisKey="date"
                  lines={[
                    { key: "sessions", name: "Sessões", color: "#3b82f6" },
                    { key: "users", name: "Usuários", color: "#10b981" },
                    { key: "pageviews", name: "Visualizações", color: "#f59e0b" }
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dispositivos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.devices.map((device, index) => (
                    <div key={device.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {device.category === 'mobile' && <Smartphone className="w-4 h-4" />}
                        {device.category === 'desktop' && <BarChart3 className="w-4 h-4" />}
                        {device.category === 'tablet' && <PieChart className="w-4 h-4" />}
                        <span className="capitalize">{device.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatNumber(device.sessions)}
                        </span>
                        <Badge variant="outline">
                          {device.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="googleads" className="space-y-6">
          {/* Google Ads Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Cliques"
              value={formatNumber(metrics?.googleAds.clicks || 0)}
              icon={<MousePointer className="w-5 h-5" />}
              trend={{ value: 18.7, isPositive: true }}
            />
            <MetricCard
              title="Impressões"
              value={formatNumber(metrics?.googleAds.impressions || 0)}
              icon={<BarChart3 className="w-5 h-5" />}
              trend={{ value: 7.2, isPositive: true }}
            />
            <MetricCard
              title="Custo"
              value={formatCurrency(metrics?.googleAds.cost || 0)}
              icon={<DollarSign className="w-5 h-5" />}
              trend={{ value: 5.4, isPositive: false }}
            />
            <MetricCard
              title="ROAS"
              value={`${(metrics?.googleAds.roas || 0).toFixed(2)}x`}
              icon={<Target className="w-5 h-5" />}
              trend={{ value: 12.8, isPositive: true }}
            />
          </div>

          {/* Google Ads Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>CTR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(metrics?.googleAds.ctr || 0).toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground">Taxa de cliques</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CPC Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics?.googleAds.cpc || 0)}
                </div>
                <p className="text-sm text-muted-foreground">Custo por clique</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(metrics?.googleAds.conversions || 0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Valor: {formatCurrency(metrics?.googleAds.conversionValue || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Google Ads Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Google Ads</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                data={timeSeries}
                xAxisKey="date"
                lines={[
                  { key: "googleAdsClicks", name: "Cliques", color: "#3b82f6" },
                  { key: "googleAdsCost", name: "Custo", color: "#ef4444" }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Fontes de Tráfego</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.trafficSources.map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{source.source}</div>
                        <div className="text-sm text-muted-foreground">{source.medium}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatNumber(source.sessions)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(source.users)} usuários
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Páginas Mais Visitadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="font-medium text-sm">{page.path}</div>
                      <div className="text-right">
                        <div className="font-medium">{formatNumber(page.views)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(page.uniqueViews)} únicos
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-6">
          {/* Conversion Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total de Conversões"
              value={formatNumber(metrics?.conversions.reduce((acc, conv) => acc + conv.count, 0) || 0)}
              icon={<Target className="w-5 h-5" />}
              trend={{ value: 22.3, isPositive: true }}
            />
            <MetricCard
              title="Valor das Conversões"
              value={formatCurrency(metrics?.conversions.reduce((acc, conv) => acc + conv.value, 0) || 0)}
              icon={<DollarSign className="w-5 h-5" />}
              trend={{ value: 18.7, isPositive: true }}
            />
            <MetricCard
              title="Taxa de Conversão"
              value="2.4%"
              icon={<TrendingUp className="w-5 h-5" />}
              trend={{ value: 0.3, isPositive: true }}
            />
            <MetricCard
              title="Valor Médio"
              value={formatCurrency(125.67)}
              icon={<ShoppingCart className="w-5 h-5" />}
              trend={{ value: 8.9, isPositive: false }}
            />
          </div>

          {/* Conversions Detail */}
          <Card>
            <CardHeader>
              <CardTitle>Conversões por Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.conversions.map((conversion, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{conversion.eventName.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {conversion.value > 0 ? formatCurrency(conversion.value) : 'Sem valor monetário'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{formatNumber(conversion.count)}</div>
                      <div className="text-sm text-muted-foreground">eventos</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversion Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Conversões ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                data={timeSeries}
                xAxisKey="date"
                lines={[
                  { key: "conversions", name: "Conversões", color: "#10b981" }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
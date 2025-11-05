import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useObjectivePerformanceSummary } from "@/hooks/useObjectivePerformanceSummary";

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

const PLATFORM_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  audience_network: "Audience Network",
  other: "Outros",
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "hsl(221, 83%, 53%)", // Azul Facebook
  instagram: "hsl(300, 100%, 50%)", // Rosa/Roxo Instagram
  whatsapp: "hsl(142, 76%, 36%)", // Verde WhatsApp
  messenger: "hsl(214, 89%, 52%)", // Azul Messenger
  audience_network: "hsl(262, 83%, 58%)", // Roxo
  other: "hsl(0, 0%, 60%)", // Cinza
};

interface MetricsListEntry {
  label: string;
  value: number;
  format?: "number" | "currency" | "percent";
  hint?: string;
  hideIfZero?: boolean;
}

interface MetricsListProps {
  entries: MetricsListEntry[];
}

function MetricsList({ entries }: MetricsListProps) {
  const visible = entries.filter((entry) => !(entry.hideIfZero && !entry.value));
  if (visible.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados no período.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {visible.map(({ label, value, format = "number", hint }) => {
        const formatted =
          format === "currency"
            ? formatCurrency(value)
            : format === "percent"
            ? formatPercent(value)
            : formatNumber(value);
        return (
          <li key={label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">
              {formatted}
              {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PlatformBarChart({
  data,
  color = "hsl(var(--chart-2))",
}: {
  data: Array<{ platform: string; value: number }>;
  color?: string;
}) {
  if (!data.length) {
    return <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">Sem dados por plataforma</div>;
  }

  // Map platform names to their colors
  const getPlatformColor = (platformLabel: string): string => {
    // Direct mapping from platform labels to colors
    const colorMap: Record<string, string> = {
      "WhatsApp": "hsl(142, 76%, 36%)", // Verde WhatsApp
      "Instagram": "hsl(300, 100%, 50%)", // Rosa/Roxo Instagram
      "Facebook": "hsl(221, 83%, 53%)", // Azul Facebook
      "Messenger": "hsl(214, 89%, 52%)", // Azul Messenger
      "Audience Network": "hsl(262, 83%, 58%)", // Roxo
      "Outros": "hsl(0, 0%, 60%)", // Cinza
    };

    return colorMap[platformLabel] || color;
  };

  return (
    <div className="h-[140px] sm:h-[160px] lg:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip
          formatter={(value: number) => formatNumber(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getPlatformColor(entry.platform)} />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendLineChart({
  data,
  color = "hsl(var(--chart-1))",
  label = "Valor",
}: {
  data: Array<{ date: string; value: number }>;
  color?: string;
  label?: string;
}) {
  if (!data.length) {
    return <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">Sem tendência disponível</div>;
  }
  return (
    <div className="h-[140px] sm:h-[160px] lg:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip
          formatter={(value: number) => formatNumber(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} name={label} />
      </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SpendValueTrend({ data }: { data: Array<{ date: string; spend: number; value: number }> }) {
  if (!data.length) {
    return <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">Sem dados de tend&ecirc;ncia</div>;
  }
  return (
    <div className="h-[160px] sm:h-[180px] lg:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Legend />
        <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} name="Gasto" />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 2 }} name="Valor" />
      </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ObjectivePerformanceSection({ days = 30 }: { days?: number }) {
  const { data, isLoading, error } = useObjectivePerformanceSummary(days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo por objetivo</CardTitle>
          <CardDescription>Carregando dados de performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Aguarde, carregando métricas.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo por objetivo</CardTitle>
          <CardDescription>Não foi possível carregar os dados agora.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error?.message ?? "Tente novamente mais tarde ou verifique sua conexão."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const engagementPlatforms = data.engagement.conversationsByPlatform.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const trafficPlatforms = data.traffic.conversationsByPlatform.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const leadsPlatforms = data.leads.conversationsByPlatform.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const salesPlatforms = data.sales.breakdown.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const recognitionPlatforms = data.recognition.breakdown.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const appPlatforms = data.app.breakdown.map(({ platform, value }) => ({
    platform: PLATFORM_LABELS[platform] ?? platform,
    value,
  }));

  const hasEngagement =
    data.engagement.totalConversations > 0 ||
    data.engagement.messagingConnections > 0 ||
    data.engagement.likes > 0 ||
    data.engagement.comments > 0 ||
    data.engagement.videoViews > 0;

  const hasTraffic =
    data.traffic.linkClicks > 0 || data.traffic.landingPageViews > 0 || data.traffic.conversationsByPlatform.length > 0;

  const hasLeads =
    data.leads.whatsappConversations > 0 || data.leads.formLeads > 0 || data.leads.conversationsByPlatform.length > 0;

  const hasSales = data.sales.purchases > 0 || data.sales.value > 0 || data.sales.breakdown.length > 0;
  const hasRecognition = data.recognition.reach > 0 || data.recognition.breakdown.length > 0;
  const hasApp = data.app.installs > 0 || data.app.appEngagements > 0 || data.app.breakdown.length > 0;
  const hasExtras = data.extras.totalSpend > 0 || data.extras.totalValue > 0 || data.extras.trend.length > 0;

  const sections = [];

  if (hasEngagement) {
    sections.push(
      <Card key="engagement">
        <CardHeader>
          <CardTitle>📊 Engajamento</CardTitle>
          <CardDescription>Conversas e interações geradas pelas campanhas de engajamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Engajamentos com o post", value: data.engagement.postEngagements, hideIfZero: true },
                {
                  label: "Custo por engajamento",
                  value: data.engagement.costPerEngagement,
                  format: "currency",
                  hideIfZero: true,
                },
                {
                  label: "Conversas iniciadas",
                  value: data.engagement.totalConversations,
                  hint: engagementPlatforms
                    .map((item) => `${item.platform}: ${formatNumber(item.value)}`)
                    .join(" • "),
                  hideIfZero: true,
                },
                {
                  label: "Conexões de mensagem",
                  value: data.engagement.messagingConnections,
                  hideIfZero: true,
                },
                {
                  label: "Visitas ao perfil",
                  value: data.engagement.profileVisits,
                  hideIfZero: true,
                  hint:
                    data.engagement.profileVisits > 0
                      ? `Custo ${formatCurrency(data.engagement.costPerProfileVisit)}`
                      : undefined,
                },
                { label: "Curtidas", value: data.engagement.likes, hideIfZero: true },
                { label: "Comentários", value: data.engagement.comments, hideIfZero: true },
                { label: "Compartilhamentos", value: data.engagement.shares, hideIfZero: true },
                { label: "Salvamentos", value: data.engagement.saves, hideIfZero: true },
                { label: "Visualizações de vídeo", value: data.engagement.videoViews, hideIfZero: true },
              ]}
            />
            <TrendLineChart data={data.engagement.trend} label="Conversas" />
            <PlatformBarChart data={engagementPlatforms} />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (hasTraffic) {
    sections.push(
      <Card key="traffic">
        <CardHeader>
          <CardTitle>🚀 Tráfego</CardTitle>
          <CardDescription>Métricas de campanhas voltadas para tráfego e cliques.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Cliques no link", value: data.traffic.linkClicks },
                {
                  label: "Custo por clique",
                  value: data.traffic.costPerClick,
                  format: "currency",
                  hideIfZero: true,
                },
                { label: "Visualizações de página de destino", value: data.traffic.landingPageViews },
                {
                  label: "Custo por visualização de página",
                  value: data.traffic.costPerLanding,
                  format: "currency",
                  hideIfZero: true,
                },
                {
                  label: "Visitas ao perfil",
                  value: data.traffic.profileVisits,
                  hideIfZero: true,
                  hint:
                    data.traffic.profileVisits > 0
                      ? `Custo ${formatCurrency(data.traffic.costPerProfileVisit)}`
                      : undefined,
                },
                { label: "CTR médio", value: data.traffic.ctr, format: "percent", hideIfZero: true },
                { label: "CPC médio", value: data.traffic.cpc, format: "currency", hideIfZero: true },
              ]}
            />
            <TrendLineChart data={data.traffic.trend} label="Cliques" color="hsl(var(--chart-2))" />
            <PlatformBarChart data={trafficPlatforms} color="hsl(var(--chart-4))" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (hasLeads) {
    sections.push(
      <Card key="leads">
        <CardHeader>
          <CardTitle>🎯 Leads</CardTitle>
          <CardDescription>Conversões e CPL das campanhas de geração de leads.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Conversas via WhatsApp", value: data.leads.whatsappConversations },
                {
                  label: "Custo por conversa",
                  value: data.leads.costPerConversation,
                  format: "currency",
                  hideIfZero: true,
                },
                { label: "Formulários concluídos", value: data.leads.formLeads },
                { label: "Custo por lead (CPL)", value: data.leads.cpl, format: "currency" },
              ]}
            />
            <TrendLineChart data={data.leads.trend} label="Leads" color="hsl(var(--chart-3))" />
            <PlatformBarChart data={leadsPlatforms} color="hsl(var(--chart-5))" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (hasSales) {
    sections.push(
      <Card key="sales">
        <CardHeader>
          <CardTitle>📈 Vendas</CardTitle>
          <CardDescription>Resultados das campanhas com objetivo de conversão e vendas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Compras", value: data.sales.purchases },
                { label: "Valor total", value: data.sales.value, format: "currency" },
                { label: "ROAS", value: data.sales.roas, format: "number" },
                {
                  label: "Custo por compra",
                  value: data.sales.costPerPurchase,
                  format: "currency",
                  hideIfZero: true,
                },
              ]}
            />
            <TrendLineChart data={data.sales.trend} label="Compras" color="hsl(var(--chart-4))" />
            <PlatformBarChart data={salesPlatforms} color="hsl(var(--chart-6))" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (hasRecognition) {
    sections.push(
      <Card key="recognition">
        <CardHeader>
          <CardTitle>📣 Reconhecimento</CardTitle>
          <CardDescription>Campanhas focadas em alcance e reconhecimento de marca.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Alcance", value: data.recognition.reach },
                { label: "Frequência média", value: data.recognition.frequency, format: "number" },
                { label: "CPM médio", value: data.recognition.cpm, format: "currency" },
                {
                  label: "Custo por pessoa alcançada",
                  value: data.recognition.costPerReach,
                  format: "currency",
                  hideIfZero: true,
                },
              ]}
            />
            <TrendLineChart data={data.recognition.trend} label="Alcance" color="hsl(var(--chart-5))" />
            <PlatformBarChart data={recognitionPlatforms} color="hsl(var(--chart-1))" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (hasApp) {
    sections.push(
      <Card key="app">
        <CardHeader>
          <CardTitle>📱 Promoção de App</CardTitle>
          <CardDescription>Indicadores das campanhas de instalação e engajamento de aplicativos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsList
              entries={[
                { label: "Instalações", value: data.app.installs },
                { label: "Custo por instalação (CPI)", value: data.app.cpi, format: "currency" },
                { label: "Engajamentos no app", value: data.app.appEngagements },
                {
                  label: "Custo por engajamento",
                  value: data.app.costPerEngagement,
                  format: "currency",
                  hideIfZero: true,
                },
              ]}
            />
            <TrendLineChart data={data.app.trend} label="Instalações" color="hsl(var(--chart-6))" />
            <PlatformBarChart data={appPlatforms} color="hsl(var(--chart-3))" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  // Bloco "Visão consolidada" removido conforme solicitação

  const hasAnySection = sections.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Resumo por objetivo</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Síntese dos últimos 30 dias ({new Date(data.dateRange.from).toLocaleDateString("pt-BR")} –{" "}
          {new Date(data.dateRange.to).toLocaleDateString("pt-BR")}), agrupado por objetivo de campanha e plataforma.
        </p>
      </div>

      {hasAnySection ? (
        sections
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha sincronizada com objetivos de Engajamento, Tráfego, Leads, Vendas, Reconhecimento ou App.
            Assim que novos objetivos estiverem ativos, os blocos voltarão a aparecer aqui.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

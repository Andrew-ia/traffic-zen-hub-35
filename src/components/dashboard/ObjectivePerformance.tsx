import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ObjectiveCardSkeleton, EmptyDashboardState, ErrorDashboardState } from "./DashboardSkeleton";
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

function formatDateLabel(dateIso: string): string {
  if (!dateIso) return "-";
  const [yearStr, monthStr, dayStr] = dateIso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    return dateIso;
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("pt-BR");
}

const PLATFORM_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  social_media: "Social Media",
  facebook: "Facebook",
  messenger: "Messenger",
  audience_network: "Audience Network",
  other: "Outros",
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "hsl(221, 83%, 53%)", // Azul Facebook
  social_media: "hsl(300, 100%, 50%)", // Rosa/Roxo Social Media
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
      "Social Media": "hsl(300, 100%, 50%)", // Rosa/Roxo Social Media
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

export function ObjectivePerformanceSection({ workspaceId, days = 30 }: { workspaceId: string | null; days?: number }) {
  const { data, isLoading, error } = useObjectivePerformanceSummary(workspaceId, days);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    engagement: false,
    traffic: false,
    leads: false,
    sales: false,
    recognition: false,
    app: false,
  });
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold">Resumo por objetivo</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Carregando dados de performance...
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <ObjectiveCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold">Resumo por objetivo</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Síntese dos últimos {days} dias
          </p>
        </div>
        <ErrorDashboardState
          error={error?.message ?? "Não foi possível carregar os dados de performance"}
        />
      </div>
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

  // Mostrar seção de vendas se houver compras OU se houver gasto em campanhas de vendas
  // Isso permite visualizar campanhas de vendas ativas mesmo sem conversões ainda
  const hasSales = data.sales.purchases > 0 || data.sales.value > 0 || data.sales.spend > 0 || data.sales.breakdown.length > 0;
  const hasRecognition = data.recognition.reach > 0 || data.recognition.breakdown.length > 0;
  const hasApp = data.app.installs > 0 || data.app.appEngagements > 0 || data.app.breakdown.length > 0;
  const hasExtras = data.extras.totalSpend > 0 || data.extras.totalValue > 0 || data.extras.trend.length > 0;

  const sections = [];

  if (hasEngagement) {
    sections.push(
      <Card key="engagement">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>📊 Engajamento</CardTitle>
            <CardDescription>Conversas e interações geradas pelas campanhas de engajamento.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.engagement}
            onClick={() => toggle("engagement")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.engagement ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.engagement && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
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
              <TrendLineChart data={data.engagement.trend} label="Engajamentos" />
              <PlatformBarChart data={engagementPlatforms} />
            </div>
          </CardContent>
        )}
      </Card>,
    );
  }

  if (hasTraffic) {
    sections.push(
      <Card key="traffic">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>🚀 Tráfego</CardTitle>
            <CardDescription>Métricas de campanhas voltadas para tráfego e cliques.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.traffic}
            onClick={() => toggle("traffic")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.traffic ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.traffic && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
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
        )}
      </Card>,
    );
  }

  if (hasLeads) {
    sections.push(
      <Card key="leads">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>🎯 Leads</CardTitle>
            <CardDescription>Conversões e CPL das campanhas de geração de leads.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.leads}
            onClick={() => toggle("leads")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.leads ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.leads && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
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
        )}
      </Card>,
    );
  }

  if (hasSales) {
    sections.push(
      <Card key="sales">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>📈 Vendas</CardTitle>
            <CardDescription>Resultados das campanhas com objetivo de conversão e vendas.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.sales}
            onClick={() => toggle("sales")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.sales ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.sales && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              <MetricsList
                entries={[
                  { label: "Compras", value: data.sales.purchases },
                  { label: "Valor total", value: data.sales.value, format: "currency" },
                  { label: "Gasto", value: data.sales.spend, format: "currency" },
                  { label: "ROAS", value: data.sales.roas, format: "number", hideIfZero: true },
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
        )}
      </Card>,
    );
  }

  if (hasRecognition) {
    sections.push(
      <Card key="recognition">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>📣 Reconhecimento</CardTitle>
            <CardDescription>Campanhas focadas em alcance e reconhecimento de marca.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.recognition}
            onClick={() => toggle("recognition")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.recognition ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.recognition && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
        )}
      </Card>,
    );
  }

  if (hasApp) {
    sections.push(
      <Card key="app">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>📱 Promoção de App</CardTitle>
            <CardDescription>Indicadores das campanhas de instalação e engajamento de aplicativos.</CardDescription>
          </div>
          <button
            aria-expanded={expanded.app}
            onClick={() => toggle("app")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {expanded.app ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CardHeader>
        {expanded.app && (
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
        )}
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
          Síntese dos últimos 30 dias ({formatDateLabel(data.dateRange.from)} – {formatDateLabel(data.dateRange.to)}),
          agrupado por objetivo de campanha e plataforma.
        </p>
      </div>

      {hasAnySection ? (
        sections
      ) : (
        <EmptyDashboardState
          title="Nenhuma campanha encontrada"
          description="Nenhuma campanha sincronizada com objetivos de Engajamento, Tráfego, Leads, Vendas, Reconhecimento ou App. Assim que novos objetivos estiverem ativos, os blocos voltarão a aparecer aqui."
        />
      )}
    </div>
  );
}

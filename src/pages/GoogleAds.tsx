import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { Calendar, TrendingUp, ShoppingCart, Target, DollarSign, MousePointerClick } from "lucide-react";

const PAGE_SIZE = 20;

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function KPICard({ title, value, subtitle, icon, trend, trendUp }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 ${trendUp ? "text-green-600" : "text-red-600"}`}>
            {trendUp ? "↑" : "↓"} {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function GoogleAds() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [accountFilter, setAccountFilter] = useState("all");
  const [campaignType, setCampaignType] = useState("all");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, accountFilter, campaignType]);

  const { data, isLoading, error } = useCampaigns({
    status: statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    platform: "google_ads"
  });

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? campaigns.length;

  // Calcular KPIs agregados
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);
  const totalResults = campaigns.reduce((sum, c) => sum + (c.resultValue ?? 0), 0);
  const avgRoas = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + (c.roas ?? 0), 0) / campaigns.filter(c => c.roas).length
    : 0;
  const avgCostPerResult = totalResults > 0 ? totalSpend / totalResults : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Ads</h1>
          <p className="text-muted-foreground mt-1">Dashboard completo de campanhas do Google Ads</p>
        </div>
      </div>

      {/* Filtros Superiores */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Conta do Google" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {/* Adicionar contas dinamicamente */}
              </SelectContent>
            </Select>

            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="SEARCH">Pesquisa</SelectItem>
                <SelectItem value="DISPLAY">Display</SelectItem>
                <SelectItem value="SHOPPING">Shopping</SelectItem>
                <SelectItem value="VIDEO">Vídeo</SelectItem>
                <SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CampaignStatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="archived">Arquivadas</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar campanhas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Investimento"
          value={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
          }).format(totalSpend)}
          subtitle={`${campaigns.length} campanhas ativas`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KPICard
          title="Conversões"
          value={new Intl.NumberFormat("pt-BR").format(totalResults)}
          subtitle="Total de conversões"
          icon={<Target className="h-4 w-4" />}
        />
        <KPICard
          title="ROAS"
          value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : "-"}
          subtitle="Retorno sobre investimento"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard
          title="Custo por Conversão"
          value={avgCostPerResult > 0 ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(avgCostPerResult) : "-"}
          subtitle="Custo médio"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
      </div>

      {/* Métricas Secundárias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Impressões</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Cliques</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">CTR</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">CPC</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Quality Score</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Impr. Share</div>
            <div className="text-lg font-semibold">-</div>
          </CardContent>
        </Card>
      </div>

      {/* Erro */}
      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">
              Não foi possível carregar as campanhas. Verifique suas permissões no Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Campanhas */}
      <CampaignsTable
        title="Campanhas Google Ads"
        campaigns={campaigns}
        isLoading={isLoading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        showCreateButton={false}
      />

      {/* Placeholder para Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Gráfico de linha será implementado aqui
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo de Campanha</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Gráfico de pizza será implementado aqui
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeDollarSign, Calendar, Flame, Layers, LineChart, Loader2, PackageSearch, RefreshCw, ShieldCheck, ShoppingBag, Store, Truck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  useMercadoLivreCategory,
  useMercadoLivreMarketResearch,
  type MercadoLivreMarketResearchListing,
  type MercadoLivreMarketResearchResponse,
} from '@/hooks/useMercadoLivre';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const ROOT_CATEGORIES = [
  { id: 'MLB3937', name: 'Joias e Relógios' },
  { id: 'MLB1430', name: 'Roupas e Calçados' },
  { id: 'MLB1051', name: 'Celulares e Telefones' },
  { id: 'MLB5672', name: 'Acessórios para Veículos' },
  { id: 'MLB1499', name: 'Indústria e Comércio' },
];

const SCAN_LIMIT_OPTIONS = [20, 40, 60];
const PAGE_SIZE = 10;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

type SellerTypeFilter = 'all' | 'official' | 'mercado_lider' | 'common';
type LogisticsFilter = 'all' | 'full' | 'non_full';
type FreeShippingFilter = 'all' | 'yes' | 'no';
type AgeFilter = 'all' | 'up_to_30' | 'up_to_90' | 'over_90';
type SortFilter = 'opportunity' | 'sold_quantity' | 'sales_per_day' | 'estimated_profit' | 'price_desc' | 'newest';

type SimulatorState = {
  unitCost: string;
  mlFeePct: string;
  paymentFeePct: string;
  taxPct: string;
  packagingCost: string;
  shippingCost: string;
  otherCost: string;
};

type ResearchRow = MercadoLivreMarketResearchListing & {
  estimatedNet: number;
  estimatedProfit: number;
  estimatedMarginPct: number;
  demandScore: number;
  entryEaseScore: number;
  viabilityScore: number;
  opportunityScore: number;
  opportunityLabel: 'Boa oportunidade' | 'Nicho promissor' | 'Mercado saturado';
  difficultyLabel: 'Baixa' | 'Média' | 'Alta';
  createdLabel: string;
  flags: string[];
};

const simulatorDefaults: SimulatorState = {
  unitCost: '12',
  mlFeePct: '16',
  paymentFeePct: '4',
  taxPct: '0',
  packagingCost: '1',
  shippingCost: '7',
  otherCost: '0',
};

const toNumber = (value: string, fallback = 0) => {
  const normalized = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : fallback;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);
const formatNumber = (value: number) => numberFormatter.format(Number.isFinite(value) ? value : 0);
const formatPercent = (value: number) => `${round(value, 1).toFixed(1)}%`;

const formatDate = (value: string | null) => {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem data';
  return parsed.toLocaleDateString('pt-BR');
};

const getDemandCountLabel = (row: MercadoLivreMarketResearchListing) => {
  if (row.demand_source === 'sold_quantity') return `${formatNumber(row.sold_quantity)} vendidos`;
  if (row.reviews_count > 0) return `${formatNumber(row.reviews_count)} reviews`;
  if ((row.total_visits || 0) > 0) return `${formatNumber(row.total_visits || 0)} visitas`;
  return 'Dados limitados';
};

const getDemandRateLabel = (row: MercadoLivreMarketResearchListing) => {
  const rate = row.sales_per_day?.toFixed(2) || '0,00';
  if (row.demand_source === 'sold_quantity') return `${rate} vendas/dia`;
  if (row.reviews_count > 0) return `${rate} reviews/dia`;
  return `${rate} sinal/dia`;
};

const getDemandSourceBadge = (row: MercadoLivreMarketResearchListing) => {
  if (row.demand_source === 'sold_quantity') return 'Venda API';
  if (row.demand_source === 'reviews_proxy') return 'Proxy reviews';
  return 'Base limitada';
};

const sellerTypeLabel: Record<ResearchRow['seller_type'], string> = {
  official: 'Loja oficial',
  mercado_lider: 'Mercado Líder',
  common: 'Vendedor comum',
};

function SectionMetric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const iconTone = tone === 'good'
    ? 'text-emerald-600 bg-emerald-50'
    : tone === 'warn'
      ? 'text-amber-600 bg-amber-50'
      : 'text-blue-600 bg-blue-50';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', iconTone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function TablePager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}

export default function MercadoLivreMarketResearch() {
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
  const [rootCategoryId, setRootCategoryId] = useState('MLB3937');
  const [subcategoryId, setSubcategoryId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanLimit, setScanLimit] = useState('40');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sellerType, setSellerType] = useState<SellerTypeFilter>('all');
  const [logistics, setLogistics] = useState<LogisticsFilter>('all');
  const [freeShipping, setFreeShipping] = useState<FreeShippingFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('opportunity');
  const [simulator, setSimulator] = useState<SimulatorState>(simulatorDefaults);
  const [result, setResult] = useState<MercadoLivreMarketResearchResponse | null>(null);
  const [page, setPage] = useState(1);

  const categoryQuery = useMercadoLivreCategory(workspaceId, rootCategoryId);
  const researchMutation = useMercadoLivreMarketResearch();

  const runResearch = async (options?: { rootCategoryId?: string; subcategoryId?: string; searchTerm?: string; scanLimit?: string }) => {
    const nextRoot = options?.rootCategoryId || rootCategoryId;
    const nextSubcategory = options?.subcategoryId ?? subcategoryId;
    const nextSearchTerm = options?.searchTerm ?? searchTerm;
    const nextScanLimit = options?.scanLimit ?? scanLimit;

    try {
      const response = await researchMutation.mutateAsync({
        workspaceId,
        categoryId: nextRoot,
        subcategoryId: nextSubcategory === 'all' ? null : nextSubcategory,
        searchTerm: nextSearchTerm || null,
        scanLimit: Number(nextScanLimit),
      });
      setResult(response);
      setPage(1);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar a pesquisa de mercado.');
    }
  };

  useEffect(() => {
    setSubcategoryId('all');
  }, [rootCategoryId]);

  const simulatorValues = useMemo(() => ({
    unitCost: toNumber(simulator.unitCost, 0),
    mlFeePct: toNumber(simulator.mlFeePct, 16),
    paymentFeePct: toNumber(simulator.paymentFeePct, 4),
    taxPct: toNumber(simulator.taxPct, 0),
    packagingCost: toNumber(simulator.packagingCost, 1),
    shippingCost: toNumber(simulator.shippingCost, 0),
    otherCost: toNumber(simulator.otherCost, 0),
  }), [simulator]);

  const rows = useMemo<ResearchRow[]>(() => {
    if (!result) return [];

    const maxSold = Math.max(...result.listings.map((item) => item.sold_quantity || 0), 1);
    const maxSalesPerDay = Math.max(...result.listings.map((item) => item.sales_per_day || 0), 0.1);

    return result.listings.map((item) => {
      const variablePct = simulatorValues.mlFeePct + simulatorValues.paymentFeePct + simulatorValues.taxPct;
      const shippingApplied = item.shipping_free_shipping ? simulatorValues.shippingCost : 0;
      const estimatedNet = item.price * (1 - variablePct / 100);
      const estimatedProfit = estimatedNet - simulatorValues.unitCost - simulatorValues.packagingCost - simulatorValues.otherCost - shippingApplied;
      const estimatedMarginPct = item.price > 0 ? (estimatedProfit / item.price) * 100 : 0;

      const demandScore = clamp(
        ((item.sold_quantity / maxSold) * 55) + (((item.sales_per_day || 0) / maxSalesPerDay) * 45)
      );

      const barrierPenalty =
        (item.official_store_id ? 26 : 0)
        + (item.seller_type === 'mercado_lider' ? 14 : 0)
        + (item.logistic_type === 'fulfillment' ? 8 : 0)
        + ((result.summary.top10SellerSharePct > 65) ? 14 : result.summary.top10SellerSharePct > 45 ? 8 : 0)
        + ((result.summary.officialSoldSharePct > 45) ? 12 : result.summary.officialSoldSharePct > 25 ? 6 : 0)
        + (((item.seller_reputation_score || 0) >= 90) ? 6 : 0);
      const entryEaseScore = clamp(100 - barrierPenalty);
      const viabilityScore = clamp(
        ((estimatedMarginPct + 10) * 2.4)
        + (item.price >= simulatorValues.unitCost * 2 ? 10 : 0)
        + (item.shipping_free_shipping ? -5 : 3)
      );
      const opportunityScore = round(
        (demandScore * 0.42) +
        (entryEaseScore * 0.23) +
        (viabilityScore * 0.35),
        1
      );

      const opportunityLabel = opportunityScore >= 72
        ? 'Boa oportunidade'
        : opportunityScore >= 52
          ? 'Nicho promissor'
          : 'Mercado saturado';

      const flags: string[] = [];
      if ((item.ad_age_days ?? 9999) <= 60 && (item.sales_per_day || 0) >= 0.8) flags.push('Recente acelerando');
      if (item.official_store_id) flags.push('Loja oficial');
      if (item.logistic_type === 'fulfillment') flags.push('Full');
      if ((item.sales_per_day || 0) >= 1.2) flags.push('Alta rotação');
      if (estimatedMarginPct >= 20) flags.push('Margem forte');

      return {
        ...item,
        estimatedNet,
        estimatedProfit,
        estimatedMarginPct,
        demandScore: round(demandScore, 1),
        entryEaseScore: round(entryEaseScore, 1),
        viabilityScore: round(viabilityScore, 1),
        opportunityScore,
        opportunityLabel,
        difficultyLabel: entryEaseScore >= 70 ? 'Baixa' : entryEaseScore >= 45 ? 'Média' : 'Alta',
        createdLabel: formatDate(item.date_created),
        flags,
      };
    });
  }, [result, simulatorValues]);

  const filteredRows = useMemo(() => {
    const minPrice = toNumber(priceMin, 0);
    const maxPrice = toNumber(priceMax, 0);

    const nextRows = rows.filter((item) => {
      if (minPrice > 0 && item.price < minPrice) return false;
      if (maxPrice > 0 && item.price > maxPrice) return false;
      if (sellerType !== 'all' && item.seller_type !== sellerType) return false;
      if (logistics === 'full' && item.logistic_type !== 'fulfillment') return false;
      if (logistics === 'non_full' && item.logistic_type === 'fulfillment') return false;
      if (freeShipping === 'yes' && !item.shipping_free_shipping) return false;
      if (freeShipping === 'no' && item.shipping_free_shipping) return false;
      if (ageFilter === 'up_to_30' && (item.ad_age_days ?? Number.POSITIVE_INFINITY) > 30) return false;
      if (ageFilter === 'up_to_90' && (item.ad_age_days ?? Number.POSITIVE_INFINITY) > 90) return false;
      if (ageFilter === 'over_90' && (item.ad_age_days ?? 0) <= 90) return false;
      return true;
    });

    nextRows.sort((a, b) => {
      switch (sortBy) {
        case 'sold_quantity':
          return b.sold_quantity - a.sold_quantity;
        case 'sales_per_day':
          return (b.sales_per_day || 0) - (a.sales_per_day || 0);
        case 'estimated_profit':
          return b.estimatedProfit - a.estimatedProfit;
        case 'price_desc':
          return b.price - a.price;
        case 'newest':
          return (a.ad_age_days ?? Number.POSITIVE_INFINITY) - (b.ad_age_days ?? Number.POSITIVE_INFINITY);
        case 'opportunity':
        default:
          return b.opportunityScore - a.opportunityScore;
      }
    });

    return nextRows;
  }, [ageFilter, freeShipping, logistics, priceMax, priceMin, rows, sellerType, sortBy]);

  const filteredSummary = useMemo(() => {
    const prices = filteredRows.map((row) => row.price);
    const soldTotal = filteredRows.reduce((sum, row) => sum + row.sold_quantity, 0);
    const revenueTotal = filteredRows.reduce((sum, row) => sum + (row.price * row.sold_quantity), 0);
    const uniqueSellers = new Set(filteredRows.map((row) => row.seller_id).filter(Boolean)).size;
    const officialCount = filteredRows.filter((row) => row.official_store_id).length;
    const fullCount = filteredRows.filter((row) => row.logistic_type === 'fulfillment').length;
    const freeShippingCount = filteredRows.filter((row) => row.shipping_free_shipping).length;
    const ageValues = filteredRows.map((row) => row.ad_age_days).filter((value): value is number => value !== null);
    const reputationValues = filteredRows.map((row) => row.seller_reputation_score).filter((value): value is number => value !== null);
    const top10SellerShare = (() => {
      const bucket = new Map<string, number>();
      filteredRows.forEach((row) => {
        if (!row.seller_id) return;
        bucket.set(row.seller_id, (bucket.get(row.seller_id) || 0) + row.sold_quantity);
      });
      const top10 = Array.from(bucket.values()).sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);
      return soldTotal > 0 ? round((top10 / soldTotal) * 100, 1) : 0;
    })();

    const officialSoldShare = soldTotal > 0
      ? round((filteredRows.filter((row) => row.official_store_id).reduce((sum, row) => sum + row.sold_quantity, 0) / soldTotal) * 100, 1)
      : 0;

    const avgOpportunity = filteredRows.length
      ? round(filteredRows.reduce((sum, row) => sum + row.opportunityScore, 0) / filteredRows.length, 1)
      : 0;
    const avgMargin = filteredRows.length
      ? round(filteredRows.reduce((sum, row) => sum + row.estimatedMarginPct, 0) / filteredRows.length, 1)
      : 0;

    const marketLabel = avgOpportunity >= 70
      ? 'Boa oportunidade'
      : avgOpportunity >= 55
        ? 'Nicho promissor'
        : 'Mercado saturado';

    return {
      listingsCount: filteredRows.length,
      soldTotal,
      revenueTotal,
      uniqueSellers,
      officialPct: filteredRows.length ? round((officialCount / filteredRows.length) * 100, 1) : 0,
      fullPct: filteredRows.length ? round((fullCount / filteredRows.length) * 100, 1) : 0,
      freeShippingPct: filteredRows.length ? round((freeShippingCount / filteredRows.length) * 100, 1) : 0,
      averageAge: ageValues.length ? round(ageValues.reduce((sum, value) => sum + value, 0) / ageValues.length, 1) : null,
      avgReputation: reputationValues.length ? round(reputationValues.reduce((sum, value) => sum + value, 0) / reputationValues.length, 1) : null,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      averagePrice: prices.length ? round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0,
      top10SellerShare,
      officialSoldShare,
      recentAccelerators: filteredRows.filter((row) => row.flags.includes('Recente acelerando')).length,
      avgMargin,
      avgOpportunity,
      marketLabel,
      topSellersRange: (() => {
        const top = [...filteredRows].sort((a, b) => b.sold_quantity - a.sold_quantity).slice(0, 10);
        if (!top.length) return { min: 0, max: 0 };
        return {
          min: Math.min(...top.map((item) => item.price)),
          max: Math.max(...top.map((item) => item.price)),
        };
      })(),
    };
  }, [filteredRows]);

  const pagedRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filteredRows.length]);

  const bestSellers = useMemo(() => [...filteredRows].sort((a, b) => b.sold_quantity - a.sold_quantity).slice(0, 8), [filteredRows]);
  const recentWinners = useMemo(() => filteredRows.filter((row) => row.flags.includes('Recente acelerando')).slice(0, 8), [filteredRows]);
  const strongestSubcategories = useMemo(() => {
    if (!result) return [];
    const categoryFilter = subcategoryId === 'all' ? result.subcategories : result.subcategories.filter((item) => item.id === subcategoryId);
    return categoryFilter.slice(0, 8);
  }, [result, subcategoryId]);

  const categoryChildren = categoryQuery.data?.children_categories || result?.category.children_categories || [];

  return (
    <div className="w-full px-4 md:px-6 py-8 space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-950">
            <PackageSearch className="h-8 w-8 text-yellow-500" />
            Pesquisa de Mercado ML
          </h1>
          <p className="mt-2 max-w-4xl text-slate-600">
            Use a pesquisa para validar demanda, entender a força da concorrência e simular margem antes de comprar para revender no Mercado Livre.
          </p>
        </div>

        {result ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4 text-slate-400" />
            Atualizado em {new Date(result.generatedAt).toLocaleString('pt-BR')}
          </div>
        ) : null}
      </div>

      <Card className="overflow-hidden border-slate-200/80 shadow-[0_30px_80px_rgba(15,23,42,0.06)]">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-950">Filtro da pesquisa</CardTitle>
              <CardDescription>
                Defina categoria, profundidade da amostra e os custos estimados. A pesquisa agora roda apenas sob demanda para evitar excesso de requisições no Mercado Livre.
              </CardDescription>
            </div>
            <Button
              onClick={() => runResearch()}
              disabled={researchMutation.isPending}
              className="gap-2 bg-yellow-400 text-slate-950 hover:bg-yellow-300"
            >
              {researchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar pesquisa
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categorias raiz</Label>
            <div className="flex flex-wrap gap-2">
              {ROOT_CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  variant={rootCategoryId === category.id ? 'default' : 'outline'}
                  className={cn(
                    'rounded-full',
                    rootCategoryId === category.id
                      ? 'bg-slate-950 text-white hover:bg-slate-900'
                      : 'bg-white text-slate-700'
                  )}
                  onClick={() => setRootCategoryId(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a categoria</SelectItem>
                  {categoryChildren.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Termo opcional</Label>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ex: pulseira feminina, colar prata"
              />
            </div>

            <div className="space-y-2">
              <Label>Amostra da pesquisa</Label>
              <Select value={scanLimit} onValueChange={setScanLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCAN_LIMIT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} anúncios
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ordenação estratégica</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opportunity">Score de oportunidade</SelectItem>
                    <SelectItem value="sold_quantity">Maior tração</SelectItem>
                    <SelectItem value="sales_per_day">Maior ritmo</SelectItem>
                  <SelectItem value="estimated_profit">Maior lucro estimado</SelectItem>
                  <SelectItem value="price_desc">Maior preço</SelectItem>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Preço mínimo</Label>
              <Input value={priceMin} onChange={(event) => setPriceMin(event.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Preço máximo</Label>
              <Input value={priceMax} onChange={(event) => setPriceMax(event.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de vendedor</Label>
              <Select value={sellerType} onValueChange={(value) => setSellerType(value as SellerTypeFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="official">Loja oficial</SelectItem>
                  <SelectItem value="mercado_lider">Mercado Líder</SelectItem>
                  <SelectItem value="common">Vendedor comum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Logística</Label>
              <Select value={logistics} onValueChange={(value) => setLogistics(value as LogisticsFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="full">Só Full</SelectItem>
                  <SelectItem value="non_full">Sem Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frete grátis</Label>
              <Select value={freeShipping} onValueChange={(value) => setFreeShipping(value as FreeShippingFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Com frete grátis</SelectItem>
                  <SelectItem value="no">Sem frete grátis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idade do anúncio</Label>
              <Select value={ageFilter} onValueChange={(value) => setAgeFilter(value as AgeFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="up_to_30">Até 30 dias</SelectItem>
                  <SelectItem value="up_to_90">Até 90 dias</SelectItem>
                  <SelectItem value="over_90">Mais de 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-950">Simulador de custo para sourcing</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Informe seu custo de compra e as taxas estimadas para a plataforma ranquear quais anúncios parecem mais viáveis para revenda.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
              <div className="space-y-2">
                <Label>Custo unitário</Label>
                <Input value={simulator.unitCost} onChange={(event) => setSimulator((prev) => ({ ...prev, unitCost: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Taxa ML %</Label>
                <Input value={simulator.mlFeePct} onChange={(event) => setSimulator((prev) => ({ ...prev, mlFeePct: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Taxa pagamento %</Label>
                <Input value={simulator.paymentFeePct} onChange={(event) => setSimulator((prev) => ({ ...prev, paymentFeePct: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Imposto %</Label>
                <Input value={simulator.taxPct} onChange={(event) => setSimulator((prev) => ({ ...prev, taxPct: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Embalagem</Label>
                <Input value={simulator.packagingCost} onChange={(event) => setSimulator((prev) => ({ ...prev, packagingCost: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Custo frete grátis</Label>
                <Input value={simulator.shippingCost} onChange={(event) => setSimulator((prev) => ({ ...prev, shippingCost: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Outros custos</Label>
                <Input value={simulator.otherCost} onChange={(event) => setSimulator((prev) => ({ ...prev, otherCost: event.target.value }))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {researchMutation.error ? (
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar a pesquisa</AlertTitle>
          <AlertDescription>{(researchMutation.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {!result && researchMutation.isPending ? (
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-slate-600">Carregando pesquisa de mercado...</p>
        </Card>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-slate-200/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <LineChart className="h-5 w-5 text-blue-600" />
                  Demanda
                </CardTitle>
                <CardDescription>Mostra se o mercado realmente gira e quais sinais de aceleração existem.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SectionMetric icon={ShoppingBag} label="Tração na amostra" value={formatNumber(filteredSummary.soldTotal)} />
                <SectionMetric icon={BadgeDollarSign} label="Potencial bruto" value={formatCurrency(filteredSummary.revenueTotal)} />
                <SectionMetric icon={Flame} label="Recentes acelerando" value={formatNumber(filteredSummary.recentAccelerators)} tone="good" />
                <SectionMetric icon={Layers} label="Anúncios filtrados" value={formatNumber(filteredSummary.listingsCount)} />
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Users className="h-5 w-5 text-blue-600" />
                  Concorrência
                </CardTitle>
                <CardDescription>Ajuda a entender quem domina o mercado e o tamanho real da disputa.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SectionMetric icon={Users} label="Vendedores únicos" value={formatNumber(filteredSummary.uniqueSellers)} />
                <SectionMetric icon={Store} label="Lojas oficiais" value={formatPercent(filteredSummary.officialPct)} tone="warn" />
                <SectionMetric icon={Truck} label="Com Full" value={formatPercent(filteredSummary.fullPct)} />
                <SectionMetric icon={ShieldCheck} label="Concentração top 10" value={formatPercent(filteredSummary.top10SellerShare)} tone="warn" />
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
                  Viabilidade
                </CardTitle>
                <CardDescription>Consolida preço, margem simulada e leitura final de entrada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Leitura do mercado</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-950">{filteredSummary.marketLabel}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Score médio {formatNumber(filteredSummary.avgOpportunity)} / margem média {formatPercent(filteredSummary.avgMargin)}
                      </p>
                    </div>
                    <Badge className="rounded-full bg-white text-emerald-700 shadow-sm">
                      {formatCurrency(filteredSummary.averagePrice)} ticket médio
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SectionMetric icon={BadgeDollarSign} label="Faixa de preço" value={`${formatCurrency(filteredSummary.minPrice)} - ${formatCurrency(filteredSummary.maxPrice)}`} />
                  <SectionMetric icon={PackageSearch} label="Top sellers" value={`${formatCurrency(filteredSummary.topSellersRange.min)} - ${formatCurrency(filteredSummary.topSellersRange.max)}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-200/80">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Termos mais buscados</CardTitle>
                <CardDescription>Use estes termos para descobrir ângulos de produto, naming e sazonalidade.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {result.trends.length === 0 ? (
                  <p className="text-sm text-slate-500">Não foi possível carregar termos de busca para esta categoria.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.trends.slice(0, 12).map((trend) => (
                      <a
                        key={trend.keyword}
                        href={trend.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-yellow-300 hover:bg-yellow-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-sm font-semibold text-yellow-700">
                            {trend.position}
                          </span>
                          <span className="text-sm font-medium text-slate-800">{trend.keyword}</span>
                        </div>
                        <Badge variant="outline">Abrir</Badge>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Subcategorias mais fortes</CardTitle>
                <CardDescription>Mostra onde a demanda está mais concentrada dentro da categoria analisada.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {strongestSubcategories.slice(0, 8).map((subcategory, index) => (
                    <div key={subcategory.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-400">#{index + 1}</span>
                            <p className="font-semibold text-slate-950">{subcategory.name}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatNumber(subcategory.sold_quantity)} de tração · {formatCurrency(subcategory.average_price)} médio · {subcategory.average_sales_per_day.toFixed(2)} ritmo/dia
                          </p>
                        </div>
                        <Badge className="rounded-full bg-slate-100 text-slate-700">{formatCurrency(subcategory.estimated_revenue)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200/80 shadow-[0_30px_80px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b border-slate-200">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <CardTitle>Top oportunidades para revenda</CardTitle>
                  <CardDescription>
                    Ranking combinando demanda, dificuldade de entrada e margem simulada.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Badge variant="outline">Amostra {result.query.scannedListings}</Badge>
                  <Badge variant="outline">Sort API: {result.query.sortApplied}</Badge>
                  <Badge variant="outline">Snapshot {result.snapshotId.slice(0, 8)}</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Tração</TableHead>
                    <TableHead>Ritmo</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead>Concorrente</TableHead>
                    <TableHead>Margem est.</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <img src={row.thumbnail} alt={row.title} className="h-14 w-14 rounded-2xl border border-slate-200 object-cover" />
                          <div className="min-w-0">
                            <a
                              href={row.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-2 font-semibold text-slate-950 hover:text-blue-600"
                            >
                              {row.title}
                            </a>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {row.flags.slice(0, 3).map((flag) => (
                                <Badge key={flag} variant="outline" className="rounded-full bg-white text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.category_name || '—'}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(row.price)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{formatNumber(row.sold_quantity)}</p>
                          <Badge variant="outline" className="rounded-full bg-white text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {getDemandSourceBadge(row)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{getDemandRateLabel(row)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{row.createdLabel}</p>
                          <p className="text-xs text-slate-500">{row.ad_age_days !== null ? `${formatNumber(row.ad_age_days)} dias` : '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{sellerTypeLabel[row.seller_type]}</p>
                          <p className="text-xs text-slate-500">
                            {row.logistic_type === 'fulfillment' ? 'Full' : 'Sem Full'} · Rep. {row.seller_reputation_score !== null ? formatNumber(row.seller_reputation_score) : '—'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className={cn('font-semibold', row.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                            {formatCurrency(row.estimatedProfit)}
                          </p>
                          <p className="text-xs text-slate-500">{formatPercent(row.estimatedMarginPct)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-950">{formatNumber(row.opportunityScore)}</p>
                          <Badge
                            className={cn(
                              'rounded-full',
                              row.opportunityLabel === 'Boa oportunidade'
                                ? 'bg-emerald-100 text-emerald-700'
                                : row.opportunityLabel === 'Nicho promissor'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                            )}
                          >
                            {row.opportunityLabel}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager page={page} totalPages={totalPages} onChange={setPage} />
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-200/80">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Produtos recentes que já aceleraram</CardTitle>
                <CardDescription>Anúncios mais novos que já mostram tração acima da média.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {(recentWinners.length ? recentWinners : filteredRows.slice(0, 6)).slice(0, 6).map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a href={row.permalink} target="_blank" rel="noreferrer" className="line-clamp-1 font-semibold text-slate-950 hover:text-blue-600">
                            {row.title}
                          </a>
                          <p className="mt-1 text-sm text-slate-500">
                            {row.ad_age_days !== null ? `${formatNumber(row.ad_age_days)} dias` : 'Sem data'} · {getDemandRateLabel(row)}
                          </p>
                        </div>
                        <Badge className="rounded-full bg-amber-100 text-amber-700">
                          {formatCurrency(row.price)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Produtos com maior tração</CardTitle>
                <CardDescription>Útil para validar se o produto realmente gira, mesmo em modo seguro só com API oficial.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {bestSellers.slice(0, 6).map((row, index) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-400">#{index + 1}</span>
                            <a href={row.permalink} target="_blank" rel="noreferrer" className="line-clamp-1 font-semibold text-slate-950 hover:text-blue-600">
                              {row.title}
                            </a>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {getDemandCountLabel(row)} · {getDemandRateLabel(row)} · {sellerTypeLabel[row.seller_type]}
                          </p>
                        </div>
                        <Badge className="rounded-full bg-slate-100 text-slate-700">
                          {formatCurrency(row.estimatedProfit)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert className="border-slate-200 bg-slate-50">
            <AlertCircle className="h-4 w-4 text-slate-500" />
            <AlertTitle>Como ler esta pesquisa</AlertTitle>
            <AlertDescription className="space-y-2 text-sm text-slate-600">
              <p>
                Se o produto vende muito, mas a participação de <strong>loja oficial</strong> e a <strong>concentração do top 10</strong> estão altas, a entrada tende a ser mais difícil.
              </p>
              <p>
                Se o anúncio é <strong>recente</strong>, já tem boa <strong>venda por dia</strong> e aparece com <strong>margem estimada saudável</strong>, ele vira um candidato forte para compra e revenda.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {result.notes.map((note) => (
                  <Badge key={note} variant="outline" className="rounded-full bg-white text-slate-600">
                    {note}
                  </Badge>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  );
}

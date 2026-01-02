import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useMercadoAdsCampaigns,
  useRunMercadoAdsAutomation,
  useApplyMercadoAdsAutomation,
  useToggleMercadoAdsCampaign,
  useUpdateMercadoAdsBudget,
} from "@/hooks/useMercadoAds";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Activity, Edit3, Pause, Play, RefreshCw, Rocket, ShieldCheck, Zap, ListChecks } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export default function MercadoAdsCampaigns() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useMercadoAdsCampaigns(workspaceId);
  const { mutateAsync: planAutomation, isPending: isPlanning } = useRunMercadoAdsAutomation();
  const { mutate: applyAutomation, isPending: isApplying } = useApplyMercadoAdsAutomation();
  const { mutate: toggleCampaign, isPending: isToggling } = useToggleMercadoAdsCampaign();
  const { mutate: updateBudget, isPending: isSavingBudget } = useUpdateMercadoAdsBudget();

  const campaigns = data?.campaigns || [];
  const curves = data?.curves || [];
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalBudget = campaigns.reduce((acc, c) => acc + Number(c.daily_budget || 0), 0);
  const totalProducts = campaigns.reduce((acc, c) => acc + Number(c.total_products || 0), 0);
  const totalProductsActive = campaigns.reduce((acc, c) => acc + Number(c.active_products || 0), 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState<string>("");
  const [budgetMap, setBudgetMap] = useState<Record<"A" | "B" | "C", string>>({ A: "", B: "", C: "" });
  const [nameMap, setNameMap] = useState<Record<"A" | "B" | "C", string>>({
    A: "[Curva A] Performance",
    B: "[Curva B] Otimizacao",
    C: "[Curva C] Teste Controlado",
  });
  const [planResult, setPlanResult] = useState<null | any>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const movementsByCurve = useMemo(() => {
    if (!planResult?.movements) return { A: [], B: [], C: [] };
    return {
      A: planResult.movements.filter((m: any) => m.curve === "A"),
      B: planResult.movements.filter((m: any) => m.curve === "B"),
      C: planResult.movements.filter((m: any) => m.curve === "C"),
    };
  }, [planResult]);

  const editingCampaign = campaigns.find((c) => c.id === editingId) || null;

  useEffect(() => {
    if (editingCampaign?.daily_budget) {
      setBudgetValue(String(editingCampaign.daily_budget));
    } else if (editingCampaign?.curve_daily_budget) {
      setBudgetValue(String(editingCampaign.curve_daily_budget));
    }
  }, [editingCampaign]);

  useEffect(() => {
    if (!curves.length) return;
    setBudgetMap((prev) => {
      const next = { ...prev };
      curves.forEach((c) => {
        next[c.curve] = String(c.daily_budget ?? "") || "";
      });
      return next;
    });
    setNameMap((prev) => {
      const next = { ...prev };
      curves.forEach((c) => {
        if (prev[c.curve as "A" | "B" | "C"]) return;
        next[c.curve] = c.name || prev[c.curve as "A" | "B" | "C"];
      });
      return next;
    });
  }, [curves]);

  const summary = useMemo(() => {
    return campaigns.reduce<Record<string, number>>((acc, c) => {
      acc[c.curve] = (acc[c.curve] || 0) + (Number(c.total_products) || 0);
      return acc;
    }, { A: 0, B: 0, C: 0 });
  }, [campaigns]);

  const curveLookup = useMemo(() => {
    const map = new Map<string, typeof curves[number]>();
    curves.forEach((c) => map.set(c.curve, c));
    return map;
  }, [curves]);

  const metrics = data?.metrics || null;

  const kpis = useMemo(() => {
    const s = metrics?.summary;
    return [
      {
        label: "Vendas por Product Ads",
        value: s ? `${s.units.toLocaleString('pt-BR')}` : "—",
        helper: `${totalProductsActive} anúncios ativos (${totalProducts} vinculados)`,
        positive: Boolean(s && s.units > 0),
      },
      {
        label: "Vendas sem Product Ads",
        value: s ? `${s.organic_units.toLocaleString('pt-BR')}` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.organic_units > 0),
      },
      {
        label: "Cliques",
        value: s ? `${s.clicks.toLocaleString('pt-BR')}` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.clicks > 0),
      },
      {
        label: "Receita",
        value: s ? `R$ ${s.revenue.toFixed(2)}` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.revenue > 0),
      },
      {
        label: "ROAS",
        value: s ? `${s.roas.toFixed(2)}x` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.roas > 0),
      },
      {
        label: "ACOS",
        value: s ? `${(s.acos * 100).toFixed(1)}%` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.acos > 0),
      },
      {
        label: "CPC",
        value: s ? `R$ ${s.cpc.toFixed(2)}` : "—",
        helper: s ? "Últimos 30 dias" : "Requer métricas",
        positive: Boolean(s && s.cpc > 0),
      },
    ];
  }, [totalProducts, totalProductsActive, metrics]);

  const chartData = useMemo(() => {
    if (metrics?.daily?.length) {
      return metrics.daily.map((d) => ({
        name: d.date.slice(5), // MM-DD
        vendasAds: d.units || 0,
        vendasOrg: d.organic_units || 0,
        roas: d.roas || 0,
        receita: d.revenue || 0,
      }));
    }
    // Fallback: mantém gráfico mínimo com vendas ativas
    const days = 14;
    return Array.from({ length: days }).map((_, idx) => {
      const day = idx + 1;
      return {
        name: day.toString().padStart(2, "0"),
        vendasAds: totalProductsActive,
        vendasOrg: Math.max(0, totalProducts - totalProductsActive),
        roas: 0,
      };
    });
  }, [metrics?.daily, totalProductsActive, totalProducts]);

  const buildPayload = () => {
    const budgets: Partial<Record<"A" | "B" | "C", number>> = {};
    (["A", "B", "C"] as const).forEach((key) => {
      const num = Number(budgetMap[key]);
      if (Number.isFinite(num) && num > 0) {
        budgets[key] = num;
      }
    });
    return {
      budgets,
      names: nameMap,
    };
  };

  const handlePlan = async () => {
    if (!workspaceId) return;
    try {
      const payload = buildPayload();
      const result = await planAutomation({ workspaceId, ...payload });
      setPlanResult(result);
      setPlanModalOpen(true);
      toast({ title: "Plano gerado", description: "Revise e confirme para aplicar." });
    } catch (err: any) {
      toast({ title: "Erro ao planejar", description: err?.message || "Falha ao planejar automação", variant: "destructive" });
    }
  };

  const handleApply = () => {
    if (!workspaceId || !planResult) return;
    const payload = buildPayload();
    applyAutomation(
      { workspaceId, ...payload },
      {
        onSuccess: () => {
          toast({ title: "Aplicado", description: "Campanhas e itens atualizados." });
          setPlanModalOpen(false);
          setPlanResult(null);
          refetch();
        },
        onError: (err: any) => {
          toast({ title: "Erro ao aplicar", description: err?.message || "Falha ao aplicar automação", variant: "destructive" });
        },
      },
    );
  };

  const handleToggle = (campaignId: string, nextStatus: "active" | "paused") => {
    if (!workspaceId) return;
    toggleCampaign(
      { workspaceId, campaignId, status: nextStatus },
      {
        onSuccess: () => {
          toast({ title: "Status atualizado", description: "Campanha sincronizada com Mercado Ads." });
          refetch();
        },
        onError: (err: any) => {
          toast({ title: "Falha ao atualizar status", description: err?.message || "Erro ao pausar/ativar", variant: "destructive" });
        },
      },
    );
  };

  const handleSaveBudget = () => {
    if (!workspaceId || !editingCampaign) return;
    const parsed = Number(budgetValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Valor inválido", description: "Informe um orçamento diário maior que zero.", variant: "destructive" });
      return;
    }
    updateBudget(
      { workspaceId, campaignId: editingCampaign.id, dailyBudget: parsed },
      {
        onSuccess: () => {
          toast({ title: "Orçamento salvo", description: "Budget atualizado no Mercado Ads." });
          setEditingId(null);
          refetch();
        },
        onError: (err: any) => {
          toast({ title: "Erro ao salvar", description: err?.message || "Não foi possível salvar o orçamento.", variant: "destructive" });
        },
      },
    );
  };

  const renderStatus = (status: string) => {
    const color = status === "active" ? "bg-green-100 text-green-800" : status === "paused" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800";
    return <Badge className={color}>{status}</Badge>;
  };

  const curveBadge = (curve: string) => {
    const map: Record<string, string> = {
      A: "bg-emerald-100 text-emerald-800",
      B: "bg-amber-100 text-amber-800",
      C: "bg-blue-100 text-blue-800",
    };
    return <Badge className={map[curve] || "bg-gray-100 text-gray-800"}>Curva {curve}</Badge>;
  };

  const formatBudget = (value: number | string | null | undefined) => {
    const numeric = Number(value || 0);
    return numeric.toFixed(2);
  };

  const formatNumber = (value: number | string | null | undefined, decimals = 0) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return Number(0).toFixed(decimals);
    return num.toFixed(decimals);
  };

  const handleBudgetMapChange = (curve: "A" | "B" | "C", value: string) => {
    setBudgetMap((prev) => ({ ...prev, [curve]: value }));
  };

  const handleNameMapChange = (curve: "A" | "B" | "C", value: string) => {
    setNameMap((prev) => ({ ...prev, [curve]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs estilo ML */}
      <div className="flex flex-wrap gap-2 items-center border-b pb-2">
        {["Campanhas", "Anúncios patrocinados", "Recomendações", "Relatórios"].map((tab, idx) => (
          <button
            key={tab}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-md",
              idx === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span><strong>{activeCampaigns}</strong> campanhas ativas</span>
          <span><strong>{totalProductsActive}</strong> anúncios ativos</span>
          <span>Budget diário total: <strong>R$ {formatBudget(totalBudget)}</strong></span>
        </div>
      </div>

      {/* Métricas principais + gráfico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Métricas</CardTitle>
          <CardDescription>Painel visual inspirado no Product Ads do ML.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="rounded-lg border p-3 shadow-sm">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {kpi.label}
                </div>
                <div className="text-2xl font-bold mt-1">{kpi.value}</div>
                <div className={cn("text-xs", kpi.positive ? "text-green-600" : "text-muted-foreground")}>
                  {kpi.helper}
                </div>
              </div>
            ))}
          </div>

          <div className="h-[320px] rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">Vendas & ROAS</div>
                <div className="text-xs text-muted-foreground">
                  Dados reais da API Product Ads (30 dias). Vendas orgânicas exibidas quando informadas.
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex gap-3">
                <span>Últimos 30 dias</span>
                <span>Comparado com: Nenhum</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any, key: any) => {
                    if (key === "roas") return [`${Number(value).toFixed(2)}x`, "ROAS"];
                    if (key === "receita") return [`R$ ${Number(value).toFixed(2)}`, "Receita"];
                    return [value, key === "vendasAds" ? "Vendas Product Ads" : "Vendas orgânicas"];
                  }}
                  labelFormatter={(label: any) => `Dia ${label}`}
                  contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))" }}
                />
                <Area type="monotone" dataKey="vendasAds" stackId="1" stroke="#2563eb" fill="#93c5fd" name="Vendas Product Ads" />
                <Area type="monotone" dataKey="vendasOrg" stackId="1" stroke="#22c55e" fill="#bbf7d0" name="Vendas orgânicas" />
                <Area type="monotone" dataKey="roas" stroke="#8b5cf6" fill="#e9d5ff" name="ROAS" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mercado Ads • Campanhas</h1>
          <p className="text-muted-foreground text-sm">
            Gestão das campanhas FODA/SEMI FODA/TESTE com classificação automática por Curva A/B/C.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                await refetch();
                toast({ title: "Atualizado", description: "Campanhas e produtos sincronizados." });
              } catch (err: any) {
                toast({ title: "Erro ao atualizar", description: err?.message || "Falha ao buscar campanhas.", variant: "destructive" });
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" onClick={() => navigate("/mercado-ads/manual")}>
            <ListChecks className="w-4 h-4 mr-2" /> Classificar Manualmente
          </Button>
          <Button onClick={handlePlan} disabled={isPlanning || !workspaceId}>
            {isPlanning ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Planejar automação
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["A", "B", "C"].map((curve) => {
          const cfg = curveLookup.get(curve) || null;
          const total = summary[curve] || 0;
          const budgetInput = budgetMap[curve as "A" | "B" | "C"];
          const budget = budgetInput ? Number(budgetInput) : (cfg?.daily_budget ?? 0);
          return (
            <Card key={curve} className="border border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {curveBadge(curve)}
                  <span>{cfg?.campaign_type || "Automação"}</span>
                </CardTitle>
                <Rocket className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">R$ {formatBudget(budget)}</div>
                <p className="text-xs text-muted-foreground">Orçamento diário configurado</p>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  {total} produtos na curva {curve}
                </div>
                {cfg && (
                  <div className="text-xs text-muted-foreground">
                    Regras: foco em margem e ACOS alvo; sugestão diária padrão R$ {formatBudget(budget)} ajustando conforme lucro.
                  </div>
                )}
                <div className="pt-2 space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome da campanha</label>
                    <Input
                      value={nameMap[curve as "A" | "B" | "C"] || ""}
                      onChange={(e) => handleNameMapChange(curve as "A" | "B" | "C", e.target.value)}
                      placeholder="Ex: [Curva A] Performance"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Budget diário (R$)</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={budgetMap[curve as "A" | "B" | "C"] || ""}
                      onChange={(e) => handleBudgetMapChange(curve as "A" | "B" | "C", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas ativas</CardTitle>
          <CardDescription>Controle de orçamento, status e produtos por curva.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Curva / Tipo</TableHead>
                  <TableHead>Orçamento diário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="font-semibold">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground">Advertiser: {campaign.advertiser_id}</div>
                      <div className="text-xs text-muted-foreground">ID ML: {campaign.ml_campaign_id || "não criado"}</div>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="flex gap-2 items-center">
                        {curveBadge(campaign.curve)}
                        <Badge variant="outline">{campaign.campaign_type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        R$ {formatBudget(campaign.daily_budget ?? campaign.curve_daily_budget ?? 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Regra alvo: {curveLookup.get(campaign.curve)?.campaign_type}</div>
                    </TableCell>
                    <TableCell>{renderStatus(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{campaign.active_products ?? 0} ativos</div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.total_products ?? 0} produtos vinculados
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(campaign.id)}
                          disabled={isSavingBudget}
                        >
                          <Edit3 className="w-4 h-4 mr-1" /> Orçamento
                        </Button>
                        {campaign.status === "paused" ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleToggle(campaign.id, "active")}
                            disabled={isToggling}
                          >
                            <Play className="w-4 h-4 mr-1" /> Ativar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleToggle(campaign.id, "paused")}
                            disabled={isToggling}
                          >
                            <Pause className="w-4 h-4 mr-1" /> Pausar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma campanha cadastrada ainda. Rode a automação para criar as campanhas por curva.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de automação</CardTitle>
            <CardDescription>Como a orquestração roda a cada execução.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2 items-start">
              <Zap className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Classificação por performance</p>
                <p>Analisa faturamento, pedidos 30d, ROAS por item e conversão para definir Curva A/B/C e registra histórico.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Rocket className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Criação/ajuste de campanhas</p>
                <p>Garante campanhas FODA/SEMI FODA/TESTE com budgets configuráveis e status ativo.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Movimentação de itens</p>
                <p>Move produtos para a campanha da curva alvo e pausa vínculos antigos para evitar sobreposição.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Activity className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Ajuste de orçamento</p>
                <p>Atualiza o daily budget de cada campanha no Mercado Ads e no banco, mantendo rastreabilidade.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integração Mercado Ads</CardTitle>
            <CardDescription>Payloads reais com advertiser_id aplicado.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="rounded-md bg-muted p-3 font-mono text-xs">
              POST /advertising/product_ads/advertisers/{"{advertiser_id}"} /campaigns{"\n"}
              {"{ \"name\": \"[A] FODA\", \"status\": \"active\", \"daily_budget\": {\"amount\": 250, \"currency\": \"BRL\"} }"}
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-xs">
              POST /advertising/product_ads/advertisers/{"{advertiser_id}"} /product_ads{"\n"}
              {"{ \"campaign_id\": \"<ml_campaign_id>\", \"item_id\": \"MLB123\", \"status\": \"active\", \"bid\": {\"max_cpc\": 0.9} }"}
            </div>
            <p>O <strong>advertiser_id</strong> usa MERCADO_ADS_ADVERTISER_ID ou o userId OAuth salvo. Respeitamos header api-version=2 e limites de rate (batch com 5 reqs).</p>
            <p>Boas práticas: budgets como variáveis (ML_ADS_BUDGET_A/B/C), bids separados por curva e limpeza de vínculos antigos ao mover produtos.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar orçamento diário</DialogTitle>
            <DialogDescription>Atualiza no Mercado Ads e na tabela ml_ads_campaigns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Valor (R$)</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button onClick={handleSaveBudget} disabled={isSavingBudget}>
              {isSavingBudget ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planModalOpen} onOpenChange={(open) => setPlanModalOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Plano de automação</DialogTitle>
            <DialogDescription>Revise o que será criado/atualizado antes de aplicar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!planResult && <p className="text-sm text-muted-foreground">Gere um plano para visualizar.</p>}
            {planResult && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Campanhas</h4>
                  <div className="space-y-2">
                    {planResult.planCampaigns.map((c: any) => (
                      <div key={c.curve} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {curveBadge(c.curve)}
                            <span className="font-medium">{c.name}</span>
                          </div>
                          <Badge variant="outline">{c.action === "create" ? "Criar" : "Atualizar"}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Budget: R$ {formatBudget(c.budget)} • Campanha atual: {c.mlCampaignId || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Movimentação de itens</h4>
                  <p className="text-xs text-muted-foreground">
                    Total por curva — A: {planResult.summary?.A || 0} • B: {planResult.summary?.B || 0} • C: {planResult.summary?.C || 0}
                  </p>
                  {(["A", "B", "C"] as const).map((curveKey) => {
                    const list = movementsByCurve[curveKey] || [];
                    if (!list.length) return null;
                    return (
                      <div key={curveKey} className="border border-border rounded-md">
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            {curveBadge(curveKey)}
                            <span className="text-sm font-medium">{list.length} produtos</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Mostrar motivo e métricas</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-border/70">
                          {list.map((item: any) => (
                            <div key={`${item.mlItemId}-${item.productId}`} className="px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{item.title || item.mlItemId}</span>
                                <span className="text-xs text-muted-foreground">SKU: {item.sku || "—"}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.reason || "Motivo não informado"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex gap-4">
                                <span>Vendas 30d: {item.sales30d ?? 0}</span>
                                <span>Receita 30d: R$ {formatBudget(item.revenue30d)}</span>
                                <span>ACOS: {Number.isFinite(item.acos) ? `${(item.acos * 100).toFixed(1)}%` : "—"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleApply} disabled={isApplying || !planResult}>
              {isApplying ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreAdvancedSearch, MercadoLivreProduct } from "@/hooks/useMercadoLivre";
import { useMLCategories, useMLCategoryDetails } from "@/hooks/useMercadoLivreCategories";
import { ExternalLink, Search, Copy, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ResultItem = MercadoLivreProduct & {
  sold_quantity?: number;
  monthly_estimate?: number;
  visits_last_period?: number;
  conversion_rate_estimate?: number;
};

export default function MercadoLivreAdvancedSearch() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const categories = useMLCategories(workspaceId || undefined);
  const [categoryId, setCategoryId] = useState<string>("");
  const categoryDetails = useMLCategoryDetails(categoryId || null, workspaceId);
  const subcats = useMemo(() => {
    const children = (categoryDetails.data?.category?.children_categories || []) as Array<{ id: string; name: string }>;
    return children;
  }, [categoryDetails.data]);

  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [minMonthly, setMinMonthly] = useState<number | undefined>(undefined);
  const [maxMonthly, setMaxMonthly] = useState<number | undefined>(undefined);
  const [started, setStarted] = useState(false);

  const searchParams = useMemo(() => ({
    categoryId,
    subcategoryId: subcategoryId || undefined,
    periodDays,
    minMonthlySales: typeof minMonthly === "number" ? minMonthly : undefined,
    maxMonthlySales: typeof maxMonthly === "number" ? maxMonthly : undefined,
    limit: 50,
    offset: 0,
  }), [categoryId, subcategoryId, periodDays, minMonthly, maxMonthly]);

  const advSearch = useMercadoLivreAdvancedSearch(workspaceId, searchParams);

  useEffect(() => {
    if (advSearch.data?.items && started) {
      try {
        sessionStorage.setItem(
          "ml_advanced_search_results",
          JSON.stringify({ params: searchParams, data: advSearch.data })
        );
      } catch (e) { /* ignore */ }
    }
  }, [advSearch.data, started, searchParams]);

  const handleRunSearch = () => {
    if (!categoryId) {
      toast({ title: "Selecione a categoria", description: "A categoria principal é obrigatória", variant: "destructive" });
      return;
    }
    setStarted(true);
    advSearch.refetch?.();
  };

  const exportCsv = () => {
    const items = advSearch.data?.items || [];
    if (items.length === 0) {
      toast({ title: "Nada para exportar", description: "Execute uma busca primeiro." });
      return;
    }
    const headers = [
      "id",
      "title",
      "price",
      "sold_quantity",
      "monthly_estimate",
      "visits_last_period",
      "conversion_rate_estimate",
      "category",
      "permalink",
    ];
    const rows = items.map((it: ResultItem) => [
      it.id,
      it.title?.replace(/"/g, '""'),
      String(it.price ?? 0),
      String(it.sold_quantity ?? 0),
      String(it.monthly_estimate ?? 0),
      String(it.visits_last_period ?? 0),
      String(it.conversion_rate_estimate?.toFixed ? it.conversion_rate_estimate.toFixed(2) : it.conversion_rate_estimate ?? 0),
      it.category,
      it.permalink || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => typeof v === "string" && v.includes(',') ? `"${v}"` : v).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ml-busca-avancada-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!workspaceId) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Mercado Livre</h1>
        <p className="text-muted-foreground">Selecione um workspace para continuar.</p>
      </div>
    );
  }

  const summary = advSearch.data?.summary;
  const items: ResultItem[] = advSearch.data?.items || [];
  const searchError = advSearch.error instanceof Error ? advSearch.error.message : null;

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Busca Avançada ML</h1>
          <p className="text-sm text-muted-foreground">Filtre e analise anúncios por categoria, período e volume mensal.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
          <Button variant="outline" onClick={() => navigate("/mercado-livre")}>Voltar ao Dashboard</Button>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-base font-semibold flex items-center gap-2"><Filter className="h-4 w-4" /> Parâmetros de Busca</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Categoria (obrigatório)</label>
            <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.isLoading ? (
                  <div className="p-2 text-xs text-muted-foreground">Carregando categorias...</div>
                ) : (categories.data?.categories || []).length > 0 ? (
                  (categories.data?.categories || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-xs text-muted-foreground">Nenhuma categoria disponível</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Subcategoria (opcional)</label>
            <Select value={subcategoryId} onValueChange={setSubcategoryId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={categoryId ? "Selecione" : "Escolha a categoria primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {subcats.length > 0 ? subcats.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                )) : (
                  <div className="p-2 text-xs text-muted-foreground">Sem subcategorias disponíveis</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Período</label>
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Min. vendas/mês</label>
              <Input type="number" min={0} value={minMonthly ?? ""} onChange={(e) => setMinMonthly(e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div>
              <label className="text-sm font-medium">Max. vendas/mês</label>
              <Input type="number" min={0} value={maxMonthly ?? ""} onChange={(e) => setMaxMonthly(e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          </div>

          <div className="md:col-span-4 flex justify-end">
            <Button onClick={handleRunSearch} disabled={!categoryId || advSearch.isLoading} className="gap-2">
              <Search className="h-4 w-4" /> {advSearch.isLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchError && (
        <Alert variant="destructive" className="border-border/60">
          <AlertTitle>Erro na busca avançada</AlertTitle>
          <AlertDescription className="text-sm">{searchError}</AlertDescription>
        </Alert>
      )}

      {advSearch.isLoading && (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
        </div>
      )}

      {!advSearch.isLoading && items.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20 flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Resultados</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{summary?.total_returned} anúncios retornados • Preço médio {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary?.average_price || 0)}</p>
            </div>
            <div>
              {subcategoryId && (
                <span className="text-xs text-muted-foreground">Subcategoria selecionada: {subcategoryId}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 overflow-x-auto">
            <Table className="w-full min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>MLB ID</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Vendas totais</TableHead>
                  <TableHead className="text-right">Venda/mês (est.)</TableHead>
                  <TableHead className="text-right">Visitas período</TableHead>
                  <TableHead className="text-right">Conv. (est.)</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: ResultItem) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {it.thumbnail && (<img src={it.thumbnail} alt={it.title} className="h-10 w-10 rounded object-cover" />)}
                        <span className="truncate max-w-[400px]">{it.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">{it.id}</code>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={async () => {
                          try { await navigator.clipboard.writeText(it.id); toast({ title: "Copiado!", description: "MLB ID copiado" }); } catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
                        }} title="Copiar MLB ID"><Copy className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(it.price ?? 0)}</TableCell>
                    <TableCell className="text-right">{it.sold_quantity ?? 0}</TableCell>
                    <TableCell className="text-right">{it.monthly_estimate ?? 0}</TableCell>
                    <TableCell className="text-right">{new Intl.NumberFormat("pt-BR").format(it.visits_last_period ?? 0)}</TableCell>
                    <TableCell className="text-right">{it.conversion_rate_estimate ? `${it.conversion_rate_estimate.toFixed(1)}%` : "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => navigate(`/mercado-livre-analyzer?mlb=${it.id}`)}>
                          <Search className="h-3 w-3 mr-1" /> Analisar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => window.open(it.permalink || `https://mercadolivre.com.br/p/${it.id}`, '_blank')} title="Ver no Mercado Livre">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!advSearch.isLoading && items.length === 0 && started && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Nenhum anúncio encontrado para os critérios selecionados.</p>
        </div>
      )}
    </div>
  );
}

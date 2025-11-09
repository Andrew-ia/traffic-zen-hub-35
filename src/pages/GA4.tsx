import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gtmPush, initGtm, isValidGtmId } from "@/lib/gtm";

const EVENT_LABELS: Record<string, string> = {
  page_view: "Visualização de página",
  session_start: "Início de sessão",
  user_engagement: "Engajamento de usuário",
  view_item_list: "Visualização de lista",
  view_item: "Visualização de item",
  select_item: "Seleção de item",
  add_to_cart: "Adicionar ao carrinho",
  view_cart: "Visualização do carrinho",
  remove_from_cart: "Remover do carrinho",
  begin_checkout: "Início do checkout",
  add_shipping_info: "Adicionar informações de envio",
  add_payment_info: "Adicionar informações de pagamento",
  purchase: "Compra",
  refund: "Reembolso",
  generate_lead: "Gerar lead",
  login: "Login",
  sign_up: "Cadastro",
  search: "Busca",
  view_promotion: "Visualização de promoção",
  select_promotion: "Seleção de promoção",
  share: "Compartilhar",
  click: "Clique",
  scroll: "Scroll",
  file_download: "Download de arquivo",
  tutorial_begin: "Início de tutorial",
  tutorial_complete: "Conclusão de tutorial",
};

const STORAGE_KEY = "trafficpro.gtm.config";

interface GtmConfig {
  containerId: string;
  enablePageView: boolean;
}

export default function GA4() {
  const defaultId = import.meta.env.VITE_GTM_ID || "";
  const DEFAULT_GA4_ID = import.meta.env.VITE_GA4_PROPERTY_ID || "497704603";
  const [containerId, setContainerId] = useState<string>(defaultId);
  const [enablePageView, setEnablePageView] = useState<boolean>(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState<boolean>(false);

  // GA4 viewer config (read-only)
  const GA4_STORAGE_KEY = "trafficpro.ga4.config";
  const GA4_PREFS_STORAGE_KEY = "trafficpro.ga4.prefs";
  const [ga4PropertyId, setGa4PropertyId] = useState<string>("");
  const [realtimeData, setRealtimeData] = useState<Array<{ eventName: string; eventCount: number }>>([]);
  const [reportData, setReportData] = useState<Array<{ eventName: string; eventCount: number }>>([]);
  const [loadingRealtime, setLoadingRealtime] = useState<boolean>(false);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [errorRealtime, setErrorRealtime] = useState<string | null>(null);
  const [errorReport, setErrorReport] = useState<string | null>(null);
  // Auto atualização e timestamps
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [refreshSeconds, setRefreshSeconds] = useState<number>(30);
  const [lastUpdatedRealtime, setLastUpdatedRealtime] = useState<number | null>(null);
  const [lastUpdatedReport, setLastUpdatedReport] = useState<number | null>(null);
  // Filtros e preferências
  const [filterHidePageView, setFilterHidePageView] = useState<boolean>(false);
  const [filterHideUserEngagement, setFilterHideUserEngagement] = useState<boolean>(false);
  const [filterHideZeros, setFilterHideZeros] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [topN, setTopN] = useState<number>(10);
  const [reportDays, setReportDays] = useState<number>(7);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GtmConfig>;
        if (parsed.containerId) setContainerId(parsed.containerId);
        if (typeof parsed.enablePageView === "boolean") setEnablePageView(parsed.enablePageView);
        setLoadedFromStorage(true);
      }
    } catch (e) {
      console.warn("Falha ao carregar config GTM do storage", e);
    }

    try {
      const rawGa4 = window.localStorage.getItem(GA4_STORAGE_KEY);
      if (rawGa4) {
        const parsedGa4 = JSON.parse(rawGa4) as { propertyId?: string };
        if (parsedGa4.propertyId) {
          setGa4PropertyId(parsedGa4.propertyId);
        } else {
          setGa4PropertyId(DEFAULT_GA4_ID);
          window.localStorage.setItem(
            GA4_STORAGE_KEY,
            JSON.stringify({ propertyId: DEFAULT_GA4_ID })
          );
        }
      } else {
        setGa4PropertyId(DEFAULT_GA4_ID);
        window.localStorage.setItem(
          GA4_STORAGE_KEY,
          JSON.stringify({ propertyId: DEFAULT_GA4_ID })
        );
      }
    } catch (e) {
      console.warn("Falha ao carregar config GA4 do storage", e);
    }
    // Carregar preferências
    try {
      const rawPrefs = window.localStorage.getItem(GA4_PREFS_STORAGE_KEY);
      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs) as Partial<{ autoRefreshEnabled: boolean; refreshSeconds: number; filterHidePageView: boolean; filterHideUserEngagement: boolean; filterHideZeros: boolean; searchQuery: string; topN: number; reportDays: number }>;
        if (typeof prefs.autoRefreshEnabled === "boolean") setAutoRefreshEnabled(prefs.autoRefreshEnabled);
        if (typeof prefs.refreshSeconds === "number") setRefreshSeconds(prefs.refreshSeconds);
        if (typeof prefs.filterHidePageView === "boolean") setFilterHidePageView(prefs.filterHidePageView);
        if (typeof prefs.filterHideUserEngagement === "boolean") setFilterHideUserEngagement(prefs.filterHideUserEngagement);
        if (typeof prefs.filterHideZeros === "boolean") setFilterHideZeros(prefs.filterHideZeros);
        if (typeof prefs.searchQuery === "string") setSearchQuery(prefs.searchQuery);
        if (typeof prefs.topN === "number") setTopN(prefs.topN);
        if (typeof prefs.reportDays === "number") setReportDays(prefs.reportDays);
      }
    } catch (e) {
      console.warn("Falha ao carregar preferências GA4 do storage", e);
    }
  }, [DEFAULT_GA4_ID, GA4_STORAGE_KEY, GA4_PREFS_STORAGE_KEY]);

  // Persistir preferências
  useEffect(() => {
    try {
      window.localStorage.setItem(
        GA4_PREFS_STORAGE_KEY,
        JSON.stringify({
          autoRefreshEnabled,
          refreshSeconds,
          filterHidePageView,
          filterHideUserEngagement,
          filterHideZeros,
          searchQuery,
          topN,
          reportDays,
        })
      );
    } catch (e) {
      console.warn("Falha ao salvar preferências GA4", e);
    }
  }, [autoRefreshEnabled, refreshSeconds, filterHidePageView, filterHideUserEngagement, filterHideZeros, searchQuery, topN, reportDays]);

  const isConfigured = useMemo(() => !!containerId && containerId.trim().length > 0, [containerId]);

  const handleSave = () => {
    const id = containerId.trim();
    if (id && !isValidGtmId(id)) {
      gtmPush("gtm_invalid_id", { container_id: id });
      alert("ID do GTM inválido. Use o formato GTM-XXXXXXX.");
      return;
    }

    const config: GtmConfig = { containerId: id, enablePageView };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      if (id) initGtm(id);
      gtmPush("gtm_config_saved", { container_id: id || "(env)", enable_page_view: config.enablePageView });
    } catch (e) {
      console.error("Erro ao salvar configuração GTM:", e);
      alert("Falha ao salvar a configuração. Veja o console para detalhes.");
    }
  };

  const handleTestEvent = () => {
    gtmPush("gtm_test_event", { page_path: window.location.pathname, ts: Date.now() });
  };

  const saveGa4Config = () => {
    try {
      window.localStorage.setItem(
        GA4_STORAGE_KEY,
        JSON.stringify({ propertyId: ga4PropertyId.trim() })
      );
    } catch (e) {
      console.error("Erro ao salvar config GA4:", e);
    }
  };

  const translateEvent = useCallback((name: string) => EVENT_LABELS[name] ?? name, []);

  const fetchRealtime = useCallback(async () => {
    setLoadingRealtime(true);
    setErrorRealtime(null);
    try {
      const property = ga4PropertyId.trim();
      if (!property) throw new Error("Informe o GA4 Property ID.");
      const resp = await fetch(`/api/ga4/realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Erro ${resp.status}: ${text}`);
      }
      const { data } = await resp.json();
      // Suporta novo formato (objeto com chaves) e formato antigo (arrays dimensionValues/metricValues)
      const rows = (data.rows || []).map((r: any) => {
        const eventName = r?.eventName ?? r?.dimensionValues?.[0]?.value ?? "(sem nome)";
        const eventCountRaw =
          typeof r?.eventCount !== "undefined"
            ? r?.eventCount
            : r?.metricValues?.[0]?.value ?? 0;
        const eventCount = Number(eventCountRaw) || 0;
        return { eventName, eventCount };
      });
      setRealtimeData(rows);
      setLastUpdatedRealtime(Date.now());
    } catch (e: any) {
      setErrorRealtime(e?.message || String(e));
    } finally {
      setLoadingRealtime(false);
    }
  }, [ga4PropertyId]);

  const fetchReportLast7Days = useCallback(async () => {
    setLoadingReport(true);
    setErrorReport(null);
    try {
      const property = ga4PropertyId.trim();
      if (!property) throw new Error("Informe o GA4 Property ID.");
      const resp = await fetch(`/api/ga4/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property, days: reportDays }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Erro ${resp.status}: ${text}`);
      }
      const { data } = await resp.json();
      // Suporta novo formato (objeto com chaves) e formato antigo (arrays dimensionValues/metricValues)
      const rows = (data.rows || []).map((r: any) => {
        const eventName = r?.eventName ?? r?.dimensionValues?.[1]?.value ?? r?.dimensionValues?.[0]?.value ?? "(sem nome)";
        const eventCountRaw =
          typeof r?.eventCount !== "undefined"
            ? r?.eventCount
            : r?.metricValues?.[0]?.value ?? 0;
        const eventCount = Number(eventCountRaw) || 0;
        return { eventName, eventCount };
      });
      setReportData(rows);
      setLastUpdatedReport(Date.now());
    } catch (e: any) {
      setErrorReport(e?.message || String(e));
    } finally {
      setLoadingReport(false);
    }
  }, [ga4PropertyId, reportDays]);

  // Auto atualização em tempo real
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const property = ga4PropertyId.trim();
    if (!property) return;
    const intervalMs = Math.max(5, refreshSeconds) * 1000;
    const id = setInterval(() => {
      fetchRealtime();
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, refreshSeconds, ga4PropertyId, fetchRealtime]);

  // Dados derivados com filtros/busca/ordenação/topN
  const realtimeView = useMemo(() => {
    let rows = [...realtimeData];
    if (filterHidePageView) rows = rows.filter((r) => r.eventName !== "page_view");
    if (filterHideUserEngagement) rows = rows.filter((r) => r.eventName !== "user_engagement");
    if (filterHideZeros) rows = rows.filter((r) => r.eventCount > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.eventName.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b.eventCount - a.eventCount);
    rows = rows.slice(0, Math.max(1, topN));
    return rows.map((r) => ({ ...r, label: translateEvent(r.eventName) }));
  }, [realtimeData, filterHidePageView, filterHideUserEngagement, filterHideZeros, searchQuery, topN, translateEvent]);

  const reportView = useMemo(() => {
    let rows = [...reportData];
    if (filterHidePageView) rows = rows.filter((r) => r.eventName !== "page_view");
    if (filterHideUserEngagement) rows = rows.filter((r) => r.eventName !== "user_engagement");
    if (filterHideZeros) rows = rows.filter((r) => r.eventCount > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.eventName.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b.eventCount - a.eventCount);
    rows = rows.slice(0, Math.max(1, topN));
    return rows.map((r) => ({ ...r, label: translateEvent(r.eventName) }));
  }, [reportData, filterHidePageView, filterHideUserEngagement, filterHideZeros, searchQuery, topN, translateEvent]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Analytics 4 (GA4)</h1>
          <p className="text-muted-foreground mt-1">Visualize dados do GA4 e gerencie a configuração do GTM.</p>
        </div>
        {isConfigured ? (
          <Badge variant="default">GTM configurado</Badge>
        ) : (
          <Badge variant="secondary">GTM não configurado</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gtmId">GTM Container ID</Label>
            <Input id="gtmId" placeholder="GTM-XXXXXXX" value={containerId} onChange={(e) => setContainerId(e.target.value)} />
            <p className="text-xs text-muted-foreground">Se vazio, será usado o valor de `VITE_GTM_ID` do ambiente.</p>
            {loadedFromStorage && (
              <p className="text-xs text-muted-foreground">Carregado de configurações locais.</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch id="pageview" checked={enablePageView} onCheckedChange={setEnablePageView} />
            <Label htmlFor="pageview">Enviar `page_view` em mudanças de rota</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave}>Salvar e Inicializar</Button>
            <Button variant="outline" onClick={handleTestEvent}>Enviar evento de teste</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visualizador GA4 (somente leitura)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Visualização só-leitura via backend seguro. Informe seu <strong>GA4 Property ID</strong> (ex.: 123456789). O acesso
            à API é feito por <strong>conta de serviço</strong> configurada no servidor.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
              <Input id="ga4PropertyId" placeholder="123456789" value={ga4PropertyId} onChange={(e) => setGa4PropertyId(e.target.value)} />
              <p className="text-xs text-muted-foreground">ID ativo: {ga4PropertyId || DEFAULT_GA4_ID}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveGa4Config} variant="outline">Salvar Credenciais Locais</Button>
            <Button onClick={fetchRealtime} disabled={loadingRealtime}>
              {realtimeData.length > 0 ? "Atualizar tempo real" : "Carregar eventos em tempo real"}
            </Button>
            <Button onClick={fetchReportLast7Days} disabled={loadingReport}>
              {reportData.length > 0 ? `Atualizar relatório (${reportDays} dias)` : `Eventos últimos ${reportDays} dias`}
            </Button>
          </div>

          {errorRealtime && <p className="text-sm text-red-500">Realtime: {errorRealtime}</p>}
          {errorReport && <p className="text-sm text-red-500">Report: {errorReport}</p>}

          <div className="grid gap-6 md:grid-cols-2 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Tempo real</h3>
              <div className="flex items-center gap-3 mb-3">
                <Switch id="autoRefresh" checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
                <Label htmlFor="autoRefresh">Auto atualizar</Label>
                <Input
                  className="w-20"
                  type="number"
                  min={5}
                  value={refreshSeconds}
                  onChange={(e) => setRefreshSeconds(Number(e.target.value) || 30)}
                />
                <span className="text-xs text-muted-foreground">segundos</span>
                {lastUpdatedRealtime && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado: {new Date(lastUpdatedRealtime).toLocaleTimeString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Input
                  className="w-48"
                  placeholder="Buscar evento"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Switch id="hidePageView" checked={filterHidePageView} onCheckedChange={setFilterHidePageView} />
                  <Label htmlFor="hidePageView">Ocultar page_view</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="hideUserEngagement" checked={filterHideUserEngagement} onCheckedChange={setFilterHideUserEngagement} />
                  <Label htmlFor="hideUserEngagement">Ocultar user_engagement</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="hideZeros" checked={filterHideZeros} onCheckedChange={setFilterHideZeros} />
                  <Label htmlFor="hideZeros">Ocultar zeros</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="topN">Top</Label>
                  <Input id="topN" className="w-16" type="number" min={1} max={50} value={topN} onChange={(e) => setTopN(Math.max(1, Number(e.target.value) || 10))} />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Contagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realtimeView.map((row, i) => (
                    <TableRow key={`rt-${i}`}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right">{row.eventCount.toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                  {realtimeView.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">Sem dados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Últimos 7 dias</h3>
              <div className="flex items-center gap-3 mb-2">
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={reportDays}
                  onChange={(e) => setReportDays(Number(e.target.value))}
                >
                  <option value={1}>1 dia</option>
                  <option value={7}>7 dias</option>
                  <option value={14}>14 dias</option>
                  <option value={28}>28 dias</option>
                </select>
                <Button variant="outline" size="sm" onClick={fetchReportLast7Days}>Atualizar</Button>
                {lastUpdatedReport && (
                  <p className="text-xs text-muted-foreground">
                    Atualizado: {new Date(lastUpdatedReport).toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Input
                  className="w-48"
                  placeholder="Buscar evento"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Switch id="hidePageViewRep" checked={filterHidePageView} onCheckedChange={setFilterHidePageView} />
                  <Label htmlFor="hidePageViewRep">Ocultar page_view</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="hideUserEngagementRep" checked={filterHideUserEngagement} onCheckedChange={setFilterHideUserEngagement} />
                  <Label htmlFor="hideUserEngagementRep">Ocultar user_engagement</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="hideZerosRep" checked={filterHideZeros} onCheckedChange={setFilterHideZeros} />
                  <Label htmlFor="hideZerosRep">Ocultar zeros</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="topNRep">Top</Label>
                  <Input id="topNRep" className="w-16" type="number" min={1} max={250} value={topN} onChange={(e) => setTopN(Math.max(1, Number(e.target.value) || 10))} />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Contagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportView.map((row, i) => (
                    <TableRow key={`rep-${i}`}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right">{row.eventCount.toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                  {reportView.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">Sem dados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

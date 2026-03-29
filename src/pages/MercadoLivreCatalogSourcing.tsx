import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCheck,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Loader2,
  PackageSearch,
  Search,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  useMercadoLivreCatalogSourcingAnalyzeImport,
  useMercadoLivreCatalogSourcingCreateImport,
  useMercadoLivreCatalogSourcingImport,
  useMercadoLivreCatalogSourcingImports,
  useMercadoLivreCatalogSourcingSelectMatch,
  useMercadoLivreCatalogSourcingUpdateItem,
  type MercadoLivreCatalogSourcingDetail,
  type MercadoLivreCatalogSourcingItem,
  type MercadoLivreCatalogSourcingMatch,
} from '@/hooks/useMercadoLivre';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCatalogSourceType, parseCatalogFile, type ParsedCatalogRow } from '@/lib/catalog-file-parser';
import { cn } from '@/lib/utils';

type SimulatorState = {
  mlFeePct: string;
  paymentFeePct: string;
  taxPct: string;
  inboundCost: string;
  fullSendCost: string;
  packagingCost: string;
  otherCost: string;
};

type RowView = MercadoLivreCatalogSourcingItem & {
  estimatedProfit: number;
  estimatedMarginPct: number;
  opportunityScore: number;
  opportunityLabel: 'Boa oportunidade' | 'Nicho promissor' | 'Mercado saturado';
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const simulatorDefaults: SimulatorState = {
  mlFeePct: '16',
  paymentFeePct: '4',
  taxPct: '0',
  inboundCost: '1.5',
  fullSendCost: '7',
  packagingCost: '1',
  otherCost: '0',
};

const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);
const formatNumber = (value: number) => numberFormatter.format(Number.isFinite(value) ? value : 0);
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const toNumber = (value: string, fallback = 0) => {
  const normalized = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : fallback;
};

const buildMlSearchUrl = (query: string) => `https://lista.mercadolivre.com.br/${encodeURIComponent(query.trim()).replace(/%20/g, '-')}`;

const computeRowMetrics = (item: MercadoLivreCatalogSourcingItem, simulator: SimulatorState): RowView => {
  const match = item.selectedMatch;
  const variablePct = toNumber(simulator.mlFeePct) + toNumber(simulator.paymentFeePct) + toNumber(simulator.taxPct);
  const fixedCosts =
    toNumber(simulator.inboundCost) +
    toNumber(simulator.fullSendCost) +
    toNumber(simulator.packagingCost) +
    toNumber(simulator.otherCost);

  const price = match?.price || 0;
  const netAfterFees = price * (1 - variablePct / 100);
  const estimatedProfit = netAfterFees - item.supplierCost - fixedCosts;
  const estimatedMarginPct = price > 0 ? (estimatedProfit / price) * 100 : 0;
  const baseScore = match?.matchScore || 0;
  const demandScore = Math.min(30, (match?.salesPerDay || 0) * 8);
  const marginScore = Math.max(0, Math.min(35, estimatedMarginPct * 1.4));
  const competitionPenalty = match?.sellerType === 'official' ? 10 : match?.sellerType === 'mercado_lider' ? 4 : 0;
  const opportunityScore = Math.max(1, Math.min(100, Math.round(baseScore * 0.45 + demandScore + marginScore - competitionPenalty)));

  let opportunityLabel: RowView['opportunityLabel'] = 'Mercado saturado';
  if (estimatedMarginPct >= 18 && opportunityScore >= 72) {
    opportunityLabel = 'Boa oportunidade';
  } else if (estimatedMarginPct >= 10 && opportunityScore >= 54) {
    opportunityLabel = 'Nicho promissor';
  }

  return {
    ...item,
    estimatedProfit,
    estimatedMarginPct,
    opportunityScore,
    opportunityLabel,
  };
};

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function MercadoLivreCatalogSourcing() {
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;

  const [supplierName, setSupplierName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedCatalogRow[]>([]);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewMode, setPreviewMode] = useState<'spreadsheet' | 'pdf_text' | 'pdf_ocr' | null>(null);
  const [enableScannedPdfConversion, setEnableScannedPdfConversion] = useState(true);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileReadStatus, setFileReadStatus] = useState<string | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [simulator, setSimulator] = useState<SimulatorState>(simulatorDefaults);
  const [rowFilter, setRowFilter] = useState<'all' | 'with_margin' | 'approved' | 'no_match'>('all');
  const [selectedItem, setSelectedItem] = useState<MercadoLivreCatalogSourcingItem | null>(null);

  const importsQuery = useMercadoLivreCatalogSourcingImports(workspaceId);
  const detailQuery = useMercadoLivreCatalogSourcingImport(selectedImportId);
  const createImportMutation = useMercadoLivreCatalogSourcingCreateImport();
  const analyzeImportMutation = useMercadoLivreCatalogSourcingAnalyzeImport();
  const selectMatchMutation = useMercadoLivreCatalogSourcingSelectMatch();
  const updateItemMutation = useMercadoLivreCatalogSourcingUpdateItem();

  useEffect(() => {
    if (!selectedImportId && importsQuery.data?.length) {
      setSelectedImportId(importsQuery.data[0].id);
    }
  }, [importsQuery.data, selectedImportId]);

  const detail = detailQuery.data;

  useEffect(() => {
    if (!detail?.items?.length) return;
    setSelectedItem((current) => {
      if (!current?.id) return current;
      const refreshed = detail.items.find((item) => item.id === current.id);
      return refreshed && refreshed !== current ? refreshed : current;
    });
  }, [detail?.items]);

  const rows = useMemo(() => {
    if (!detail) return [] as RowView[];
    return detail.items.map((item) => computeRowMetrics(item, simulator));
  }, [detail, simulator]);

  const filteredRows = useMemo(() => {
    switch (rowFilter) {
      case 'with_margin':
        return rows.filter((row) => row.estimatedProfit > 0);
      case 'approved':
        return rows.filter((row) => row.approvedForPurchase);
      case 'no_match':
        return rows.filter((row) => !row.selectedMatch);
      default:
        return rows;
    }
  }, [rowFilter, rows]);

  const topOpportunities = useMemo(
    () => [...rows]
      .filter((row) => row.selectedMatch)
      .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.estimatedProfit - a.estimatedProfit))
      .slice(0, 8),
    [rows],
  );

  const approvedRows = useMemo(() => rows.filter((row) => row.approvedForPurchase), [rows]);

  const filteredPreviewRows = useMemo(() => {
    const normalizedSearch = previewSearch.trim().toLowerCase();
    if (!normalizedSearch) return previewRows;

    return previewRows.filter((row) => {
      const haystack = [
        row.productName,
        row.supplierSku,
        row.categoryHint,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [previewRows, previewSearch]);

  const previewSummary = useMemo(() => {
    const withSku = previewRows.filter((row) => row.supplierSku).length;
    const averageCost = previewRows.length
      ? previewRows.reduce((sum, row) => sum + (row.costPrice || 0), 0) / previewRows.length
      : 0;

    return {
      total: previewRows.length,
      withSku,
      averageCost,
    };
  }, [previewRows]);

  const liveSummary = useMemo(() => {
    const positive = rows.filter((row) => row.estimatedProfit > 0);
    const averageMargin = positive.length
      ? positive.reduce((sum, row) => sum + row.estimatedMarginPct, 0) / positive.length
      : 0;
    return {
      marginPositive: positive.length,
      bestProfit: topOpportunities[0]?.estimatedProfit || 0,
      averageMargin,
    };
  }, [rows, topOpportunities]);

  const processCatalogFile = async (file: File) => {
    setIsReadingFile(true);
    setFileReadError(null);
    setFileReadStatus('Lendo catálogo...');

    try {
      const parsed = await parseCatalogFile(file, {
        enableOcrFallback: enableScannedPdfConversion,
        onProgress: (progress) => setFileReadStatus(progress.message),
      });
      setPreviewRows(parsed.rows);
      setPreviewMode(parsed.mode);
      setFileReadError(null);
      if (!supplierName) {
        const suggestedSupplier = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        setSupplierName(suggestedSupplier);
      }

      if (parsed.mode === 'pdf_ocr') {
        toast.success(`${parsed.rows.length} itens lidos do catálogo com conversão automática do PDF escaneado.`);
      } else {
        toast.success(`${parsed.rows.length} itens lidos do catálogo.`);
      }
    } catch (error: any) {
      const message = error.message || 'Não foi possível ler o catálogo.';
      setPreviewRows([]);
      setPreviewMode(null);
      setFileReadError(message);
      toast.error(message);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setPreviewRows([]);
      setPreviewMode(null);
      setFileReadStatus(null);
      setFileReadError(null);
      return;
    }
    await processCatalogFile(file);
  };

  const handleImportCatalog = async () => {
    if (!selectedFile || !previewRows.length) {
      toast.error('Selecione um catálogo válido antes de importar.');
      return;
    }
    if (!supplierName.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }

    try {
      const created = await createImportMutation.mutateAsync({
        workspaceId,
        supplierName: supplierName.trim(),
        sourceFileName: selectedFile.name,
        sourceType: getCatalogSourceType(selectedFile.name),
        rows: previewRows,
      });
      setSelectedImportId(created.import.id);
      toast.success('Catálogo importado com sucesso.');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao importar o catálogo.');
    }
  };

  const handleImportAndAnalyzeCatalog = async () => {
    if (!selectedFile || !previewRows.length) {
      toast.error('Selecione um catálogo válido antes de analisar.');
      return;
    }
    if (!supplierName.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }

    try {
      const created = await createImportMutation.mutateAsync({
        workspaceId,
        supplierName: supplierName.trim(),
        sourceFileName: selectedFile.name,
        sourceType: getCatalogSourceType(selectedFile.name),
        rows: previewRows,
      });

      const createdImportId = created.import.id;
      setSelectedImportId(createdImportId);

      await analyzeImportMutation.mutateAsync({
        importId: createdImportId,
        limit: 12,
        matchesPerItem: 3,
      });

      toast.success('Catálogo importado e analisado com sucesso.');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao importar e analisar o catálogo.');
    }
  };

  const handleAnalyzeImport = async () => {
    if (!selectedImportId) {
      toast.error('Selecione uma importação antes de analisar.');
      return;
    }
    try {
      await analyzeImportMutation.mutateAsync({
        importId: selectedImportId,
        limit: 12,
        matchesPerItem: 3,
      });
      toast.success('Análise limitada executada com sucesso.');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao analisar o catálogo.');
    }
  };

  const handleSelectMatch = async (itemId: string, match: MercadoLivreCatalogSourcingMatch | null) => {
    if (!selectedImportId) return;
    try {
      await selectMatchMutation.mutateAsync({
        itemId,
        mlItemId: match?.mlItemId || null,
        importId: selectedImportId,
      });
      toast.success(match ? 'Match selecionado.' : 'Match removido.');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao selecionar o match.');
    }
  };

  const handleApproveRow = async (row: RowView, approved: boolean) => {
    if (!selectedImportId) return;
    try {
      await updateItemMutation.mutateAsync({
        itemId: row.id,
        importId: selectedImportId,
        approvedForPurchase: approved,
        status: approved ? 'approved' : row.selectedMatch ? 'matched' : 'imported',
      });
      toast.success(approved ? 'Produto aprovado para compra.' : 'Produto removido da shortlist.');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao atualizar o item.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-[34px] border border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(255,230,0,0.38),transparent_26%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_20%),linear-gradient(180deg,#fffdf3_0%,#ffffff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Pesquisa por catálogo
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Suba o PDF do fornecedor, gere a tabela e compare com o Mercado Livre
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              A tela agora começa pelo que interessa: ler o catálogo, separar os produtos em tabela, abrir a busca no Mercado Livre e estimar margem antes de decidir o que comprar para revender.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:grid-cols-3 lg:w-[540px]">
            <SummaryMetric label="Importações" value={formatNumber(importsQuery.data?.length || 0)} helper="Histórico por fornecedor" />
            <SummaryMetric label="Com margem" value={formatNumber(liveSummary.marginPositive)} helper="Itens viáveis no lote aberto" />
            <SummaryMetric label="Melhor lucro" value={formatCurrency(liveSummary.bestProfit)} helper="Lucro unitário estimado" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <div className="space-y-6">
          <Card className="rounded-[30px] border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-black">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                Upload do catálogo
              </CardTitle>
              <CardDescription>Use `xlsx`, `xls`, `csv` ou PDF. Se o PDF for escaneado, a tela pode tentar converter automaticamente com OCR antes de montar a tabela.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ex.: Atacado Joias Premium" />
              </div>

              <div className="space-y-2">
                <Label>Arquivo do catálogo</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,application/pdf"
                  disabled={isReadingFile}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-slate-500">PDF com texto selecionável entra direto. PDF escaneado pode ser convertido automaticamente se a opção abaixo estiver ligada.</p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="space-y-1">
                  <Label htmlFor="catalog-ocr-toggle" className="text-sm font-semibold text-slate-900">
                    Converter PDF escaneado automaticamente
                  </Label>
                  <p className="text-xs text-slate-500">
                    Usa OCR quando o PDF não tiver texto selecionável ou quando a extração normal não conseguir separar os itens.
                  </p>
                </div>
                <Switch
                  id="catalog-ocr-toggle"
                  checked={enableScannedPdfConversion}
                  onCheckedChange={setEnableScannedPdfConversion}
                  disabled={isReadingFile}
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
                {isReadingFile ? (
                  <div className="flex items-start gap-3">
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-blue-600" />
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">Processando arquivo</p>
                      <p>{fileReadStatus || 'Lendo catálogo...'}</p>
                    </div>
                  </div>
                ) : fileReadError ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{selectedFile?.name}</p>
                      <p className="text-rose-600">{fileReadError}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => selectedFile && processCatalogFile(selectedFile)}
                    >
                      Tentar extrair novamente
                    </Button>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{selectedFile.name}</p>
                    <p>{previewRows.length} itens extraídos do catálogo.</p>
                    {previewMode === 'pdf_ocr' ? (
                      <p className="text-xs font-semibold text-emerald-700">PDF escaneado convertido automaticamente por OCR.</p>
                    ) : null}
                    {previewMode === 'pdf_text' ? (
                      <p className="text-xs text-slate-500">Leitura feita pelo texto nativo do PDF.</p>
                    ) : null}
                  </div>
                ) : (
                  <p>Selecione a planilha ou PDF do fornecedor para montar a tabela de produtos.</p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="rounded-2xl"
                  onClick={handleImportAndAnalyzeCatalog}
                  disabled={isReadingFile || Boolean(fileReadError) || createImportMutation.isPending || analyzeImportMutation.isPending || !previewRows.length}
                >
                  {createImportMutation.isPending || analyzeImportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Importar e analisar
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={handleImportCatalog}
                  disabled={isReadingFile || Boolean(fileReadError) || createImportMutation.isPending || analyzeImportMutation.isPending || !previewRows.length}
                >
                  {createImportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  Só importar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black">Simulador de custo</CardTitle>
              <CardDescription>Esses custos são aplicados na margem de cada item do lote aberto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ['Taxa ML %', 'mlFeePct'],
                ['Taxa pagamento %', 'paymentFeePct'],
                ['Imposto %', 'taxPct'],
                ['Frete até você', 'inboundCost'],
                ['Envio para Full', 'fullSendCost'],
                ['Embalagem', 'packagingCost'],
                ['Outros custos', 'otherCost'],
              ].map(([label, key]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    value={simulator[key as keyof SimulatorState]}
                    onChange={(e) => setSimulator((current) => ({ ...current, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black">Histórico</CardTitle>
              <CardDescription>Selecione um catálogo já importado para continuar o sourcing.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-3">
                  {(importsQuery.data || []).map((importEntry) => (
                    <button
                      key={importEntry.id}
                      type="button"
                      onClick={() => setSelectedImportId(importEntry.id)}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left transition',
                        selectedImportId === importEntry.id
                          ? 'border-blue-300 bg-blue-50/80'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{importEntry.supplier_name}</p>
                          <p className="text-xs text-slate-500">{importEntry.source_file_name || 'Planilha importada'}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {importEntry.items_count} itens
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{importEntry.matched_count} com match</span>
                        <span>{importEntry.approved_count} aprovados</span>
                        <span>{new Date(importEntry.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </button>
                  ))}
                  {!importsQuery.data?.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Nenhuma importação ainda.
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {fileReadError && selectedFile ? (
            <Alert variant="destructive" className="rounded-[24px] border-rose-200 bg-rose-50 text-rose-900">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não consegui extrair os produtos do PDF</AlertTitle>
              <AlertDescription>
                <p>{fileReadError}</p>
                <p className="mt-2">
                  Arquivo: <span className="font-semibold">{selectedFile.name}</span>
                </p>
                <p className="mt-2">
                  Se quiser, eu deixei o botão `Tentar extrair novamente` no card de upload. Se mesmo assim falhar, esse PDF provavelmente está difícil demais para OCR automático.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {previewRows.length ? (
            <Card className="rounded-[30px] border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl font-black">Tabela extraída do catálogo</CardTitle>
                  <CardDescription>
                    Revise os itens lidos do arquivo e abra a busca manual no Mercado Livre antes mesmo de importar.
                  </CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <SummaryMetric label="Itens lidos" value={formatNumber(previewSummary.total)} helper="Linhas extraídas" />
                  <SummaryMetric label="Com SKU" value={formatNumber(previewSummary.withSku)} helper="Identificados no parser" />
                  <SummaryMetric label="Custo médio" value={formatCurrency(previewSummary.averageCost)} helper="Base fornecedor" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-md space-y-2">
                  <Label>Filtrar itens extraídos</Label>
                  <Input
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Buscar por nome, SKU ou categoria"
                  />
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200/80">
                  <ScrollArea className="h-[380px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/90">
                          <TableHead>SKU</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Custo</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Busca sugerida</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPreviewRows.map((row, index) => {
                          const searchQuery = row.productName.trim();

                          return (
                            <TableRow key={`${row.supplierSku || row.productName}-${index}`}>
                              <TableCell className="align-top text-sm text-slate-500">{row.supplierSku || '—'}</TableCell>
                              <TableCell className="align-top">
                                <div className="max-w-[280px]">
                                  <p className="font-semibold text-slate-950">{row.productName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="align-top font-semibold">{formatCurrency(row.costPrice)}</TableCell>
                              <TableCell className="align-top text-sm text-slate-500">{row.categoryHint || '—'}</TableCell>
                              <TableCell className="align-top">
                                <p className="max-w-[260px] truncate text-sm text-slate-700">{searchQuery}</p>
                              </TableCell>
                              <TableCell className="align-top text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => window.open(buildMlSearchUrl(searchQuery), '_blank', 'noopener,noreferrer')}
                                >
                                  Buscar no ML
                                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {!filteredPreviewRows.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                              Nenhum item encontrado nesse filtro.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!selectedImportId ? (
            <Card className="rounded-[32px] border-slate-200/80 shadow-sm">
              <CardContent className="flex min-h-[420px] items-center justify-center">
                <div className="max-w-xl text-center">
                  <PackageSearch className="mx-auto h-12 w-12 text-blue-500" />
                  <h2 className="mt-4 text-2xl font-black text-slate-950">Envie um catálogo para começar</h2>
                  <p className="mt-2 text-slate-600">
                    Depois do upload, a plataforma separa os produtos em tabela, sugere buscas no Mercado Livre e calcula a margem produto por produto.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : detailQuery.isLoading ? (
            <Card className="rounded-[32px] border-slate-200/80 shadow-sm">
              <CardContent className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </CardContent>
            </Card>
          ) : detail ? (
            <>
              <div className="grid gap-4 lg:grid-cols-4">
                <SummaryMetric label="Itens" value={formatNumber(detail.summary.totalItems)} helper={detail.import.supplierName} />
                <SummaryMetric label="Analisados" value={formatNumber(detail.summary.analyzedItems)} helper="Buscas já processadas" />
                <SummaryMetric label="Com match" value={formatNumber(detail.summary.matchedItems)} helper="Produto com anúncio selecionado" />
                <SummaryMetric label="Margem média" value={formatPercent(liveSummary.averageMargin)} helper="Só entre os viáveis" />
              </div>

              <Card className="rounded-[30px] border-slate-200/80 shadow-sm">
                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black">Fila de sourcing</CardTitle>
                    <CardDescription>
                      {detail.import.sourceFileName || 'Catálogo importado'} · {detail.import.supplierName}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={rowFilter} onValueChange={(value) => setRowFilter(value as typeof rowFilter)}>
                      <SelectTrigger className="w-[180px] rounded-2xl">
                        <Filter className="mr-2 h-4 w-4 text-slate-500" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os itens</SelectItem>
                        <SelectItem value="with_margin">Com margem positiva</SelectItem>
                        <SelectItem value="approved">Aprovados</SelectItem>
                        <SelectItem value="no_match">Sem match</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      className="rounded-2xl"
                      onClick={handleAnalyzeImport}
                      disabled={analyzeImportMutation.isPending}
                    >
                      {analyzeImportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      Analisar catálogo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="catalogo">
                    <TabsList className="rounded-2xl">
                      <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
                      <TabsTrigger value="oportunidades">Top oportunidades</TabsTrigger>
                      <TabsTrigger value="compra">Lista de compra</TabsTrigger>
                    </TabsList>

                    <TabsContent value="catalogo">
                      <div className="overflow-hidden rounded-3xl border border-slate-200/80">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/90">
                              <TableHead>Produto</TableHead>
                              <TableHead>Custo</TableHead>
                              <TableHead>Busca</TableHead>
                              <TableHead>Match ML</TableHead>
                              <TableHead>Mercado</TableHead>
                              <TableHead>Margem</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="align-top">
                                  <div>
                                    <p className="font-semibold text-slate-950">{row.productName}</p>
                                    <p className="text-xs text-slate-500">{row.supplierSku || `Linha ${row.lineNumber}`}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top font-semibold">{formatCurrency(row.supplierCost)}</TableCell>
                                <TableCell className="align-top">
                                  <div className="max-w-[220px]">
                                    <p className="truncate text-sm text-slate-700">{row.searchTerm || '—'}</p>
                                    {row.searchTerm ? (
                                      <button
                                        type="button"
                                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                                        onClick={() => window.open(buildMlSearchUrl(row.searchTerm || row.productName), '_blank', 'noopener,noreferrer')}
                                      >
                                        Abrir busca <ExternalLink className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  {row.selectedMatch ? (
                                    <div className="max-w-[220px]">
                                      <p className="truncate font-semibold text-slate-950">{row.selectedMatch.title}</p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {row.selectedMatch.sellerType === 'official' ? <Badge variant="secondary">Loja oficial</Badge> : null}
                                        {row.selectedMatch.logisticType === 'fulfillment' ? <Badge variant="secondary">Full</Badge> : null}
                                        {row.selectedMatch.shippingFreeShipping ? <Badge variant="secondary">Frete grátis</Badge> : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400">Sem match selecionado</span>
                                  )}
                                </TableCell>
                                <TableCell className="align-top">
                                  {row.selectedMatch ? (
                                    <div className="space-y-1 text-sm">
                                      <p className="font-semibold text-blue-600">{formatCurrency(row.selectedMatch.price)}</p>
                                      <p className="text-slate-500">{formatNumber(row.selectedMatch.soldQuantity)} vendidos</p>
                                      <p className="text-slate-500">{row.selectedMatch.salesPerDay.toFixed(2)} vendas/dia</p>
                                      <p className="text-slate-500">{row.selectedMatch.adAgeDays ?? '—'} dias de idade</p>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="space-y-1">
                                    <p className={cn('font-semibold', row.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                      {formatCurrency(row.estimatedProfit)}
                                    </p>
                                    <p className="text-sm text-slate-500">{formatPercent(row.estimatedMarginPct)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="space-y-2">
                                    <Badge className={cn(
                                      'rounded-full',
                                      row.opportunityLabel === 'Boa oportunidade'
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                        : row.opportunityLabel === 'Nicho promissor'
                                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-100',
                                    )}>
                                      {row.opportunityLabel}
                                    </Badge>
                                    <p className="text-sm font-semibold text-slate-900">{row.opportunityScore}/100</p>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="flex flex-col items-end gap-2">
                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedItem(row)}>
                                      Ver matches
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="rounded-xl"
                                      variant={row.approvedForPurchase ? 'secondary' : 'default'}
                                      onClick={() => handleApproveRow(row, !row.approvedForPurchase)}
                                    >
                                      {row.approvedForPurchase ? 'Remover' : 'Aprovar'}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {!filteredRows.length ? (
                              <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                                  Nenhum item encontrado nesse filtro.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="oportunidades">
                      <div className="grid gap-4 lg:grid-cols-2">
                        {topOpportunities.map((row) => (
                          <Card key={row.id} className="rounded-[24px] border-slate-200/80">
                            <CardContent className="space-y-3 p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-lg font-black text-slate-950">{row.productName}</p>
                                  <p className="text-sm text-slate-500">{row.supplierSku || row.searchTerm}</p>
                                </div>
                                <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  {row.opportunityScore}/100
                                </Badge>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Venda ML</p>
                                  <p className="mt-1 font-semibold text-slate-950">{formatCurrency(row.selectedMatch?.price || 0)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lucro</p>
                                  <p className="mt-1 font-semibold text-emerald-600">{formatCurrency(row.estimatedProfit)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Vendas/dia</p>
                                  <p className="mt-1 font-semibold text-slate-950">{row.selectedMatch?.salesPerDay.toFixed(2) || '0,00'}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {row.selectedMatch?.sellerType === 'official' ? <Badge variant="secondary">Loja oficial</Badge> : <Badge variant="secondary">Vendedor comum</Badge>}
                                {row.selectedMatch?.logisticType === 'fulfillment' ? <Badge variant="secondary">Full</Badge> : null}
                                {row.selectedMatch?.shippingFreeShipping ? <Badge variant="secondary">Frete grátis</Badge> : null}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="rounded-xl" onClick={() => setSelectedItem(row)}>
                                  Revisar
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleApproveRow(row, !row.approvedForPurchase)}>
                                  {row.approvedForPurchase ? 'Remover da compra' : 'Aprovar para compra'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {!topOpportunities.length ? (
                          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 lg:col-span-2">
                            Rode a análise do catálogo para gerar as oportunidades de revenda.
                          </div>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="compra">
                      <div className="overflow-hidden rounded-3xl border border-slate-200/80">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/90">
                              <TableHead>Produto</TableHead>
                              <TableHead>Custo</TableHead>
                              <TableHead>Anúncio referência</TableHead>
                              <TableHead>Lucro</TableHead>
                              <TableHead>Margem</TableHead>
                              <TableHead>Mercado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {approvedRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-semibold text-slate-950">{row.productName}</p>
                                    <p className="text-xs text-slate-500">{row.supplierSku || row.searchTerm}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">{formatCurrency(row.supplierCost)}</TableCell>
                                <TableCell>
                                  {row.selectedMatch ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 font-semibold text-blue-600"
                                      onClick={() => {
                                        if (!row.selectedMatch?.permalink) return;
                                        window.open(row.selectedMatch.permalink, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      {(row.selectedMatch.title || 'Abrir anúncio').slice(0, 42)}
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="font-semibold text-emerald-600">{formatCurrency(row.estimatedProfit)}</TableCell>
                                <TableCell>{formatPercent(row.estimatedMarginPct)}</TableCell>
                                <TableCell>{row.opportunityLabel}</TableCell>
                              </TableRow>
                            ))}
                            {!approvedRows.length ? (
                              <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                                  Nenhum item aprovado para compra ainda.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[32px] border-slate-200/80 shadow-sm">
              <CardContent className="flex min-h-[420px] items-center justify-center text-slate-500">
                Não foi possível carregar o catálogo.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{selectedItem?.productName}</DialogTitle>
            <DialogDescription>Escolha o anúncio equivalente mais confiável e confira a margem antes de aprovar para compra.</DialogDescription>
          </DialogHeader>
          {selectedItem ? (
            <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
              <Card className="rounded-[24px] border-slate-200/80">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fornecedor</p>
                    <p className="mt-1 font-semibold text-slate-950">{detail?.import.supplierName}</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <BadgeDollarSign className="h-4 w-4 text-blue-600" />
                      Custo: <span className="font-semibold text-slate-950">{formatCurrency(selectedItem.supplierCost)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Search className="h-4 w-4 text-blue-600" />
                      Busca: <span className="font-semibold text-slate-950">{selectedItem.searchTerm || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      Status: <span className="font-semibold text-slate-950">{selectedItem.status}</span>
                    </div>
                  </div>
                  {selectedItem.searchTerm ? (
                    <Button variant="outline" className="w-full rounded-2xl" onClick={() => window.open(buildMlSearchUrl(selectedItem.searchTerm || selectedItem.productName), '_blank', 'noopener,noreferrer')}>
                      Abrir busca manual no ML
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <div className="space-y-4">
                {(selectedItem.matches || []).map((match) => {
                  const view = computeRowMetrics(
                    {
                      ...selectedItem,
                      selectedMatchMlItemId: match.mlItemId,
                      selectedMatch: match,
                    },
                    simulator,
                  );

                  return (
                    <Card key={match.id} className={cn(
                      'rounded-[26px] border transition',
                      selectedItem.selectedMatchMlItemId === match.mlItemId ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200/80',
                    )}>
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-4">
                            {match.thumbnail ? (
                              <img src={match.thumbnail} alt="" className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
                            ) : (
                              <div className="h-20 w-20 rounded-2xl border border-slate-200 bg-slate-100" />
                            )}
                            <div>
                              <p className="text-lg font-black text-slate-950">{match.title}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="secondary">{match.mlItemId}</Badge>
                                {match.sellerType === 'official' ? <Badge variant="secondary">Loja oficial</Badge> : null}
                                {match.logisticType === 'fulfillment' ? <Badge variant="secondary">Full</Badge> : null}
                                {match.shippingFreeShipping ? <Badge variant="secondary">Frete grátis</Badge> : null}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-blue-600">{formatCurrency(match.price)}</p>
                            <p className="text-sm text-slate-500">{formatNumber(match.soldQuantity)} vendidos</p>
                            <p className="text-sm text-slate-500">{Number(match.salesPerDay || 0).toFixed(2)} vendas/dia</p>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Idade do anúncio</p>
                            <p className="mt-1 font-semibold text-slate-950">{match.adAgeDays ?? '—'} dias</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Reputação</p>
                            <p className="mt-1 font-semibold text-slate-950">{match.sellerReputationScore ?? '—'}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lucro estimado</p>
                            <p className={cn('mt-1 font-semibold', view.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                              {formatCurrency(view.estimatedProfit)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Score</p>
                            <p className="mt-1 font-semibold text-slate-950">{view.opportunityScore}/100</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="rounded-2xl"
                            onClick={() => handleSelectMatch(selectedItem.id, match)}
                            disabled={selectMatchMutation.isPending}
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Usar este anúncio
                          </Button>
                          {match.permalink ? (
                            <Button variant="outline" className="rounded-2xl" onClick={() => window.open(match.permalink, '_blank', 'noopener,noreferrer')}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir anúncio
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {!(selectedItem.matches?.length || 0) ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    Nenhum match gerado ainda. Rode a análise do catálogo ou faça a busca manual.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

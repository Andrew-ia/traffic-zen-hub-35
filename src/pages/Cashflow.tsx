import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinancialDashboardData } from "@/hooks/useFinancialDashboardData";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  Banknote,
  Info,
  Loader2,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { z } from "zod";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR");

const formatCurrency = (value?: number | null) => currency.format(value ?? 0);
const formatNumber = (value?: number | null) => decimal.format(value ?? 0);

const normalizeType = (label?: string | null) => {
  if (!label) return "outros";
  const normalized = label.normalize("NFD").toLowerCase();
  if (normalized.includes("entrada")) return "entrada";
  if (normalized.includes("receita")) return "entrada";
  if (normalized.includes("saída") || normalized.includes("saida") || normalized.includes("despesa")) return "saida";
  return "outros";
};

const CashflowDashboard = () => {
  const { data, isLoading, error } = useFinancialDashboardData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // XLSX upload state
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Manual entry form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    entry_date: "",
    counterparty: "",
    amount: "",
    entry_type: "Entrada" as "Entrada" | "Saída",
    bank: "",
    document_code: "",
    group_name: "",
    subgroup_name: "",
    status: "",
    notes: "",
  });

  const entrySchema = z.object({
    entry_date: z.string().min(1, "Data é obrigatória"),
    counterparty: z.string().min(1, "Cliente/Fornecedor é obrigatório"),
    amount: z
      .string()
      .refine((v) => {
        const n = Number(String(v).replace(/\s+/g, "").replace(/\./g, "").replace(",", "."));
        return Number.isFinite(n) && n > 0;
      }, "Informe um valor válido"),
    entry_type: z.enum(["Entrada", "Saída"]),
    bank: z.string().optional(),
    document_code: z.string().optional(),
    group_name: z.string().optional(),
    subgroup_name: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
  });

  const handleImport = async () => {
    if (!xlsxFile) {
      toast({ title: "Selecione um arquivo", description: "Escolha um .xlsx para importar." });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const fileData: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(xlsxFile);
      });

      const response = await fetch("/api/finance/cashflow/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao importar planilha");
      }

      const c = payload?.counts || {};
      toast({
        title: "Importação concluída",
        description: `Lançamentos: ${c.entries ?? 0}, Resultados: ${c.results ?? 0}, Mensal: ${c.monthly ?? 0}, Diário: ${c.daily ?? 0}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["financial-dashboard", WORKSPACE_ID] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Falha na importação", description: message });
    } finally {
      setUploading(false);
    }
  };

  // Estado para edição inline em modo tabela
  type CashflowEntry = {
    id?: string;
    entry_date: string | null;
    counterparty: string | null;
    amount: number | null;
    entry_type: string | null;
    bank: string | null;
    document_code: string | null;
    group_name: string | null;
    subgroup_name: string | null;
    status: string | null;
    notes: string | null;
  };

  const [editing, setEditing] = useState<Record<string, CashflowEntry>>({});
  const [newRows, setNewRows] = useState<CashflowEntry[]>([]);
  const [isSavingRow, setIsSavingRow] = useState<string | null>(null);

  // Opções de dropdown derivadas do plano de contas e dados existentes
  const subgroupsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    data?.plan.forEach((p) => {
      const g = p.category_group;
      const sg = p.subcategory;
      if (!g || !sg) return;
      const list = map.get(g) ?? [];
      if (!list.includes(sg)) list.push(sg);
      map.set(g, list);
    });
    return map;
  }, [data]);

  const statusDefaults = ["A receber", "A pagar", "Pago", "Recebido", "Cancelado", "Em aberto"];
  const statusOptions = useMemo(() => {
    const set = new Set<string>(statusDefaults);
    data?.entries.forEach((e) => e.status && set.add(e.status));
    return Array.from(set);
  }, [data]);

  const bankDefaults = ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Santander", "Caixa", "Inter"];
  const bankOptions = useMemo(() => {
    const set = new Set<string>(bankDefaults);
    data?.entries.forEach((e) => e.bank && set.add(e.bank));
    return Array.from(set);
  }, [data]);

  const startEdit = (entry: { id: string } & CashflowEntry) => {
    setEditing((s) => ({ ...s, [entry.id!]: { ...entry } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  };

  const updateField = (id: string, field: keyof CashflowEntry, value: any) => {
    setEditing((s) => ({ ...s, [id]: { ...s[id], [field]: value } }));
  };

  const parseAmount = (val: any): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(String(val).replace(/\s+/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  const saveEdit = async (id: string) => {
    try {
      setIsSavingRow(id);
      const payload = editing[id];
      if (!payload) return;
      const { error } = await supabase
        .from("financial_cashflow_entries")
        .update({
          entry_date: payload.entry_date,
          counterparty: payload.counterparty,
          amount: parseAmount(payload.amount),
          entry_type: payload.entry_type,
          bank: payload.bank,
          document_code: payload.document_code,
          group_name: payload.group_name,
          subgroup_name: payload.subgroup_name,
          status: payload.status,
          notes: payload.notes,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      toast({ title: "Lançamento atualizado", description: "Alterações salvas com sucesso." });
      cancelEdit(id);
      await queryClient.invalidateQueries({ queryKey: ["financial-dashboard", WORKSPACE_ID] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao salvar", description: message });
    } finally {
      setIsSavingRow(null);
    }
  };

  const deleteRow = async (id: string) => {
    try {
      setIsSavingRow(id);
      const { error } = await supabase.from("financial_cashflow_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
      toast({ title: "Lançamento removido", description: "Registro excluído." });
      await queryClient.invalidateQueries({ queryKey: ["financial-dashboard", WORKSPACE_ID] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao excluir", description: message });
    } finally {
      setIsSavingRow(null);
    }
  };

  const addRow = () => {
    setNewRows((rows) => [
      ...rows,
      {
        entry_date: "",
        counterparty: "",
        amount: null,
        entry_type: "Entrada",
        bank: "",
        document_code: "",
        group_name: "",
        subgroup_name: "",
        status: "",
        notes: "",
      },
    ]);
  };

  const updateNewRow = (index: number, field: keyof CashflowEntry, value: any) => {
    setNewRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const saveNewRow = async (index: number) => {
    try {
      setIsSavingRow(`new-${index}`);
      const payload = newRows[index];
      const { error } = await supabase.from("financial_cashflow_entries").insert({
        workspace_id: WORKSPACE_ID,
        entry_date: payload.entry_date,
        counterparty: payload.counterparty,
        amount: parseAmount(payload.amount),
        entry_type: payload.entry_type,
        bank: payload.bank || null,
        document_code: payload.document_code || null,
        group_name: payload.group_name || null,
        subgroup_name: payload.subgroup_name || null,
        status: payload.status || null,
        notes: payload.notes || null,
        source_sheet: "Manual",
        source_row: null,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Lançamento adicionado", description: "Registro inserido com sucesso." });
      setNewRows((rows) => rows.filter((_, i) => i !== index));
      await queryClient.invalidateQueries({ queryKey: ["financial-dashboard", WORKSPACE_ID] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao inserir", description: message });
    } finally {
      setIsSavingRow(null);
    }
  };

  const monthOptions = useMemo(() => {
    if (!data?.monthly.length) return [];
    return data.monthly.map((item) => {
      const monthNumber = item.month ?? 0;
      const paddedMonth = String(monthNumber).padStart(2, "0");
      return {
        id: `${item.year}-${paddedMonth}`,
        label: `${item.month_name ?? `M${monthNumber || "?"}`}/${item.year}`,
        year: item.year,
        month: monthNumber,
      };
    });
  }, [data]);

  useEffect(() => {
    if (!selectedMonth && monthOptions.length) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].id);
    }
  }, [selectedMonth, monthOptions]);

  const activeMonth = useMemo(() => {
    if (!data?.monthly.length) return null;
    const current = monthOptions.find((option) => option.id === selectedMonth);
    if (!current) {
      return data.monthly[data.monthly.length - 1];
    }
    return data.monthly.find(
      (item) => `${item.year}-${String(item.month ?? 0).padStart(2, "0")}` === current.id,
    ) ?? data.monthly[data.monthly.length - 1];
  }, [data, monthOptions, selectedMonth]);

  const entriesByFilters = useMemo(() => {
    if (!data?.entries.length) return [];
    return data.entries.filter((entry) => {
      const normalizedEntryType = normalizeType(entry.entry_type);
      if (typeFilter !== "all" && normalizedEntryType !== typeFilter) return false;
      if (groupFilter !== "all" && entry.group_name !== groupFilter) return false;
      if (searchTerm.trim().length) {
        const needle = searchTerm.trim().toLowerCase();
        const haystack = [
          entry.counterparty,
          entry.bank,
          entry.notes,
          entry.status,
          entry.group_name,
          entry.subgroup_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, typeFilter, groupFilter, searchTerm]);

  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    data?.plan.forEach((item) => groups.add(item.category_group));
    data?.entries.forEach((item) => item.group_name && groups.add(item.group_name));
    return Array.from(groups).sort();
  }, [data]);

  const monthlyChartData = useMemo(() => {
    if (!data?.monthly.length) return [];
    return data.monthly.map((item) => ({
      label: `${item.month_name ?? `M${item.month ?? "?"}`}/${item.year}`,
      entradas: item.inflows ?? 0,
      saidas: Math.abs(item.outflows ?? 0),
      saldo: item.closing_balance ?? 0,
    }));
  }, [data]);

  const dailyChartData = useMemo(() => {
    if (!data?.daily.length || !activeMonth) return [];
    return data.daily
      .filter((item) => {
        const monthByColumn = item.month ?? Number(item.reference_date.slice(5, 7));
        return monthByColumn === activeMonth.month;
      })
      .map((item) => ({
        label: new Date(item.reference_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        entradas: item.inflows ?? 0,
        saidas: Math.abs(item.outflows ?? 0),
        saldo: item.closing_balance ?? 0,
      }));
  }, [data, activeMonth]);

  const cardValue = (key: string, fallback?: number | null) => {
    const found = data?.cards.find((card) => card.card_key === key);
    return found?.value ?? fallback ?? 0;
  };

  const monthInflows = activeMonth?.inflows ?? 0;
  const monthOutflows = Math.abs(activeMonth?.outflows ?? 0);
  const monthResult = monthInflows - monthOutflows;
  const yearlyRevenue = (data?.monthly ?? []).reduce((acc, row) => acc + (row.inflows ?? 0), 0);
  const yearlyExpense = (data?.monthly ?? []).reduce((acc, row) => acc + Math.abs(row.outflows ?? 0), 0);

  const categoryPlan = useMemo(() => {
    const map = new Map<string, string[]>();
    data?.plan.forEach((item) => {
      if (!map.has(item.category_group)) {
        map.set(item.category_group, []);
      }
      map.get(item.category_group)?.push(item.subcategory);
    });
    return Array.from(map.entries()).map(([group, subcategories]) => ({
      group,
      subcategories: subcategories.filter(Boolean),
    }));
  }, [data]);

  const selectedResults = useMemo(() => {
    if (!data?.results.length || !activeMonth) return [];
    return data.results
      .filter((row) => {
        if (row.month && activeMonth.month && row.month !== activeMonth.month) return false;
        return row.year === activeMonth.year;
      })
      .map((row) => ({
        ...row,
        realized_value: row.realized_value ?? 0,
        projected_value: row.projected_value ?? 0,
      }))
      .sort((a, b) => (b.realized_value ?? 0) - (a.realized_value ?? 0))
      .slice(0, 10);
  }, [data, activeMonth]);

  const intelligenceHighlights = useMemo(() => {
    if (!data?.intelligence.length || !activeMonth) return [];
    return data.intelligence
      .filter((row) => row.month_number === activeMonth.month)
      .map((row) => ({
        label: row.category_primary ?? row.balance_category ?? "Categoria",
        receita: row.revenue_value ?? 0,
        despesa: Math.abs(row.expense_value ?? 0),
        saldo: (row.revenue_value ?? 0) - Math.abs(row.expense_value ?? 0),
      }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 4);
  }, [data, activeMonth]);

  const orientationNotes = useMemo(() => {
    if (!data?.notes.length) return [];
    return data.notes.filter((note) => note.sheet_name?.toLowerCase().includes("orient"));
  }, [data]);

  const modeloNotes = useMemo(() => {
    if (!data?.notes.length) return [];
    return data.notes.filter((note) => note.sheet_name?.toLowerCase().includes("modelo"));
  }, [data]);

  const dashboardNotes = useMemo(() => {
    if (!data?.notes.length) return [];
    return data.notes.filter((note) => note.sheet_name?.toLowerCase().includes("dashboard"));
  }, [data]);

  const monthlyTable = useMemo(() => data?.monthly ?? [], [data]);

  const dailyRows = useMemo(() => {
    if (!data?.daily.length) return [];
    if (!activeMonth) return data.daily;
    return data.daily.filter((row) => {
      const rowMonth = row.month ?? Number(row.reference_date.slice(5, 7));
      const rowYear = Number(row.reference_date.slice(0, 4));
      return rowMonth === activeMonth.month && rowYear === activeMonth.year;
    });
  }, [data, activeMonth]);

  const resultsForSelectedMonth = useMemo(() => {
    if (!data?.results.length || !activeMonth) return [];
    return data.results
      .filter((row) => {
        if (row.year !== activeMonth.year) return false;
        if (activeMonth.month && row.month && row.month !== activeMonth.month) return false;
        return true;
      })
      .sort((a, b) => (a.row_position ?? 0) - (b.row_position ?? 0));
  }, [data, activeMonth]);

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Importar planilha XLSX</CardTitle>
            <CardDescription>Atualize os dados do fluxo de caixa enviando o arquivo consolidado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input type="file" accept=".xlsx" onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)} />
            <Button onClick={handleImport} disabled={uploading || !xlsxFile}>
              {uploading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Importando...</span> : "Importar"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando fluxo de caixa...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Importar planilha XLSX</CardTitle>
            <CardDescription>Atualize os dados do fluxo de caixa enviando o arquivo consolidado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input type="file" accept=".xlsx" onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)} />
            <Button onClick={handleImport} disabled={uploading || !xlsxFile}>
              {uploading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Importando...</span> : "Importar"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-10 text-destructive">
            Não foi possível carregar as informações financeiras: {error.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Importar planilha XLSX</CardTitle>
          <CardDescription>Atualize os dados do fluxo de caixa enviando o arquivo consolidado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input type="file" accept=".xlsx" onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)} />
          <Button onClick={handleImport} disabled={uploading || !xlsxFile}>
            {uploading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Importando...</span> : "Importar"}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground">
          As mesmas abas da planilha agora organizadas em uma experiência interativa dentro da plataforma.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-muted-foreground">
          Workspace: {import.meta.env.VITE_WORKSPACE_ID ?? "—"}
        </p>
        {monthOptions.length ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mês em foco</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="flex w-full flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="orientacoes">Orientações</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
          <TabsTrigger value="fc-mensal">FC Mensal</TabsTrigger>
          <TabsTrigger value="fc-diario">FC Diário</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardDescription>Receitas do mês</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(cardValue("receitas_do_mes", monthInflows))}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Banknote className="h-4 w-4 text-primary" /> Entradas registradas
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardDescription>Despesas do mês</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(cardValue("despesas_do_mes", monthOutflows))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowDownRight className="h-4 w-4 text-destructive" /> Pagamentos e saídas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resultado do mês</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(cardValue("resultado_do_mes", monthResult))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PiggyBank className="h-4 w-4 text-emerald-500" /> Receitas – Despesas
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Saldo em caixa</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(cardValue("saldo_em_caixa_hoje", activeMonth?.closing_balance))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-4 w-4 text-blue-500" /> Fechamento mensal
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Evolução mensal</CardTitle>
                <CardDescription>Entradas, saídas e saldo acumulado por mês.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {monthlyChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyChartData}>
                      <defs>
                        <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="entradas" stroke="hsl(var(--chart-2))" fill="url(#colorInflow)" />
                      <Area type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" fill="url(#colorOutflow)" />
                      <Line type="monotone" dataKey="saldo" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado mensal disponível.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fluxo diário</CardTitle>
                  <CardDescription>Distribuição diária das entradas, saídas e saldo.</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  {dailyChartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="entradas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="saldo" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sem lançamentos diários para o mês selecionado.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Painel anual</CardTitle>
                  <CardDescription>Resumo dos cards da aba “Dashboard”.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Receita do ano</p>
                    <p className="text-lg font-semibold">{formatCurrency(cardValue("receita_do_ano", yearlyRevenue))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Despesa do ano</p>
                    <p className="text-lg font-semibold">{formatCurrency(cardValue("despesa_do_ano", yearlyExpense))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Resultado do ano</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(cardValue("desultado_do_ano", yearlyRevenue - yearlyExpense))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previsão 30 dias</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(cardValue("previsao_de_caixa_para_os_proximos_30_dias", activeMonth?.closing_balance))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Resultados por categoria</CardTitle>
                  <CardDescription>Importado diretamente da aba “Resultados”.</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedResults.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Realizado</TableHead>
                          <TableHead>Meta (AV)</TableHead>
                          <TableHead>Gap</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedResults.slice(0, 10).map((row) => {
                          const gap = (row.realized_value ?? 0) - (row.projected_value ?? 0);
                          return (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="font-medium">{row.category_label}</div>
                                <p className="text-xs text-muted-foreground">{row.group_name ?? "Sem grupo"}</p>
                              </TableCell>
                              <TableCell>{formatCurrency(row.realized_value)}</TableCell>
                              <TableCell>{formatCurrency(row.projected_value)}</TableCell>
                              <TableCell className={gap >= 0 ? "text-emerald-600" : "text-destructive"}>
                                {formatCurrency(gap)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem categorias cadastradas para o mês selecionado.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Insights automáticos</CardTitle>
                  <CardDescription>Resumo da aba “InteligenciaCateg”.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {intelligenceHighlights.length ? (
                    intelligenceHighlights.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Receita {formatCurrency(row.receita)} • Despesa {formatCurrency(row.despesa)}
                          </p>
                        </div>
                        <div className={row.saldo >= 0 ? "text-emerald-600" : "text-destructive"}>{formatCurrency(row.saldo)}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum insight disponível.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Plano de contas</CardTitle>
                <CardDescription>Grupos e subcategorias importados da aba “PlanodeContas”.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {categoryPlan.map((item) => (
                  <div key={item.group} className="rounded-lg border p-4">
                    <div className="mb-2 text-sm font-semibold">{item.group}</div>
                    <div className="flex flex-wrap gap-2">
                      {item.subcategories.map((subcategory) => (
                        <Badge key={subcategory} variant="outline">
                          {subcategory}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {!categoryPlan.length && (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lancamentos">
          <Card>
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Lançamentos</CardTitle>
                <CardDescription>Tabela idêntica à aba “Lancamentos”.</CardDescription>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row">
                <Input
                  placeholder="Buscar por cliente, banco ou observação"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="lg:max-w-sm"
                />
                <div className="flex gap-3">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full lg:w-[160px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="saida">Saídas</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os grupos</SelectItem>
                      {groupOptions.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addRow}>Adicionar linha</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {newRows.length ? (
                <Table className="mb-6">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente / Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Produto / Nº Boleto</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Subgrupo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newRows.map((row, idx) => (
                      <TableRow key={`new-${idx}`}>
                        <TableCell>
                          <Input type="date" value={row.entry_date ?? ""} onChange={(e) => updateNewRow(idx, "entry_date", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={row.counterparty ?? ""} onChange={(e) => updateNewRow(idx, "counterparty", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={row.amount ?? ""} onChange={(e) => updateNewRow(idx, "amount", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Select value={row.entry_type ?? "Entrada"} onValueChange={(v) => updateNewRow(idx, "entry_type", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Entrada">Entrada</SelectItem>
                              <SelectItem value="Saída">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.bank ?? ""} onValueChange={(v) => updateNewRow(idx, "bank", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Banco" />
                            </SelectTrigger>
                            <SelectContent>
                              {bankOptions.map((b) => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={row.document_code ?? ""} onChange={(e) => updateNewRow(idx, "document_code", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Select value={row.group_name ?? ""} onValueChange={(v) => updateNewRow(idx, "group_name", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {groupOptions.map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.subgroup_name ?? ""} onValueChange={(v) => updateNewRow(idx, "subgroup_name", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Subgrupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {(row.group_name ? subgroupsByGroup.get(row.group_name) ?? [] : Array.from(subgroupsByGroup.values()).flat()).map((sg) => (
                                <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.status ?? ""} onValueChange={(v) => updateNewRow(idx, "status", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={row.notes ?? ""} onChange={(e) => updateNewRow(idx, "notes", e.target.value)} />
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="sm" onClick={() => saveNewRow(idx)} disabled={isSavingRow === `new-${idx}`}>Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setNewRows((rows) => rows.filter((_, i) => i !== idx))}>Cancelar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              {entriesByFilters.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente / Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Produto / Nº Boleto</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Subgrupo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesByFilters.map((entry) => (
                      <TableRow key={entry.id}>
                        {editing[entry.id] ? (
                          <>
                            <TableCell>
                              <Input type="date" value={editing[entry.id].entry_date ?? ""} onChange={(e) => updateField(entry.id, "entry_date", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input value={editing[entry.id].counterparty ?? ""} onChange={(e) => updateField(entry.id, "counterparty", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input value={editing[entry.id].amount ?? ""} onChange={(e) => updateField(entry.id, "amount", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Select value={editing[entry.id].entry_type ?? "Entrada"} onValueChange={(v) => updateField(entry.id, "entry_type", v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Entrada">Entrada</SelectItem>
                                  <SelectItem value="Saída">Saída</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={editing[entry.id].bank ?? ""} onValueChange={(v) => updateField(entry.id, "bank", v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Banco" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bankOptions.map((b) => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input value={editing[entry.id].document_code ?? ""} onChange={(e) => updateField(entry.id, "document_code", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Select value={editing[entry.id].group_name ?? ""} onValueChange={(v) => updateField(entry.id, "group_name", v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groupOptions.map((g) => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={editing[entry.id].subgroup_name ?? ""} onValueChange={(v) => updateField(entry.id, "subgroup_name", v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Subgrupo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(editing[entry.id].group_name ? subgroupsByGroup.get(editing[entry.id].group_name!) ?? [] : Array.from(subgroupsByGroup.values()).flat()).map((sg) => (
                                    <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={editing[entry.id].status ?? ""} onValueChange={(v) => updateField(entry.id, "status", v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input value={editing[entry.id].notes ?? ""} onChange={(e) => updateField(entry.id, "notes", e.target.value)} />
                            </TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(entry.id)} disabled={isSavingRow === entry.id}>Salvar</Button>
                              <Button size="sm" variant="outline" onClick={() => cancelEdit(entry.id)}>Cancelar</Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString("pt-BR") : "--"}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>{entry.counterparty ?? "Sem identificação"}</div>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(entry.amount ?? 0)}</TableCell>
                            <TableCell>
                              <Badge variant={normalizeType(entry.entry_type) === "entrada" ? "secondary" : "destructive"}>
                                {entry.entry_type ?? "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.bank ?? "-"}</TableCell>
                            <TableCell>{entry.document_code ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.group_name ?? "Sem grupo"}</Badge>
                            </TableCell>
                            <TableCell>{entry.subgroup_name ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.status ?? "Sem status"}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs text-xs text-muted-foreground">{entry.notes ?? "-"}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(entry as any)}>Editar</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteRow(entry.id)}>Excluir</Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado com os filtros atuais.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>Matriz completa da aba “Resultados”.</CardDescription>
            </CardHeader>
            <CardContent>
              {resultsForSelectedMonth.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Realizado</TableHead>
                      <TableHead>Meta (AV)</TableHead>
                      <TableHead>Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultsForSelectedMonth.map((row) => {
                      const diff = (row.realized_value ?? 0) - (row.projected_value ?? 0);
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.category_label}</div>
                            <p className="text-xs text-muted-foreground">{row.group_name ?? "Sem grupo"}</p>
                          </TableCell>
                          <TableCell>{formatCurrency(row.realized_value)}</TableCell>
                          <TableCell>{formatCurrency(row.projected_value)}</TableCell>
                          <TableCell className={diff >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {formatCurrency(diff)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum registro para o mês selecionado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fc-mensal">
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa Mensal</CardTitle>
              <CardDescription>Reprodução da aba “FCMensal”.</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTable.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Saldo inicial</TableHead>
                      <TableHead>Entradas</TableHead>
                      <TableHead>Saídas</TableHead>
                      <TableHead>Saldo final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyTable.map((row) => (
                      <TableRow key={`${row.year}-${row.month}`}>
                        <TableCell>
                          {row.month_name ?? `M${row.month ?? ""}`} / {row.year}
                        </TableCell>
                        <TableCell>{formatCurrency(row.opening_balance)}</TableCell>
                        <TableCell>{formatCurrency(row.inflows)}</TableCell>
                        <TableCell>{formatCurrency(row.outflows)}</TableCell>
                        <TableCell>{formatCurrency(row.closing_balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Aba “FCMensal” ainda está vazia.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fc-diario">
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa Diário</CardTitle>
              <CardDescription>Dados importados da aba “FCDiario”.</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Saldo inicial</TableHead>
                      <TableHead>Entradas</TableHead>
                      <TableHead>Saídas</TableHead>
                      <TableHead>Saldo final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyRows.map((row) => (
                      <TableRow key={`${row.reference_date}-${row.period}`}>
                        <TableCell>{new Date(row.reference_date).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.period === "first_half" ? "1ª quinzena" : "2ª quinzena"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(row.opening_balance)}</TableCell>
                        <TableCell>{formatCurrency(row.inflows)}</TableCell>
                        <TableCell>{formatCurrency(row.outflows)}</TableCell>
                        <TableCell>{formatCurrency(row.closing_balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Aba “FCDiario” ainda não possui lançamentos.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orientacoes">
          <div className="space-y-4">
            {[{ title: "Modelo", notes: modeloNotes }, { title: "Orientações", notes: orientationNotes }, { title: "Dashboard", notes: dashboardNotes }].map(
              ({ title, notes }) =>
                notes.length ? (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>Conteúdo replicado da aba “{title}”.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                          <Info className="mt-0.5 h-4 w-4 text-primary" />
                          <p>{note.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null,
            )}
            {!orientationNotes.length && !modeloNotes.length && !dashboardNotes.length ? (
              <p className="text-sm text-muted-foreground">Ainda não importamos notas dessas abas.</p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CashflowDashboard;

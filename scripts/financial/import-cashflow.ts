import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

type Row = Array<string | number | Date | null>;

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const workbookPath = process.argv[2] ?? "Planilha de Fluxo de Caixa com GRAFICOS [OPCIONAL].xlsx";
const resolvedPath = path.resolve(workbookPath);

if (!fs.existsSync(resolvedPath)) {
  throw new Error(`Planilha não encontrada em ${resolvedPath}`);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const workspaceId = process.env.WORKSPACE_ID ?? process.env.VITE_WORKSPACE_ID;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para rodar o import.");
}

if (!workspaceId) {
  throw new Error("Defina WORKSPACE_ID (ou VITE_WORKSPACE_ID) para direcionar os registros.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

const workbook = xlsx.readFile(resolvedPath, { cellDates: true });

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const sanitized = value.replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toISODate(value: unknown): string | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      const iso = new Date(Date.UTC(parsed.y, (parsed.m ?? 1) - 1, parsed.d ?? 1));
      return iso.toISOString().slice(0, 10);
    }
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

function monthNameToNumber(label?: string | null): number | null {
  if (!label) return null;
  const normalized = label.toString().trim().toLowerCase();
  const idx = MONTHS.indexOf(normalized);
  return idx >= 0 ? idx + 1 : null;
}

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function isRowEmpty(row?: Row): boolean {
  if (!row) return true;
  return row.every((cell) => {
    if (cell === null || cell === undefined) return true;
    if (typeof cell === "string") return cell.trim().length === 0;
    return false;
  });
}

function chunk<T>(items: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function sheetRows(sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`⚠️  Aba "${sheetName}" não encontrada no arquivo.`);
    return [];
  }
  return xlsx.utils.sheet_to_json<Row>(sheet, {
    header: 1,
    blankrows: false,
    raw: true,
    defval: null,
  });
}

type CashflowEntry = Record<string, unknown>;

function parseLancamentos(): CashflowEntry[] {
  const rows = sheetRows("Lancamentos");
  const headerIndex = rows.findIndex((row) => row?.some((cell) => cell === "Data"));
  if (headerIndex === -1) return [];

  const header = rows[headerIndex];
  const getIndex = (label: string) =>
    header.findIndex((cell) => typeof cell === "string" && cell.trim().toLowerCase() === label.toLowerCase());

  const columns = {
    date: getIndex("Data"),
    counterparty: getIndex("Cliente/Fornecedor"),
    value: getIndex("Valor"),
    type: getIndex("Tipo"),
    bank: getIndex("Banco"),
    document: getIndex("Produto/Nº Boleto"),
    group: getIndex("Grupo"),
    subgroup: getIndex("Subgrupo"),
    status: getIndex("Status"),
    notes: getIndex("Observações"),
  };

  const entries: CashflowEntry[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const entryDate = columns.date >= 0 ? toISODate(row[columns.date]) : null;
    const amount = columns.value >= 0 ? toNumber(row[columns.value]) : null;
    const counterparty = columns.counterparty >= 0 ? normalizeString(row[columns.counterparty]) : null;

    if (!entryDate && !counterparty && amount === null) {
      continue;
    }

    entries.push({
      workspace_id: workspaceId,
      entry_date: entryDate,
      counterparty,
      amount,
      entry_type: columns.type >= 0 ? normalizeString(row[columns.type]) : null,
      bank: columns.bank >= 0 ? normalizeString(row[columns.bank]) : null,
      document_code: columns.document >= 0 ? normalizeString(row[columns.document]) : null,
      group_name: columns.group >= 0 ? normalizeString(row[columns.group]) : null,
      subgroup_name: columns.subgroup >= 0 ? normalizeString(row[columns.subgroup]) : null,
      status: columns.status >= 0 ? normalizeString(row[columns.status]) : null,
      notes: columns.notes >= 0 ? normalizeString(row[columns.notes]) : null,
      source_sheet: "Lancamentos",
      source_row: i + 1,
      created_at: new Date().toISOString(),
    });
  }

  return entries;
}

function parseResultados() {
  const rows = sheetRows("Resultados");
  if (!rows.length) return [];

  const yearRow = rows.find((row) => row?.includes("Ano:"));
  const year =
    (yearRow && yearRow[yearRow.findIndex((cell) => cell === "Ano:") + 1] && Number(yearRow[yearRow.findIndex((cell) => cell === "Ano:") + 1])) ||
    new Date().getFullYear();

  const monthHeaderIndex = rows.findIndex((row) => row?.some((cell) => cell === "Mês:"));
  const valueHeaderIndex = rows.findIndex((row) => row?.includes("Categoria / Subcategoria:"));
  if (monthHeaderIndex === -1 || valueHeaderIndex === -1) return [];

  const monthRow = rows[monthHeaderIndex];
  const headerRow = rows[valueHeaderIndex];
  const labelColumn = headerRow.findIndex((cell) => cell === "Categoria / Subcategoria:");

  const columnMap: Array<{ col: number; monthName: string; type: "realized" | "projection"; monthNumber: number | null }> = [];
  let activeMonthName: string | null = null;

  for (let col = labelColumn + 1; col < headerRow.length; col++) {
    const monthLabel = monthRow[col];
    if (typeof monthLabel === "string" && monthLabel.trim().length && monthLabel !== "Mês:") {
      activeMonthName = monthLabel.trim();
    }

    const cell = headerRow[col];
    if (cell === "Realizado" || cell === "AV") {
      const monthNumber = monthNameToNumber(activeMonthName);
      columnMap.push({
        col,
        monthName: activeMonthName ?? "",
        monthNumber,
        type: cell === "Realizado" ? "realized" : "projection",
      });
    }
  }

  const majorGroups = new Set([
    "Receitas Operacionais",
    "Receitas Não Operacionais",
    "Custos Variáveis",
    "Custos Fixos",
    "Despesas Não Operacionais",
  ]);

  const records: Record<string, unknown>[] = [];
  let currentGroup: string | null = null;

  for (let rowIndex = valueHeaderIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (isRowEmpty(row)) continue;

    const labelRaw = labelColumn >= 0 ? row[labelColumn] : null;
    const label = normalizeString(labelRaw);
    if (!label) continue;

    if (majorGroups.has(label)) {
      currentGroup = label;
    }

    const base = {
      workspace_id: workspaceId,
      year,
      group_name: currentGroup,
      category_label: label,
      row_position: rowIndex - valueHeaderIndex,
      created_at: new Date().toISOString(),
    };

    const monthlyMap = new Map<
      number | string,
      { month_number: number | null; month_name: string; realized_value: number | null; projected_value: number | null }
    >();

    for (const column of columnMap) {
      const rawValue = row[column.col];
      const key = column.monthNumber ?? column.monthName;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          month_number: column.monthNumber,
          month_name: column.monthName,
          realized_value: null,
          projected_value: null,
        });
      }
      const accumulator = monthlyMap.get(key);
      if (!accumulator) continue;

      if (column.type === "realized") {
        accumulator.realized_value = toNumber(rawValue);
      } else {
        accumulator.projected_value = toNumber(rawValue);
      }
    }

    for (const entry of monthlyMap.values()) {
      if (!entry.month_name && entry.month_number === null) continue;
      records.push({
        ...base,
        month: entry.month_number,
        month_name: entry.month_name,
        realized_value: entry.realized_value,
        projected_value: entry.projected_value,
      });
    }
  }

  return records;
}

function parseMonthlyCashflow() {
  const rows = sheetRows("FCMensal");
  if (!rows.length) return [];

  const yearRow = rows.find((row) => row?.includes("Ano:"));
  const year =
    (yearRow && yearRow[yearRow.findIndex((cell) => cell === "Ano:") + 1] && Number(yearRow[yearRow.findIndex((cell) => cell === "Ano:") + 1])) ||
    new Date().getFullYear();

  const headerIndex = rows.findIndex((row) => row?.some((cell) => cell === "Mês:"));
  if (headerIndex === -1) return [];
  const header = rows[headerIndex];

  const monthColumns: Array<{ col: number; monthName: string; monthNumber: number | null }> = [];
  for (let col = 2; col < header.length; col++) {
    const value = header[col];
    if (typeof value === "string" && value.trim().length && value !== "Mês:") {
      monthColumns.push({ col, monthName: value.trim(), monthNumber: monthNameToNumber(value) });
    }
  }

  const saldoInicialRow = rows.find((row) => row?.[1] === "Saldo Inicial");
  const entradasRow = rows.find((row) => row?.[1] === "Entradas");
  const saidasRow = rows.find((row) => row?.[1] === "Saídas");
  const saldoFinalRow = rows.find((row) => row?.[1] === "Saldo Final");

  return monthColumns.map(({ col, monthName, monthNumber }, index) => ({
    workspace_id: workspaceId,
    year,
    month: monthNumber ?? index + 1,
    month_name: monthName,
    opening_balance: saldoInicialRow ? toNumber(saldoInicialRow[col]) : null,
    inflows: entradasRow ? toNumber(entradasRow[col]) : null,
    outflows: saidasRow ? toNumber(saidasRow[col]) : null,
    closing_balance: saldoFinalRow ? toNumber(saldoFinalRow[col]) : null,
    created_at: new Date().toISOString(),
  }));
}

function parseDailyCashflow() {
  const rows = sheetRows("FCDiario");
  if (!rows.length) return [];

  const metadataRow = rows.find((row) => row?.includes("Ano:"));
  const year =
    (metadataRow &&
      metadataRow[metadataRow.findIndex((cell) => cell === "Ano:") + 1] &&
      Number(metadataRow[metadataRow.findIndex((cell) => cell === "Ano:") + 1])) ||
    new Date().getFullYear();
  const monthName = metadataRow ? metadataRow[metadataRow.findIndex((cell) => cell === "Mês") + 1] : null;
  const monthNumber =
    ((metadataRow &&
      metadataRow[metadataRow.findIndex((cell) => cell === "Mês") + 2] &&
      Number(metadataRow[metadataRow.findIndex((cell) => cell === "Mês") + 2])) ||
      monthNameToNumber(typeof monthName === "string" ? monthName : null)) ??
    new Date().getMonth() + 1;

  const headerIndex = rows.findIndex((row) => row?.includes("Dia"));
  if (headerIndex === -1) return [];
  const header = rows[headerIndex];

  type Section = { period: "first_half" | "second_half"; indices: { day: number; opening: number; inflow: number; outflow: number; closing: number } };
  const sections: Section[] = [];
  let currentPeriod: Section["period"] = "first_half";

  for (let col = 0; col < header.length; col++) {
    if (header[col] === "Dia") {
      const section: Section = {
        period: sections.length === 0 ? "first_half" : "second_half",
        indices: {
          day: col,
          opening: col + 1,
          inflow: col + 2,
          outflow: col + 3,
          closing: col + 4,
        },
      };
      sections.push(section);
      currentPeriod = section.period;
      col += 4;
    } else if (header[col] === null && sections.length === 1) {
      currentPeriod = "second_half";
    }
  }

  const records: Record<string, unknown>[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (isRowEmpty(row)) continue;

    for (const section of sections) {
      const dayValue = row[section.indices.day];
      if (!dayValue) continue;

      const reference = toISODate(dayValue) ?? (() => {
        if (typeof dayValue === "number") {
          const date = new Date(Date.UTC(year, (monthNumber ?? 1) - 1, dayValue));
          return date.toISOString().slice(0, 10);
        }
        return null;
      })();

      const dayNumber =
        dayValue instanceof Date
          ? dayValue.getUTCDate()
          : typeof dayValue === "number"
          ? dayValue
          : reference
          ? Number(reference.split("-")[2])
          : null;

      if (!reference) continue;

      records.push({
        workspace_id: workspaceId,
        year,
        month: monthNumber,
        day: dayNumber,
        reference_date: reference,
        period: section.period,
        opening_balance: toNumber(row[section.indices.opening]),
        inflows: toNumber(row[section.indices.inflow]),
        outflows: toNumber(row[section.indices.outflow]),
        closing_balance: toNumber(row[section.indices.closing]),
        created_at: new Date().toISOString(),
      });
    }
  }

  return records;
}

function parsePlanOfAccounts() {
  const rows = sheetRows("PlanodeContas");
  if (!rows.length) return [];

  const headerIndex = rows.findIndex((row) => row?.some((cell) => cell === "Receitas Operacionais"));
  if (headerIndex === -1) return [];
  const header = rows[headerIndex];

  const columns: Array<{ col: number; group: string }> = [];
  for (let col = 1; col < header.length; col++) {
    const value = header[col];
    if (typeof value === "string" && value.trim().length && !value.toLowerCase().startsWith("subcateg")) {
      columns.push({ col, group: value.trim() });
    }
  }

  const records: Record<string, unknown>[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (isRowEmpty(row)) continue;
    columns.forEach(({ col, group }) => {
      const subcategory = normalizeString(row[col]);
      if (!subcategory) return;
      records.push({
        workspace_id: workspaceId,
        category_group: group,
        subcategory,
        position: rowIndex - headerIndex,
        created_at: new Date().toISOString(),
      });
    });
  }

  return records;
}

function parseCategoryIntelligence() {
  const rows = sheetRows("InteligenciaCateg");
  if (!rows.length) return [];
  const headerIndex = rows.findIndex((row) => row?.includes("Categorias"));
  if (headerIndex === -1) return [];

  const header = rows[headerIndex];
  const indices = {
    categoryPrimary: header.findIndex((cell) => cell === "Categorias"),
    categoryHelper: header.findIndex((cell, idx) => cell === "Categorias" && idx > 2),
    monthNumberB: header.findIndex((cell, idx) => cell === "Mês" && idx >= 10),
    monthNameB: header.findIndex((cell) => cell === "Nome Mês"),
    revenue: header.findIndex((cell) => cell === "Receitas"),
    expense: header.findIndex((cell) => cell === "Despesas"),
    monthNumberCash: header.findIndex((cell, idx) => cell === "Mês" && idx >= 14),
    monthNameCash: header.findIndex((cell, idx) => cell === "Nome Mês" && idx >= 15),
    cashValue: header.findIndex((cell, idx) => cell === "Caixa" && idx >= 16),
    balanceCategory: header.findIndex((cell) => cell === "Categoria"),
    balanceValue: header.findIndex((cell, idx) => cell === "Caixa" && idx >= 18),
  };

  const records: Record<string, unknown>[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (isRowEmpty(row)) continue;
    const hasMetrics =
      (indices.revenue >= 0 && row[indices.revenue] !== null) ||
      (indices.expense >= 0 && row[indices.expense] !== null) ||
      (indices.cashValue >= 0 && row[indices.cashValue] !== null) ||
      (indices.balanceValue >= 0 && row[indices.balanceValue] !== null);
    if (!hasMetrics) continue;

    records.push({
      workspace_id: workspaceId,
      category_primary: indices.categoryPrimary >= 0 ? normalizeString(row[indices.categoryPrimary]) : null,
      category_helper: indices.categoryHelper >= 0 ? normalizeString(row[indices.categoryHelper]) : null,
      month_number: indices.monthNumberB >= 0 ? toNumber(row[indices.monthNumberB]) : null,
      month_name: indices.monthNameB >= 0 ? normalizeString(row[indices.monthNameB]) : null,
      revenue_value: indices.revenue >= 0 ? toNumber(row[indices.revenue]) : null,
      expense_value: indices.expense >= 0 ? toNumber(row[indices.expense]) : null,
      cash_month_number: indices.monthNumberCash >= 0 ? toNumber(row[indices.monthNumberCash]) : null,
      cash_month_name: indices.monthNameCash >= 0 ? normalizeString(row[indices.monthNameCash]) : null,
      cash_total: indices.cashValue >= 0 ? toNumber(row[indices.cashValue]) : null,
      balance_category: indices.balanceCategory >= 0 ? normalizeString(row[indices.balanceCategory]) : null,
      balance_value: indices.balanceValue >= 0 ? toNumber(row[indices.balanceValue]) : null,
      created_at: new Date().toISOString(),
    });
  }

  return records;
}

function parseInsightCards() {
  const rows = sheetRows("InteligenciaCateg");
  if (!rows.length) return [];
  const cardsRow = rows.findIndex((row) => row?.includes("Cards"));
  if (cardsRow === -1) return [];

  const cards: Record<string, unknown>[] = [];
  for (let rowIndex = cardsRow + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (isRowEmpty(row)) continue;
    const label = normalizeString(row[11]);
    if (!label) continue;
    const value = toNumber(row[12]);
    cards.push({
      workspace_id: workspaceId,
      card_key: slugify(label),
      label,
      value,
      created_at: new Date().toISOString(),
    });
  }
  return cards;
}

function parseSheetNotes(sheetName: string) {
  const rows = sheetRows(sheetName);
  if (!rows.length) return [];
  const records: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    if (isRowEmpty(row)) return;
    const content = row
      .map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
      .join(" | ")
      .trim();
    if (!content.length) return;
    records.push({
      workspace_id: workspaceId,
      sheet_name: sheetName,
      row_index: index + 1,
      content,
      created_at: new Date().toISOString(),
    });
  });

  return records;
}

async function replaceTable(table: string, rows: Record<string, unknown>[]) {
  console.log(`\n🧹 Limpando tabela ${table}...`);
  const { error: deleteError } = await supabase.from(table).delete().eq("workspace_id", workspaceId);
  if (deleteError) {
    throw new Error(`Falha ao limpar ${table}: ${deleteError.message}`);
  }

  // Deduplicação por chaves únicas conhecidas para evitar violação de constraints
  const dedupe = (tbl: string, items: Record<string, unknown>[]) => {
    switch (tbl) {
      case "financial_plan_accounts": {
        const seen = new Set<string>();
        return items.filter((r) => {
          const key = `${r.workspace_id}|${r.category_group}|${r.subcategory}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      case "financial_insight_cards": {
        const seen = new Set<string>();
        return items.filter((r) => {
          const key = `${r.workspace_id}|${r.card_key}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      case "financial_cashflow_daily": {
        const seen = new Set<string>();
        return items.filter((r) => {
          const key = `${r.workspace_id}|${r.reference_date}|${r.period}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      default:
        return items;
    }
  };

  const rowsDeduped = dedupe(table, rows);

  if (!rowsDeduped.length) {
    console.log(`   Nenhum dado para inserir em ${table}.`);
    return;
  }

  console.log(`   Inserindo ${rowsDeduped.length} registros em ${table}...`);
  for (const batch of chunk(rowsDeduped)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`Erro ao inserir em ${table}:`, error);
      throw new Error(`Falha ao inserir em ${table}: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`📥 Importando planilha: ${resolvedPath}`);

  const entries = parseLancamentos();
  const results = parseResultados();
  const monthly = parseMonthlyCashflow();
  const daily = parseDailyCashflow();
  const plan = parsePlanOfAccounts();
  const intelligence = parseCategoryIntelligence();
  const cards = parseInsightCards();
  const notes = ["Modelo", "Orientacoes", "Dashboard"].flatMap((sheet) => parseSheetNotes(sheet));

  await replaceTable("financial_cashflow_entries", entries);
  await replaceTable("financial_results_monthly", results);
  await replaceTable("financial_cashflow_monthly", monthly);
  await replaceTable("financial_cashflow_daily", daily);
  await replaceTable("financial_plan_accounts", plan);
  await replaceTable("financial_category_intelligence", intelligence);
  await replaceTable("financial_insight_cards", cards);
  await replaceTable("financial_sheet_notes", notes);

  console.log("\n✅ Importação concluída com sucesso!");
}

main().catch((error) => {
  console.error("❌ Erro ao importar a planilha:", error);
  process.exit(1);
});

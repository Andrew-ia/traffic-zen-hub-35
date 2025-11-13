import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID for financial dashboard queries.");
}

type NumericString = string | number | null;

const asNumber = (value: NumericString): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export interface FinancialCashflowEntry {
  id: string;
  workspace_id: string;
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
}

export interface FinancialMonthlySummary {
  id: string;
  workspace_id: string;
  year: number;
  month: number | null;
  month_name: string | null;
  opening_balance: number | null;
  inflows: number | null;
  outflows: number | null;
  closing_balance: number | null;
}

export interface FinancialDailySummary {
  id: string;
  workspace_id: string;
  reference_date: string;
  period: "first_half" | "second_half";
  opening_balance: number | null;
  inflows: number | null;
  outflows: number | null;
  closing_balance: number | null;
  month: number | null;
}

export interface FinancialResultRow {
  id: string;
  workspace_id: string;
  year: number;
  month: number | null;
  month_name: string | null;
  group_name: string | null;
  category_label: string;
  realized_value: number | null;
  projected_value: number | null;
  row_position: number | null;
}

export interface FinancialPlanAccount {
  id: string;
  workspace_id: string;
  category_group: string;
  subcategory: string;
  position: number | null;
}

export interface FinancialInsightCard {
  id: string;
  workspace_id: string;
  card_key: string;
  label: string;
  value: number | null;
}

export interface FinancialIntelligenceRow {
  id: string;
  workspace_id: string;
  category_primary: string | null;
  category_helper: string | null;
  month_number: number | null;
  month_name: string | null;
  revenue_value: number | null;
  expense_value: number | null;
  cash_month_number: number | null;
  cash_month_name: string | null;
  cash_total: number | null;
  balance_category: string | null;
  balance_value: number | null;
}

export interface FinancialSheetNote {
  id: string;
  sheet_name: string;
  row_index: number;
  content: string | null;
}

export interface FinancialDashboardPayload {
  entries: FinancialCashflowEntry[];
  monthly: FinancialMonthlySummary[];
  daily: FinancialDailySummary[];
  results: FinancialResultRow[];
  plan: FinancialPlanAccount[];
  cards: FinancialInsightCard[];
  intelligence: FinancialIntelligenceRow[];
  notes: FinancialSheetNote[];
}

export function useFinancialDashboardData() {
  return useQuery<FinancialDashboardPayload>({
    queryKey: ["financial-dashboard", WORKSPACE_ID],
    queryFn: async () => {
      const [
        entriesRes,
        monthlyRes,
        dailyRes,
        resultsRes,
        planRes,
        cardsRes,
        intelligenceRes,
        notesRes,
      ] = await Promise.all([
        supabase
          .from("financial_cashflow_entries")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("entry_date", { ascending: false }),
        supabase
          .from("financial_cashflow_monthly")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("year", { ascending: true })
          .order("month", { ascending: true }),
        supabase
          .from("financial_cashflow_daily")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("reference_date", { ascending: true }),
        supabase
          .from("financial_results_monthly")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("row_position", { ascending: true }),
        supabase
          .from("financial_plan_accounts")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("category_group", { ascending: true })
          .order("position", { ascending: true }),
        supabase
          .from("financial_insight_cards")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("label", { ascending: true }),
        supabase
          .from("financial_category_intelligence")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("month_number", { ascending: true }),
        supabase
          .from("financial_sheet_notes")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("sheet_name", { ascending: true })
          .order("row_index", { ascending: true }),
      ]);

      const allErrors = [
        entriesRes.error,
        monthlyRes.error,
        dailyRes.error,
        resultsRes.error,
        planRes.error,
        cardsRes.error,
        intelligenceRes.error,
        notesRes.error,
      ].filter(Boolean);

      if (allErrors.length) {
        throw new Error(allErrors.map((err) => err?.message).join(" | "));
      }

      const entries: FinancialCashflowEntry[] = (entriesRes.data ?? []).map((row) => ({
        ...row,
        amount: asNumber(row.amount),
      }));

      const monthly: FinancialMonthlySummary[] = (monthlyRes.data ?? []).map((row) => ({
        ...row,
        opening_balance: asNumber(row.opening_balance),
        inflows: asNumber(row.inflows),
        outflows: asNumber(row.outflows),
        closing_balance: asNumber(row.closing_balance),
      }));

      const daily: FinancialDailySummary[] = (dailyRes.data ?? []).map((row) => ({
        ...row,
        opening_balance: asNumber(row.opening_balance),
        inflows: asNumber(row.inflows),
        outflows: asNumber(row.outflows),
        closing_balance: asNumber(row.closing_balance),
        reference_date: row.reference_date,
      }));

      const results: FinancialResultRow[] = (resultsRes.data ?? []).map((row) => ({
        ...row,
        realized_value: asNumber(row.realized_value),
        projected_value: asNumber(row.projected_value),
      }));

      const plan: FinancialPlanAccount[] = (planRes.data ?? []).map((row) => ({ ...row }));

      const cards: FinancialInsightCard[] = (cardsRes.data ?? []).map((row) => ({
        ...row,
        value: asNumber(row.value),
      }));

      const intelligence: FinancialIntelligenceRow[] = (intelligenceRes.data ?? []).map((row) => ({
        ...row,
        revenue_value: asNumber(row.revenue_value),
        expense_value: asNumber(row.expense_value),
        cash_total: asNumber(row.cash_total),
        balance_value: asNumber(row.balance_value),
      }));

      const notes: FinancialSheetNote[] = (notesRes.data ?? []).map((row) => ({
        ...row,
        content: row.content,
      }));

      return { entries, monthly, daily, results, plan, cards, intelligence, notes };
    },
    staleTime: 1000 * 60 * 5,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface BillingTransaction {
  id: string;
  externalId: string;
  transactionTime: string | null;
  amount: number;
  currency: string | null;
  paymentMethodType: string | null;
  paymentStatus: string | null;
  billingReason: string | null;
  paymentMethodDetails: Record<string, unknown> | null;
  rawPayload: Record<string, unknown> | null;
}

export interface BillingTransactionsSummary {
  totalAmount: number;
  transactionCount: number;
  topPaymentMethod: string | null;
  lastTransaction: BillingTransaction | null;
  currency: string | null;
}

interface UseBillingTransactionsParams {
  accountId?: string;
  startDate?: string;
  endDate?: string;
}

export function useBillingTransactions(workspaceId: string | null, { accountId, startDate, endDate }: UseBillingTransactionsParams) {
  return useQuery({
    queryKey: ["billing-transactions", workspaceId, accountId ?? "all", startDate ?? "all", endDate ?? "all"],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      let query = supabase
        .from("billing_transactions")
        .select(
          `
            id,
            platform_account_id,
            external_id,
            transaction_time,
            amount,
            currency,
            payment_method_type,
            payment_method_details,
            payment_status,
            billing_reason,
            raw_payload
          `,
        )
        .eq("workspace_id", workspaceId)
        .order("transaction_time", { ascending: false })
        .limit(500);

      if (accountId) {
        query = query.eq("platform_account_id", accountId);
      }

      if (startDate) {
        query = query.gte("transaction_time", `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte("transaction_time", `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to load billing transactions", error.message);
        throw error;
      }

      const transactions: BillingTransaction[] =
        (data ?? []).map((row) => ({
          id: row.id,
          externalId: row.external_id,
          transactionTime: row.transaction_time,
          amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
          currency: row.currency ?? null,
          paymentMethodType: row.payment_method_type ?? null,
          paymentStatus: row.payment_status ?? null,
          billingReason: row.billing_reason ?? null,
          paymentMethodDetails:
            typeof row.payment_method_details === "string"
              ? safeParseJson<Record<string, unknown>>(row.payment_method_details)
              : (row.payment_method_details as Record<string, unknown> | null) ?? null,
          rawPayload:
            typeof row.raw_payload === "string"
              ? safeParseJson<Record<string, unknown>>(row.raw_payload)
              : (row.raw_payload as Record<string, unknown> | null) ?? null,
        })) ?? [];

      const totalAmount = transactions.reduce((total, tx) => total + tx.amount, 0);
      const transactionCount = transactions.length;
      const lastTransaction = transactions[0] ?? null;

      const methodFrequency = new Map<string, number>();
      for (const tx of transactions) {
        if (tx.paymentMethodType) {
          methodFrequency.set(tx.paymentMethodType, (methodFrequency.get(tx.paymentMethodType) ?? 0) + 1);
        }
      }

      const topPaymentMethod =
        transactions.length === 0
          ? null
          : Array.from(methodFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const summary: BillingTransactionsSummary = {
        totalAmount,
        transactionCount,
        topPaymentMethod,
        lastTransaction,
        currency: lastTransaction?.currency ?? null,
      };

      return { transactions, summary };
    },
  });
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

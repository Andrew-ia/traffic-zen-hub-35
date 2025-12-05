import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { z } from "zod";

export interface BudgetPlan {
  id: string;
  platformAccountId: string | null;
  platformName: string;
  allocationDate: string;
  targetSpend: number | null;
  budgetCap: number | null;
  notes: string | null;
  createdAt: string;
}

export interface BudgetPlanStats {
  totalPlanned: number;
  totalUpcoming: number;
  totalUpcoming30d: number;
  totalPast: number;
  byAccount: Record<string, number>;
}

export interface BudgetPlansResponse {
  plans: BudgetPlan[];
  stats: BudgetPlanStats;
}

const budgetPlanSchema = z.object({
  platformAccountId: z.string().uuid().nullable(),
  allocationDate: z.string().min(1),
  targetSpend: z.number().nullable(),
  budgetCap: z.number().nullable(),
  notes: z.string().nullable(),
});

export function useBudgetPlans(workspaceId: string | null) {
  return useQuery({
    queryKey: ["budget", "plans", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<BudgetPlansResponse> => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("budget_allocations")
        .select(
          `
            id,
            platform_account_id,
            allocation_date,
            target_spend,
            budget_cap,
            notes,
            created_at,
            platform_accounts ( name )
          `,
        )
        .eq("workspace_id", workspaceId)
        .order("allocation_date", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to load budget allocations", error.message);
        throw error;
      }

      const plans = (data ?? []).map((item) => ({
        id: item.id,
        platformAccountId: item.platform_account_id,
        platformName: item.platform_accounts?.name ?? item.platform_account_id ?? "Conta desconhecida",
        allocationDate: item.allocation_date,
        targetSpend: item.target_spend !== null && item.target_spend !== undefined ? Number(item.target_spend) : null,
        budgetCap: item.budget_cap !== null && item.budget_cap !== undefined ? Number(item.budget_cap) : null,
        notes: item.notes ?? null,
        createdAt: item.created_at,
      }));

      const referenceDate = new Date();
      referenceDate.setHours(0, 0, 0, 0);

      const inThirtyDays = new Date(referenceDate);
      inThirtyDays.setDate(inThirtyDays.getDate() + 30);

      const stats: BudgetPlanStats = {
        totalPlanned: 0,
        totalUpcoming: 0,
        totalUpcoming30d: 0,
        totalPast: 0,
        byAccount: {},
      };

      for (const plan of plans) {
        const target = plan.targetSpend ?? 0;
        stats.totalPlanned += target;

        if (plan.platformAccountId) {
          stats.byAccount[plan.platformAccountId] = (stats.byAccount[plan.platformAccountId] ?? 0) + target;
        }

        const planDate = new Date(plan.allocationDate);
        planDate.setHours(0, 0, 0, 0);

        if (planDate >= referenceDate) {
          stats.totalUpcoming += target;
          if (planDate <= inThirtyDays) {
            stats.totalUpcoming30d += target;
          }
        } else {
          stats.totalPast += target;
        }
      }

      return { plans, stats };
    },
  });
}

const createBudgetPlanSchema = z.object({
  platformAccountId: z.string().uuid(),
  allocationDate: z.string().min(1),
  targetSpend: z.number().positive(),
  budgetCap: z.number().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateBudgetPlanInput = z.infer<typeof createBudgetPlanSchema>;

export function useCreateBudgetPlan(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetPlanInput) => {
      const payload = createBudgetPlanSchema.parse(input);

      const { error } = await supabase.from("budget_allocations").insert({
        workspace_id: workspaceId,
        platform_account_id: payload.platformAccountId,
        allocation_date: payload.allocationDate,
        target_spend: payload.targetSpend,
        budget_cap: payload.budgetCap ?? null,
        notes: payload.notes ?? null,
      });

      if (error) {
        console.error("Failed to create budget allocation", error.message);
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budget", "plans", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["budget", "overview", workspaceId] }),
      ]);
    },
  });
}

export interface UpdateBudgetPlanInput extends Partial<CreateBudgetPlanInput> {
  id: string;
}

export function useUpdateBudgetPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBudgetPlanInput) => {
      const payload = budgetPlanSchema.partial().parse({
        platformAccountId: input.platformAccountId ?? null,
        allocationDate: input.allocationDate,
        targetSpend: input.targetSpend ?? null,
        budgetCap: input.budgetCap ?? null,
        notes: input.notes ?? null,
      });

      const { error } = await supabase
        .from("budget_allocations")
        .update({
          platform_account_id: payload.platformAccountId,
          allocation_date: payload.allocationDate,
          target_spend: payload.targetSpend,
          budget_cap: payload.budgetCap,
          notes: payload.notes,
        })
        .eq("id", id)
        .eq("workspace_id", WORKSPACE_ID);

      if (error) {
        console.error("Failed to update budget allocation", error.message);
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budget", "plans"] }),
        queryClient.invalidateQueries({ queryKey: ["budget", "overview"] }),
      ]);
    },
  });
}

export function useDeleteBudgetPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_allocations")
        .delete()
        .eq("id", id)
        .eq("workspace_id", WORKSPACE_ID);

      if (error) {
        console.error("Failed to delete budget allocation", error.message);
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budget", "plans"] }),
        queryClient.invalidateQueries({ queryKey: ["budget", "overview"] }),
      ]);
    },
  });
}

import type { Request, Response } from "express";
import { BillingSyncError, syncMetaBillingTransactions } from "../../services/metaBilling.js";

export async function syncMetaBilling(req: Request, res: Response) {
  try {
    const daysParam = req.body?.days ?? req.query?.days;
    const days = daysParam ? Number(daysParam) : 30;

    if (Number.isNaN(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'days' inválido. Utilize um número maior que zero.",
      });
    }

    const result = await syncMetaBillingTransactions({ days });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to sync billing transactions:", error);
    if (error instanceof BillingSyncError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao sincronizar transações.",
    });
  }
}

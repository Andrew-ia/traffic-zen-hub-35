#!/usr/bin/env node
/**
 * Check data consistency for Meta & Google across configured periods.
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_WORKSPACE_ID,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VITE_WORKSPACE_ID) {
  console.error("❌ Missing SUPABASE credentials or workspace ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getTotals(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const sinceIso = start.toISOString().slice(0, 10);
  const untilIso = today.toISOString().slice(0, 10);

  const [meta, google, googleMetrics] = await Promise.all([
    supabase
      .from("performance_metrics")
      .select("metric_date, spend")
      .eq("workspace_id", VITE_WORKSPACE_ID)
      .is("campaign_id", null)
      .is("ad_set_id", null)
      .is("ad_id", null)
      .gte("metric_date", sinceIso),
    supabase
      .from("ads_spend_google")
      .select("metric_date, cost_micros, impressions, clicks, conversions")
      .eq("workspace_id", VITE_WORKSPACE_ID)
      .gte("metric_date", sinceIso)
      .lte("metric_date", untilIso),
    supabase
      .from("performance_metrics")
      .select("metric_date, spend, impressions, clicks")
      .eq("workspace_id", VITE_WORKSPACE_ID)
      .not("platform_account_id", "is", null)
      .gte("metric_date", sinceIso),
  ]);

  if (meta.error) throw meta.error;
  if (google.error) throw google.error;
  if (googleMetrics.error) throw googleMetrics.error;

  const metaSpend = (meta.data ?? []).reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
  const googleSpendAds = (google.data ?? []).reduce(
    (sum, row) => sum + Number(row.cost_micros ?? 0) / 1_000_000,
    0,
  );
  const googleMetricsSpend = (googleMetrics.data ?? [])
    .filter((row) => row.metric_date && row.spend && row.spend > 0)
    .filter((row) => {
      return (google.data ?? []).some((g) => g.metric_date === row.metric_date);
    })
    .reduce((sum, row) => sum + Number(row.spend ?? 0), 0);

  const metaImpressions = (meta.data ?? []).reduce(
    (sum, row) => sum + Number(row.impressions ?? 0),
    0,
  );
  const googleImpressions = (google.data ?? []).reduce(
    (sum, row) => sum + Number(row.impressions ?? 0),
    0,
  );

  return {
    metaSpend,
    googleSpendAds,
    googleMetricsSpend,
    metaImpressions,
    googleImpressions,
  };
}

async function main() {
  const periods = [7, 15, 30];
  let hasIssue = false;
  for (const days of periods) {
    const totals = await getTotals(days);
    const diff = totals.googleSpendAds - totals.googleMetricsSpend;
    console.log(`\n📊 ${days} dias`);
    console.log(`   Meta Spend:    R$ ${totals.metaSpend.toFixed(2)}`);
    console.log(`   Google (ads_spend_google): R$ ${totals.googleSpendAds.toFixed(2)}`);
    console.log(`   Google (performance_metrics com spend): R$ ${totals.googleMetricsSpend.toFixed(2)}`);
    console.log(`   Diferença:      R$ ${diff.toFixed(2)}`);
    if (Math.abs(diff) > 1) {
      hasIssue = true;
      console.log("   ⚠️  Diferença > R$1 entre ads_spend_google e performance_metrics");
    }
  }

  if (hasIssue) {
    process.exitCode = 1;
    console.log("\n❌ Inconsistências detectadas. Revise a sincronização do Google ou atualize a lógica de agregação.");
  } else {
    console.log("\n✅ Dados consistentes entre Meta e Google.");
  }
}

main().catch((error) => {
  console.error("❌ Erro ao validar dados:", error.message);
  process.exit(1);
});

# KPI/Metrics Implementation - Analysis Index

## Quick Links

**Start Here:**
1. [KPI_QUICK_REFERENCE.md](./KPI_QUICK_REFERENCE.md) - 5 min read, navigation guide
2. [KPI_METRICS_ANALYSIS.md](./KPI_METRICS_ANALYSIS.md) - 20 min read, comprehensive audit

## What This Analysis Covers

### Problem Statement
The dashboard is supposed to show each campaign's **PRIMARY RESULT based on its OBJECTIVE** with proper cost calculation. For example:
- Lead campaigns show: "150 Leads, CPL R$66.67"
- Traffic campaigns show: "5,000 Cliques, CPC R$0.40"  
- Sales campaigns show: "10 Compras, ROAS 1.5x"

**Current State:** All campaigns show generic "Conversações" metric regardless of objective type.

### Analysis Scope
- Database implementation (SQL views, functions)
- Frontend hooks (React Query, data transformation)
- UI components (tables, charts, displays)
- Type definitions and interfaces
- What's working vs. what needs fixing

## Current Implementation Status

| Layer | Status | Completeness |
|-------|--------|--------------|
| Database | Working | 100% ✓ |
| Business Logic | Partial | 40% ✓ |
| Frontend Components | Incomplete | 20% ✓ |
| **Overall** | **Incomplete** | **60%** |

## Key Findings

### What Works (Keep These)
- `v_campaign_kpi` view: Maps objectives to result_label/result_value/cost_per_result
- `mv_baselines` & `mv_health`: Score campaigns against baselines correctly
- `useObjectivePerformanceSummary`: Aggregates by objective category properly
- `ObjectivePerformance.tsx`: Displays objective summaries correctly
- Recommendation engine: Uses cost_per_result in R1-R5 rules

### What Doesn't Work (Fix These)
- `Reports.tsx`: Hard-coded "conversoas" for all objectives
- `useReportsData`: Overloads "conversions" terminology
- `useCampaignMetrics`: No objective context
- `CampaignsTable`: Shows no performance metrics at all
- `TrafficAnalysis`: Hard-coded "CPL" label

### Root Cause
Frontend **bypasses v_campaign_kpi view** and instead queries raw performance_metrics table, computing generic metrics instead of using the database's objective-aware calculations.

## Files Analyzed

### Database
- `supabase/sql/02_views.sql` - v_campaign_kpi view (GOOD)
- `supabase/sql/03_materialized_views.sql` - Baselines & health (GOOD)
- `supabase/sql/04_functions.sql` - Recommendations (GOOD)

### Frontend Business Logic
- `src/lib/conversionMetrics.ts` - Meta action mapping (GOOD)
- `src/hooks/useObjectivePerformanceSummary.ts` - Objective aggregation (GOOD)
- `src/hooks/useReportsData.ts` - NEEDS FIX
- `src/hooks/useCampaignMetrics.ts` - NEEDS FIX
- `src/hooks/usePerformanceMetrics.ts` - Workspace-only (OK)
- `src/hooks/useTrafficAnalysis.ts` - NEEDS LABEL FIX

### Frontend UI
- `src/pages/Reports.tsx` - NEEDS FIX (lines 107, 273, 314)
- `src/components/campaigns/CampaignsTable.tsx` - NEEDS KPI COLUMNS
- `src/pages/Dashboard.tsx` - Uses ObjectivePerformance (OK)
- `src/pages/TrafficAnalysis.tsx` - NEEDS LABEL FIX (line 142)
- `src/components/dashboard/ObjectivePerformance.tsx` - Reference (GOOD)

### Types
- `src/types/sync.ts` - SyncInsightsSummary (structure good)
- Hook type definitions - Need updates for resultLabel/resultValue/costPerResult

## Implementation Roadmap

### Phase 1: Frontend Business Logic (1 day)
- [ ] Create `src/lib/kpiCalculations.ts` with objective-based KPI computation
- [ ] Create `src/hooks/useObjectiveBasedKPI.ts` that queries v_campaign_kpi
- [ ] Update type definitions to include resultLabel/resultValue/costPerResult

### Phase 2: Fix Hooks (1 day)
- [ ] Fix `useReportsData.ts` - Remove conversions overloading
- [ ] Fix `useCampaignMetrics.ts` - Add objective context
- [ ] Update `useTrafficAnalysis.ts` - Dynamic labels

### Phase 3: Update Components (1 day)
- [ ] Update `CampaignsTable.tsx` - Add KPI columns
- [ ] Update `Reports.tsx` - Dynamic result labels
- [ ] Update `TrafficAnalysis.tsx` - Dynamic cost metric labels

### Phase 4: Testing (0.5 day)
- [ ] Test all campaign types (Leads, Traffic, Sales, Engagement, App, Awareness)
- [ ] Verify ROAS shows only for SALES
- [ ] Verify cost calculations match SQL
- [ ] Update documentation

**Total Estimated Effort:** 3-4 days

## Critical Issues (High Priority)

1. **CampaignsTable shows NO performance metrics**
   - File: `src/components/campaigns/CampaignsTable.tsx`
   - Issue: Metadata only, no KPI display
   - Fix: Add result_label, result_value, cost_per_result columns

2. **Reports shows generic "conversoas" for all campaigns**
   - File: `src/pages/Reports.tsx` (lines 107, 273, 314)
   - Issue: Hard-coded "conversas" in all tables
   - Fix: Use dynamic result labels per objective

3. **useReportsData doesn't query v_campaign_kpi**
   - File: `src/hooks/useReportsData.ts` (line 486)
   - Issue: Overloads "conversions" = conversations
   - Fix: Query v_campaign_kpi for objective-aware metrics

4. **useCampaignMetrics has no objective mapping**
   - File: `src/hooks/useCampaignMetrics.ts` (line 104)
   - Issue: Generic conversions, no cost_per_result
   - Fix: Add objective context to metrics

## Reference Implementations

### Good Implementation (Reference)
`src/hooks/useObjectivePerformanceSummary.ts`
- Shows how to map objectives to categories
- Shows how to compute objective-specific metrics
- LeadsSummary, SalesSummary, TrafficSummary all demonstrate the pattern

### What We Need to Create
Similar to ObjectivePerformanceSummary but for:
- Individual campaigns (not aggregated)
- Campaign/adset/ad level (not just objectives)
- With proper result_label/result_value/cost_per_result

## Questions? Review These Sections

**"What's already working?"** → See KPI_METRICS_ANALYSIS.md Section 7

**"What's broken and why?"** → See KPI_METRICS_ANALYSIS.md Section 4

**"How do I fix it?"** → See KPI_METRICS_ANALYSIS.md Section 6

**"Where exactly is the bug?"** → See KPI_QUICK_REFERENCE.md File Map

**"Show me a template"** → See KPI_QUICK_REFERENCE.md Implementation Template

## Key Takeaway

The database correctly computes PRIMARY RESULT by objective via v_campaign_kpi view. The frontend simply needs to:
1. Query this view instead of raw metrics table
2. Use result_label/result_value/cost_per_result fields
3. Remove overloaded "conversions" terminology
4. Update UI components to display these fields

This is **not about new algorithms** - just proper data plumbing from the correct database layer.

---

**Analysis Date:** November 2, 2025  
**Branch:** feature/audit-dashboard-metrics  
**Analyzed By:** Claude Code (Anthropic)

# KPI/Metrics Implementation - Quick Reference

## Key Findings Summary

### What's Working ✓
| Component | Status | File |
|-----------|--------|------|
| v_campaign_kpi SQL view | COMPLETE | supabase/sql/02_views.sql:30-174 |
| Objective category mapping | COMPLETE | src/hooks/useObjectivePerformanceSummary.ts:114-152 |
| Health scoring (45% CPR) | COMPLETE | supabase/sql/03_materialized_views.sql |
| Recommendation engine (R1-R5) | COMPLETE | supabase/sql/04_functions.sql |
| ObjectivePerformance component | COMPLETE | src/components/dashboard/ObjectivePerformance.tsx |
| Conversion action tracking | COMPLETE | src/lib/conversionMetrics.ts |

### What's Broken ⚠️
| Component | Problem | Severity | File |
|-----------|---------|----------|------|
| CampaignsTable | No KPI metrics shown | HIGH | src/components/campaigns/CampaignsTable.tsx |
| Reports Objective Breakdown | Generic "conversoas" metric | HIGH | src/pages/Reports.tsx:299-335 |
| useReportsData | Doesn't query v_campaign_kpi | HIGH | src/hooks/useReportsData.ts |
| useCampaignMetrics | No objective mapping | MEDIUM | src/hooks/useCampaignMetrics.ts |
| TrafficAnalysis | Hard-coded "CPL" label | MEDIUM | src/pages/TrafficAnalysis.tsx:142 |
| usePerformanceMetrics | Only conversations metric | LOW | src/hooks/usePerformanceMetrics.ts |

### The Core Problem
**Frontend doesn't query v_campaign_kpi view** - it exists in database but is never used from React hooks

### Root Cause
Generic "conversions" terminology overloaded across all campaign types:
- Line 486 (useReportsData): `const conversions = started;` 
- Line 104 (useCampaignMetrics): Same pattern
- Result: All campaigns show "Conversões" even traffic campaigns should show "Cliques"

### What Should Happen
```
Lead Campaign:   Result="Leads", Value=150,     CostPerResult=R$66.67
Traffic Campaign: Result="Cliques", Value=5000, CostPerResult=R$0.40
Sales Campaign:   Result="Compras", Value=10,   CostPerResult=R$50.00, ROAS=1.5
```

### What Actually Happens
```
Lead Campaign:   Conversões=conversations, CPA=R$12.50 (confusing)
Traffic Campaign: Conversões=conversations, CPA=R$50.00 (wrong metric)
Sales Campaign:   Conversões=conversations, CPA=R$10.00 (incomplete)
```

## Fix Priority

1. **HIGH:** Create useObjectiveBasedKPI() hook querying v_campaign_kpi
2. **HIGH:** Update Reports.tsx to show result_label/cost_per_result per objective
3. **MEDIUM:** Update CampaignsTable to show KPI columns
4. **MEDIUM:** Update TrafficAnalysis labels

## Implementation Template

### Missing Hook (useObjectiveBasedKPI.ts)
```typescript
export function useObjectiveBasedKPI(campaignId: string) {
  return useQuery({
    queryFn: async () => {
      const { data } = await supabase
        .from('v_campaign_kpi')
        .select('result_label, result_value, cost_per_result, roas, spend, clicks')
        .eq('campaign_id', campaignId)
        .limit(1)
        .single();
      
      return data; // {result_label, result_value, cost_per_result, roas...}
    }
  });
}
```

### Type Fix (ObjectiveBreakdownItem)
```typescript
// BEFORE
ObjectiveBreakdownItem {
  conversions: number,
  conversations: number,
  cpa: number,
}

// AFTER
ObjectiveBreakdownItem {
  resultLabel: string,      // "Leads", "Cliques", "Conversas", "Compras"
  resultValue: number,      // Count of actual result
  costPerResult: number,    // Proper cost calculation
  roas?: number,            // For sales only
}
```

## File Map

**Database:**
- `supabase/sql/02_views.sql` - v_campaign_kpi (WORKING)
- `supabase/sql/03_materialized_views.sql` - mv_baselines, mv_health (WORKING)
- `supabase/sql/04_functions.sql` - Recommendations (WORKING)

**Frontend Hooks:**
- `src/hooks/useReportsData.ts` - NEEDS FIX (line 486, 591, 831)
- `src/hooks/useCampaignMetrics.ts` - NEEDS FIX (line 104)
- `src/hooks/useObjectivePerformanceSummary.ts` - Reference implementation (GOOD)
- `src/hooks/usePerformanceMetrics.ts` - Works for workspace aggregates
- `src/hooks/useTrafficAnalysis.ts` - Needs objective context

**Components:**
- `src/pages/Reports.tsx` - NEEDS FIX (lines 107, 273, 314)
- `src/components/campaigns/CampaignsTable.tsx` - NEEDS KPI columns
- `src/pages/Dashboard.tsx` - Mostly OK (uses ObjectivePerformanceSection)
- `src/pages/TrafficAnalysis.tsx` - NEEDS LABEL FIX (line 142)
- `src/components/dashboard/ObjectivePerformance.tsx` - REFERENCE (GOOD)

**Types:**
- `src/types/sync.ts` - SyncInsightsSummary (GOOD structure)
- `src/lib/conversionMetrics.ts` - Action mapping (GOOD)
- Missing: `src/lib/kpiCalculations.ts` - NEEDS CREATION

## One-Liner Fixes

1. Remove line 486 overloading: `const conversions = started;`
2. Replace "conversoas" with dynamic result_label
3. Use cost_per_result instead of cpa in reports
4. Query v_campaign_kpi instead of performance_metrics
5. Add result_label/result_value to all breakdown types


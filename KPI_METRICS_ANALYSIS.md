# KPI/Metrics Implementation Analysis Report
## Traffic-Zen-Hub-35 Dashboard

**Date:** November 2, 2025  
**Branch:** feature/audit-dashboard-metrics  
**Analysis Scope:** KPI computation, metric display, and objective-based result calculation

---

## EXECUTIVE SUMMARY

The codebase has a **strong foundation** for objective-based KPI calculation with:
- A production-grade SQL view (`v_campaign_kpi`) that correctly maps objectives to primary results
- Materialized views for baseline calculations and health scoring
- Multiple hooks implementing different metric aggregation approaches
- UI components displaying results by objective

However, there are **critical gaps** preventing consistent PRIMARY RESULT implementation across the dashboard:
- **Inconsistent metric naming:** "conversions" is overloaded to mean different things in different contexts
- **UI components don't use the KPI view:** Reports, Campaigns, and Dashboard tables bypass v_campaign_kpi
- **No unified cost_per_result in client-side queries:** Hook implementations calculate variations, not normalized costs
- **Missing objective-to-result mapping in hooks:** Generic "conversions" instead of objective-specific metrics

---

## 1. DATABASE LAYER - STATUS: IMPLEMENTED ✓

### v_campaign_kpi View (COMPLETE)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/supabase/sql/02_views.sql` (lines 30-174)

**What's Done:**
- Maps campaign objectives to PRIMARY RESULT types:
  - `OUTCOME_LEADS` → "Leads"
  - `OUTCOME_MESSAGES` → "Conversas" 
  - `LINK_CLICKS`/`OUTCOME_TRAFFIC` → "Cliques"
  - `OUTCOME_ENGAGEMENT` → "Engajamentos"
  - `VIDEO_VIEWS` → "Views"
  - `OUTCOME_SALES` → "Compras"
  - Google Ads → "Cliques"
  - Default → "Resultados"

- Computes `cost_per_result` correctly:
  ```sql
  CASE WHEN result_value > 0 THEN spend / result_value ELSE NULL END
  ```

- Computes ROAS (only for SALES objectives):
  ```sql
  CASE WHEN objective IN ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') 
       AND conversion_value > 0 AND spend > 0
    THEN conversion_value / spend ELSE NULL END
  ```

- Output columns:
  - `result_label` - Human-readable result type
  - `result_value` - Objective-specific metric value
  - `cost_per_result` - Spend per primary result
  - `roas` - ROAS for sales campaigns

**Example Result:**
For a LEADS campaign: `result_label="Leads"`, `result_value=150`, `cost_per_result=23.45`

**Issue:** View exists but is **NOT QUERIED from the frontend**.

---

### Supporting Infrastructure

#### v_metrics View (HELPER)
- Derives standard metrics (CTR, CPC, CPM, CVR)
- Also computes `cost_per_result` assuming `conv_primary` is the KPI
- Issue: Doesn't map objectives, treats all conversions equally

#### mv_baselines (Materialized View) 
- Calculates 14-day percentiles and averages for:
  - `p50_cpr_14d` - Median cost per result
  - `avg_cpr_14d` - Average cost per result
  - `avg_ctr_14d`, `avg_cvr_14d`, `avg_cpm_14d`
- **Good:** Uses `cost_per_result` from v_metrics correctly
- Used by: Recommendation engine (R1, R3, R4)

#### mv_health (Health Scoring)
- Scores performance against baselines
- Components: 45% CPR, 20% CTR, 25% CVR, 10% CPM
- **Status:** Works correctly with objective-aware baselines

---

## 2. BUSINESS LOGIC LAYER - STATUS: PARTIAL ⚠️

### Conversion Metrics Library (CORE)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/lib/conversionMetrics.ts`

**What's Done:**
```typescript
export const CONVERSATION_STARTED_ACTION = "onsite_conversion.messaging_conversation_started_7d";
export const CONVERSATION_CONNECTION_ACTION = "onsite_conversion.total_messaging_connection";

export const CONVERSION_PRIMARY_ACTIONS = [
  CONVERSATION_STARTED_ACTION,
  CONVERSATION_CONNECTION_ACTION,
  "onsite_conversion.messaging_first_reply",
  "offsite_conversion.fb_pixel_lead",
  "lead",
  "omni_purchase",
];

export const CONVERSION_FALLBACK_ACTIONS = [
  "action.conversion", 
  "lead_generation", 
  "onsite_conversion.lead"
];
```

**Functions:**
- `getActionValueForType()` - Extract action count from extra_metrics
- `resolvePrimaryConversion()` - Find primary action type with fallback logic
- `extractPrimaryConversions()` - Get count of primary conversions
- `getConversionActionLabel()` - Human label for action type

**Problem:** These functions only handle **Meta action types**, not **objective-based mapping**.
- No function exists for: "Given an objective, what is the PRIMARY RESULT metric?"
- No standardization of cost calculation by objective

---

### Objective Mapping (INCOMPLETE)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/hooks/useObjectivePerformanceSummary.ts` (lines 114-152)

**What's Done:**
```typescript
const OBJECTIVE_CATEGORY_MAP: Record<string, ObjectiveCategory> = {
  OUTCOME_ENGAGEMENT: "ENGAGEMENT",
  OUTCOME_LEADS: "LEADS",
  OUTCOME_TRAFFIC: "TRAFFIC",
  OUTCOME_SALES: "SALES",
  OUTCOME_AWARENESS: "RECOGNITION",
  OUTCOME_APP_PROMOTION: "APP",
  // ... full mapping
};
```

Implemented logic for mapping metrics within **ObjectivePerformanceSummary**, but:
- Only used in ONE component: `ObjectivePerformance.tsx`
- Returns aggregated objective-level summaries, not campaign/adset-level KPIs
- Each objective has its own summary structure (LeadsSummary, SalesSummary, etc.)

**Missing:** A client-side function equivalent to `v_campaign_kpi` that:
1. Takes a campaign objective
2. Returns which metric is the PRIMARY RESULT
3. Computes cost per result for that metric

---

## 3. FRONTEND HOOKS - STATUS: INCONSISTENT ⚠️

### usePerformanceMetrics (DASHBOARD)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/hooks/usePerformanceMetrics.ts`

**Purpose:** Top-level dashboard performance summary  
**Query:** Workspace-level aggregates (no campaign/adset filters)

**What It Does:**
```typescript
- conversationsStarted: number
- messagingConnections: number
- conversions: number (set to conversationsStarted)
- conversionValue: number
- roas: number
- primaryConversionAction: string | null
- primaryConversionLabel: string
```

**Problem:** 
- Only tracks "Conversations Started" as conversions
- No objective-based filtering
- Not useful for "each campaign shows its PRIMARY RESULT"
- Hard-codes conversations as the primary metric across all accounts

---

### useReportsData (REPORTS PAGE)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/hooks/useReportsData.ts`

**Purpose:** Detailed reporting with channel/objective/campaign breakdowns

**Metrics Computed:**
```typescript
ObjectiveBreakdownItem {
  objective: string,
  conversions: number,          // Conversation count
  conversations: number,         // Message connections
  cpa: number,                   // Spend / conversions
  costPerConversation: number,   // Spend / conversations
}

EntityPerformanceItem {
  conversions: number,
  conversations: number,
  cpa: number,
  costPerConversation: number,
}
```

**Problem:**
- Line 486: `const conversions = started;` - "conversions" = conversation starts
- Line 591: `objectiveAgg.conversions += started;` - Same overloading
- Line 831: `cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0;`
  - CPA calculated as spend/conversations, not objective-specific
- **No cost_per_result** column at all
- Objective breakdown shows generic metrics, not PRIMARY RESULT by objective

**What Gets Used:**
- Channel comparison: ✓ Works (Meta vs Google spend)
- Objective breakdown: ⚠️ Shows conversions/conversations generic metrics
- Top campaigns/adsets/ads: ⚠️ Missing objective context
- Reports page (Reports.tsx): Uses only conversions/costPerConversation

---

### useCampaignMetrics (CAMPAIGN DETAILS)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/hooks/useCampaignMetrics.ts`

**Purpose:** Campaign-level drill-down metrics

**Output:**
```typescript
CampaignMetricPoint {
  conversions: number,
  conversationsStarted: number,
  messagingConnections: number,
  spend: number,
  conversionValue: number,
  roas: number,
  cpa: number,           // Spend / conversions (conversations)
}
```

**Problem:**
- Line 104: `const conversions = started;` - Same overloading
- CPA computed as spend/conversations regardless of campaign objective
- **No result_label or result_value** (what v_campaign_kpi provides)
- **No cost_per_result** specific to objective

---

### useObjectivePerformanceSummary (DASHBOARD SECTION)
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/hooks/useObjectivePerformanceSummary.ts`

**Purpose:** Detailed breakdowns by objective category (Engagement, Traffic, Leads, Sales, etc.)

**What It Does RIGHT:**
- Maps objectives to categories (ENGAGEMENT, TRAFFIC, LEADS, SALES, etc.)
- Computes objective-specific metrics:
  - **For LEADS:** `whatsappConversations`, `formLeads`, `cpl`, `costPerConversation`
  - **For SALES:** `purchases`, `value`, `roas`, `costPerPurchase`
  - **For TRAFFIC:** `linkClicks`, `landingPageViews`, `cpc`, `costPerClick`
  - **For ENGAGEMENT:** `totalConversations`, `messagingConnections`, `costPerEngagement`

**Problem:**
- Only works at objective CATEGORY level, not individual campaigns
- Returns aggregated summary, not campaign-by-campaign results
- Each objective has its own interface (LeadsSummary, SalesSummary, etc.)
- **Not used for individual campaign KPI display**

---

## 4. UI COMPONENTS - STATUS: MISALIGNED ⚠️

### CampaignsTable.tsx
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/components/campaigns/CampaignsTable.tsx`

**What It Shows:**
```
| Campaign Name | Account | Objective | Status | Daily Budget | Lifetime Budget | Start | End | Actions |
```

**Issues:**
- Shows ONLY campaign metadata
- **No performance metrics shown** (no cost_per_result, no KPI)
- Objective column shows raw enum (e.g., "OUTCOME_LEADS")
- Not suitable for "campaign shows PRIMARY RESULT based on objective"

**Should Show:**
- Primary result metric label (Leads, Cliques, Conversas, Compras)
- Result count
- Cost per result (objective-specific)
- Trend indicator

---

### Dashboard.tsx
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/pages/Dashboard.tsx`

**Components Used:**
1. `PerformanceChart` - Time series (only conversations/value)
2. `CampaignsTable` - List view (metadata only)
3. `ObjectivePerformanceSection` - Aggregated summaries

**Issues:**
- No campaign-by-campaign KPI display
- ObjectivePerformanceSection shows category aggregates, not individual campaigns
- Missing: "Top campaigns" with PRIMARY RESULT by objective

---

### Reports.tsx
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/pages/Reports.tsx`

**What It Shows:**
```
Objective Breakdown Table:
| Objective | Investment | Conversões | Conexões | CTR | CPC | CPA | Custo/Conversa |

Top Campaigns Table:
| # | Name | Conversas | CPA | Spend | Impressões |
```

**Issues:**
- Line 107: Hard-coded "conversas" (conversations) for all entities
- CPA calculated generically (spend/conversations)
- **No "Cost per Result" column**
- Objective breakdown shows generic metrics, not PRIMARY RESULT
- Top campaigns use conversations as the universal metric

**Should Show:**
```
Objective Breakdown:
| Objetivo | Investimento | [Primary Result] | Custo por Resultado |
| LEADS    | R$ 1,000     | 150 Leads        | R$ 6,67             |
| TRAFFIC  | R$ 2,000     | 5,000 Cliques    | R$ 0,40             |
| SALES    | R$ 500       | 10 Compras       | R$ 50,00            |
```

---

### TrafficAnalysis.tsx
**Location:** `/Users/andrew/Traffic/traffic-zen-hub-35/src/pages/TrafficAnalysis.tsx`

**What It Shows:**
```
Sync Insights Section (from latest sync)
- Investimento: R$ X
- Resultados: Y
- CPL: R$ Z
```

**Issues:**
- Line 142: Hard-codes "CPL" for all campaigns
- `totalResults` is generic (conversations)
- `costPerResult` is conversations/cost (not objective-specific)

**Source:** `useLatestSyncInsights` → `postSyncInsights.ts` (backend-computed)

---

## 5. TYPE DEFINITIONS - STATUS: PARTIAL ⚠️

### In Frontend

**useObjectivePerformanceSummary.ts:**
- ✓ LeadsSummary, SalesSummary, TrafficSummary, etc. (objective-specific)
- ✓ Each has appropriate metrics (cpl, roas, cpc, etc.)

**useReportsData.ts:**
- ⚠️ ObjectiveBreakdownItem: Has `conversions`, `conversations`, `cpa`, `costPerConversation`
- ✗ Missing: `result_label`, `result_value`, `cost_per_result` mapping
- ⚠️ EntityPerformanceItem: Same problem

**useCampaignMetrics.ts:**
- ✗ Has `conversions`, `cpa`, `roas`
- ✗ Missing: Objective context, `cost_per_result`

**useTrafficAnalysis.ts:**
- ⚠️ CampaignPerformance has `cpl` but hard-coded for all campaigns
- ✗ No objective-specific mapping

### In Backend (postSyncInsights.ts)
- ✓ SyncInsightsSummary.performance has `costPerResult`, `roas`
- ⚠️ Unclear how these are computed objective-wise

---

## 6. WHAT'S MISSING FOR FULL IMPLEMENTATION

### Critical Missing Pieces

#### A. Client-Side Function: computePrimaryKpi()
```typescript
// MISSING - Should exist in src/lib/kpiCalculations.ts

function computePrimaryKpi(campaign: {
  objective: string;
  spend: number;
  leads?: number;
  conversations?: number;
  clicks?: number;
  purchases?: number;
  value?: number;
  engagements?: number;
  views?: number;
}): {
  resultLabel: string;
  resultValue: number;
  costPerResult: number;
  roas?: number;
} {
  // Map objective → primary metric
  // Calculate cost_per_result
  // Return normalized structure
}
```

#### B. Updated Hook: useCampaignKPI()
```typescript
// MISSING - Should replace useCampaignMetrics()

interface CampaignKPI {
  resultLabel: string;      // "Leads", "Cliques", "Conversas", "Compras"
  resultValue: number;      // Count of primary result
  costPerResult: number;    // Spend / resultValue
  roas?: number;            // For sales only
  ctr: number;
  cpc: number;
}

// Query v_campaign_kpi instead of performance_metrics
```

#### C. Query the v_campaign_kpi View
**Current State:** Never queried from frontend
```sql
-- RECOMMENDED
supabase
  .from('v_campaign_kpi')
  .select('objective, result_label, result_value, cost_per_result, roas, spend, clicks')
  .eq('campaign_id', campaignId)
```

#### D. Update UI Components

**CampaignsTable.tsx:**
- Add columns: `result_label`, `result_value`, `cost_per_result`
- Remove generic "Objective" display
- Show formatted KPI for each campaign

**Reports.tsx Objective Breakdown:**
- Show `result_label` instead of generic "Conversões"
- Show `cost_per_result` instead of `cpa`
- Show `result_value` instead of `conversions`

**Reports.tsx Top Campaigns:**
- Show `result_label` per campaign
- Show `cost_per_result` per campaign
- Aggregate by objective, not generic metrics

#### E. Fix Type Definitions

**ObjectiveBreakdownItem should be:**
```typescript
{
  objective: string;
  spend: number;
  resultLabel: string;      // ← NEW
  resultValue: number;      // ← NEW
  costPerResult: number;    // ← NEW
  roas?: number;            // ← Already there for sales
  // Remove generic conversions/conversations
}
```

**CampaignMetricPoint should include:**
```typescript
resultLabel?: string;
resultValue?: number;
costPerResult?: number;
// Keep cpa only if needed for legacy
```

---

## 7. WHAT'S ALREADY WORKING ✓

1. **Database KPI view:** v_campaign_kpi is COMPLETE and CORRECT
2. **Objective categories:** OBJECTIVE_CATEGORY_MAP properly groups campaigns
3. **Materialized baselines:** mv_baselines/mv_health score correctly
4. **Recommendation engine:** Uses correct cost_per_result in rules (R1-R5)
5. **ObjectivePerformance component:** Shows objective summaries correctly
6. **Conversion action tracking:** CONVERSATION_STARTED_ACTION and fallback logic works
7. **Type definitions:** SyncInsightsSummary and backend insights structure is good
8. **Health scoring:** Uses 45% CPR (cost per result), properly weighted

---

## 8. SEVERITY & IMPACT

### Current Issues by Component

| Component | Issue | Severity | Impact |
|-----------|-------|----------|--------|
| CampaignsTable | No KPI display | HIGH | Can't see campaign efficiency |
| Reports.tsx | Generic "conversoas" metric | HIGH | Misleading metrics for non-lead campaigns |
| useReportsData | Doesn't use v_campaign_kpi | HIGH | Wrong cost calculations |
| useCampaignMetrics | No objective mapping | MEDIUM | Campaign details page inaccurate |
| usePerformanceMetrics | Workspace-level only | LOW | Dashboard aggregates are OK |
| TrafficAnalysis | Hard-coded CPL | MEDIUM | Incorrect for non-lead campaigns |

### Plan Alignment

**The plan states:**
> "Fix generic 'Conversões/CPL' metrics and make each campaign show its PRIMARY RESULT based on OBJECTIVE with proper cost calculation."

**Current State:**
- ✓ Plan concept is correctly implemented in database (v_campaign_kpi)
- ✗ Plan is NOT reflected in frontend hooks
- ✗ Plan is NOT reflected in UI components
- ✗ Terminology "PRIMARY RESULT" exists in SQL but not in frontend code

---

## 9. IMPLEMENTATION CHECKLIST

### Phase 1: Backend/Business Logic (MINIMAL - mostly existing)
- [ ] Verify v_campaign_kpi computation is correct (appears to be)
- [ ] Ensure all objectives are mapped correctly
- [ ] Document the result_label/result_value output format

### Phase 2: Frontend Business Logic
- [ ] Create `src/lib/kpiCalculations.ts` with computePrimaryKpi() function
- [ ] Update type definitions in hooks (remove generic conversions)
- [ ] Create `useObjectiveBasedKPI()` hook that queries v_campaign_kpi

### Phase 3: Frontend Components
- [ ] Update CampaignsTable to show result_label, result_value, cost_per_result
- [ ] Update Reports.tsx ObjectiveBreakdown table columns
- [ ] Update Reports.tsx TopCampaigns table columns
- [ ] Update TrafficAnalysis to use computed costPerResult

### Phase 4: Testing & Refinement
- [ ] Test with multi-objective workspace
- [ ] Verify ROAS shows only for SALES
- [ ] Verify cost_per_result calculation matches SQL
- [ ] Update type definitions across all hooks

---

## 10. EXAMPLE: WHAT SHOULD HAPPEN

### Current (WRONG):
```
Campaign: "Q4 Lead Gen"
Objective: OUTCOME_LEADS
Conversões: 800 (means conversations)
CPA: R$ 12.50 (spend / conversations)
```

### After Fix (CORRECT):
```
Campaign: "Q4 Lead Gen"
Resultado: 150 Leads
Custo por Resultado: R$ 66,67
```

### Current (WRONG):
```
Campaign: "Website Traffic"
Objetivo: LINK_CLICKS
Conversões: 200 (means conversations? clicks? unclear)
CPA: R$ 50 (shouldn't exist for traffic)
```

### After Fix (CORRECT):
```
Campaign: "Website Traffic"
Resultado: 5,000 Cliques
Custo por Resultado: R$ 2,00
```

---

## CONCLUSION

The **architecture is sound** - the database correctly computes PRIMARY RESULTS by objective. However, **the frontend does not leverage this layer**. Instead, it:
1. Uses generic "conversions" = conversations
2. Computes generic CPA for all campaign types
3. Bypasses v_campaign_kpi entirely
4. Shows misleading metrics (e.g., CPL for traffic campaigns)

**To complete the implementation:**
- Query v_campaign_kpi from frontend
- Create client-side KPI calculation function
- Update UI to display result_label and cost_per_result
- Remove generic "conversions" terminology

**Estimated Effort:** 2-3 days (straightforward refactoring, no new algorithms needed)


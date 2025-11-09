-- 0023_financial_cashflow.sql
-- Estruturas para importar e visualizar o fluxo de caixa financeiro.

CREATE TABLE IF NOT EXISTS financial_cashflow_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entry_date DATE,
    counterparty TEXT,
    amount NUMERIC(18, 2),
    entry_type TEXT,
    bank TEXT,
    document_code TEXT,
    group_name TEXT,
    subgroup_name TEXT,
    status TEXT,
    notes TEXT,
    source_sheet TEXT DEFAULT 'Lancamentos',
    source_row INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_cashflow_entries_workspace_date_idx
    ON financial_cashflow_entries (workspace_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS financial_cashflow_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    month_name TEXT,
    opening_balance NUMERIC(18, 2),
    inflows NUMERIC(18, 2),
    outflows NUMERIC(18, 2),
    closing_balance NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, year, month)
);

CREATE INDEX IF NOT EXISTS financial_cashflow_monthly_workspace_idx
    ON financial_cashflow_monthly (workspace_id, year, month);

CREATE TABLE IF NOT EXISTS financial_cashflow_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER,
    day INTEGER,
    reference_date DATE NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('first_half', 'second_half')),
    opening_balance NUMERIC(18, 2),
    inflows NUMERIC(18, 2),
    outflows NUMERIC(18, 2),
    closing_balance NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, reference_date, period)
);

CREATE INDEX IF NOT EXISTS financial_cashflow_daily_workspace_idx
    ON financial_cashflow_daily (workspace_id, reference_date);

CREATE TABLE IF NOT EXISTS financial_results_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER,
    month_name TEXT,
    group_name TEXT,
    category_label TEXT NOT NULL,
    realized_value NUMERIC(18, 2),
    projected_value NUMERIC(18, 2),
    row_position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_results_monthly_workspace_idx
    ON financial_results_monthly (workspace_id, year, month, group_name);

CREATE TABLE IF NOT EXISTS financial_plan_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category_group TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, category_group, subcategory)
);

CREATE TABLE IF NOT EXISTS financial_category_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category_primary TEXT,
    category_helper TEXT,
    month_number INTEGER,
    month_name TEXT,
    revenue_value NUMERIC(18, 2),
    expense_value NUMERIC(18, 2),
    cash_month_number INTEGER,
    cash_month_name TEXT,
    cash_total NUMERIC(18, 2),
    balance_category TEXT,
    balance_value NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_category_intelligence_workspace_idx
    ON financial_category_intelligence (workspace_id, month_number);

CREATE TABLE IF NOT EXISTS financial_insight_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    card_key TEXT NOT NULL,
    label TEXT NOT NULL,
    value NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, card_key)
);

CREATE TABLE IF NOT EXISTS financial_sheet_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, sheet_name, row_index)
);

-- RLS -----------------------------------------------------------------------
ALTER TABLE financial_cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_cashflow_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_cashflow_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_results_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_plan_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_category_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_insight_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sheet_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_cashflow_entries_select ON financial_cashflow_entries FOR SELECT USING (true);
CREATE POLICY financial_cashflow_entries_modify ON financial_cashflow_entries FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_cashflow_monthly_select ON financial_cashflow_monthly FOR SELECT USING (true);
CREATE POLICY financial_cashflow_monthly_modify ON financial_cashflow_monthly FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_cashflow_daily_select ON financial_cashflow_daily FOR SELECT USING (true);
CREATE POLICY financial_cashflow_daily_modify ON financial_cashflow_daily FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_results_monthly_select ON financial_results_monthly FOR SELECT USING (true);
CREATE POLICY financial_results_monthly_modify ON financial_results_monthly FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_plan_accounts_select ON financial_plan_accounts FOR SELECT USING (true);
CREATE POLICY financial_plan_accounts_modify ON financial_plan_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_category_intelligence_select ON financial_category_intelligence FOR SELECT USING (true);
CREATE POLICY financial_category_intelligence_modify ON financial_category_intelligence FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_insight_cards_select ON financial_insight_cards FOR SELECT USING (true);
CREATE POLICY financial_insight_cards_modify ON financial_insight_cards FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY financial_sheet_notes_select ON financial_sheet_notes FOR SELECT USING (true);
CREATE POLICY financial_sheet_notes_modify ON financial_sheet_notes FOR ALL USING (true) WITH CHECK (true);

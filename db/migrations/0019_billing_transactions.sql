-- Migration: Meta Billing Transactions Support
-- Purpose: Store payment transactions synced from Meta billing API and expose summarized view

-- ============================================================================
-- BILLING TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  transaction_time TIMESTAMPTZ NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  currency TEXT,
  payment_method_type TEXT,
  payment_method_details JSONB DEFAULT '{}'::JSONB,
  payment_status TEXT,
  billing_reason TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT billing_transactions_unique UNIQUE (platform_account_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_workspace_time
  ON billing_transactions (workspace_id, transaction_time DESC);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_account_time
  ON billing_transactions (platform_account_id, transaction_time DESC);

COMMENT ON TABLE billing_transactions IS 'Transações de cobrança obtidas via Meta Billing API';
COMMENT ON COLUMN billing_transactions.external_id IS 'ID da transação retornado pela API do Meta';
COMMENT ON COLUMN billing_transactions.transaction_time IS 'Data/Hora em que a transação foi registrada pelo Meta';

-- ============================================================================
-- DAILY SUMMARY VIEW
-- ============================================================================
CREATE OR REPLACE VIEW v_billing_transactions_daily AS
SELECT
  bt.workspace_id,
  bt.platform_account_id,
  DATE_TRUNC('day', bt.transaction_time)::DATE AS transaction_date,
  SUM(bt.amount) AS total_amount,
  COUNT(*) AS transactions_count,
  MIN(bt.currency) AS currency
FROM billing_transactions bt
GROUP BY
  bt.workspace_id,
  bt.platform_account_id,
  DATE_TRUNC('day', bt.transaction_time);

COMMENT ON VIEW v_billing_transactions_daily IS 'Resumo diário de transações de cobrança por conta';


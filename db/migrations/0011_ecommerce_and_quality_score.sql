-- =============================================================================
-- Migration 0011: E-commerce Tables + Google Ads Quality Score
-- =============================================================================
-- Criado em: 2025-11-02
-- Descrição:
-- 1. Adiciona quality_score ao Google Ads
-- 2. Cria tabelas de e-commerce (ecom_orders, ecom_refunds, fiscal_taxes)
-- 3. Permite calcular ROAS Real e ROI Real
-- =============================================================================

-- =============================================================================
-- PARTE 1: GOOGLE ADS - ADICIONAR QUALITY SCORE
-- =============================================================================

ALTER TABLE ads_spend_google
ADD COLUMN IF NOT EXISTS quality_score NUMERIC(3,1);

COMMENT ON COLUMN ads_spend_google.quality_score IS 'Google Ads Quality Score (1-10 scale)';

-- =============================================================================
-- PARTE 2: E-COMMERCE - TABELA DE PEDIDOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ecom_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identificação do pedido
  order_number TEXT,  -- Número do pedido visível ao cliente
  external_id TEXT,   -- ID do pedido no sistema externo (gateway, loja, etc)

  -- Cliente
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_document TEXT,  -- CPF/CNPJ

  -- Valores monetários (todos em centavos ou com 4 decimais)
  gross_amount NUMERIC(18,4) NOT NULL DEFAULT 0,     -- Valor bruto (total do carrinho)
  discount_amount NUMERIC(18,4) DEFAULT 0,           -- Descontos aplicados
  tax_amount NUMERIC(18,4) DEFAULT 0,                -- Impostos
  shipping_amount NUMERIC(18,4) DEFAULT 0,           -- Frete
  order_bump_amount NUMERIC(18,4) DEFAULT 0,         -- Valor de order bumps/upsells
  payment_fee_amount NUMERIC(18,4) DEFAULT 0,        -- Taxa do gateway
  net_amount NUMERIC(18,4) GENERATED ALWAYS AS (
    gross_amount - discount_amount + shipping_amount - payment_fee_amount
  ) STORED,                                           -- Valor líquido (recebido)

  -- Atribuição de marketing (UTMs e IDs de campanhas)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  -- Referências às campanhas (se identificado)
  platform_key TEXT,  -- 'meta', 'google_ads', etc
  campaign_id UUID REFERENCES campaigns(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  ad_id UUID REFERENCES ads(id),

  -- Status do pedido
  order_status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, cancelled, refunded
  payment_status TEXT NOT NULL DEFAULT 'pending',  -- pending, authorized, paid, failed, refunded, partially_refunded
  fulfillment_status TEXT,  -- unfulfilled, partially_fulfilled, fulfilled, returned

  -- Pagamento
  payment_method TEXT,  -- credit_card, pix, boleto, debit_card, etc
  gateway_provider TEXT,  -- stripe, mercadopago, pagseguro, etc
  gateway_transaction_id TEXT,  -- ID da transação no gateway
  installments INTEGER DEFAULT 1,  -- Número de parcelas

  -- Datas importantes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Pedido criado
  paid_at TIMESTAMPTZ,  -- Pagamento confirmado
  completed_at TIMESTAMPTZ,  -- Pedido concluído/entregue
  cancelled_at TIMESTAMPTZ,  -- Cancelado
  refunded_at TIMESTAMPTZ,  -- Reembolsado

  -- Metadata adicional
  metadata JSONB,  -- Dados extras (itens, endereço, etc)
  notes TEXT,  -- Notas internas

  -- Moeda
  currency TEXT DEFAULT 'BRL',

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_ecom_orders_workspace ON ecom_orders(workspace_id, created_at DESC);
CREATE INDEX idx_ecom_orders_status ON ecom_orders(workspace_id, order_status, payment_status);
CREATE INDEX idx_ecom_orders_paid_at ON ecom_orders(workspace_id, paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX idx_ecom_orders_campaign ON ecom_orders(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_ecom_orders_gateway ON ecom_orders(gateway_provider, gateway_transaction_id);
CREATE INDEX idx_ecom_orders_customer_email ON ecom_orders(workspace_id, customer_email);
CREATE INDEX idx_ecom_orders_utm_campaign ON ecom_orders(workspace_id, utm_campaign) WHERE utm_campaign IS NOT NULL;

-- Unique constraint para evitar duplicação
CREATE UNIQUE INDEX idx_ecom_orders_unique_external
  ON ecom_orders(workspace_id, gateway_provider, gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE ecom_orders IS 'Pedidos de e-commerce com atribuição de marketing';
COMMENT ON COLUMN ecom_orders.gross_amount IS 'Valor bruto total do pedido';
COMMENT ON COLUMN ecom_orders.net_amount IS 'Valor líquido recebido após descontos e taxas (calculado automaticamente)';
COMMENT ON COLUMN ecom_orders.order_bump_amount IS 'Valor adicional de order bumps, upsells ou cross-sells';

-- =============================================================================
-- PARTE 3: REEMBOLSOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ecom_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ecom_orders(id) ON DELETE CASCADE,

  -- Valores
  refund_amount NUMERIC(18,4) NOT NULL,
  refund_reason TEXT,
  refund_type TEXT,  -- full, partial

  -- Gateway
  gateway_refund_id TEXT,
  gateway_provider TEXT,

  -- Status
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed

  -- Datas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,

  currency TEXT DEFAULT 'BRL'
);

CREATE INDEX idx_ecom_refunds_order ON ecom_refunds(order_id, created_at DESC);
CREATE INDEX idx_ecom_refunds_status ON ecom_refunds(status, created_at DESC);

COMMENT ON TABLE ecom_refunds IS 'Reembolsos de pedidos';

-- =============================================================================
-- PARTE 4: IMPOSTOS FISCAIS (OPCIONAL - para cálculo de lucro real)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fiscal_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ecom_orders(id) ON DELETE CASCADE,

  -- Impostos brasileiros
  icms_amount NUMERIC(18,4) DEFAULT 0,  -- ICMS
  ipi_amount NUMERIC(18,4) DEFAULT 0,   -- IPI
  pis_amount NUMERIC(18,4) DEFAULT 0,   -- PIS
  cofins_amount NUMERIC(18,4) DEFAULT 0,  -- COFINS
  iss_amount NUMERIC(18,4) DEFAULT 0,   -- ISS (para serviços)

  -- Total de impostos
  total_tax_amount NUMERIC(18,4) GENERATED ALWAYS AS (
    icms_amount + ipi_amount + pis_amount + cofins_amount + iss_amount
  ) STORED,

  -- Metadata
  tax_regime TEXT,  -- simples_nacional, lucro_presumido, lucro_real
  nfe_number TEXT,  -- Número da Nota Fiscal Eletrônica
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fiscal_taxes_order ON fiscal_taxes(order_id);

COMMENT ON TABLE fiscal_taxes IS 'Impostos fiscais dos pedidos para cálculo de lucro real';

-- =============================================================================
-- PARTE 5: VIEWS ANALÍTICAS
-- =============================================================================

-- View: Pedidos pagos com atribuição
CREATE OR REPLACE VIEW v_paid_orders_with_attribution AS
SELECT
  eo.id,
  eo.workspace_id,
  eo.order_number,
  eo.customer_email,
  eo.gross_amount,
  eo.net_amount,
  eo.payment_method,
  eo.paid_at,
  eo.utm_campaign,
  eo.campaign_id,
  c.name as campaign_name,
  c.objective as campaign_objective,
  pa.platform_key
FROM ecom_orders eo
LEFT JOIN campaigns c ON eo.campaign_id = c.id
LEFT JOIN platform_accounts pa ON c.platform_account_id = pa.id
WHERE eo.payment_status IN ('paid', 'partially_refunded');

COMMENT ON VIEW v_paid_orders_with_attribution IS 'Pedidos pagos com informações de atribuição de marketing';

-- View: ROAS Real por Campanha
CREATE OR REPLACE VIEW v_campaign_roas_real AS
SELECT
  c.workspace_id,
  c.id as campaign_id,
  c.name as campaign_name,
  c.objective,
  pa.platform_key,

  -- Gasto em ads
  COALESCE(SUM(DISTINCT pm.spend), 0) as ad_spend,

  -- Receita real
  COALESCE(SUM(eo.net_amount), 0) as revenue,

  -- ROAS Real
  CASE
    WHEN COALESCE(SUM(DISTINCT pm.spend), 0) > 0 THEN
      COALESCE(SUM(eo.net_amount), 0) / COALESCE(SUM(DISTINCT pm.spend), 1)
    ELSE 0
  END as roas_real,

  -- Contadores
  COUNT(DISTINCT eo.id) as total_orders,
  COUNT(DISTINCT CASE WHEN eo.payment_status = 'paid' THEN eo.id END) as paid_orders

FROM campaigns c
LEFT JOIN platform_accounts pa ON c.platform_account_id = pa.id
LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
LEFT JOIN ecom_orders eo ON c.id = eo.campaign_id AND eo.payment_status IN ('paid', 'partially_refunded')
WHERE c.archived = false
GROUP BY c.workspace_id, c.id, c.name, c.objective, pa.platform_key;

COMMENT ON VIEW v_campaign_roas_real IS 'ROAS Real calculado com vendas reais vs gasto em ads';

-- =============================================================================
-- PARTE 6: FUNÇÃO PARA CALCULAR TICKET MÉDIO
-- =============================================================================

CREATE OR REPLACE FUNCTION get_avg_ticket(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC(18,4)
LANGUAGE plpgsql
AS $$
DECLARE
  avg_ticket NUMERIC(18,4);
BEGIN
  SELECT AVG(net_amount) INTO avg_ticket
  FROM ecom_orders
  WHERE workspace_id = p_workspace_id
    AND payment_status = 'paid'
    AND paid_at >= (CURRENT_DATE - p_days * INTERVAL '1 day');

  RETURN COALESCE(avg_ticket, 0);
END;
$$;

COMMENT ON FUNCTION get_avg_ticket IS 'Calcula ticket médio dos últimos N dias';

-- =============================================================================
-- PARTE 7: RLS (Row Level Security)
-- =============================================================================

ALTER TABLE ecom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_taxes ENABLE ROW LEVEL SECURITY;

-- Policy para ecom_orders
CREATE POLICY "Users can view orders from their workspaces"
  ON ecom_orders FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert orders in their workspaces"
  ON ecom_orders FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Policy para ecom_refunds
CREATE POLICY "Users can view refunds from their workspace orders"
  ON ecom_refunds FOR SELECT
  USING (order_id IN (
    SELECT id FROM ecom_orders WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- Policy para fiscal_taxes
CREATE POLICY "Users can view fiscal taxes from their workspace orders"
  ON fiscal_taxes FOR SELECT
  USING (order_id IN (
    SELECT id FROM ecom_orders WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- =============================================================================
-- CONCLUÍDO
-- =============================================================================
-- Esta migration adiciona:
-- 1. Quality Score ao Google Ads (para análise de keywords)
-- 2. Tabelas de e-commerce completas (orders, refunds, fiscal taxes)
-- 3. Views analíticas para ROAS Real
-- 4. Função para calcular ticket médio
-- 5. RLS para segurança
--
-- Próximo passo: Implementar webhooks de pagamento (Stripe, Mercado Pago)
-- =============================================================================

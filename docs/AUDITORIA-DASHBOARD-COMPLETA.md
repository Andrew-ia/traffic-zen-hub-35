# AUDITORIA COMPLETA DO DASHBOARD - TRAFFIC ZEN HUB

**Data da Auditoria:** 2025-11-02
**Branch:** feature/audit-dashboard-metrics
**Objetivo:** Mapear integrações, identificar lacunas e criar plano prescritivo para implementação completa

---

## ÍNDICE

1. [Tabela GAP - Análise de Recursos](#1-tabela-gap---análise-de-recursos)
2. [Dicionário de Métricas com Fórmulas](#2-dicionário-de-métricas-com-fórmulas)
3. [Esquema SQL Unificado (DDL)](#3-esquema-sql-unificado-ddl)
4. [Checklist de Integração por Provedor](#4-checklist-de-integração-por-provedor)
5. [Backlog Priorizado de Tarefas](#5-backlog-priorizado-de-tarefas)

---

## 1. TABELA GAP - ANÁLISE DE RECURSOS

| Recurso | Fonte(s) | Está pronto? | O que falta | Endpoint/escopo | Tabelas/joins | Fórmulas afetadas | Risco | Próximo passo |
|---------|----------|--------------|-------------|-----------------|---------------|-------------------|-------|---------------|
| **Integração Meta Ads** | Meta Marketing API | ✅ 100% | Nada | v19.0/act_{id}/insights, campaigns, adsets, ads | performance_metrics, campaigns, ad_sets, ads | Todas métricas Meta | Baixo | Manter atualizado |
| **Integração Google Ads** | Google Ads API | ❌ 0% | Tudo (OAuth, sync, metrics) | v14/customers/{id}/googleAdsService:search | ads_spend_google, campaigns, performance_metrics | ROAS, CPA, ROI total | Alto | Implementar OAuth + sync script |
| **Integração GA4** | GA4 Data API | ❌ 0% | Tudo (OAuth, events, tracking) | v1beta/properties/{id}:runReport | ga4_events, ecom_orders | Funil conversão, pageview→checkout | Alto | Implementar Data API + eventos |
| **Tracking de Checkout** | GA4 Measurement Protocol | ❌ 0% | Events: begin_checkout, add_to_cart, purchase | v2/measurement_protocol/mp/collect | ga4_events, ecom_orders | Conv Checkout→Compras | Médio | Implementar GTM + eventos |
| **Order Bump % e Valor** | Gateway pagamento ou CRM | ❌ 0% | Integração com gateway + campo order_bump | Stripe/MP webhooks ou planilha | ecom_orders.order_bump_amount | Order Bump %, Order Bump Valor | Médio | Definir fonte (gateway/manual) |
| **Ticket Médio** | eCommerce/Gateway | ⚠️ 50% | Tem conversion_value, falta net_revenue_real | Criar campo calculado | ecom_orders.gross_amount, refunds, taxes | Ticket Médio Real | Baixo | Criar campo net_amount |
| **ROAS Real vs Ads** | Meta + eCommerce | ⚠️ 50% | Tem ROAS_ads, falta ROAS_real | Junção purchase real + ad_spend | performance_metrics + ecom_orders | ROAS_real | Baixo | Implementar join orders→ads |
| **ROI Real** | Todas fontes | ❌ 0% | Falta COGS, payment_fees, impostos | Entrada manual ou ERP | ecom_orders + fiscal_taxes | ROI_real | Médio | Criar inputs manuais |
| **CPA** | Meta Ads | ✅ 100% | Nada | Já calculado | performance_metrics | CPA = spend/conversions | Baixo | Nada |
| **Melhores Dias da Semana** | eCommerce + Time | ❌ 0% | Falta agregação DAYOFWEEK | Query SQL com EXTRACT(DOW) | ecom_orders.created_at | Ranking por dia + CVR | Baixo | Criar query agregada |
| **Visualização de Criativos** | Meta Creative API | ✅ 90% | Thumbnails salvos, falta preview embed | /{creative_id}?fields=thumbnail_url,image_url,video_url | creative_assets | Nenhuma | Baixo | Já implementado |
| **Idade e Gênero Compradores** | Meta Breakdowns | ⚠️ 70% | Tem age/gender de ads, falta filtro "só quem comprou" | /insights?breakdowns=age,gender,action_type | performance_metric_breakdowns | Demografia de Compradores | Médio | Filtrar breakdowns com purchase |
| **Métricas de Checkout Iniciado** | GA4 begin_checkout | ❌ 0% | Falta evento begin_checkout | GA4 Data API event:begin_checkout | ga4_events | Conv Checkout→Compras | Médio | Implementar GA4 + GTM |
| **Taxa Conv Checkout→Compras** | GA4 | ❌ 0% | Falta begin_checkout e purchase events | GA4 Data API | ga4_events | purchases / begin_checkout | Médio | Implementar GA4 events |
| **Taxa Conv Pageview→Checkout** | GA4 | ❌ 0% | Falta page_view e begin_checkout | GA4 Data API | ga4_events | begin_checkout / page_view | Médio | Implementar GA4 events |
| **Taxa Conv Pageview→Compras** | GA4 | ❌ 0% | Falta page_view e purchase | GA4 Data API | ga4_events | purchases / page_view | Médio | Implementar GA4 events |
| **Connect Rate (CTWA)** | Meta Messaging Insights | ⚠️ 80% | Tem conversations_started e link_clicks, falta cálculo explícito | /insights?fields=actions (já coletado) | performance_metrics.extra_metrics | conversations_started / link_clicks | Baixo | Criar campo calculado |
| **Detalhamento Campanhas com Vendas** | Meta + eCommerce | ⚠️ 60% | Tem omni_purchase, falta join com orders reais | Join performance_metrics + ecom_orders | performance_metrics + ecom_orders | Vendas por campanha | Médio | Implementar join attribution |
| **Métricas Google Ads Completas** | Google Ads API | ❌ 0% | Tudo | v14/googleAdsService:search | ads_spend_google | Todas métricas Google | Alto | Implementar integração |
| **Modo Claro/Escuro** | Frontend Theme | ✅ 100% | Nada | N/A | N/A | Nenhuma | Nenhum | Já implementado |
| **Comparativo entre Canais** | Meta + Google + GA4 | ⚠️ 30% | Só tem Meta, falta Google e GA4 | Unificação de fontes | performance_metrics (unificado) | Comparativo cross-channel | Alto | Implementar Google Ads |
| **Rastreamento Inteligente Vendas** | GA4 + UTMs + Attribution | ❌ 0% | Falta GA4 + modelo de atribuição | GA4 purchase + utm_links + attribution_models | ga4_events + attribution_results | Atribuição multi-touch | Alto | Implementar GA4 + modelo |
| **Impostos e Lucro Real** | Gateway + Nota Fiscal | ❌ 0% | Falta integração fiscal | API de NFe ou entrada manual | fiscal_taxes, ecom_orders | Lucro Real, ROI Real | Médio | Definir fonte (manual/API) |

---

## 2. DICIONÁRIO DE MÉTRICAS COM FÓRMULAS

### 2.1 MÉTRICAS DE TRÁFEGO PAGO (ADS)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Impressões** | Número de vezes que o anúncio foi exibido | `SUM(impressions)` | Diária | Last-click (Meta) | `performance_metrics.impressions` | `campaign_id`, `ad_set_id`, `ad_id` | Métrica básica do Meta/Google |
| **Cliques** | Número de cliques no anúncio | `SUM(clicks)` | Diária | Last-click | `performance_metrics.clicks` | `campaign_id`, `ad_set_id`, `ad_id` | Pode incluir unique_clicks |
| **CTR (Click-Through Rate)** | Taxa de cliques sobre impressões | `(cliques / impressões) × 100` | Período selecionado | Last-click | Calculado | N/A | Expresso em % |
| **CPC (Custo por Clique)** | Custo médio por clique | `gasto / cliques` | Período selecionado | Last-click | Calculado | N/A | Em moeda local (BRL) |
| **CPM (Custo por Mil Impressões)** | Custo por mil impressões | `(gasto / impressões) × 1000` | Período selecionado | N/A | Calculado | N/A | Em moeda local (BRL) |
| **Alcance (Reach)** | Número de pessoas únicas alcançadas | `SUM(reach)` | Diária | N/A | `performance_metrics.extra_metrics.reach` | `campaign_id`, `ad_set_id`, `ad_id` | Disponível apenas no Meta |
| **Frequência** | Número médio de vezes que cada pessoa viu o anúncio | `impressões / alcance` | Período selecionado | N/A | Calculado | N/A | Indica saturação |
| **Gasto (Spend)** | Valor investido em anúncios | `SUM(spend)` | Diária | N/A | `performance_metrics.spend` | `campaign_id`, `ad_set_id`, `ad_id` | Em moeda da conta (BRL/USD) |

### 2.2 MÉTRICAS DE CONVERSÃO (ADS)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Conversões (Ads)** | Conversões atribuídas pela plataforma de ads | `SUM(conversions)` | 7 dias (Meta) ou definido | Click-through (7d view 1d) | `performance_metrics.conversions` | `campaign_id`, `ad_set_id`, `ad_id` | Prioriza messaging_conversation_started_7d |
| **Valor de Conversão (Ads)** | Valor monetário atribuído pelas conversões | `SUM(conversion_value)` | 7 dias (Meta) | Click-through | `performance_metrics.conversion_value` | `campaign_id`, `ad_set_id`, `ad_id` | Em moeda da conta |
| **ROAS Ads** | Retorno sobre investimento em anúncios (atribuído) | `conversion_value / spend` | Período selecionado | Atribuição da plataforma | Calculado | N/A | Valor > 1 indica lucro |
| **CPA (Custo por Aquisição)** | Custo médio por conversão | `spend / conversões` | Período selecionado | Last-click | Calculado | N/A | Em moeda local |
| **Leads (Ads)** | Leads capturados via formulários ou pixel | `SUM(leads)` | 7 dias | Click-through | `performance_metrics.leads` | `campaign_id`, `ad_set_id`, `ad_id` | Do Meta Lead Forms ou Pixel |
| **CPL (Custo por Lead)** | Custo médio por lead | `spend / leads` | Período selecionado | Last-click | Calculado | N/A | Em moeda local |

### 2.3 MÉTRICAS DE CONVERSAÇÃO (CTWA - Click-to-WhatsApp Ads)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Conversas Iniciadas** | Conversas novas iniciadas no WhatsApp/Messenger | `SUM(actions WHERE action_type='messaging_conversation_started_7d')` | 7 dias | Click-through (7d) | `performance_metrics.extra_metrics.actions` | `campaign_id`, `ad_set_id`, `ad_id` | Métrica principal CTWA |
| **Conexões de Mensagem** | Total de conexões estabelecidas | `SUM(actions WHERE action_type='total_messaging_connection')` | 1 dia | Click-through (1d) | `performance_metrics.extra_metrics.actions` | `campaign_id`, `ad_set_id`, `ad_id` | Inclui reconexões |
| **Primeira Resposta** | Conversas com resposta do lead | `SUM(actions WHERE action_type='messaging_first_reply')` | 7 dias | Click-through | `performance_metrics.extra_metrics.actions` | `campaign_id`, `ad_set_id`, `ad_id` | Indica engajamento |
| **Connect Rate** | Taxa de conversas iniciadas sobre cliques | `conversas_iniciadas / link_clicks_ctwa` | Período selecionado | N/A | Calculado | N/A | % de cliques que viraram conversa |
| **Custo por Conversa** | Custo médio por conversa iniciada | `spend / conversas_iniciadas` | Período selecionado | Click-through (7d) | Calculado | N/A | KPI principal CTWA |

### 2.4 MÉTRICAS DE VENDAS REAIS (eCommerce)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Receita Bruta (Gross Sales)** | Total de vendas antes de descontos/taxas | `SUM(ecom_orders.gross_amount)` | Período selecionado | N/A | `ecom_orders.gross_amount` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Descontos Aplicados** | Total de descontos concedidos | `SUM(ecom_orders.discounts)` | Período selecionado | N/A | `ecom_orders.discounts` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Impostos Totais** | Total de impostos cobrados | `SUM(ecom_orders.taxes)` | Período selecionado | N/A | `ecom_orders.taxes` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Frete Cobrado** | Total de frete cobrado | `SUM(ecom_orders.shipping)` | Período selecionado | N/A | `ecom_orders.shipping` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Taxas de Pagamento** | Taxas cobradas pelo gateway | `SUM(ecom_orders.payment_fees)` | Período selecionado | N/A | `ecom_orders.payment_fees` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Receita Líquida (Net Revenue Real)** | Receita após descontos e devoluções | `gross_sales - descontos - reembolsos - impostos` | Período selecionado | N/A | Calculado | N/A | Inclui ou não frete? **Definir** |
| **Reembolsos** | Total de reembolsos processados | `SUM(ecom_refunds.amount)` | Período selecionado | N/A | `ecom_refunds.amount` | `order_id` | **⚠️ TABELA A CRIAR** |
| **Número de Pedidos** | Total de pedidos (compras) | `COUNT(DISTINCT ecom_orders.order_id)` | Período selecionado | N/A | `ecom_orders` | N/A | **⚠️ TABELA A CRIAR** |
| **Ticket Médio Bruto** | Valor médio por pedido (bruto) | `gross_sales / número_de_pedidos` | Período selecionado | N/A | Calculado | N/A | Antes de descontos/taxas |
| **Ticket Médio Líquido** | Valor médio por pedido (líquido) | `net_revenue_real / número_de_pedidos` | Período selecionado | N/A | Calculado | N/A | Após descontos/taxas |

### 2.5 MÉTRICAS DE ORDER BUMP E UPSELL

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Order Bump % (Taxa)** | % de pedidos que aceitaram order bump | `(pedidos_com_bump / total_pedidos) × 100` | Período selecionado | N/A | Calculado | `order_id` | **⚠️ Campo a criar: ecom_orders.order_bump_amount** |
| **Order Bump Valor** | Valor total gerado por order bump | `SUM(ecom_orders.order_bump_amount WHERE order_bump_amount > 0)` | Período selecionado | N/A | `ecom_orders.order_bump_amount` | `order_id` | **⚠️ Campo a criar** |
| **Receita Média Order Bump** | Valor médio por order bump aceito | `order_bump_valor / pedidos_com_bump` | Período selecionado | N/A | Calculado | N/A | Apenas pedidos que aceitaram |

### 2.6 MÉTRICAS DE RETORNO (ROAS E ROI)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **ROAS Ads** | Retorno sobre investimento em anúncios (atribuído pela plataforma) | `conversion_value_ads / ad_spend_total` | Período selecionado | Atribuição da plataforma (7d click, 1d view) | `performance_metrics` | N/A | **✅ JÁ IMPLEMENTADO** |
| **ROAS Real** | Retorno sobre investimento usando vendas reais | `net_revenue_real / ad_spend_total` | Período selecionado | Atribuição customizada ou sem atribuição | Calculado | `ecom_orders` + `performance_metrics` | **⚠️ FALTA net_revenue_real** |
| **Lucro Bruto** | Receita líquida menos custo de aquisição | `net_revenue_real - ad_spend_total` | Período selecionado | N/A | Calculado | N/A | Não considera COGS |
| **Lucro Real (Net Profit)** | Lucro após todas as despesas | `net_revenue_real - ad_spend_total - COGS - payment_fees - outras_despesas` | Período selecionado | N/A | Calculado | `ecom_orders` + `fiscal_taxes` | **⚠️ FALTA COGS e outras_despesas** |
| **ROI Real** | Retorno sobre investimento total | `(net_profit_real / ad_spend_total) × 100` | Período selecionado | N/A | Calculado | N/A | Expresso em % |
| **Margem de Lucro %** | Margem de lucro sobre receita | `(net_profit_real / net_revenue_real) × 100` | Período selecionado | N/A | Calculado | N/A | Expresso em % |

### 2.7 MÉTRICAS DE FUNIL DE CONVERSÃO (GA4)

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Page Views** | Visualizações de páginas | `COUNT(ga4_events WHERE event_name='page_view')` | Período selecionado | N/A | `ga4_events` | `user_id`, `session_id` | **⚠️ TABELA A CRIAR** |
| **Checkout Iniciado** | Checkouts iniciados | `COUNT(ga4_events WHERE event_name='begin_checkout')` | Período selecionado | GA4 Attribution | `ga4_events` | `user_id`, `session_id` | **⚠️ TABELA A CRIAR** |
| **Compras (GA4)** | Compras completadas | `COUNT(ga4_events WHERE event_name='purchase')` | Período selecionado | GA4 Attribution | `ga4_events` | `user_id`, `transaction_id` | **⚠️ TABELA A CRIAR** |
| **Receita (GA4)** | Receita rastreada pelo GA4 | `SUM(ga4_events.revenue WHERE event_name='purchase')` | Período selecionado | GA4 Attribution | `ga4_events.revenue` | `transaction_id` | **⚠️ TABELA A CRIAR** |
| **Taxa Conv Checkout→Compras** | % de checkouts que viraram compra | `(compras / checkouts_iniciados) × 100` | Período selecionado | N/A | Calculado | `session_id` | Indica abandono de carrinho |
| **Taxa Conv Pageview→Checkout** | % de pageviews que iniciaram checkout | `(checkouts_iniciados / page_views_produto) × 100` | Período selecionado | N/A | Calculado | `session_id` | Filtrar apenas product pages |
| **Taxa Conv Pageview→Compras** | % de pageviews que viraram compra | `(compras / page_views_produto) × 100` | Período selecionado | N/A | Calculado | `session_id` | Taxa de conversão geral |

### 2.8 MÉTRICAS DE DEMOGRAFIA

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Idade dos Compradores** | Distribuição de idade dos compradores | `GROUP BY dimension_values.age FROM performance_metric_breakdowns WHERE breakdown_key='age'` | Período selecionado | Atribuição da plataforma | `performance_metric_breakdowns` | `campaign_id`, `ad_id` | **✅ JÁ COLETADO** - Filtrar por purchase action |
| **Gênero dos Compradores** | Distribuição de gênero dos compradores | `GROUP BY dimension_values.gender FROM performance_metric_breakdowns WHERE breakdown_key='gender'` | Período selecionado | Atribuição da plataforma | `performance_metric_breakdowns` | `campaign_id`, `ad_id` | **✅ JÁ COLETADO** - Filtrar por purchase action |
| **Idade + Gênero dos Compradores** | Segmentação cruzada | `GROUP BY dimension_values.age, dimension_values.gender FROM performance_metric_breakdowns WHERE breakdown_key='age_gender'` | Período selecionado | Atribuição da plataforma | `performance_metric_breakdowns` | `campaign_id`, `ad_id` | **✅ JÁ COLETADO** - Filtrar por purchase action |

### 2.9 MÉTRICAS TEMPORAIS

| Métrica | Definição | Fórmula | Janela | Atribuição | Fonte | Chaves de junção | Observações |
|---------|-----------|---------|--------|------------|-------|------------------|-------------|
| **Melhor Dia da Semana** | Dia com maior receita/conversões | `GROUP BY EXTRACT(DOW FROM created_at), ORDER BY net_revenue_real DESC` | Últimos 90 dias | N/A | `ecom_orders` | N/A | **⚠️ Query a criar** DOW: 0=domingo |
| **Melhor Horário do Dia** | Horário com maior conversão | `GROUP BY EXTRACT(HOUR FROM created_at), ORDER BY COUNT(*) DESC` | Últimos 30 dias | N/A | `ecom_orders` | N/A | **⚠️ Query a criar** Considerar timezone |

---

## 3. ESQUEMA SQL UNIFICADO (DDL)

### 3.1 TABELAS PRIORITÁRIAS A CRIAR

#### **ecom_orders** - Pedidos de e-commerce

```sql
CREATE TABLE IF NOT EXISTS ecom_orders (
  -- Identificação
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Cliente
  user_id UUID REFERENCES users(id),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,

  -- Valores monetários
  gross_amount NUMERIC(18,4) NOT NULL, -- Valor bruto total
  discounts NUMERIC(18,4) DEFAULT 0, -- Descontos aplicados
  taxes NUMERIC(18,4) DEFAULT 0, -- Impostos
  shipping NUMERIC(18,4) DEFAULT 0, -- Frete
  order_bump_amount NUMERIC(18,4) DEFAULT 0, -- Valor do order bump
  upsell_amount NUMERIC(18,4) DEFAULT 0, -- Valor de upsell
  payment_fees NUMERIC(18,4) DEFAULT 0, -- Taxas do gateway
  net_amount NUMERIC(18,4) GENERATED ALWAYS AS (
    gross_amount - discounts - taxes + shipping - payment_fees
  ) STORED, -- Valor líquido calculado

  -- Atribuição (rastreamento)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  ad_platform TEXT, -- 'meta', 'google', etc
  campaign_id UUID REFERENCES campaigns(id),
  ad_set_id UUID REFERENCES ad_sets(id),
  ad_id UUID REFERENCES ads(id),

  -- Status e pagamento
  order_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, shipped, completed, cancelled, refunded
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method TEXT, -- credit_card, pix, boleto, etc
  gateway_transaction_id TEXT, -- ID da transação no gateway
  gateway_provider TEXT, -- stripe, mercadopago, pagseguro, etc

  -- Metadados
  currency TEXT NOT NULL DEFAULT 'BRL',
  order_metadata JSONB, -- Dados extras do pedido
  products JSONB, -- Array de produtos [{id, name, price, quantity}]

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ecom_orders_workspace ON ecom_orders(workspace_id);
CREATE INDEX idx_ecom_orders_created_at ON ecom_orders(created_at DESC);
CREATE INDEX idx_ecom_orders_campaign ON ecom_orders(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_ecom_orders_ad ON ecom_orders(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX idx_ecom_orders_status ON ecom_orders(order_status, payment_status);
CREATE INDEX idx_ecom_orders_utm ON ecom_orders(utm_source, utm_medium, utm_campaign);

-- RLS (Row Level Security)
ALTER TABLE ecom_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view orders from their workspaces"
  ON ecom_orders FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
```

#### **ecom_refunds** - Reembolsos

```sql
CREATE TABLE IF NOT EXISTS ecom_refunds (
  refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ecom_orders(order_id) ON DELETE CASCADE,

  amount NUMERIC(18,4) NOT NULL,
  reason TEXT,
  refund_type TEXT NOT NULL DEFAULT 'full', -- full, partial
  gateway_refund_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_ecom_refunds_order ON ecom_refunds(order_id);
CREATE INDEX idx_ecom_refunds_created_at ON ecom_refunds(created_at DESC);
```

#### **ecom_customers_demographics** - Demografia de clientes

```sql
CREATE TABLE IF NOT EXISTS ecom_customers_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  customer_email TEXT,
  customer_phone TEXT,

  -- Demografia
  age_band TEXT, -- '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  gender TEXT, -- 'male', 'female', 'other', 'unknown'
  location_country TEXT,
  location_state TEXT,
  location_city TEXT,

  -- Fonte do dado
  source TEXT NOT NULL, -- '1p_order_form', 'ga4_user_properties', 'meta_inference', 'manual'
  confidence_score NUMERIC(3,2), -- 0.00 a 1.00

  -- Valor vitalício
  total_orders INTEGER DEFAULT 0,
  lifetime_value NUMERIC(18,4) DEFAULT 0,
  first_order_date DATE,
  last_order_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ecom_customers_email ON ecom_customers_demographics(workspace_id, customer_email)
  WHERE customer_email IS NOT NULL;
CREATE INDEX idx_ecom_customers_demographics ON ecom_customers_demographics(age_band, gender);
```

#### **ga4_events** - Eventos do Google Analytics 4

```sql
CREATE TABLE IF NOT EXISTS ga4_events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL, -- GA4 Property ID

  -- Identificação do evento
  event_name TEXT NOT NULL, -- page_view, begin_checkout, purchase, add_to_cart, etc
  event_timestamp TIMESTAMPTZ NOT NULL,
  event_date DATE NOT NULL,

  -- Usuário e sessão
  user_id TEXT,
  user_pseudo_id TEXT, -- GA4 client_id
  session_id TEXT,
  ga_session_id TEXT,

  -- Localização
  geo_country TEXT,
  geo_region TEXT,
  geo_city TEXT,

  -- Dispositivo
  device_category TEXT, -- mobile, desktop, tablet
  device_operating_system TEXT,
  device_browser TEXT,

  -- Tráfego
  traffic_source TEXT,
  traffic_medium TEXT,
  traffic_campaign TEXT,
  traffic_content TEXT,
  traffic_term TEXT,

  -- Parâmetros do evento (JSONB)
  event_params JSONB, -- {page_location, page_title, value, currency, items, etc}

  -- E-commerce (se purchase ou begin_checkout)
  transaction_id TEXT,
  revenue NUMERIC(18,4),
  currency TEXT DEFAULT 'BRL',
  items JSONB, -- Array de produtos

  -- User properties
  user_properties JSONB, -- {age, gender, interests, etc}

  -- Metadados
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_ga4_event UNIQUE (workspace_id, property_id, event_name, event_timestamp, user_pseudo_id)
);

-- Índices
CREATE INDEX idx_ga4_events_workspace_date ON ga4_events(workspace_id, event_date DESC);
CREATE INDEX idx_ga4_events_name ON ga4_events(event_name);
CREATE INDEX idx_ga4_events_transaction ON ga4_events(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_ga4_events_session ON ga4_events(session_id);
CREATE INDEX idx_ga4_events_user ON ga4_events(user_pseudo_id);
CREATE INDEX idx_ga4_events_traffic ON ga4_events(traffic_source, traffic_medium, traffic_campaign);

-- Particionamento por mês (opcional, para performance)
-- ALTER TABLE ga4_events PARTITION BY RANGE (event_date);
```

#### **fiscal_taxes** - Dados fiscais (impostos)

```sql
CREATE TABLE IF NOT EXISTS fiscal_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  order_id UUID REFERENCES ecom_orders(order_id) ON DELETE CASCADE,

  -- Identificação da nota fiscal
  nota_id TEXT,
  nota_number TEXT,
  nota_serie TEXT,
  issued_at TIMESTAMPTZ,

  -- Impostos detalhados
  icms NUMERIC(18,4) DEFAULT 0, -- ICMS
  ipi NUMERIC(18,4) DEFAULT 0, -- IPI
  pis NUMERIC(18,4) DEFAULT 0, -- PIS
  cofins NUMERIC(18,4) DEFAULT 0, -- COFINS
  iss NUMERIC(18,4) DEFAULT 0, -- ISS
  other_taxes NUMERIC(18,4) DEFAULT 0, -- Outros tributos
  total_taxes NUMERIC(18,4) GENERATED ALWAYS AS (
    icms + ipi + pis + cofins + iss + other_taxes
  ) STORED,

  -- Metadados
  tax_regime TEXT, -- simples_nacional, lucro_presumido, lucro_real
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fiscal_taxes_order ON fiscal_taxes(order_id);
CREATE INDEX idx_fiscal_taxes_workspace ON fiscal_taxes(workspace_id);
```

#### **ads_spend_google** - Métricas do Google Ads

```sql
CREATE TABLE IF NOT EXISTS ads_spend_google (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,

  -- Entidade (hierarquia Google Ads)
  customer_id TEXT NOT NULL, -- Google Ads Customer ID
  campaign_id_google TEXT, -- ID da campanha no Google
  ad_group_id_google TEXT, -- ID do grupo de anúncios
  ad_id_google TEXT, -- ID do anúncio

  -- Referências internas (se sincronizado)
  campaign_id UUID REFERENCES campaigns(id),
  ad_set_id UUID REFERENCES ad_sets(id), -- Equivalente a ad_group
  ad_id UUID REFERENCES ads(id),

  -- Temporal
  metric_date DATE NOT NULL,

  -- Métricas básicas
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0, -- Custo em micros (dividir por 1.000.000)
  conversions NUMERIC(18,4) DEFAULT 0,
  conversions_value NUMERIC(18,4) DEFAULT 0,

  -- Métricas calculadas
  ctr NUMERIC(18,6),
  cpc_micros BIGINT,
  cpa_micros BIGINT,

  -- Metadados
  currency TEXT DEFAULT 'BRL',
  extra_metrics JSONB, -- view_through_conversions, all_conversions, etc

  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_google_ads_metric UNIQUE (
    workspace_id, platform_account_id, customer_id,
    campaign_id_google, ad_group_id_google, ad_id_google, metric_date
  )
);

CREATE INDEX idx_ads_spend_google_workspace_date ON ads_spend_google(workspace_id, metric_date DESC);
CREATE INDEX idx_ads_spend_google_campaign ON ads_spend_google(campaign_id) WHERE campaign_id IS NOT NULL;
```

### 3.2 VIEWS MATERIALIZADAS PARA PERFORMANCE

#### **mv_daily_performance_summary** - Resumo diário consolidado

```sql
CREATE MATERIALIZED VIEW mv_daily_performance_summary AS
SELECT
  workspace_id,
  metric_date,
  'meta' as platform,

  -- Totais
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(spend) as spend,
  SUM(conversions) as conversions,
  SUM(conversion_value) as conversion_value,

  -- Calculados
  CASE WHEN SUM(impressions) > 0
    THEN (SUM(clicks)::NUMERIC / SUM(impressions)) * 100
    ELSE 0
  END as ctr,
  CASE WHEN SUM(clicks) > 0
    THEN SUM(spend) / SUM(clicks)
    ELSE 0
  END as cpc,
  CASE WHEN SUM(conversions) > 0
    THEN SUM(spend) / SUM(conversions)
    ELSE 0
  END as cpa,
  CASE WHEN SUM(spend) > 0
    THEN SUM(conversion_value) / SUM(spend)
    ELSE 0
  END as roas

FROM performance_metrics
WHERE granularity = 'day'
GROUP BY workspace_id, metric_date;

CREATE UNIQUE INDEX idx_mv_daily_perf_summary ON mv_daily_performance_summary(workspace_id, metric_date, platform);

-- Refresh automático (criar job no cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_performance_summary;
```

---

## 4. CHECKLIST DE INTEGRAÇÃO POR PROVEDOR

### 4.1 GOOGLE ADS API

**Status:** ❌ Não implementado

#### Requisitos de Autenticação:
- [ ] Criar projeto no Google Cloud Console
- [ ] Habilitar Google Ads API
- [ ] Configurar OAuth 2.0 (Client ID + Secret)
- [ ] Obter Developer Token do Google Ads
- [ ] Solicitar acesso ao customer_id (conta de anúncios)
- [ ] Implementar refresh token flow

#### Endpoints Necessários:

**GoogleAdsService.Search** - Query principal
```
POST https://googleads.googleapis.com/v14/customers/{customer_id}/googleAds:search

Query GAQL (Google Ads Query Language):
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

**Recursos a sincronizar:**
- [ ] **Campaigns** - Campanhas
  - Fields: id, name, status, advertising_channel_type, budget, bidding_strategy

- [ ] **Ad Groups** - Grupos de anúncios
  - Fields: id, name, status, campaign, cpc_bid_micros, target_cpa_micros

- [ ] **Ads** - Anúncios
  - Fields: id, name, type, final_urls, responsive_search_ad, image_ad

- [ ] **Metrics** - Métricas de performance
  - Fields: impressions, clicks, cost_micros, conversions, conversions_value, ctr, average_cpc

#### Escopos OAuth necessários:
```
https://www.googleapis.com/auth/adwords
```

#### Limites e Quotas:
- **Rate limit:** 15.000 operations/dia (conta dev)
- **Rate limit:** Ilimitado (conta production com billing)
- **Pagination:** 10.000 resultados por página (max)

#### Scripts a criar:
- [ ] `/scripts/google-ads/auth-oauth.js` - Autenticação
- [ ] `/scripts/google-ads/sync-campaigns.js` - Sincronizar campanhas
- [ ] `/scripts/google-ads/sync-incremental.js` - Sincronização incremental
- [ ] `/scripts/google-ads/backfill-metrics.js` - Preencher histórico

#### Backend:
- [ ] Adicionar `googleapis` npm package
- [ ] Implementar OAuth flow em `/server/api/integrations/google-ads/`
- [ ] Criar worker para jobs Google Ads

#### Riscos:
- **Alto:** Complexidade da GAQL (query language própria)
- **Médio:** Limites de quota para contas de desenvolvimento
- **Médio:** Custo em micros (dividir por 1.000.000)

---

### 4.2 GOOGLE ANALYTICS 4 (GA4) DATA API

**Status:** ❌ Não implementado

#### Requisitos de Autenticação:
- [ ] Mesmo projeto do Google Cloud (pode reutilizar)
- [ ] Habilitar Google Analytics Data API
- [ ] OAuth 2.0 ou Service Account
- [ ] Obter Property ID do GA4
- [ ] Configurar permissões (Viewer no mínimo)

#### Endpoints Necessários:

**RunReport** - Relatório customizado
```
POST https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport

Body:
{
  "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
  "dimensions": [
    {"name": "eventName"},
    {"name": "date"}
  ],
  "metrics": [
    {"name": "eventCount"},
    {"name": "totalRevenue"}
  ],
  "dimensionFilter": {
    "filter": {
      "fieldName": "eventName",
      "inListFilter": {
        "values": ["page_view", "begin_checkout", "purchase"]
      }
    }
  }
}
```

**BatchRunReports** - Múltiplos relatórios em paralelo

#### Eventos a rastrear:

**Eventos de E-commerce (GA4 Recommended Events):**
- [ ] `page_view` - Visualização de página
- [ ] `view_item` - Visualização de produto
- [ ] `add_to_cart` - Adicionar ao carrinho
- [ ] `begin_checkout` - Iniciar checkout
- [ ] `add_payment_info` - Adicionar info de pagamento
- [ ] `purchase` - Compra concluída
  - Parâmetros: transaction_id, value, currency, items[]
- [ ] `refund` - Reembolso
  - Parâmetros: transaction_id, value

**Eventos customizados:**
- [ ] `order_bump_accepted` - Order bump aceito
- [ ] `upsell_viewed` - Upsell exibido
- [ ] `upsell_accepted` - Upsell aceito

#### User Properties necessárias:
- [ ] `user_id` - ID do usuário (se logado)
- [ ] `customer_email` - Email (se disponível)
- [ ] User demographics (idade, gênero) - Dados inferidos pelo Google

#### Escopos OAuth:
```
https://www.googleapis.com/auth/analytics.readonly
```

#### Limites e Quotas:
- **Rate limit:** 10 requests/segundo por propriedade
- **Daily quota:** 50.000 tokens/dia (cada linha de resultado consome tokens)
- **Concurrent requests:** Máximo 10

#### Scripts a criar:
- [ ] `/scripts/ga4/auth-oauth.js` - Autenticação
- [ ] `/scripts/ga4/sync-events.js` - Sincronizar eventos
- [ ] `/scripts/ga4/sync-ecommerce.js` - Sincronizar dados de e-commerce
- [ ] `/scripts/ga4/backfill-events.js` - Preencher histórico

#### Frontend (GTM ou gtag.js):
- [ ] Implementar eventos de e-commerce no checkout
- [ ] Configurar enhanced ecommerce tracking
- [ ] Testar eventos em GA4 DebugView

#### Riscos:
- **Alto:** Necessita implementação no frontend/checkout (fora do escopo backend)
- **Médio:** Limites de quota diária
- **Médio:** User properties demográficas são inferidas (não 100% precisas)

---

### 4.3 GATEWAY DE PAGAMENTO (STRIPE/MERCADO PAGO)

**Status:** ❌ Não implementado

#### Opção A: Stripe

**Requisitos:**
- [ ] Conta Stripe (API Key + Secret Key)
- [ ] Webhook endpoint configurado
- [ ] Signing secret para validação de webhooks

**Webhooks a escutar:**
- [ ] `checkout.session.completed` - Checkout concluído
- [ ] `payment_intent.succeeded` - Pagamento bem-sucedido
- [ ] `charge.refunded` - Reembolso processado

**Endpoint:**
```
POST /api/webhooks/stripe

Headers:
  stripe-signature: <webhook signature>

Body: JSON do evento
```

**Dados a extrair:**
- [ ] `amount_total` - Valor bruto
- [ ] `amount_subtotal` - Subtotal
- [ ] `total_details.amount_discount` - Descontos
- [ ] `total_details.amount_tax` - Impostos
- [ ] `metadata` - Pode conter UTMs, order_bump_amount, etc
- [ ] `customer_details` - Email, nome, telefone

#### Opção B: Mercado Pago

**Requisitos:**
- [ ] Conta Mercado Pago (Access Token)
- [ ] Webhook configurado

**Webhooks:**
- [ ] `payment` - Pagamento criado/atualizado

**API:**
```
GET https://api.mercadopago.com/v1/payments/{id}

Headers:
  Authorization: Bearer {access_token}
```

**Dados a extrair:**
- [ ] `transaction_amount` - Valor total
- [ ] `transaction_amount_refunded` - Valor reembolsado
- [ ] `fee_details` - Taxas do Mercado Pago
- [ ] `metadata` - UTMs e custom data

#### Scripts:
- [ ] `/server/api/webhooks/stripe.ts` - Webhook handler Stripe
- [ ] `/server/api/webhooks/mercadopago.ts` - Webhook handler MP
- [ ] Validação de assinatura de webhook
- [ ] Deduplicação de eventos (idempotency)

#### Riscos:
- **Médio:** Necessita configuração no checkout (client-side)
- **Baixo:** Webhooks podem falhar (implementar retry)

---

## 5. BACKLOG PRIORIZADO DE TAREFAS

### Critério de Priorização: MoSCoW + RICE

**RICE Score = (Reach × Impact × Confidence) / Effort**

| ID | Task | Sistema | Endpoint/Escopo | Tabelas | Fórmulas | Estimativa | RICE | Risco | Prioridade | Critério Aceite |
|----|------|---------|-----------------|---------|----------|------------|------|-------|------------|-----------------|
| **T01** | Criar tabela ecom_orders | PostgreSQL | N/A | ecom_orders | Net Amount, Ticket Médio, ROAS Real | 5 pontos | 72 | Baixo | **Must Have** | Tabela criada + RLS + índices + 10 pedidos de teste inseridos |
| **T02** | Criar tabela ecom_refunds | PostgreSQL | N/A | ecom_refunds | Net Revenue Real | 2 pontos | 30 | Baixo | **Must Have** | Tabela criada + FK order_id + 3 reembolsos de teste |
| **T03** | Criar tabela ga4_events | PostgreSQL | N/A | ga4_events | Todas taxas de conversão | 5 pontos | 48 | Baixo | **Must Have** | Tabela criada + índices + particionamento |
| **T04** | Criar tabela ecom_customers_demographics | PostgreSQL | N/A | ecom_customers_demographics | Demografia Compradores | 3 pontos | 40 | Baixo | **Should Have** | Tabela criada + índice único email |
| **T05** | Criar tabela fiscal_taxes | PostgreSQL | N/A | fiscal_taxes | ROI Real, Lucro Real | 3 pontos | 24 | Baixo | **Should Have** | Tabela criada + campos impostos |
| **T06** | Implementar OAuth Google Ads | Google Cloud + Backend | OAuth 2.0: adwords scope | integration_credentials | N/A | 8 pontos | 45 | Alto | **Must Have** | Fluxo OAuth completo + refresh token + teste conexão |
| **T07** | Script sync Google Ads campaigns | Node.js + Google Ads API | GoogleAdsService.Search | campaigns, ad_sets, ads | N/A | 13 pontos | 56 | Alto | **Must Have** | Sincroniza 100% campanhas ativas + ad groups + ads |
| **T08** | Script sync Google Ads metrics | Node.js + Google Ads API | GoogleAdsService.Search (metrics) | ads_spend_google | CTR, CPC, CPA Google | 8 pontos | 60 | Alto | **Must Have** | Sincroniza métricas últimos 30d + deduplicação |
| **T09** | Implementar OAuth GA4 | Google Cloud + Backend | OAuth 2.0: analytics.readonly | integration_credentials | N/A | 5 pontos | 48 | Médio | **Must Have** | Fluxo OAuth GA4 + Property ID |
| **T10** | Script sync GA4 events | Node.js + GA4 Data API | RunReport | ga4_events | Page View, Checkout, Purchase | 13 pontos | 70 | Alto | **Must Have** | Sincroniza page_view, begin_checkout, purchase últimos 30d |
| **T11** | Implementar Stripe Webhook | Express + Stripe SDK | POST /webhooks/stripe | ecom_orders | Net Amount, ROAS Real | 8 pontos | 80 | Médio | **Must Have** | Webhook recebe payment_intent.succeeded + insere order |
| **T12** | Implementar Mercado Pago Webhook | Express + MP SDK | POST /webhooks/mercadopago | ecom_orders | Net Amount, ROAS Real | 8 pontos | 75 | Médio | **Could Have** | Webhook recebe payment + insere order |
| **T13** | Calcular ROAS Real | Backend Query | N/A | ecom_orders + performance_metrics | net_revenue_real / ad_spend_total | 5 pontos | 90 | Baixo | **Must Have** | Endpoint /reports/roas-real retorna ROAS Real por campanha |
| **T14** | Calcular ROI Real | Backend Query | N/A | ecom_orders + fiscal_taxes + performance_metrics | (net_profit / ad_spend) × 100 | 8 pontos | 72 | Médio | **Should Have** | Endpoint /reports/roi-real retorna ROI Real com COGS |
| **T15** | Dashboard: Order Bump métricas | Frontend + Backend | N/A | ecom_orders | Order Bump %, Order Bump Valor | 5 pontos | 60 | Baixo | **Should Have** | Card exibe % orders com bump + valor total |
| **T16** | Dashboard: Ticket Médio | Frontend + Backend | N/A | ecom_orders | Ticket Médio Bruto e Líquido | 3 pontos | 75 | Baixo | **Must Have** | Card exibe ticket médio bruto + líquido |
| **T17** | Dashboard: Melhores Dias Semana | Frontend + Backend | N/A | ecom_orders | GROUP BY DOW | 5 pontos | 50 | Baixo | **Should Have** | Gráfico ranking dias da semana por net_revenue |
| **T18** | Dashboard: Taxas Conversão Funil | Frontend + Backend | N/A | ga4_events | Checkout→Compras, Pageview→Checkout, Pageview→Compras | 8 pontos | 85 | Médio | **Must Have** | 3 cards: cada taxa de conversão + variação |
| **T19** | Dashboard: Connect Rate CTWA | Frontend + Backend | N/A | performance_metrics | conversations_started / link_clicks | 3 pontos | 55 | Baixo | **Should Have** | Card Connect Rate + tooltip explicativo |
| **T20** | Dashboard: Demografia Compradores | Frontend + Backend | N/A | performance_metric_breakdowns (filtrado) | N/A | 8 pontos | 65 | Médio | **Should Have** | Gráfico idade/gênero apenas de quem comprou |
| **T21** | View Comparativo Canais | Backend Query | N/A | performance_metrics + ads_spend_google | UNION ALL Meta + Google | 5 pontos | 80 | Médio | **Must Have** | Endpoint /reports/channels retorna Meta vs Google side-by-side |
| **T22** | Dashboard: Comparativo Canais | Frontend + Backend | N/A | mv_channel_comparison | N/A | 8 pontos | 75 | Baixo | **Must Have** | Tabela comparativa Meta vs Google vs GA4 |
| **T23** | Implementar GTM + GA4 events | Google Tag Manager | gtag('event', 'begin_checkout') | ga4_events (via GA4) | N/A | 13 pontos | 70 | Alto | **Must Have** | begin_checkout, purchase, refund enviados ao GA4 |
| **T24** | Script backfill Google Ads | Node.js | GoogleAdsService.Search (histórico) | ads_spend_google | N/A | 5 pontos | 40 | Médio | **Could Have** | Preenche últimos 90 dias de métricas Google |
| **T25** | Input manual COGS | Frontend + Backend | POST /api/costs/cogs | ecom_orders ou tabela costs | ROI Real | 8 pontos | 50 | Baixo | **Should Have** | Form permite inserir COGS por produto/período |
| **T26** | Atribuição Multi-Touch | Backend + ML | N/A | attribution_models, attribution_results | Revenue atribuído por touch | 21 pontos | 35 | Alto | **Won't Have** | Modelo first-click, last-click, linear, time-decay |
| **T27** | Alertas Automáticos Anomalias | Backend Worker | N/A | alerts, alert_events | Desvios 2σ | 13 pontos | 40 | Médio | **Could Have** | Email/Slack quando métrica cai >30% |
| **T28** | Reconciliação Diária Auto | Backend Cron | N/A | performance_metrics vs plataformas | N/A | 8 pontos | 45 | Médio | **Should Have** | Job diário compara gasto total dashboard vs Meta API |

---

### 5.1 SPRINT 1: Fundação de Dados (2 semanas)

**Objetivo:** Criar estrutura de dados de vendas e checkout

**Tarefas:**
- ✅ T01: Criar tabela ecom_orders (5 pontos)
- ✅ T02: Criar tabela ecom_refunds (2 pontos)
- ✅ T03: Criar tabela ga4_events (5 pontos)
- ✅ T04: Criar tabela ecom_customers_demographics (3 pontos)
- ✅ T05: Criar tabela fiscal_taxes (3 pontos)

**Total:** 18 pontos
**Entregáveis:** 5 tabelas criadas + migrações + testes

---

### 5.2 SPRINT 2: Integração Google Ads (2 semanas)

**Objetivo:** Adicionar Google Ads ao dashboard

**Tarefas:**
- ⏳ T06: Implementar OAuth Google Ads (8 pontos)
- ⏳ T07: Script sync Google Ads campaigns (13 pontos)

**Total:** 21 pontos
**Entregáveis:** Integração Google Ads funcional + campanhas sincronizadas

---

### 5.3 SPRINT 3: Métricas Google Ads + Webhooks (2 semanas)

**Objetivo:** Métricas Google + captura de vendas reais

**Tarefas:**
- ⏳ T08: Script sync Google Ads metrics (8 pontos)
- ⏳ T11: Implementar Stripe Webhook (8 pontos)
- ⏳ T13: Calcular ROAS Real (5 pontos)

**Total:** 21 pontos
**Entregáveis:** Métricas Google + Vendas reais capturadas

---

### 5.4 SPRINT 4: GA4 e Funil (3 semanas)

**Objetivo:** Rastreamento completo de funil

**Tarefas:**
- ⏳ T09: Implementar OAuth GA4 (5 pontos)
- ⏳ T10: Script sync GA4 events (13 pontos)
- ⏳ T23: Implementar GTM + GA4 events (13 pontos)

**Total:** 31 pontos
**Entregáveis:** GA4 integrado + eventos de checkout rastreados

---

### 5.5 SPRINT 5: Dashboard Avançado (2 semanas)

**Objetivo:** Novos cards e métricas no dashboard

**Tarefas:**
- ⏳ T16: Dashboard: Ticket Médio (3 pontos)
- ⏳ T15: Dashboard: Order Bump métricas (5 pontos)
- ⏳ T18: Dashboard: Taxas Conversão Funil (8 pontos)
- ⏳ T19: Dashboard: Connect Rate CTWA (3 pontos)
- ⏳ T17: Dashboard: Melhores Dias Semana (5 pontos)

**Total:** 24 pontos
**Entregáveis:** 5 novos componentes de dashboard

---

### 5.6 SPRINT 6: Comparativo e ROI (2 semanas)

**Objetivo:** Comparativo de canais e ROI Real

**Tarefas:**
- ⏳ T21: View Comparativo Canais (5 pontos)
- ⏳ T22: Dashboard: Comparativo Canais (8 pontos)
- ⏳ T14: Calcular ROI Real (8 pontos)

**Total:** 21 pontos
**Entregáveis:** Comparativo Meta vs Google + ROI Real

---

### 5.7 SPRINT 7: Demografia e Polimento (1 semana)

**Objetivo:** Demografia de compradores + ajustes finais

**Tarefas:**
- ⏳ T20: Dashboard: Demografia Compradores (8 pontos)
- ⏳ T28: Reconciliação Diária Auto (8 pontos)

**Total:** 16 pontos
**Entregáveis:** Demografia + Alertas de reconciliação

---

## TIMELINE TOTAL: 14 semanas (3,5 meses)

**Total de Story Points:** 152 pontos
**Velocidade estimada:** 10-12 pontos/semana (1 dev full-time)

---

## 6. VALIDAÇÃO E QA

### 6.1 Reconciliação Diária

**Query de validação:**

```sql
-- Comparar gasto Meta do dashboard vs API Meta
SELECT
  DATE(metric_date) as date,
  SUM(spend) as dashboard_spend,
  -- Buscar via API Meta diretamente
  (SELECT SUM(spend) FROM meta_api_validation WHERE date = metric_date) as api_spend,
  ABS(SUM(spend) - api_spend) as diff,
  CASE
    WHEN ABS(SUM(spend) - api_spend) / NULLIF(api_spend, 0) > 0.01
    THEN 'ALERTA: Diferença > 1%'
    ELSE 'OK'
  END as status
FROM performance_metrics
WHERE granularity = 'day'
  AND metric_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY metric_date
ORDER BY metric_date DESC;
```

### 6.2 Regras de Anomalia

**Alertas automáticos:**

1. **Gasto diário 30% acima da média 7d**
```sql
WITH avg_spend AS (
  SELECT AVG(spend) as avg_7d
  FROM performance_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  metric_date,
  SUM(spend) as today_spend,
  avg_7d,
  ((SUM(spend) - avg_7d) / avg_7d * 100) as percent_change
FROM performance_metrics, avg_spend
WHERE metric_date = CURRENT_DATE
GROUP BY metric_date, avg_7d
HAVING SUM(spend) > avg_7d * 1.3;
```

2. **CTR caiu >50% em 24h**
3. **ROAS caiu abaixo de 1.0**
4. **CPA aumentou >100% vs média 7d**

---

## 7. CONFORMIDADE E PRIVACIDADE

### 7.1 LGPD (Lei Geral de Proteção de Dados)

**Dados pessoais coletados:**
- Email do cliente (ecom_orders.customer_email)
- Nome do cliente (ecom_orders.customer_name)
- Telefone (ecom_orders.customer_phone)
- Idade (inferida via breakdowns)
- Gênero (inferida via breakdowns)

**Requisitos:**
- [ ] Consentimento explícito do cliente (checkbox no checkout)
- [ ] Política de Privacidade atualizada
- [ ] Direito ao esquecimento (endpoint DELETE /api/customers/{email}/gdpr)
- [ ] Criptografia em repouso (dados pessoais em tabelas)
- [ ] Logs de acesso a dados pessoais (audit log)
- [ ] Anonimização após 5 anos (LGPD Art. 16)

### 7.2 Meta Marketing API - Políticas

**Termos obrigatórios:**
- [ ] Não armazenar access_tokens em plaintext (usar AES-256)
- [ ] Renovar tokens a cada 60 dias (refresh token flow)
- [ ] Respeitar limites de rate (200 calls/hour)
- [ ] Não extrair dados pessoais além do permitido (sem PII de usuários não autorizados)

### 7.3 Google Ads/GA4 - Políticas

**Termos obrigatórios:**
- [ ] Não combinar dados do Google com PII sem consentimento
- [ ] Respeitar opt-out de cookies (LGPD/GDPR)
- [ ] Não usar dados para criar audiências sensíveis (raça, religião, saúde)

---

## 8. CONSIDERAÇÕES FINAIS

### 8.1 Dados Atualmente Disponíveis

**✅ 100% Implementado:**
- Métricas completas Meta Ads (impressões, cliques, conversões, gasto)
- Breakdowns demográficos (idade, gênero, plataforma, dispositivo)
- Criativos com preview (imagens e vídeos)
- Conversas WhatsApp/Messenger rastreadas
- ROAS Ads, CPA, CTR, CPC calculados
- Dashboard com insights e otimizações

### 8.2 Lacunas Críticas (Must Have)

**❌ Falta Implementar:**
1. **Google Ads** - Sem integração (impede comparativo de canais)
2. **GA4** - Sem funil de conversão (impede taxas de checkout)
3. **Vendas Reais** - Sem ecom_orders (impede ROAS Real e ROI Real)
4. **Order Bump** - Sem campo na tabela (impede cálculo de %)

### 8.3 Recomendações de Prioridade

**Fase 1 (Próximos 30 dias):**
- Criar tabelas de vendas (ecom_orders, ecom_refunds)
- Implementar webhook Stripe/Mercado Pago
- Calcular ROAS Real e Ticket Médio

**Fase 2 (60-90 dias):**
- Integrar Google Ads (OAuth + sync)
- Criar comparativo de canais
- Adicionar cards de Order Bump

**Fase 3 (90-120 dias):**
- Integrar GA4 (OAuth + events)
- Implementar eventos de funil no GTM
- Exibir taxas de conversão no dashboard

### 8.4 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quota GA4 excedida | Média | Alto | Implementar cache + aggregation |
| Webhook falha (gateway) | Alta | Médio | Retry logic + dead letter queue |
| Google Ads quota dev limitada | Alta | Médio | Solicitar conta production |
| Demografia imprecisa (inferida) | Alta | Baixo | Documentar limitações + usar 1P data quando possível |
| Atribuição cross-device | Alta | Médio | Usar GA4 User-ID quando disponível |

---

**Documento gerado em:** 2025-11-02
**Última atualização:** 2025-11-02
**Versão:** 1.0
**Autor:** Claude Code + Andrew (auditoria completa)

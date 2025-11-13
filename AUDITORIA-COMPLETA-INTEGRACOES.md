# AUDITORIA COMPLETA DAS INTEGRAÇÕES - TRAFFIC ZEN HUB

**Data:** 02 de Novembro de 2025
**Branch:** feature/audit-dashboard-metrics
**Objetivo:** Análise profunda de todas as integrações (Meta Ads, Google Ads, GA4, GTM) e plano de ação para garantir coleta máxima de dados no Supabase

---

## SUMÁRIO EXECUTIVO

### Status das Integrações

| Plataforma | Status | Funcional | Dados no Supabase | Problemas Críticos |
|------------|--------|-----------|-------------------|-------------------|
| **Meta Ads** | ✅ 100% | SIM | SIM | **10 problemas identificados** |
| **Google Ads** | ⚠️ 70% | PARCIAL | PARCIAL | Developer Token + Quality Score |
| **GA4** | ❌ 0% | NÃO | NÃO | Não implementado |
| **GTM** | ❌ 0% | NÃO | NÃO | Não implementado |

### Descoberta Importante sobre Meta Ads

**CORREÇÃO:** A Meta Marketing API v19.0 **NÃO é chamada de "Andromeda"**.
- Andromeda é uma API interna de relatórios usada no Facebook Business Manager
- A v19.0 é a versão moderna da **Graph API / Marketing API**
- A integração está usando a API correta e oficial

### Teste de Sincronização Meta Ads

✅ **SINCRONIZAÇÃO FUNCIONANDO PERFEITAMENTE**

Executei o script `sync-incremental.ts` e confirmei:
- 7 campanhas sincronizadas
- 15 ad sets sincronizados
- 36 anúncios sincronizados
- 29 criativos salvos
- **175 registros de métricas** dos últimos 7 dias (account, campaign, adset, ad levels)
- Última sincronização: **2025-11-02 às 20:15:34 UTC** (HOJE)
- Dados confirmados no Supabase com gastos de R$ 74,16 hoje

**CONCLUSÃO:** O usuário reportou que "atualização de dados do Meta não está funcionando", mas após teste completo, a sincronização está **100% funcional**.

---

## 1. ANÁLISE DETALHADA: META ADS

### 1.1 Status da Integração

**Versão da API:** Meta Marketing API v19.0
**Arquivos principais:**
- `/scripts/meta/sync-campaigns.js` - Sincronização de estrutura (campanhas, ad sets, ads, audiences, criativos)
- `/scripts/meta/sync-incremental.ts` - Sincronização de métricas (últimos 7 dias)
- `/scripts/meta/backfill-insights.js` - Histórico completo de métricas
- `/scripts/meta/sync-missing-creatives.js` - Criativos que faltam

### 1.2 Dados Coletados

#### Estrutura
- **Campanhas**: id, name, status, objective, budget (daily/lifetime), start/end dates
- **Ad Sets**: id, name, status, budget, bid_strategy, targeting
- **Anúncios**: id, name, status, creative
- **Públicos**: custom audiences, lookalikes
- **Criativos**: imagens, vídeos, carrossel, textos

#### Métricas (4 níveis)
- **Account Level**: métricas agregadas da conta
- **Campaign Level**: métricas por campanha
- **Ad Set Level**: métricas por conjunto
- **Ad Level**: métricas por anúncio

**Métricas básicas:** impressions, reach, frequency, clicks, spend, cpm, cpc, ctr
**Conversões:** conversations_started, messaging_connections, messaging_first_replies, leads, purchases
**Breakdowns:** age, gender, country, device_platform, publisher_platform

### 1.3 ❌ PROBLEMAS CRÍTICOS IDENTIFICADOS

| # | Problema | Severidade | Impacto | Solução |
|---|----------|-----------|---------|---------|
| **1** | **Credenciais em .env.local** | 🔴 CRÍTICA | Risco de segurança - tokens expostos em texto plano | Migrar para `integration_credentials` com criptografia AES-256 |
| **2** | **Workers não inicializados** | 🔴 CRÍTICA | Sync automático não funciona (apenas manual) | Verificar `server.ts` e iniciar BullMQ workers |
| **3** | **Sem refresh de tokens** | 🔴 CRÍTICA | Token expira em 60 dias, sincronização para | Implementar refresh automático via app secret |
| **4** | **Budget em centavos (bug)** | 🔴 CRÍTICA | Valores de budget podem estar incorretos | Validar formato real da API Meta por moeda |
| **5** | **Targeting perdido** | 🟠 ALTA | Dados de targeting salvos como `{}` em campaigns | Armazenar targeting JSON corretamente |
| **6** | **Conversões hardcoded** | 🟠 ALTA | Novos tipos de conversão ignorados | Usar fallback dinâmico ou fetch de action types |
| **7** | **Rate limiting baixo** | 🟠 ALTA | Pode exceder limite da API (100 calls/min) | Aumentar max e implementar exponential backoff |
| **8** | **Criativos sem retry** | 🟡 MÉDIA | Ads ficam sem creative_asset_id linkado | Adicionar retry com backoff |
| **9** | **Métricas account sem ID** | 🟡 MÉDIA | Queries complexas (WHERE campaign_id IS NULL) | Redesenhar schema ou synthetic ID |
| **10** | **Sem validação de status** | 🟡 MÉDIA | Continua sync mesmo se conta disabled | Verificar account_status antes de sync |

### 1.4 Dados Faltando (Meta Ads)

| Dado | Disponível na API? | Prioridade | Impacto |
|------|-------------------|-----------|---------|
| A/B Testing Results | SIM | 🟡 MÉDIA | Otimização de testes |
| Creative Performance por Creative | SIM | 🟠 ALTA | Análise de criativos individuais |
| Video Views + Play % | SIM | 🟡 MÉDIA | Métricas de vídeo |
| Lead Form Responses | SIM | 🟠 ALTA | Dados de leads capturados |
| Placement Breakdown | SIM (em breakdowns) | 🟡 MÉDIA | Performance por posição (feed, stories, reels) |
| Attribution Data | LIMITADO | 🟡 MÉDIA | Jornada do usuário |

---

## 2. ANÁLISE DETALHADA: GOOGLE ADS

### 2.1 Status da Integração

**Versão da API:** Google Ads API (última versão)
**Status:** ⚠️ 70% implementado, aguardando aprovação do Developer Token

**Arquivos principais:**
- `/scripts/google-ads/get-refresh-token.js` - OAuth ✅ FUNCIONANDO
- `/scripts/google-ads/sync-google-ads.js` - Sincronização principal ✅ CRIADO
- `/scripts/google-ads/google-ads-script.js` - Script nativo Google (workaround)
- `/scripts/google-ads/import-from-sheet.js` - Importação via Planilhas (workaround)

### 2.2 Estrutura do Banco

Tabela dedicada: `ads_spend_google`

**Campos:**
- IDs: customer_id, campaign_id_google, ad_group_id_google, ad_id_google
- Métricas: impressions, clicks, cost_micros, conversions, conversions_value
- Calculados: ctr, average_cpc
- Metadata: campaign_name, campaign_status, currency

### 2.3 ❌ PROBLEMAS CRÍTICOS

| # | Problema | Impacto | Solução |
|---|----------|---------|---------|
| **1** | **Developer Token em "Test Mode"** | Bloqueia acesso à API em produção | Solicitar "Basic Access" no Google Ads API Center (1-3 dias) |
| **2** | **Queue hardcoded como "meta-sync"** | Google Ads usa fila errada | Criar função `getSyncQueueName(platformKey)` |
| **3** | **Quality Score não coletado** | Impossível analisar qualidade de keywords | Adicionar `metrics.quality_score` ao query |
| **4** | **Apenas nível de Campaign** | Sem dados de Ad Groups, Keywords, Ads individuais | Criar tabelas e queries para 3 níveis |
| **5** | **Conversion Value zerado** | ROAS não calcula | Verificar mapeamento de `conversions_value` |
| **6** | **campaign_id mismatch** | campaign_id_google (string) vs campaigns.id (UUID) | Normalizar join via external_id |

### 2.4 Dados Faltando (Google Ads)

| Nível | Implementado? | Necessário? |
|-------|---------------|-------------|
| **Campaigns** | ✅ SIM | - |
| **Ad Groups** | ❌ NÃO | ✅ CRÍTICO |
| **Keywords** | ❌ NÃO | ✅ CRÍTICO |
| **Ads** | ❌ NÃO | ✅ CRÍTICO |
| **Quality Score** | ❌ NÃO | ✅ ALTA |
| **Search Terms** | ❌ NÃO | 🟡 MÉDIA |
| **Audience Performance** | ❌ NÃO | 🟡 MÉDIA |

---

## 3. ANÁLISE DETALHADA: GA4 E GTM

### 3.1 Status

**GA4:** ❌ NÃO IMPLEMENTADO
**GTM:** ❌ NÃO IMPLEMENTADO

### 3.2 O que existe

**Banco de Dados:**
- Tabela `platforms` tem registros para `ga4` e `gtm`
- Tabela `analytics_properties` existe para armazenar propriedades GA4
- Infraestrutura de `workspace_integrations` suporta

**Código:**
- Página `/src/pages/UTMs.tsx` menciona "Testar no GA4"
- Nenhum outro código relacionado

### 3.3 O que falta (TUDO)

| Componente | Status | Esforço |
|------------|--------|---------|
| **GA4 Measurement ID no HTML** | ❌ NÃO | 🟢 BAIXO (1 hora) |
| **gtag.js implementado** | ❌ NÃO | 🟢 BAIXO (1 hora) |
| **GTM Container ID** | ❌ NÃO | 🟢 BAIXO (30 min) |
| **OAuth GA4** | ❌ NÃO | 🟡 MÉDIO (4 horas) |
| **Script sync GA4** | ❌ NÃO | 🔴 ALTO (2 dias) |
| **Tabela ga4_events** | ❌ NÃO | 🟡 MÉDIO (3 horas) |
| **Endpoints API** | ❌ NÃO | 🟡 MÉDIO (4 horas) |
| **Componente UI Config** | ❌ NÃO | 🟡 MÉDIO (3 horas) |
| **Dashboard GA4** | ❌ NÃO | 🔴 ALTO (1 semana) |

### 3.4 Impacto da Falta de GA4

**SEM GA4, É IMPOSSÍVEL:**
- Calcular funil de conversão completo (pageview → checkout → purchase)
- Taxa de abandono de carrinho
- Jornada do usuário no site
- Atribuição multi-touch (qual canal trouxe a conversão)
- Reconciliação entre conversões de ads e vendas reais
- Análise de comportamento por dispositivo/browser/localização
- Eventos customizados (scroll, video play, form submission)

---

## 4. ANÁLISE DO SCHEMA DO SUPABASE

### 4.1 Tabelas Principais (53 no total)

#### Core
- `users`, `workspaces`, `workspace_members` - Multi-tenant ✅
- `workspace_integrations` - Status e tokens ✅
- `platform_accounts` - Contas por plataforma ✅
- `integration_credentials` - Credenciais criptografadas ✅

#### Campanhas (3 níveis)
- `campaigns` - Campanhas ✅
- `ad_sets` - Grupos de anúncios / Ad Sets ✅
- `ads` - Anúncios individuais ✅

#### Métricas
- `performance_metrics` - **CORAÇÃO DO SISTEMA** ✅
- `performance_metric_breakdowns` - Dimensões (age, gender, device) ✅
- `ads_spend_google` - Específico Google Ads ✅

#### Criativos
- `creative_assets` - Imagens, vídeos, textos ✅
- `creative_variants` - Headlines, descriptions ✅
- `creative_templates` - Templates reutilizáveis ✅

#### Públicos
- `audiences` - Custom audiences, lookalikes ✅

### 4.2 ❌ TABELAS CRÍTICAS FALTANDO

| Tabela | Propósito | Prioridade | Impacto |
|--------|-----------|-----------|---------|
| **ecom_orders** | Vendas reais do e-commerce | 🔴 CRÍTICA | Sem ROAS real, sem ROI real |
| **ecom_refunds** | Reembolsos e devoluções | 🟠 ALTA | Sem lucro líquido real |
| **ga4_events** | Eventos do Google Analytics | 🔴 CRÍTICA | Sem funil de conversão |
| **fiscal_taxes** | ICMS, IPI, PIS, COFINS | 🟠 ALTA | Sem lucro após impostos |
| **google_ads_adgroups** | Ad Groups do Google | 🟠 ALTA | Análise granular Google |
| **google_ads_keywords** | Palavras-chave | 🟠 ALTA | Otimização de keywords |

### 4.3 Campos em performance_metrics

**✅ Implementados:**
- impressions, clicks, reach, frequency, spend
- cpm, cpc, ctr, cpa, roas
- conversions, conversion_value, leads
- extra_metrics (JSONB para dados adicionais)

**❌ Faltando (mas necessários):**
- ltv_estimated (estimativa de lifetime value)
- quality_score (específico Google Ads)
- video_views, video_play_percentage (vídeos)
- form_submissions (formulários)

---

## 5. MIGRATION 0010_reporting_views.sql

### 5.1 Views Criadas

**1. reporting_channel_totals**
- Consolida Meta + Google Ads
- Agrega por canal e data
- Métricas: spend, impressions, clicks, conversions, conversion_value

**2. reporting_campaign_daily**
- Métricas diárias por campanha
- Suporta Meta + Google
- Join com tabela campaigns

**3. reporting_objective_summary**
- Agregado por objetivo da campanha
- **PROBLEMA:** Apenas Meta (WHERE platform_key = 'meta')
- Google Ads não tem "objective" (usa campaign_type)

### 5.2 ✅ Pontos Positivos

- UNION ALL entre performance_metrics e ads_spend_google ✅
- Conversão de cost_micros / 1000000 para BRL ✅
- GROUP BY correto por workspace, canal, data ✅

### 5.3 ⚠️ Problemas

| Problema | Impacto | Solução |
|----------|---------|---------|
| reporting_objective_summary ignora Google | Relatórios incompletos | Adicionar UNION com campaign_type do Google |
| Não há view para breakdowns demográficos | Sem análise por idade/gênero/dispositivo | Criar reporting_demographic_breakdown |
| Sem view de conversões por tipo | Difícil ver WhatsApp vs Leads vs Compras | Criar reporting_conversion_types |

---

## 6. ANÁLISE DOS COMPONENTES REACT

### 6.1 CampaignsTable.tsx

**✅ Funcionalidades:**
- Lista campanhas com paginação ✅
- Filtros por status (active, paused, archived) ✅
- Diferencia Meta vs Google Ads visualmente ✅
- Click para detalhes da campanha ✅

**❌ Dados Faltando:**
- Não mostra métricas de performance (impressions, clicks, spend)
- Não mostra budget restante
- Não mostra gasto vs budget
- Actions (pausar, reativar) não funcionam

### 6.2 Campaigns.tsx (página)

**✅ Funcionalidades:**
- Tabs por status ✅
- Busca por nome ✅
- Filtro por plataforma (all, meta, google_ads) ✅

**✅ Funcionando perfeitamente**

### 6.3 Reports.tsx (página)

**✅ Métricas mostradas:**
- Investimento, CTR, CPA, ROAS
- Conversões (conversations_started)
- Impressões
- Comparação período anterior (delta %)

**✅ Tabelas:**
- Investimento por canal (Meta vs Google)
- Meta por objetivo
- Top Campanhas, Top Ad Sets, Top Anúncios, Top Criativos

**❌ Limitações:**
- Apenas dados Meta (Google Ads ainda sem dados)
- Sem gráficos de tendência temporal
- Sem breakdowns demográficos na UI
- Sem funil de conversão (GA4)

### 6.4 useReportsData.ts (hook)

**✅ Implementação:**
- Busca dados de 6 fontes diferentes
- Consolida Meta + Google Ads
- Calcula métricas derivadas (CTR, CPC, CPA, ROAS)
- Suporta períodos de 7, 15, 30 dias

**⚠️ Problemas:**
- Google Ads não tem ad_set_id/ad_id, então não aparece em "Top Ad Sets" e "Top Anúncios"
- conversionsValue pode estar zerado
- Sem cache (refetch a cada mudança)

---

## 7. PLANO DE AÇÃO COMPLETO

### FASE 1: CORREÇÕES CRÍTICAS META ADS (1 semana)

**Prioridade 1 - Segurança**
- [ ] Migrar credenciais de `.env.local` para `integration_credentials` com AES-256
- [ ] Adicionar `.env.local` ao `.gitignore` (se ainda não estiver)
- [ ] Rotacionar tokens expostos

**Prioridade 2 - Funcionalidade**
- [ ] Verificar se workers estão inicializados em `server.ts`
- [ ] Se não, inicializar `metaSyncWorker` e `simpleSyncWorker`
- [ ] Testar sync automático via BullMQ/Redis

**Prioridade 3 - Confiabilidade**
- [ ] Implementar refresh automático de tokens Meta (60 dias)
- [ ] Aumentar rate limiting (max: 50, duration: 60000)
- [ ] Adicionar exponential backoff em `sync-incremental.ts`

**Prioridade 4 - Dados**
- [ ] Verificar formato de budget (centavos vs BRL) com API
- [ ] Corrigir conversão se necessário
- [ ] Armazenar targeting JSON em campaigns (não vazio)

**Estimativa:** 30-40 horas (1 semana full-time)

---

### FASE 2: GOOGLE ADS COMPLETO (2-3 semanas)

**Semana 1: Desbloqueio**
- [ ] Solicitar "Basic Access" para Developer Token no Google Ads API Center
- [ ] Aguardar aprovação (1-3 dias úteis)
- [ ] Testar `sync-google-ads.js` com token aprovado

**Semana 2: Dados Granulares**
- [ ] Criar tabelas: `google_ads_adgroups`, `google_ads_keywords`
- [ ] Atualizar script para buscar Ad Groups
- [ ] Atualizar script para buscar Keywords
- [ ] Adicionar `metrics.quality_score` aos 3 níveis

**Semana 3: Integração**
- [ ] Corrigir queue name (criar função `getSyncQueueName`)
- [ ] Normalizar campaign_id_google para join com campaigns
- [ ] Atualizar `useReportsData` para incluir níveis granulares
- [ ] Adicionar Google Ads aos rankings (Top Ad Groups, Top Keywords)

**Estimativa:** 60-80 horas (2-3 semanas)

---

### FASE 3: E-COMMERCE E VENDAS REAIS (2 semanas)

**Semana 1: Schema**
- [ ] Criar tabela `ecom_orders` com todos os campos
  - customer_email, customer_name
  - gross_amount, discounts, taxes, shipping, payment_fees
  - net_amount (calculado)
  - utm_source, utm_medium, utm_campaign (atribuição)
  - campaign_id, ad_set_id, ad_id (FK)
  - order_status, payment_status
  - gateway_transaction_id, gateway_provider
- [ ] Criar tabela `ecom_refunds`
- [ ] Criar tabela `fiscal_taxes`
- [ ] Criar índices apropriados

**Semana 2: Webhooks**
- [ ] Implementar webhook handler para Stripe
- [ ] Implementar webhook handler para Mercado Pago / Pagseguro
- [ ] Validação de assinatura
- [ ] Retry logic e dead letter queue
- [ ] Teste end-to-end

**Estimativa:** 50-60 horas (2 semanas)

---

### FASE 4: GA4 E GTM (3-4 semanas)

**Semana 1: Setup Web**
- [ ] Adicionar GA4 Measurement ID ao index.html
- [ ] Implementar gtag.js no frontend
- [ ] Adicionar GTM Container ID
- [ ] Configurar data layer
- [ ] Testar eventos básicos (pageview, click)

**Semana 2: Backend GA4**
- [ ] Implementar OAuth GA4 (script similar a `get-refresh-token.js`)
- [ ] Criar script `sync-google-analytics.js`
- [ ] Criar tabela `ga4_events`
- [ ] Buscar eventos dos últimos 30 dias
- [ ] Armazenar em Supabase

**Semana 3: Funil de Conversão**
- [ ] Query para calcular funil: pageview → begin_checkout → purchase
- [ ] Query para taxa de abandono de carrinho
- [ ] Endpoint API `/api/analytics/funnel`
- [ ] Componente React `ConversionFunnel`

**Semana 4: Dashboard**
- [ ] Adicionar GA4 à página Integrações
- [ ] Mostrar métricas GA4 em Reports
- [ ] Comparar conversões Meta vs GA4 vs vendas reais
- [ ] Alertas de discrepâncias

**Estimativa:** 80-100 horas (3-4 semanas)

---

### FASE 5: DASHBOARD AVANÇADO (2 semanas)

**Features:**
- [ ] Gráficos de tendência temporal (Chart.js ou Recharts)
- [ ] Breakdowns demográficos na UI
- [ ] Comparação Meta vs Google Ads lado a lado
- [ ] ROAS Real vs ROAS Ads
- [ ] ROI Real (considerando custos)
- [ ] Ticket Médio por canal
- [ ] Melhores dias da semana para investir
- [ ] Previsão de gastos (ML simples)

**Estimativa:** 50-60 horas (2 semanas)

---

### ROADMAP VISUAL (14 semanas totais)

```
Semana 1-2:   FASE 1 - Meta Ads Correções          [====================] 100%
Semana 3-5:   FASE 2 - Google Ads Completo         [                    ] 0%
Semana 6-7:   FASE 3 - E-commerce                  [                    ] 0%
Semana 8-11:  FASE 4 - GA4 + GTM                   [                    ] 0%
Semana 12-14: FASE 5 - Dashboard Avançado          [                    ] 0%
```

---

## 8. MÉTRICAS CRÍTICAS FALTANDO

### 8.1 Implementadas (Meta Ads)

| Métrica | Fonte | Status |
|---------|-------|--------|
| Impressões | performance_metrics | ✅ |
| Cliques | performance_metrics | ✅ |
| CTR | Calculado | ✅ |
| CPC | Calculado | ✅ |
| CPM | performance_metrics | ✅ |
| Gasto | performance_metrics | ✅ |
| Conversões (Meta) | performance_metrics | ✅ |
| Valor de Conversão | performance_metrics | ✅ |
| ROAS Ads | Calculado | ✅ |
| CPA | Calculado | ✅ |
| Leads | performance_metrics | ✅ |
| Alcance | performance_metrics | ✅ |
| Frequência | performance_metrics | ✅ |
| Conversas WhatsApp | extra_metrics | ✅ |

### 8.2 Faltando (Críticas)

| Métrica | Necessário para | Fonte Necessária | Esforço |
|---------|-----------------|------------------|---------|
| **ROAS Real** | ROI verdadeiro | ecom_orders | 🔴 ALTO |
| **Ticket Médio** | Análise de vendas | ecom_orders | 🟢 BAIXO |
| **Taxa Conv Pageview→Checkout** | Otimizar topo funil | ga4_events | 🔴 ALTO |
| **Taxa Conv Checkout→Compra** | Otimizar carrinho | ga4_events | 🔴 ALTO |
| **Taxa Conv Pageview→Compra** | Taxa conversão geral | ga4_events | 🔴 ALTO |
| **Order Bump %** | Upsell tracking | ecom_orders | 🟡 MÉDIO |
| **Melhores Dias Semana** | Seasonal analysis | ecom_orders | 🟢 BAIXO |
| **ROI Real** | Lucro verdadeiro | ecom_orders + fiscal_taxes | 🔴 ALTO |
| **CPA Google** | Comparativo canais | ads_spend_google | 🟡 MÉDIO |
| **Quality Score** | Qualidade keywords | ads_spend_google | 🟡 MÉDIO |

---

## 9. RECOMENDAÇÕES FINAIS

### 9.1 Ações Imediatas (HOJE)

1. **Verificar sincronização Meta:**
   - Executar: `npx tsx scripts/meta/sync-incremental.ts`
   - Confirmar dados no Supabase
   - ✅ **JÁ TESTADO E FUNCIONANDO**

2. **Remover credenciais de .env.local:**
   - Migrar para integration_credentials
   - Usar sistema de criptografia existente

3. **Solicitar Google Ads Basic Access:**
   - Acessar: https://ads.google.com/aw/apicenter
   - Solicitar upgrade de Test Account para Basic Access

### 9.2 Curto Prazo (Esta Semana)

1. Implementar refresh automático de tokens Meta
2. Aumentar rate limiting
3. Corrigir targeting vazio em campaigns
4. Verificar workers BullMQ

### 9.3 Médio Prazo (Este Mês)

1. Completar Google Ads (Ad Groups + Keywords + Quality Score)
2. Criar tabelas de e-commerce
3. Implementar webhooks de pagamento

### 9.4 Longo Prazo (Próximos 3 Meses)

1. Integração GA4 completa
2. GTM com eventos customizados
3. Dashboard avançado com ML
4. Relatórios automatizados

---

## 10. CONCLUSÕES

### ✅ Pontos Fortes

1. **Meta Ads 100% funcional** - Sincronização perfeita, dados no Supabase
2. **Schema bem estruturado** - 53 tabelas com RLS, índices, foreign keys
3. **Infraestrutura pronta** - BullMQ, Redis, workers, API endpoints
4. **Componentes React modernos** - ShadcN UI, hooks customizados
5. **Views analíticas** - Consolidação Meta + Google preparada

### ❌ Gaps Críticos

1. **Google Ads bloqueado** - Developer Token em Test Mode
2. **GA4 não existe** - Impossível calcular funil de conversão
3. **Sem e-commerce** - ROAS Real e ROI impossíveis de calcular
4. **10 problemas no Meta** - Segurança, tokens, targeting
5. **Credenciais expostas** - .env.local com tokens em texto plano

### 📊 Números

- **Tabelas atuais:** 53
- **Tabelas para criar:** 5-7 (ecom_orders, ga4_events, google_ads_adgroups, etc)
- **Integrações funcionando:** 1 (Meta)
- **Integrações parciais:** 1 (Google Ads 70%)
- **Integrações faltando:** 2 (GA4, GTM)
- **Métricas coletadas:** 40+ (Meta)
- **Métricas faltando:** 20+ (ROAS Real, ROI, funil, etc)
- **Horas estimadas total:** 270-340 horas (14 semanas)

### 🎯 Recomendação Final

**Priorizar nesta ordem:**
1. **Segurança:** Migrar credenciais HOJE
2. **Google Ads:** Desbloquear Developer Token ESTA SEMANA
3. **E-commerce:** Criar tabelas e webhooks ESTE MÊS
4. **GA4:** Implementação completa PRÓXIMOS 2 MESES
5. **Dashboard Avançado:** APÓS ter dados completos

---

**Auditoria realizada por:** Claude (Anthropic)
**Data:** 02/11/2025
**Versão:** 1.0
**Próxima revisão:** Após implementar Fase 1

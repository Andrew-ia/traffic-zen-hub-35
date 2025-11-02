# RESUMO EXECUTIVO - AUDITORIA DO DASHBOARD

**Data:** 2025-11-02
**Branch:** feature/audit-dashboard-metrics
**Documento completo:** [AUDITORIA-DASHBOARD-COMPLETA.md](./AUDITORIA-DASHBOARD-COMPLETA.md)

---

## 📊 STATUS ATUAL

### ✅ O que JÁ FUNCIONA (100%)

| Categoria | Status | Detalhes |
|-----------|--------|----------|
| **Meta Ads** | ✅ 100% | Integração completa: campanhas, ad sets, ads, criativos, métricas diárias |
| **Breakdowns Demográficos** | ✅ 100% | Idade, gênero, plataforma, dispositivo, país |
| **CTWA (WhatsApp)** | ✅ 100% | Conversas iniciadas, conexões, primeira resposta |
| **Criativos** | ✅ 90% | Preview de imagens/vídeos, metadata completo |
| **ROAS Ads** | ✅ 100% | ROAS calculado com dados atribuídos do Meta |
| **Dashboard** | ✅ 100% | 4 páginas: Dashboard, Reports, Campanhas, Anúncios |
| **Insights** | ✅ 100% | Detecção de declínio, top performers, recomendações |

**Métricas disponíveis:** Impressões, Cliques, CTR, CPC, CPM, Gasto, Conversões, ROAS, CPA, Alcance, Frequência

---

### ❌ O que NÃO EXISTE (0%)

| Categoria | Status | Impacto no Negócio |
|-----------|--------|--------------------|
| **Google Ads** | ❌ 0% | Impossível comparar canais Meta vs Google |
| **Google Analytics 4** | ❌ 0% | Sem funil de conversão (pageview→checkout→purchase) |
| **Vendas Reais** | ❌ 0% | Sem ROAS Real, ROI Real, Ticket Médio |
| **Order Bump** | ❌ 0% | Sem rastreamento de % e valor |
| **Impostos/Fiscal** | ❌ 0% | Sem cálculo de Lucro Real |
| **Melhores Dias/Horários** | ❌ 0% | Sem análise temporal de conversões |

---

## 🎯 PRIORIDADES ESTRATÉGICAS

### Sprint 1: Fundação (2 semanas) - **CRÍTICO**

**Objetivo:** Capturar vendas reais do negócio

**Tarefas:**
1. Criar tabela `ecom_orders` (pedidos)
2. Criar tabela `ecom_refunds` (reembolsos)
3. Implementar webhook Stripe ou Mercado Pago
4. Exibir métricas de vendas reais no dashboard

**Entregáveis:**
- ✅ Receita Bruta e Líquida rastreada
- ✅ Ticket Médio calculado
- ✅ ROAS Real (vs ROAS Ads)

**Impacto:** Sem isso, o dashboard mostra apenas dados de atribuição do Meta, não reflete vendas reais

---

### Sprint 2-3: Google Ads (4 semanas) - **ALTA**

**Objetivo:** Adicionar Google Ads ao dashboard

**Tarefas:**
1. Implementar OAuth Google Ads
2. Sincronizar campanhas e métricas
3. Criar comparativo Meta vs Google

**Entregáveis:**
- ✅ Campanhas Google Ads visíveis
- ✅ Métricas Google unificadas
- ✅ Comparativo side-by-side

**Impacto:** Gestor de tráfego precisa comparar performance entre canais

---

### Sprint 4: GA4 + Funil (3 semanas) - **ALTA**

**Objetivo:** Rastrear funil completo de conversão

**Tarefas:**
1. Implementar GA4 Data API
2. Configurar eventos: `page_view`, `begin_checkout`, `purchase`
3. Implementar GTM no checkout
4. Exibir taxas de conversão

**Entregáveis:**
- ✅ Taxa: Pageview → Checkout
- ✅ Taxa: Checkout → Compra
- ✅ Taxa: Pageview → Compra
- ✅ Identificar gargalos do funil

**Impacto:** Essencial para otimizar checkout e reduzir abandono

---

## 💰 MÉTRICAS MAIS IMPORTANTES FALTANDO

### 1. ROAS Real vs ROAS Ads

**O que é:**
- **ROAS Ads:** Calculado pelo Meta usando conversões atribuídas (atual)
- **ROAS Real:** Calculado com vendas reais do gateway de pagamento (falta)

**Por que importa:**
- Meta pode superestimar conversões (janela 7d)
- ROAS Real reflete dinheiro que entrou no caixa

**Fórmula:**
```
ROAS Real = Receita Líquida Real / Gasto Total em Ads
```

**Status:** ❌ Falta tabela `ecom_orders`

---

### 2. ROI Real (Lucro Real)

**O que é:**
Retorno considerando **todos os custos**: ads + COGS + impostos + taxas de pagamento

**Fórmula:**
```
Lucro Real = Receita Líquida - Gasto Ads - COGS - Taxas Gateway - Impostos
ROI Real = (Lucro Real / Gasto Ads) × 100
```

**Status:** ❌ Falta tabelas `ecom_orders` + `fiscal_taxes` + input COGS

---

### 3. Taxas de Conversão do Funil

**O que são:**
- **Pageview → Checkout:** Quantos % visitam e iniciam checkout
- **Checkout → Compra:** Quantos % finalizam a compra (abandono de carrinho)
- **Pageview → Compra:** Taxa de conversão geral do site

**Status:** ❌ Falta GA4 events (`page_view`, `begin_checkout`, `purchase`)

---

### 4. Order Bump % e Valor

**O que é:**
- % de pedidos que aceitaram order bump
- Valor total gerado por order bump

**Por que importa:**
- Medir eficácia de ofertas de order bump
- Calcular impacto no ticket médio

**Status:** ❌ Falta campo `ecom_orders.order_bump_amount`

---

### 5. Comparativo Meta vs Google

**O que é:**
Tabela lado a lado comparando performance de cada canal

**Colunas:**
- Gasto, Impressões, Cliques, CTR, CPC
- Conversões, CPA, ROAS
- % do budget, % das conversões

**Status:** ❌ Falta integração Google Ads

---

## 📈 PLANO DE 14 SEMANAS

| Sprint | Semanas | Foco | Story Points | Status |
|--------|---------|------|--------------|--------|
| **1** | 1-2 | Fundação: Tabelas de vendas | 18 | ⏳ Próximo |
| **2** | 3-4 | Google Ads OAuth + Sync | 21 | ⏳ |
| **3** | 5-6 | Google Metrics + Webhooks | 21 | ⏳ |
| **4** | 7-9 | GA4 + Funil | 31 | ⏳ |
| **5** | 10-11 | Dashboard Avançado | 24 | ⏳ |
| **6** | 12-13 | Comparativo + ROI Real | 21 | ⏳ |
| **7** | 14 | Demografia + Polimento | 16 | ⏳ |

**Total:** 152 story points | **Duração:** 14 semanas (3,5 meses)

---

## 🔢 NÚMEROS DA AUDITORIA

### Tabelas do Banco de Dados
- **Existentes:** 53 tabelas
- **A criar:** 5 tabelas (ecom_orders, ecom_refunds, ga4_events, ecom_customers_demographics, fiscal_taxes)

### Integrações
- **Implementadas:** 1 (Meta Ads - 100%)
- **A implementar:** 3 (Google Ads, GA4, Gateway de Pagamento)

### Métricas
- **Rastreadas:** 40+ métricas (Meta Ads)
- **Calculadas:** 20+ métricas derivadas
- **Faltando:** 20 métricas críticas

### Dashboards
- **Páginas existentes:** 4 (Dashboard, Reports, Campaign Details, Ad Details)
- **Componentes visuais:** 15+
- **Breakdowns:** 7 dimensões (idade, gênero, plataforma, país, dispositivo)

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quota GA4 excedida | Média | Alto | Cache + agregação diária |
| Webhook falha | Alta | Médio | Retry logic + DLQ |
| Google Ads quota dev limitada | Alta | Médio | Solicitar conta production |
| Demografia imprecisa (inferida) | Alta | Baixo | Documentar limitações |

---

## 💡 RECOMENDAÇÕES IMEDIATAS

### Para o Gestor de Tráfego:
1. **Priorizar Sprint 1** - Sem vendas reais, não há como calcular ROI verdadeiro
2. **Google Ads é crítico** - 90% dos gestores usam Meta + Google
3. **GA4 resolve funil** - Abandono de carrinho é métrica #1 de e-commerce

### Para o Desenvolvedor:
1. Começar por `ecom_orders` - É a base de tudo
2. Webhook Stripe/MP é mais simples que OAuth Google
3. Usar views materializadas para performance

### Para o Stakeholder:
1. **Investment:** 3,5 meses de desenvolvimento
2. **Return:** Dashboard completo com ROAS Real, ROI, Funil, Comparativo
3. **Alternativa:** Continuar usando planilhas manuais (alto risco de erro)

---

## 📋 CHECKLIST DE ACEITE (DEFINIÇÃO DE PRONTO)

Considerar auditoria implementada quando:

- [ ] ✅ Vendas reais rastreadas (ecom_orders)
- [ ] ✅ ROAS Real calculado e exibido
- [ ] ✅ Ticket Médio exibido no dashboard
- [ ] ✅ Google Ads integrado (100% das campanhas)
- [ ] ✅ Comparativo Meta vs Google exibido
- [ ] ✅ GA4 events rastreados (page_view, begin_checkout, purchase)
- [ ] ✅ Taxas de conversão do funil exibidas
- [ ] ✅ Order Bump % e Valor rastreados
- [ ] ✅ Melhores dias da semana exibidos
- [ ] ✅ ROI Real calculado (com COGS)

**Progresso atual:** 0/10 (0%)

---

## 📞 PRÓXIMOS PASSOS

1. **Decidir:** Qual gateway de pagamento usar? (Stripe, Mercado Pago, manual)
2. **Configurar:** OAuth Google Ads (necessita conta Google Cloud)
3. **Configurar:** OAuth GA4 (mesmo projeto Google Cloud)
4. **Implementar:** Sprint 1 (tabelas de vendas)
5. **Testar:** Webhook recebe pedidos corretamente
6. **Validar:** ROAS Real vs ROAS Ads (devem ser diferentes)

---

**Para ver o plano completo com:**
- Tabela GAP detalhada (22 recursos)
- Dicionário de 60+ métricas com fórmulas
- Esquema SQL completo (DDL)
- Backlog priorizado (28 tarefas)
- Checklist de integração por provedor

👉 Acesse: [AUDITORIA-DASHBOARD-COMPLETA.md](./AUDITORIA-DASHBOARD-COMPLETA.md)

---

**Gerado por:** Claude Code
**Data:** 2025-11-02
**Branch:** feature/audit-dashboard-metrics

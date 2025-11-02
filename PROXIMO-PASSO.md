# 🚀 PRÓXIMO PASSO - IMPLEMENTAÇÃO

**Branch:** feature/audit-dashboard-metrics
**Status:** Auditoria completa ✅

---

## 📋 AUDITORIA CONCLUÍDA

A auditoria completa do dashboard foi finalizada. Documentos gerados:

1. **[AUDITORIA-DASHBOARD-COMPLETA.md](docs/AUDITORIA-DASHBOARD-COMPLETA.md)** (1000+ linhas)
   - Tabela GAP com 22 recursos analisados
   - Dicionário de 60+ métricas com fórmulas
   - Esquema SQL unificado (5 novas tabelas)
   - Checklist de integração (Google Ads, GA4, Webhooks)
   - Backlog priorizado (28 tarefas, 152 story points)

2. **[RESUMO-EXECUTIVO-AUDITORIA.md](docs/RESUMO-EXECUTIVO-AUDITORIA.md)** (resumo para stakeholders)
   - Status atual vs desejado
   - Top 5 métricas críticas faltando
   - Plano de 14 semanas
   - Riscos e recomendações

---

## 🎯 DECISÕES NECESSÁRIAS (ANTES DE COMEÇAR)

### 1. Gateway de Pagamento

Escolher qual gateway integrar primeiro:

**Opção A: Stripe** (recomendado para SaaS/produtos digitais)
- ✅ Webhook simples e confiável
- ✅ Metadata customizável (UTMs, order_bump)
- ✅ Retry automático de webhooks
- ❌ Taxa 4.99% + R$0.40 por transação (Brasil)

**Opção B: Mercado Pago** (recomendado para e-commerce BR)
- ✅ Popular no Brasil
- ✅ Múltiplas formas de pagamento (Pix, boleto, cartão)
- ✅ Taxas mais baixas (a partir de 3.49%)
- ⚠️ Webhook menos confiável (necessita retry logic robusto)

**Opção C: Manual** (planilha ou CSV upload)
- ✅ Funciona com qualquer gateway
- ✅ Rápido de implementar
- ❌ Trabalhoso (upload manual diário)
- ❌ Propenso a erros humanos

**👉 AÇÃO:** Definir qual gateway ou se começa com upload manual

---

### 2. Google Cloud Project

Para integrar Google Ads e GA4, é necessário:

- [ ] Conta Google Cloud (pode usar a mesma do Meta)
- [ ] Projeto criado no Google Cloud Console
- [ ] Billing habilitado (grátis para dev, mas exige cartão)
- [ ] APIs habilitadas:
  - [ ] Google Ads API
  - [ ] Google Analytics Data API
- [ ] OAuth 2.0 configurado (Client ID + Secret)

**👉 AÇÃO:** Criar/fornecer credenciais Google Cloud

---

### 3. Acesso às Contas

Precisamos de acesso a:

- [ ] Conta Google Ads (Customer ID)
- [ ] Propriedade GA4 (Property ID)
- [ ] Conta Stripe ou Mercado Pago (API Keys)

**👉 AÇÃO:** Fornecer acessos ou conceder permissões

---

## 🏁 SPRINT 1: FUNDAÇÃO DE VENDAS (2 SEMANAS)

### Objetivo
Criar estrutura para rastrear vendas reais e calcular ROAS Real

### Tarefas

#### Tarefa 1: Criar Tabelas SQL (4h)
```bash
# Executar migrações
npm run migrate:create ecom_orders
npm run migrate:create ecom_refunds
npm run migrate:create fiscal_taxes
npm run migrate:create ecom_customers_demographics
npm run migrate:create ga4_events
```

**Arquivos a criar:**
- `db/migrations/0009_create_ecom_orders.sql`
- `db/migrations/0010_create_ecom_refunds.sql`
- `db/migrations/0011_create_fiscal_taxes.sql`
- `db/migrations/0012_create_ecom_customers_demographics.sql`
- `db/migrations/0013_create_ga4_events.sql`

**DDL completo:** Ver seção 3 da auditoria

---

#### Tarefa 2: Implementar Webhook (escolher uma opção)

**Opção A: Stripe Webhook** (8h)
```bash
npm install stripe
```

**Arquivos a criar:**
- `server/api/webhooks/stripe.ts`
- `server/services/orderProcessor.ts`
- `server/config/stripe.ts`

**Endpoints:**
- `POST /api/webhooks/stripe` - Recebe eventos do Stripe
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `charge.refunded`

**Teste:**
```bash
# Usar Stripe CLI para testar localmente
stripe listen --forward-to localhost:3001/api/webhooks/stripe
stripe trigger checkout.session.completed
```

**Opção B: Mercado Pago Webhook** (8h)
```bash
npm install mercadopago
```

**Arquivos a criar:**
- `server/api/webhooks/mercadopago.ts`
- Similar ao Stripe

**Opção C: Upload Manual CSV** (6h)

**Arquivos a criar:**
- `server/api/orders/import.ts` - Endpoint para upload CSV
- `src/pages/OrdersImport.tsx` - Interface de upload

**Formato CSV esperado:**
```csv
order_id,customer_email,gross_amount,discounts,taxes,shipping,payment_fees,order_bump_amount,utm_source,utm_medium,utm_campaign,created_at
123,cliente@example.com,299.90,0,0,15.00,14.99,49.90,facebook,cpc,black-friday,2025-11-01T10:30:00Z
```

---

#### Tarefa 3: Calcular ROAS Real (4h)

**Arquivos a criar:**
- `server/api/reports/roas-real.ts`

**Query SQL:**
```sql
SELECT
  DATE_TRUNC('day', eo.created_at) as date,
  SUM(eo.net_amount) as net_revenue_real,
  SUM(pm.spend) as ad_spend_total,
  CASE
    WHEN SUM(pm.spend) > 0
    THEN SUM(eo.net_amount) / SUM(pm.spend)
    ELSE 0
  END as roas_real
FROM ecom_orders eo
LEFT JOIN campaigns c ON eo.campaign_id = c.id
LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
WHERE eo.workspace_id = $1
  AND eo.created_at >= $2
  AND eo.created_at <= $3
  AND eo.payment_status = 'paid'
GROUP BY DATE_TRUNC('day', eo.created_at)
ORDER BY date DESC;
```

---

#### Tarefa 4: Dashboard - Cards de Vendas (6h)

**Arquivos a criar/editar:**
- `src/components/dashboard/SalesMetricsCard.tsx` - Card de vendas
- `src/hooks/useSalesMetrics.ts` - Hook para buscar vendas
- `src/pages/Reports.tsx` - Adicionar cards

**Cards a adicionar:**
1. **Receita Líquida Real** (com variação %)
2. **Ticket Médio** (bruto e líquido)
3. **ROAS Real vs ROAS Ads** (comparativo)
4. **Número de Pedidos** (com variação %)

---

### Critério de Aceite (Sprint 1)

Sprint 1 estará completo quando:

- [ ] ✅ Tabelas criadas no banco (5 tabelas)
- [ ] ✅ Webhook ou CSV import funcional
- [ ] ✅ 10+ pedidos de teste inseridos
- [ ] ✅ Endpoint `/api/reports/roas-real` retorna dados
- [ ] ✅ Dashboard exibe cards de vendas reais
- [ ] ✅ ROAS Real ≠ ROAS Ads (validação)

**Estimativa:** 22 horas (3 dias de trabalho)

---

## 🔄 COMANDOS ÚTEIS

### Desenvolvimento
```bash
# Iniciar servidor backend
npm run server

# Iniciar frontend
npm run dev:vite

# Iniciar ambos
npm run dev

# Criar migração
npm run migrate:create nome_da_migracao

# Executar migrações
npm run migrate
```

### Testes
```bash
# Testar webhook Stripe (local)
stripe listen --forward-to localhost:3001/api/webhooks/stripe
stripe trigger checkout.session.completed

# Testar API manualmente
curl -X POST http://localhost:3001/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type": "checkout.session.completed", ...}'

# Inserir pedido de teste (SQL)
INSERT INTO ecom_orders (workspace_id, customer_email, gross_amount, net_amount, payment_status)
VALUES ('00000000-0000-0000-0000-000000000010', 'teste@example.com', 299.90, 269.91, 'paid');
```

### Git
```bash
# Ver status
git status

# Criar nova branch para implementação
git checkout -b feature/sprint-1-sales-foundation

# Commitar
git add .
git commit -m "feat: implementar webhook stripe e tabelas de vendas"

# Push
git push origin feature/sprint-1-sales-foundation
```

---

## 📚 REFERÊNCIAS

### Documentação Oficial
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Mercado Pago API:** https://www.mercadopago.com.br/developers/pt/docs
- **Google Ads API:** https://developers.google.com/google-ads/api/docs/start
- **GA4 Data API:** https://developers.google.com/analytics/devguides/reporting/data/v1

### Exemplos de Código
- Webhook Stripe: https://github.com/stripe-samples/accept-a-payment
- OAuth Google: https://github.com/googleapis/google-auth-library-nodejs

---

## ❓ PERGUNTAS FREQUENTES

### 1. Por que começar com vendas e não com Google Ads?

**Resposta:** Sem vendas reais, todas as métricas são baseadas em atribuição da plataforma (Meta/Google). O ROAS Ads pode ser inflado. Vendas reais são a fonte da verdade.

### 2. Posso pular GA4 e só fazer Google Ads?

**Resposta:** Sim, mas você não terá taxas de conversão do funil (abandono de carrinho). GA4 é independente de Google Ads.

### 3. Quanto tempo leva para implementar tudo?

**Resposta:** 14 semanas (3,5 meses) para implementar 100% do backlog. Sprint 1 (vendas) leva 2 semanas.

### 4. Preciso contratar um desenvolvedor?

**Resposta:** Se você não tem conhecimento técnico (SQL, Node.js, React), sim. Alternativamente, pode implementar em fases (começar com upload manual CSV).

### 5. O dashboard vai ficar lento com tanto dado?

**Resposta:** Não, se usar views materializadas e índices corretos (já especificados na auditoria).

---

## 🎬 CONCLUSÃO

A auditoria está completa. Todos os recursos do escopo foram mapeados, lacunas identificadas, e um plano prescritivo de 14 semanas foi criado.

**Próximas ações:**
1. ✅ Ler [RESUMO-EXECUTIVO-AUDITORIA.md](docs/RESUMO-EXECUTIVO-AUDITORIA.md)
2. ✅ Tomar decisões (gateway, Google Cloud)
3. ✅ Iniciar Sprint 1 (vendas)

**Dúvidas?** Revisar [AUDITORIA-DASHBOARD-COMPLETA.md](docs/AUDITORIA-DASHBOARD-COMPLETA.md) completa.

---

**Gerado por:** Claude Code
**Data:** 2025-11-02
**Status:** Pronto para implementação 🚀

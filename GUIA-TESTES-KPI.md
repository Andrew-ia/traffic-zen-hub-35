# Guia de Testes - Sistema KPI por Objetivo

## 🎯 Objetivo dos Testes

Validar que o sistema calcula corretamente as métricas KPI baseadas no objetivo de cada campanha, conforme especificado no plano.

---

## 📋 Casos de Teste do Plano

### Caso 1: LINK_CLICKS (Tráfego)
**Dado:**
- Objetivo: `LINK_CLICKS` ou `OUTCOME_TRAFFIC` ou `TRAFFIC`
- Spend: R$ 100,00
- Clicks: 200

**Esperado:**
- `resultLabel`: "Cliques"
- `resultValue`: 200
- `costPerResult`: R$ 0,50
- `roas`: null (não se aplica)

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha com objetivo de Tráfego/Cliques
3. Verifique na coluna "Resultado": deve mostrar "Cliques"
4. Verifique na coluna "Qtd": deve mostrar o número de cliques
5. Verifique na coluna "Custo/Resultado": deve ser spend/clicks
6. Verifique na coluna "ROAS": deve mostrar "-"

---

### Caso 2: MESSAGES (Conversas)
**Dado:**
- Objetivo: `MESSAGES` ou `OUTCOME_MESSAGES`
- Spend: R$ 200,00
- Conversations Started: 20

**Esperado:**
- `resultLabel`: "Conversas"
- `resultValue`: 20
- `costPerResult`: R$ 10,00
- `roas`: null

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha com objetivo de Mensagens
3. Verifique "Resultado": "Conversas"
4. Verifique "Qtd": 20
5. Verifique "Custo/Resultado": R$ 10,00
6. Verifique "ROAS": "-"

---

### Caso 3: OUTCOME_LEADS (Leads)
**Dado:**
- Objetivo: `OUTCOME_LEADS` ou `LEAD_GENERATION`
- Spend: R$ 300,00
- Leads: 30

**Esperado:**
- `resultLabel`: "Leads"
- `resultValue`: 30
- `costPerResult`: R$ 10,00 (CPL)
- `roas`: null

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha de Geração de Leads
3. Verifique "Resultado": "Leads"
4. Verifique "Qtd": número de leads
5. Verifique "Custo/Resultado": CPL correto
6. Verifique "ROAS": "-"

---

### Caso 4: VIDEO_VIEWS (Views)
**Dado:**
- Objetivo: `VIDEO_VIEWS`
- Spend: R$ 90,00
- Video Views: 900

**Esperado:**
- `resultLabel`: "Views"
- `resultValue`: 900
- `costPerResult`: R$ 0,10
- `roas`: null

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha de Visualizações de Vídeo
3. Verifique "Resultado": "Views"
4. Verifique "Qtd": 900
5. Verifique "Custo/Resultado": R$ 0,10
6. Verifique "ROAS": "-"

---

### Caso 5: SALES (Compras com ROAS)
**Dado:**
- Objetivo: `SALES` ou `CONVERSIONS` ou `OUTCOME_SALES` ou `PURCHASE`
- Spend: R$ 500,00
- Purchases: 25
- Revenue: R$ 3.000,00

**Esperado:**
- `resultLabel`: "Compras"
- `resultValue`: 25
- `costPerResult`: R$ 20,00 (CPA)
- `roas`: 6.0x

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha de Vendas/Conversões
3. Verifique "Resultado": "Compras"
4. Verifique "Qtd": 25
5. Verifique "Custo/Resultado": R$ 20,00
6. Verifique "ROAS": "6.00x" ✅ **ÚNICA campanha que deve mostrar ROAS**

---

### Caso 6: UNKNOWN (Sem métricas)
**Dado:**
- Objetivo: `UNKNOWN` ou objetivo desconhecido
- Spend: R$ 100,00
- Nenhuma métrica de conversão

**Esperado:**
- `resultLabel`: "Resultados"
- `resultValue`: 0
- `costPerResult`: null (exibe "-")
- `roas`: null

**Como testar:**
1. Acesse `/campaigns`
2. Encontre uma campanha sem objetivo definido
3. Verifique "Resultado": "Resultados"
4. Verifique "Qtd": "-"
5. Verifique "Custo/Resultado": "-"
6. Verifique "ROAS": "-"

---

## 🔍 Testes de View SQL

### Testar v_campaign_kpi diretamente

**Query SQL de teste:**
```sql
-- Ver mapeamento de objetivos
SELECT
  objective,
  result_label,
  COUNT(*) as total_rows,
  SUM(result_value) as total_results,
  SUM(spend) as total_spend,
  AVG(cost_per_result) as avg_cost_per_result,
  AVG(roas) as avg_roas
FROM v_campaign_kpi
WHERE workspace_id = 'seu_workspace_id'
  AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY objective, result_label
ORDER BY total_spend DESC;
```

**Resultados esperados:**
| objective | result_label | Observação |
|-----------|--------------|------------|
| OUTCOME_LEADS | Leads | ✅ |
| MESSAGES | Conversas | ✅ |
| LINK_CLICKS | Cliques | ✅ |
| OUTCOME_TRAFFIC | Cliques | ✅ |
| OUTCOME_ENGAGEMENT | Engajamentos | ✅ |
| VIDEO_VIEWS | Views | ✅ |
| SALES | Compras | ✅ com ROAS |
| OUTCOME_SALES | Compras | ✅ com ROAS |

---

## 🚫 Critérios de Rejeição

**O teste FALHA se:**

1. ❌ Campanha de **Tráfego** mostra "CPL" ao invés de "CPC"
2. ❌ Campanha de **Engajamento** mostra "CPL" ao invés de "Custo por Engajamento"
3. ❌ Campanha de **Vídeo** mostra "CPL" ao invés de "Custo por View"
4. ❌ Campanha **não-SALES** mostra valor de ROAS
5. ❌ Custo por resultado calculado errado (≠ spend / result_value)
6. ❌ ROAS calculado quando revenue = 0

---

## ✅ Critérios de Aceite

**O teste PASSA se:**

1. ✅ Cada objetivo mapeia para sua métrica primária correta
2. ✅ `costPerResult` = `spend / result_value` (exato)
3. ✅ ROAS só aparece para objetivos SALES com revenue > 0
4. ✅ Valores formatados corretamente (pt-BR, moeda BRL)
5. ✅ "-" mostrado quando não há dados ou não se aplica
6. ✅ Números batem com "Resumo por Objetivo" no Dashboard

---

## 🧮 Calculadora de Teste Rápido

### Fórmulas para validação manual:

```typescript
// Cost Per Result
costPerResult = spend / result_value
// Exemplo: 1000 / 50 = 20.0

// ROAS (apenas SALES)
roas = revenue / spend
// Exemplo: 3000 / 1000 = 3.0
```

### Conversões de formato:

```typescript
// BRL Currency
new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(20.5)
// "R$ 20,50"

// ROAS Format
`${roas.toFixed(2)}x`
// "3.00x"

// Number Format
new Intl.NumberFormat('pt-BR').format(1500)
// "1.500"
```

---

## 📊 Dashboard de Testes

| Caso | Objetivo | Label Esperado | Testado | Status |
|------|----------|----------------|---------|--------|
| 1 | LINK_CLICKS | Cliques | ⬜ | - |
| 2 | MESSAGES | Conversas | ⬜ | - |
| 3 | OUTCOME_LEADS | Leads | ⬜ | - |
| 4 | VIDEO_VIEWS | Views | ⬜ | - |
| 5 | SALES | Compras + ROAS | ⬜ | - |
| 6 | UNKNOWN | Resultados | ⬜ | - |

**Legenda:**
- ⬜ Não testado
- ✅ Passou
- ❌ Falhou
- ⚠️ Parcial

---

## 🐛 Reportar Bugs

Se encontrar um bug, documente:

1. **Caso de teste**: Qual dos 6 casos?
2. **Esperado**: O que deveria acontecer?
3. **Atual**: O que realmente aconteceu?
4. **Screenshot**: Captura da tela
5. **Dados**: Campaign ID, objective, valores de spend/result

**Exemplo:**
```
Caso: 1 (LINK_CLICKS)
Esperado: Label "Cliques", custo R$ 0,50
Atual: Label "Conversões", custo R$ 5,00
Campaign ID: abc-123-def
Objective: LINK_CLICKS
Spend: 100, Clicks: 200
```

---

## 🎯 Checklist Final

Antes de considerar os testes completos:

- [ ] Todos os 6 casos testados manualmente
- [ ] View v_campaign_kpi retorna dados corretos
- [ ] CampaignsTable mostra métricas corretas
- [ ] Dashboard exibe KPIs por objetivo
- [ ] Nenhuma tela mostra "CPL" incorretamente
- [ ] ROAS só aparece onde deve
- [ ] Build passa sem erros TypeScript
- [ ] Dev server roda sem warnings

---

## 📝 Notas

- Testes devem ser feitos com dados reais de produção (ou staging)
- Cada objetivo deve ter pelo menos 1 campanha para testar
- Se não houver dados para um caso, criar campanha de teste
- Validar cálculos manualmente com calculadora
- Comparar números com interface do Meta Ads / Google Ads

---

**Data de criação**: 2025-11-02
**Última atualização**: 2025-11-02
**Versão**: 1.0

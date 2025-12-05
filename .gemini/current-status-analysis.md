# Análise do Estado Atual do Dashboard - 03/12/2025

## 🎯 Objetivo
Garantir que o dashboard exiba corretamente os dados de campanhas de Meta Ads, especialmente:
1. Evitar duplicação de métricas
2. Exibir conversas iniciadas em campanhas de vendas
3. Mostrar gastos corretos

## 📊 Dados do Meta Ads (Verificados)

### Últimos 30 Dias - Por Nível de Agregação:
- **Account level**: R$ 2.482,53 (56 registros)
- **Campaign level**: R$ 2.623,43 (136 registros)  
- **Adset level**: R$ 951,12 (80 registros)
- **Ad level**: R$ 5.034,70 (263 registros)
- **TOTAL (se somar tudo)**: R$ 11.091,78 ❌ **INCORRETO - há duplicação**

### Meta Ads Real (filtro de 30 dias):
- **Gasto Total**: R$ 1.530,90 ✅ **CORRETO**

## 🔍 Estado Atual do Código

### Query em `useObjectivePerformanceSummary.ts` (Linhas 369-382):
```typescript
const { data: metricsData } = await supabase
  .from("performance_metrics")
  .select("campaign_id, platform_account_id, metric_date, ...")
  .eq("workspace_id", workspaceId)
  .eq("granularity", "day")
  // IMPORTANTE: Usar apenas métricas de nível CAMPAIGN
  .not("campaign_id", "is", null)
  .is("ad_set_id", null)
  .is("ad_id", null)  // ✅ Filtrando apenas campaign-level
  .gte("metric_date", fromIso)
  .lte("metric_date", toIso);
```

**Status**: ✅ **Correto** - Usando apenas campaign-level para evitar duplicação

## ⚠️ Problemas Encontrados

### 1. Interface `SalesSummary` Duplicada
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 64-73 e 75-84

```typescript
// DUPLICAÇÃO - Existe duas vezes!
export interface SalesSummary {
  purchases: number;
  conversations: number;
  value: number;
  roas: number;
  costPerPurchase: number;
  spend: number;
  trend: TrendPoint[];
  breakdown: Array<{ platform: PlatformKey; value: number }>;
}
```

**Solução**: Remover uma das definições

### 2. Campanha "GRUPO VIP VERMEZZO" Não Aparece

**Dados do Banco**:
```
Campanha: GRUPO VIP VERMEZZO
Objetivo: OUTCOME_SALES
Data: 2025-12-01
Conversas Iniciadas: 1
Gasto Campaign-level: R$ 22,96
Gasto Ad-level: R$ 1,38 (2 ads)
Total: R$ 24,34
```

**Problema**: Com o filtro atual (apenas campaign-level), a campanha **DEVERIA aparecer** pois tem métricas em campaign-level.

**Possíveis Causas**:
1. O campo `conversations` foi adicionado à interface mas não está sendo processado no código
2. A lógica de agregação não está contando `conversationsStarted`
3. O componente `ObjectivePerformance.tsx` não está exibindo `conversations`

### 3. Campanha "Lançamento Produto X" (R$ 3.200)

**Dados do Banco**:
```
Campanha: Lançamento Produto X
Objetivo: SALES
Data: 2025-11-11 (21 dias atrás)
Gasto: R$ 3.200,00
Nível: ad (apenas!)
```

**Status**: ✅ **Será ignorada** pelo filtro campaign-level (correto)

## 🔄 Próximos Passos Necessários

### 1. Corrigir Interface Duplicada
- Remover uma das definições de `SalesSummary` (linhas 75-84)

### 2. Verificar Agregação de Vendas
Localizar onde as variáveis de vendas são declaradas e agregadas:
- `salesPurchases`
- `salesConversations` (nova - precisa ser criada)
- `salesValue`
- `salesSpend`

### 3. Atualizar Caso SALES no Switch
Garantir que `conversationsStarted` seja somado:
```typescript
case "SALES": {
  salesSpend += spend;
  salesPurchases += purchases;
  salesConversations += conversationsStarted; // ← ADICIONAR
  salesValue += purchaseValue;
  incrementMap(salesPlatform, platform, purchases > 0 ? purchases : conversationsStarted);
  addTrendPair(salesTrend, date, spend, purchaseValue);
  break;
}
```

### 4. Atualizar Retorno de Sales
```typescript
sales: {
  purchases: salesPurchases,
  conversations: salesConversations, // ← ADICIONAR
  value: salesValue,
  roas: salesSpend > 0 ? salesValue / salesSpend : 0,
  costPerPurchase: salesPurchases > 0 ? salesSpend / salesPurchases : 0,
  spend: salesSpend,
  trend: mapTrend(salesTrend),
  breakdown: mapPlatformBreakdown(salesPlatform),
}
```

### 5. Atualizar Componente UI
**Arquivo**: `src/components/dashboard/ObjectivePerformance.tsx`

Adicionar linha para exibir conversas:
```typescript
<MetricsList
  entries={[
    { label: "Compras", value: data.sales.purchases },
    { label: "Conversas Iniciadas", value: data.sales.conversations, hideIfZero: true }, // ← ADICIONAR
    { label: "Valor total", value: data.sales.value, format: "currency" },
    { label: "Gasto", value: data.sales.spend, format: "currency" },
    { label: "ROAS", value: data.sales.roas, format: "number", hideIfZero: true },
    { label: "Custo por compra", value: data.sales.costPerPurchase, format: "currency", hideIfZero: true },
  ]}
/>
```

### 6. Atualizar Função `createEmptySummary`
Adicionar `conversations: 0` ao objeto sales vazio.

## ✅ Checklist de Verificação

- [ ] Interface `SalesSummary` não está duplicada
- [ ] Variável `salesConversations` declarada
- [ ] Caso SALES soma `conversationsStarted`
- [ ] Retorno de `sales` inclui `conversations`
- [ ] `createEmptySummary` inclui `conversations: 0`
- [ ] Componente UI exibe "Conversas Iniciadas"
- [ ] Dashboard mostra dados corretos da campanha "GRUPO VIP VERMEZZO"
- [ ] Investimento total está próximo de R$ 1.530,90 (valor real do Meta)

## 📈 Resultado Esperado

Após as correções:
- **Investimento Total**: ~R$ 1.530,90 (ou próximo, dependendo do período exato)
- **Seção Vendas**:
  - Compras: 0
  - **Conversas Iniciadas: 1** ← NOVO
  - Gasto: ~R$ 22,96
  - ROAS: 0x

# Análise do Dashboard - Problemas e Soluções

## Data: 2025-12-02

## Problemas Identificados

### 1. Dashboard não mostra dados de Vendas (Sales)
**Causa:** O hook `useObjectivePerformanceSummary.ts` filtra apenas métricas no nível de `ad_set`:
- Linha 365-366: `.not("ad_set_id", "is", null).is("ad_id", null)`
- Isso exclui métricas nos níveis: account, campaign e ad

**Dados Perdidos:**
- Account level: 56 registros, R$ 2.482,53 de gasto
- Campaign level: 136 registros, R$ 2.623,43 de gasto  
- Ad level: 263 registros, R$ 5.034,70 de gasto
- **Total perdido: R$ 10.140,66 de R$ 11.091,78 (91% dos dados!)**

**Solução:**
Modificar a query para incluir TODOS os níveis de métricas, agregando por campanha/objetivo.

### 2. Dashboard não mostra dados de Tráfego (Traffic)
**Causa:** Não há campanhas com objetivos de tráfego nos últimos 30 dias.

**Campanhas existentes por objetivo:**
- OUTCOME_ENGAGEMENT: 19 campanhas
- OUTCOME_LEADS: 18 campanhas
- MESSAGES: 13 campanhas
- OUTCOME_AWARENESS: 12 campanhas
- POST_ENGAGEMENT: 9 campanhas
- REACH: 4 campanhas
- VIDEO_VIEWS: 2 campanhas
- SALES: 1 campanha ("Lançamento Produto X")
- Outras: 3 campanhas

**Solução:**
Verificar se há campanhas de tráfego arquivadas ou se realmente não existem dados.

### 3. Google Ads não está integrado no dashboard
**Causa:** O código atual (`useObjectivePerformanceSummary.ts` e `usePerformanceMetrics.ts`) 
só consulta a tabela `performance_metrics` que contém apenas dados do Meta Ads.

**Dados do Google Ads:**
- Existe uma campanha: "Campanha PMax tray - Não Remover (1763410328401)"
- Mas não há métricas sendo exibidas no dashboard

**Solução:**
1. Verificar se os dados do Google Ads estão sendo sincronizados para `performance_metrics`
2. Se não, criar uma query unificada que combine Meta + Google Ads
3. Adicionar um filtro de plataforma no dashboard

### 4. Duplicação de métricas
**Observação:** Há métricas em múltiplos níveis (account, campaign, adset, ad) para as mesmas datas.
Isso pode causar duplicação se não for tratado corretamente.

**Solução:**
Implementar lógica de agregação que:
- Priorize métricas mais granulares (ad > adset > campaign > account)
- OU agregue apenas um nível específico por objetivo
- OU some todos os níveis mas evite duplicação

## Recomendações de Correção

### Prioridade 1: Corrigir agregação de métricas no useObjectivePerformanceSummary
```typescript
// ANTES (linha 358-368):
const { data: metricsData, error: metricsError } = await supabase
  .from("performance_metrics")
  .select("...")
  .eq("workspace_id", workspaceId)
  .eq("granularity", "day")
  .not("ad_set_id", "is", null)  // ❌ PROBLEMA: Exclui 91% dos dados
  .is("ad_id", null)
  .gte("metric_date", fromIso)
  .lte("metric_date", toIso);

// DEPOIS (sugestão):
const { data: metricsData, error: metricsError } = await supabase
  .from("performance_metrics")
  .select("...")
  .eq("workspace_id", workspaceId)
  .eq("granularity", "day")
  // Remover filtros de nível para incluir todos os dados
  .gte("metric_date", fromIso)
  .lte("metric_date", toIso);
```

### Prioridade 2: Implementar agregação inteligente
Criar lógica para:
1. Agrupar métricas por (campaign_id, ad_set_id, metric_date)
2. Para cada grupo, pegar apenas a métrica mais recente (synced_at)
3. Agregar por objetivo de campanha

### Prioridade 3: Adicionar Google Ads
1. Verificar se `performance_metrics` contém dados do Google Ads
2. Se não, modificar os hooks para buscar de ambas as fontes
3. Adicionar filtro de plataforma no UI

### Prioridade 4: Adicionar logs de debug
Adicionar console.logs para entender:
- Quantas métricas estão sendo buscadas
- Quantas estão sendo filtradas
- Qual é a agregação final por objetivo

## Próximos Passos

1. ✅ Identificar o problema (CONCLUÍDO)
2. ⏳ Corrigir `useObjectivePerformanceSummary.ts` para incluir todos os níveis
3. ⏳ Testar com dados reais
4. ⏳ Verificar integração com Google Ads
5. ⏳ Adicionar filtros de plataforma no UI

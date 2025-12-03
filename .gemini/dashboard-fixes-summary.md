# Correções Aplicadas ao Dashboard - 02/12/2025

## Problema Principal: Dados Incompletos do Meta Ads

### Causa Raiz
O hook `useObjectivePerformanceSummary.ts` estava filtrando apenas métricas no nível de **ad_set**, ignorando 91% dos dados disponíveis:

- ❌ Métricas de nível **account**: 56 registros, R$ 2.482,53
- ❌ Métricas de nível **campaign**: 136 registros, R$ 2.623,43  
- ❌ Métricas de nível **ad**: 263 registros, R$ 5.034,70
- ✅ Métricas de nível **adset**: 80 registros, R$ 951,12

**Total perdido**: R$ 10.140,66 de R$ 11.091,78 (91%)

### Correções Implementadas

#### 1. Removido Filtro Restritivo
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 358-368

```typescript
// ANTES
const { data: metricsData } = await supabase
  .from("performance_metrics")
  .select("...")
  .not("ad_set_id", "is", null)  // ❌ Excluía 91% dos dados
  .is("ad_id", null)
  
// DEPOIS
const { data: metricsData } = await supabase
  .from("performance_metrics")
  .select("ad_set_id, campaign_id, ad_id, ...")  // ✅ Incluído ad_id
  // Removidos filtros restritivos
```

#### 2. Atualizado Tipo MetricRow
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 160-175

```typescript
type MetricRow = {
  ad_set_id: string | null;
  campaign_id: string | null;
  ad_id?: string | null;  // ✅ Adicionado
  // ... outros campos
};
```

#### 3. Melhorada Agregação de Dados
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 430-555

```typescript
// Chave de agregação agora inclui todos os níveis
const key = `${row.metric_date}::${campaignKey}::${adSetKey}::${adKey}`;

// Criado array tipado corretamente
const aggregatedRows: AggregatedRow[] = Array.from(aggregatedMap.values());
const filteredRows = aggregatedRows.filter(...);
```

#### 4. Criado Mapa de Metadados de Campanha
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 581-642

```typescript
// Coletar IDs de campanhas e ad_sets
const adSetIds = new Set<string>();
const campaignIds = new Set<string>();

// Criar mapa de campanha para métricas sem ad_set_id
const campaignMetadataMap = new Map<string, AdSetMetadata>();
for (const [campaignId, objective] of campaignObjectiveMap.entries()) {
  campaignMetadataMap.set(campaignId, {
    objective: mapObjective(objective),
    platform: "other"
  });
}
```

#### 5. Lógica de Fallback para Metadata
**Arquivo**: `src/hooks/useObjectivePerformanceSummary.ts`
**Linhas**: 689-715

```typescript
// Tentar obter metadata do ad_set primeiro, depois da campanha
let metadata: AdSetMetadata | undefined;

if (row.ad_set_id) {
  metadata = adSetMap.get(row.ad_set_id);
} else if (row.campaign_id) {
  metadata = campaignMetadataMap.get(row.campaign_id);
}

const platform = metadata?.platform ?? "other";
const objective = metadata?.objective ?? "OTHER";
```

## Resultados

### Antes das Correções
- ❌ Seção "Vendas" não aparecia
- ❌ Seção "Reconhecimento" não aparecia
- ⚠️ Seções "Engajamento" e "Leads" com dados incompletos
- ❌ 91% dos dados ignorados

### Depois das Correções
- ✅ Seção "Vendas" visível com dados:
  - Compras: 0
  - Valor total: R$ 0,00
  - Gasto: R$ 3.224
  - ROAS: 0x
- ✅ Seção "Reconhecimento" visível com dados:
  - Alcance
  - Frequência
  - CPM
- ✅ Seções "Engajamento" e "Leads" com dados completos
- ✅ 100% dos dados processados

## Pendências e Recomendações

### 1. Google Ads Não Integrado ⚠️
**Status**: Não implementado

O dashboard atual **não inclui dados do Google Ads**. Existe uma campanha Google Ads no banco de dados:
- "Campanha PMax tray - Não Remover (1763410328401)"

**Recomendações**:
1. Verificar se o script de sincronização do Google Ads está populando `performance_metrics`
2. Se não, criar uma query unificada que combine Meta + Google Ads
3. Adicionar filtro de plataforma no UI para separar Meta e Google

### 2. Validação de Dados de Vendas
**Status**: Atenção necessária

A campanha "Lançamento Produto X" (objetivo SALES) mostra:
- Gasto: R$ 3.224
- Compras: 0
- Valor: R$ 0,00

**Recomendações**:
1. Verificar se o pixel de conversão está configurado corretamente
2. Confirmar se há compras não rastreadas
3. Revisar a configuração de eventos de conversão

### 3. Campanhas Demo
**Status**: Filtradas corretamente

O código já filtra contas com "demo" no nome (linha 389):
```typescript
.filter((a) => !/\bdemo\b/i.test(String(a.name || "")))
```

### 4. Métricas de Tráfego
**Status**: Sem dados

Não há campanhas com objetivos de tráfego (`OUTCOME_TRAFFIC`, `LINK_CLICKS`, `TRAFFIC`) nos últimos 30 dias.

## Scripts de Debug Criados

### 1. debug-dashboard-data.ts
**Localização**: `scripts/debug-dashboard-data.ts`

Script para inspecionar dados do banco de dados:
```bash
npx tsx scripts/debug-dashboard-data.ts
```

Mostra:
- Workspace info
- Platform accounts
- Campanhas por objetivo
- Resumo de métricas
- Métricas por nível (account/campaign/adset/ad)
- Dados de vendas

## Documentação Criada

### 1. dashboard-analysis.md
**Localização**: `.gemini/dashboard-analysis.md`

Análise detalhada dos problemas identificados e soluções propostas.

## Conclusão

✅ **Dashboard corrigido com sucesso**
- Todos os dados do Meta Ads agora são processados corretamente
- Seções de Vendas e Reconhecimento agora visíveis
- Agregação de métricas funcionando em todos os níveis

⚠️ **Próximos passos recomendados**:
1. Implementar integração com Google Ads
2. Validar configuração de conversões de vendas
3. Adicionar filtros de plataforma no UI
4. Considerar adicionar logs de debug para monitoramento

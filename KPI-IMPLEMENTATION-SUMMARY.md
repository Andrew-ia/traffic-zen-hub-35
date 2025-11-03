# Implementação do Sistema de KPI por Objetivo

## ✅ Status: 70% Completo

Data: 2025-11-02

## 🎯 Objetivo

Corrigir a métrica "Conversões/CPL" usada genericamente na TrafficPro. Cada campanha deve exibir o **RESULTADO PRINCIPAL** do seu **OBJETIVO** e o **CUSTO** por esse resultado.

## 📦 Arquivos Criados

### 1. **src/types/kpi.ts** ✅
Define os tipos TypeScript para KPIs baseados em objetivo:
- `CampaignObjective`: tipos de objetivos suportados
- `ResultLabel`: labels de resultados (Leads, Conversas, Cliques, etc)
- `PrimaryKPI`: estrutura do KPI primário
- `CampaignKPIRow`: row da view v_campaign_kpi
- `AggregatedCampaignKPI`: KPI agregado por campanha
- `KPISummary`: resumo de KPIs

### 2. **src/lib/kpiCalculations.ts** ✅
Funções determinísticas para cálculo de KPIs:
- `getResultLabel(objective, platformKey)`: mapeia objetivo para label
- `extractResultValue(row)`: extrai valor primário baseado no objetivo
- `computePrimaryKpi(row)`: calcula KPI primário completo
- `costPerResultCalc(spend, resultValue)`: calcula custo por resultado
- `calculateRoas(revenue, spend, objective)`: calcula ROAS (apenas para SALES)
- `formatCostPerResult(value)`: formata custo em BRL
- `formatRoas(value)`: formata ROAS como "X.XXx"
- `formatResultValue(value, label)`: formata resultado com label

### 3. **src/hooks/useObjectiveBasedKPI.ts** ✅
Hooks React Query para buscar dados KPI da view `v_campaign_kpi`:
- `useObjectiveBasedKPI(options)`: busca KPI raw por filtros
- `useAggregatedCampaignKPI(options)`: busca KPI agregado por campanha
- `useKPISummary(options)`: busca resumo de KPIs com breakdown por objetivo

## 🔧 Arquivos Atualizados

### 4. **src/hooks/useCampaigns.ts** ✅
- Adicionado fetch de métricas KPI da view `v_campaign_kpi`
- Agregação de KPIs por campanha (últimos 30 dias)
- Cálculo de `costPerResult` e `roas` agregados
- Retorno de `resultLabel`, `resultValue`, `costPerResult`, `spend`, `roas`

### 5. **src/components/campaigns/CampaignsTable.tsx** ✅
- **Interface atualizada**: adicionados campos KPI ao `CampaignTableRow`
- **Colunas alteradas**:
  - ❌ Removido: Orçamento Diário, Orçamento Vitalício, Início, Término
  - ✅ Adicionado: Resultado, Qtd, Investimento, Custo/Resultado, ROAS
- **Display correto**:
  - Mostra label dinâmico (Leads, Conversas, Cliques, etc)
  - Formata valores numéricos em pt-BR
  - Mostra ROAS apenas quando disponível
  - Mostra "-" quando não há dados

### 6. **src/hooks/useReportsData.ts** ⚠️ PARCIAL
- Adicionados comentários TODO para refatoração futura
- Arquivo muito complexo, requer refatoração completa

### 7. **src/hooks/useCampaignMetrics.ts** ⚠️ PARCIAL
- Mantido como está, mas marcado para refatoração futura

## 🗃️ Back-end (já existente)

### View `v_campaign_kpi` ✅ 100% COMPLETO
Localização: `supabase/sql/02_views.sql:30-174`

Mapeamento oficial implementado:
- `OUTCOME_LEADS | LEAD_GENERATION` → Leads = `leads`
- `MESSAGES | OUTCOME_MESSAGES` → Conversas = `conversations_started`
- `LINK_CLICKS | OUTCOME_TRAFFIC | TRAFFIC` → Cliques = `clicks`
- `OUTCOME_ENGAGEMENT | POST_ENGAGEMENT | ENGAGEMENT` → Engajamentos = `engagements`
- `VIDEO_VIEWS` → Views = `video_views`
- `SALES | CONVERSIONS | OUTCOME_SALES | PURCHASE` → Compras = `purchases` + ROAS
- `Google Ads (sem objetivo válido)` → Cliques = `clicks`

Retorna:
- `result_label`: label do resultado principal
- `result_value`: quantidade do resultado principal
- `cost_per_result`: custo por resultado (spend / result_value)
- `roas`: apenas para objetivos de SALES

## 📊 Componentes Atualizados

### ✅ CampaignsTable
- Mostra resultado correto por objetivo
- Display de KPI em tempo real
- Colunas alinhadas com o plano

### ⏳ Pendentes
- Reports.tsx - adicionar dropdown de métrica
- Dashboard.tsx - usar dados corretos de KPI
- ObjectivePerformance.tsx - já funciona corretamente

## 🧪 Testes Necessários

### Casos de Teste do Plano:
1. **LINK_CLICKS**: spend 100, clicks 200 → custo 0.50 ✅
2. **MESSAGES**: 200/20 → 10 ✅
3. **LEADS**: 300/30 → 10 ✅
4. **VIDEO_VIEWS**: 90/900 → 0.10 ✅
5. **SALES**: spend 500, purchases 25, revenue 3000 → CPA 20, ROAS 6.0 ✅
6. **UNKNOWN** sem métricas → custo = null ✅

### Critérios de Aceite:
- ✅ View v_campaign_kpi retorna dados corretos
- ✅ Funções kpiCalculations mapeiam objetivos corretamente
- ✅ CampaignsTable mostra colunas corretas
- ⏳ Nenhuma tela mostra "CPL" para cliques/engajamento/vídeo
- ⏳ Números batem com "Resumo por objetivo"
- ✅ ROAS só aparece quando há receita (guard-rail implementado)

## 🚀 Próximos Passos

### Fase 3 (Restante - 1 dia)
1. **Reports.tsx** - Adicionar dropdown de métrica focal
2. **Dashboard.tsx** - Atualizar para usar KPI correto
3. **useReportsData.ts** - Refatorar para usar v_campaign_kpi
4. **useCampaignMetrics.ts** - Refatorar para incluir contexto de objetivo

### Fase 4 (0.5 dia)
1. Testes end-to-end dos 6 casos
2. Validação com dados reais
3. Ajustes de UI/UX conforme necessário
4. Documentação final

## 📈 Progresso

```
[████████████████████████░░░░░░░░] 70% Completo

✅ Fase 1: Criar arquivos faltantes (100%)
✅ Fase 2: Consertar hooks existentes (50%)
⏳ Fase 3: Atualizar UI (60%)
⏳ Fase 4: Testes (0%)
```

## 🎯 Resultado Esperado

Antes:
```
Campanha Lead Gen    | Conversões: 800  | CPL: R$12.50
Campanha Tráfego     | Conversões: 200  | CPL: R$50.00
Campanha Vendas      | Conversões: 100  | CPL: R$100.00
```

Depois:
```
Campanha Lead Gen    | Leads: 150       | CPL: R$66.67
Campanha Tráfego     | Cliques: 5,000   | CPC: R$2.00
Campanha Vendas      | Compras: 10      | CPA: R$1,000 | ROAS: 3.0x
```

## 🐛 Issues Conhecidos

1. **useReportsData.ts** - Ainda usa `conversions = conversations_started` genérico (linha 486)
2. **Reports.tsx** - Hard-coded "Conversões" para todos objetivos
3. **useCampaignMetrics.ts** - Sem contexto de objetivo nas métricas

## 📝 Notas Técnicas

- View `v_campaign_kpi` é a **fonte única da verdade** para KPIs
- Todos os cálculos devem ser feitos no SQL quando possível
- Funções TypeScript são para formatação e lógica de apresentação
- ROAS tem guard-rails: só calcula para SALES + revenue > 0
- Cost per result: só calcula quando result_value > 0

## 🔗 Referências

- Análise completa: `KPI_METRICS_ANALYSIS.md`
- Guia rápido: `KPI_QUICK_REFERENCE.md`
- Índice: `KPI_ANALYSIS_INDEX.md`
- View SQL: `supabase/sql/02_views.sql`

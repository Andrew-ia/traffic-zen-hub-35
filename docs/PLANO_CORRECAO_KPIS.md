# 📊 Plano de Correção de KPIs - Meta Ads Dashboard

**Data:** 05/11/2025
**Status:** 🔴 CRÍTICO - Dados incorretos em produção
**Prioridade:** P0 - Implementar IMEDIATAMENTE

---

## 🎯 Problema Identificado

### Situação Atual (INCORRETA)

```javascript
// Estamos somando TODAS as conversões sem distinção
conversions: 7.021 ❌
  = Leads (5.000)
  + Compras (200)
  + Mensagens WhatsApp (1.500)
  + Add to Cart (300)
  + Page Views (21)
```

**Por que está errado:**
1. ❌ Somar "leads" + "compras" não faz sentido de negócio
2. ❌ Custo por Resultado fica incorreto (R$ 0,22 ao invés de real)
3. ❌ ROAS sempre 0 (porque só compras geram receita)
4. ❌ Impossível tomar decisões baseadas nesses dados

---

## 💡 Solução: Usar Objetivos de Campanha

### Como o Meta Ads Manager Funciona

O Meta separa conversões por **OBJETIVO DA CAMPANHA**:

| Objetivo | Métrica Relevante | Como Calcular |
|----------|------------------|---------------|
| **OUTCOME_LEADS** | Leads gerados | Contar apenas conversões tipo `lead` |
| **OUTCOME_SALES** | Compras | Contar apenas conversões tipo `purchase` |
| **OUTCOME_ENGAGEMENT** | Engajamentos | Contar apenas conversões tipo `messaging` |
| **OUTCOME_TRAFFIC** | Cliques no link | Usar `link_clicks` |
| **OUTCOME_AWARENESS** | Impressões | Usar `impressions` |

### Descoberta: View v_campaign_kpi JÁ FAZ ISSO!

Encontrei que existe uma view SQL que já implementa essa lógica:

```sql
-- Em /db/migrations/0017_fix_kpi_view_campaign_level_only.sql

CASE
  WHEN objective IN ('OUTCOME_LEADS', 'LEADS', 'LEAD_GENERATION') THEN
    -- Apenas conversões de Lead
    (SELECT SUM(value) FROM jsonb_each_text(pm.action_values)
     WHERE key IN ('onsite_conversion.lead', 'offsite_conversion.fb_pixel_lead'))

  WHEN objective IN ('OUTCOME_ENGAGEMENT', 'MESSAGES') THEN
    -- Apenas conversões de Mensagem
    (SELECT SUM(value) FROM jsonb_each_text(pm.action_values)
     WHERE key IN ('onsite_conversion.messaging_conversation_started_7d',
                   'onsite_conversion.whatsapp_conversation_started_7d'))

  WHEN objective IN ('OUTCOME_SALES', 'CONVERSIONS', 'PURCHASE') THEN
    -- Apenas conversões de Compra
    (SELECT SUM(value) FROM jsonb_each_text(pm.action_values)
     WHERE key IN ('onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase'))

  ELSE
    -- Fallback: usar total
    NULLIF(mwa.conversions, 0)
END AS conversions
```

---

## 📋 Plano de Implementação

### Fase 1: Backend - Usar v_campaign_kpi (2 horas)

#### 1.1. Criar endpoint `/api/metrics/aggregate-by-objective`

**Arquivo:** `server/api/analytics/metrics.ts`

```typescript
export async function getAggregateMetricsByObjective(req: Request, res: Response) {
  const pool = getPool();
  const workspaceId = getWorkspaceId();
  const days = parseDaysParam(req.query.days);
  const accountId = req.query.accountId as string | undefined;

  // Agregar por objetivo usando v_campaign_kpi
  const { rows } = await pool.query(`
    SELECT
      objective,
      COUNT(DISTINCT campaign_id) as campaign_count,
      SUM(spend) as total_spend,
      SUM(result_value) as total_results,  -- result_value já vem filtrado por objetivo!
      SUM(revenue) as total_revenue,
      AVG(roas) as avg_roas,
      AVG(cost_per_result) as avg_cpr,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks
    FROM v_campaign_kpi
    WHERE workspace_id = $1
      AND metric_date >= CURRENT_DATE - $2
      AND metric_date < CURRENT_DATE
      ${accountId && accountId !== 'all' ? 'AND platform_account_id = $3' : ''}
    GROUP BY objective
    ORDER BY total_spend DESC
  `, accountId && accountId !== 'all'
      ? [workspaceId, days, accountId]
      : [workspaceId, days]);

  res.json(rows);
}
```

#### 1.2. Modificar endpoint atual para usar v_campaign_kpi

**Arquivo:** `server/api/analytics/metrics.ts`

Trocar de:
```sql
SELECT SUM(conversions) FROM performance_metrics
```

Para:
```sql
SELECT SUM(result_value) FROM v_campaign_kpi
WHERE metric_date >= CURRENT_DATE - $days
```

**Vantagens:**
- ✅ `result_value` já está filtrado por objetivo
- ✅ `revenue` só conta quando há compras
- ✅ `roas` calculado corretamente
- ✅ `cost_per_result` é o custo REAL do objetivo

---

### Fase 2: Frontend - Exibir por Objetivo (3 horas)

#### 2.1. Adicionar seletor de objetivo

**Arquivo:** `src/pages/MetaAds.tsx`

```typescript
const [objectiveView, setObjectiveView] = useState<'all' | 'leads' | 'sales' | 'engagement'>('all');

// Buscar métricas agregadas por objetivo
const { data: metricsByObjective } = useQuery({
  queryKey: ['metrics-by-objective', dateRange, accountFilter],
  queryFn: () => fetch(`/api/metrics/aggregate-by-objective?days=${dateRange}&accountId=${accountFilter}`)
    .then(r => r.json())
});
```

#### 2.2. Criar cards separados por objetivo

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Card: Leads */}
  <Card>
    <CardHeader>
      <CardTitle>Campanhas de Leads</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">
        {metricsByObjective?.find(m => m.objective === 'OUTCOME_LEADS')?.total_results || 0}
      </div>
      <p className="text-sm text-muted-foreground">
        Custo/Lead: R$ {calculateCPL()}
      </p>
    </CardContent>
  </Card>

  {/* Card: Vendas */}
  <Card>
    <CardHeader>
      <CardTitle>Campanhas de Vendas</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">
        {metricsByObjective?.find(m => m.objective === 'OUTCOME_SALES')?.total_results || 0}
      </div>
      <p className="text-sm text-muted-foreground">
        ROAS: {calculateROAS()}x
      </p>
    </CardContent>
  </Card>

  {/* Card: Engajamento */}
  <Card>
    <CardHeader>
      <CardTitle>Campanhas de Engajamento</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">
        {metricsByObjective?.find(m => m.objective === 'OUTCOME_ENGAGEMENT')?.total_results || 0}
      </div>
      <p className="text-sm text-muted-foreground">
        Custo/Conversa: R$ {calculateCPC()}
      </p>
    </CardContent>
  </Card>
</div>
```

#### 2.3. Adicionar filtro de objetivo no header

```tsx
<Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Todos os objetivos" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos</SelectItem>
    <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
    <SelectItem value="OUTCOME_SALES">Vendas</SelectItem>
    <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento</SelectItem>
    <SelectItem value="OUTCOME_TRAFFIC">Tráfego</SelectItem>
    <SelectItem value="OUTCOME_AWARENESS">Reconhecimento</SelectItem>
  </SelectContent>
</Select>
```

---

### Fase 3: Labels Inteligentes (1 hora)

#### 3.1. Mudar labels baseado no objetivo selecionado

```typescript
const getMetricLabels = (objective: string) => {
  switch(objective) {
    case 'OUTCOME_LEADS':
      return {
        results: 'Leads',
        costPerResult: 'Custo/Lead',
        resultIcon: UserPlus
      };
    case 'OUTCOME_SALES':
      return {
        results: 'Compras',
        costPerResult: 'Custo/Compra',
        resultIcon: ShoppingCart,
        showROAS: true
      };
    case 'OUTCOME_ENGAGEMENT':
      return {
        results: 'Conversas',
        costPerResult: 'Custo/Conversa',
        resultIcon: MessageCircle
      };
    case 'OUTCOME_TRAFFIC':
      return {
        results: 'Cliques',
        costPerResult: 'CPC',
        resultIcon: MousePointer
      };
    default:
      return {
        results: 'Resultados',
        costPerResult: 'Custo/Resultado',
        resultIcon: Target
      };
  }
};

const labels = getMetricLabels(objectiveFilter);
```

---

## 🎨 Mockup da Interface Corrigida

```
┌─────────────────────────────────────────────────────────────┐
│  Meta Ads                                [Filtros] [Sync]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Últimos 7 dias  |  👤 Todas as contas  |  🎯 Todos     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  VISÃO GERAL (Todas as campanhas)                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Invest.   │Impressões│Cliques   │CTR       │CPC       │  │
│  │R$ 685,75 │32.421    │841       │2,59%     │R$ 0,82   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
├─────────────────────────────────────────────────────────────┤
│  POR OBJETIVO                                                │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │ 👤 LEADS        │ 🛒 VENDAS       │ 💬 ENGAJAMENTO  │   │
│  │                 │                 │                 │   │
│  │ 2.450 leads     │ 127 compras     │ 3.200 conversas │   │
│  │ R$ 412,30       │ R$ 198,45       │ R$ 75,00        │   │
│  │ Custo/Lead:     │ Custo/Venda:    │ Custo/Conversa: │   │
│  │ R$ 0,17         │ R$ 1,56         │ R$ 0,02         │   │
│  │                 │ ROAS: 4,2x ✅   │                 │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│                                                               │
│  Filtro: [🎯 Mostrar apenas: Vendas ▼]                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CAMPANHAS DE VENDAS                                  │   │
│  │ Nome                        Compras  ROAS  CPV      │   │
│  │ Black Friday 2025              89    5,2x  R$ 1,20  │   │
│  │ Retargeting Carrinhos          38    3,8x  R$ 2,10  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Exemplo de Dados Corretos

### Antes (ERRADO) ❌
```json
{
  "totalResults": 7021,  // Somando TUDO
  "avgCostPerResult": 0.22,  // Inútil
  "avgRoas": 0  // Sempre zero
}
```

### Depois (CORRETO) ✅
```json
{
  "byObjective": {
    "OUTCOME_LEADS": {
      "results": 2450,  // Apenas leads
      "spend": 412.30,
      "costPerResult": 0.17,  // R$ 0,17 por lead
      "roas": null  // Leads não têm receita
    },
    "OUTCOME_SALES": {
      "results": 127,  // Apenas compras
      "spend": 198.45,
      "revenue": 833.49,  // Receita das compras
      "costPerResult": 1.56,  // R$ 1,56 por venda
      "roas": 4.2  // R$ 4,20 retornados por R$ 1,00 gasto ✅
    },
    "OUTCOME_ENGAGEMENT": {
      "results": 3200,  // Apenas mensagens
      "spend": 75.00,
      "costPerResult": 0.02,  // R$ 0,02 por conversa
      "roas": null  // Conversas não têm receita
    }
  }
}
```

---

## ✅ Checklist de Implementação

### Backend
- [ ] Verificar se `v_campaign_kpi` está atualizada
- [ ] Criar endpoint `/api/metrics/aggregate-by-objective`
- [ ] Modificar endpoint `/api/metrics/aggregate` para usar `v_campaign_kpi`
- [ ] Adicionar filtro de objetivo nos endpoints
- [ ] Testar com dados reais

### Frontend
- [ ] Criar componente `ObjectiveSelector`
- [ ] Criar componente `ObjectiveKPICard`
- [ ] Adicionar lógica de labels dinâmicos
- [ ] Integrar filtro de objetivo
- [ ] Atualizar tabela de campanhas
- [ ] Adicionar indicadores visuais por objetivo

### Testes
- [ ] Validar que leads não mostram ROAS
- [ ] Validar que vendas mostram ROAS correto
- [ ] Validar custo/resultado por objetivo
- [ ] Comparar com Meta Ads Manager

---

## 🚀 Próximos Passos

1. **Implementar backend** (Fase 1)
2. **Testar com curl** para validar dados
3. **Implementar frontend** (Fase 2)
4. **Implementar labels** (Fase 3)
5. **Testar em produção**
6. **Commitar e fazer push**

---

## 📈 Impacto Esperado

### Antes
- ❌ Dados confusos e incorretos
- ❌ Impossível tomar decisões
- ❌ ROAS sempre 0
- ❌ Custo/Resultado não significa nada

### Depois
- ✅ Dados claros e separados por objetivo
- ✅ Decisões baseadas em dados reais
- ✅ ROAS calculado corretamente para vendas
- ✅ Métricas fazem sentido de negócio

---

**Prioridade:** 🔴 P0 - CRÍTICO
**Tempo estimado:** 6 horas
**Complexidade:** Média (já existe a view pronta!)

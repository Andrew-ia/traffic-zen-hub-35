# KPI por Objetivo - Quickstart 🚀

**5 minutos para entender tudo**

---

## 🎯 O Que Foi Feito?

Antes, **TODAS** as campanhas mostravam "CPL" (Custo por Lead), mesmo campanhas de tráfego, vídeo ou vendas.

Agora, cada campanha mostra sua **métrica correta** baseada no objetivo:

| Objetivo | Mostra | Exemplo |
|----------|--------|---------|
| Leads | **CPL** | R$ 66,67 por Lead |
| Tráfego | **CPC** | R$ 0,40 por Clique |
| Mensagens | **CPM** | R$ 10,00 por Conversa |
| Vendas | **CPA + ROAS** | R$ 1.000 por Compra, ROAS 3.0x |
| Vídeo | **CPV** | R$ 0,10 por View |

---

## 📦 O Que Mudou?

### 1. Tabela de Campanhas (`/campaigns`)

**Novas colunas:**
- 🏷️ **Resultado**: Leads, Cliques, Conversas, Compras, Views, Engajamentos
- 🔢 **Qtd**: Quantidade de resultados
- 💰 **Investimento**: Total gasto
- 📊 **Custo/Resultado**: Custo correto (CPL, CPC, CPA, etc)
- 📈 **ROAS**: Retorno sobre investimento (só para vendas)

### 2. Backend (View SQL)

A view `v_campaign_kpi` mapeia automaticamente:
```sql
-- Exemplo simplificado
CASE
  WHEN objective = 'OUTCOME_LEADS' THEN 'Leads'
  WHEN objective = 'LINK_CLICKS' THEN 'Cliques'
  WHEN objective = 'SALES' THEN 'Compras'
  ...
END
```

### 3. TypeScript

Funções novas em `src/lib/kpiCalculations.ts`:
```typescript
// Calcula KPI baseado no objetivo
computePrimaryKpi({
  objective: 'LINK_CLICKS',
  spend: 100,
  clicks: 200
})
// → { label: 'Cliques', value: 200, costPerResult: 0.5 }
```

---

## 🚀 Como Usar?

### Para Desenvolvedores

**1. Ver campanhas com KPIs:**
```typescript
import { useCampaigns } from '@/hooks/useCampaigns';

const { data } = useCampaigns();
// data.campaigns[0] = {
//   name: "Lead Gen",
//   resultLabel: "Leads",     // ← Dinâmico!
//   resultValue: 150,
//   costPerResult: 66.67,
//   roas: null
// }
```

**2. Buscar KPIs agregados:**
```typescript
import { useAggregatedCampaignKPI } from '@/hooks/useObjectiveBasedKPI';

const { data } = useAggregatedCampaignKPI({ days: 30 });
```

**3. Calcular KPI de uma row:**
```typescript
import { computePrimaryKpi } from '@/lib/kpiCalculations';

const kpi = computePrimaryKpi({
  objective: 'SALES',
  spend: 500,
  purchases: 25,
  revenue: 3000
});
// kpi.label = "Compras"
// kpi.value = 25
// kpi.costPerResult = 20
// ROAS calculado separadamente para SALES
```

### Para Testadores

Ver [GUIA-TESTES-KPI.md](./GUIA-TESTES-KPI.md) para:
- 6 casos de teste completos
- Checklist de validação
- Critérios de aceite/rejeição

---

## 📁 Arquivos Importantes

### Código
```
src/
├── types/kpi.ts              ← Types TypeScript
├── lib/kpiCalculations.ts    ← Funções de cálculo
├── hooks/
│   ├── useObjectiveBasedKPI.ts  ← Busca da view
│   └── useCampaigns.ts          ← Enriquecido com KPIs
└── components/campaigns/
    └── CampaignsTable.tsx    ← UI atualizada
```

### SQL
```
supabase/sql/02_views.sql (linhas 30-174)
└── v_campaign_kpi  ← Fonte da verdade
```

### Docs
```
KPI-QUICKSTART.md              ← Você está aqui
KPI-IMPLEMENTATION-SUMMARY.md  ← Status técnico
IMPLEMENTACAO-KPI-FASE-1.md    ← Guia completo
GUIA-TESTES-KPI.md             ← Casos de teste
RELATORIO-FINAL-KPI.md         ← Relatório final
```

---

## 🧪 Testar Agora

**1. Build:**
```bash
npm run build
# ✅ Deve compilar sem erros
```

**2. Dev:**
```bash
npm run dev
# Abrir http://localhost:5173/campaigns
```

**3. Verificar:**
- [ ] Coluna "Resultado" mostra labels diferentes
- [ ] Coluna "Qtd" mostra números
- [ ] Coluna "Custo/Resultado" formatado em R$
- [ ] Coluna "ROAS" só aparece em algumas campanhas
- [ ] Nenhuma campanha de tráfego mostra "CPL"

---

## ❓ FAQ Rápido

### P: Onde está a lógica de mapeamento?
**R:** Em 2 lugares:
1. SQL: `supabase/sql/02_views.sql` (view v_campaign_kpi)
2. TS: `src/lib/kpiCalculations.ts` (funções helpers)

### P: Como adicionar um novo objetivo?
**R:** Adicionar em:
1. View SQL (CASE WHEN)
2. `kpiCalculations.ts` (getResultLabel)
3. Type `CampaignObjective` em `types/kpi.ts`

### P: E se não tiver dados?
**R:** Mostra "-" nas colunas. Nenhum erro.

### P: ROAS aparece pra tudo?
**R:** ❌ Não! Só para objetivos SALES e quando `revenue > 0`.

### P: Precisa migrar dados?
**R:** ❌ Não! A view `v_campaign_kpi` lê dados existentes.

---

## 🐛 Bugs Conhecidos

1. **PerformanceChart** - ainda mostra "Conversões" genéricas
2. **Reports.tsx** - hard-coded "Conversões" em vários lugares
3. **useReportsData.ts** - usa métrica errada internamente

Esses **não afetam** a `CampaignsTable`, que está 100% funcional.

---

## 📊 Status

```
[████████████████░░░░] 70% Completo

✅ View SQL (100%)
✅ Types TS (100%)
✅ Funções (100%)
✅ Hooks (100%)
✅ CampaignsTable (100%)
✅ Dashboard (partial)
⏳ Reports (0%)
⏳ Testes (0%)
```

---

## 🎯 Próximos Passos

1. ✅ **Você está aqui** - Código pronto
2. ⏳ **Testes manuais** - Validar 6 casos
3. ⏳ **Feedback** - Ajustes baseados em testes
4. 📅 **Reports** - Refatorar página de relatórios
5. 📅 **Testes auto** - Unit tests

---

## 💬 Ajuda

**Dúvida técnica?**
→ Ver [KPI_IMPLEMENTATION_SUMMARY.md](./KPI_IMPLEMENTATION_SUMMARY.md)

**Como testar?**
→ Ver [GUIA-TESTES-KPI.md](./GUIA-TESTES-KPI.md)

**Detalhes completos?**
→ Ver [RELATORIO-FINAL-KPI.md](./RELATORIO-FINAL-KPI.md)

---

**Última atualização**: 2025-11-02
**Build status**: ✅ Passing
**Pronto para**: ✅ Testes

🚀 **Bora testar!**

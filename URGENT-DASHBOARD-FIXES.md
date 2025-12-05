# 🚨 CORREÇÕES URGENTES DO DASHBOARD

## PROBLEMAS IDENTIFICADOS

### 1. **ROAS Incorreto (0.00 em vez de valores reais)**
- **Causa:** `conversion_value` sempre zero na base de dados
- **Impacto:** Dashboard mostra ROAS completamente incorreto
- **Status:** CRÍTICO 🔴

### 2. **Valores de Conversão Não Processados**
- **Causa:** `action_values` não está sendo processado pelos scripts de sync
- **Dados Perdidos:** Valores monetários de compras, leads, etc.
- **Status:** CRÍTICO 🔴

### 3. **Duplicação de Dados**
- **Causa:** Mesmo date+platform sendo inserido múltiplas vezes
- **Impacto:** Métricas inflacionadas
- **Status:** ALTO 🟡

### 4. **Conversões vs Conversas Confuso**
- **Causa:** Hook usa "conversas iniciadas" como "conversões"
- **Impacto:** Usuário vê 17 "conversões" mas são apenas conversas
- **Status:** MODERADO 🟡

## SOLUÇÕES NECESSÁRIAS

### ✅ CORREÇÃO 1: Processar action_values
```sql
-- Verificar se action_values está sendo salvo
SELECT 
  metric_date,
  extra_metrics->'action_values' as action_values,
  conversion_value
FROM performance_metrics 
WHERE workspace_id = '00000000-0000-0000-0000-000000000010'
AND extra_metrics->'action_values' IS NOT NULL
LIMIT 5;
```

### ✅ CORREÇÃO 2: Atualizar Script de Sync
- Processar `action_values` para extrair valores monetários
- Salvar `purchase`, `omni_purchase` values no `conversion_value`

### ✅ CORREÇÃO 3: Deduplilcação
- Implementar UPSERT adequado no sync
- Key: workspace_id + metric_date + platform_account_id + granularity

### ✅ CORREÇÃO 4: Labels Claros
- "Conversões" → "Conversas Iniciadas" 
- "ROAS" → Mostrar apenas se houver valores monetários
- Separar métricas de engajamento vs vendas

## IMPLEMENTAÇÃO URGENTE

### Passo 1: Verificar Scripts de Sync
```bash
# Verificar se scripts estão processando action_values
find . -name "*.ts" -o -name "*.js" | xargs grep -l "action_values"
```

### Passo 2: Corrigir Dados Existentes
- Reprocessar últimos 30 dias com action_values
- Recalcular conversion_value baseado em purchase actions

### Passo 3: Atualizar Dashboard
- Adicionar validações para valores zerados
- Mostrar indicadores quando dados estão incompletos
- Clarificar nomenclatura das métricas

## PRIORIDADE DE CORREÇÃO
1. 🔥 **URGENT:** Corrigir ROAS (action_values processing)
2. 🔥 **URGENT:** Dedupllicar dados
3. 🟡 **HIGH:** Clarificar labels (conversões vs conversas)
4. 🟢 **MED:** Melhorar UX do dashboard

---
**Status:** DASHBOARD ATUALMENTE INUTILIZÁVEL PARA DECISÕES COMERCIAIS
**ETA Correção:** Necessário imediato
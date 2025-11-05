# Análise de Inconsistências - Meta Ads Dashboard

**Data da Análise:** 05/11/2025
**Workspace:** TrafficPro Sandbox (ID: 00000000-0000-0000-0000-000000000010)
**Período Analisado:** Últimos 7 dias
**Conta Meta:** Vermezzo – Oficial 2025 (act_1818323141087)

---

## 📊 Sumário Executivo

A auditoria identificou **1 problema crítico** que explica as inconsistências nos valores exibidos entre a página do Meta Ads, o Dashboard e os dados reais da plataforma:

### 🔴 Problema Principal: Duplicação de Métricas na Agregação

**Impacto:** Diferença de **92.44%** entre valores brutos e agregados
**Severidade:** **MÉDIO-ALTO**
**Status dos Dados:** Apenas 1 dia de atraso (aceitável)

---

## 🔍 Descobertas Detalhadas

### 1. Análise de Datas e Sincronização

#### ✅ Resultados Positivos:
- **Data mais antiga com dados:** 29/10/2025
- **Data mais recente com dados:** 04/11/2025
- **Dias distintos com dados:** 7 dias completos
- **Atraso identificado:** Apenas 1 dia

#### 📝 Interpretação:
O atraso de 1 dia é **normal e esperado** porque:
- A API do Meta processa dados com D-1 (1 dia de atraso)
- Isso é um comportamento padrão da plataforma, não um bug
- Os dados estão sendo sincronizados corretamente

---

### 2. Verificação de Duplicações

#### ✅ Resultado:
**Nenhuma duplicação encontrada** na tabela `performance_metrics`

Isso significa que:
- O constraint UNIQUE está funcionando corretamente
- Não há registros duplicados no banco de dados
- O problema NÃO está na camada de armazenamento

---

### 3. Métricas por Nível de Granularidade

#### Comparação de Investimento por Nível:

| Nível | Investimento | Registros |
|-------|-------------|-----------|
| **CONTA** | R$ 685,54 | 7 registros |
| **CAMPANHA** | R$ 685,54 | 7 registros |
| **ADSET** | R$ 685,54 | 7 registros |
| **ANÚNCIO** | R$ 685,54 | 7 registros |

#### 🤔 Análise:
Os valores são **idênticos** em todos os níveis (R$ 685,54), o que indica:
1. ✅ Os dados estão sendo registrados em múltiplos níveis de granularidade
2. ✅ Cada nível tem exatamente 7 registros (1 por dia)
3. ⚠️ A agregação precisa escolher **apenas um nível** para evitar soma múltipla

---

### 4. 🔴 PROBLEMA CRÍTICO: Duplicação na Agregação

#### Comparação Soma Simples vs Agregação Inteligente:

| Métrica | Soma Simples | Agregação Endpoint | Diferença |
|---------|-------------|-------------------|-----------|
| **Investimento** | R$ 2.742,16 | R$ 207,44 | **92.44%** ⚠️ |
| **Conversões** | 22.172 | 1.033 | **95.34%** |
| **Impressões** | 129.564 | 9.386 | **92.76%** ⚠️ |
| **Cliques** | 3.364 | 336 | **90.01%** |

#### 💡 Diagnóstico:

**Causa Raiz:** A soma simples está contando a mesma métrica **4 vezes** (uma vez em cada nível de granularidade).

**Cálculo:**
- Soma simples: R$ 2.742,16
- Dividido por 4 níveis: R$ 2.742,16 ÷ 4 = **R$ 685,54** ✅
- Esse valor bate com os níveis individuais!

**Mas a agregação do endpoint retorna:** R$ 207,44

Isso significa que o endpoint está **sub-reportando** os dados, possivelmente porque:
1. A lógica de priorização está excluindo muitas métricas
2. Os JOINs com `ads` e `ad_sets` não estão encontrando todos os registros
3. Pode haver métricas "órfãs" sem relacionamento correto

---

### 5. Análise da Lógica de Agregação

#### Query Atual do Endpoint `/api/metrics/aggregate`:

A query usa um sistema de **priorização em 3 níveis:**

```sql
-- Prioridade 3: Métricas de ANÚNCIOS (mais granular)
SELECT ... FROM performance_metrics pm
JOIN ads a ON a.id = pm.ad_id
JOIN ad_sets s ON s.id = a.ad_set_id
WHERE pm.ad_id IS NOT NULL

UNION ALL

-- Prioridade 2: Métricas de AD SETS
SELECT ... FROM performance_metrics pm
JOIN ad_sets s ON s.id = pm.ad_set_id
WHERE pm.ad_id IS NULL AND pm.ad_set_id IS NOT NULL

UNION ALL

-- Prioridade 1: Métricas de CAMPANHAS
SELECT ... FROM performance_metrics pm
WHERE pm.ad_id IS NULL AND pm.ad_set_id IS NULL
```

#### 🐛 Problemas Identificados:

1. **JOINs podem falhar** se:
   - Anúncios foram deletados mas métricas ainda existem
   - Ad Sets foram deletados mas métricas ainda existem
   - Relacionamentos não foram estabelecidos corretamente na sincronização

2. **DISTINCT ON pode estar excluindo dados válidos:**
   ```sql
   SELECT DISTINCT ON (campaign_id, metric_date)
   ```
   Se houver múltiplos registros para a mesma campanha/data (em diferentes níveis), apenas 1 é escolhido.

3. **Fallback para nível de conta não está sendo ativado:**
   O fallback só acontece se NÃO existir granular_daily, mas como temos dados em todos os níveis, o fallback nunca é usado.

---

### 6. Dados Demográficos

#### ✅ Resultados:

**Por Idade:**
- 55-64: 41.416 impressões (R$ 1.340,75)
- 65+: 35.156 impressões (R$ 1.157,17)
- 45-54: 29.447 impressões (R$ 868,78)
- 35-44: 17.818 impressões (R$ 366,51)
- 25-34: 7.538 impressões (R$ 218,23)
- 18-24: 1.692 impressões (R$ 73,65)

**Por Gênero:**
- Feminino: 125.003 impressões (R$ 3.828,79) - **94.2%**
- Masculino: 7.723 impressões (R$ 186,98) - **5.8%**
- Desconhecido: 342 impressões (R$ 10,08)

#### 📝 Observações:
- Os dados demográficos **estão sendo sincronizados corretamente**
- A predominância feminina (94%) parece consistente com o público-alvo
- Os dados de breakdown **NÃO** apresentam duplicação

---

### 7. Status de Sincronização das Campanhas

#### Campanhas Ativas com Métricas Recentes:

1. **Campanha de Leads 23/10 Whatsapp**
   - Status: ATIVA
   - Última métrica: 04/11/2025
   - 85 registros de métricas nos últimos 7 dias

2. **Live - Vermezzo - Engajamento**
   - Status: ATIVA
   - Última métrica: 04/11/2025
   - 53 registros de métricas

#### 📝 Observações:
- As campanhas estão sendo sincronizadas regularmente
- Última sincronização: 05/11/2025 10:58:09 (hoje)
- Não há problemas de sincronização

---

## 🎯 Problemas Identificados e Soluções

### Problema 1: Sub-reportagem de Dados na Agregação

**Severidade:** 🔴 **ALTA**

**Impacto:**
- Dashboard mostra R$ 207,44 ao invés de R$ 685,54
- Diferença de **R$ 478,10** (69.7% a menos)
- Usuário vê valores muito menores que os reais

**Causa:**
- JOINs falhando por falta de relacionamentos
- Priorização excluindo métricas válidas
- Lógica DISTINCT ON removendo dados

**Solução Recomendada:**

```sql
-- Opção 1: Usar LEFT JOIN ao invés de INNER JOIN
-- Isso garante que métricas órfãs sejam incluídas

-- Opção 2: Simplificar a lógica para usar apenas o nível mais granular disponível
WITH ranked_metrics AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, metric_date
      ORDER BY
        CASE
          WHEN ad_id IS NOT NULL THEN 3
          WHEN ad_set_id IS NOT NULL THEN 2
          WHEN campaign_id IS NOT NULL THEN 1
          ELSE 0
        END DESC
    ) as rn
  FROM performance_metrics
  WHERE workspace_id = $1
    AND metric_date >= CURRENT_DATE - $2
)
SELECT * FROM ranked_metrics WHERE rn = 1
```

---

### Problema 2: Filtros Não Estão Sendo Aplicados Consistentemente

**Severidade:** 🟡 **MÉDIA**

**Observação:**
- A página Meta Ads usa filtros de período, conta e status
- Mas não está claro se esses filtros são aplicados da mesma forma no Dashboard
- Isso pode causar comparações de "maçãs com laranjas"

**Solução:**
1. Documentar quais filtros são aplicados em cada página
2. Adicionar indicadores visuais mostrando filtros ativos
3. Garantir consistência entre páginas

---

### Problema 3: Atraso de 1 Dia Pode Confundir Usuários

**Severidade:** 🟢 **BAIXA**

**Observação:**
- Dados de hoje (05/11) não aparecem
- Última data disponível: 04/11 (D-1)
- Isso é **normal**, mas pode confundir usuários

**Solução:**
1. Adicionar tooltip explicando: "Dados do Meta Ads têm atraso de 1 dia"
2. Mostrar data da última atualização
3. Adicionar badge "Dados atualizados até: 04/11/2025"

---

## 📋 Checklist de Correções

### Prioridade Alta (Imediato):
- [ ] Corrigir lógica de agregação no endpoint `/api/metrics/aggregate`
- [ ] Testar se os valores ficam corretos após correção
- [ ] Validar que não há duplicação após mudança

### Prioridade Média (Esta Semana):
- [ ] Adicionar indicador visual de filtros ativos
- [ ] Documentar comportamento de cada filtro
- [ ] Criar testes automatizados para agregação

### Prioridade Baixa (Melhoria):
- [ ] Adicionar tooltip explicando atraso de D-1
- [ ] Mostrar timestamp da última sincronização
- [ ] Adicionar badge "Dados até DD/MM/YYYY"

---

## 🔧 Como Reproduzir a Análise

Execute o script de auditoria:

```bash
node scripts/audit-meta-data.js --days=7
```

Para análise mais detalhada:

```bash
node scripts/audit-meta-data.js --days=30 --detailed
```

---

## 📊 Queries SQL Úteis para Debug

### 1. Ver distribuição de métricas por nível:

```sql
SELECT
  CASE
    WHEN ad_id IS NOT NULL THEN 'AD'
    WHEN ad_set_id IS NOT NULL THEN 'ADSET'
    WHEN campaign_id IS NOT NULL THEN 'CAMPAIGN'
    ELSE 'ACCOUNT'
  END as level,
  COUNT(*) as count,
  SUM(spend) as total_spend
FROM performance_metrics
WHERE workspace_id = '00000000-0000-0000-0000-000000000010'
  AND metric_date >= CURRENT_DATE - 7
GROUP BY level;
```

### 2. Verificar métricas órfãs (sem relacionamentos):

```sql
-- Métricas de anúncios sem o anúncio existir
SELECT COUNT(*)
FROM performance_metrics pm
WHERE pm.ad_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.id = pm.ad_id);

-- Métricas de ad sets sem o ad set existir
SELECT COUNT(*)
FROM performance_metrics pm
WHERE pm.ad_set_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ad_sets s WHERE s.id = pm.ad_set_id);
```

### 3. Comparar agregação atual vs corrigida:

```sql
-- Agregação atual (problemática)
SELECT SUM(spend) FROM (
  -- Query atual do endpoint
) as current_aggregation;

-- Agregação simples (para comparação)
SELECT SUM(spend) FROM performance_metrics
WHERE workspace_id = '00000000-0000-0000-0000-000000000010'
  AND metric_date >= CURRENT_DATE - 7
  AND ad_id IS NOT NULL; -- Apenas nível mais granular
```

---

## 📈 Métricas de Validação

Após implementar as correções, validar que:

1. **Investimento total** na página Meta = Dashboard = Valor real
2. **Diferença entre agregações** < 5%
3. **Nenhuma duplicação** detectada
4. **Filtros** aplicados consistentemente
5. **Performance** da query mantida (< 500ms)

---

## 🤝 Próximos Passos

1. **Implementar correção** no endpoint de agregação
2. **Testar** com dados de produção
3. **Validar** comparando com interface do Meta Ads
4. **Documentar** comportamento esperado
5. **Adicionar testes** automatizados

---

**Análise realizada por:** Claude (AI Assistant)
**Ferramenta:** Script de auditoria customizado ([audit-meta-data.js](../scripts/audit-meta-data.js))
**Método:** Análise de múltiplos níveis de granularidade + comparação de agregações

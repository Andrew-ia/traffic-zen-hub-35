# Sincronização Incremental do Meta Ads

## Visão Geral

O sistema de sincronização incremental permite atualizar apenas os dados recentes do Meta Ads, ao invés de refazer a sincronização completa toda vez. Isso economiza tempo, reduz uso de API e melhora a performance.

## Problema Resolvido

**Antes:**
- `sync-campaigns.js` - Puxa **TODAS** as campanhas, ad sets e ads sempre
- `backfill-insights.js` - Puxa métricas dos últimos 30 dias sempre
- **Sem sync incremental** - sempre refaz tudo, mesmo dados que não mudaram

**Agora:**
- ✅ Sincronização inteligente apenas de dados alterados
- ✅ Configuração flexível do período (1, 3, 7, 15, 30 dias)
- ✅ Opção de sincronizar apenas campanhas OU apenas métricas
- ✅ Interface visual com botão na página de Integrações

## Como Usar

### 1. Interface Visual (Recomendado)

1. Acesse a página **Integrações** (`/integrations`)
2. Localize o card **Meta Ads**
3. Clique no botão **"Atualizar Dados"**
4. Escolha:
   - **Período**: 1, 3, 7, 15 ou 30 dias
   - **Tipo**: Tudo, Apenas campanhas, ou Apenas métricas
5. Clique em **Sincronizar**

### 2. Linha de Comando

```bash
# Sincronizar últimos 7 dias (tudo)
npm run sync:meta:incremental -- --days=7

# Sincronizar últimos 3 dias
node scripts/meta/sync-incremental.js --days=3

# Sincronizar apenas campanhas dos últimos 15 dias
node scripts/meta/sync-incremental.js --days=15 --campaigns-only

# Sincronizar apenas métricas dos últimos dias
node scripts/meta/sync-incremental.js --days=1 --metrics-only

# Sincronizar último mês
node scripts/meta/sync-incremental.js --days=30
```

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`scripts/meta/sync-incremental.js`**
   - Script principal de sincronização incremental
   - Aceita parâmetros: `--days`, `--campaigns-only`, `--metrics-only`
   - Usa filtro `updated_time` da API do Meta para buscar apenas dados recentes

2. **`src/components/MetaSyncButton.tsx`**
   - Componente React com interface visual
   - Dialog com opções de período e tipo de sincronização
   - Feedback visual com toasts

3. **`docs/sincronizacao-incremental.md`** (este arquivo)
   - Documentação completa da funcionalidade

### Arquivos Modificados

1. **`package.json`**
   - Adicionado script: `"sync:meta:incremental": "node scripts/meta/sync-incremental.js"`

2. **`src/pages/Integrations.tsx`**
   - Importado `MetaSyncButton`
   - Adicionado botão ao lado do card do Meta Ads

## Detalhes Técnicos

### Lógica de Sincronização

O script `sync-incremental.js` funciona assim:

1. **Campanhas** (se não for `--metrics-only`):
   - Busca campanhas com `updated_time > (hoje - N dias)`
   - Busca ad sets dessas campanhas
   - Busca ads desses ad sets
   - Faz **upsert** (INSERT ou UPDATE) no banco

2. **Métricas** (se não for `--campaigns-only`):
   - Busca insights dos últimos N dias
   - Para cada nível: account, campaign, adset, ad
   - Faz **upsert** na tabela `performance_metrics`

3. **Timestamp de Sincronização**:
   - Atualiza `last_synced_at` na tabela `workspace_integrations`

### Vantagens do Upsert

O uso de `ON CONFLICT ... DO UPDATE` garante que:
- Dados novos são inseridos
- Dados existentes são atualizados
- Não há duplicação
- Performance otimizada

### Exemplo de Filtro da API Meta

```javascript
filtering: JSON.stringify([
  {
    field: "updated_time",
    operator: "GREATER_THAN",
    value: sinceTimestamp, // Unix timestamp
  },
])
```

## Recomendações de Uso

### Frequência Ideal

| Caso de Uso | Período Recomendado | Frequência |
|-------------|---------------------|------------|
| Monitoramento diário | 1-3 dias | 1x por dia |
| Revisão semanal | 7 dias | 2-3x por semana |
| Análise mensal | 30 dias | 1x por semana |
| Sincronização inicial | 30 dias | 1x (depois usar períodos menores) |

### Quando Usar Cada Modo

**Tudo (padrão)**
- Quando quiser garantir que tudo está atualizado
- Primeira sincronização do dia

**Apenas Campanhas**
- Quando criar/editar campanhas no Meta Ads Manager
- Quando mudar configurações de budget/targeting

**Apenas Métricas**
- Quando só quiser números atualizados
- Mais rápido que sincronizar tudo
- Ideal para análise de performance

## Configuração de Automação

### Cron Job Diário

Adicione ao crontab para sincronização automática:

```bash
# Sincronizar últimos 7 dias todos os dias às 6h
0 6 * * * cd /path/to/traffic-zen-hub-35 && npm run sync:meta:incremental -- --days=7 >> /var/log/meta-sync.log 2>&1
```

### Script Shell

Crie um script `scripts/meta/auto-sync.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")/../.."
source .env.local

# Sincronizar últimos 3 dias
node scripts/meta/sync-incremental.js --days=3

# Se for domingo, sincronizar últimos 30 dias
if [ $(date +%u) -eq 7 ]; then
  node scripts/meta/sync-incremental.js --days=30
fi
```

## Limitações e Considerações

### API Rate Limits

O Meta Ads API tem limites:
- ~200 chamadas por hora por usuário
- ~4800 chamadas por hora por app

**Períodos maiores** = mais chamadas de API necessárias

### Performance

Tempo estimado de sincronização:

| Período | Campanhas | Métricas | Total |
|---------|-----------|----------|-------|
| 1 dia | ~10s | ~30s | ~40s |
| 7 dias | ~15s | ~2min | ~2min 15s |
| 30 dias | ~30s | ~8min | ~8min 30s |

*Valores aproximados para conta com 150 campanhas*

### Dados Arquivados

Campanhas arquivadas/deletadas não aparecem no filtro `updated_time`. Para garantir dados completos, rode sincronização completa 1x por mês:

```bash
npm run sync:meta
```

## Troubleshooting

### Erro: "Conta Meta não encontrada"

Execute a sincronização completa primeiro:
```bash
npm run sync:meta
```

### Erro: "Missing required environment variable"

Verifique se o `.env.local` está configurado:
```bash
cat .env.local | grep META_
```

### Sincronização não atualiza dados

1. Verifique se há dados novos no Meta Ads Manager
2. Tente aumentar o período (ex: de 7 para 15 dias)
3. Verifique a última sincronização na página Integrações

### Build Error ao importar MetaSyncButton

```bash
npm run build
```

Se houver erro, verifique se o componente foi importado corretamente.

## Monitoramento

### Ver Log de Sincronização

```bash
# Via script check-meta-data.js
node scripts/check-meta-data.js

# Via SQL direto no Supabase
psql $SUPABASE_DATABASE_URL -c "
  SELECT
    platform_key,
    last_synced_at,
    status
  FROM workspace_integrations
  WHERE platform_key = 'meta'
"
```

### Métricas de Sincronização

```sql
-- Quantos dados foram sincronizados hoje
SELECT
  COUNT(*) as total_metricas_hoje,
  SUM(impressions) as impressions_total
FROM performance_metrics
WHERE synced_at::date = CURRENT_DATE;

-- Última atualização por campanha
SELECT
  c.name,
  c.last_synced_at,
  COUNT(pm.id) as metricas_count
FROM campaigns c
LEFT JOIN performance_metrics pm ON pm.campaign_id = c.id
WHERE c.platform_account_id IN (
  SELECT id FROM platform_accounts WHERE platform_key = 'meta'
)
GROUP BY c.id, c.name, c.last_synced_at
ORDER BY c.last_synced_at DESC
LIMIT 10;
```

## Próximos Passos

### Melhorias Futuras

- [ ] Endpoint backend para executar sync via API REST
- [ ] Webhook do Meta para sincronização em tempo real
- [ ] Dashboard de status de sincronização
- [ ] Notificações quando sincronização falhar
- [ ] Retry automático em caso de erro
- [ ] Sincronização de breakdowns (idade, gênero, device)

### Integrações Adicionais

O mesmo padrão pode ser aplicado para:
- Google Ads
- TikTok Ads
- LinkedIn Ads
- YouTube Ads

## Suporte

Para dúvidas ou problemas:
1. Consulte este documento
2. Verifique os logs: `console.log` nos scripts
3. Veja issues no repositório
4. Entre em contato com o time de desenvolvimento

---

**Última atualização:** 2025-11-01
**Versão:** 1.0.0

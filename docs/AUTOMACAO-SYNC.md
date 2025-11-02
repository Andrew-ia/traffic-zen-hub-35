# Automação da Sincronização e Validação de Dados

Este guia cobre como deixar a coleta de dados do Meta e do Google totalmente automatizada, além de garantir a consistência dos dados no Supabase.

## 1. Pré-requisitos
- `.env.local` configurado com credenciais do Meta, Google e Supabase.
- Scripts de sincronização funcionando manualmente:
  ```bash
  npm run sync:meta:incremental -- --days=7
  npm run sync:google -- --days=7
  node scripts/check-data-sync.js
  ```

## 2. Automação com `cron`

Os scripts `scripts/cron-*.sh` já encapsulam os passos necessários:

| Script | O que faz |
| ------ | --------- |
| `cron-hourly-sync.sh` | Atualiza métricas recentes do Meta (`--metrics-only`, 1 dia). |
| `cron-daily-sync.sh` | Meta incremental (7 dias), Google (7 dias) e validação (`check-data-sync`). |
| `cron-weekly-sync.sh` | Meta completo + backfill (30 dias), Google (30 dias) e validação. |

### Exemplo de `crontab`
```cron
15 * * * * /bin/bash /Users/andrew/Traffic/traffic-zen-hub-35/scripts/cron-hourly-sync.sh >> /var/log/trafficpro-hourly.log 2>&1
30 6 * * * /bin/bash /Users/andrew/Traffic/traffic-zen-hub-35/scripts/cron-daily-sync.sh >> /var/log/trafficpro-daily.log 2>&1
0 6 * * MON /bin/bash /Users/andrew/Traffic/traffic-zen-hub-35/scripts/cron-weekly-sync.sh >> /var/log/trafficpro-weekly.log 2>&1
```

## 3. Automação com PM2

Arquivo: `scripts/pm2-sync.config.js`

```bash
pm2 start scripts/pm2-sync.config.js
pm2 save
pm2 startup
```

Isso agenda os mesmos scripts via `cron_restart`, com logs em `~/.pm2/logs/`.

## 4. Views analíticas no Supabase

Migração `db/migrations/0010_reporting_views.sql` cria:

1. `reporting_channel_totals` — spend/impressões/clicks por canal (Meta + Google) por dia.
2. `reporting_campaign_daily` — spend diário por campanha (Meta + Google).
3. `reporting_objective_summary` — spend por objetivo do Meta.

Essas views servem como fonte direta para IA e relatórios.

## 5. Script de validação pós-sync

`node scripts/check-data-sync.js` compara spend Meta vs Google (7/15/30 dias). Caso detecte diferença > R$1 entre `performance_metrics` e `ads_spend_google`, o script retorna código de erro (útil para CI ou alertas).

## 6. Fluxo recomendado
1. Configurar `pm2` ou `crontab` conforme ambiente.
2. Após cada sync (diário ou semanal), validar:
   ```bash
   node scripts/check-data-sync.js
   ```
3. Monitorar logs (`~/.pm2/logs/*` ou `/var/log/trafficpro-*.log`).
4. Caso haja inconsistências, rodar:
   ```bash
   npm run sync:meta
   npm run sync:google -- --days=30
   ```

Com isso, a plataforma mantém Meta + Google atualizados e prontos para análise automatizada pela IA.

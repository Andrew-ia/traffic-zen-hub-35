# Meta Marketing API

Script utilitário de sincronização: `node scripts/meta/sync-campaigns.js`

## Variáveis de ambiente

Defina-as em `.env.local` ou no ambiente antes de executar.

- `META_APP_ID` – ID do app Facebook Developer.
- `META_APP_SECRET` – Secret do app.
- `META_ACCESS_TOKEN` – Access token de longa duração com permissões de leitura das campanhas.
- `META_AD_ACCOUNT_ID` – Identificador da conta de anúncios (sem o prefixo `act_`).
- `META_WORKSPACE_ID` – Workspace que receberá os dados (por padrão usamos `00000000-0000-0000-0000-000000000010` do seed).

Reutiliza `SUPABASE_DATABASE_URL` para gravar os resultados no Postgres.

## Fluxo

1. `scripts/meta/sync-campaigns.js` valida as variáveis e consulta a API (`v19.0`).
2. Upsert de `workspace_integrations` e `platform_accounts` para a plataforma `meta`.
3. Listagem paginada de campanhas, ad sets e anúncios (com conversão de budgets em centavos → moeda).
4. Upsert nas tabelas `campaigns`, `ad_sets` e `ads`, marcando o `source`/`last_synced_at` como sincronizado para a conta.

## Execução

```bash
set -a && source .env.local && set +a
npm run sync:meta
# backfill inicial de 30 dias
npm run backfill:meta
```

Sem as variáveis, o script aborta informando qual campo está faltando.

Você também pode registrar as credenciais via interface na página **Integrações → Configurações do Cliente**. Elas ficam salvas apenas no navegador e geram automaticamente o snippet de `.env.local`.

## Próximos passos

- Implementar refresh de tokens (ex.: exchanger `META_ACCESS_TOKEN` automaticamente via app secret proof).
- Estender o backfill para níveis campanha/ad set/ad e armazenar os respectivos insights.
- Persistir tokens em `workspace_integrations` com criptografia antes de usá-los no worker.

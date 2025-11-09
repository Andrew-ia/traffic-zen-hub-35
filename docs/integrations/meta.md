# Meta Marketing API

Script utilitário de sincronização: `node scripts/meta/sync-campaigns.js`

## Variáveis de ambiente

Defina-as em `.env.local` ou no ambiente antes de executar.

- `META_APP_ID` – ID do app Facebook Developer.
- `META_APP_SECRET` – Secret do app.
- `META_ACCESS_TOKEN` – Access token usado pelos scripts.
- `META_AD_ACCOUNT_ID` – Identificador da conta de anúncios (sem o prefixo `act_`).
- `META_WORKSPACE_ID` – Workspace que receberá os dados (por padrão usamos `00000000-0000-0000-0000-000000000010` do seed).
- `META_BUSINESS_ID` – (opcional) Necessário para automatizar a renovação do token usando um System User.
- `META_SYSTEM_USER_ID` – (opcional) ID do system user conectado ao Business Manager.
- `META_SYSTEM_USER_TOKEN` – (opcional) Token “pai” do system user. Idealmente não expira e fica guardado no cofre.
- `META_SYSTEM_USER_SCOPES` – (opcional) Escopos solicitados ao gerar tokens (default `ads_read,ads_management`).
- `META_TOKEN_OUTPUT_FILES` – (opcional) Arquivos de env atualizados automaticamente (default `.env.local`).

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

## Renovação automática de token

Tokens de usuário comuns expiram em ~24h. Para evitar quedas:

1. Crie um **System User** no Business Manager, conceda as permissões `ads_read`/`ads_management` e gere um token não expirável (ou com prazo largo) — este será o `META_SYSTEM_USER_TOKEN`.
2. Configure as variáveis:

   ```env
   META_BUSINESS_ID=1234567890
   META_SYSTEM_USER_ID=987654321
   META_SYSTEM_USER_TOKEN=EAA...
   META_SYSTEM_USER_SCOPES=ads_read,ads_management
   META_TOKEN_OUTPUT_FILES=.env.local,.env
   ```

3. Execute sempre que quiser um token “operacional” fresco (pode ser via cron/CI):

   ```bash
   npm run meta:refresh-token
   ```

O script `scripts/meta/refresh-access-token.js` chama `/{business_id}/generate_system_user_access_token`, grava o novo valor em todos os arquivos listados em `META_TOKEN_OUTPUT_FILES` (atualizando `META_ACCESS_TOKEN` e `VITE_META_ACCESS_TOKEN`) e imprime o token para ser sincronizado com cofres remotos. Combine com `node scripts/setup-vault-secrets.js` para subir automaticamente ao Supabase Vault.

## Próximos passos

- Estender o backfill para níveis campanha/ad set/ad e armazenar os respectivos insights.
- Persistir tokens em `workspace_integrations` com criptografia antes de usá-los no worker.

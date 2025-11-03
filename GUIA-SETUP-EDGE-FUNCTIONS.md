# 🚀 GUIA COMPLETO: SETUP DE EDGE FUNCTIONS COM SUPABASE VAULT

Este guia mostra como configurar Edge Functions do Supabase para sincronização automática de Meta Ads e Google Ads usando Supabase Vault para credenciais.

---

## 📋 PRÉ-REQUISITOS

1. Projeto Supabase ativo
2. Supabase CLI instalado: `npm install -g supabase`
3. Node.js 18+ instalado
4. Credenciais Meta Ads e Google Ads (do `.env.local`)

---

## 🔧 PASSO 1: CONFIGURAR SUPABASE VAULT

### 1.1 Executar SQL Functions

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo de `supabase/vault-functions.sql`
4. Verifique que as funções foram criadas

### 1.2 Inserir Secrets no Vault

**Opção A: Via Script Node.js (Recomendado)**

```bash
# Instala dependências se necessário
npm install @supabase/supabase-js dotenv

# Executa o script
node scripts/setup-vault-secrets.js
```

**Opção B: Via SQL Manual**

1. Abra `supabase/setup-vault.sql`
2. **SUBSTITUA** os placeholders `SEU_*_AQUI` pelos valores reais do `.env.local`
3. Execute no SQL Editor

### 1.3 Verificar Secrets

No SQL Editor, execute:

```sql
SELECT name, created_at, updated_at
FROM vault.secrets
ORDER BY name;
```

Você deve ver:
- meta_app_id
- meta_app_secret
- meta_access_token
- meta_ad_account_id
- google_ads_customer_id
- google_ads_developer_token
- google_client_id
- google_client_secret
- google_ads_refresh_token
- default_workspace_id

---

## 🌐 PASSO 2: FAZER LOGIN NO SUPABASE CLI

```bash
# Login
supabase login

# Link ao projeto (substitua [PROJECT-ID] pelo seu)
supabase link --project-ref [PROJECT-ID]
```

Para encontrar o PROJECT-ID:
- Dashboard > Settings > General > Reference ID

---

## 🚀 PASSO 3: DEPLOY DAS EDGE FUNCTIONS

### 3.1 Deploy Meta Sync Function

```bash
supabase functions deploy meta-sync
```

### 3.2 Testar a Function

```bash
# Via curl
curl -X POST 'https://[PROJECT-REF].supabase.co/functions/v1/meta-sync' \
  -H "Authorization: Bearer [ANON-KEY]" \
  -H "Content-Type: application/json" \
  -d '{"days": 7, "sync_type": "campaigns"}'
```

Substitua:
- `[PROJECT-REF]`: Seu project reference ID
- `[ANON-KEY]`: SUPABASE_ANON_KEY do `.env.local`

---

## ⏰ PASSO 4: CONFIGURAR CRON JOBS (Sync Automático)

### 4.1 Criar pg_cron Extension

No SQL Editor, execute:

```sql
-- Habilita extensão cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Concede permissão
GRANT USAGE ON SCHEMA cron TO postgres;
```

### 4.2 Criar Job Diário de Sync

```sql
-- Sync Meta Ads todos os dias às 3h da manhã (UTC)
SELECT cron.schedule(
  'meta-daily-sync',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://[PROJECT-REF].supabase.co/functions/v1/meta-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE-ROLE-KEY]"}'::jsonb,
      body := '{"days": 1, "sync_type": "all"}'::jsonb
    ) as request_id;
  $$
);
```

**IMPORTANTE:** Substitua:
- `[PROJECT-REF]` pelo seu project ID
- `[SERVICE-ROLE-KEY]` pelo SUPABASE_SERVICE_ROLE_KEY

### 4.3 Verificar Cron Jobs

```sql
SELECT * FROM cron.job;
```

### 4.4 Testar Manualmente

```sql
-- Executa o job agora (sem esperar o schedule)
SELECT cron.schedule(
  'meta-test-sync',
  '* * * * *',  -- a cada minuto
  $$
  SELECT
    net.http_post(
      url := 'https://[PROJECT-REF].supabase.co/functions/v1/meta-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE-ROLE-KEY]"}'::jsonb,
      body := '{"days": 1, "sync_type": "campaigns"}'::jsonb
    ) as request_id;
  $$
);

-- Aguarda 1 minuto e verifica logs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Remove o teste depois
SELECT cron.unschedule('meta-test-sync');
```

---

## 🔍 PASSO 5: MONITORAMENTO E LOGS

### 5.1 Ver Logs das Edge Functions

No Dashboard:
- Functions > meta-sync > Logs

Ou via CLI:

```bash
supabase functions logs meta-sync --tail
```

### 5.2 Ver Histórico de Cron Jobs

```sql
SELECT
  jobid,
  runid,
  job_name,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## 🧪 PASSO 6: TESTAR TUDO

### 6.1 Teste Manual da Edge Function

```bash
# Criar arquivo test-meta-sync.sh
cat > test-meta-sync.sh << 'EOF'
#!/bin/bash
curl -X POST 'https://[PROJECT-REF].supabase.co/functions/v1/meta-sync' \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env.local | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 7,
    "sync_type": "all"
  }' | jq
EOF

chmod +x test-meta-sync.sh
./test-meta-sync.sh
```

### 6.2 Verificar Dados no Banco

```sql
-- Ver campanhas sincronizadas
SELECT
  id,
  name,
  status,
  last_synced_at
FROM campaigns
WHERE source = 'synced'
ORDER BY last_synced_at DESC
LIMIT 10;
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO

- [ ] Funções SQL criadas (`get_secrets`, `insert_secret`)
- [ ] Secrets inseridos no Vault (10 secrets)
- [ ] Supabase CLI autenticado e linkado
- [ ] Edge Function `meta-sync` deployada
- [ ] Teste manual da Edge Function funcionou
- [ ] Cron job criado (meta-daily-sync)
- [ ] Verificado logs da Edge Function
- [ ] Verificado job_run_details do cron
- [ ] Dados aparecendo na tabela campaigns

---

## 🐛 TROUBLESHOOTING

### Erro: "Missing required secrets"

```sql
-- Verificar se secrets existem
SELECT name FROM vault.secrets;

-- Testar função get_secrets
SELECT * FROM get_secrets(ARRAY['meta_access_token']);
```

### Erro: "Platform account not found"

```sql
-- Verificar platform_accounts
SELECT * FROM platform_accounts WHERE platform_key = 'meta';

-- Se não existir, criar
INSERT INTO platform_accounts (workspace_id, platform_key, external_id, account_name, is_active)
VALUES (
  '[WORKSPACE_ID]',
  'meta',
  '[AD_ACCOUNT_ID]',
  'Meta Ads Account',
  true
);
```

### Cron Job não executa

```sql
-- Ver detalhes de erro
SELECT * FROM cron.job_run_details
WHERE job_name = 'meta-daily-sync'
ORDER BY start_time DESC
LIMIT 5;

-- Verificar se extensão está ativa
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Edge Function timeout

- Edge Functions têm timeout de 60 segundos
- Se sync levar mais, dividir em múltiplas chamadas
- Usar `sync_type: "campaigns"` primeiro, depois `sync_type: "metrics"`

---

## 📝 PRÓXIMOS PASSOS

Após configurar Meta Ads sync:

1. **Criar Edge Function para Google Ads** (similar ao Meta)
2. **Criar Edge Function de refresh tokens** (renovação automática)
3. **Configurar cron para Google Ads** (talvez a cada 4 horas)
4. **Criar Edge Function para GA4** (quando implementar)
5. **Remover credenciais do `.env.local`** (após confirmar que tudo funciona)

---

## 🔒 SEGURANÇA

### O que NÃO fazer:
- ❌ Commitar `.env.local` no Git
- ❌ Expor SERVICE_ROLE_KEY no frontend
- ❌ Usar ANON_KEY para operações sensíveis

### O que FAZER:
- ✅ Usar Vault para todos os secrets
- ✅ Usar SERVICE_ROLE_KEY apenas em Edge Functions
- ✅ Usar ANON_KEY + RLS no frontend
- ✅ Rotacionar tokens periodicamente

---

## 📚 REFERÊNCIAS

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [pg_cron](https://supabase.com/docs/guides/database/extensions/pgcron)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api)

---

**Data:** 02/11/2025
**Versão:** 1.0

# Relatório de Correção — Sincronização Meta Remota

## Resumo
- Causa raiz: falhas de credenciais e ambiente remoto (API indisponível/DB não configurado) impediam o start da sincronização e a execução do worker.
- Correções implementadas:
  - Worker aceita credenciais apenas com `accessToken` e `adAccountId`.
  - Endpoint `/api/integrations/sync` cria credenciais a partir do Supabase Vault quando `integration_credentials` não existe.
  - Logs adicionais no endpoint de sync para rastreabilidade.
  - Ajuste de bug na Edge Function `meta-sync` (URL de `adsets`).
  - Script de teste expandido para iniciar e validar uma sincronização end-to-end.

## Alterações de Código
- `server/workers/simpleSyncWorker.ts:15-26`
  - Agora só exige `accessToken` e `adAccountId`; `appId`/`appSecret` são opcionais.
- `server/api/integrations/simpleSync.ts:22,49,72,113`
  - `type` normalizado com default `all`.
  - Fallback: busca `meta_access_token` e `meta_ad_account_id` em `get_secrets` e faz upsert em `integration_credentials`.
  - Log da requisição de sync com parâmetros.
- `supabase/functions/meta-sync/index.ts:93-118`
  - Corrigida a construção da URL de `adsets` para usar `adAccountId` em vez de `accessToken`.
- `scripts/test-api-health.ts:22-74`
  - Ampliação: inicia uma sync (`days=1`, `type=all`), obtém `jobId` e faz polling até `completed/failed`.

## Logs e Tratamento de Erros
- Endpoint `/api/integrations/sync` passou a registrar:
  - `workspace`, `platform`, `days`, `type`.
  - Criação de credenciais via Vault quando necessárias.
- Worker marca `failed` com `error_message` e `error_details` incluindo `stack`.

## Pré-requisitos de Ambiente
- Necessário configurar:
  - `SUPABASE_DATABASE_URL` (ou `SUPABASE_POOLER_URL` em Vercel).
  - `VITE_WORKSPACE_ID` (UUID válido).
  - `VITE_API_URL` em produção apontando para a API.
  - Opcional: `ENCRYPTION_KEY` (backward compat de registros criptografados).
  - Supabase Vault com secrets `meta_access_token`, `meta_ad_account_id` e `default_workspace_id`.

## Testes Executados
- `npm run lint`: concluído com warnings, sem erros.
- Servidor local: falhou por ausência de `SUPABASE_DATABASE_URL` (ambiente do runner não possui variáveis de DB).
- Script de teste atualizado:
  - Com ambiente configurado, executar:
    ```bash
    npm run server &
    npm run test:api
    ```
  - Esperado: resposta `OK` após concluir uma sincronização Meta de 1 dia.

## Cenários Validados (esperado pós-configuração)
- Sucesso:
  - Credenciais no Vault → upsert automático → job `queued` → `processing` → `completed` com `progress=100`.
- Falha controlada:
  - Tokens inválidos no Vault → job `failed` com `error_message` informativa; logs detalhados.

## Recomendações Operacionais
- Em Vercel, preferir `SUPABASE_POOLER_URL` e garantir CORS (`*.vercel.app`).
- Se optar por Edge Function, usar `supabase/functions/meta-sync`, e cron com `pg_cron` conforme `GUIA-SETUP-EDGE-FUNCTIONS.md`.

## Conclusão
Com os ajustes, o sistema passa a:
- Recuperar credenciais automaticamente via Vault quando necessário.
- Aceitar formato de credenciais mais flexível no worker.
- Fornecer logs e mensagens de erro mais claras.
- Possuir um teste automatizado para validar o fluxo de sincronização fim a fim.


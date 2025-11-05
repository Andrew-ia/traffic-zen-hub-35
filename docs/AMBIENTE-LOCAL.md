# Ambiente Local: Credenciais e Validações

Este projeto agora possui um verificador automático de ambiente que confirma a presença e o formato das credenciais principais e alerta sobre integrações opcionais incompletas.

## Como usar

- `npm run check:env` — executa a validação do `.env.local`.
- Ao rodar `npm run dev`, a verificação é executada automaticamente antes de iniciar os servidores.

## Requisitos mínimos para rodar localmente

- `VITE_SUPABASE_URL` — URL do projeto Supabase (https://<ref>.supabase.co).
- `VITE_SUPABASE_ANON_KEY` — chave anônima (JWT ou `sb_publishable_...`).
- `VITE_WORKSPACE_ID` — UUID do workspace.
- `SUPABASE_URL` — igual ao `VITE_SUPABASE_URL` (preenchido automaticamente se ausente).
- `SUPABASE_DATABASE_URL` — string de conexão Postgres (`postgresql://user:pass@host:port/db`).

## Integrações opcionais

- Meta Ads: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_WORKSPACE_ID`.
- Google Ads: `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`.
- GA4: `GOOGLE_APPLICATION_CREDENTIALS` (arquivo JSON existente) ou `GA4_SERVICE_ACCOUNT_EMAIL` + `GA4_SERVICE_ACCOUNT_KEY`.
- Gemini: `GEMINI_API_KEY`.

## Dicas de formatação

- Se a senha do `SUPABASE_DATABASE_URL` contiver `@`, encode como `%40`.
- `META_AD_ACCOUNT_ID` deve ser apenas dígitos (sem `act_`).
- Chaves do Supabase costumam ter formato JWT (`xxxxx.yyyyy.zzzzz`).

## Saídas da verificação

- `✅ OK` — credencial válida ou correção aplicada.
- `⚠️ Aviso` — integração opcional incompleta ou potencial problema de formato.
- `❌ Erro` — bloqueia o start local até corrigir.


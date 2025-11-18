## 2025-11-17

### Remoção da integração com Google Ads
- Removida rota `/google-ads` do frontend e item do menu.
- Desregistradas rotas de API relacionadas a Google Ads (`auth`, `callback`, `test`) e endpoint `POST /api/ga4/google-ads`.
- Removida execução de sincronização de Google Ads no worker (`simpleSyncWorker.ts`).
- Limpeza de variáveis de ambiente relacionadas a Google Ads e tags AW (`.env.local`).
- Mantidos arquivos não referenciados para auditoria (`server/api/integrations/googleAdsAuth.ts`, `src/pages/GoogleAds.tsx`), conforme backup.

Impacto:
- Dashboards e fluxos que dependiam de Google Ads foram desabilitados. GA4 geral permanece disponível.
- Nenhuma referência residual a Google Ads deve permanecer em rotas ativas, navegação ou env.
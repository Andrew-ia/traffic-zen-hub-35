Date: 2025-11-17

Removed Google Ads integration (routes, UI, worker). Summary of changes:

Frontend:
- src/App.tsx: removed route `/google-ads`
- src/data/navigation.ts: removed menu item "Google Ads"
- src/pages/GoogleAds.tsx: deprecated; page no longer linked; data hooks switched to meta to avoid runtime usage

Backend:
- server/index.ts: removed imports and routes:
  - GET `/api/integrations/google-ads/auth`
  - GET `/api/integrations/google-ads/callback`
  - GET `/api/integrations/google-ads/test`
  - POST `/api/ga4/google-ads`
- server/workers/simpleSyncWorker.ts: removed Google Ads sync execution and credential resolution; jobs with `platform_key='google_ads'` now fail fast with explicit error

Environment:
- .env.local: removed Google Ads variables and AW conversion tags
  - GOOGLE_ADS_CUSTOMER_ID
  - GOOGLE_ADS_LOGIN_CUSTOMER_ID
  - GOOGLE_ADS_DEVELOPER_TOKEN
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_ADS_REFRESH_TOKEN
  - GOOGLE_ADS_ACCESS_TOKEN
  - VITE_AW_CONVERSION_ID
  - VITE_AW_LABEL_PURCHASE

Files kept (not referenced) for audit:
- server/api/integrations/googleAdsAuth.ts (no longer imported by server/index.ts)
- src/pages/GoogleAds.tsx (not routed)

Notes:
- No stylesheet-specific assets were present for Google Ads.
- GA4 general endpoints remain; the specific `/api/ga4/google-ads` was removed.
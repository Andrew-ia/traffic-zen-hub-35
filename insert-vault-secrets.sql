-- Inserir secrets no Vault do Supabase
-- Execute este SQL no SQL Editor do Dashboard

INSERT INTO vault.secrets (name, secret)
VALUES
  ('meta_app_id', 'YOUR_META_APP_ID'),
  ('meta_app_secret', 'YOUR_META_APP_SECRET'),
  ('meta_access_token', 'YOUR_META_ACCESS_TOKEN'),
  ('meta_ad_account_id', 'YOUR_META_AD_ACCOUNT_ID'),
  ('google_ads_customer_id', 'YOUR_GOOGLE_ADS_CUSTOMER_ID'),
  ('google_ads_developer_token', 'YOUR_GOOGLE_ADS_DEVELOPER_TOKEN'),
  ('google_client_id', 'YOUR_GOOGLE_CLIENT_ID'),
  ('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET'),
  ('google_ads_refresh_token', 'YOUR_GOOGLE_ADS_REFRESH_TOKEN'),
  ('default_workspace_id', '00000000-0000-0000-0000-000000000010')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Verificar secrets inseridos
SELECT name, created_at, updated_at FROM vault.secrets ORDER BY name;

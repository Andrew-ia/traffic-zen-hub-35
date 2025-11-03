-- =============================================================================
-- CONFIGURAÇÃO DO SUPABASE VAULT PARA CREDENCIAIS
-- =============================================================================
-- Este script configura o Supabase Vault para armazenar credenciais de forma segura
--
-- Executar no SQL Editor do Supabase Dashboard
--
-- Depois de executar este script, você precisa inserir os secrets via:
-- 1. Dashboard Supabase > Project Settings > Vault
-- OU
-- 2. Via SQL (método preferido, execute os INSERTs abaixo)
-- =============================================================================

-- Inserir secrets Meta Ads
-- IMPORTANTE: Substitua os valores pelos seus reais do .env.local
INSERT INTO vault.secrets (name, secret)
VALUES
  ('meta_app_id', 'SEU_META_APP_ID_AQUI'),
  ('meta_app_secret', 'SEU_META_APP_SECRET_AQUI'),
  ('meta_access_token', 'SEU_META_ACCESS_TOKEN_AQUI'),
  ('meta_ad_account_id', 'SEU_META_AD_ACCOUNT_ID_AQUI')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Inserir secrets Google Ads
INSERT INTO vault.secrets (name, secret)
VALUES
  ('google_ads_customer_id', 'SEU_GOOGLE_ADS_CUSTOMER_ID_AQUI'),
  ('google_ads_developer_token', 'SEU_GOOGLE_ADS_DEVELOPER_TOKEN_AQUI'),
  ('google_client_id', 'SEU_GOOGLE_CLIENT_ID_AQUI'),
  ('google_client_secret', 'SEU_GOOGLE_CLIENT_SECRET_AQUI'),
  ('google_ads_refresh_token', 'SEU_GOOGLE_ADS_REFRESH_TOKEN_AQUI')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Inserir workspace ID default
INSERT INTO vault.secrets (name, secret)
VALUES
  ('default_workspace_id', 'SEU_WORKSPACE_ID_AQUI')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- =============================================================================
-- VERIFICAR SECRETS (não mostra valores, apenas nomes)
-- =============================================================================
SELECT name, created_at, updated_at
FROM vault.secrets
ORDER BY name;

-- =============================================================================
-- FUNÇÃO HELPER PARA EDGE FUNCTIONS
-- =============================================================================
-- Cria função para recuperar secrets de forma fácil
CREATE OR REPLACE FUNCTION get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name;

  RETURN secret_value;
END;
$$;

-- Concede permissão para service_role usar a função
GRANT EXECUTE ON FUNCTION get_secret(TEXT) TO service_role;

-- =============================================================================
-- TESTAR (deve retornar o valor do secret)
-- =============================================================================
-- SELECT get_secret('meta_app_id');

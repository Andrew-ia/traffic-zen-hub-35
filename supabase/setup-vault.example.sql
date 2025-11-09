-- =============================================================================
-- EXEMPLO: CONFIGURAÇÃO DO SUPABASE VAULT (NÃO CONTÉM SEGREDOS)
-- =============================================================================
-- Este arquivo é um exemplo seguro para orientar a criação de secrets no Vault.
-- Não inclua valores reais aqui. Crie um arquivo local `supabase/setup-vault.sql`
-- fora do versionamento (está ignorado no .gitignore) e execute-o no SQL Editor.

-- Inserir secrets Meta Ads (exemplo; substitua REPLACE_ME localmente)
-- Use apenas no arquivo local não versionado: supabase/setup-vault.sql
-- Os nomes abaixo são mantidos para compatibilidade com funções e edge functions.
INSERT INTO vault.secrets (name, secret)
VALUES
  ('meta_app_id', 'REPLACE_ME'),
  ('meta_app_secret', 'REPLACE_ME'),
  ('meta_access_token', 'REPLACE_ME'),
  ('meta_ad_account_id', 'REPLACE_ME'),
  ('meta_business_id', 'REPLACE_ME'),
  ('meta_system_user_id', 'REPLACE_ME'),
  ('meta_system_user_token', 'REPLACE_ME')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Inserir workspace ID default (exemplo)
INSERT INTO vault.secrets (name, secret)
VALUES
  ('default_workspace_id', '00000000-0000-0000-0000-000000000010')
ON CONFLICT (name)
DO UPDATE SET
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Função helper para recuperar secrets
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

GRANT EXECUTE ON FUNCTION get_secret(TEXT) TO service_role;

-- Observação importante:
-- Evite incluir chaves do Google OAuth (client_id, client_secret, refresh_token)
-- em arquivos versionados. Insira esses valores diretamente no Vault via Dashboard
-- ou em `supabase/setup-vault.sql` local, que está ignorado pelo .gitignore.


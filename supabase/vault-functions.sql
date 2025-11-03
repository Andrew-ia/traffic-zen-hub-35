-- =============================================================================
-- FUNÇÕES SQL PARA SUPABASE VAULT
-- =============================================================================
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- =============================================================================

-- Função para buscar múltiplos secrets de uma vez
CREATE OR REPLACE FUNCTION get_secrets(secret_names TEXT[])
RETURNS TABLE(name TEXT, value TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.name,
    ds.decrypted_secret as value
  FROM vault.decrypted_secrets ds
  WHERE ds.name = ANY(secret_names);
END;
$$;

-- Concede permissão para service_role
GRANT EXECUTE ON FUNCTION get_secrets(TEXT[]) TO service_role;

-- Função para inserir/atualizar um secret
CREATE OR REPLACE FUNCTION insert_secret(secret_name TEXT, secret_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO vault.secrets (name, secret)
  VALUES (secret_name, secret_value)
  ON CONFLICT (name)
  DO UPDATE SET
    secret = EXCLUDED.secret,
    updated_at = NOW();
END;
$$;

-- Concede permissão para service_role
GRANT EXECUTE ON FUNCTION insert_secret(TEXT, TEXT) TO service_role;

-- =============================================================================
-- TESTE
-- =============================================================================
-- Buscar um secret específico
-- SELECT * FROM get_secrets(ARRAY['meta_access_token']);

-- Buscar múltiplos secrets
-- SELECT * FROM get_secrets(ARRAY['meta_access_token', 'meta_ad_account_id', 'default_workspace_id']);

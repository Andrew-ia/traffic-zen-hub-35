-- 0002_grant_public_read.sql
-- Permite acesso de leitura para clientes (anon / authenticated) nas tabelas usadas pelo front-end.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON campaigns TO anon, authenticated;
GRANT SELECT ON platform_accounts TO anon, authenticated;
GRANT SELECT ON performance_metrics TO anon, authenticated;

-- Permite que views futuras com JOIN usem as sequences sem erro.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

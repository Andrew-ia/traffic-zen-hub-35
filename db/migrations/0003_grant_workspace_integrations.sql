-- 0003_grant_workspace_integrations.sql
-- Permissões de leitura para integrações no front-end.

GRANT SELECT ON workspace_integrations TO anon, authenticated;
GRANT SELECT ON performance_metrics TO anon, authenticated;

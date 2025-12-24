-- Move pg_net to the extensions schema (requires recreation) and tighten matview access.

create schema if not exists extensions;

-- Recreate pg_net in extensions schema (allowed pattern when SET SCHEMA is unsupported).
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

-- Restrict materialized views to service_role only (remove anon/auth).
revoke all privileges on table public.mv_health from public, anon, authenticated;
revoke all privileges on table public.mv_baselines from public, anon, authenticated;
grant select on table public.mv_health to service_role;
grant select on table public.mv_baselines to service_role;

-- Harden function search_path and tighten extension/materialized view exposure.
-- 1) Set search_path for functions flagged by linter.
do $$
begin
  execute 'alter function public.update_campaign_library_updated_at() set search_path = public, pg_temp';
  execute 'alter function public.update_updated_at_column() set search_path = public, pg_temp';
  execute 'alter function public.update_sync_metadata_updated_at() set search_path = public, pg_temp';
  execute 'alter function public.update_leads_ultima_atualizacao() set search_path = public, pg_temp';
  execute 'alter function public.expire_old_insights() set search_path = public, pg_temp';
  execute 'alter function public.update_products_updated_at() set search_path = public, pg_temp';
  execute 'alter function public.update_chat_conversation_timestamp() set search_path = public, pg_temp';
  execute 'alter function public.mark_product_sync_pending() set search_path = public, pg_temp';
  execute 'alter function public.get_avg_ticket(uuid, integer) set search_path = public, pg_temp';
  execute 'alter function public.execute_sql(text, boolean) set search_path = public, pg_temp';
  execute 'alter function public.start_sync_tracking(text, uuid, text, integer) set search_path = public, pg_temp';
  execute 'alter function public.update_sync_progress(text, uuid, integer, integer) set search_path = public, pg_temp';
  execute 'alter function public.complete_sync_tracking(text, uuid, boolean, text, integer) set search_path = public, pg_temp';
  execute 'alter function public.get_top_performing_adsets(uuid, integer, integer) set search_path = public, pg_temp';
  execute 'alter function public.get_secrets(text[]) set search_path = public, pg_temp';
  execute 'alter function public.fn_refresh_all() set search_path = public, pg_temp';
  execute 'alter function public.fn_generate_recommendations() set search_path = public, pg_temp';
  execute 'alter function public.insert_secret(text, text) set search_path = public, pg_temp';
  execute 'alter function public.update_integration_credentials_updated_at() set search_path = public, pg_temp';
  execute 'alter function public.update_sync_jobs_updated_at() set search_path = public, pg_temp';
exception
  when others then
    raise warning 'Failed to set search_path: %', sqlerrm;
end $$;

-- 2) Move pg_net extension out of public schema to match Supabase guidance.
create schema if not exists extensions;
do $$
begin
  execute 'alter extension pg_net set schema extensions';
exception
  when others then
    raise warning 'Could not move pg_net extension: %', sqlerrm;
end $$;

-- 3) Restrict materialized views from anon/authenticated.
do $$
begin
  execute 'revoke all on materialized view public.mv_health from public, anon, authenticated';
  execute 'revoke all on materialized view public.mv_baselines from public, anon, authenticated';
  -- Optionally grant to service roles if needed:
  -- execute ''grant select on materialized view public.mv_health to service_role'';
  -- execute ''grant select on materialized view public.mv_baselines to service_role'';
exception
  when others then
    raise warning 'Failed to adjust materialized view grants: %', sqlerrm;
end $$;

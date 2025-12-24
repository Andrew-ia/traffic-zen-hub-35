-- Enable/force RLS on all public tables and add permissive policies to preserve existing access.
-- Note: policies are intentionally broad (anon + authenticated) to avoid breaking current clients.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
      and c.relname not like 'pg_%'
      and c.relname not like 'sql_%'
      and c.relname not in ('schema_migrations')
  loop
    begin
      execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
      execute format('alter table %I.%I force row level security', r.schema_name, r.table_name);
    exception
      when others then
        raise warning 'Skipping table %I.%I: %', r.schema_name, r.table_name, sqlerrm;
    end;

    if not exists (
      select 1 from pg_policies p
      where p.schemaname = r.schema_name
        and p.tablename = r.table_name
        and p.policyname = 'allow_all_authenticated'
    ) then
      execute format(
        'create policy allow_all_authenticated on %I.%I for all to authenticated using (true) with check (true)',
        r.schema_name, r.table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies p
      where p.schemaname = r.schema_name
        and p.tablename = r.table_name
        and p.policyname = 'allow_all_anon'
    ) then
      execute format(
        'create policy allow_all_anon on %I.%I for all to anon using (true) with check (true)',
        r.schema_name, r.table_name
      );
    end if;
  end loop;
end $$;

-- Switch all public views to SECURITY INVOKER to satisfy Supabase linter.
do $$
declare
  v record;
begin
  for v in
    select table_schema, table_name
    from information_schema.views
    where table_schema = 'public'
  loop
    begin
      execute format('alter view %I.%I set (security_invoker = true)', v.table_schema, v.table_name);
    exception
      when others then
        raise warning 'Skipping view %I.%I: %', v.table_schema, v.table_name, sqlerrm;
    end;
  end loop;
end $$;

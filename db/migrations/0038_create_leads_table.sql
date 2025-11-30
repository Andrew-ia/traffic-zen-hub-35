-- Safe landing leads setup (idempotent and compatible with existing schema)
do $$
begin
  -- Create a lightweight table if it does not exist yet (e.g. fresh Supabase env)
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'leads'
  ) then
    create table leads (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      workspace_id uuid,
      name text not null,
      whatsapp text not null,
      company text not null,
      revenue_range text,
      status text default 'new'
    );
  end if;

  -- Add workspace_id column when missing (keeps nullable to avoid migration failures)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'workspace_id'
  ) then
    alter table leads add column workspace_id uuid;
  end if;

  -- Enable RLS if not already enabled
  perform 1 from pg_class where oid = 'public.leads'::regclass and relrowsecurity;
  if not found then
    alter table leads enable row level security;
  end if;

  -- Allow anonymous inserts for the landing page (only if policy not present)
  if not exists (
    select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_public_inserts'
  ) then
    create policy leads_public_inserts
      on leads
      for insert
      to anon
      with check (true);
  end if;

  -- Allow authenticated users (admins/app) to read leads
  if not exists (
    select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_admins_view'
  ) then
    create policy leads_admins_view
      on leads
      for select
      to authenticated
      using (true);
  end if;
end $$;

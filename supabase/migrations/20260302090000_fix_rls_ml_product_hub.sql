-- Enable RLS + permissive policies for newer ML/Product Hub tables.
do $$
declare
  tables text[] := array[
    'ml_ads_curves',
    'ml_ads_campaigns',
    'ml_ads_campaign_products',
    'ml_ads_curve_history',
    'ml_orders',
    'ml_order_items',
    'product_hub_purchase_lists',
    'product_hub_purchase_items',
    'ml_categories',
    'ml_trends',
    'ml_products',
    'ml_tracked_products',
    'ml_shipments_cache',
    'products_hub',
    'product_ads',
    'product_assets'
  ];
  t text;
begin
  foreach t in array tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname = 'public'
        and c.relname = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);

      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t
          and p.policyname = 'allow_all_authenticated'
      ) then
        execute format(
          'create policy allow_all_authenticated on public.%I for all to authenticated using (true) with check (true)',
          t
        );
      end if;

      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t
          and p.policyname = 'allow_all_anon'
      ) then
        execute format(
          'create policy allow_all_anon on public.%I for all to anon using (true) with check (true)',
          t
        );
      end if;
    else
      raise warning 'Skipping table public.%: table not found', t;
    end if;
  end loop;
end $$;

alter view if exists public.v_products_normalized set (security_invoker = true);

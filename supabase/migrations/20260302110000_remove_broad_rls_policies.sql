-- Remove broad RLS policies from internal ML/Product Hub tables.

do $$
declare
  tables text[] := array[
    'ml_ads_curves',
    'ml_ads_campaigns',
    'ml_ads_campaign_products',
    'ml_ads_curve_history',
    'ml_orders',
    'ml_order_items',
    'ml_shipments_cache',
    'products_hub',
    'product_ads',
    'product_assets',
    'product_hub_purchase_lists',
    'product_hub_purchase_items'
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
      execute format('drop policy if exists allow_all_authenticated on public.%I', t);
      execute format('drop policy if exists allow_all_anon on public.%I', t);
    end if;
  end loop;
end $$;

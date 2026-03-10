-- Reconcile tables that were previously created ad hoc at runtime.

create extension if not exists "pgcrypto";

create table if not exists product_hub_purchase_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_hub_purchase_lists_workspace
  on product_hub_purchase_lists (workspace_id, updated_at desc);

create table if not exists product_hub_purchase_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references product_hub_purchase_lists(id) on delete cascade,
  product_id uuid not null references products_hub(id) on delete cascade,
  suggestion text,
  sizes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, product_id)
);

create index if not exists idx_product_hub_purchase_items_list
  on product_hub_purchase_items (list_id);

create table if not exists ml_shipments_cache (
  workspace_id text not null,
  shipment_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, shipment_id)
);

create index if not exists idx_ml_shipments_cache_updated_at
  on ml_shipments_cache (updated_at desc);

create table if not exists ml_orders (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  order_id text not null,
  status text,
  date_created timestamptz,
  date_closed timestamptz,
  total_amount numeric(14,2),
  paid_amount numeric(14,2),
  currency_id text,
  buyer_id text,
  seller_id text,
  shipping_id text,
  shipping_logistic_type text,
  order_json jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, order_id)
);

create index if not exists idx_ml_orders_workspace_date
  on ml_orders (workspace_id, date_created desc);

create index if not exists idx_ml_orders_workspace_status
  on ml_orders (workspace_id, status);

create table if not exists ml_order_items (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  order_id text not null,
  item_id text not null,
  quantity integer not null default 0,
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  title text,
  listing_type_id text,
  currency_id text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, order_id, item_id),
  constraint ml_order_items_order_fk
    foreign key (workspace_id, order_id)
    references ml_orders(workspace_id, order_id)
    on delete cascade
);

create index if not exists idx_ml_order_items_workspace_item
  on ml_order_items (workspace_id, item_id);

create index if not exists idx_ml_order_items_workspace_order
  on ml_order_items (workspace_id, order_id);

create table if not exists ml_item_visits_daily (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  item_id text not null,
  visit_date date not null,
  visits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, item_id, visit_date)
);

create index if not exists idx_ml_item_visits_daily_workspace_date
  on ml_item_visits_daily (workspace_id, visit_date);

create index if not exists idx_ml_item_visits_daily_item
  on ml_item_visits_daily (workspace_id, item_id);

create table if not exists ml_account_metrics_daily (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  metric_date date not null,
  visits integer not null default 0,
  orders integer not null default 0,
  units integer not null default 0,
  revenue numeric(14,2) not null default 0,
  canceled_orders integer not null default 0,
  canceled_revenue numeric(14,2) not null default 0,
  response_rate numeric(10,4),
  reputation_level text,
  reputation_color text,
  claims_rate numeric(10,4),
  delayed_handling_rate numeric(10,4),
  cancellations_rate numeric(10,4),
  ads_cost numeric(14,2),
  ads_revenue numeric(14,2),
  ads_sales integer,
  ads_clicks integer,
  ads_impressions integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, metric_date)
);

create index if not exists idx_ml_account_metrics_daily_workspace_date
  on ml_account_metrics_daily (workspace_id, metric_date);

create table if not exists ml_sales_hourly (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  metric_hour timestamptz not null,
  orders integer not null default 0,
  units integer not null default 0,
  revenue numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, metric_hour)
);

create index if not exists idx_ml_sales_hourly_workspace_hour
  on ml_sales_hourly (workspace_id, metric_hour desc);

create table if not exists ml_product_ads_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ml_item_id text not null,
  ml_ad_id text,
  sku text,
  ml_category_id text,
  is_full boolean,
  price_current numeric(14,2),
  price_category_avg numeric(14,2),
  impressions bigint default 0,
  clicks bigint default 0,
  ctr numeric(10,4),
  conversion_rate numeric(10,4),
  sales integer default 0,
  revenue numeric(14,2) default 0,
  ads_spend numeric(14,2) default 0,
  acos numeric(10,4),
  roas numeric(10,4),
  net_margin numeric(10,4),
  sales_7d integer default 0,
  sales_30d integer default 0,
  days_without_sale integer,
  metric_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ml_item_id, ml_ad_id, metric_date)
);

create index if not exists idx_ml_product_ads_metrics_workspace_date
  on ml_product_ads_metrics (workspace_id, metric_date desc);

create index if not exists idx_ml_product_ads_metrics_item
  on ml_product_ads_metrics (workspace_id, ml_item_id);

create index if not exists idx_ml_product_ads_metrics_ad
  on ml_product_ads_metrics (workspace_id, ml_ad_id);

create table if not exists ml_price_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ml_item_id text,
  title text,
  current_price numeric(14,2),
  suggested_price numeric(14,2),
  currency_id text,
  status text not null default 'new' check (status in ('new','applied','dismissed')),
  resource text,
  benchmark jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  dismissed_at timestamptz,
  applied_price numeric(14,2)
);

create unique index if not exists idx_ml_price_suggestions_resource
  on ml_price_suggestions (workspace_id, resource);

create index if not exists idx_ml_price_suggestions_status
  on ml_price_suggestions (workspace_id, status, created_at desc);

create index if not exists idx_ml_price_suggestions_item
  on ml_price_suggestions (workspace_id, ml_item_id);

create table if not exists ml_product_pricing_controls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  ml_item_id text not null,
  cost_price numeric(14,2),
  shipping_cost numeric(14,2) not null default 0,
  packaging_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  overhead_cost numeric(14,2) not null default 0,
  fixed_fee numeric(14,2) not null default 0,
  payment_fee_rate numeric(8,4) not null default 0.04,
  ml_fee_rate numeric(8,4),
  cac numeric(14,2) not null default 0,
  target_margin_rate numeric(8,4) not null default 0.20,
  max_promo_discount_rate numeric(8,4) not null default 0.15,
  max_ads_spend_daily numeric(14,2) not null default 0,
  min_profit_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ml_item_id),
  constraint ml_product_pricing_controls_payment_fee_chk check (payment_fee_rate >= 0 and payment_fee_rate < 1),
  constraint ml_product_pricing_controls_ml_fee_chk check (ml_fee_rate is null or (ml_fee_rate >= 0 and ml_fee_rate < 1)),
  constraint ml_product_pricing_controls_target_margin_chk check (target_margin_rate >= 0 and target_margin_rate < 1),
  constraint ml_product_pricing_controls_max_promo_chk check (max_promo_discount_rate >= 0 and max_promo_discount_rate <= 1)
);

create index if not exists idx_ml_product_pricing_controls_workspace
  on ml_product_pricing_controls (workspace_id, updated_at desc);

create index if not exists idx_ml_product_pricing_controls_item
  on ml_product_pricing_controls (workspace_id, ml_item_id);

create table if not exists ml_ads_action_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  rule_key text not null,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, rule_key)
);

create index if not exists idx_ml_ads_action_rules_workspace
  on ml_ads_action_rules (workspace_id);

create table if not exists ml_ads_weekly_report_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  enabled boolean not null default false,
  send_day integer not null default 1,
  send_hour integer not null default 9,
  channel text not null default 'telegram',
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create index if not exists idx_ml_ads_weekly_report_workspace
  on ml_ads_weekly_report_settings (workspace_id);

alter table ml_ads_campaigns
  add column if not exists total_products integer default 0,
  add column if not exists active_products integer default 0;

alter table products
  add column if not exists sales_30d integer default 0,
  add column if not exists revenue_30d numeric(14,2) default 0,
  add column if not exists visits_30d integer default 0,
  add column if not exists conversion_rate_30d numeric(10,4) default 0,
  add column if not exists profit_unit numeric(14,2) default 0,
  add column if not exists ml_tax_rate numeric(6,4) default 0,
  add column if not exists fixed_fee numeric(10,2) default 0,
  add column if not exists overhead_cost numeric(10,2) default 0,
  add column if not exists cac numeric(10,2) default 0;

do $$
declare
  tables text[] := array[
    'ml_ads_curves',
    'ml_ads_campaigns',
    'ml_ads_campaign_products',
    'ml_ads_curve_history',
    'ml_ads_action_rules',
    'ml_ads_weekly_report_settings',
    'ml_orders',
    'ml_order_items',
    'ml_item_visits_daily',
    'ml_account_metrics_daily',
    'ml_sales_hourly',
    'ml_product_ads_metrics',
    'ml_price_suggestions',
    'ml_product_pricing_controls',
    'ml_shipments_cache',
    'products_hub',
    'product_ads',
    'product_assets',
    'product_hub_purchase_lists',
    'product_hub_purchase_items',
    'ml_categories',
    'ml_trends',
    'ml_products',
    'ml_tracked_products'
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
    end if;
  end loop;
end $$;

alter view if exists public.v_products_normalized set (security_invoker = true);

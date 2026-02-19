-- Snapshot de performance por produto/anuncio (Mercado Livre + Mercado Ads)

create extension if not exists "pgcrypto";

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

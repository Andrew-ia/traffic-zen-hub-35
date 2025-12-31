-- Hub de Produtos e Anúncios Normalizados
-- Cria tabelas minimalistas para consolidar produtos (1 linha = 1 produto real),
-- anúncios associados e ativos (imagens/vídeos), sem conflitar com a tabela products existente.

create extension if not exists "pgcrypto";

create table if not exists products_hub (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  platform text not null check (platform in ('mercadolivre', 'meta', 'google')),
  platform_product_id text not null,
  sku text,
  name text not null,
  category text,
  price numeric,
  source text default 'synced',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, platform, platform_product_id)
);

create index if not exists idx_products_hub_workspace_platform on products_hub (workspace_id, platform);
create index if not exists idx_products_hub_workspace_sku on products_hub (workspace_id, sku);

create table if not exists product_ads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products_hub(id) on delete cascade,
  ad_id uuid references ads(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('mercadolivre', 'meta', 'google')),
  platform_account_id uuid references platform_accounts(id) on delete set null,
  platform_ad_id text not null,
  permalink text,
  status text,
  impressions bigint default 0,
  clicks bigint default 0,
  spend numeric(18,4) default 0,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, platform, platform_ad_id)
);

create index if not exists idx_product_ads_product on product_ads (product_id);
create index if not exists idx_product_ads_platform_account on product_ads (platform_account_id);
create index if not exists idx_product_ads_workspace_status on product_ads (workspace_id, status);

create table if not exists product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products_hub(id) on delete cascade,
  creative_asset_id uuid references creative_assets(id) on delete set null,
  type text not null check (type in ('image','video')),
  url text,
  is_primary boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create unique index if not exists idx_product_assets_url on product_assets (product_id, url);
create index if not exists idx_product_assets_type on product_assets (product_id, type);

-- View simplificada no formato solicitado (1 linha = 1 produto real)
create or replace view v_products_normalized as
select
  p.id as id,
  p.workspace_id,
  p.platform,
  p.platform_product_id,
  p.sku,
  p.name,
  p.category,
  p.price,
  p.created_at
from products_hub p;

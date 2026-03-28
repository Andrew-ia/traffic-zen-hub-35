alter table products_hub
  add column if not exists description text;

alter table products_hub
  add column if not exists video_url text;

alter table products_hub
  add column if not exists barcode text;

alter table products_hub
  add column if not exists supplier text;

alter table products_hub
  add column if not exists cost_price numeric(14,2) default 0;

alter table products_hub
  add column if not exists stock_on_hand integer not null default 0;

alter table products_hub
  add column if not exists stock_reserved integer not null default 0;

alter table products_hub
  add column if not exists status text not null default 'active';

alter table products_hub
  add column if not exists weight_kg numeric(10,3);

alter table products_hub
  add column if not exists width_cm numeric(10,2);

alter table products_hub
  add column if not exists height_cm numeric(10,2);

alter table products_hub
  add column if not exists length_cm numeric(10,2);

alter table products_hub
  add column if not exists notes text;

alter table products_hub
  drop constraint if exists products_hub_platform_check;

alter table products_hub
  add constraint products_hub_platform_check
  check (platform in ('hub', 'mercadolivre', 'shopee', 'meta', 'google'));

alter table products
  add column if not exists hub_product_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_hub_product_fk'
  ) then
    alter table products
      add constraint products_hub_product_fk
      foreign key (hub_product_id)
      references products_hub(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_products_workspace_hub_product
  on products (workspace_id, hub_product_id);

update products p
set hub_product_id = ph.id
from products_hub ph
where p.workspace_id = ph.workspace_id
  and p.ml_item_id = ph.platform_product_id
  and ph.platform = 'mercadolivre'
  and p.hub_product_id is null;

create table if not exists product_channel_listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  hub_product_id uuid not null references products_hub(id) on delete cascade,
  channel text not null check (channel in ('mercadolivre', 'shopee', 'other')),
  source text not null default 'manual',
  internal_product_id uuid references products(id) on delete set null,
  external_listing_id text not null,
  sku text,
  title text,
  status text,
  price numeric(14,2),
  published_stock integer default 0,
  permalink text,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, channel, external_listing_id)
);

create index if not exists idx_product_channel_listings_hub_product
  on product_channel_listings (hub_product_id, channel);

create index if not exists idx_product_channel_listings_workspace_channel
  on product_channel_listings (workspace_id, channel, updated_at desc);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  hub_product_id uuid not null references products_hub(id) on delete cascade,
  channel text,
  movement_type text not null check (
    movement_type in (
      'manual_adjustment',
      'catalog_edit',
      'sale',
      'return',
      'reservation',
      'release',
      'sync'
    )
  ),
  delta_quantity integer not null,
  balance_before integer not null default 0,
  balance_after integer not null default 0,
  reference_type text,
  reference_id text,
  reason text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_hub_product
  on inventory_movements (hub_product_id, created_at desc);

create index if not exists idx_inventory_movements_workspace
  on inventory_movements (workspace_id, created_at desc);

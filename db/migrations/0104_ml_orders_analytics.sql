-- Storage for Mercado Livre orders/items to support 30d analytics

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

create index if not exists idx_ml_orders_workspace_date on ml_orders (workspace_id, date_created desc);
create index if not exists idx_ml_orders_workspace_status on ml_orders (workspace_id, status);

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

create index if not exists idx_ml_order_items_workspace_item on ml_order_items (workspace_id, item_id);
create index if not exists idx_ml_order_items_workspace_order on ml_order_items (workspace_id, order_id);

alter table products
  add column if not exists sales_30d integer default 0;

alter table products
  add column if not exists revenue_30d numeric(14,2) default 0;

alter table products
  add column if not exists profit_unit numeric(14,2) default 0;

alter table products
  add column if not exists ml_tax_rate numeric(6,4) default 0;

alter table products
  add column if not exists fixed_fee numeric(10,2) default 0;

alter table products
  add column if not exists overhead_cost numeric(10,2) default 0;

alter table products
  add column if not exists cac numeric(10,2) default 0;

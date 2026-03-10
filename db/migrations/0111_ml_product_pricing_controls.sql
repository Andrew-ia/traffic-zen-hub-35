-- Controle de precificacao por anuncio/item do Mercado Livre
-- Permite armazenar custo, limites de promocao e teto de gasto diario em Ads

create extension if not exists "pgcrypto";

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

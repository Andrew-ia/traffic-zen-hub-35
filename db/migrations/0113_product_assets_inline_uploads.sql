alter table product_assets
  add column if not exists storage_mode text not null default 'url';

alter table product_assets
  add column if not exists inline_data text;

alter table product_assets
  add column if not exists file_name text;

alter table product_assets
  add column if not exists mime_type text;

alter table product_assets
  add column if not exists file_size_bytes integer;

alter table product_assets
  add column if not exists asset_hash text;

alter table product_assets
  drop constraint if exists product_assets_storage_mode_check;

alter table product_assets
  add constraint product_assets_storage_mode_check
  check (storage_mode in ('url', 'inline'));

drop index if exists idx_product_assets_url;

create unique index if not exists idx_product_assets_url_unique
  on product_assets (product_id, url)
  where url is not null;

create unique index if not exists idx_product_assets_hash_unique
  on product_assets (product_id, asset_hash)
  where asset_hash is not null;

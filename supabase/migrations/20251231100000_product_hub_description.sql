-- Add description to products_hub for richer product detail
alter table products_hub
  add column if not exists description text;

-- Add product counters to ml_ads_campaigns

alter table if exists ml_ads_campaigns
  add column if not exists total_products integer default 0,
  add column if not exists active_products integer default 0;

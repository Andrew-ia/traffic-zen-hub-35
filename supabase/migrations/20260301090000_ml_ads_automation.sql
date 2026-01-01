-- Mercado Ads automation (Supabase)
-- Estrutura para curvas A/B/C, campanhas e vínculo produto-campanha

create extension if not exists "pgcrypto";

create table if not exists ml_ads_curves (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    curve text not null,
    name text not null,
    campaign_type text not null,
    daily_budget numeric(14,2) not null default 0,
    min_revenue_30d numeric(18,2) default 0,
    min_orders_30d integer default 0,
    min_roas numeric(10,2) default 0,
    min_conversion numeric(10,4) default 0,
    priority integer not null default 100,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, curve),
    constraint ml_ads_curves_curve_chk check (curve in ('A','B','C'))
);

create index if not exists idx_ml_ads_curves_workspace on ml_ads_curves (workspace_id);
create index if not exists idx_ml_ads_curves_priority on ml_ads_curves (workspace_id, priority);

create table if not exists ml_ads_campaigns (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    curve_id uuid references ml_ads_curves(id) on delete set null,
    curve text,
    campaign_type text not null,
    advertiser_id text not null,
    ml_campaign_id text,
    name text not null,
    status text not null default 'draft' check (status in ('draft','active','paused','archived','error')),
    daily_budget numeric(14,2),
    bidding_strategy text,
    automation_status text not null default 'managed' check (automation_status in ('managed','manual','sync_only')),
    last_synced_at timestamptz,
    last_automation_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, ml_campaign_id),
    unique (workspace_id, curve)
);

create index if not exists idx_ml_ads_campaigns_workspace on ml_ads_campaigns (workspace_id);
create index if not exists idx_ml_ads_campaigns_status on ml_ads_campaigns (workspace_id, status);
create index if not exists idx_ml_ads_campaigns_curve on ml_ads_campaigns (workspace_id, curve);

create table if not exists ml_ads_campaign_products (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    campaign_id uuid not null references ml_ads_campaigns(id) on delete cascade,
    product_id uuid references products(id) on delete set null,
    ml_item_id text,
    ml_ad_id text,
    curve text not null,
    source text not null default 'automation' check (source in ('automation','manual','import')),
    status text not null default 'active' check (status in ('active','paused','removed')),
    added_at timestamptz not null default now(),
    last_moved_at timestamptz,
    unique (campaign_id, product_id),
    unique (campaign_id, ml_item_id),
    unique (workspace_id, ml_ad_id)
);

create index if not exists idx_ml_ads_campaign_products_workspace on ml_ads_campaign_products (workspace_id);
create index if not exists idx_ml_ads_campaign_products_ml_item on ml_ads_campaign_products (ml_item_id);

create table if not exists ml_ads_curve_history (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    product_id uuid references products(id) on delete set null,
    ml_item_id text,
    previous_curve text,
    new_curve text not null,
    revenue_30d numeric(18,2),
    orders_30d integer,
    roas_30d numeric(10,2),
    conversion_rate numeric(10,4),
    campaign_id uuid references ml_ads_campaigns(id) on delete set null,
    reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_ml_ads_curve_history_workspace on ml_ads_curve_history (workspace_id, created_at desc);

create or replace function update_ml_ads_curves_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create or replace function update_ml_ads_campaigns_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ml_ads_curves_updated_at on ml_ads_curves;
create trigger trg_ml_ads_curves_updated_at
before update on ml_ads_curves
for each row execute function update_ml_ads_curves_updated_at();

drop trigger if exists trg_ml_ads_campaigns_updated_at on ml_ads_campaigns;
create trigger trg_ml_ads_campaigns_updated_at
before update on ml_ads_campaigns
for each row execute function update_ml_ads_campaigns_updated_at();

-- Daily/hourly growth metrics for Mercado Livre (visits + sales aggregates)

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

create table if not exists ml_ads_operational_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  channel text not null,
  metric_date date not null,
  advertiser_id text,
  currency_id text not null default 'BRL',
  cost numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  clicks integer not null default 0,
  prints integer not null default 0,
  units integer not null default 0,
  raw_payload jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, channel, metric_date)
);

create index if not exists idx_ml_ads_operational_daily_workspace_date
  on ml_ads_operational_daily (workspace_id, metric_date desc);

create index if not exists idx_ml_ads_operational_daily_workspace_channel
  on ml_ads_operational_daily (workspace_id, channel, metric_date desc);

create table if not exists ml_ads_billing_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  period_key date not null,
  period_date_from date not null,
  period_date_to date not null,
  period_status text,
  expiration_date date,
  debt_expiration_date date,
  currency_id text not null default 'BRL',
  total_amount numeric(14,2) not null default 0,
  unpaid_amount numeric(14,2) not null default 0,
  total_collected numeric(14,2) not null default 0,
  total_debt numeric(14,2) not null default 0,
  raw_payload jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_key)
);

create index if not exists idx_ml_ads_billing_periods_workspace_dates
  on ml_ads_billing_periods (workspace_id, period_date_from desc, period_date_to desc);

create table if not exists ml_ads_billing_summary_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  period_key date not null,
  line_kind text not null,
  line_type text,
  line_label text not null,
  line_amount numeric(14,2) not null default 0,
  group_id integer,
  group_description text,
  channel text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_key, line_kind, line_type, line_label)
);

create index if not exists idx_ml_ads_billing_summary_lines_workspace_period
  on ml_ads_billing_summary_lines (workspace_id, period_key);

create index if not exists idx_ml_ads_billing_summary_lines_workspace_channel
  on ml_ads_billing_summary_lines (workspace_id, channel, period_key);

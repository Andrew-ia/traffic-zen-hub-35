-- Core schema for the prescriptive ads decision layer.
create extension if not exists pgcrypto;
create extension if not exists pg_stat_statements;
create extension if not exists pg_cron;

create table if not exists objective_config (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  platform text not null,
  account_id text not null,
  campaign_id text,
  objective text not null,
  kpi_primary text not null,
  target_numeric numeric not null,
  floor_numeric numeric,
  ceiling_numeric numeric,
  attribution_window text default '7d_click',
  created_at timestamptz default now(),
  constraint objective_config_platform_chk check (platform in ('meta','google')),
  constraint objective_config_objective_chk check (objective in ('whatsapp','leads','sales','reach','traffic')),
  constraint objective_config_kpi_chk check (kpi_primary in ('cpr','cpl','cpa','roas','cost_per_msg'))
);

create index if not exists objective_config_lookup_idx
  on objective_config (platform, account_id, objective);

create table if not exists fact_ads_daily (
  d date not null,
  platform text not null,
  account_id text not null,
  campaign_id text,
  adset_id text,
  ad_id text,
  objective text,
  spend numeric default 0,
  impressions bigint default 0,
  reach bigint default 0,
  clicks bigint default 0,
  conv_primary bigint default 0,
  conv_value numeric default 0,
  messages_started bigint default 0,
  add_to_cart bigint default 0,
  purchases bigint default 0,
  revenue numeric default 0,
  constraint fact_ads_daily_pk primary key (d, platform, ad_id),
  constraint fact_ads_daily_platform_chk check (platform in ('meta','google'))
);

create index if not exists fact_ads_daily_account_idx
  on fact_ads_daily (platform, account_id, objective, d);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  d date not null,
  platform text not null,
  account_id text not null,
  campaign_id text,
  adset_id text,
  ad_id text,
  objective text,
  rule_id text not null,
  severity text not null,
  title text not null,
  explanation text not null,
  action_kind text not null,
  action_params jsonb,
  expected_gain_pct numeric,
  status text default 'open',
  constraint recommendations_platform_chk check (platform in ('meta','google')),
  constraint recommendations_severity_chk check (severity in ('low','medium','high','critical')),
  constraint recommendations_status_chk check (status in ('open','applied','dismissed')),
  constraint recommendations_action_chk check (
    action_kind in ('budget_increase','budget_decrease','pause_ad','rotate_creative','expand_audience','bid_cap','merge_adsets','duplicate_best')
  )
);

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references recommendations(id) on delete cascade,
  applied_by text,
  applied_at timestamptz default now(),
  notes text
);

create unique index if not exists recommendations_unique_scope_idx
  on recommendations (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  );

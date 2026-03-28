create table if not exists ml_ads_billing_detail_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  period_key date not null,
  billing_detail_id text not null,
  line_kind text not null,
  line_type text,
  line_label text,
  line_amount numeric(14,2) not null default 0,
  created_at timestamptz not null,
  channel text,
  raw_payload jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_key, billing_detail_id)
);

create index if not exists idx_ml_ads_billing_detail_lines_workspace_created
  on ml_ads_billing_detail_lines (workspace_id, created_at desc);

create index if not exists idx_ml_ads_billing_detail_lines_workspace_channel
  on ml_ads_billing_detail_lines (workspace_id, channel, created_at desc);

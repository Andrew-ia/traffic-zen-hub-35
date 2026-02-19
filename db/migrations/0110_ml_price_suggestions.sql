create table if not exists ml_price_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ml_item_id text,
  title text,
  current_price numeric(14,2),
  suggested_price numeric(14,2),
  currency_id text,
  status text not null default 'new' check (status in ('new','applied','dismissed')),
  resource text,
  benchmark jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  dismissed_at timestamptz,
  applied_price numeric(14,2)
);

create unique index if not exists idx_ml_price_suggestions_resource
  on ml_price_suggestions (workspace_id, resource);

create index if not exists idx_ml_price_suggestions_status
  on ml_price_suggestions (workspace_id, status, created_at desc);

create index if not exists idx_ml_price_suggestions_item
  on ml_price_suggestions (workspace_id, ml_item_id);

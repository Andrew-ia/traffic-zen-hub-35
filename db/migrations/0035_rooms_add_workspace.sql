alter table rooms add column if not exists workspace_id uuid;
create index if not exists idx_rooms_workspace on rooms(workspace_id);
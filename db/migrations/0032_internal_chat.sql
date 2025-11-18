create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references auth.users(id),
  added_at timestamptz default now()
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  room_id uuid references rooms(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text,
  image_url text,
  created_at timestamptz default now()
);

alter publication supabase_realtime add table messages;
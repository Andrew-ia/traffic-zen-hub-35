create index if not exists idx_messages_room_created on messages(room_id, created_at desc);
create index if not exists idx_room_members_room_user on room_members(room_id, user_id);
-- Drop foreign keys to auth.users for flexible IDs
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'room_members_user_id_fkey'
  ) then
    alter table room_members drop constraint room_members_user_id_fkey;
  end if;
exception when others then null;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'messages_sender_id_fkey'
  ) then
    alter table messages drop constraint messages_sender_id_fkey;
  end if;
exception when others then null;
end $$;

-- Change columns to text to allow any user identifier
alter table room_members alter column user_id type text using user_id::text;
alter table messages alter column sender_id type text using sender_id::text;
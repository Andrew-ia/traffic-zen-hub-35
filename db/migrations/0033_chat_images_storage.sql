-- Create public bucket for chat images
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- Policies for chat-images bucket (development-friendly)
drop policy if exists "Allow public read chat-images" on storage.objects;
drop policy if exists "Allow public upload chat-images" on storage.objects;
drop policy if exists "Allow public update chat-images" on storage.objects;
drop policy if exists "Allow public delete chat-images" on storage.objects;

create policy "Allow public read chat-images"
on storage.objects for select
using (bucket_id = 'chat-images');

create policy "Allow public upload chat-images"
on storage.objects for insert
with check (bucket_id = 'chat-images');

create policy "Allow public update chat-images"
on storage.objects for update
using (bucket_id = 'chat-images')
with check (bucket_id = 'chat-images');

create policy "Allow public delete chat-images"
on storage.objects for delete
using (bucket_id = 'chat-images');
-- Add video_url for export-friendly access
alter table products_hub
  add column if not exists video_url text;

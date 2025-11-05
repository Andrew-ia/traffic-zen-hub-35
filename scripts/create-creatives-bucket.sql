-- Create creatives storage bucket in Supabase
-- This bucket will store campaign creative assets (images, videos, etc.)

-- Create the bucket (public access for easy viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creatives',
  'creatives',
  true, -- Public bucket for easy access to creative assets
  52428800, -- 50MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf'
  ];

-- Storage policies for creatives bucket
-- Allow public read access
CREATE POLICY IF NOT EXISTS "Public read access for creatives"
ON storage.objects FOR SELECT
USING (bucket_id = 'creatives');

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload creatives"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creatives' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY IF NOT EXISTS "Authenticated users can update creatives"
ON storage.objects FOR UPDATE
USING (bucket_id = 'creatives' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY IF NOT EXISTS "Authenticated users can delete creatives"
ON storage.objects FOR DELETE
USING (bucket_id = 'creatives' AND auth.role() = 'authenticated');

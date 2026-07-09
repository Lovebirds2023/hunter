-- Lovedogs 360 Supabase Storage setup.
-- Run this in Supabase SQL Editor after creating the project.
--
-- Compatibility note:
-- The current mobile app uploads directly with the public anon key, so these
-- policies allow anon image uploads into the listed public buckets. Tighten
-- this later by moving uploads behind authenticated backend or Edge Function
-- endpoints.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-identity', 'pet-identity', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('case-evidence', 'case-evidence', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('service-images', 'service-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-images', 'event-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('support-attachments', 'support-attachments', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lovedogs public storage read" on storage.objects;
create policy "Lovedogs public storage read"
on storage.objects
for select
to public
using (
  bucket_id in (
    'pet-identity',
    'case-evidence',
    'service-images',
    'event-images',
    'support-attachments'
  )
);

drop policy if exists "Lovedogs anon storage upload" on storage.objects;
drop policy if exists "Lovedogs app storage upload" on storage.objects;
create policy "Lovedogs app storage upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id in (
    'pet-identity',
    'case-evidence',
    'service-images',
    'event-images',
    'support-attachments'
  )
);

drop policy if exists "Lovedogs anon storage upsert" on storage.objects;
drop policy if exists "Lovedogs app storage upsert" on storage.objects;
create policy "Lovedogs app storage upsert"
on storage.objects
for update
to anon, authenticated
using (
  bucket_id in (
    'pet-identity',
    'case-evidence',
    'service-images',
    'event-images',
    'support-attachments'
  )
)
with check (
  bucket_id in (
    'pet-identity',
    'case-evidence',
    'service-images',
    'event-images',
    'support-attachments'
  )
);

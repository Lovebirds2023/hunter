-- Storage bucket setup for a fresh Lovedogs 360 Supabase project.

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
create policy "Lovedogs anon storage upload"
on storage.objects
for insert
to anon
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
create policy "Lovedogs anon storage upsert"
on storage.objects
for update
to anon
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

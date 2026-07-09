-- Allow direct app image uploads from both anonymous and signed-in Supabase sessions.
-- The admin UI uploads event posters through storage before creating the event.

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

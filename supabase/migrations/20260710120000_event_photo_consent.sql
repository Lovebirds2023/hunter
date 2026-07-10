alter table public.registrations
  add column if not exists photo_consent boolean;

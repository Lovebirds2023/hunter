alter table public.app_versions
  add column if not exists download_url text,
  add column if not exists updated_at timestamptz not null default now();

create extension if not exists pgcrypto;

create table if not exists public.event_access_codes (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  code text not null,
  sponsor_name text,
  ticket_tier_id text,
  ticket_tier_label text,
  max_uses integer not null default 1,
  is_active boolean not null default true,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_access_codes_event_code_unique_idx
  on public.event_access_codes(event_id, upper(code));

create index if not exists event_access_codes_event_id_idx
  on public.event_access_codes(event_id);

alter table public.registrations
  add column if not exists access_code_id text,
  add column if not exists access_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_access_code_id_fkey'
  ) then
    alter table public.registrations
      add constraint registrations_access_code_id_fkey
      foreign key (access_code_id)
      references public.event_access_codes(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists registrations_access_code_single_use_idx
  on public.registrations(access_code_id)
  where access_code_id is not null;

create index if not exists registrations_access_code_idx
  on public.registrations(access_code_id);

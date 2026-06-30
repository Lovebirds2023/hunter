-- Stage 1 Edge Function schema for Lovedogs 360.
-- This is the minimum profile table needed by auth/register/login/users/me.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'buyer',
  auth_provider text not null default 'email',
  google_id text unique,
  phone_number text,
  country text,
  language text not null default 'en',
  profile_image text,
  bio text,
  latitude double precision,
  longitude double precision,
  location_accuracy_meters double precision,
  address text,
  expo_push_token text,
  timezone text,
  preferred_currency text,
  payment_method text,
  mpesa_phone_number text,
  average_rating double precision not null default 0,
  total_ratings integer not null default 0,
  pre_suspension_role text,
  suspended_at timestamptz,
  suspension_ends_at timestamptz,
  suspension_reason text,
  suspended_by_id uuid references public.users(id),
  deleted_at timestamptz,
  is_online boolean not null default false,
  last_seen timestamptz,
  karma_points integer not null default 0,
  available_karma integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_google_id on public.users (google_id);
create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_deleted_at on public.users (deleted_at);

alter table public.users enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

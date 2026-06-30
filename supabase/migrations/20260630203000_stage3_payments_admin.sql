create extension if not exists pgcrypto;

alter table public.registrations
  add column if not exists pesapal_merchant_reference text;

create index if not exists registrations_pesapal_reference_idx
  on public.registrations(pesapal_merchant_reference);

create index if not exists orders_pesapal_reference_idx
  on public.orders(pesapal_merchant_reference);

create table if not exists public.notification_campaigns (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  message text not null,
  target_group text not null,
  filters jsonb,
  type text not null default 'admin_broadcast',
  target_type text,
  target_id text,
  target_route text,
  recipient_count integer not null default 0,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_campaign_recipients (
  id text primary key default gen_random_uuid()::text,
  campaign_id text references public.notification_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  notification_id text references public.notifications(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notification_campaigns_created_at_idx
  on public.notification_campaigns(created_at desc);

create index if not exists notification_campaign_recipients_campaign_idx
  on public.notification_campaign_recipients(campaign_id);

create table if not exists public.karma_transactions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete cascade,
  amount integer not null,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists karma_transactions_user_created_idx
  on public.karma_transactions(user_id, created_at desc);

alter table public.event_access_codes
  add column if not exists code_type text not null default 'access',
  add column if not exists discount_type text,
  add column if not exists discount_value double precision not null default 0,
  add column if not exists expires_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_id uuid references public.users(id) on delete set null,
  add column if not exists delete_reason text;

update public.event_access_codes
set code_type = 'access'
where code_type is null or code_type = '';

alter table public.registrations
  add column if not exists original_amount double precision,
  add column if not exists discount_amount double precision not null default 0,
  add column if not exists discount_code_id text,
  add column if not exists discount_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_discount_code_id_fkey'
  ) then
    alter table public.registrations
      add constraint registrations_discount_code_id_fkey
      foreign key (discount_code_id)
      references public.event_access_codes(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists registrations_discount_code_single_use_idx
  on public.registrations(discount_code_id)
  where discount_code_id is not null;

create index if not exists event_access_codes_code_type_idx
  on public.event_access_codes(code_type);

create index if not exists registrations_discount_code_idx
  on public.registrations(discount_code_id);

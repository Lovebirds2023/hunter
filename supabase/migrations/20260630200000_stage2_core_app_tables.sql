create extension if not exists pgcrypto;

create table if not exists public.dogs (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  breed text,
  color text,
  height double precision default 0,
  weight double precision default 0,
  age double precision,
  pet_type text default 'dog',
  body_structure text,
  bio text,
  nose_print_descriptor jsonb,
  nose_print_image text,
  body_image text,
  birthmark_image text,
  vaccination_card_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_records (
  id text primary key default gen_random_uuid()::text,
  dog_id text references public.dogs(id) on delete cascade,
  record_type text not null,
  date timestamptz not null,
  next_due_date timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key default gen_random_uuid()::text,
  provider_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  price double precision not null default 0,
  item_type text default 'services',
  category text,
  image_url text,
  latitude double precision,
  longitude double precision,
  location_accuracy_meters double precision,
  address text,
  location_landmark text,
  is_published boolean not null default true,
  currency text not null default 'KES',
  stock_count integer,
  slots_available integer,
  is_busy boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  admin_approved boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_form_fields (
  id text primary key default gen_random_uuid()::text,
  service_id text references public.services(id) on delete cascade,
  field_type text not null,
  label text not null,
  options jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  buyer_id uuid references public.users(id) on delete cascade,
  service_id text references public.services(id) on delete set null,
  amount double precision not null default 0,
  commission double precision not null default 0,
  payout double precision not null default 0,
  discount_amount double precision not null default 0,
  karma_points_redeemed integer not null default 0,
  status text not null default 'pending',
  share_phone boolean not null default false,
  pesapal_tracking_id text,
  pesapal_merchant_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_form_responses (
  id text primary key default gen_random_uuid()::text,
  order_id text references public.orders(id) on delete cascade,
  field_id text references public.service_form_fields(id) on delete set null,
  answer_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  organizer_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  poster_url text,
  images jsonb not null default '[]'::jsonb,
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer not null default 0,
  ticket_price double precision not null default 0,
  currency text not null default 'KES',
  ticket_tiers jsonb,
  attendee_type_question text,
  available_slots jsonb,
  category text,
  is_public integer not null default 1,
  admin_created boolean not null default false,
  scorecard_enabled boolean not null default true,
  scorecard_title text,
  scorecard_description text,
  follow_up_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  dog_id text references public.dogs(id) on delete set null,
  status text not null default 'registered',
  role text not null default 'attendee',
  share_phone boolean not null default false,
  amount double precision not null default 0,
  currency text not null default 'KES',
  payment_status text not null default 'free',
  ticket_tier_id text,
  ticket_tier_label text,
  attendee_type_justification text,
  booking_slot_id text,
  booking_slot_label text,
  booking_start_time timestamptz,
  booking_end_time timestamptz,
  pesapal_tracking_id text,
  paid_at timestamptz,
  check_in_time timestamptz,
  ticket_token text default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.saved_events (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete cascade,
  event_id text references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table if not exists public.event_form_fields (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  field_type text not null,
  label text not null,
  options jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.registration_responses (
  id text primary key default gen_random_uuid()::text,
  registration_id text references public.registrations(id) on delete cascade,
  field_id text references public.event_form_fields(id) on delete set null,
  answer_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_reports (
  id text primary key default gen_random_uuid()::text,
  author_id uuid references public.users(id) on delete cascade,
  case_type text not null,
  title text not null,
  description text,
  image_url text,
  breed text,
  color text,
  pet_type text default 'dog',
  sex text,
  size text,
  microchip_id text,
  collar_description text,
  unique_markings text,
  location text,
  latitude double precision,
  longitude double precision,
  location_accuracy_meters double precision,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  is_approved boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_match_candidates (
  id text primary key default gen_random_uuid()::text,
  case_report_id text references public.case_reports(id) on delete cascade,
  matched_case_report_id text references public.case_reports(id) on delete cascade,
  matched_dog_id text references public.dogs(id) on delete cascade,
  match_source text not null default 'rule',
  confidence double precision not null default 0,
  status text not null default 'suggested',
  score_breakdown jsonb,
  notified_user_ids jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_comments (
  id text primary key default gen_random_uuid()::text,
  report_id text references public.case_reports(id) on delete cascade,
  author_id uuid references public.users(id) on delete cascade,
  content text not null,
  tagged_users jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.case_likes (
  id text primary key default gen_random_uuid()::text,
  report_id text references public.case_reports(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table if not exists public.support_tickets (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open',
  admin_reply text,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  message text not null,
  target_audience text not null default 'all',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  target_type text,
  target_id text,
  target_route text,
  created_at timestamptz not null default now()
);

create table if not exists public.spotlight (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  image_url text,
  target_route text,
  target_id text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_pins (
  id text primary key default gen_random_uuid()::text,
  target_type text not null,
  target_id text not null,
  title text not null,
  description text,
  image_url text,
  priority integer not null default 100,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id)
);

create table if not exists public.community_messages (
  id text primary key default gen_random_uuid()::text,
  author_id uuid references public.users(id) on delete cascade,
  content text not null,
  latitude double precision,
  longitude double precision,
  is_global boolean not null default true,
  reshare_id text,
  hashtags jsonb not null default '[]'::jsonb,
  is_poll boolean not null default false,
  poll_options jsonb,
  flag_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_reactions (
  id text primary key default gen_random_uuid()::text,
  message_id text references public.community_messages(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction_type)
);

create table if not exists public.community_poll_votes (
  id text primary key default gen_random_uuid()::text,
  message_id text references public.community_messages(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  option_id integer not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.direct_messages (
  id text primary key default gen_random_uuid()::text,
  sender_id uuid references public.users(id) on delete cascade,
  receiver_id uuid references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.ratings (
  id text primary key default gen_random_uuid()::text,
  order_id text references public.orders(id) on delete cascade,
  rater_id uuid references public.users(id) on delete cascade,
  rated_id uuid references public.users(id) on delete cascade,
  score integer not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key default gen_random_uuid()::text,
  order_id text references public.orders(id) on delete set null,
  user_id uuid references public.users(id) on delete cascade,
  amount double precision not null default 0,
  type text not null,
  status text not null default 'pending',
  payout_method text,
  destination text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.withdrawal_requests (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete cascade,
  amount double precision,
  method text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_versions (
  id text primary key default gen_random_uuid()::text,
  platform text not null default 'android',
  version text not null,
  build_number integer,
  update_url text,
  release_notes text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists dogs_owner_id_idx on public.dogs(owner_id);
create index if not exists services_provider_id_idx on public.services(provider_id);
create index if not exists services_item_type_idx on public.services(item_type);
create index if not exists events_start_time_idx on public.events(start_time);
create index if not exists registrations_user_id_idx on public.registrations(user_id);
create index if not exists case_reports_author_id_idx on public.case_reports(author_id);
create index if not exists case_reports_created_at_idx on public.case_reports(created_at desc);
create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists community_messages_created_at_idx on public.community_messages(created_at desc);
create index if not exists direct_messages_participants_idx on public.direct_messages(sender_id, receiver_id);

create table if not exists public.program_journeys (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  dog_id text references public.dogs(id) on delete set null,
  progress_percentage double precision not null default 0,
  current_timepoint text not null default 'T1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.checkin_data (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  dog_id text references public.dogs(id) on delete set null,
  timepoint text not null,
  who5_answers jsonb,
  pss10_answers jsonb,
  relationship_answers jsonb,
  welfare_snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, timepoint)
);

create table if not exists public.live_observations (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  observer_id uuid references public.users(id) on delete set null,
  participant_id text,
  dog_id text references public.dogs(id) on delete set null,
  behavior text not null,
  intensity text,
  notes text,
  timestamp timestamptz not null default now(),
  is_offline_sync boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.scorecard_questions (
  id text primary key,
  survey_type text not null,
  category text,
  question_type text not null default 'likert',
  prompt text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.scorecard_participants (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  full_name text,
  anonymous_code text,
  phone_number text,
  county text not null,
  community_location text not null,
  user_type text not null,
  participation_type text not null,
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scorecard_surveys (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  participant_id text references public.scorecard_participants(id) on delete cascade,
  survey_type text not null,
  category_scores jsonb not null default '{}'::jsonb,
  coexistence_index double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.scorecard_responses (
  id text primary key default gen_random_uuid()::text,
  survey_id text references public.scorecard_surveys(id) on delete cascade,
  question_id text references public.scorecard_questions(id) on delete cascade,
  answer_numeric integer,
  answer_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.scorecard_evidence (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  evidence_type text not null,
  url text not null,
  notes text,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.scorecard_reporting_exports (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade,
  fields jsonb not null default '{}'::jsonb,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  id text primary key default gen_random_uuid()::text,
  blocker_id uuid references public.users(id) on delete cascade,
  blocked_id uuid references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists program_journeys_event_user_idx on public.program_journeys(event_id, user_id);
create index if not exists checkin_data_event_user_idx on public.checkin_data(event_id, user_id);
create index if not exists live_observations_event_idx on public.live_observations(event_id, timestamp desc);
create index if not exists scorecard_questions_type_idx on public.scorecard_questions(survey_type, sort_order);
create index if not exists scorecard_participants_event_idx on public.scorecard_participants(event_id);
create index if not exists scorecard_surveys_event_type_idx on public.scorecard_surveys(event_id, survey_type);
create index if not exists scorecard_responses_survey_idx on public.scorecard_responses(survey_id);
create index if not exists scorecard_evidence_event_idx on public.scorecard_evidence(event_id, created_at desc);
create index if not exists scorecard_reporting_event_idx on public.scorecard_reporting_exports(event_id, updated_at desc);
create index if not exists user_blocks_blocker_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

insert into public.scorecard_questions (id, survey_type, category, question_type, prompt, sort_order, is_active)
values
  ('baseline_likert_01', 'baseline', 'Human Wellbeing', 'likert', 'I feel comfortable interacting with dogs in my community.', 0, true),
  ('baseline_likert_02', 'baseline', 'Human Wellbeing', 'likert', 'I understand how to safely approach or interact with a dog.', 1, true),
  ('baseline_likert_03', 'baseline', 'Human Wellbeing', 'likert', 'I know what to do if I encounter an unfamiliar dog.', 2, true),
  ('baseline_likert_04', 'baseline', 'Human Wellbeing', 'likert', 'I understand how rabies affects both people and animals.', 3, true),
  ('baseline_likert_05', 'baseline', 'Human Wellbeing', 'likert', 'I believe dogs contribute positively to community wellbeing.', 4, true),
  ('baseline_likert_06', 'baseline', 'Animal Welfare', 'likert', 'Dogs deserve humane treatment and care.', 5, true),
  ('baseline_likert_07', 'baseline', 'Animal Welfare', 'likert', 'I understand the basic welfare needs of a dog.', 6, true),
  ('baseline_likert_08', 'baseline', 'Animal Welfare', 'likert', 'I believe regular vaccination is important.', 7, true),
  ('baseline_likert_09', 'baseline', 'Animal Welfare', 'likert', 'I believe responsible ownership benefits both dogs and people.', 8, true),
  ('baseline_likert_10', 'baseline', 'Animal Welfare', 'likert', 'I know where to seek help for a dog welfare concern.', 9, true),
  ('baseline_likert_11', 'baseline', 'Environment', 'likert', 'People and dogs can safely share public spaces.', 10, true),
  ('baseline_likert_12', 'baseline', 'Environment', 'likert', 'Responsible dog ownership contributes to cleaner communities.', 11, true),
  ('baseline_likert_13', 'baseline', 'Environment', 'likert', 'Dog welfare is connected to environmental wellbeing.', 12, true),
  ('baseline_likert_14', 'baseline', 'Environment', 'likert', 'Community spaces should consider both people and animals.', 13, true),
  ('baseline_likert_15', 'baseline', 'Social Cohesion', 'likert', 'Conversations about dogs can bring communities together.', 14, true),
  ('baseline_likert_16', 'baseline', 'Social Cohesion', 'likert', 'I am willing to learn from others about living with dogs.', 15, true),
  ('baseline_likert_17', 'baseline', 'Social Cohesion', 'likert', 'I feel my experiences with dogs are valued.', 16, true),
  ('baseline_likert_18', 'baseline', 'Social Cohesion', 'likert', 'Different generations can learn from one another about dog care.', 17, true),
  ('baseline_likert_19', 'baseline', 'Indigenous/Local Knowledge', 'likert', 'Local and traditional knowledge can help improve relationships between people and dogs.', 18, true),
  ('baseline_likert_20', 'baseline', 'Indigenous/Local Knowledge', 'likert', 'Stories and lived experiences are valuable sources of learning.', 19, true),
  ('baseline_open_21', 'baseline', null, 'open', 'What is one challenge involving dogs in your community?', 20, true),
  ('baseline_open_22', 'baseline', null, 'open', 'What is one thing you would like to learn about dogs?', 21, true),
  ('baseline_open_23', 'baseline', null, 'open', 'Tell us about a positive or difficult experience you have had with a dog.', 22, true),
  ('followup_likert_01', 'followup', 'Human Wellbeing', 'likert', 'I feel comfortable interacting with dogs in my community.', 0, true),
  ('followup_likert_02', 'followup', 'Human Wellbeing', 'likert', 'I understand how to safely approach or interact with a dog.', 1, true),
  ('followup_likert_03', 'followup', 'Human Wellbeing', 'likert', 'I know what to do if I encounter an unfamiliar dog.', 2, true),
  ('followup_likert_04', 'followup', 'Human Wellbeing', 'likert', 'I understand how rabies affects both people and animals.', 3, true),
  ('followup_likert_05', 'followup', 'Human Wellbeing', 'likert', 'I believe dogs contribute positively to community wellbeing.', 4, true),
  ('followup_likert_06', 'followup', 'Animal Welfare', 'likert', 'Dogs deserve humane treatment and care.', 5, true),
  ('followup_likert_07', 'followup', 'Animal Welfare', 'likert', 'I understand the basic welfare needs of a dog.', 6, true),
  ('followup_likert_08', 'followup', 'Animal Welfare', 'likert', 'I believe regular vaccination is important.', 7, true),
  ('followup_likert_09', 'followup', 'Animal Welfare', 'likert', 'I believe responsible ownership benefits both dogs and people.', 8, true),
  ('followup_likert_10', 'followup', 'Animal Welfare', 'likert', 'I know where to seek help for a dog welfare concern.', 9, true),
  ('followup_likert_11', 'followup', 'Environment', 'likert', 'People and dogs can safely share public spaces.', 10, true),
  ('followup_likert_12', 'followup', 'Environment', 'likert', 'Responsible dog ownership contributes to cleaner communities.', 11, true),
  ('followup_likert_13', 'followup', 'Environment', 'likert', 'Dog welfare is connected to environmental wellbeing.', 12, true),
  ('followup_likert_14', 'followup', 'Environment', 'likert', 'Community spaces should consider both people and animals.', 13, true),
  ('followup_likert_15', 'followup', 'Social Cohesion', 'likert', 'Conversations about dogs can bring communities together.', 14, true),
  ('followup_likert_16', 'followup', 'Social Cohesion', 'likert', 'I am willing to learn from others about living with dogs.', 15, true),
  ('followup_likert_17', 'followup', 'Social Cohesion', 'likert', 'I feel my experiences with dogs are valued.', 16, true),
  ('followup_likert_18', 'followup', 'Social Cohesion', 'likert', 'Different generations can learn from one another about dog care.', 17, true),
  ('followup_likert_19', 'followup', 'Indigenous/Local Knowledge', 'likert', 'Local and traditional knowledge can help improve relationships between people and dogs.', 18, true),
  ('followup_likert_20', 'followup', 'Indigenous/Local Knowledge', 'likert', 'Stories and lived experiences are valuable sources of learning.', 19, true),
  ('followup_open_21', 'followup', null, 'open', 'What new knowledge have you gained?', 20, true),
  ('followup_open_22', 'followup', null, 'open', 'Has your attitude toward dogs changed? If yes, how?', 21, true),
  ('followup_open_23', 'followup', null, 'open', 'Have you changed any behavior relating to dogs?', 22, true),
  ('followup_open_24', 'followup', null, 'open', 'What action have you taken since participating?', 23, true),
  ('followup_open_25', 'followup', null, 'open', 'What story or lesson stayed with you most?', 24, true),
  ('followup_open_26', 'followup', null, 'open', 'What additional support would help your community?', 25, true)
on conflict (id) do update set
  survey_type = excluded.survey_type,
  category = excluded.category,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

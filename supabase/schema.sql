-- Enable required extensions
create extension if not exists "pgcrypto";

-- Domain definitions -------------------------------------------------------
create type muscle_group as enum (
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'fullbody',
  'other'
);

-- Tables -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group muscle_group not null,
  user_id uuid references public.profiles (id) on delete cascade,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exercises_name_owner_unique unique (name, user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  performed_at timestamptz not null,
  muscle_group muscle_group not null,
  source_import_key text,
  note text,
  perceived_intensity smallint,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  weight numeric(6,2),
  reps smallint,
  duration_seconds smallint,
  is_pr boolean not null default false,
  set_order smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint share_tokens_token_unique unique (token)
);

-- Indexes ------------------------------------------------------------------
create index if not exists sessions_user_performed_idx on public.sessions (user_id, performed_at desc);
create unique index if not exists sessions_user_source_import_key_unique
  on public.sessions (user_id, source_import_key);
create index if not exists sets_session_idx on public.sets (session_id);
create index if not exists sets_exercise_idx on public.sets (exercise_id);
create index if not exists share_tokens_session_idx on public.share_tokens (session_id);

-- Row Level Security -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.sets enable row level security;
alter table public.share_tokens enable row level security;

create policy "Users read their profile" on public.profiles
  for select using (id = auth.uid());

create policy "Users update their profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users delete their profile" on public.profiles
  for delete using (id = auth.uid());

create policy "Anyone can insert own profile" on public.profiles
  for insert with check (id = auth.uid());

create policy "Users view exercises" on public.exercises
  for select using (user_id is null or user_id = auth.uid());

create policy "Users manage their exercises" on public.exercises
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their sessions" on public.sessions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their sets" on public.sets
  for all using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

create policy "Owners manage share tokens" on public.share_tokens
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helper view --------------------------------------------------------------
create or replace view public.v_muscle_volume_by_week as
select
  s.user_id,
  date_trunc('week', s.performed_at) as week_start,
  s.muscle_group,
  sum(coalesce(st.weight, 0) * coalesce(st.reps, 0)) as total_volume,
  count(st.id) as set_count
from public.sessions s
left join public.sets st on st.session_id = s.id
where s.performed_at >= timezone('utc', now()) - interval '90 days'
group by s.user_id, week_start, s.muscle_group;

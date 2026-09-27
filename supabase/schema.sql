-- Habit Tracker database schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- A habit the user wants to track (e.g. "Read 20 minutes")
create table public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

-- One row per day a habit was completed
create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- Row Level Security: users can only see and change their own rows
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

create policy "Users manage their own habits"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own habit logs"
  on public.habit_logs for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

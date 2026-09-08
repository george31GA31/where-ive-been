-- Run this once in your Supabase project's SQL editor.
-- It creates one JSON data row per signed-in user and locks each row to its owner.

create table if not exists public.travel_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.travel_tracker_data enable row level security;

drop policy if exists "Users can read their own travel data" on public.travel_tracker_data;
create policy "Users can read their own travel data"
on public.travel_tracker_data
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own travel data" on public.travel_tracker_data;
create policy "Users can insert their own travel data"
on public.travel_tracker_data
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own travel data" on public.travel_tracker_data;
create policy "Users can update their own travel data"
on public.travel_tracker_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

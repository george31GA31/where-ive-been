-- ============================================================
-- Where I've Been — Supabase setup
-- Run this once in Supabase > SQL Editor.
--
-- This file supports:
--   1) optional account-based cloud sync (legacy/optional)
--   2) no-login encrypted device-transfer codes
--
-- The website must use ONLY the publishable/anon key.
-- Never place a secret/service-role key in app.js or GitHub.
-- ============================================================


-- ============================================================
-- 1. OPTIONAL ACCOUNT-BASED CLOUD SYNC
-- ============================================================

create table if not exists public.travel_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.travel_tracker_data enable row level security;

-- Recreate policies so this script is safe to run again.
drop policy if exists "Users can read own travel data" on public.travel_tracker_data;
drop policy if exists "Users can insert own travel data" on public.travel_tracker_data;
drop policy if exists "Users can update own travel data" on public.travel_tracker_data;
drop policy if exists "Users can delete own travel data" on public.travel_tracker_data;

create policy "Users can read own travel data"
on public.travel_tracker_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own travel data"
on public.travel_tracker_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own travel data"
on public.travel_tracker_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own travel data"
on public.travel_tracker_data
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.travel_tracker_data from anon;
grant select, insert, update, delete on table public.travel_tracker_data to authenticated;


-- ============================================================
-- 2. NO-LOGIN DEVICE TRANSFER
-- ============================================================

create table if not exists public.travel_device_transfers (
  code_hash text primary key,
  encrypted_payload text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.travel_device_transfers enable row level security;

-- The browser never gets direct table access. It can only call the
-- two SECURITY DEFINER functions below.
revoke all on table public.travel_device_transfers from public, anon, authenticated;


-- Create a temporary encrypted transfer.
create or replace function public.create_travel_device_transfer(
  p_code_hash text,
  p_encrypted_payload text,
  p_iv text,
  p_expires_minutes integer default 60
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
  v_minutes integer;
begin
  -- Clear expired records whenever somebody creates a new transfer.
  delete from public.travel_device_transfers
  where expires_at <= now();

  -- Keep expiry between 5 minutes and 24 hours.
  v_minutes := least(
    greatest(coalesce(p_expires_minutes, 60), 5),
    1440
  );

  v_expires := now() + (v_minutes * interval '1 minute');

  insert into public.travel_device_transfers (
    code_hash,
    encrypted_payload,
    iv,
    expires_at
  )
  values (
    p_code_hash,
    p_encrypted_payload,
    p_iv,
    v_expires
  )
  on conflict (code_hash)
  do update set
    encrypted_payload = excluded.encrypted_payload,
    iv = excluded.iv,
    created_at = now(),
    expires_at = excluded.expires_at;

  return v_expires;
end;
$$;


-- Claim a transfer once.
-- DELETE ... RETURNING makes a successful code single-use.
create or replace function public.claim_travel_device_transfer(
  p_code_hash text
)
returns table (
  encrypted_payload text,
  iv text
)
language sql
security definer
set search_path = public
as $$
  delete from public.travel_device_transfers
  where code_hash = p_code_hash
    and expires_at > now()
  returning encrypted_payload, iv;
$$;


revoke all on function public.create_travel_device_transfer(
  text,
  text,
  text,
  integer
) from public;

revoke all on function public.claim_travel_device_transfer(
  text
) from public;


grant execute on function public.create_travel_device_transfer(
  text,
  text,
  text,
  integer
) to anon, authenticated;

grant execute on function public.claim_travel_device_transfer(
  text
) to anon, authenticated;


-- Helpful index for expired-transfer cleanup.
create index if not exists travel_device_transfers_expires_at_idx
on public.travel_device_transfers (expires_at);

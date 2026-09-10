-- ============================================================
-- Where I've Been — Supabase production setup
-- Run this in Supabase > SQL Editor for a new project.
--
-- Supports:
--   1) optional account-based cloud sync
--   2) no-login encrypted device-transfer codes
--
-- IMPORTANT:
--   Browser code must use ONLY the publishable/anon key.
--   Never place a secret/service-role key in JavaScript or GitHub.
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

revoke all on table public.travel_tracker_data from public, anon;
grant select, insert, update, delete on table public.travel_tracker_data to authenticated;


-- ============================================================
-- 2. NO-LOGIN DEVICE TRANSFER
-- ============================================================

create table if not exists public.travel_device_transfers (
  code_hash text primary key,
  encrypted_payload text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint travel_device_transfers_code_hash_format_chk
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint travel_device_transfers_iv_format_chk
    check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  constraint travel_device_transfers_payload_size_chk
    check (
      char_length(encrypted_payload) between 24 and 1000000
      and encrypted_payload ~ '^[A-Za-z0-9+/=]+$'
    ),
  constraint travel_device_transfers_expiry_chk
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '60 minutes'
    )
);

alter table public.travel_device_transfers enable row level security;

-- Browser clients never get direct table access. They can only call the
-- SECURITY DEFINER RPCs below.
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
set search_path = pg_catalog, public
as $$
declare
  v_expires timestamptz;
  v_minutes integer;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid transfer code hash';
  end if;

  if p_iv is null or p_iv !~ '^[A-Za-z0-9+/]{16}$' then
    raise exception 'Invalid transfer IV';
  end if;

  if p_encrypted_payload is null
     or char_length(p_encrypted_payload) < 24
     or char_length(p_encrypted_payload) > 1000000
     or p_encrypted_payload !~ '^[A-Za-z0-9+/=]+$' then
    raise exception 'Invalid transfer payload';
  end if;

  -- Opportunistic cleanup keeps expired transfer rows short-lived.
  delete from public.travel_device_transfers
  where expires_at <= now();

  -- A caller cannot extend a public transfer beyond one hour.
  v_minutes := least(
    greatest(coalesce(p_expires_minutes, 60), 5),
    60
  );

  v_expires := now() + (v_minutes * interval '1 minute');

  insert into public.travel_device_transfers (
    code_hash,
    encrypted_payload,
    iv,
    created_at,
    expires_at
  )
  values (
    p_code_hash,
    p_encrypted_payload,
    p_iv,
    now(),
    v_expires
  )
  on conflict (code_hash)
  do update set
    encrypted_payload = excluded.encrypted_payload,
    iv = excluded.iv,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at;

  return v_expires;
end;
$$;


-- Claim a transfer once. DELETE ... RETURNING makes a successful claim
-- atomic and single-use.
create or replace function public.claim_travel_device_transfer(
  p_code_hash text
)
returns table (
  encrypted_payload text,
  iv text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  delete from public.travel_device_transfers t
  where t.code_hash = p_code_hash
    and t.expires_at > now()
  returning t.encrypted_payload, t.iv;
end;
$$;

revoke all on function public.create_travel_device_transfer(text, text, text, integer) from public;
revoke all on function public.claim_travel_device_transfer(text) from public;

grant execute on function public.create_travel_device_transfer(text, text, text, integer)
  to anon, authenticated;
grant execute on function public.claim_travel_device_transfer(text)
  to anon, authenticated;

create index if not exists travel_device_transfers_expires_at_idx
on public.travel_device_transfers (expires_at);

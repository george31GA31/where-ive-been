-- ============================================================
-- Where I've Been — production hardening migration
-- Safe to run after supabase-setup.sql.
--
-- Purpose:
--   * keep browser clients away from transfer tables directly
--   * validate transfer hashes / IVs / encrypted payloads
--   * cap transfer size and lifetime to limit abuse
--   * retain single-use DELETE ... RETURNING claims
--
-- The website must use ONLY the Supabase publishable/anon key.
-- Never use a secret/service-role key in browser JavaScript.
-- ============================================================

begin;

-- Keep direct access closed. Browser users can only execute the two RPCs.
alter table public.travel_device_transfers enable row level security;
revoke all on table public.travel_device_transfers from public, anon, authenticated;

-- Clean up old rows before validating constraints.
delete from public.travel_device_transfers
where expires_at <= now();

-- Database-level guardrails. These match the browser implementation:
-- SHA-256 lookup hashes are 64 lowercase hex characters; AES-GCM uses a
-- 12-byte IV, encoded by btoa as 16 base64 characters.
alter table public.travel_device_transfers
  drop constraint if exists travel_device_transfers_code_hash_format_chk,
  drop constraint if exists travel_device_transfers_iv_format_chk,
  drop constraint if exists travel_device_transfers_payload_size_chk,
  drop constraint if exists travel_device_transfers_expiry_chk;

alter table public.travel_device_transfers
  add constraint travel_device_transfers_code_hash_format_chk
    check (code_hash ~ '^[0-9a-f]{64}$'),
  add constraint travel_device_transfers_iv_format_chk
    check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  add constraint travel_device_transfers_payload_size_chk
    check (
      char_length(encrypted_payload) between 24 and 1000000
      and encrypted_payload ~ '^[A-Za-z0-9+/=]+$'
    ),
  add constraint travel_device_transfers_expiry_chk
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '60 minutes'
    );

-- Hardened create RPC.
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

  -- Expired transfers do not need to remain in the database.
  delete from public.travel_device_transfers
  where expires_at <= now();

  -- Production transfers are deliberately short-lived. The public browser
  -- cannot extend a transfer beyond one hour by altering a request.
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

-- Hardened one-time claim RPC. DELETE ... RETURNING means a successful
-- transfer disappears atomically, so the same transfer cannot be claimed twice.
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

-- Account-based sync remains authenticated-only and owner-scoped.
alter table public.travel_tracker_data enable row level security;
revoke all on table public.travel_tracker_data from anon;
grant select, insert, update, delete on table public.travel_tracker_data to authenticated;

commit;

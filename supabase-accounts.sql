-- Account storage only: preserves the existing device-transfer service.
begin;
create table if not exists public.travel_tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  revision bigint not null default 0
);
alter table public.travel_tracker_data add column if not exists revision bigint not null default 0;
alter table public.travel_tracker_data enable row level security;
revoke all on public.travel_tracker_data from public, anon;
grant select, insert, update, delete on public.travel_tracker_data to authenticated;
-- Replace policies only on this app's private account table.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='travel_tracker_data'
  loop execute format('drop policy %I on public.travel_tracker_data', p.policyname); end loop;
end $$;
create policy account_owner on public.travel_tracker_data for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A stale device cannot replace a newer copy. The row lock serializes concurrent saves.
create or replace function public.save_travel_account(p_payload jsonb, p_revision bigint)
returns setof public.travel_tracker_data
language plpgsql security invoker set search_path = '' as $$
declare current_row public.travel_tracker_data; account_id uuid := auth.uid();
begin
  if account_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload->'stays') is distinct from 'array'
    or jsonb_typeof(p_payload->'profiles') is distinct from 'array'
    or jsonb_typeof(p_payload->'residences') is distinct from 'array'
    or octet_length(p_payload::text) > 5000000 then
    raise exception 'Invalid account data' using errcode='22023';
  end if;
  insert into public.travel_tracker_data(user_id,payload,revision)
    values(account_id,'{}',0) on conflict (user_id) do nothing;
  select * into current_row from public.travel_tracker_data where user_id=account_id for update;
  if p_revision is distinct from current_row.revision then
    raise exception 'Account changed on another device' using errcode='40001';
  end if;
  return query update public.travel_tracker_data set payload=p_payload,
    revision=current_row.revision+1, updated_at=now() where user_id=account_id returning *;
end $$;
revoke all on function public.save_travel_account(jsonb,bigint) from public, anon;
grant execute on function public.save_travel_account(jsonb,bigint) to authenticated;
commit;

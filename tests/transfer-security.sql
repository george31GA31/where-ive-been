-- Rollback-only tests. No real guest or account payloads are read.
begin;
set local role anon;
do $$ declare expiry timestamptz; claimed integer; rejected boolean := false; begin
  begin
    perform public.create_travel_device_transfer('invalid',repeat('A',24),repeat('A',16),60);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Malformed code accepted'; end if;
  expiry := public.create_travel_device_transfer(repeat('1',64),repeat('A',24),repeat('A',16),1440);
  if expiry > now()+interval '60 minutes' then raise exception 'Expiry cap failed'; end if;
  rejected := false;
  begin
    perform public.create_travel_device_transfer(repeat('1',64),repeat('B',24),repeat('A',16),60);
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'Existing transfer overwritten'; end if;
  select count(*) into claimed from public.claim_travel_device_transfer(repeat('1',64));
  if claimed <> 1 then raise exception 'First claim failed'; end if;
  select count(*) into claimed from public.claim_travel_device_transfer(repeat('1',64));
  if claimed <> 0 then raise exception 'Code could be reused'; end if;
  rejected := false;
  begin perform count(*) from public.travel_device_transfers;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous table access allowed'; end if;
end $$;
reset role;
select 'PASS: transfer format, lifetime cap, collision protection, single use and direct access denial' as result;
rollback;

-- Run as postgres in the Supabase SQL editor. All fixtures roll back.
begin;
insert into auth.users(id,aud,role) values
 ('00000000-0000-4000-8000-000000000001','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000002','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select revision from public.save_travel_account('{"stays":[],"profiles":[],"residences":[]}',0);
do $$ begin
  if (select count(*) from public.travel_tracker_data) <> 1 then raise exception 'Owner cannot read data'; end if;
  begin
    perform public.save_travel_account('{"stays":[],"profiles":[],"residences":[]}',0);
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare affected integer; begin
  if (select count(*) from public.travel_tracker_data) <> 0 then raise exception 'Other user data exposed'; end if;
  update public.travel_tracker_data set payload='{}' where user_id='00000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user update succeeded'; end if;
  delete from public.travel_tracker_data where user_id='00000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user delete succeeded'; end if;
  begin
    insert into public.travel_tracker_data(user_id,payload) values('00000000-0000-4000-8000-000000000001','{}');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.travel_tracker_data; raise exception 'Anonymous read succeeded';
  exception when insufficient_privilege then null; end;
  begin perform public.save_travel_account('{"stays":[],"profiles":[],"residences":[]}',0); raise exception 'Anonymous save succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner access, cross-user isolation, stale-write rejection and anonymous denial' as result;
rollback;

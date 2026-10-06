-- Run as postgres in the Supabase SQL editor. All fixtures roll back.
begin;
insert into auth.users(id,aud,role) values
 ('00000000-0000-4000-8000-000000000001','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000002','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select revision from public.save_travel_account('{"stays":[],"profiles":[],"residences":[],"manualCountryVisits":[{"id":"manual-country:shared:JP","countryCode":"JP","visited":true}],"tccVisits":[{"id":"tcc-visit:shared:tcc-scotland","destinationId":"tcc-scotland","visited":true}],"savedPlaces":[{"id":"fixture-hotel","place":{"name":"Fixture hotel"},"accommodationLogo":{"src":"data:image/png;base64,AAAA","updatedAt":"2026-10-06T00:00:00Z"}}],"unknownFixtureField":{"preserve":true}}',0);
do $$ begin
  if (select count(*) from public.travel_tracker_data) <> 1 then raise exception 'Owner cannot read data'; end if;
  if (select payload->'manualCountryVisits'->0->>'countryCode' from public.travel_tracker_data) <> 'JP' then raise exception 'Manual country visit did not round-trip'; end if;
  if (select payload->'tccVisits'->0->>'destinationId' from public.travel_tracker_data) <> 'tcc-scotland' then raise exception 'TCC visit did not round-trip'; end if;
  if (select payload->'savedPlaces'->0->'accommodationLogo'->>'src' from public.travel_tracker_data) <> 'data:image/png;base64,AAAA' then raise exception 'Hotel logo did not round-trip'; end if;
  if (select jsonb_array_length(payload->'stays') from public.travel_tracker_data) <> 0 then raise exception 'Tracker created travel history'; end if;
  perform public.save_travel_account((select jsonb_set(payload,'{tccVisits}','[]') from public.travel_tracker_data),1);
  if (select jsonb_array_length(payload->'tccVisits') from public.travel_tracker_data) <> 0 then raise exception 'TCC removal was not saved'; end if;
  if (select jsonb_array_length(payload->'manualCountryVisits') from public.travel_tracker_data) <> 1 then raise exception 'TCC update changed normal visits'; end if;
  if (select payload->'unknownFixtureField'->>'preserve' from public.travel_tracker_data) <> 'true' then raise exception 'Unknown data was lost'; end if;
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
select 'PASS: owner access, additive trackers and logos, cross-user isolation, stale-write rejection and anonymous denial' as result;
rollback;

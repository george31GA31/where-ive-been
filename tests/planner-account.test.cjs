'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Account = require('../account-model.js');
const Records = require('../account-records.js');
const Calendar = require('../calendar-data-model.js');
const Planner = require('../trip-planner-model.js');

function fixture(id = 'planner.one.with.periods') {
  const road = Planner.reconcile({
    id, plannerVersion: 2, name: 'Lake transfer', status: 'planned', profileId: 'p', linkedTransportId: 'old-owned',
    notes: 'Journey notes', custom: { providerFields: ['preserve'] },
    stops: [
      { id: 'a', name: 'La Fortuna', lat: 10.47, lon: -84.64 },
      { id: 'b', name: 'Boat landing', lat: 10.46, lon: -84.74 },
      { id: 'c', name: 'Monteverde', lat: 10.30, lon: -84.82 },
    ], segments: [],
  });
  road.segments[0].mode = 'bus';
  road.segments[1].mode = 'boat';
  road.segments[0].departureLocal = '2026-12-01T09:00';
  road.segments[0].arrivalLocal = '2026-12-01T10:00';
  return { version: 2, activeProfileId: 'p', profiles: [{ id: 'p', name: 'Traveller', citizenships: [], enabledRules: [], homeCountryCodes: [] }], roadTrips: [road], transports: [], accommodations: [], stays: [], residences: [], trips: [], placeVisits: [], notes: [], customBackupField: { intact: true } };
}

test('concurrent structural and segment edits resolve as one complete graph, including dotted IDs', () => {
  const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
  local.roadTrips[0].stops.reverse();
  local.roadTrips[0] = Planner.reconcile(local.roadTrips[0]);
  local.roadTrips[0].notes = 'Independent local journey note';
  remote.roadTrips[0].segments[0].mode = 'ferry';
  remote.roadTrips[0].segments[0].departureLocal = '2026-12-02T09:00';
  remote.roadTrips[0].custom.remoteDetail = 'Keep remote metadata';
  for (const choice of ['local', 'remote']) {
    const result = Account.merge(base, local, remote, conflict => conflict[choice]);
    const graph = choice === 'local' ? local.roadTrips[0] : remote.roadTrips[0];
    assert.equal(result.conflicts.length, 1);
    assert.match(result.conflicts[0].path, /\.plannerGraph$/);
    assert.deepEqual(result.data.roadTrips[0].stops, graph.stops);
    assert.deepEqual(result.data.roadTrips[0].segments, graph.segments);
    assert.deepEqual(result.data.roadTrips[0].previousSegments, graph.previousSegments);
    assert.equal(Planner.validate(result.data.roadTrips[0]), '');
    assert.equal(result.data.roadTrips[0].notes, 'Independent local journey note');
    assert.equal(result.data.roadTrips[0].custom.remoteDetail, 'Keep remote metadata');
    assert.doesNotThrow(() => Account.validateImport(result.data));
  }
  assert.equal(base.roadTrips[0].stops[0].id, 'a');
  assert.equal(base.roadTrips[0].segments[0].mode, 'bus');
});

test('an independent journey note merges with a remote planner graph without a conflict', () => {
  const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
  local.roadTrips[0].notes = 'Meet by the hotel';
  remote.roadTrips[0].segments[1].mode = 'ferry';
  const result = Account.merge(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.data.roadTrips[0].notes, 'Meet by the hotel');
  assert.equal(result.data.roadTrips[0].segments[1].mode, 'ferry');
  assert.equal(Planner.validate(result.data.roadTrips[0]), '');
});

test('graph conflict descriptions show journey details without expanding private image bytes', () => {
  const data = fixture(), local = structuredClone(data.roadTrips[0]), remote = structuredClone(local);
  local.stops[0].media = [{name:'lodge.webp',src:'data:image/webp;base64,PRIVATE-IMAGE-BYTES'}];
  remote.segments[0].departureLocal = '2026-12-02T10:00';
  const description = Account.describeConflict({path:'roadTrips.'+local.id+'.plannerGraph',local,remote},data);
  assert.match(description.title,/Lake transfer/);
  assert.match(description.local,/lodge.webp/);
  assert.match(description.remote,/2026-12-02T10:00/);
  assert.doesNotMatch(description.local,/PRIVATE-IMAGE-BYTES|data:image/);
});

test('backup validation, import and account display projection preserve media and unknown legacy fields', () => {
  const source = fixture(), road = source.roadTrips[0];
  road.stops[0].media = [{ id: 'photo', src: 'data:image/webp;base64,UklGRg==', name: 'Hotel.webp', width: 960, height: 640 }];
  road.segments[0].media = [{ id: 'logo', src: 'data:image/png;base64,iVBORw==', name: 'Bus logo', customMedia: { crop: 'preserve' } }];
  road.segments[0].bookingReference = 'BUS-KEEP';
  road.segments[0].route = { kind: 'manual', coordinates: [[10.47, -84.64], [10.49, -84.7], [10.46, -84.74]], customRoute: 'preserve' };
  const before = structuredClone(source);
  assert.deepEqual(Account.validateImport(source), source);
  const imported = Account.importData({}, source);
  assert.deepEqual(imported.conflicts, []);
  assert.deepEqual(imported.data.roadTrips, source.roadTrips);
  assert.deepEqual(imported.data.customBackupField, source.customBackupField);
  const projected = Records.project(imported.data);
  assert.deepEqual(Records.restore(projected.data, projected.preserved), imported.data);
  const edited = structuredClone(projected.data);
  edited.roadTrips[0].notes = 'Edited note';
  const changed = Records.changes(imported.data, projected.data, edited);
  assert.deepEqual(changed.roadTrips[0].stops[0].media, road.stops[0].media);
  assert.deepEqual(changed.roadTrips[0].segments[0].media, road.segments[0].media);
  assert.equal(changed.roadTrips[0].segments[0].route.customRoute, 'preserve');
  assert.deepEqual(changed.roadTrips[0].custom, road.custom);
  assert.deepEqual(source, before);
  const broken = structuredClone(source);
  broken.roadTrips[0].segments[0].toStopId = 'removed-stop';
  assert.throws(() => Account.validateImport(broken), /order/);
});

test('calendar projections shift and clear directly while original transport and hotel records stay intact', () => {
  const state = fixture(), road = state.roadTrips[0];
  const owned = { id: 'old-owned', roadTripId: road.id, type: 'car', dateOnly: true, profileId: 'p', start: { name: 'La Fortuna' }, end: { name: 'Monteverde' }, startLocal: '2026-12-01', endLocal: '2026-12-01', bookingReference: 'LEGACY-KEEP', custom: { keep: true } };
  const unrelated = { ...structuredClone(owned), id: 'unrelated', roadTripId: 'another-planner' };
  state.transports = [owned, unrelated];
  state.accommodations = [{ id: 'original-hotel', profileId: 'p', propertyName: 'Original Hotel', location: 'Costa Rica', checkIn: '2026-12-01', checkOut: '2026-12-03', notes: 'Keep this booking' }];
  const originalTransport = structuredClone(state.transports), originalHotels = structuredClone(state.accommodations);
  road.stops[1].accommodation = { name: 'Lake Hotel', checkIn: '2026-12-01', checkOut: '2026-12-02' };
  road.stops[1].activities = [{ id: 'activity', name: 'Evening walk', date: '2026-12-01' }];
  let days = Calendar.window(state, '2026-12-01', 4);
  assert.equal(days.get('2026-12-01').transports.length, 2);
  assert.equal(days.get('2026-12-01').transports.some(row => row.id === owned.id), false);
  assert.equal(days.get('2026-12-01').transports.filter(row => row.plannerId === road.id).length, 1);
  assert.equal(days.get('2026-12-01').accommodations.length, 2);
  assert.equal(days.get('2026-12-01').notes[0].title, 'Evening walk');
  road.segments[0].departureLocal = '2026-12-02T09:00';
  road.segments[0].arrivalLocal = '2026-12-02T10:00';
  road.segments[0].mode = 'coach';
  road.stops[1].accommodation.checkIn = '2026-12-03';
  road.stops[1].accommodation.checkOut = '2026-12-04';
  road.stops[1].activities[0].date = '2026-12-03';
  days = Calendar.window(state, '2026-12-01', 4);
  assert.equal(days.get('2026-12-01').transports.length, 1);
  const moved = days.get('2026-12-02').transports.filter(row => row.plannerId === road.id);
  assert.equal(moved.length, 1);
  assert.equal(moved[0].plannerMode, 'coach');
  assert.equal(moved[0].plannerModeLabel, 'Coach');
  assert.equal(days.get('2026-12-01').accommodations.length, 1);
  assert.equal(days.get('2026-12-03').accommodations.length, 2);
  assert.equal(days.get('2026-12-01').notes.length, 0);
  assert.equal(days.get('2026-12-03').notes.length, 1);
  road.segments[0].departureLocal = '';
  road.segments[0].arrivalLocal = '';
  road.stops[1].accommodation.checkIn = '';
  road.stops[1].accommodation.checkOut = '';
  road.stops[1].activities[0].date = '';
  days = Calendar.window(state, '2026-12-01', 4);
  assert.equal([...days.values()].flatMap(day => day.transports).some(row => row.plannerId), false);
  assert.equal([...days.values()].flatMap(day => day.accommodations).some(row => row.plannerId), false);
  assert.equal([...days.values()].flatMap(day => day.notes).some(row => row.plannerId), false);
  assert.deepEqual(state.transports, originalTransport);
  assert.deepEqual(state.accommodations, originalHotels);
});

test('unconverted legacy roads keep their original calendar transport until the explicit v2 save', () => {
  const state = fixture('legacy');
  state.roadTrips[0] = { id: 'legacy', linkedTransportId: 'legacy-transport', name: 'Old road journey', profileId: 'p', status: 'planned', startDate: '2026-12-01', endDate: '2026-12-01', stops: [{ name: 'From', lat: 10, lon: 20 }, { name: 'To', lat: 10.1, lon: 20.1 }] };
  state.transports = [{ id: 'legacy-transport', roadTripId: 'legacy', profileId: 'p', type: 'car', dateOnly: true, startLocal: '2026-12-01', endLocal: '2026-12-01', start: { name: 'From' }, end: { name: 'To' } }];
  const original = structuredClone(state);
  const draft = Planner.normalize(state.roadTrips[0]);
  assert.equal(Calendar.window(state, '2026-12-01', 1).get('2026-12-01').transports[0].id, 'legacy-transport');
  assert.deepEqual(state, original);
  state.roadTrips[0] = draft;
  const day = Calendar.window(state, '2026-12-01', 1).get('2026-12-01');
  assert.equal(day.transports.length, 1);
  assert.equal(day.transports[0].plannerId, 'legacy');
  assert.deepEqual(state.transports, original.transports);
});

test('saving an existing trip as a graph replaces only its consumed calendar transport and accommodation', () => {
  const state=fixture();
  state.roadTrips=[];
  state.trips=[{id:'original-trip',name:'Original lake trip',profileId:'p',notes:'Original trip notes'}];
  const transport={id:'original-bus',tripId:'original-trip',profileId:'p',type:'bus',status:'planned',start:{name:'San José',lat:9.93,lon:-84.08},end:{name:'La Fortuna',lat:10.47,lon:-84.64},startLocal:'2026-12-01T09:00',endLocal:'2026-12-01T12:00',notes:'Original bus notes',bookingReference:'KEEP-BUS'};
  const hotel={id:'original-hotel',tripId:'original-trip',profileId:'p',propertyName:'Lake Hotel',location:'La Fortuna',checkIn:'2026-12-01',checkOut:'2026-12-03',notes:'Original hotel notes',bookingReference:'KEEP-HOTEL'};
  const unrelated={...hotel,id:'unrelated-hotel',tripId:'other-trip'};
  state.transports=[transport];
  state.accommodations=[hotel,unrelated];
  const before=structuredClone(state),draft=Planner.fromExisting(state,{tripId:'original-trip'});
  assert.doesNotThrow(()=>Account.validateImport({roadTrips:[draft]}));
  let day=Calendar.window(state,'2026-12-01',1).get('2026-12-01');
  assert.equal(day.transports[0].id,transport.id,'Opening a draft keeps the old source active');
  state.roadTrips=[draft];
  day=Calendar.window(state,'2026-12-01',1).get('2026-12-01');
  assert.equal(day.transports.length,1);
  assert.equal(day.transports[0].plannerId,draft.id);
  assert.equal(day.accommodations.length,2);
  assert.equal(day.accommodations.some(row=>row.id===hotel.id),false);
  assert.equal(day.accommodations.some(row=>row.id===unrelated.id),true);
  draft.segments.find(segment=>segment.sourceRecord?.id===transport.id).departureLocal='2026-12-04T09:00';
  draft.segments.find(segment=>segment.sourceRecord?.id===transport.id).arrivalLocal='2026-12-04T12:00';
  const importedHotel=draft.stops.find(stop=>stop.accommodation?.sourceRecord?.id===hotel.id).accommodation;
  importedHotel.checkIn='2026-12-04';
  importedHotel.checkOut='2026-12-06';
  const days=Calendar.window(state,'2026-12-01',6);
  assert.equal(days.get('2026-12-01').transports.length,0);
  assert.equal(days.get('2026-12-01').accommodations.length,1);
  assert.equal(days.get('2026-12-04').transports.filter(row=>row.plannerId===draft.id).length,1);
  assert.equal(days.get('2026-12-04').accommodations.filter(row=>row.plannerId===draft.id).length,1);
  assert.deepEqual(state.transports,before.transports);
  assert.deepEqual(state.accommodations,before.accommodations);
  assert.deepEqual(state.trips,before.trips);
});

test('an explicit Calendar traveller keeps shared originals when its owning graph belongs to another traveller', () => {
  const state=fixture();
  state.roadTrips=[];
  const hotel={id:'shared-hotel',propertyName:'Shared booking',location:'Costa Rica',checkIn:'2026-12-01',checkOut:'2026-12-03'};
  state.accommodations=[hotel];
  state.roadTrips=[Planner.fromExisting(state,{accommodationId:hotel.id})];
  const own=Calendar.window(state,'2026-12-01',1,'p').get('2026-12-01');
  const other=Calendar.window(state,'2026-12-01',1,'q').get('2026-12-01');
  assert.equal(own.accommodations.length,1);
  assert.equal(own.accommodations[0].plannerId,state.roadTrips[0].id);
  assert.equal(other.accommodations.length,1);
  assert.equal(other.accommodations[0].id,hotel.id);
  assert.equal(other.accommodations[0].plannerId,undefined);
  assert.equal(state.activeProfileId,'p');
});

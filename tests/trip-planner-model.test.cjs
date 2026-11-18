'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../trip-planner-model.js');
const R = require('../route-persistence.js');
const stop = (id, name, lat = 10, lon = 20) => ({ id, name, lat, lon });
function journey() {
  return M.reconcile({ id: 'journey:one', plannerVersion: 2, name: 'Costa Rica', profileId: 'p', status: 'idea', stops: [stop('a', 'La Fortuna'), stop('b', 'Boarding point', 10.1, 20.1), stop('c', 'Monteverde', 10.2, 20.2)], segments: [] });
}

test('a complete undated graph has independent supported modes and no imposed stop limit', () => {
  const road = journey();
  road.segments[0].mode = 'bus';
  road.segments[1].mode = 'boat';
  assert.equal(M.validate(road), '');
  assert.equal(M.modes.length, 13);
  assert.equal(M.modes.find(mode => mode.id === 'ferry').searchContext, 'boat');
  for (const mode of M.modes) {
    road.segments[0].mode = mode.id;
    assert.equal(M.validate(road), '');
  }
  const many = M.reconcile({ ...road, stops: Array.from({ length: 1200 }, (_, index) => stop('stop-' + index, 'Destination ' + index)), segments: [] });
  assert.equal(many.segments.length, 1199);
  assert.equal(M.validate(many), '');
  assert.deepEqual(M.calendarEntries({ roadTrips: [road], activeProfileId: 'p' }), { transports: [], accommodations: [], places: [], notes: [] });
});

test('reordering and insertion preserve details on unchanged endpoint pairs', () => {
  const road = journey();
  road.segments[0].mode = 'bus';
  road.segments[0].notes = 'Booking and route notes';
  road.segments[0].media = { src: 'data:image/png;base64,AA==', name: 'Operator' };
  const original = structuredClone(road), saved = structuredClone(road.segments[0]);
  const extended = M.reconcile({ ...road, stops: [...road.stops, stop('d', 'Hotel')] });
  assert.deepEqual(extended.segments[0], saved);
  const moved = M.reconcile({ ...extended, stops: [extended.stops[0], extended.stops[1], extended.stops[3], extended.stops[2]] });
  assert.deepEqual(moved.segments[0], saved);
  assert.equal(moved.segments[1].mode, 'other');
  assert.deepEqual(moved.segments.map(segment => [segment.fromStopId, segment.toStopId]), [['a', 'b'], ['b', 'd'], ['d', 'c']]);
  assert.deepEqual(road, original);
});

test('removal yields connected sections without dangling references or discarded unrelated details', () => {
  const road = journey();
  road.custom = { preserve: 'unknown metadata' };
  const changed = M.reconcile({ ...road, stops: [road.stops[0], road.stops[2]] });
  assert.equal(changed.segments.length, 1);
  assert.equal(changed.segments[0].fromStopId, 'a');
  assert.equal(changed.segments[0].toStopId, 'c');
  assert.deepEqual(changed.custom, road.custom);
  assert.equal(M.validate(changed), '');
});

test('structural edits retain displaced bookings and media across save, restore and explicit detail copying', () => {
  const road = journey(), original = road.segments[0];
  Object.assign(original, {mode:'bus', departureLocal:'2026-12-01', bookingReference:'KEEP-ME', notes:'Board by the lake', cost:{amount:25,currency:'USD'}, media:[{name:'logo.webp',src:'data:image/webp;base64,AAAA'}]});
  original.route = {kind:'manual',coordinates:[[10,20],[10.1,20.1]],signature:M.segmentSignature(original,road.stops[0],road.stops[1])};
  const before = structuredClone(road);
  const changed = M.reconcile({...road,stops:[road.stops[0],stop('new','Transfer'),...road.stops.slice(1)]});
  assert.equal(changed.previousSegments.length,1);
  assert.deepEqual(changed.previousSegments[0],original);
  assert.equal(changed.segments[0].bookingReference,undefined);
  const saved = M.normalize(JSON.parse(JSON.stringify(changed)));
  assert.deepEqual(saved.previousSegments[0],original);
  assert.equal(M.calendarEntries({roadTrips:[saved],activeProfileId:'p'}).transports.length,0,'Archived dates are not extra calendar bookings');
  saved.segments[0].notes='Keep this new connection note';
  const copied = M.copyPreviousDetails(saved,original.id,saved.segments[0].id);
  assert.equal(copied.segments[0].bookingReference,'KEEP-ME');
  assert.equal(copied.segments[0].notes,'Keep this new connection note');
  assert.deepEqual(copied.segments[0].media,original.media);
  assert.equal(copied.segments[0].route,undefined,'An old path is not attached to different endpoints');
  assert.deepEqual(copied.previousSegments[0],original);
  const restored = M.reconcile({...saved,stops:road.stops});
  assert.deepEqual(restored.segments[0],original);
  assert.equal(M.validate(restored),'');
  assert.deepEqual(road,before,'Structural recovery never mutates its input');
});

test('cached geometry survives unchanged sections and is invalidated after position or mode changes', () => {
  const road = journey(), segment = road.segments[0];
  segment.route = { kind: 'manual', coordinates: [[10, 20], [10.05, 20.01], [10.1, 20.1]], signature: M.segmentSignature(segment, road.stops[0], road.stops[1]), note: 'Exact drawn geometry' };
  assert.deepEqual(M.reconcile(road).segments[0].route, segment.route);
  const moved = structuredClone(road);
  moved.stops[1].lon += 1;
  assert.equal(M.reconcile(moved).segments[0].route, undefined);
  const mode = structuredClone(road);
  mode.segments[0].mode = 'ferry';
  assert.equal(M.reconcile(mode).segments[0].route, undefined);
  assert.equal(segment.route.note, 'Exact drawn geometry');
});

test('legacy road routes normalize without changing original fields, identifiers or encoded geometry', () => {
  const stops = [{ name: 'Paris', address: 'France', lat: 48.85, lon: 2.35, date: '2026-12-01', unknownStop: 'keep' }, { name: 'Lyon', address: 'France', lat: 45.76, lon: 4.83 }];
  const coordinates = [[48.85, 2.35], [47, 3], [45.76, 4.83]], polyline = R.encode(coordinates);
  const source = { id: 'legacy', tripId: 'original-trip', linkedTransportId: 'original-transport', notesId: 'original-note', name: 'France road route', status: 'planned', startDate: '2026-12-01', endDate: '2026-12-03', stops, estimator: { efficiency: 5 }, custom: { keep: true }, route: { signature: JSON.stringify(['road-v1', stops.map(point => [point.name, point.address, point.lat, point.lon])]), legs: [{ polyline, distance: 500000, duration: 18000, customLeg: 'preserve' }] } };
  const before = structuredClone(source), normalized = M.normalize(source);
  assert.deepEqual(source, before);
  assert.equal(normalized.plannerVersion, 2);
  for (const field of ['tripId', 'linkedTransportId', 'notesId', 'route', 'custom', 'estimator']) assert.deepEqual(normalized[field], source[field]);
  assert.equal(normalized.stops[0].unknownStop, 'keep');
  assert.equal(normalized.segments[0].mode, 'car');
  assert.equal(normalized.segments[0].route.polyline, polyline);
  assert.deepEqual(M.coordinates(normalized.segments[0].route), coordinates);
  assert.equal(normalized.segments[0].route.customLeg, 'preserve');
  assert.deepEqual(M.normalize(normalized), normalized);
  assert.deepEqual(M.normalize(source).stops.map(point => point.id), normalized.stops.map(point => point.id));
});

test('dated projections always reflect the canonical graph and date removal does not resurrect legacy dates', () => {
  const road = journey();
  road.startDate = '2020-01-01';
  road.endDate = '2020-01-02';
  road.segments[0].mode = 'bus';
  road.segments[0].departureLocal = '2026-12-01T09:00';
  road.segments[0].arrivalLocal = '2026-12-01T12:00';
  road.stops[1].arrivalLocal = '2026-12-01';
  road.stops[1].accommodation = { name: 'Lake Hotel', checkIn: '2026-12-01', checkOut: '2026-12-03', bookingReference: 'KEEP-123' };
  road.stops[1].activities = [{ id: 'walk', name: 'Lake walk', date: '2026-12-02', notes: 'Meet at reception' }];
  const state = { roadTrips: [road], activeProfileId: 'p' }, before = structuredClone(state), entries = M.calendarEntries(state);
  assert.equal(entries.transports.length, 1);
  assert.equal(entries.transports[0].startLocal, '2026-12-01T09:00');
  assert.equal(entries.accommodations[0].bookingReference, 'KEEP-123');
  assert.equal(entries.notes[0].title, 'Lake walk');
  assert.deepEqual(M.findEntry(state, entries.transports[0].id), { plannerId: road.id, segmentId: road.segments[0].id });
  assert.deepEqual(M.findEntry(state, entries.accommodations[0].id), { plannerId: road.id, stopId: 'b' });
  road.segments[0].departureLocal = '2026-12-02T09:00';
  assert.equal(M.calendarEntries(state).transports[0].startLocal, '2026-12-02T09:00');
  road.segments[0].departureLocal = '';
  road.segments[0].arrivalLocal = '';
  road.stops[1].arrivalLocal = '';
  road.stops[1].accommodation.checkIn = '';
  road.stops[1].accommodation.checkOut = '';
  road.stops[1].activities[0].date = '';
  assert.deepEqual(M.calendarEntries(state), { transports: [], accommodations: [], places: [], notes: [] });
  assert.equal(M.findEntry(state, entries.transports[0].id), null);
  assert.deepEqual(before.roadTrips[0].segments[0].departureLocal, '2026-12-01T09:00');
});

test('projection ownership and legacy suppression respect exact identifiers and cancellation', () => {
  const road = journey();
  road.linkedTransportId = 'linked';
  road.segments[0].departureLocal = '2026-12-01';
  const state = { roadTrips: [road], activeProfileId: 'other' };
  assert.equal(M.calendarEntries(state).transports.length, 0);
  assert.equal(M.calendarEntries(state, 'all').transports.length, 1);
  assert.equal(M.hiddenLegacyTransport(state, { id: 'linked', roadTripId: road.id }), false);
  assert.equal(M.hiddenLegacyTransport(state, { id: 'linked', roadTripId: road.id }, 'p'), true);
  assert.equal(M.hiddenLegacyTransport(state, { id: 'unrelated', roadTripId: road.id }), false);
  assert.equal(M.hiddenLegacyTransport(state, { id: 'linked', roadTripId: 'unrelated' }), false);
  assert.equal(M.hiddenLegacyTransport({ roadTrips: [{ ...road, plannerVersion: undefined }] }, { id: 'linked', roadTripId: road.id }), false);
  road.status = 'cancelled';
  assert.equal(M.calendarEntries(state, 'all').transports.length, 0);
});

test('repeated provider IDs become distinct waypoint IDs and synthetic entry IDs handle reserved characters', () => {
  const road = M.normalize({ id: 'route:a/b?', name: 'Repeat visit', stops: [stop('osm:123', 'Hotel'), stop('osm:123', 'Hotel')], status: 'idea' });
  assert.notEqual(road.stops[0].id, road.stops[1].id);
  road.segments[0].departureLocal = '2026-12-01';
  const state = { roadTrips: [road] }, entry = M.calendarEntries(state).transports[0];
  assert.deepEqual(M.findEntry(state, entry.id), { plannerId: road.id, segmentId: road.segments[0].id });
  assert.equal(M.validate(road), '');
});

test('invalid dates, geography, modes, ordering and geometry receive validation messages', () => {
  const road = journey();
  road.segments[0].departureLocal = '2026-02-30';
  assert.match(M.validate(road), /dates/);
  road.segments[0].departureLocal = '2026-12-01T25:00';
  assert.match(M.validate(road), /dates/);
  road.segments[0].departureLocal = '';
  road.stops[0].lat = 100;
  assert.match(M.validate(road), /coordinates/);
  road.stops[0].lat = 10;
  road.segments[0].mode = 'invented';
  assert.match(M.validate(road), /transport method/);
  road.segments[0].mode = 'boat';
  road.segments[0].toStopId = 'absent';
  assert.match(M.validate(road), /order/);
  road.segments[0].toStopId = 'b';
  road.segments[0].route = { coordinates: [[10, 20], [10, 200]] };
  assert.match(M.validate(road), /coordinates/);
  assert.deepEqual(M.coordinates({ polyline: '_' }), []);
  assert.deepEqual(M.normalize().stops, []);
});

test('the browser model validates without app, map, routing or network globals', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../trip-planner-model.js'), 'utf8'), context);
  const browser = context.HVTripPlannerModel, road = journey();
  road.segments[0].route = { polyline: R.encode([[10, 20], [10.1, 20.1]]) };
  assert.equal(browser.validate(road), '');
  assert.equal(browser.coordinates(road.segments[0].route).length, 2);
});

test('existing multi-leg transport conversion retains source IDs, dates, details and exact saved geometry', () => {
  const a = stop('airport-a', 'London', 51, 0), b = stop('airport-b', 'Madrid', 40, -3), c = stop('airport-c', 'San José', 10, -84);
  const transport = { id: 'flight-one', tripId: 'trip', profileId: 'p', type: 'flight', status: 'planned', start:a, end:c, startLocal:'2026-12-01T09:00', endLocal:'2026-12-01T22:00', bookingReference:'KEEP-BOOKING', notes:'Keep flight notes', custom:{provider:'preserve'}, legs:[{start:a,end:b,startLocal:'2026-12-01T09:00',endLocal:'2026-12-01T12:00',flightNumber:'F1',airline:{name:'Fixture Air'}},{start:b,end:c,startLocal:'2026-12-01T14:00',endLocal:'2026-12-01T22:00',flightNumber:'F2',airline:{name:'Fixture Air'}}] };
  transport.price = { amount: 500, currency: 'GBP' };
  transport.legs[1].price = { amount: 80, currency: 'EUR' };
  R.set(transport,0,'flight',a,b,{coordinates:[[51,0],[46,-1],[40,-3]],label:'Saved first leg'});
  const state = {activeProfileId:'p',transports:[transport]}, before = structuredClone(state);
  const draft = M.fromExisting(state,{transportId:transport.id});
  assert.equal(M.validate(draft),'');
  assert.equal(draft.stops.length,3);
  assert.equal(draft.segments.length,2);
  assert.deepEqual(draft.segments.map(segment=>segment.mode),['flight','flight']);
  assert.deepEqual(draft.segments.map(segment=>segment.serviceNumber),['F1','F2']);
  assert.deepEqual(M.coordinates(draft.segments[0].route),[[51,0],[46,-1],[40,-3]]);
  assert.equal(draft.segments[0].bookingReference,'KEEP-BOOKING');
  assert.equal(draft.segments[0].cost,null,'The full booking cost is not assigned to every flight leg');
  assert.deepEqual(draft.segments[1].cost,{amount:80,currency:'EUR'});
  assert.equal(draft.segments[0].legs,undefined);
  assert.equal(draft.segments[0].resolvedRoutes,undefined);
  assert.equal(draft.segments[0].price,undefined);
  assert.deepEqual(draft.segments[0].custom,transport.custom);
  assert.deepEqual(draft.segments[0].sourceRecord,{collection:'transports',id:'flight-one',tripId:'trip',profileId:'p'});
  assert.equal(draft.segments[1].sourceLegIndex,1);
  assert.deepEqual(M.fromExisting(state,{transportId:transport.id}).segments.map(segment=>segment.id),draft.segments.map(segment=>segment.id));
  assert.equal(M.hiddenLegacyRecord(state,'transports',transport),false);
  state.roadTrips=[draft];
  assert.equal(M.hiddenLegacyRecord(state,'transports',transport),true);
  assert.equal(M.hiddenLegacyRecord(state,'transports',{...transport,profileId:'another-traveller'}),false);
  assert.equal(M.hiddenLegacyRecord(state,'transports',{...transport,tripId:'another-trip'}),false);
  assert.deepEqual(state.transports,before.transports);
  const projection=M.calendarEntries(state);
  assert.equal(projection.transports.length,2);
  assert.equal(projection.places.length,0,'Transport timing is held on segments instead of independently dated stop copies');
});

test('existing standalone accommodation opens as one real destination and suppresses only its owned source after saving', () => {
  const hotel={id:'hotel-one',profileId:'p',tripId:'trip',propertyName:'Lake House',location:'Arenal',checkIn:'2026-12-01',checkOut:'2026-12-03',bookingReference:'HOTEL-KEEP',place:{id:'osm:hotel',name:'Lake House',lat:10.46,lon:-84.74},media:[{src:'data:image/png;base64,AA=='}],custom:{keep:true}};
  const state={activeProfileId:'p',accommodations:[hotel]},before=structuredClone(state);
  const draft=M.fromExisting(state,{accommodationId:hotel.id});
  assert.equal(draft.stops.length,1);
  assert.equal(M.validate(draft),'');
  assert.equal(draft.stops[0].accommodation.id,hotel.id);
  assert.deepEqual(draft.stops[0].accommodation.custom,hotel.custom);
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',hotel),false);
  state.roadTrips=[draft];
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',hotel),true);
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',{...hotel,id:'other-hotel'}),false);
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',{...hotel,profileId:'q'}),false);
  assert.deepEqual(state.accommodations,before.accommodations);
  const projected=M.calendarEntries(state);
  assert.equal(projected.accommodations.length,1);
  assert.equal(projected.accommodations[0].checkIn,'2026-12-01');
  assert.equal(projected.places.length,0);
  assert.deepEqual(M.findEntry(state,projected.accommodations[0].id),{plannerId:draft.id,stopId:draft.stops[0].id});
});

test('trip conversion consumes scoped transport and accommodation while preserving other travellers and source rows', () => {
  const transport={id:'bus-one',tripId:'trip',profileId:'p',type:'bus',status:'planned',start:stop('a','Town',10,20),end:stop('b','Hotel',11,21),startLocal:'2026-12-01T09:00',endLocal:'2026-12-01T12:00'};
  const hotel={id:'hotel-one',tripId:'trip',profileId:'p',propertyName:'Hotel',location:'Town',place:stop('b','Hotel',11,21),checkIn:'2026-12-01',checkOut:'2026-12-02'};
  const another={...transport,id:'other-traveller',profileId:'q'};
  const state={activeProfileId:'p',trips:[{id:'trip',name:'Lake trip',profileId:'p',notes:'Trip notes'}],transports:[transport,another],accommodations:[hotel]},before=structuredClone(state);
  const draft=M.fromExisting(state,{tripId:'trip'});
  assert.equal(M.validate(draft),'');
  assert.equal(draft.name,'Lake trip');
  assert.equal(draft.notes,'Trip notes');
  assert.deepEqual(draft.sourceRecords.map(source=>source.id).sort(),['bus-one','hotel-one']);
  assert.deepEqual(state,before);
  state.roadTrips=[draft];
  assert.equal(M.hiddenLegacyRecord(state,'transports',another),false);
  state.activeProfileId='q';
  assert.equal(M.hiddenLegacyRecord(state,'transports',transport),false,'A traveller-specific graph does not hide shared source rows outside its view');
  assert.equal(M.fromExisting(state,{transportId:'missing'}),null);
});

test('explicit traveller projection governs suppression independently of the active profile', () => {
  const hotel={id:'shared-hotel',propertyName:'Shared hotel',location:'Costa Rica',checkIn:'2026-12-01',checkOut:'2026-12-03'};
  const state={activeProfileId:'p',accommodations:[hotel]};
  state.roadTrips=[M.fromExisting(state,{accommodationId:hotel.id})];
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',hotel,'p'),true);
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',hotel,'q'),false);
  assert.equal(M.hiddenLegacyRecord(state,'accommodations',hotel,'all'),true);
  assert.equal(M.calendarEntries(state,'p').accommodations.length,1);
  assert.equal(M.calendarEntries(state,'q').accommodations.length,0);
  assert.equal(state.activeProfileId,'p');
});

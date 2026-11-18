'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../simple-calendar.js');

test('week navigation uses Monday and crosses months and years without local-time drift', () => {
  assert.deepEqual(calendar.viewRange('2027-01-01', 'week'), {start:'2026-12-28', count:7});
  assert.equal(calendar.shiftAnchor('2026-12-28', 'week', 1), '2027-01-04');
  assert.equal(calendar.shiftAnchor('2026-03-01', 'day', -1), '2026-02-28');
  assert.equal(calendar.shiftAnchor('2028-03-01', 'day', -1), '2028-02-29');
  assert.equal(calendar.shiftAnchor('2026-12-31', 'month', 1), '2027-01-01');
  assert.equal(calendar.isDate('2026-02-30'), false);
});

test('day entries retain overnight transport, checkout and incoming stay semantics', () => {
  const outgoing = {id:'old', propertyName:'Old hotel', checkIn:'2026-12-01', checkOut:'2026-12-02', checkOutTime:'10:00'};
  const incoming = {id:'new', propertyName:'New hotel', checkIn:'2026-12-02', checkOut:'2026-12-03', checkInTime:'15:00'};
  const train = {id:'train', type:'train', start:{name:'A'}, end:{name:'B'}, startLocal:'2026-12-01T22:00', endLocal:'2026-12-02T06:00'};
  const note = {id:'activity', title:'Walking tour', category:'Activity', body:'Meet at the station'};
  const rows = calendar.dayEntries({date:'2026-12-02', stays:[], accommodations:[incoming,outgoing], transports:[train], notes:[note]});
  assert.deepEqual(rows.filter(entry=>entry.kind==='accommodation').map(entry=>entry.row.id), ['old','new']);
  assert.deepEqual(rows.filter(entry=>entry.time).map(entry=>entry.row.id), ['train','old','new']);
  assert.equal(rows.find(entry=>entry.row===train).time, '06:00');
  assert.match(rows.find(entry=>entry.row===train).detail, /Arrival/);
  assert.equal(rows.find(entry=>entry.row===note).kind, 'note');
  assert.equal(outgoing.checkOut, '2026-12-02');
});

test('week and day share chronological times while retaining untimed multi-day context', () => {
  const hotel = {id:'checkin', propertyName:'Afternoon hotel', checkIn:'2026-12-01', checkOut:'2026-12-03', checkInTime:'15:00'};
  const ongoing = {id:'ongoing', propertyName:'Ongoing booking', checkIn:'2026-11-30', checkOut:'2026-12-03', checkInTime:'14:00'};
  const bus = {id:'bus', type:'bus', start:{name:'A'}, end:{name:'B'}, startLocal:'2026-12-01T09:00', endLocal:'2026-12-01T12:00'};
  const multiDay = {id:'crossing', type:'boat', start:{name:'C'}, end:{name:'D'}, startLocal:'2026-11-30T18:00', endLocal:'2026-12-02T06:00'};
  const day = {date:'2026-12-01', stays:[{id:'country',countryName:'Costa Rica'}], accommodations:[hotel,ongoing], transports:[bus,multiDay], notes:[]};
  const before = JSON.stringify(day);
  const rows = calendar.dayEntries(day);
  assert.deepEqual(rows.map(entry=>entry.row.id), ['country','ongoing','crossing','bus','checkin']);
  assert.equal(rows.find(entry=>entry.row===ongoing).time, '');
  assert.equal(rows.find(entry=>entry.row===multiDay).time, '');
  assert.match(rows.find(entry=>entry.row===multiDay).detail, /Travelling/);
  assert.equal(JSON.stringify(day), before, 'Ordering does not change persisted dates or times');
});

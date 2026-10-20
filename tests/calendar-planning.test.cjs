'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../calendar-planning-model.js'),C=require('../calendar-data-model.js'),J=require('../journey-model.js'),M=require('../account-model.js');
const base=()=>({version:2,activeProfileId:'p',profiles:[{id:'p',citizenships:[],enabledRules:['schengen']}],trips:[],stays:[],accommodations:[],transports:[],notes:[],placeVisits:[],calendarPlans:[]});
const country=(id='plan')=>({id,kind:'country',profileId:'p',record:{id:'record-'+id,profileId:'p',countryCode:'CR',countryName:'Costa Rica',start:'2026-11-29',end:'2026-12-07',status:'planned',notes:'Keep this',unknown:{nested:'preserve'}}});
test('tentative country, hotel, every transport mode, notes and places never enter shared travel windows or totals',()=>{
  const data=base(),plan=country();data.calendarPlans.push(plan);
  for(const type of Object.keys(J.types))data.calendarPlans.push({id:type,kind:'transport',profileId:'p',record:{id:'t-'+type,type,profileId:'p',start:{name:'Start',lat:1,lon:2},end:{name:'End',lat:3,lon:4},startLocal:'2026-12-01T10:00',endLocal:'2026-12-02T11:00',resolvedRoutes:{keep:'route'}}});
  data.calendarPlans.push({id:'hotel',kind:'accommodation',record:{id:'a',propertyName:'Hotel',location:'San José',checkIn:'2026-11-29',checkOut:'2026-12-07'}});
  data.calendarPlans.push({id:'note',kind:'note',record:{id:'n',title:'Visa',date:'2026-12-01',endDate:'2026-12-03'}});
  data.calendarPlans.push({id:'place',kind:'location',record:{id:'l',place:{name:'Market'},date:'2026-12-01',endDate:'2026-12-02'}});
  const snapshot=P.copy(data),window=C.window(data,'2026-11-29',14),shown=P.projectWindow(data,window),hidden=P.projectWindow(data,window,false);
  assert.equal(window.get('2026-12-01').stays.length,0);assert.equal(window.get('2026-12-01').transports.length,0);
  assert.equal(shown.get('2026-12-01').transports.length,7);assert.equal(shown.get('2026-12-02').notes.length,1);assert.equal(shown.get('2026-12-01').stays.length,1);
  assert.equal(hidden.get('2026-12-01').stays.length,0);assert.equal(J.summary(data,'2027-01-01').countries.has('CR'),false);assert.equal(J.visibleTransport(data).length,0);
  assert.deepEqual(data,snapshot);assert.equal(P.projectWindow(data,window,true,'another').get('2026-12-01').stays.length,0);
});
test('move keeps the inclusive duration across weeks, months, leap days and years; resize validates dates',()=>{
  const plan=country(),snapshot=P.copy(plan),moved=P.move(plan,6);
  assert.deepEqual(P.range(moved.kind,moved.record),['2026-12-05','2026-12-13']);
  assert.deepEqual(P.range('country',P.reschedule(plan,'2026-11-29','2026-12-10').record),['2026-11-29','2026-12-10']);
  assert.deepEqual(P.range('country',P.reschedule(plan,'2026-12-01','2026-12-07').record),['2026-12-01','2026-12-07']);
  assert.throws(()=>P.reschedule(plan,'2026-12-10','2026-12-07'));
  const leap={...plan,record:{...plan.record,start:'2028-02-28',end:'2028-03-01'}};
  assert.deepEqual(P.range('country',P.move(leap,1).record),['2028-02-29','2028-03-02']);
  const year={...plan,record:{...plan.record,start:'2026-12-29',end:'2027-01-02'}};
  assert.deepEqual(P.range('country',P.move(year,4).record),['2027-01-02','2027-01-06']);assert.deepEqual(plan,snapshot);
});
test('moving multi-leg flights preserves local clocks, relative leg dates, routes, logos and arbitrary fields',()=>{
  const first={start:{name:'SJO',airportId:'sjo'},end:{name:'PTY',airportId:'pty'},startLocal:'2026-11-29T22:00',endLocal:'2026-11-30T01:00',resolvedRoutes:{geometry:[[1,2],[3,4]]}};
  const last={start:{name:'PTY'},end:{name:'BOG'},startLocal:'2026-11-30T07:00',endLocal:'2026-11-30T09:00'};
  const plan={id:'flight',kind:'transport',record:{id:'f',type:'flight',start:first.start,end:last.end,startLocal:first.startLocal,endLocal:last.endLocal,legs:[first,last],logo:'data:keep',resolvedRoutes:{preserve:true}}};
  const moved=P.move(plan,6);assert.equal(moved.record.startLocal,'2026-12-05T22:00');assert.equal(moved.record.legs[1].startLocal,'2026-12-06T07:00');assert.deepEqual(moved.record.resolvedRoutes,plan.record.resolvedRoutes);assert.deepEqual(moved.record.legs[0].resolvedRoutes,first.resolvedRoutes);
  const long=P.copy(plan);long.record.endLocal='2026-12-01T09:00';long.record.legs[1].endLocal=long.record.endLocal;
  assert.throws(()=>P.reschedule(long,'2026-11-29','2026-11-29'),/connecting legs/);
});
test('confirmation and returning to tentative preserve IDs and complete payloads, with no duplicate confirmation',()=>{
  const data=base(),plan=country();data.calendarPlans.push(plan);const original=P.copy(plan.record);
  P.confirm(data,plan.id);assert.equal(data.calendarPlans.length,0);assert.deepEqual(data.stays,[original]);assert.equal(J.summary(data,'2027-01-01').countries.has('CR'),true);
  P.makeTentative(data,'country',original.id,'again');assert.equal(data.stays.length,0);assert.deepEqual(data.calendarPlans[0].record,original);assert.equal(J.summary(data,'2027-01-01').countries.has('CR'),false);
  P.confirm(data,'again');assert.deepEqual(data.stays,[original]);assert.throws(()=>P.confirm(data,'again'));assert.deepEqual(data.stays,[original]);
});
test('automatic hotel country records move with the tentative hotel and restore together',()=>{
  const data=base();data.profiles[0].homeCountryCodes=['GB'];
  const hotel={id:'hotel',profileId:'p',propertyName:'Home holiday',location:'York',place:{countryCode:'GB',countryName:'United Kingdom'},travelKind:'trip',checkIn:'2026-11-29',checkOut:'2026-12-07',accommodationLogo:{src:'preserve'}};
  data.accommodations.push(hotel);J.syncAccommodationStay(data,hotel,'2026-10-20');assert.equal(data.stays.length,1);
  const stay=P.copy(data.stays[0]);P.makeTentative(data,'accommodation','hotel','hotel-plan');assert.equal(data.stays.length,0);assert.equal(data.accommodations.length,0);
  data.calendarPlans[0]=P.move(data.calendarPlans[0],6);P.confirm(data,'hotel-plan');
  assert.equal(data.stays[0].id,stay.id);assert.equal(data.stays[0].start,'2026-12-05');assert.equal(data.accommodations[0].checkOut,'2026-12-13');assert.deepEqual(data.accommodations[0].accommodationLogo,hotel.accommodationLogo);
});
test('account merge, import and validation include tentative plans without changing confirmed records',()=>{
  const data=base();data.calendarPlans.push(country());
  const local=P.copy(data),remote=P.copy(data);local.calendarPlans[0]=P.move(local.calendarPlans[0],1);remote.calendarPlans.push(country('second'));
  const merged=M.merge(data,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.calendarPlans.length,2);assert.equal(merged.data.calendarPlans[0].record.start,'2026-11-30');assert.deepEqual(merged.data.stays,[]);
  assert.doesNotThrow(()=>M.validateImport(merged.data));const imported=M.importData(base(),merged.data);assert.equal(imported.data.calendarPlans.length,2);
  assert.deepEqual(M.importData(imported.data,merged.data).data,imported.data);
  const broken=P.copy(data);broken.calendarPlans[0].record.end='2026-01-01';assert.throws(()=>M.validateImport(broken));
});

test('date-line flights and dated ground vias move without changing their local chronology',()=>{
  const flight={id:'dateline',kind:'transport',record:{id:'dateline-record',type:'flight',start:{name:'Tokyo'},end:{name:'Honolulu'},startLocal:'2026-12-02T00:30',endLocal:'2026-12-01T13:00'}};
  assert.deepEqual(P.range('transport',flight.record),['2026-12-01','2026-12-02']);
  const moved=P.move(flight,5);assert.equal(moved.record.startLocal,'2026-12-07T00:30');assert.equal(moved.record.endLocal,'2026-12-06T13:00');
  const bus={id:'via',kind:'transport',record:{id:'via-record',type:'bus',start:{name:'San José'},end:{name:'Panama City'},startLocal:'2026-12-01T22:00',endLocal:'2026-12-03T10:00',via:[{name:'David',arrivalLocal:'2026-12-02T05:00',departureLocal:'2026-12-02T09:00'}]}};
  assert.equal(P.move(bus,6).record.via[0].arrivalLocal,'2026-12-08T05:00');
  const one={...flight,record:{...flight.record,startLocal:'2026-12-01T12:00',endLocal:'2026-12-01T15:00'}};
  assert.equal(P.reschedule(one,'2026-12-01','2026-12-02').record.endLocal,'2026-12-02T15:00');
});

test('two devices resolve confirmation versus date edits as one lifecycle decision',()=>{
  const baseData=base();baseData.calendarPlans.push(country());const local=P.copy(baseData),remote=P.copy(baseData);
  P.confirm(local,'plan');remote.calendarPlans[0]=P.move(remote.calendarPlans[0],6);
  const preferTentative=M.merge(baseData,local,remote,c=>c.remote);assert.ok(preferTentative.conflicts.some(c=>c.path.endsWith('.confirmation')));assert.equal(preferTentative.data.stays.length,0);assert.equal(preferTentative.data.calendarPlans[0].record.start,'2026-12-05');
  const preferConfirmed=M.merge(baseData,local,remote,c=>c.local);assert.equal(preferConfirmed.data.stays.length,1);assert.equal(preferConfirmed.data.calendarPlans.length,0);
});
test('concurrent date changes are resolved together rather than producing a backwards range',()=>{
  const baseData=base();baseData.calendarPlans.push(country());const local=P.copy(baseData),remote=P.copy(baseData);
  local.calendarPlans[0]=P.move(local.calendarPlans[0],40);remote.calendarPlans[0]=P.reschedule(remote.calendarPlans[0],'2026-11-29','2026-12-01');
  const merged=M.merge(baseData,local,remote,c=>c.local);assert.ok(merged.conflicts.some(c=>c.path.endsWith('.calendarTiming')));assert.equal(P.validate(merged.data.calendarPlans[0]),'');assert.deepEqual(merged.data.calendarPlans[0],local.calendarPlans[0]);
});

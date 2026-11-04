'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model.js'),D=require('../transport-dashboard-model.js'),P=require('../calendar-planning-model.js'),A=require('../account-model.js');
const point=zone=>({name:'Example stop',timeZone:zone});
const transport=(startLocal,endLocal,startZone='Europe/London',endZone=startZone)=>({id:'existing',profileId:'p',type:'flight',start:point(startZone),end:point(endZone),startLocal,endLocal,notes:'Original note',custom:{keep:true}});

test('nonexistent local times never silently move to another hour',()=>{
  assert.equal(J.resolveLocalTime('2026-03-29T01:30','Europe/London').status,'nonexistent');
  assert.equal(D.instant('2026-03-29T01:30','Europe/London'),null);
  assert.match(J.validateTransport(transport('2026-03-29T01:30','2026-03-29T04:00')),/Departure local time does not exist/);
  assert.equal(J.resolveLocalTime('2026-10-04T02:15','Australia/Lord_Howe').status,'nonexistent','Half-hour DST gap');
  assert.equal(J.resolveLocalTime('2011-12-30T12:00','Pacific/Apia').status,'nonexistent','Skipped calendar day');
});
test('both occurrences of a repeated local time require explicit earlier/later choice',()=>{
  const result=J.resolveLocalTime('2026-10-25T01:30','Europe/London');
  assert.equal(result.status,'ambiguous');
  assert.deepEqual(result.instants,[Date.parse('2026-10-25T00:30Z'),Date.parse('2026-10-25T01:30Z')]);
  assert.equal(D.instant('2026-10-25T01:30','Europe/London'),null);
  for(const [choice,utc]of [['earlier','2026-10-25T00:30Z'],['later','2026-10-25T01:30Z']]){
    assert.equal(D.instant('2026-10-25T01:30','Europe/London',choice),Date.parse(utc));
    assert.equal(J.validateTransport({...transport('2026-10-25T01:30','2026-10-25T04:00'),startDisambiguation:choice}),'');
  }
  assert.match(J.validateTransport(transport('2026-10-25T01:30','2026-10-25T04:00')),/Choose the earlier or later/);
});
test('known instants determine chronology while overnight and Date Line flights stay valid',()=>{
  assert.match(J.validateTransport(transport('2026-12-01T10:00','2026-12-01T09:00')),/Arrival must be after/);
  assert.equal(J.validateTransport(transport('2026-12-01T23:00','2026-12-02T06:00')),'');
  const record=transport('2026-10-20T19:00','2026-10-20T01:00','Pacific/Auckland','Pacific/Tahiti');
  assert.equal(J.validateTransport(record),'');
  assert.equal((D.instant(record.endLocal,'Pacific/Tahiti')-D.instant(record.startLocal,'Pacific/Auckland'))/3600000,5);
});
test('missing and invalid zones remain unknown with no viewer-zone countdown',()=>{
  for(const zone of ['', 'Invalid/Not_A_Zone']){
    assert.equal(J.resolveLocalTime('2026-12-01T12:00',zone).status,'unknown');
    assert.equal(D.instant('2026-12-01T12:00',zone),null);
    const row=D.rows({activeProfileId:'p',trips:[],transports:[transport('2026-12-01T12:00','2026-12-01T13:00',zone)]})[0];
    assert.deepEqual(D.countdown(row,Date.parse('2026-12-01T10:00Z')),{value:'',unit:zone?'Time zone unrecognised':'Time zone not recorded'});
  }
  assert.equal(D.instant('2026-12-01T12:00+02:00',''),Date.parse('2026-12-01T10:00Z'));
});
test('legacy ambiguous and gap records stay visible and export unchanged; new plan writes validate',()=>{
  const record=transport('2026-03-29T01:30','2026-03-29T04:00');
  const plan={id:'plan',kind:'transport',profileId:'p',record};
  const data={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Example traveller'}],trips:[],stays:[],transports:[record],calendarPlans:[plan]};
  const before=structuredClone(data);
  D.rows(data).forEach(row=>D.countdown(row,Date.parse('2026-03-29T00:00Z')));
  assert.equal(P.visible(data).length,1,'Reading does not hide a legacy plan');
  assert.equal(P.validate(plan),'');
  assert.match(P.validate(plan,{times:true}),/does not exist/);
  assert.throws(()=>P.confirm(data,'plan'),/does not exist/);
  assert.deepEqual(A.validateImport(data).transports,data.transports);
  assert.deepEqual(data,before,'Reading, validation and refused confirmation do not mutate source');
});
test('rescheduling a tentative transport checks the new DST date without changing the original',()=>{
  const plan={id:'plan',kind:'transport',profileId:'p',record:transport('2026-03-28T01:30','2026-03-28T04:00')},before=structuredClone(plan);
  assert.throws(()=>P.move(plan,1),/does not exist/);
  assert.deepEqual(plan,before);
  const resolved={...plan,record:{...plan.record,startLocal:'2026-10-25T01:30',endLocal:'2026-10-25T04:00',startDisambiguation:'earlier'}};
  assert.equal(J.flightLegs(resolved.record)[0].startDisambiguation,'earlier');
  assert.equal(P.validate(resolved,{times:true}),'');
});

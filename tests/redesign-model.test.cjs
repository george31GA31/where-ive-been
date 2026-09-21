const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model.js'),M=require('../account-model.js');

test('malformed imports are rejected before replacing live state',()=>{
  assert.throws(()=>M.validateImport(null));assert.throws(()=>M.validateImport({stays:{}}));
  assert.throws(()=>M.validateImport({stays:[{id:'s',countryCode:'FR',start:'2026-02-30',end:'2026-03-01'}]}));
  assert.throws(()=>M.validateImport({trips:[{id:'a'},{id:'a'}]}));
  const valid={stays:[{id:'s',countryCode:'FR',start:'2026-01-01',end:'2026-01-02'}]};
  assert.equal(M.validateImport(valid),valid);
});

test('past plans require confirmation without inventing history or changing dates',()=>{
  const stays=[{id:'past',status:'planned',start:'2026-01-01',end:'2026-01-10'},{id:'today',status:'planned',start:'2026-01-05',end:'2026-01-10'}];
  assert.equal(J.reviewPlanned(stays,'2026-01-05'),true);
  assert.equal(stays[0].status,'unconfirmed');assert.equal(stays.length,2);
  assert.equal(stays[0].start,'2026-01-01');assert.equal(stays[1].status,'planned');
  stays[0].status='planned';stays[0].plannedReviewStart=stays[0].start;
  assert.equal(J.reviewPlanned(stays,'2026-01-05'),false);
  stays[0].start='2026-01-02';assert.equal(J.reviewPlanned(stays,'2026-01-05'),true);
});

test('cancelled, unconfirmed and another traveller never become completed travel',()=>{
  const s={activeProfileId:'p',profiles:[{id:'p'}],residences:[],stays:['cancelled','unconfirmed','planned'].map(status=>({profileId:'p',countryCode:'FR',start:'2026-01-01',end:'2026-01-02',status}))};
  s.stays.push({profileId:'other',countryCode:'GB',start:'2026-01-01',end:'2026-01-02',status:'actual'});
  assert.equal(J.dayStatus(s,'2026-01-01'),'unrecorded');
  assert.equal(J.countsForPlanning(s.stays[0]),false);assert.equal(J.countsForPlanning(s.stays[1]),false);assert.equal(J.countsForPlanning(s.stays[2]),true);
  s.stays.push({profileId:'p',countryCode:'FR',start:'2026-01-01',end:'2026-01-02',status:'actual'});
  assert.equal(J.dayStatus(s,'2026-01-01'),'travel');
});

test('flight number is optional, invalid types and dates are rejected',()=>{
  const t={type:'flight',startLocal:'2026-01-02T09:00',endLocal:'2026-01-01T21:00',start:{name:'Tokyo'},end:{name:'Los Angeles'}};
  assert.equal(J.validateTransport(t),'');assert.notEqual(J.validateTransport({...t,type:'unknown'}),'');
  assert.notEqual(J.validateTransport({...t,startLocal:'2026-02-30T09:00'}),'');
});

test('trip links and nested visual preferences survive repeated device imports',()=>{
  const remote={profiles:[{id:'account',name:'Me'}],trips:[{id:'account-trip',profileId:'account',name:'Europe'}],stays:[],transports:[],visualLayers:{map:{countries:false}},countryCountExcludedCodes:['GB']};
  const source={profiles:[{id:'guest',name:'Me'}],trips:[{id:'guest-trip',profileId:'guest',name:'Europe'}],stays:[{id:'s',profileId:'guest',tripId:'guest-trip'}],transports:[{id:'t',profileId:'guest',tripId:'guest-trip'}],visualLayers:{map:{transport:true},calendar:{countries:true}},countryCountExcludedCodes:['FR'],countryCountIncludedExtraCodes:['AQ']};
  const out=M.importData(remote,source).data;
  assert.equal(out.trips.length,1);assert.equal(out.stays[0].tripId,'account-trip');assert.equal(out.transports[0].profileId,'account');
  assert.deepEqual(out.visualLayers.map,{countries:false,transport:true});assert.deepEqual(out.countryCountExcludedCodes,['GB','FR']);
  assert.deepEqual(M.importData(out,source).data,out);
});

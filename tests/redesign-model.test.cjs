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

test('shared summary counts dates once and applies each traveller’s own home history',()=>{
 const data={profiles:[{id:'a',homeCountryCodes:['GB']},{id:'b',homeCountryCodes:['US']}],activeProfileId:'a',residences:[],stays:[{id:'1',profileId:'a',countryCode:'GB',start:'2026-01-01',end:'2026-01-03',status:'actual'},{id:'2',profileId:'b',countryCode:'GB',start:'2026-01-02',end:'2026-01-03',status:'actual'},{id:'3',profileId:'a',countryCode:'FR',start:'2026-01-04',end:'2026-01-06',status:'cancelled'}]};
 assert.equal(J.summary(data,'2026-01-05','a').days.size,0);
 assert.equal(J.summary(data,'2026-01-05','b').days.size,2);
 const all=J.summary(data,'2026-01-05','all');assert.equal(all.days.size,2);assert.equal(all.home.size,1);assert.deepEqual([...all.countries],['GB']);
});
test('cancelled transport and cancelled linked trips cannot infer airport visits',()=>{
 const base={activeProfileId:'a',trips:[{id:'cancel',status:'cancelled'}],transports:[{id:'t',profileId:'a',type:'flight',status:'actual',tripId:'cancel',startLocal:'2026-01-01T12:00',endLocal:'2026-01-01T15:00',start:{airportId:'LHR'},end:{airportId:'CDG'}}],placeVisits:[]};
 assert.equal(J.visibleTransport(base).length,0);assert.equal(J.visits(base,'airports','2026-01-02').size,0);
 base.trips=[];assert.equal(J.visits(base,'airports','2026-01-02').size,2);
 base.placeVisits=[{profileId:'a',category:'airports',itemId:'LHR',status:'not-recorded',date:null}];assert.deepEqual([...J.visits(base,'airports','2026-01-02')],['CDG']);
});
test('import rejects malformed transport before state replacement and accepts local date-line crossings',()=>{
 const t={id:'t',type:'flight',startLocal:'2026-01-02T12:00',endLocal:'2026-01-01T15:00',start:{name:'Tokyo'},end:{name:'Los Angeles'}};
 assert.doesNotThrow(()=>M.validateImport({transports:[t]}));
 assert.throws(()=>M.validateImport({transports:[{...t,startLocal:'2026-02-30T12:00'}]}));
 assert.throws(()=>M.validateImport({transports:[{...t,end:null}]}));
});
test('conflicts describe records without exposing internal paths or raw JSON',()=>{
 const out=M.describeConflict({path:'stays.opaque-id.end',local:'2026-01-03',remote:'2026-01-04'},{stays:[{id:'opaque-id',countryName:'France'}]});
 assert.equal(out.title,'France · End date');assert.equal(out.local,'2026-01-03');assert.equal(out.remote,'2026-01-04');
});
test('multi-traveller trip membership is remapped on import and remains visible to each member',()=>{
 const account={profiles:[{id:'a',name:'Alex'},{id:'b',name:'Sam'}],trips:[]};
 const guest={profiles:[{id:'old-a',name:'Alex'},{id:'old-b',name:'Sam'}],trips:[{id:'trip',profileId:'old-a',profileIds:['old-a','old-b'],name:'Shared journey'}]};
 const result=M.importData(account,guest).data;assert.deepEqual(result.trips[0].profileIds,['a','b']);assert.equal(J.scoped(result.trips,'b').length,1);assert.deepEqual(M.importData(result,guest).data,result);
});

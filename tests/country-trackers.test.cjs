'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../country-visit-model'),M=require('../account-model'),T=require('../data/tcc-destinations'),J=require('../journey-model');
const seed=()=>({activeProfileId:'p',profiles:[{id:'p',name:'Me',homeCountryCodes:[]}],trips:[],stays:[],residences:[],accommodations:[],transports:[],manualCountryVisits:[],tccVisits:[],countryCountExcludedCodes:[],countryCountIncludedExtraCodes:[],custom:{keep:'original'}});
test('official TCC snapshot has every destination, independent identities and all 12 official regions',()=>{
 const destinations=T.regions.flatMap(r=>r.destinations);assert.equal(destinations.length,330);assert.equal(new Set(destinations.map(d=>d.id)).size,330);assert.equal(T.regions.length,12);
 assert.deepEqual(T.regions.map(r=>r.destinations.length),[40,6,7,14,31,14,68,7,55,21,15,52]);assert.equal(T.source,'https://travelerscenturyclub.org/countries-and-territories/');assert.equal(T.verified,'2026-10-06');
 for(const name of ['England','Scotland','Wales','Ireland, Northern','Alaska','Hawaiian Islands','United States (Contiguous)','Sicily','Sardinia','Hong Kong','Macau','Zanzibar','French Guiana'])assert.ok(destinations.find(d=>d.name===name),name);
});
test('simultaneous new country and TCC assertions merge independently without altering history',()=>{
 const b=seed(),l=M.copy(b),r=M.copy(b);V.setManual(l,'JP',true,{},'2026-10-06');V.setManual(r,'KI',true,{},'2026-10-06');V.setTcc(l,'tcc-scotland',true,{},'2026-10-06');V.setTcc(r,'tcc-sicily',true,{},'2026-10-06');
 const result=M.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.data.manualCountryVisits.length,2);assert.equal(result.data.tccVisits.length,2);
 assert.deepEqual({...result.data,manualCountryVisits:[],tccVisits:[]},b);M.validateImport(result.data);assert.equal(J.summary(result.data,'2026-10-06').countries.size,2);
});
test('offline deletions survive concurrent edits to other visit records and fields',()=>{
 const b=seed();V.setManual(b,'JP',true,{},'2026-10-06');V.setTcc(b,'tcc-scotland',true,{},'2026-10-06');const l=M.copy(b),r=M.copy(b);V.setManual(l,'JP',false,{},'2026-10-06');V.setTcc(l,'tcc-scotland',false,{},'2026-10-06');V.setManual(r,'DZ',true,{},'2026-10-06');r.custom.keep='Other device change';const result=M.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.deepEqual(result.data.manualCountryVisits.map(r=>r.countryCode),['DZ']);assert.equal(result.data.tccVisits.length,0);assert.equal(result.data.custom.keep,'Other device change');
});
test('visit metadata edits on separate devices combine by field',()=>{
 const b=seed();V.setManual(b,'JP',true,{},'2026-10-06');const l=M.copy(b),r=M.copy(b);l.manualCountryVisits[0].note='Temple visit';r.manualCountryVisits[0].visits=3;const result=M.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.data.manualCountryVisits[0].note,'Temple visit');assert.equal(result.data.manualCountryVisits[0].visits,3);
});
test('guest import remaps profiles and visit identities and is idempotent',()=>{
 const remote=seed();remote.profiles=[{id:'account',name:'Me',homeCountryCodes:[]}];remote.activeProfileId='account';const guest=seed();V.setManual(guest,'KI',true,{year:2018},'2026-10-06');V.setTcc(guest,'tcc-hong-kong',true,{note:'Keep this'},'2026-10-06');const result=M.importData(remote,guest);assert.equal(result.conflicts.length,0);const data=result.data;assert.equal(data.manualCountryVisits[0].profileId,'account');assert.equal(data.tccVisits[0].profileId,'account');assert.equal(data.manualCountryVisits[0].id,'manual-country:account:KI');assert.deepEqual(M.importData(data,guest).data,data);
});
test('legacy snapshots gain additive collections without losing logos, routes or unknown fields',()=>{
 const b=seed();delete b.manualCountryVisits;delete b.tccVisits;b.transports=[{id:'t',resolvedRoutes:{0:{coordinates:[[1,2],[3,4]],signature:'keep'}}}];b.savedPlaces=[{id:'hotel',place:{name:'Hotel'},accommodationLogo:{src:'keep'}}];const l=M.copy(b),r=M.copy(b);V.setManual(l,'JP',true,{},'2026-10-06');V.setTcc(r,'tcc-scotland',true,{},'2026-10-06');const result=M.merge(b,l,r).data;assert.deepEqual(result.transports,b.transports);assert.deepEqual(result.savedPlaces,b.savedPlaces);assert.deepEqual(result.custom,b.custom);assert.equal(result.manualCountryVisits.length,1);assert.equal(result.tccVisits.length,1);
});
test('visit imports reject malformed records instead of fabricating chronology',()=>{
 for(const row of [{id:'x',countryCode:'JP',date:'2018-02-30'},{id:'x',countryCode:'SEA'},{id:'x',countryCode:'JP',year:2018.5},{id:'x',countryCode:'JP',visited:'yes'}])assert.throws(()=>M.validateImport({manualCountryVisits:[row]}));
 assert.throws(()=>M.validateImport({tccVisits:[{id:'x',destinationId:'GB'}]}));assert.doesNotThrow(()=>M.validateImport({manualCountryVisits:[{id:'x',countryCode:'JP',visited:true}],tccVisits:[{id:'y',destinationId:'tcc-scotland',visited:true}]}));
});

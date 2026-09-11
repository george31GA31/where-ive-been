const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model.js'),M=require('../account-model.js');
const base=()=>({stays:[],residences:[],profiles:[{id:'p',homeCountryCodes:['GB','FR']}],activeProfileId:'p',transports:[],placeVisits:[]});
test('home and travel overlap counts as travel; dated residences and profiles remain independent',()=>{
 const s=base();s.stays=[{countryCode:'GB',start:'2026-01-01',end:'2026-01-04'},{countryCode:'US',start:'2026-01-03',end:'2026-01-04'}];
 assert.equal(J.dayStatus(s,'2026-01-01'),'home');assert.equal(J.dayStatus(s,'2026-01-03'),'mixed');assert.equal(J.dayStatus(s,'2026-01-05'),'unrecorded');
 s.residences=[{countryCode:'US',start:'2026-01-04',end:'2026-01-04',profileId:'p'}];assert.equal(J.dayStatus(s,'2026-01-04'),'home');assert.equal(J.isHome(s,'US','2026-01-04','other'),false);assert.equal(J.isHome(s,'US','2026-01-05'),false);
 s.stays.push({countryCode:'DE',start:'2026-01-01',end:'2026-01-02',status:'planned'});assert.equal(J.dayStatus(s,'2026-01-01'),'home');
});
test('transport local clocks allow westbound/date-line travel and validate real dates and coordinates',()=>{
 const t={type:'flight',startLocal:'2026-01-02T01:00',endLocal:'2026-01-01T21:00',start:{name:'Tokyo',lat:0,lon:0},end:{name:'Los Angeles'},flightNumber:'TEST1'};
 assert.equal(J.validateTransport(t),'');assert.ok(J.validateTransport({...t,startLocal:'2026-02-30T12:00'}));assert.ok(J.validateTransport({...t,start:{name:'X',lat:90,lon:181}}));assert.ok(J.validateTransport({...t,start:{name:'X',lat:10}}));assert.equal(J.routeColor('flight'),'#66DCE3');assert.equal(J.routeColor('car'),'#74F94B');
});
test('country stays never imply place visits; airport endpoints count individually after their date',()=>{
 const s=base();s.stays=[{countryCode:'FR',start:'2026-01-01',end:'2026-01-02'}];assert.equal(J.visits(s,'buildings','2026-01-05').size,0);
 s.transports=[{type:'flight',startLocal:'2026-01-01T12:00',endLocal:'2026-01-02T03:00',start:{airportId:'airports:LHR'},end:{airportId:'airports:JFK'}}];
 assert.deepEqual([...J.visits(s,'airports','2026-01-01')],['airports:LHR']);assert.equal(J.visits(s,'airports','2026-01-02').size,2);s.transports[0].status='planned';assert.equal(J.visits(s,'airports','2026-01-02').size,0);
 s.placeVisits=[{category:'unesco',itemId:'unesco:1',date:'2026-01-01'},{category:'unesco',itemId:'unesco:1',date:'2026-01-02'}];assert.equal(J.visits(s,'unesco','2026-01-03').size,1);
});
test('new collections merge independently and deletions survive concurrent edits',()=>{
 const b=base();b.transports=[{id:'t',type:'flight',bookingReference:'a'}];const l=structuredClone(b),r=structuredClone(b);l.transports=[];r.placeVisits=[{id:'v',category:'mountains',itemId:'mountains:GB',date:'2026-01-01'}];
 const result=M.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.data.transports.length,0);assert.equal(result.data.placeVisits.length,1);assert.deepEqual(result.data.stays,b.stays);
});
test('guest transport and achievements remap traveller IDs and import idempotently',()=>{
 const r=base();r.profiles=[{id:'account',name:'Me'}];const guest={stays:[],residences:[],profiles:[{id:'guest',name:'Me'}],transports:[{id:'t',profileId:'guest',type:'train'}],placeVisits:[{id:'v',profileId:'guest',category:'mountains',itemId:'mountains:GB',date:'2026-01-01'}]};
 const first=M.importData(r,guest).data;assert.equal(first.transports[0].profileId,'account');assert.equal(first.placeVisits[0].profileId,'account');assert.deepEqual(M.importData(first,guest).data,first);
});

const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model.js'),M=require('../account-model.js');
const base=()=>({stays:[],residences:[],profiles:[{id:'p',homeCountryCodes:['GB','FR']}],activeProfileId:'p',transports:[],placeVisits:[]});
test('home and travel overlap counts as travel; dated residences and profiles remain independent',()=>{
 const s=base();s.stays=[{countryCode:'GB',start:'2026-01-01',end:'2026-01-04'},{countryCode:'US',start:'2026-01-03',end:'2026-01-04'}];
 assert.equal(J.dayStatus(s,'2026-01-01'),'home');assert.equal(J.dayStatus(s,'2026-01-03'),'mixed');assert.equal(J.dayStatus(s,'2026-01-05'),'home');
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
test('memories exclude permanent home before calculating years, including linked stays and places',()=>{
 const s=base();s.stays=[{id:'home',tripId:'home-trip',location:'London',countryCode:'GB',countryName:'United Kingdom',start:'2001-09-28',end:'2026-09-28',status:'actual'},{id:'away',countryCode:'ES',countryName:'Spain',start:'2002-09-25',end:'2002-10-01',status:'actual'}];
 s.residences=[{countryCode:'GB',start:'1990-01-01',end:null}];s.placeVisits=[{category:'locations',status:'visited',date:'2000-09-28',place:{countryCode:'GB',countryName:'United Kingdom',name:'Home'}},{category:'locations',status:'visited',date:'2003-09-25',endDate:'2003-09-30',place:{countryCode:'IT',countryName:'Italy',name:'Rome'}}];
 const before=JSON.stringify(s),memory=J.memories(s,'2026-09-28');assert.deepEqual(memory.map(m=>m.year),[2003,2002]);assert.ok(memory.every(m=>m.places.every(p=>p.code!=='GB')));assert.equal(JSON.stringify(s),before);
 s.stays=s.stays.slice(0,1);s.placeVisits=s.placeVisits.slice(0,1);assert.deepEqual(J.memories(s,'2026-09-28'),[]);
});
test('date association requires a unique matching journey and never modifies it',()=>{
 const s=base();s.trips=[{id:'one',profileId:'p'},{id:'other',profileId:'q'}];s.stays=[{tripId:'one',profileId:'p',countryCode:'ES',start:'2026-10-05',end:'2026-10-12'}];const before=JSON.stringify(s);
 assert.equal(J.tripForDates(s,'2026-10-05','2026-10-12'),'one');assert.equal(J.tripForDates(s,'2026-10-04','2026-10-12'),null);assert.equal(JSON.stringify(s),before);
 s.trips.push({id:'two',profileId:'p'});s.stays.push({...s.stays[0],tripId:'two'});assert.equal(J.tripForDates(s,'2026-10-06'),null);
});
test('standalone accommodation and ranged places survive validation and repeated import',()=>{
 const source={profiles:[{id:'p',name:'Me'}],accommodations:[{id:'hotel',tripId:null,profileId:'p',propertyName:'Hotel',location:'Madrid',checkIn:'2026-10-05',checkOut:'2026-10-12',place:{name:'Hotel',lat:40,lon:-3}}],placeVisits:[{id:'place',profileId:'p',category:'locations',itemId:'manual:one',status:'visited',date:'2026-10-05',endDate:'2026-10-12',place:{name:'Campsite',lat:40,lon:-3}}]};
 assert.doesNotThrow(()=>M.validateImport(source));const once=M.importData(base(),source).data,twice=M.importData(once,source).data;assert.equal(twice.accommodations.length,1);assert.equal(twice.accommodations[0].tripId,null);assert.equal(twice.placeVisits.length,1);assert.equal(twice.placeVisits[0].endDate,'2026-10-12');assert.equal(twice.accommodations[0].place.lat,40);
});
test('bundled airport directory identifies Alicante by name and both official codes',()=>{
 const data=require('../data/airports.json');const airport=data.items.find(a=>a.iata==='ALC');assert.ok(airport.name.includes('Alicante'));assert.equal(airport.icao,'LEAL');assert.equal(airport.countryCodes[0],'ES');assert.ok(data.items.length>10000);
});
test('legacy home residence never creates memories, including overlaps with foreign trips',()=>{
 const s=base();s.profiles[0].homeCountryCodes=[];s.residences=[{countryCode:'GB',countryName:'United Kingdom',start:'2000-01-01',end:null}];s.stays=[{countryCode:'AZ',countryName:'Azerbaijan',start:'2025-09-28',end:'2025-09-28',status:'actual'}];
 const before=JSON.stringify(s);assert.deepEqual(J.memories(s,'2026-09-28'),[{year:2025,places:[{code:'AZ',name:'Azerbaijan'}]}]);assert.equal(JSON.stringify(s),before);
 s.residences[0].end='2024-12-31';assert.deepEqual(J.memories(s,'2026-09-28'),[{year:2025,places:[{code:'AZ',name:'Azerbaijan'}]}]);
});
test('flight codes and connecting airports survive import without country records',()=>{
 const t={id:'via-flight',profileId:'p',type:'flight',startLocal:'2026-09-28T10:00',endLocal:'2026-09-28T18:00',start:{name:'Ljubljana Airport',iata:'LJU'},end:{name:'Alicante Airport',iata:'ALC'},via:[{name:'Zurich Airport',iata:'ZRH',icao:'LSZH',lat:47.46,lon:8.55}],status:'actual'};
 assert.equal(J.transportLabel(t),'LJU → ZRH → ALC');assert.equal(J.transportLabel({...t,via:[] }),'LJU → ALC');assert.equal(J.transportLabel({...t,type:'train'}),'Ljubljana Airport → Alicante Airport');
 const imported=M.importData(base(),{profiles:[{id:'p',name:'Me'}],transports:[t]}).data;assert.equal(imported.stays.length,0);assert.deepEqual(imported.transports[0].via,t.via);
});

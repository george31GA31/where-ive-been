const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model'),G=require('../journey-routes'),M=require('../account-model');
const base=()=>({activeProfileId:'p',profiles:[{id:'p',name:'Me',homeCountryCodes:['GB']}],trips:[],stays:[],transports:[],accommodations:[],residences:[],placeVisits:[]});
test('explicit constituent-country holidays qualify for memories but add no home sovereign country',()=>{
 const s=base();s.residences=[{id:'r',countryCode:'GB',start:'1980-01-01',end:null}];
 for(const [i,d] of J.domesticDestinations.entries())s.stays.push({id:'s'+i,profileId:'p',countryCode:'GB',countryName:d.name,...J.domesticFields(d),start:`${2000+i}-09-28`,end:`${2000+i}-09-30`,status:'actual'});
 s.stays.push({id:'ordinary',tripId:'not-a-holiday',countryCode:'GB',countryName:'United Kingdom',start:'1990-09-28',end:'1990-09-28'});
 const before=JSON.stringify(s),mem=J.memories(s,'2026-09-28');assert.equal(mem.length,4);assert.equal(mem.at(-1).year,2000);assert.equal(J.summary(s,'2026-09-28').countries.size,0);assert.equal(J.summary(s,'2026-09-28').trips.size,4);assert.equal(J.dayStatus(s,'2001-09-28'),'travel');assert.equal(JSON.stringify(s),before);
 M.validateImport(s);assert.deepEqual(M.importData(s,s).data.stays,s.stays);
 s.profiles[0].homeCountryCodes=['US'];s.residences=[];assert.deepEqual([...J.summary(s,'2026-09-28').countries],['GB']);
});
test('legacy via and explicit legs remain one record with independent airline metadata through merge/import',()=>{
 const old={id:'t',profileId:'p',type:'flight',start:{name:'Ljubljana',iata:'LJU'},end:{name:'Alicante',iata:'ALC'},via:[{name:'Zurich',iata:'ZRH'}],startLocal:'2026-09-28T10:00',endLocal:'2026-09-28T16:00',flightNumber:'legacy',bookingReference:'retain'};
 const before=JSON.stringify(old),legs=J.flightLegs(old);assert.equal(legs.length,2);assert.equal(legs[0].endLocal,'');assert.equal(JSON.stringify(old),before);assert.equal(J.transportLabel(old),'LJU → ZRH → ALC');
 legs[0].endLocal='2026-09-28T11:00';legs[1].startLocal='2026-09-28T14:00';legs[0].airline={name:'SWISS',iata:'LX',icao:'SWR'};legs[1].airline={name:'Edelweiss',iata:'WK',icao:'EDW'};legs[0].flightNumber='LX1';legs[1].flightNumber='WK2';
 const s=base();s.transports=[{...old,legs}];M.validateImport(s);const imported=M.importData(base(),s).data;assert.deepEqual(imported.transports,s.transports);assert.equal(M.importData(imported,s).data.transports.length,1);assert.equal(J.summary(imported,'2026-09-28').countries.size,0);
 const remote=structuredClone(s),local=structuredClone(s);remote.accommodations.push({id:'a',propertyName:'Hotel'});local.transports[0].legs[1].flightNumber='WK3';const merged=M.merge(s,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.transports[0].legs[1].flightNumber,'WK3');assert.equal(merged.data.accommodations.length,1);
});
test('flight arcs preserve endpoints and cross the date line by the shorter direction',()=>{
 const a={lat:46,lon:14},b={lat:47,lon:8},arc=G.flightArc(a,b);assert.deepEqual(arc[0],[46,14]);assert.deepEqual(arc.at(-1),[47,8]);assert.notEqual(arc[24][0],46.5);assert.ok(Math.max(...G.flightArc({lat:0,lon:179},{lat:0,lon:-179}).map(p=>Math.abs(p[1]-179)))<=2);
});
test('rail/water geometry follows connected mapped ways and refuses fabricated bridges',()=>{
 const elements=[{members:[{geometry:[{lat:0,lon:0},{lat:.02,lon:.01},{lat:.01,lon:.02}]}]}];
 assert.deepEqual(G.mappedPath(elements,{lat:0,lon:0},{lat:.01,lon:.02}),[[0,0],[.02,.01],[.01,.02]]);
 assert.equal(G.mappedPath(elements,{lat:20,lon:20},{lat:.01,lon:.02}),null);
 assert.equal(G.mappedPath([{members:[{geometry:[{lat:0,lon:0},{lat:0,lon:.01}]},{geometry:[{lat:.1,lon:.1},{lat:.1,lon:.2}]}]}],{lat:0,lon:0},{lat:.1,lon:.2}),null);
});

test('manual airport codes take precedence over directory names and survive import',()=>{
 const airport={id:'manual-airport:test',airportId:'manual-airport:test',manualAirport:true,name:'Personal airfield',icao:'QQXY',lat:4.6,lon:-58.6,countryCode:'GY'};
 assert.equal(J.airportLabel(airport,()=>({iata:'ABC'})),'QQXY');
 const s=base();s.transports=[{id:'manual-flight',profileId:'p',type:'flight',start:airport,end:{name:'Destination',iata:'DEF'},startLocal:'2026-11-05T12:00',endLocal:'2026-11-05T14:00'}];M.validateImport(s);assert.deepEqual(M.importData(base(),s).data.transports[0].start,airport);assert.equal(J.summary(s,'2026-11-06').countries.size,0);
});

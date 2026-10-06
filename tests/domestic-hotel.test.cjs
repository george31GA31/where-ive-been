'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),J=require('../journey-model'),M=require('../account-model'),G=require('../journey-global-model');
const base=()=>({activeProfileId:'p',profiles:[{id:'p',homeCountryCodes:['GB']}],stays:[{id:'foreign-before',profileId:'p',countryCode:'FR',start:'2026-03-01',end:'2026-03-01',status:'actual'},{id:'gap',profileId:'p',countryCode:'GB',start:'2026-03-02',end:'2026-03-19',status:'actual',notes:'Preserve uncertainty'},{id:'foreign-after',profileId:'p',countryCode:'ES',start:'2026-03-20',end:'2026-03-20',status:'actual'}],accommodations:[],trips:[],transports:[],residences:[],placeVisits:[]});
const hotel=()=>({id:'hotel',profileId:'p',propertyName:'Domestic hotel',location:'Bath',place:{countryCode:'GB',countryName:'United Kingdom'},checkIn:'2026-03-10',checkOut:'2026-03-12',travelKind:'trip',notes:'Booking retained'});
test('A domestic hotel creates only its authoritative travel dates and never modifies the surrounding home gap',()=>{
 const s=base(),original=structuredClone(s.stays),a=hotel();s.accommodations.push(a);J.syncAccommodationStay(s,a,'2026-04-01');
 assert.deepEqual(s.stays.slice(0,3),original);const own=s.stays.at(-1);assert.deepEqual([own.start,own.end],['2026-03-10','2026-03-12']);
 for(let d=2;d<20;d++){const date='2026-03-'+String(d).padStart(2,'0');assert.equal(J.homeKind(s,s.stays[1],date),'ambiguous');assert.equal(J.dayStatus(s,date),d>=10&&d<=12?'mixed':'home');}
 const summary=J.summary(s,'2026-04-01');assert.deepEqual([...summary.days].sort(),['2026-03-01','2026-03-10','2026-03-11','2026-03-12','2026-03-20']);
 assert.deepEqual(G.rows(s).filter(r=>r.domestic).map(r=>[r.start,r.end]),[['2026-03-10','2026-03-12']]);M.validateImport(s);assert.deepEqual(M.importData(s,s).data.stays,s.stays);
});
test('Editing or removing a domestic hotel updates only its provenance-linked country record',()=>{
 const s=base(),a=hotel(),original=structuredClone(s.stays);s.accommodations.push(a);J.syncAccommodationStay(s,a,'2026-04-01');const id=s.stays.at(-1).id;
 a.checkIn='2026-03-11';a.checkOut='2026-03-13';J.syncAccommodationStay(s,a,'2026-04-01');assert.equal(s.stays.at(-1).id,id);assert.equal(s.stays.at(-1).start,a.checkIn);assert.equal(s.stays.at(-1).end,a.checkOut);assert.deepEqual(s.stays.slice(0,3),original);
 a.travelKind='home';J.syncAccommodationStay(s,a);assert.deepEqual(s.stays,original);assert.equal(J.summary(s,'2026-04-01').days.size,2);
 a.travelKind='trip';J.syncAccommodationStay(s,a);J.removeAccommodationStay(s,a.id);assert.deepEqual(s.stays,original);
});
test('A deliberately wider domestic trip, another traveller and uncertain historic records are preserved',()=>{
 const s=base(),a=hotel();s.stays.push({id:'intentional',profileId:'p',countryCode:'GB',travelKind:'trip',start:'2026-03-05',end:'2026-03-15',status:'actual'});const before=structuredClone(s.stays);J.syncAccommodationStay(s,a);assert.deepEqual(s.stays,before);
 s.profiles.push({id:'other',homeCountryCodes:['GB']});a.profileId='other';J.syncAccommodationStay(s,a);assert.equal(s.stays.at(-1).profileId,'other');assert.equal(J.summary(s,'2026-04-01','other').days.size,3);assert.equal(J.summary(s,'2026-04-01','p').days.size,13);
});
test('Legacy hotel evidence is date-bound and an at-home hotel cannot imply travel',()=>{
 const s=base(),a=hotel();s.accommodations.push(a);assert.equal(J.homeKind(s,s.stays[1],'2026-03-09'),'ambiguous');assert.equal(J.homeKind(s,s.stays[1],'2026-03-10'),'trip');assert.equal(J.homeKind(s,s.stays[1],'2026-03-13'),'ambiguous');a.travelKind='home';assert.equal(J.homeKind(s,s.stays[1],'2026-03-11'),'ambiguous');
});

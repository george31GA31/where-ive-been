'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),J=require('../journey-model'),C=require('../calendar-data-model'),D=require('../view-data');
const seed=()=>({activeProfileId:'p',profiles:[{id:'p',homeCountryCodes:['GB']},{id:'other',homeCountryCodes:['US']}],stays:[],trips:[],transports:[],accommodations:[],residences:[],placeVisits:[],manualCountryVisits:[],tccVisits:[],notes:[]});
const stay=(id,start,end,extra={})=>({id,profileId:'p',countryCode:'DZ',countryName:'Algeria',start,end,status:'actual',...extra});
test('Algeria includes 11 prior days plus 10 elapsed days as 21 days / 2 visits, then rolls over',()=>{
 const data=seed();data.stays=[stay('prior','2025-01-01','2025-01-11'),stay('ongoing','2026-10-05','2026-10-25',{status:'planned'})];
 let result=J.summary(data,'2026-10-14').byCountry.get('DZ');assert.equal(result.days.size,21);assert.equal(result.trips,2);assert.ok(!result.days.has('2026-10-15'));
 result=J.summary(data,'2026-10-15').byCountry.get('DZ');assert.equal(result.days.size,22);assert.equal(result.trips,2);
 data.stays[1].end='2026-10-10';assert.equal(J.summary(data,'2026-10-15').byCountry.get('DZ').days.size,17);data.stays.pop();assert.equal(J.summary(data,'2026-10-15').byCountry.get('DZ').trips,1);
});
test('overlapping/contiguous records remain one visit; future, cancelled, unconfirmed and other profiles are excluded',()=>{
 const data=seed();data.trips=[{id:'cancelled',status:'cancelled'}];data.stays=[stay('a','2026-10-01','2026-10-05'),stay('b','2026-10-04','2026-10-08'),stay('c','2026-10-09','2026-10-10'),stay('future','2026-11-01','2026-11-10',{status:'planned'}),stay('cancelled','2026-09-01','2026-09-15',{tripId:'cancelled'}),stay('review','2026-08-01','2026-08-15',{status:'unconfirmed'}),stay('other','2026-07-01','2026-07-15',{profileId:'other'})];
 const result=J.summary(data,'2026-10-14').byCountry.get('DZ');assert.equal(result.days.size,10);assert.equal(result.trips,1);assert.equal(J.summary(data,'2026-10-14','other').byCountry.get('DZ').days.size,15);
});
test('manual visits, TCC and notes never create travel dates or visits',()=>{
 const data=seed();data.notes=[{id:'n',profileId:'p',date:'2026-10-14',title:'Get yellow fever vaccine'}];data.manualCountryVisits=[{id:'m',profileId:'p',countryCode:'DZ',visited:true}];data.tccVisits=[{id:'t',destinationId:'algeria',visited:true}];
 assert.equal(J.summary(data,'2026-10-14').days.size,0);assert.equal(J.summary(data,'2026-10-14').byCountry.size,0);assert.equal(C.window(data,'2026-10-14',1).get('2026-10-14').notes.length,1);
});
test('At Sea retains its elapsed statistics row without becoming a visited country',()=>{
 const data=seed();data.stays=[stay('sea','2026-10-13','2026-10-20',{countryCode:'SEA',countryName:'At Sea',status:'planned'})];
 const result=J.summary(data,'2026-10-14');assert.equal(result.byCountry.get('SEA').days.size,2);assert.equal(result.byCountry.get('SEA').trips,1);assert.equal(result.byCountry.get('SEA').records[0].id,'sea');assert.equal(result.days.size,2);assert.equal(result.countries.has('SEA'),false);assert.equal(result.recordedCountries.has('SEA'),false);
});
test('Calendar windows preserve inclusive transport, hotel and independent dated-note boundaries',()=>{
 const data=seed();data.transports=[{id:'night',profileId:'p',type:'train',startLocal:'2026-10-14T22:00',endLocal:'2026-10-15T06:00',start:{name:'A'},end:{name:'B'}}];data.accommodations=[{id:'hotel',profileId:'p',checkIn:'2026-10-14',checkOut:'2026-10-15',propertyName:'Hotel'}];data.notes=[{id:'dated',date:'2026-10-14',title:'Visa'},{id:'undated',title:'Keep existing note'},{id:'private',profileId:'other',date:'2026-10-14'}];
 const days=C.window(data,'2026-10-14',3);assert.equal(days.get('2026-10-14').notes.length,1);assert.equal(days.get('2026-10-15').transports.length,1);assert.equal(days.get('2026-10-15').accommodations.length,1);assert.equal(days.get('2026-10-16').accommodations.length,0);
 data.notes[1].title='Unrelated note';assert.equal(C.window(data,'2026-10-14',3),days,'Undated note edits reuse Calendar data');data.notes[0].date='2026-10-15';assert.equal(C.window(data,'2026-10-14',3).get('2026-10-15').notes.length,1);
});
test('Calendar statuses match permanent-home, domestic-trip and mixed-day rules',()=>{
 const data=seed();data.stays=[stay('home','2026-10-01','2026-10-31',{countryCode:'GB',travelKind:'home'}),stay('holiday','2026-10-14','2026-10-15',{countryCode:'GB',travelKind:'trip'})];
 for(const [date,day]of C.window(data,'2026-10-12',6))assert.equal(day.status,J.dayStatus(data,date));assert.equal(C.window(data,'2026-10-12',1).get('2026-10-12').status,'home');assert.equal(C.window(data,'2026-10-14',1).get('2026-10-14').status,'mixed');
});
test('interval lookups preserve inclusive overlaps and empty windows',()=>{
 const rows=[{start:'2026-01-01',end:'2026-01-03'},{start:'2026-01-03',end:'2026-01-09'},{start:'2026-01-15',end:'2026-01-18'}],index=new D.Intervals(rows);
 assert.equal(index.overlap('2026-01-03').length,2);assert.deepEqual(index.overlap('2026-01-10'),[]);assert.deepEqual(index.containing('2026-01-05','2026-01-08'),[rows[1]]);
});

test('unknown-ended country stay remains ongoing, counts elapsed days and retains its original record',()=>{
 const data=seed();data.stays=[stay('prior','2025-01-01','2025-01-11'),stay('open','2026-10-05',null,{status:'planned'})];
 const before=JSON.stringify(data),result=J.summary(data,'2026-10-14').byCountry.get('DZ');
 assert.equal(result.days.size,21);assert.equal(result.trips,2);assert.equal(J.reviewPlanned(data.stays,'2026-10-14'),false);assert.equal(JSON.stringify(data),before);
 const H=require('../travel-history-model');assert.equal(H.calculate(data,'2026-10-14').awayDays.size,21);
 assert.equal(J.summary(data,'2026-10-15').byCountry.get('DZ').days.size,22);
 data.stays[1].status='cancelled';assert.equal(J.summary(data,'2026-10-15').byCountry.get('DZ').days.size,11);
});

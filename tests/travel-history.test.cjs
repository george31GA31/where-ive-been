'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../travel-history-model'),J=require('../journey-model'),V=require('../country-visit-model');
const seed=()=>({activeProfileId:'p',profiles:[{id:'p',homeCountryCodes:['GB']}],trips:[],stays:[],accommodations:[],transports:[],placeVisits:[],residences:[],manualCountryVisits:[],tccVisits:[]});
const stay=(code,start,end,other={})=>({id:code+start,profileId:'p',countryCode:code,start,end,status:'actual',...other});
const calculate=(s,today='2026-10-06')=>H.calculate(s,today);
test('most travelled month counts unique dates in their own month',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-10'),stay('ES','2026-02-01','2026-02-22'),stay('IT','2026-03-01','2026-03-05')];
 assert.deepEqual(calculate(s).mostMonth,{month:'2026-02',days:22});
 s.stays=[stay('FR','2026-01-20','2026-02-10')];const result=calculate(s);assert.deepEqual(result.mostMonth,{month:'2026-01',days:12});assert.equal([...result.awayDays].filter(d=>d.startsWith('2026-02')).length,10);
});
test('country changes form one continuous absence and a recorded home day ends it',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-05'),stay('ES','2026-01-06','2026-01-13'),stay('IT','2026-01-14','2026-01-17'),stay('GB','2026-01-18','2026-01-20'),stay('DZ','2026-01-21','2026-01-29')];
 assert.deepEqual(calculate(s).longest,{start:'2026-01-01',end:'2026-01-17',days:17,ongoing:false});
});
test('cross-year travel allocates only each year’s dates and handles leap years',()=>{
 const s=seed();s.stays=[stay('FR','2025-12-15','2026-01-20')];const result=calculate(s);assert.deepEqual(result.mostYear,{year:2026,days:20,daysInYear:365});assert.equal([...result.awayDays].filter(d=>d.startsWith('2025')).length,17);
 s.stays=[stay('FR','2024-02-01','2024-02-29')];assert.deepEqual(calculate(s).mostYear,{year:2024,days:29,daysInYear:366});
});
test('first visits, later revisits, unique countries and last new country share one chronology',()=>{
 const s=seed();s.stays=[stay('FR','2022-02-01','2022-02-04'),stay('ES','2025-03-01','2025-03-10'),stay('DZ','2026-10-01','2026-10-04'),stay('GY','2026-09-01','2026-09-02'),stay('FR','2026-10-05','2026-10-06'),stay('FR','2026-02-01','2026-02-02')];
 const result=calculate(s);assert.deepEqual(result.newCountriesThisYear,['DZ','GY']);assert.deepEqual(result.countriesThisYear,['DZ','FR','GY']);assert.deepEqual(result.lastNew,{date:'2026-10-01',countries:['DZ'],days:5});
});
test('overlapping country, hotel, transport and location records count each day and country once',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-05'),stay('FR','2026-01-02','2026-01-04')];s.accommodations=[{id:'a',checkIn:'2026-01-01',checkOut:'2026-01-05',place:{countryCode:'FR'}}];s.placeVisits=[{category:'locations',status:'visited',date:'2026-01-02',endDate:'2026-01-04',place:{countryCode:'FR'}}];s.transports=[{type:'train',startLocal:'2026-01-02T10:00',endLocal:'2026-01-02T12:00',start:{countryCode:'FR'},end:{countryCode:'FR'}}];
 const before=JSON.stringify(s),result=calculate(s);assert.equal(result.awayDays.size,5);assert.deepEqual(result.countriesThisYear,['FR']);assert.equal(JSON.stringify(s),before);
});
test('ordinary residence and permanent home do not count as travel; a genuine domestic holiday counts its country',()=>{
 const s=seed();s.residences=[{countryCode:'GB',start:'2000-01-01',end:null}];s.stays=[stay('GB','2026-01-01','2026-10-06')];
 let result=calculate(s);assert.equal(result.awayDays.size,0);assert.deepEqual(result.countriesThisYear,[]);assert.equal(result.lastNew,null);
 s.stays.push(stay('GB','2026-04-01','2026-04-03',{travelKind:'trip',domesticHoliday:true}));result=calculate(s);assert.deepEqual(result.countriesThisYear,['GB']);assert.equal(result.awayDays.size,3);
 s.stays=[stay('GB','2026-01-01','2026-10-06',{travelKind:'home'}),stay('FR','2026-03-01','2026-03-03')];s.transports=[{type:'train',startLocal:'2026-03-04T10:00',endLocal:'2026-03-04T11:00',start:{countryCode:'GB'},end:{countryCode:'GB'}}];assert.equal(calculate(s).awayDays.size,3,'A routine transport within an explicit home interval is excluded');
});
test('future plans, future actual records and cancelled trips do not count',()=>{
 const s=seed();s.trips=[{id:'cancel',status:'cancelled'}];s.stays=[stay('FR','2026-12-01','2026-12-05',{status:'planned'}),stay('GY','2026-11-01','2026-11-04'),stay('IT','2026-01-01','2026-01-04',{tripId:'cancel'}),stay('DZ','2026-03-01','2026-03-02',{status:'cancelled'})];
 const result=calculate(s);assert.equal(result.awayDays.size,0);assert.equal(result.countriesThisYear.length,0);assert.equal(result.lastNew,null);
});
test('ongoing travel is clipped to today and needs no future return date',()=>{
 const s=seed();s.stays=[stay('DZ','2026-10-01',null)];assert.deepEqual(calculate(s).longest,{start:'2026-10-01',end:'2026-10-06',days:6,ongoing:true});
 s.stays=[stay('DZ','2026-10-01','2026-12-01',{status:'planned'})];assert.equal(calculate(s).awayDays.size,6);
 s.trips=[{id:'ongoing',status:'actual',start:'2026-10-01'}];s.stays=[stay('DZ','2026-10-01','2026-10-02',{tripId:'ongoing'})];assert.equal(calculate(s).longest.days,6);
 s.trips=[{id:'ongoing',name:'Undated trip'}];assert.equal(calculate(s).longest.days,2,'A name with no explicit ongoing dates does not fill unknown days');
});
test('transport return to home ends a continuous absence even with departure the following day',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-05'),stay('ES','2026-01-06','2026-01-09')];s.transports=[{type:'flight',start:{countryCode:'FR'},end:{countryCode:'GB'},startLocal:'2026-01-05T10:00',endLocal:'2026-01-05T12:00'}];
 assert.equal(calculate(s).longest.days,5);assert.equal(calculate(s,'2026-01-05').longest.ongoing,false);
});
test('a foreign journey returning home does not invent a domestic country visit',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-03')];s.transports=[{type:'train',start:{countryCode:'FR'},end:{countryCode:'GB'},startLocal:'2026-01-03T10:00',endLocal:'2026-01-03T12:00'}];
 assert.deepEqual(calculate(s).countriesThisYear,['FR']);assert.deepEqual(calculate(s).newCountriesThisYear,['FR']);
 s.stays=[];s.transports[0].start.countryCode='GB';assert.deepEqual(calculate(s).countriesThisYear,['GB'],'A genuine recorded domestic journey follows Herald home/trip classification');
});
test('undated manual visits affect lifetime totals but never chronology or away days',()=>{
 const s=seed(),before=structuredClone(s);V.setManual(s,'JP',true,{},'2026-10-06');assert.ok(J.summary(s,'2026-10-06').countries.has('JP'));assert.deepEqual(s.stays,before.stays);assert.deepEqual(s.trips,before.trips);assert.deepEqual(s.transports,before.transports);
 const result=calculate(s);assert.equal(result.awayDays.size,0);assert.equal(result.mostMonth,null);assert.equal(result.mostYear,null);assert.equal(result.longest,null);assert.equal(result.lastNew,null);assert.deepEqual(result.newCountriesThisYear,[]);assert.deepEqual(result.countriesThisYear,[]);
 V.setManual(s,'JP',false,{},'2026-10-06');assert.equal(J.summary(s,'2026-10-06').countries.has('JP'),false);
});
test('manual removal cannot erase a real visit and proven visits need no duplicate assertion',()=>{
 const s=seed();s.stays=[stay('FR','2026-01-01','2026-01-03')];V.setManual(s,'FR',true,{},'2026-10-06',calculate(s).proven);assert.equal(s.manualCountryVisits.length,0);
 V.setManual(s,'FR',true,{},'2026-10-06');V.setManual(s,'FR',false,{},'2026-10-06');assert.ok(J.summary(s,'2026-10-06').countries.has('FR'));assert.equal(s.stays.length,1);
});
test('manual exact dates establish country chronology without adding travel days',()=>{
 const s=seed();V.setManual(s,'JP',true,{date:'2026-02-10',visits:2,note:'Old trip'},'2026-10-06');const result=calculate(s);assert.equal(result.awayDays.size,0);assert.deepEqual(result.newCountriesThisYear,['JP']);assert.deepEqual(result.countriesThisYear,['JP']);assert.equal(result.lastNew.date,'2026-02-10');
});
test('approximate years stay approximate, suppressing false new-country claims on a later revisit',()=>{
 const s=seed();s.stays=[stay('JP','2026-03-01','2026-03-03')];V.setManual(s,'JP',true,{year:2018},'2026-10-06');const result=calculate(s);assert.deepEqual(result.first.get('JP'),{year:2018,precision:'year'});assert.equal(result.lastNew,null);assert.deepEqual(result.newCountriesThisYear,[]);assert.deepEqual(result.countriesThisYear,['JP']);
 const unknown=seed();V.setManual(unknown,'JP',true,{},'2026-10-06');unknown.stays=s.stays;assert.equal(calculate(unknown).lastNew,null,'An undated earlier visit cannot turn a later recorded visit into a claimed first visit');
 const current=seed();V.setManual(current,'JP',true,{year:2026},'2026-10-06');const currentStats=calculate(current);assert.deepEqual(currentStats.countriesThisYear,['JP']);assert.equal(currentStats.lastNew,null);assert.equal(currentStats.awayDays.size,0);
});
test('TCC status, country-count preferences and traveller scopes stay independent',()=>{
 const s=seed();V.setTcc(s,'tcc-scotland',true,{},'2026-10-06');V.setManual(s,'JP',true,{},'2026-10-06');s.manualCountryVisits.push({id:'other',profileId:'other',countryCode:'IT',visited:true});
 assert.equal(J.summary(s,'2026-10-06').countries.has('IT'),false);assert.equal(J.summary(s,'2026-10-06').countries.has('GB'),true);assert.equal(calculate(s).countriesThisYear.length,0);assert.deepEqual(s.stays,[]);assert.equal(s.tccVisits.length,1);assert.ok(J.summary(s,'2026-10-06').countries.has('JP'));
 s.stays=[stay('FR','2026-01-01','2026-01-02')];assert.equal(H.calculate(s,'2026-10-06','p',code=>code!=='FR').countriesThisYear.length,0);assert.equal(s.tccVisits.length,1);
});
test('unknown gaps, invalid dates and empty data never produce negative or invalid statistics',()=>{
 const s=seed();s.stays=[stay('FR','2026-02-30','2026-03-04'),stay('IT','2026-01-04','2026-01-01'),stay('ES','2026-04-01','2026-04-02'),stay('DZ','2026-04-04','2026-04-05')];assert.equal(calculate(s).longest.days,2);assert.equal(calculate(s).awayDays.size,4);
 const empty=calculate(seed());assert.equal(empty.longest,null);assert.equal(empty.lastNew,null);assert.equal(empty.mostMonth,null);assert.equal(empty.mostYear,null);assert.doesNotMatch(JSON.stringify(empty),/NaN|Invalid Date|undefined/);
 assert.throws(()=>V.setManual(s,'JP',true,{date:'2027-01-01'},'2026-10-06'));assert.throws(()=>V.setManual(s,'JP',true,{date:'2026-02-30'},'2026-10-06'));assert.throws(()=>V.setManual(s,'JP',true,{year:2018,date:'2018-02-01'},'2026-10-06'));
});

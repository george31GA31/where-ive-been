const test=require('node:test'),assert=require('node:assert/strict');
const Map=require('../journey-global-model.js'),Hotels=require('../accommodation-place-model.js'),A=require('../address-display.js'),Rules=require('../entry-rules.js'),Saved=require('../saved-places-model.js'),Account=require('../account-model.js');
test('Date ranges intersect overnight records, individual connection legs and overlapping stays',()=>{
 const state={activeProfileId:'p',profiles:[{id:'p'}],trips:[],stays:[{id:'country',countryCode:'TN',start:'2026-10-25',end:'2026-11-05'}],transports:[{id:'night',type:'train',startLocal:'2026-10-31T23:00',endLocal:'2026-11-01T06:00'},{id:'connection',type:'flight',legs:[{startLocal:'2026-10-31T23:00',endLocal:'2026-11-01T01:00'},{startLocal:'2026-11-02T01:00',endLocal:'2026-11-02T03:00'}]}],accommodations:[{id:'hotel',checkIn:'2026-10-30',checkOut:'2026-11-04'}],placeVisits:[{id:'pin',category:'locations',date:'2026-11-01'},{id:'undated',category:'locations'}]};
 const before=JSON.stringify(state),rows=Map.rows(state),filtered=Map.filter(rows,Map.defaults,'2026-10-02',{from:'2026-11-01',to:'2026-11-01'});
 assert.deepEqual(filtered.map(r=>r.key),['transport:night:0','transport:connection:0','accommodation:hotel','location:pin','destination:country']);
 assert.equal(Map.filter(rows,{...Map.defaults,flights:false},'2026-10-02',{from:'2026-11-01',to:'2026-11-03'}).length,4);
 assert.equal(Map.filter(rows,Map.defaults,'2026-10-02',{}).length,rows.length);assert.equal(JSON.stringify(state),before);
 assert.ok(Map.intersects({end:'2026-11-03'},{from:'2026-11-03'}));assert.ok(Map.intersects({start:'2026-11-04',end:'2026-11-03'},{to:'2026-11-03'}));assert.equal(Map.intersects({start:'2026-11-05'},{to:'2026-11-03'}),false);
});
const property=(name,lat=33.918,address='12 Route Touristique, Tozeur')=>({name,lat,lon:8.104,address,countryCode:'TN',city:'Tozeur',type:'Hotel'});
test('Historical Palm Beach aliases group into one property while retaining each complete stay',()=>{
 const records=[{id:'april',propertyName:'Palm Beach',place:property('Palm Beach'),checkIn:'2026-04-01',checkOut:'2026-04-04',price:{amount:100,currency:'GBP'},notes:'First booking',tripId:'a'},{id:'october',propertyName:'Palm Beach Palace Tozeur',place:property('Palm Beach Palace Tozeur',33.9181),checkIn:'2026-10-21',checkOut:'2026-10-24',notes:'Return visit',bookingReference:'REF2',tripId:'b'}];
 const before=JSON.stringify(records),groups=Hotels.groups(records);assert.equal(groups.length,1);assert.equal(groups[0].name,'Palm Beach Palace Tozeur');assert.equal(groups[0].records.length,2);assert.equal(groups[0].records[0],records[0]);assert.equal(JSON.stringify(records),before);
 assert.equal(Saved.search([{id:'canonical',place:groups[0].place}],'Palm Beach',null).length,1);
});
test('Property reconciliation tolerates accents and small offsets but vetoes neighbours and identity conflicts',()=>{
 assert.ok(Hotels.same(property('Hôtel Belvédère Fourati'),property('Hotel Belvedere Fourati',33.91835)));
 assert.equal(Hotels.same(property('Palm Beach'),property('Palm Beach Palace Tozeur',33.928)),false);
 assert.equal(Hotels.same(property('Hotel A'),property('Hotel B')),false);
 assert.equal(Hotels.same(property('Hilton Garden Inn London Heathrow'),property('Hilton Garden Inn London Heathrow Terminal 2',33.9195)),false);
 assert.equal(Hotels.same({...property('Same Hotel'),houseNumber:'12'},{...property('Same Hotel'),houseNumber:'14'}),false);
 assert.equal(Hotels.same({...property('Same Hotel'),street:'Main Road'},{...property('Same Hotel'),street:'Other Road'}),false);
 assert.equal(Hotels.same({...property('Same Hotel'),id:'osm:W:1'},{...property('Same Hotel'),id:'osm:W:2'}),false);
 assert.equal(Hotels.same({name:'Palm Beach'},{name:'Palm Beach Palace Tozeur'}),false);
});
test('English aliases precede global romanisation and raw address snapshots are preserved',()=>{
 const raw={name:'فندق',nameEn:'Palm Beach Palace',address:'Route touristique, 2200, توزر, Tozeur, Tunisia',addressAliases:{'توزر':'Tozeur'}};const before=JSON.stringify(raw),display=A.place(raw);
 assert.equal(display.name,'Palm Beach Palace');assert.equal(display.address,'Route touristique, 2200, Tozeur, Tunisia');assert.equal(JSON.stringify(raw),before);
 for(const text of ['Москва','Αθήνα','ירושלים','北京市东城区','東京都','서울','กรุงเทพมหานคร','თბილისი','Երևան'])assert.ok(A.isLatin(A.text(text)),text);
 assert.equal(A.text('Hôtel Belvédère'),'Hôtel Belvédère');assert.equal(A.text('\u{10FFFF}'),'\u{10FFFF}');
});
test('Worldwide lookup distinguishes the requested uncommon passport/destination combinations',()=>{
 const expected=[['TD','GY','visa-required'],['TL','UA','evisa'],['GB','IE','conditional-exemption'],['GB','GY','visa-free'],['DE','US','eta'],['IN','JP','visa-required'],['BR','FR','visa-free'],['NP','AR','visa-required'],['GY','TN','unknown'],['ZA','TH','visa-free']];
 for(const [passport,destination,status]of expected){const r=Rules.lookup(passport,destination,{today:'2026-10-02',travelDate:'2026-11-08'});assert.equal(r.status,status,passport+' → '+destination);assert.equal(r.passportCode,passport);assert.equal(r.destinationCode,destination);assert.equal(r.context.travelDate,'2026-11-08');assert.ok(r.sources.length);if(r.verified)assert.equal(r.checked,'2026-10-02');else {assert.equal(r.checked,null);assert.equal(r.indicative.status,'visa-required');assert.match(r.uncertainty,/confirmation/);}}
 assert.equal(Rules.coverage().passports,199);assert.equal(Rules.coverage().routes,39402);assert.equal(Rules.lookup('ZA','TH',{today:'2026-10-02',travelDate:'2026-11-08'}).days,30);
 assert.equal(Rules.lookup('GB','GY',{today:'2026-10-02',travelDate:'2026-11-08'}).days,30);
 assert.equal(Rules.lookup('MT','SR',{today:'2026-10-02'}).status,'entry-permit');assert.equal(Rules.lookup('JP','GH',{today:'2026-10-02'}).status,'evisa');
});
test('Health entry conditions use departure, recent travel, transit duration and age rather than nationality',()=>{
 const get=options=>Rules.lookup('GB','GY',{today:'2026-10-02',travelDate:'2026-11-08',...options});
 assert.equal(get({arrivingFrom:'GB',age:30}).health.assessment,'conditional');assert.equal(get({arrivingFrom:'BR',age:30}).health.assessment,'required');
 assert.equal(get({arrivingFrom:'GB',transit:[{country:'BR',hours:4}],age:30}).health.assessment,'conditional');assert.equal(get({transit:[{country:'BR',hours:5}],age:30}).health.assessment,'required');assert.equal(get({recentCountries:['BR'],age:30}).health.assessment,'required');
 assert.equal(get({arrivingFrom:'BR',age:.5}).health.assessment,'below-age-threshold');assert.equal(get({arrivingFrom:'BR'}).health.assessment,'conditional');
 assert.equal(Rules.lookup('JP','GH',{today:'2026-10-02',age:30}).health.assessment,'required');assert.match(get({}).health.recommendations[0],/recommended/);
 assert.notEqual(get({arrivingFrom:'GB',age:30}).fingerprint,get({arrivingFrom:'BR',age:30}).fingerprint);
});
test('Cache copies cannot mutate rules; stale sources and special purposes do not invent certainty',()=>{
 const input={today:'2026-10-02',travelDate:'2026-11-08'},one=Rules.lookup('DE','US',input);one.status='visa-free';one.sources[0].name='corrupted';assert.equal(Rules.lookup('DE','US',input).status,'eta');assert.notEqual(Rules.lookup('DE','US',input).sources[0].name,'corrupted');
 assert.equal(Rules.lookup('DE','US',{...input,purpose:'transit'}).status,'unknown');assert.equal(Rules.lookup('DE','US',{...input,today:'2027-01-01'}).status,'unknown');assert.equal(Rules.lookup('DE','US',{...input,travelDate:'2026-02-30'}).status,'unknown');
 assert.equal(Rules.lookup('DE','US',{...input,travelDate:'2020-01-01'}).status,'unknown','Current guidance does not verify undocumented historical rules');assert.equal(Rules.lookup('GB','GY',{...input,travelDate:'2020-01-01'}).health.verified,false);assert.equal(Rules.lookup('ZA','TH',{...input,travelDate:'2026-09-01'}).days,60,'An explicitly documented historical period retains its applicable rule');
});
test('Legacy records reconcile without a storage migration and passport context stays separate from home',()=>{
 const legacy={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Traveller',citizenships:['TD'],homeCountryCodes:['GB']}],trips:[{id:'trip',name:'Guyana'}],stays:[{id:'country',tripId:'trip',countryCode:'GY',countryName:'Guyana',start:'2026-11-08',end:'2026-11-10'}],transports:[{id:'f',type:'flight',tripId:'trip',start:{name:'London',countryCode:'GB'},end:{name:'Georgetown',countryCode:'GY'},startLocal:'2026-11-07T23:00',endLocal:'2026-11-08T09:00'}],accommodations:[],placeVisits:[],savedPlaces:[],residences:[],visaAcknowledgements:[{id:'old',fingerprint:'retained'}],excludedCountryCodes:['GB'],visualLayers:{calendar:{countries:true}}};
 const before=JSON.stringify(legacy),c=Rules.forStay(legacy,legacy.stays[0]);assert.equal(c.passport,'TD');assert.equal(c.options.arrivingFrom,'GB');assert.equal(c.options.travelDate,'2026-11-08');assert.equal(c.options.days,3);assert.equal(JSON.stringify(legacy),before);Account.validateImport(legacy);const merged=Account.importData(legacy,Account.copy(legacy));assert.deepEqual(merged.data.stays,legacy.stays);assert.deepEqual(merged.data.transports,legacy.transports);assert.deepEqual(merged.data.visaAcknowledgements,legacy.visaAcknowledgements);
});
test('Provider refresh is shared, caches identical requests and keeps unverified data provisional',async()=>{
 const D=require('../data/entry-requirements/passport-index.js'),raw={};for(const p of D.codes){raw[p]={};for(let i=0;i<D.codes.length;i++){const n=D.matrix[p][i];if(n)raw[p][D.codes[i]]={status:D.statuses[n%10],...(Math.floor(n/10)?{days:Math.floor(n/10)}:{})};}}
 raw.GY.TN={status:'e-visa'};let calls=0;const fetcher=async()=>{calls++;return {ok:true,json:async()=>raw};};const before=Rules.lookup('GY','TN',{today:'2026-10-02'});
 await Promise.all([Rules.refresh(fetcher),Rules.refresh(fetcher)]);assert.equal(calls,1);await Rules.refresh(fetcher);assert.equal(calls,1);
 const after=Rules.lookup('GY','TN',{today:'2026-10-02'});assert.equal(after.status,'unknown');assert.equal(after.indicative.status,'evisa');assert.equal(after.checked,null);assert.notEqual(after.fingerprint,before.fingerprint);assert.equal(Rules.lookup('TD','GY',{today:'2026-10-02'}).status,'visa-required','Official rules retain precedence over provider indications');
});

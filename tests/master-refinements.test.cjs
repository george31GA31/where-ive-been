const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../journey-model.js'),Search=require('../travel-search.js'),Prices=require('../travel-costs.js');
test('Travel context ranks precise stations, hotels and terminals above generic towns',()=>{
 const town={id:'town',name:'Peterborough',type:'city',lat:52.5,lon:-.2};
 const station={id:'station',name:'Peterborough railway station',type:'station',lat:52.57,lon:-.24};
 assert.equal(Search.rank([town,station],'Peterborough','train')[0].id,'station');
 const hotel={...station,id:'hotel',name:'Peterborough Hotel',type:'hotel'};
 assert.equal(Search.rank([town,hotel],'Peterborough','accommodation')[0].id,'hotel');
 assert.equal(Search.normalise({geometry:{coordinates:[1,2]},properties:{osm_type:'N',osm_id:5,name:'Station',osm_value:'station',housenumber:'12',street:'Main Street',city:'Town',countrycode:'gb',country:'UK'}}).address,'12, Main Street, Town, UK');
});
test('Ground vias produce distinct lightweight legs and every affected day without copies',()=>{
 const record={id:'t',type:'train',start:{name:'A'},end:{name:'C'},via:[{name:'B',arrivalLocal:'2026-10-11T12:00',departureLocal:'2026-10-11T13:00',operator:'Connection operator'}],startLocal:'2026-10-10T23:30',endLocal:'2026-10-12T06:30'};
 const before=JSON.stringify(record),legs=J.groundLegs(record);
 assert.equal(J.transportLabel(record),'A → B → C');assert.equal(legs.length,2);
 assert.equal(legs[0].endLocal,'2026-10-11T12:00');assert.equal(legs[1].operator,'Connection operator');
 assert.deepEqual(J.transportDates(record),['2026-10-10','2026-10-11','2026-10-12']);assert.equal(JSON.stringify(record),before);
});
test('Prices retain original currencies, deduplicate repeated record references and include returns once',()=>{
 const outbound={id:'a',price:{amount:12.5,currency:'GBP'}},returned={id:'b',roundTripId:'pair',price:{amount:30,currency:'EUR'}};
 assert.deepEqual(Prices.totals([outbound,outbound,returned]),{GBP:12.5,EUR:30});assert.match(Prices.valid({amount:-1,currency:'GBP'}),/valid/);assert.equal(Prices.valid({amount:0,currency:'GBP'}),'');
});
const Rules=require('../entry-rules.js'),M=require('../account-model.js');
test('Official entry rules recognise CTA and purpose, duration, residency and stale-data uncertainty',()=>{
 assert.match(Rules.lookup('GB','IE').title,/Common Travel Area/);
 assert.equal(Rules.lookup('GB','FR').requirement,'visa free');
 assert.equal(Rules.lookup('GB','AL').requirement,'visa free');
 assert.equal(Rules.lookup('GB','US').requirement,'eta');
 assert.equal(Rules.lookup('GB','IN').requirement,'visa');
 assert.equal(Rules.lookup('GB','EG').requirement,'visa on arrival');
 for(const args of [['GB','FR',{purpose:'work'}],['GB','AL',{days:100}],['GB','FR',{residency:'permit'}],['GB','IE',{today:'2027-01-01'}],['XX','YY',{}]])assert.equal(Rules.lookup(...args).requirement,'unknown');
});
test('New trip photos, linked returns, notes and original prices survive backup validation and account merge',()=>{
 const old={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Traveller'}],trips:[],stays:[],transports:[],accommodations:[],placeVisits:[],residences:[]};
 const next=M.copy(old);next.trips.push({id:'trip',name:'Photo trip',notes:'Line 1\nLine 2',photos:[{id:'photo',src:'data:image/jpeg;base64,YQ=='}],coverPhotoId:'photo'});
 next.transports.push({id:'out',type:'train',profileId:'p',tripId:'trip',start:{name:'Station A',address:'10 A Street'},end:{name:'Station B'},startLocal:'2026-10-02T08:00',endLocal:'2026-10-02T10:00',notes:'Ticket notes',price:{amount:30,currency:'GBP'},roundTripId:'pair',relatedTransportId:'return',via:[{name:'Via station'}]});
 M.validateImport(next);const merged=M.importData(old,next);assert.equal(merged.conflicts.length,0);assert.deepEqual(merged.data.trips[0].photos,next.trips[0].photos);assert.deepEqual(merged.data.transports[0].price,next.transports[0].price);assert.equal(merged.data.transports[0].notes,'Ticket notes');assert.equal(merged.data.transports[0].roundTripId,'pair');
});

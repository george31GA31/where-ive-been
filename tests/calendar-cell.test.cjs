const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../calendar-layout-model.js');
const hotel={id:'hotel',propertyName:'Original Hotel',checkIn:'2026-10-10',checkOut:'2026-10-12',checkInTime:'06:00',checkOutTime:'23:00',timeZone:'Europe/London',notes:'Preserve'};
test('A sole check-in and check-out leave their other half empty, regardless of entered times',()=>{
 const before=JSON.stringify(hotel);
 assert.deepEqual(C.lodging([hotel],'2026-10-10').map(({width,column,span,columns})=>({width,column,span,columns})),[{width:.5,column:2,span:1,columns:[.5,.5]}]);
 assert.deepEqual(C.lodging([hotel],'2026-10-12').map(({width,column,span})=>({width,column,span})),[{width:.5,column:1,span:1}]);
 assert.deepEqual(C.lodging([hotel],'2026-10-11').map(({width,column,span})=>({width,column,span})),[{width:1,column:1,span:2}]);
 assert.deepEqual(C.lodging([hotel],'2026-10-09'),[]);assert.equal(JSON.stringify(hotel),before);
});
test('Hotel changes keep check-out left and check-in right even when records are reversed',()=>{
 const next={...hotel,id:'next',checkIn:'2026-10-12',checkOut:'2026-10-14'},rows=C.lodging([next,hotel],'2026-10-12');
 assert.equal(rows.find(r=>r.record.id==='hotel').column,1);assert.equal(rows.find(r=>r.record.id==='next').column,2);assert.ok(rows.every(r=>r.width===.5));
});
test('Concurrent check-ins stay within the right half and concurrent check-outs within the left',()=>{
 const rows=[hotel,{...hotel,id:'other'}],incoming=C.lodging(rows,'2026-10-10'),outgoing=C.lodging(rows,'2026-10-12');
 assert.deepEqual(incoming.map(r=>[r.column,r.width]),[[2,.25],[3,.25]]);assert.deepEqual(incoming[0].columns,[.5,.25,.25]);
 assert.deepEqual(outgoing.map(r=>[r.column,r.width]),[[1,.25],[2,.25]]);assert.deepEqual(outgoing[0].columns,[.25,.25,.5]);
 assert.deepEqual(C.lodging(rows,'2026-10-11').map(r=>[r.column,r.width]),[[1,.5],[2,.5]]);
});

test('Transition positions remain 50/50 without changing saved journey ordering across timezones',()=>{
 const incoming={...hotel,id:'incoming',checkIn:'2026-10-12',checkOut:'2026-10-14',checkInTime:'02:00',timeZone:'Pacific/Auckland'};
 const rows=C.lodging([incoming,hotel],'2026-10-12');
 assert.deepEqual([...rows].sort((a,b)=>a.column-b.column).map(r=>[r.record.id,r.phase,r.column,r.width,r.complex]),[['hotel','checkout',1,.5,false],['incoming','checkin',2,.5,false]]);
});

test('Overlaps and same-day rooms advertise ambiguity instead of implying a hotel change',()=>{
 const overlap={...hotel,id:'parallel'},rows=C.lodging([hotel,overlap],'2026-10-11');
 assert.ok(rows.every(row=>row.complex));assert.equal(new Set(rows.map(row=>row.record.id)).size,2);
 const room={...hotel,checkOut:hotel.checkIn};
 assert.equal(C.lodging([room],room.checkIn)[0].phase,'same-day');assert.ok(C.lodging([room],room.checkIn)[0].complex);
});

test('Missing accommodation dates disclose only the known boundary without invented overnight days',()=>{
 for(const record of [{...hotel,checkOut:null},{...hotel,checkIn:null}]){
  const date=record.checkIn||record.checkOut,before=JSON.stringify(record);
  assert.equal(C.lodging([record],date)[0].phase,'incomplete');assert.ok(C.lodging([record],date)[0].complex);
  assert.equal(C.lodging([record],'2026-10-11').length,0);assert.equal(JSON.stringify(record),before);
 }
});

test('Week/month boundaries and repeated properties preserve record identities and checkout semantics',()=>{
 const old={...hotel,id:'september',propertyName:'Same property',checkIn:'2026-09-28',checkOut:'2026-10-05'},next={...old,id:'october',checkIn:'2026-10-05',checkOut:'2026-11-02'};
 const before=JSON.stringify([old,next]);
 assert.equal(C.lodging([old,next],'2026-10-04')[0].phase,'continuing');
 assert.deepEqual(C.lodging([next,old],'2026-10-05').map(r=>[r.record.id,r.phase]),[['september','checkout'],['october','checkin']]);
 assert.equal(C.lodging([old,next],'2026-11-01')[0].phase,'continuing');assert.equal(C.lodging([old,next],'2026-11-02')[0].phase,'checkout');assert.equal(C.lodging([old,next],'2026-11-03').length,0);
 assert.equal(JSON.stringify([old,next]),before);
});

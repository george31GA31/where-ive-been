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

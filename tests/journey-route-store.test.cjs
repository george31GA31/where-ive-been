'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../journey-route-store');

const record=()=>({id:'t1',type:'train',start:{name:'London',lat:51.5,lon:-.1},via:[{name:'Lille',lat:50.63,lon:3.06}],end:{name:'Paris',lat:48.86,lon:2.35},notes:'keep',price:{amount:42,currency:'GBP'}});

test('resolved geometry is saved and reused for the same transport leg',()=>{
  const t=record(),start=t.start,end=t.via[0],result={coordinates:[[51.5,-.1],[51.2,.4],[50.63,3.06]],label:'Mapped railway route (OSM)'};
  assert.equal(S.write(t,0,'train',start,end,result),true);
  assert.deepEqual(S.read(t,0,'train',start,end).coordinates,result.coordinates);
  assert.equal(S.write(t,0,'train',start,end,result),false,'identical geometry is not rewritten');
});

test('route-affecting edits invalidate signatures while notes and prices do not',()=>{
  const t=record(),before=S.transportSignature(t);
  t.notes='different note';t.price={amount:99,currency:'EUR'};
  assert.equal(S.transportSignature(t),before);
  t.end={...t.end,lat:48.9};
  assert.notEqual(S.transportSignature(t),before);
  const changed=S.transportSignature(t);t.end={...t.end,lat:48.86};t.via.push({name:'Arras',lat:50.29,lon:2.78});
  assert.notEqual(S.transportSignature(t),changed);
});

test('saved fallbacks survive reload-shaped copies and stale endpoints are rejected',()=>{
  const t=record(),fallback={coordinates:[[51.5,-.1],[48.86,2.35]],label:'Recorded stops joined by a straight line; route unavailable.',illustrative:true,source:'straight-fallback'};
  S.write(t,1,'train',t.via[0],t.end,fallback);
  const restored=JSON.parse(JSON.stringify(t));
  assert.equal(S.read(restored,1,'train',restored.via[0],restored.end).source,'straight-fallback');
  restored.end.lon=2.4;
  assert.equal(S.read(restored,1,'train',restored.via[0],restored.end),null);
  assert.equal(S.stale(restored),true);
  assert.equal(S.clear(restored),true);assert.equal(restored.routeGeometry,undefined);
});

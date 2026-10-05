'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../route-persistence');
const start={name:'London St Pancras',lat:51.5319,lon:-0.1263},end={name:'Paris Gare du Nord',lat:48.8809,lon:2.3553};
test('resolved route geometry is reused only for the matching leg',()=>{const t={id:'t1',type:'train'},coords=[[51.5319,-0.1263],[50.8,1.2],[48.8809,2.3553]];R.set(t,0,'train',start,end,{coordinates:coords,label:'Mapped railway route (OSM)'});const saved=R.get(JSON.parse(JSON.stringify(t)),0,'train',start,end);assert.deepEqual(saved.coordinates,coords);assert.equal(R.get(t,0,'train',start,{...end,lat:48.9}),null);assert.equal(R.get(t,0,'boat',start,end),null);});
test('fallback geometry is persisted and a deliberate refresh clears it',()=>{const t={id:'t2',type:'boat'},a={name:'Cebu',lat:10,lon:123.9},b={name:'Tagbilaran',lat:9.8,lon:123.7};R.set(t,0,'boat',a,b,{coordinates:[[10,123.9],[9.8,123.7]],label:'Illustrative water route around the coastline',illustrative:true});assert.equal(R.get(t,0,'boat',a,b).illustrative,true);R.clear(t);assert.equal(t.resolvedRoutes,undefined);});
test('a requested retry bypasses saved geometry and preserves a good route when the retry fails',()=>{
 const t={id:'refresh',type:'train'},coordinates=[[51.5319,-.1263],[49,1],[48.8809,2.3553]];R.set(t,0,'train',start,end,{coordinates,label:'Nearby mapped railway route'});R.requestRefresh(t);
 assert.equal(R.get(t,0,'train',start,end),null);assert.deepEqual(R.get(t,0,'train',start,end,true).coordinates,coordinates);
 R.set(t,0,'train',start,end,{coordinates:[[start.lat,start.lon],[end.lat,end.lon]],unavailable:true});assert.deepEqual(R.get(t,0,'train',start,end).coordinates,coordinates);assert.ok(R.get(t,0,'train',start,end).refreshFailedAt);
});
test('all modes keep identical displayed geometry after serialisation, and corrupt coordinates are rejected',()=>{
 for(const type of ['flight','train','boat','car','bus','walk','other']){const t={id:type},resolved=R.set(t,0,type,start,end,{coordinates:[[51.531901234,-.1263000123],[50.7123456789,1.234567891],[48.8809,2.3553]]});assert.deepEqual(R.get(JSON.parse(JSON.stringify(t)),0,type,start,end).coordinates,resolved.coordinates);}
 assert.equal(R.validCoordinates([[null,0],[1,2]]),false);assert.throws(()=>R.decode('!'));
});
test('an unavailable water route is remembered without drawing an invented line across land',()=>{
 const t={id:'inland'};R.set(t,0,'boat',start,end,{coordinates:[],unavailable:true,label:'Water route unavailable'});assert.deepEqual(R.get(JSON.parse(JSON.stringify(t)),0,'boat',start,end).coordinates,[]);
});

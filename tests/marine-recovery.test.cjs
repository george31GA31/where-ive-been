'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),G=require('../journey-routes'),R=require('../route-persistence'),data=require('../data/water-land.json'),coast=G.landMask(data);
const sea={land:()=>false},way=(id,coords,tags={route:'ferry'})=>({type:'way',id,tags,geometry:coords.map(p=>p?{lat:p[0],lon:p[1]}:null)}),start={lat:0,lon:0},end={lat:0,lon:.5};
const safe=(coords,mask)=>assert.ok(coords?.length>=2&&coords.slice(1).every((p,i)=>G.waterSegment(coords[i],p,mask)));
test('Short partial ferry and shipping sections survive large missing portions, including two disconnected sections',async()=>{
 const elements=[way(1,[[0,.06],[.005,.08],[0,.1]]),way(2,[[0,.38],[.004,.4],[0,.42]],{waterway:'fairway'})],before=JSON.stringify(elements);
 assert.equal(await G.networkPath(elements,start,end,{type:'boat',mask:sea}),null);
 const result=await G.marinePath(elements,start,end,sea);assert.equal(result.partial,true);safe(result.coordinates,sea);
 for(const p of [[.005,.08],[.004,.4]])assert.ok(result.coordinates.some(c=>G.distance(c,p)<.02),'Mapped vertex is retained');assert.equal(JSON.stringify(elements),before);
});
test('Partial marine geometry is clipped to the recorded journey rather than keeping a long unrelated extension',async()=>{
 const result=await G.marinePath([way(3,[[0,-.3],[0,.7]])],start,end,sea);safe(result.coordinates,sea);assert.equal(result.partial,true);assert.ok(G.distance(result.coordinates[0],[0,0])<.01);assert.ok(G.distance(result.coordinates.at(-1),[0,.5])<.01);assert.ok(result.coordinates.every(p=>p[1]>=0&&p[1]<=.5));
});
test('Missing ferry sections reconnect around an island and unsafe mapped segments cannot cut through it',async()=>{
 const island=G.landMask({schema:1,polygons:[[[[.2,-.015],[.3,-.015],[.3,.015],[.2,.015],[.2,-.015]]]]});
 const result=await G.marinePath([way(1,[[0,.05],[.002,.1],[0,.15]]),way(2,[[0,.35],[.002,.4],[0,.45]]),way(3,[[0,.1],[0,.4]])],start,end,island);safe(result.coordinates,island);assert.ok(result.coordinates.some(p=>Math.abs(p[0])>.015));
 assert.equal(G.safeMarinePath([[0,0],[0,.5]],island),null);
});
function load(fetch){const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../journey-map'),'utf8'),{window,document:{addEventListener(){}},HVRouteGeometry:G,HVRouteStore:R,fetch,AbortController,DOMException,URLSearchParams,Date,performance,setTimeout,clearTimeout,queueMicrotask});return window.HVJourneyMap;}
test('Provider outages still produce a safe persisted Carti to Capurgana route',async()=>{
 const calls=[],map=load(async url=>{calls.push(url);return url.startsWith('data/')?{ok:true,json:async()=>data}:{ok:false};});
 const a={lat:9.46,lon:-78.96},b={lat:8.639,lon:-77.345},controller=new AbortController(),result=await map.route('boat',a,b,controller.signal);safe(result.coordinates,coast);assert.equal(result.unavailable,undefined);
 const record={id:'ferry'},saved=R.set(record,0,'boat',a,b,result);safe(saved.coordinates,coast);const count=calls.length;assert.deepEqual((await map.route('boat',a,b,controller.signal)).coordinates,result.coordinates);assert.equal(calls.length,count);assert.deepEqual(R.get(record,0,'boat',a,b).coordinates,saved.coordinates);
});
test('Exact safe ferry geometry is retained and closed marine lookups stop',async()=>{
 const coords=[[10,-77.5],[10.2,-77.7],[11,-78]],a={lat:10,lon:-77.5},b={lat:11,lon:-78};
 const map=load(async url=>({ok:true,json:async()=>url.startsWith('data/')?data:{elements:[{type:'relation',tags:{route:'ferry'},members:[way(1,coords)]}]}}));assert.deepEqual((await map.route('boat',a,b,new AbortController().signal)).coordinates,coords);
 const controller=new AbortController();controller.abort();await assert.rejects(map.route('boat',a,b,controller.signal),{name:'AbortError'});
});

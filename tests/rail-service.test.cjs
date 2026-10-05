'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),G=require('../journey-routes');
const departure=require('./fixtures/route-networks/ljubljana-station.json'),arrival=require('./fixtures/route-networks/jesenice-station.json'),ways=require('./fixtures/route-networks/ljubljana-jesenice.json').elements,nodes=new Map();
for(const way of ways)way.nodes.forEach((id,i)=>nodes.set(id,{type:'node',id,...way.geometry[i]}));
const full={elements:[...nodes.values(),...ways.map(({geometry,...way})=>way),departure.elements.find(e=>e.type==='relation'&&e.id===1973077)]},start={lat:46.0592,lon:14.5134},end={lat:46.4365,lon:14.0554};
function load(fetch){
 const window={},context={window,document:{addEventListener(){}},HVRouteGeometry:G,HVRouteStore:require('../route-persistence'),fetch,AbortController,DOMException,URLSearchParams,Date,performance,clearTimeout,setTimeout:(fn,ms)=>setTimeout(fn,ms<=3000?0:ms)};
 const source=fs.readFileSync(path.join(__dirname,'../journey-map.js'),'utf8').replace('window.HVJourneyMap={open,mountGlobal,waterFallback};','window.HVJourneyMap={open,mountGlobal,waterFallback};window.testRailFallback=railFallback;');vm.runInNewContext(source,context);return window.testRailFallback;
}
test('Overpass outages recover through physical railway infrastructure without a scheduled service',async()=>{
 const calls=[],fetch=async url=>{calls.push(url);if(url.includes('overpass'))return {ok:false};let data;
  if(url.includes('/relation/')){assert.ok(url.includes('/1973077/full.json'));data=full;}else{const bbox=new URL(url).searchParams.get('bbox').split(',').map(Number);data=bbox[1]<46.1?departure:arrival;}
  return {ok:true,json:async()=>data};
 };
 const coords=await load(fetch)(start,end,new AbortController().signal,[]);assert.ok(coords?.length>1000);assert.deepEqual(coords[0],[start.lat,start.lon]);assert.deepEqual(coords.at(-1),[end.lat,end.lon]);
 const length=coords.slice(1).reduce((n,p,i)=>n+G.distance(coords[i],p),0);assert.ok(length>60000&&length<70000);assert.equal(calls.filter(u=>u.includes('/map.json')).length,2);assert.equal(calls.filter(u=>u.includes('/relation/')).length,1);
 assert.ok([...departure.elements,...arrival.elements].filter(e=>e.type==='relation').every(e=>e.tags.route!=='train'));
});
test('Closing a railway lookup aborts an in-flight OSM backup and starts no later relation requests',async()=>{
 const controller=new AbortController(),calls=[];let started;const ready=new Promise(r=>started=r);
 const fetch=async(url,{signal})=>{calls.push(url);if(url.includes('overpass'))return {ok:false};started();return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Closed','AbortError'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});};
 const pending=load(fetch)(start,end,controller.signal,[]);await ready;controller.abort();assert.equal(await pending,null);assert.ok(!calls.some(u=>u.includes('/relation/')));
});
test('Usable partial railway geometry returns before either backup makes a request',async()=>{
 let calls=0;const fallback=load(async()=>{calls++;throw Error('Unexpected network request');}),relation={type:'relation',tags:{route:'train'},members:[{type:'way',geometry:[{lat:0,lon:0},{lat:.01,lon:.08},{lat:0,lon:.1},null,{lat:0,lon:.101},{lat:.01,lon:.15},{lat:0,lon:.2}]}]};
 assert.ok((await fallback({lat:0,lon:0},{lat:0,lon:.2},new AbortController().signal,[relation]))?.length>4);assert.equal(calls,0);
});

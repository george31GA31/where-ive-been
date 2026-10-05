const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function load(fetch){const window={},source=fs.readFileSync(require.resolve('../journey-map.js'),'utf8').replace('window.HVJourneyMap={open,mountGlobal,waterFallback};','window.HVJourneyMap={open,mountGlobal,waterFallback};window.testRoute=route;');vm.runInNewContext(source,{window,document:{addEventListener(){}},HVRouteGeometry:require('../journey-routes'),HVRouteStore:require('../route-persistence'),fetch,AbortController,DOMException,URLSearchParams,Date,clearTimeout,setTimeout,queueMicrotask});return window.testRoute;}
const start={lat:51,lon:0},end={lat:51.2,lon:.1},response={ok:true,json:async()=>({code:'Ok',routes:[{geometry:{coordinates:[[0,51],[.05,51.1],[.1,51.2]]}}]})};
test('a map remount joins its in-flight route instead of making a second service request',async()=>{
 let complete,calls=0;const route=load(()=>{calls++;return new Promise(r=>complete=r);}),a=new AbortController(),b=new AbortController();
 const first=route('car',start,end,a.signal).catch(e=>e.name);a.abort();const second=route('car',start,end,b.signal);complete(response);
 assert.equal(await first,'AbortError');assert.equal((await second).coordinates.length,3);assert.equal(calls,1);
 await route('car',start,end,new AbortController().signal);assert.equal(calls,1);
});
test('closing the final map cancels its pending request',async()=>{
 let aborted=false;const route=load((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Closed','AbortError'));},{once:true}))),controller=new AbortController();
 const pending=route('car',start,end,controller.signal).catch(e=>e.name);controller.abort();assert.equal(await pending,'AbortError');await new Promise(r=>setTimeout(r,0));assert.equal(aborted,true);
});
test('a deliberate refresh token makes a new request after a completed cached route',async()=>{
 let calls=0;const route=load(async()=>{calls++;return response;});await route('car',start,end,new AbortController().signal);await route('car',start,end,new AbortController().signal,'deliberate-refresh');assert.equal(calls,2);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Sync=require('../account-sync'),M=require('../account-model'),R=require('../account-records');
class Storage{constructor(){this.values=new Map();}get length(){return this.values.size;}key(i){return [...this.values.keys()][i];}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,v);}removeItem(k){this.values.delete(k);}}
const seed=()=>({version:2,activeProfileId:'p',profiles:[{id:'p',name:'Existing traveller'}],stays:[{id:'s',profileId:'p',countryCode:'DZ',start:'2026-10-05',end:'2026-10-25',status:'planned'}],residences:[],notes:[]});
function backend(data=seed()){
 const api={cloud:M.copy(data),revision:1,writes:0,hold:null};api.from=()=>({select(){return this;},eq(){return this;},abortSignal(){return this;},async maybeSingle(){if(api.hold)return api.hold;return {data:{payload:M.copy(api.cloud),revision:api.revision},error:null};}});
 api.rpc=async(_,request)=>{api.writes++;if(request.p_revision!==api.revision)return{error:{code:'40001'}};api.cloud=M.copy(request.p_payload);api.revision++;return{data:[{revision:api.revision}],error:null};};return api;
}
const engine=(api,storage,onData=()=>{})=>new Sync({client:api,storage,tabId:'test',onData,onStatus(){},resolve:async()=>({}),timeout:5000});
test('owned cache is usable during a stalled read and intervening edits merge with the server',async()=>{
 const data=seed(),storage=new Storage(),api=backend(data);storage.setItem('whereIveBeen.outbox.v1.A.previous',JSON.stringify({base:data,local:data,revision:1}));let release,shown;api.hold=new Promise(resolve=>release=resolve);const early=new Promise(resolve=>shown=resolve),sync=engine(api,storage,shown),loading=sync.start('A',data);const cached=await early;
 assert.deepEqual(cached,data);assert.equal(sync.reconciling,true);const edited=M.copy(cached);edited.notes.push({id:'note',date:'2026-10-14',title:'Apply for Suriname visa'});sync.edit(edited);await sync.flush();assert.equal(api.writes,0);
 api.cloud.stays[0].notes='Another device';api.revision=2;api.hold=null;release({data:{payload:M.copy(api.cloud),revision:2},error:null});await loading;assert.equal(api.cloud.notes[0].title,'Apply for Suriname visa');assert.equal(api.cloud.stays[0].notes,'Another device');assert.equal(sync.pending(),false);sync.stop();
});
test('failed cached startup retains pending deletions and never reports a server acknowledgement',async()=>{
 const data=seed(),local=M.copy(data),storage=new Storage();local.stays=[];storage.setItem('whereIveBeen.outbox.v1.A.previous',JSON.stringify({base:data,local,revision:1}));const api=backend(data);api.from=()=>({select(){return this;},eq(){return this;},abortSignal(){return this;},async maybeSingle(){return{error:{status:503,message:'Unavailable'}};}});
 const messages=[],sync=engine(api,storage);sync.onStatus=message=>messages.push(message);await sync.start('A',data);assert.equal(sync.ready,true);assert.deepEqual(sync.local.stays,[]);assert.equal(sync.pending(),true);assert.equal(api.writes,0);assert.ok(!messages.includes('Saved to account'));sync.stop();
});
test('an identity change between large startup copies cannot hydrate or checkpoint the old account',async()=>{
 for(const cached of [false,true]){
  const data=seed(),storage=new Storage(),api=backend(data);const raw=JSON.stringify({base:data,local:data,revision:1});if(cached)storage.setItem('whereIveBeen.outbox.v1.A.previous',raw);
  let release,reached;const paused=new Promise(resolve=>reached=resolve),shown=[],sync=engine(api,storage,value=>shown.push(value));sync.yieldTask=()=>new Promise(resolve=>{release=resolve;reached();});
  const loading=sync.start('A',data);await paused;assert.equal(sync.ready,false);sync.stop();release();await loading;assert.deepEqual(shown,[]);assert.equal(sync.user,null);assert.equal(sync.local,undefined);assert.equal(api.writes,0);if(cached)assert.equal(storage.getItem('whereIveBeen.outbox.v1.A.previous'),raw);
 }
});
test('malformed or other-owner recovery snapshots cannot substitute an empty account',async()=>{
 const data=seed(),storage=new Storage(),raw=JSON.stringify({base:'broken',local:'broken',revision:1});storage.setItem('whereIveBeen.outbox.v1.A.bad',raw);storage.setItem('whereIveBeen.outbox.v1.B.other',JSON.stringify({base:data,local:{...data,notes:[{id:'private'}]},revision:9}));const sync=engine(backend(data),storage);await sync.start('A',data);assert.deepEqual(sync.local,data);assert.equal(storage.getItem('whereIveBeen.outbox.v1.A.bad'),raw);sync.stop();
});
test('unchanged reconciliation preserves open-editor references and signals verified readiness once',async()=>{
 const data=seed(),storage=new Storage(),api=backend(data);storage.setItem('whereIveBeen.outbox.v1.A.previous',JSON.stringify({base:data,local:data,revision:1}));let release,shown;api.hold=new Promise(resolve=>release=resolve);const early=new Promise(resolve=>shown=resolve),displays=[],sync=engine(api,storage,data=>{displays.push(data);shown(data);});let ready=0;sync.onReady=()=>ready++;const loading=sync.start('A',data);await early;api.hold=null;release({data:{payload:M.copy(data),revision:1},error:null});await loading;assert.equal(displays.length,1);assert.equal(ready,1);assert.equal(api.writes,0);sync.stop();
});
test('structural copies isolate editor objects, preserve new empty collections and retain exact routes',()=>{
 const original=seed();original.transports=[{id:'t',resolvedRoutes:{0:{coordinates:[[1,2],[3,4]]}}}];const owned=M.copy(original),ui=M.copy(original);ui.notes.push({id:'n',body:'Visa',extra:[]});const next=M.copyChanged(ui,owned);assert.equal(next.transports,owned.transports);assert.deepEqual(next.notes[0].extra,[]);ui.notes[0].body='Later';assert.equal(next.notes[0].body,'Visa');assert.deepEqual(original.notes,[]);
 const before=M.copy(original),after=M.copy(before);after.notes.push({id:'n',title:'Visa'});const changes=R.changes(original,before,after);assert.equal(changes.transports,original.transports);after.transports[0].resolvedRoutes[0].coordinates.push([5,6]);assert.equal(R.changes(original,before,after).transports[0].resolvedRoutes[0].coordinates.length,3);assert.equal(original.transports[0].resolvedRoutes[0].coordinates.length,2);
});
test('adding a note retains opaque legacy notes even if an older archive field already exists',()=>{
 const original=seed();original.notes={raw:'Keep this'};original.legacyTravelNotes={older:'Keep too'};const before={...M.copy(original),notes:[]},after=M.copy(before);after.notes.push({id:'new',title:'Visa'});const saved=R.changes(original,before,after);assert.deepEqual(saved.legacyTravelNotes,original.legacyTravelNotes);assert.deepEqual(saved.legacyTravelNotesRecovery,original.notes);
});
test('oversized saves retain durable edits, reject the RPC and recover after correction',async()=>{
 const data=seed(),storage=new Storage(),api=backend(data),sync=engine(api,storage);await sync.start('A',data);const local=M.copy(data);local.notes=[{id:'n',body:'x'.repeat(5000000)}];sync.edit(local);await sync.flush();assert.equal(api.writes,0);assert.equal(sync.pending(),true);assert.equal(sync.lastFailure.category,'size');assert.equal(sync.draft(storage.getItem(sync.key())).local.notes[0].body.length,5000000);local.notes[0].body='Still retained';sync.edit(local);await sync.reconnect();assert.equal(api.cloud.notes[0].body,'Still retained');sync.stop();
});

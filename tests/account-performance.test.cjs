'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../account-model.js'),Sync=require('../account-sync.js'),Cache=require('../account-cache.js'),Records=require('../account-records.js');
class Storage {
  constructor(){this.items=new Map();this.writes=0;}
  get length(){return this.items.size;}
  key(i){return [...this.items.keys()][i];}
  getItem(k){return this.items.get(k)??null;}
  setItem(k,v){this.items.set(k,v);this.writes++;}
  removeItem(k){this.items.delete(k);}
}
const seed=()=>({profiles:[{id:'p',name:'Me'}],stays:[{id:'s',countryCode:'FR',start:'2020-01-01',end:'2020-01-02'}],activeProfileId:'p'});
const engine=(api,storage=new Storage(),timeout=50)=>new Sync({client:api,storage,tabId:'t',timeout,onData:()=>{},onStatus:()=>{},resolve:async()=>({})});
function backend(payload=seed()){
  const calls=[],api={calls,revision:1,payload,from(){return{select(columns){calls.push(columns);return this;},eq(){return this;},async maybeSingle(){return{data:{payload:api.payload,revision:api.revision}};}};},async rpc(){throw Error('An unchanged account must never be written');}};return api;
}
test('concurrent startup callers share one load, idle checks read only a revision and never rewrite the cache',async()=>{
  const api=backend(),storage=new Storage(),s=engine(api,storage),first=s.start('A',{}),second=s.start('A',{});assert.equal(first,second);await first;
  const writes=storage.writes;await s.flush({scheduled:true});await s.flush({scheduled:true});
  assert.deepEqual(api.calls,['payload,revision','revision','revision']);assert.equal(storage.writes,writes);s.stop();
});
test('a malformed recovery key stays preserved and cannot hide a successful account download',async()=>{
  const storage=new Storage(),raw='{unfinished migration';storage.setItem('whereIveBeen.outbox.v1.A.old',raw);
  const s=engine(backend(),storage);await s.start('A',{});assert.equal(s.ready,true);assert.deepEqual(s.local,seed());assert.equal(storage.getItem('whereIveBeen.outbox.v1.A.old'),raw);s.stop();
});
test('a stalled read has a deadline, releases the load flight and can be manually retried',async()=>{
  const api=backend(),s=engine(api,new Storage(),15),original=api.from;
  api.from=()=>({select(){return this;},eq(){return this;},maybeSingle:()=>new Promise(()=>{})});
  await s.start('A',{});assert.equal(s.ready,false);assert.equal(s.loading,false);assert.equal(s.lastFailure.category,'timeout');
  api.from=original;await s.start('A',{});assert.equal(s.ready,true);s.stop();
});
test('schema and permission errors have distinct diagnostics',async()=>{
  for(const [code,status,category]of [['42501',403,'permission'],['42703',400,'schema']]){
    const api=backend();api.from=()=>({select(){return this;},eq(){return this;},async maybeSingle(){return{error:{code},status};}});
    const s=engine(api);await s.start('A',{});assert.equal(s.lastFailure.category,category);assert.equal(s.ready,false);s.stop();
  }
});
test('exact duplicate cache artwork uses one asset and expands to identical legacy payloads',()=>{
  const src='data:image/png;base64,AAAA',snapshot={format:'account-outbox-2',base:{savedPlaces:[{id:'a',accommodationLogo:{src}},{id:'b',accommodationLogo:{src}}],transports:[{id:'route',resolvedRoutes:{coordinates:[[1,2],[3,4]]}}]},changes:{savedPlaces:{kind:'records',ids:['a','b'],values:[{id:'a',accommodationLogo:{src}}]}},removed:[],revision:4};
  const packed=Cache.pack(snapshot);assert.equal(packed.assets.length,1);assert.deepEqual(Cache.unpack(packed),snapshot);assert.equal(snapshot.base.savedPlaces[0].accommodationLogo.src,src);
  packed.assets=[];assert.throws(()=>Cache.unpack(packed),/incomplete/);
});
test('invalid legacy rows are isolated for display and retained byte-for-byte through healthy edits and merge',()=>{
  const data={...seed(),stays:[null,...seed().stays],transports:[{id:'malformed',startLocal:null}],fixture:'keep'},original=M.copy(data);
  const {data:visible,preserved}=Records.project(data);assert.equal(visible.stays.length,1);assert.equal(visible.transports.length,0);assert.deepEqual(Records.restore(visible,preserved),original);
  visible.stays[0].note='A normal edit';const restored=Records.restore(visible,preserved),merged=M.merge(original,restored,original);
  assert.equal(merged.data.stays[0],null);assert.deepEqual(merged.data.transports,original.transports);assert.equal(merged.data.stays[1].note,'A normal edit');assert.equal(merged.conflicts.length,0);
});
test('indexed import keeps exact duplicate and conflict decisions for a logo and route heavy account',()=>{
  const data={profiles:[],stays:[],transports:[],savedPlaces:[]};
  for(let i=0;i<500;i++){data.savedPlaces.push({id:'image-'+i,accommodationLogo:{src:'data:image/png;base64,'+'A'.repeat(4000)+i}});data.transports.push({id:'route-'+i,coordinates:Array.from({length:100},(_,n)=>[n,i])});}
  const incoming=M.copy(data);incoming.savedPlaces[0].id='duplicate';incoming.transports[0].note='Changed';
  const result=M.importData(data,incoming);assert.equal(result.data.savedPlaces.length,500);assert.equal(result.data.transports.length,500);assert.equal(result.conflicts.length,1);assert.equal(data.transports[0].note,undefined);
});
test('hydrated display defaults never become edits or conflicts with changes on another device',()=>{
  const original={accommodations:[{id:'hotel',checkIn:'2020-01-01',checkOut:'2020-01-02'}],notes:[{id:'n',body:'Original'}],legacySetting:' untouched '};
  const before=M.copy(original);before.accommodations[0].notes='';before.accommodations[0].profileId=null;before.excludedCountryCodes=[];
  const after=M.copy(before);after.notes[0].body='Offline edit';
  const local=Records.changes(original,before,after);assert.equal(Object.hasOwn(local.accommodations[0],'notes'),false);assert.equal(Object.hasOwn(local,'excludedCountryCodes'),false);assert.equal(local.legacySetting,original.legacySetting);
  const remote=M.copy(original);remote.accommodations[0].notes='Another device';
  const merged=M.merge(original,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.data.notes[0].body,'Offline edit');assert.equal(merged.data.accommodations[0].notes,'Another device');
  const edited=M.copy(before);edited.accommodations[0].notes='Actual new note';assert.equal(Records.changes(original,before,edited).accommodations[0].notes,'Actual new note');
  assert.deepEqual(Records.changes(original,before,before),original,'Reverting an edit also reverts the persisted value');
});

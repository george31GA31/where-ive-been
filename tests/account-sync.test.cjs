const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../account-model.js');
const Sync = require('../account-sync.js');
const Logos = require('../accommodation-logos.js');
const state = () => ({version:2, stays:[{id:'s1',countryCode:'GB',start:'2026-01-01',end:'2026-01-02',notes:'one',profileId:'p1'}], profiles:[{id:'p1',name:'Me',citizenships:['GB'],enabledRules:['schengen']}], residences:[], activeProfileId:'p1', excludedCountryCodes:[]});
class Storage {
  constructor() { this.items = new Map(); }
  get length() { return this.items.size; }
  key(i) { return [...this.items.keys()][i]; }
  getItem(k) { return this.items.get(k) ?? null; }
  setItem(k,v) { this.items.set(k,v); }
  removeItem(k) { this.items.delete(k); }
}
function backend(initial = state()) {
  let remote = {payload:M.copy(initial),revision:1};
  const api = {
    fail:false, beforeSave:null,
    from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      if (api.fail) return {error:new Error('offline')};
      return {data:M.copy(remote)};
    }}; },
    async rpc(name, {p_payload,p_revision}) {
      if (api.beforeSave) { const callback = api.beforeSave; api.beforeSave = null; await callback(); }
      if (api.fail) return {error:new Error('offline')};
      if (p_revision !== remote.revision) return {error:{code:'40001'}};
      remote = {payload:M.copy(p_payload),revision:remote.revision+1};
      return {data:[M.copy(remote)]};
    },
    get:() => M.copy(remote.payload),
    change(data) { remote = {payload:M.copy(data),revision:remote.revision+1}; }
  };
  return api;
}
function engine(api, storage = new Storage(), tabId = 'tab') {
  const statuses = [];
  const s = new Sync({client:api,storage,tabId,onData:()=>{},onStatus:(...args)=>statuses.push(args),resolve:async conflicts=>Object.fromEntries(conflicts.map(c=>[c.path,'local']))});
  s.statuses = statuses; return s;
}
test('location logos use the existing outbox, survive offline reload and merge with another device edit', async () => {
  const data=state(),p={id:'osm:N:sur',name:'Best Western Sur',type:'Hotel',city:'Sur',countryCode:'OM',address:'Sur Road',lat:22.57,lon:59.52};
  data.savedPlaces=[];data.accommodations=['first','second'].map(id=>({id,profileId:'p1',propertyName:p.name,place:M.copy(p)}));
  const api=backend(data),storage=new Storage(),s=engine(api,storage);await s.start('A',data);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=';
  const local=M.copy(data);Logos.set(local,'first',image);api.fail=true;s.edit(local);await s.flush();s.stop();api.fail=false;
  const another=engine(api,storage,'other-account');await another.start('B',data);assert.equal(Logos.logo(another.local,'first'),null);another.stop();
  const remote=api.get();remote.stays[0].notes='Other device note';api.change(remote);
  const restored=engine(api,storage,'reload');await restored.start('A',data);
  assert.equal(Logos.logo(api.get(),'second'),image);assert.equal(api.get().stays[0].notes,'Other device note');assert.deepEqual(api.get().accommodations,data.accommodations);
  const removed=M.copy(restored.local);Logos.set(removed,'second',null);restored.edit(removed);await restored.flush();assert.equal(Logos.logo(api.get(),'first'),null);restored.stop();
});
test('independent changes merge, deletions stay deleted, same-field edits require a choice', () => {
  const b=state(), l=M.copy(b), r=M.copy(b); l.stays[0].notes='local'; r.stays[0].end='2026-01-03';
  const out=M.merge(b,l,r); assert.equal(out.conflicts.length,0); assert.equal(out.data.stays[0].notes,'local'); assert.equal(out.data.stays[0].end,'2026-01-03');
  r.stays[0].notes='remote'; assert.equal(M.merge(b,l,r).conflicts.length,1);
  assert.equal(M.merge(b,{...b,stays:[]},b).data.stays.length,0);
  assert.equal(M.merge(b,{...b,stays:[]},r).conflicts.length,1);
});
test('migration is idempotent and remaps equivalent traveller IDs without duplicate trips', () => {
  const r=state(), l=M.copy(r); l.profiles[0].id='different'; l.stays[0].id='new-stay-id'; l.stays[0].profileId='different';
  const out=M.importData(r,l); assert.equal(out.conflicts.length,0); assert.equal(out.data.stays.length,1); assert.equal(out.data.profiles.length,1);
  assert.deepEqual(M.importData(out.data,l).data,out.data);
  l.profiles[0].id='p1'; l.profiles[0].name='Changed'; assert.equal(M.importData(r,l).conflicts.length,1);
  assert.equal(r.profiles[0].name,'Me');
});
test('automatic sync retries optimistic conflicts without losing either device edit', async () => {
  const api=backend(), s=engine(api); await s.start('A',state());
  const local=state(); local.stays[0].notes='mine'; s.edit(local);
  api.beforeSave=async()=>{const other=api.get();other.stays.push({...other.stays[0],id:'s2',countryCode:'FR'});api.change(other);};
  await s.flush(); assert.equal(api.get().stays.length,2); assert.equal(api.get().stays[0].notes,'mine'); assert.equal(s.pending(),false);s.stop();
});
test('failed saves survive reload and only recover for the owning account', async () => {
  const api=backend(), storage=new Storage(), s=engine(api,storage);await s.start('A',state());api.fail=true;
  const local=state();local.stays[0].notes='offline edit';s.edit(local);await s.flush();assert.equal(s.pending(),true);s.stop();api.fail=false;
  const b=engine(api,storage,'b');await b.start('B',state());assert.equal(b.local.stays[0].notes,'one');b.stop();
  const restored=engine(api,storage,'new-tab');await restored.start('A',state());assert.equal(api.get().stays[0].notes,'offline edit');assert.equal(restored.pending(),false);restored.stop();
});
test('an edit made during a save is sent in a subsequent pass', async () => {
  const api=backend(),s=engine(api);await s.start('A',state());const first=state();first.stays[0].notes='first';s.edit(first);
  api.beforeSave=async()=>{const second=M.copy(first);second.stays[0].notes='second';s.edit(second);};
  await s.flush();assert.equal(api.get().stays[0].notes,'second');s.stop();
});
test('sign-out during an in-flight save cannot publish late UI data or clear the outbox', async () => {
  const api=backend(),storage=new Storage(),s=engine(api,storage);await s.start('A',state());const local=state();local.stays[0].notes='pending';s.edit(local);
  api.beforeSave=async()=>s.stop();await s.flush();assert.equal(s.user,null);assert.ok([...storage.items.values()].some(raw=>raw.includes('pending')));
});
test('a tab never deletes another tab’s newer pending edits', async () => {
  const api=backend(),storage=new Storage(),a=engine(api,storage,'a');await a.start('A',state());a.stop();
  const b=engine(api,storage,'b');await b.start('A',state());const local=state();local.stays[0].notes='new a';
  storage.setItem('whereIveBeen.outbox.v1.A.a',JSON.stringify({base:state(),local,revision:1}));await b.flush();assert.match(storage.getItem('whereIveBeen.outbox.v1.A.a'),/new a/);b.stop();
});
test('an offline account reload uses its own saved snapshot and flushes new edits on reconnection',async()=>{
 const api=backend(),storage=new Storage(),a=engine(api,storage);await a.start('A',state());a.stop();api.fail=true;
 const offline=engine(api,storage,'offline');await offline.start('A',state());assert.equal(offline.ready,true);assert.equal(offline.local.stays[0].notes,'one');
 const changed=M.copy(offline.local);changed.stays[0].notes='Edited offline';offline.edit(changed);await offline.flush();assert.equal(offline.pending(),true);api.fail=false;await offline.flush();assert.equal(api.get().stays[0].notes,'Edited offline');offline.stop();
 api.fail=true;const other=engine(api,storage,'other');await other.start('B',state());assert.equal(other.ready,false);assert.equal(other.local,undefined);other.stop();
});
test('compact checkpoints preserve additions, deletions, ordering and unknown fields without repeating unchanged artwork',async()=>{
 const data=state();data.savedPlaces=[{id:'hotel-a',artwork:'x'.repeat(1650000)},{id:'hotel-b',custom:{retain:true}}];data.extra={unknown:['keep',null]};data.removable=true;
 const api=backend(data),storage=new Storage(),s=engine(api,storage);await s.start('A',data);api.fail=true;
 const local=M.copy(data);local.stays[0].notes='Offline note';local.savedPlaces=[local.savedPlaces[1],{id:'hotel-c',newField:'added'},local.savedPlaces[0]];local.extra={unknown:['changed',null]};delete local.removable;local.preference=false;
 s.edit(local);const raw=storage.getItem(s.key());assert.ok(raw.length<JSON.stringify(data).length+2000,'Unchanged large artwork is stored once');
 const decoded=s.draft(raw);assert.deepEqual(decoded.base,data);assert.deepEqual(decoded.local,local);assert.equal(Object.getPrototypeOf(decoded.local),Object.prototype);
 s.stop();const restored=engine(api,storage,'reload');await restored.start('A',data);assert.deepEqual(restored.local,local);assert.equal(restored.ready,true);restored.stop();
});
test('compact checkpoints retain empty arrays, duplicate IDs, scalar arrays and records with changed nested route data',async()=>{
 const data=state();data.extraRows=[{id:'repeat',v:1},{id:'repeat',v:2}];data.tags=['a','b'];data.transports=[{id:'t',route:{coordinates:[[1,2],[3,4]]},notes:'before'}];
 const api=backend(data),s=engine(api);await s.start('A',data);const local=M.copy(data);local.stays=[];local.extraRows.reverse();local.tags=['b','a'];local.transports[0].route.coordinates.push([5,6]);local.transports[0].notes=null;s.edit(local);
 assert.deepEqual(s.draft(s.storage.getItem(s.key())).local,local);s.stop();
});
test('a successfully downloaded account remains usable when device storage rejects every write',async()=>{
 const data=state(),api=backend(data),storage=new Storage();storage.setItem('whereIveBeen.beforeAccounts.v1','unchanged backup');storage.setItem('whereIveBeen.outbox.v1.B.other','other account');const before=[...storage.items];
 storage.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};const s=engine(api,storage);let shown;s.onData=d=>shown=d;await s.start('A',data);
 assert.equal(s.ready,true);assert.deepEqual(shown,data);assert.deepEqual(api.get(),data);assert.deepEqual([...storage.items],before);assert.match(s.statuses.at(-1)[0],/Saved to account.*Device storage is full/);assert.ok(!s.statuses.some(([message])=>message.includes('Could not load')));s.stop();
});
test('device quota failure cannot block an online account save or erase retained recovery copies',async()=>{
 const api=backend(),storage=new Storage(),s=engine(api,storage);await s.start('A',state());const raw=storage.getItem(s.key());storage.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
 const local=state();local.stays[0].notes='Saved online despite full device';s.edit(local);assert.equal(s.pending(),true);await s.flush();assert.equal(api.get().stays[0].notes,local.stays[0].notes);assert.equal(s.pending(),false);assert.equal(storage.getItem(s.key()),raw);assert.match(s.statuses.at(-1)[0],/Saved to account.*Device storage is full/);s.stop();
});
test('offline quota failures retain pending memory data and recover only existing copies owned by the account',async()=>{
 const api=backend(),storage=new Storage(),s=engine(api,storage);await s.start('A',state());const raw=storage.getItem(s.key());api.fail=true;storage.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
 const local=state();local.stays[0].notes='Keep page open';s.edit(local);await s.flush();assert.equal(s.pending(),true);assert.equal(s.local.stays[0].notes,local.stays[0].notes);assert.equal(api.get().stays[0].notes,'one');assert.equal(storage.getItem(s.key()),raw);s.stop();
 const same=engine(api,storage,'same');await same.start('A',state());assert.equal(same.ready,true);assert.equal(same.local.stays[0].notes,'one');same.stop();const other=engine(api,storage,'other');await other.start('B',state());assert.equal(other.ready,false);assert.equal(other.local,undefined);other.stop();
});
test('legacy unsaved checkpoints merge with fresh account changes and are retired only after the new checkpoint fits',async()=>{
 const data=state(),local=M.copy(data);local.stays[0].notes='Legacy unsaved edit';const remote=M.copy(data);remote.stays[0].end='2026-01-04';const api=backend(remote),storage=new Storage();storage.setItem('whereIveBeen.outbox.v1.A.old',JSON.stringify({base:data,local,revision:1}));storage.setItem('unrelated','keep');
 const s=engine(api,storage,'new');await s.start('A',data);assert.equal(api.get().stays[0].notes,local.stays[0].notes);assert.equal(api.get().stays[0].end,remote.stays[0].end);assert.equal(storage.getItem('whereIveBeen.outbox.v1.A.old'),null);assert.equal(storage.getItem('unrelated'),'keep');assert.deepEqual(s.draft(storage.getItem(s.key())).local,api.get());s.stop();
});

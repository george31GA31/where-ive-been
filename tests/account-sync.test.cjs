const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../account-model.js');
const Sync = require('../account-sync.js');
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

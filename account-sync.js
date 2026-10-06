/* Durable per-tab outbox and revision-checked account saves. No tracker UI dependencies. */
(function (root) {
  'use strict';
  const M = typeof module !== 'undefined' && module.exports ? require('./account-model.js') : root.WIBModel;
  class AccountSync {
    constructor({client, storage, tabId, onData, onStatus, resolve}) {
      Object.assign(this, {client, storage, tabId, onData, onStatus, resolve});
      this.epoch = 0; this.user = null; this.ready = false; this.saving = false;
    }
    prefix(id = this.user) { return 'whereIveBeen.outbox.v1.' + id + '.'; }
    key() { return this.prefix() + this.tabId; }
    status(message, kind = 'neutral') { this.onStatus(message, kind); }
    stop() {
      this.epoch++; this.user = null; this.ready = false; this.saving = false;
      clearTimeout(this.timer);
      this.base=undefined;this.local=undefined;this.revision=0;this.adopted=[];
    }
    async read(id) {
      const {data, error} = await this.client.from('travel_tracker_data').select('payload,revision').eq('user_id', id).maybeSingle();
      if (error) throw error;
      return {payload: data?.payload || {}, revision: Number(data?.revision || 0)};
    }
    async combine(base, local, remote) {
      let merged = M.merge(base, local, remote);
      if (merged.conflicts.length) {
        const choices = await this.resolve(merged.conflicts);
        merged = M.merge(base, local, remote, c => choices[c.path] === 'local' ? c.local : c.remote);
      }
      return merged.data;
    }
    // Retain the complete merge base, but store only changed local fields and
    // records. Large unchanged hotel logos/routes need only one disk copy.
    snapshot() {
      const changes = {}, removed = [], base = this.base, local = this.local;
      const records = rows => Array.isArray(rows) && rows.every(r => r && typeof r.id === 'string') && new Set(rows.map(r => r.id)).size === rows.length;
      for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
        if (!Object.prototype.hasOwnProperty.call(local, key)) { removed.push(key); continue; }
        if (M.equal(base[key], local[key])) continue;
        if (records(base[key]) && records(local[key])) {
          const before = new Map(base[key].map(r => [r.id, r]));
          Object.defineProperty(changes, key, {enumerable:true, value:{kind:'records', ids:local[key].map(r => r.id), values:local[key].filter(r => !M.equal(before.get(r.id), r))}});
        } else Object.defineProperty(changes, key, {enumerable:true, value:{kind:'value', value:local[key]}});
      }
      return {format:'account-outbox-2', base, changes, removed, revision:this.revision};
    }
    draft(raw) {
      const saved = JSON.parse(raw);
      if (saved.format !== 'account-outbox-2') return saved;
      const local = Object.fromEntries(Object.entries(M.copy(saved.base)).filter(([key]) => !saved.removed.includes(key)));
      for (const [key, change] of Object.entries(saved.changes)) {
        let value = change.value;
        if (change.kind === 'records') {
          const rows = new Map((local[key] || []).map(r => [r.id, r]));
          for (const row of change.values) rows.set(row.id, row);
          value = change.ids.map(id => rows.get(id));
        }
        Object.defineProperty(local, key, {enumerable:true, configurable:true, writable:true, value});
      }
      return {base:saved.base, local, revision:saved.revision};
    }
    checkpoint() {
      this.storage.setItem(this.key(), JSON.stringify(this.snapshot()));
    }
    cache() {
      try { this.checkpoint(); return true; } catch { return false; }
    }
    savedStatus(cached) {
      this.status(cached ? 'Saved to account' : 'Saved to account. Device storage is full; the offline backup could not be updated.', cached ? 'good' : 'bad');
    }
    async start(id, empty) {
      this.stop(); this.user = id; const epoch = this.epoch;
      this.status('Loading account…');
      try {
        const remote = await this.read(id);
        if (epoch !== this.epoch) return;
        this.base = M.copy(remote.payload); this.local = M.copy(remote.payload); this.revision = remote.revision;
        this.adopted = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (!key.startsWith(this.prefix(id))) continue;
          const raw = this.storage.getItem(key), draft = this.draft(raw);
          this.local = await this.combine(draft.base, draft.local, this.local);
          if (epoch !== this.epoch) return;
          this.adopted.push({key, raw});
        }
        if (!Object.keys(this.local).length) this.local = M.copy(empty);
        // A device-backup failure must never hide successfully loaded cloud data.
        const cached = this.cache(); this.ready = true;
        this.onData(M.copy(this.local));
        if (!M.equal(this.base, this.local)) await this.flush();
        else this.savedStatus(this.clean(cached));
      } catch (error) {
        if(epoch!==this.epoch)return;
        // Recover only this account's durable snapshots when the connection is down.
        const drafts=[];
        for(let i=0;i<this.storage.length;i++){
          const key=this.storage.key(i);if(!key.startsWith(this.prefix(id)))continue;
          const raw=this.storage.getItem(key);try{const draft=this.draft(raw);if(draft.base&&draft.local)drafts.push({key,raw,...draft});}catch{}
        }
        drafts.sort((a,b)=>Number(b.revision)-Number(a.revision));
        if(drafts.length){
          this.base=M.copy(drafts[0].base);this.local=M.copy(drafts[0].local);this.revision=Number(drafts[0].revision)||0;
          for(const draft of drafts.slice(1))this.local=await this.combine(draft.base,draft.local,this.local);
          if(epoch!==this.epoch)return;
          this.adopted=drafts.map(({key,raw})=>({key,raw}));this.cache();this.ready=true;this.onData(M.copy(this.local));
          this.status('Offline — showing your saved account data. Changes will sync when you reconnect.', 'bad');
        }else this.status('Could not load account. Your device data is safe. Retry when connected.', 'bad');
      }
    }
    edit(data) {
      if (!this.ready) throw new Error('Wait for your account to finish loading.');
      this.local = M.copy(data);
      if (this.cache()) this.status('Saving…');
      else this.status('Device storage is full. Keep this page open until your changes are saved to account.', 'bad');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 650);
    }
    flush() {
      if (this.saving) return this.flight;
      if (!this.ready) return Promise.resolve();
      return this.flight = this.performFlush();
    }
    async performFlush() {
      const epoch = this.epoch, id = this.user;
      this.saving = true;
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const remote = await this.read(id);
          if (epoch !== this.epoch) return;
          const localBefore = M.copy(this.local);
          const combined = await this.combine(this.base, localBefore, remote.payload);
          if (epoch !== this.epoch) return;
          // Edits made while fetching / resolving remain in the outbox for the next pass.
          this.local = await this.combine(localBefore, this.local, combined);
          if (epoch !== this.epoch) return;
          this.base = M.copy(remote.payload); this.revision = remote.revision;
          this.cache(); this.onData(M.copy(this.local));
          if (M.equal(this.local, remote.payload)) { this.savedStatus(this.clean()); return; }
          const sent = M.copy(this.local);
          this.status('Saving…');
          const {data, error} = await this.client.rpc('save_travel_account', {p_payload: sent, p_revision: remote.revision});
          if (epoch !== this.epoch) return;
          if (error?.code === '40001') continue;
          if (error) throw error;
          this.base = sent; this.revision = Number(data[0].revision);
          this.cache();
          if (M.equal(this.local, sent)) { this.savedStatus(this.clean()); return; }
        }
        throw new Error('Account is changing on another device.');
      } catch (error) {
        if (epoch === this.epoch) this.status('Save failed — changes kept on this device. Retry.', 'bad');
      } finally { if (epoch === this.epoch) this.saving = false; }
    }
    clean(cached = this.cache()) {
      // Keep every old recovery copy if the new checkpoint did not fit.
      if (!cached) return false;
      // Never delete a different tab's newer unsaved edits.
      for (const {key, raw} of this.adopted || []) {
        if (key !== this.key() && this.storage.getItem(key) === raw) this.storage.removeItem(key);
      }
      this.adopted = [];
      return true;
    }
    pending() { return this.ready && this.user && this.local && !M.equal(this.local, this.base); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AccountSync;
  else root.WIBAccountSync = AccountSync;
})(typeof window !== 'undefined' ? window : globalThis);

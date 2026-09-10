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
    checkpoint() {
      this.storage.setItem(this.key(), JSON.stringify({base: this.base, local: this.local, revision: this.revision}));
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
          const raw = this.storage.getItem(key), draft = JSON.parse(raw);
          this.local = await this.combine(draft.base, draft.local, this.local);
          if (epoch !== this.epoch) return;
          this.adopted.push({key, raw});
        }
        if (!Object.keys(this.local).length) this.local = M.copy(empty);
        this.checkpoint(); this.ready = true;
        this.onData(M.copy(this.local));
        if (!M.equal(this.base, this.local)) await this.flush();
        else this.status('Saved', 'good');
      } catch (error) {
        if (epoch === this.epoch) this.status('Could not load account. Your device data is safe. Retry when connected.', 'bad');
      }
    }
    edit(data) {
      if (!this.ready) throw new Error('Wait for your account to finish loading.');
      this.local = M.copy(data);
      try { this.checkpoint(); } catch (error) {
        this.status('Device storage is full. Keep this page open and retry saving.', 'bad');
        throw error;
      }
      this.status('Saving…');
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
          this.checkpoint(); this.onData(M.copy(this.local));
          if (M.equal(this.local, remote.payload)) { this.clean(); this.status('Saved', 'good'); return; }
          const sent = M.copy(this.local);
          this.status('Saving…');
          const {data, error} = await this.client.rpc('save_travel_account', {p_payload: sent, p_revision: remote.revision});
          if (epoch !== this.epoch) return;
          if (error?.code === '40001') continue;
          if (error) throw error;
          this.base = sent; this.revision = Number(data[0].revision);
          this.checkpoint();
          if (M.equal(this.local, sent)) { this.clean(); this.status('Saved', 'good'); return; }
        }
        throw new Error('Account is changing on another device.');
      } catch (error) {
        if (epoch === this.epoch) this.status('Save failed — changes kept on this device. Retry.', 'bad');
      } finally { if (epoch === this.epoch) this.saving = false; }
    }
    clean() {
      // Never delete a different tab's newer unsaved edits.
      for (const {key, raw} of this.adopted || []) {
        if (key !== this.key() && this.storage.getItem(key) === raw) this.storage.removeItem(key);
      }
      this.adopted = [];
      this.checkpoint();
    }
    pending() { return this.user && this.local && !M.equal(this.local, this.base); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AccountSync;
  else root.WIBAccountSync = AccountSync;
})(typeof window !== 'undefined' ? window : globalThis);

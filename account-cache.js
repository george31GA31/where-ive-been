/* Async storage for the existing per-account outbox. Legacy keys remain readable. */
(function (root) {
  'use strict';
  function pack(snapshot) {
    const assets = [],
      indices = new Map();
    const row = (value) => {
      const field = value?.operatorLogo ? 'operatorLogo' : 'accommodationLogo';
      const src = value?.[field]?.src;
      if (typeof src !== 'string' || !src.startsWith('data:image/')) return value;
      if (!indices.has(src)) {
        indices.set(src, assets.length);
        assets.push(src);
      }
      return {
        ...value,
        [field]: { ...value[field], src: { asset: indices.get(src) } },
      };
    };
    const base = { ...snapshot.base }, changes = { ...snapshot.changes };
    if (Array.isArray(base.transportOperators)) base.transportOperators = base.transportOperators.map(row);
    if (changes.transportOperators?.kind === 'records') changes.transportOperators = {...changes.transportOperators,values:changes.transportOperators.values.map(row)};
    else if (changes.transportOperators?.kind === 'value' && Array.isArray(changes.transportOperators.value)) changes.transportOperators = {...changes.transportOperators,value:changes.transportOperators.value.map(row)};
    if (Array.isArray(base.savedPlaces)) base.savedPlaces = base.savedPlaces.map(row);
    if (changes.savedPlaces?.kind === 'records')
      changes.savedPlaces = { ...changes.savedPlaces, values: changes.savedPlaces.values.map(row) };
    else if (changes.savedPlaces?.kind === 'value' && Array.isArray(changes.savedPlaces.value))
      changes.savedPlaces = { ...changes.savedPlaces, value: changes.savedPlaces.value.map(row) };
    return { format: 'herald-account-cache-1', assets, snapshot: { ...snapshot, base, changes } };
  }
  function unpack(value) {
    if (value?.format !== 'herald-account-cache-1') throw new Error('Unsupported account cache.');
    const row = (record) => {
      const field = record?.operatorLogo ? 'operatorLogo' : 'accommodationLogo';
      const ref = record?.[field]?.src;
      if (!ref || typeof ref !== 'object') return record;
      if (!Number.isInteger(ref.asset) || typeof value.assets[ref.asset] !== 'string')
        throw new Error('Account cache artwork is incomplete.');
      return {
        ...record,
        [field]: { ...record[field], src: value.assets[ref.asset] },
      };
    };
    const snapshot = value.snapshot,
      base = { ...snapshot.base },
      changes = { ...snapshot.changes };
    if (Array.isArray(base.transportOperators)) base.transportOperators = base.transportOperators.map(row);
    if (changes.transportOperators?.kind === 'records') changes.transportOperators = {...changes.transportOperators,values:changes.transportOperators.values.map(row)};
    else if (changes.transportOperators?.kind === 'value' && Array.isArray(changes.transportOperators.value)) changes.transportOperators = {...changes.transportOperators,value:changes.transportOperators.value.map(row)};
    if (Array.isArray(base.savedPlaces)) base.savedPlaces = base.savedPlaces.map(row);
    if (changes.savedPlaces?.kind === 'records')
      changes.savedPlaces = { ...changes.savedPlaces, values: changes.savedPlaces.values.map(row) };
    else if (changes.savedPlaces?.kind === 'value' && Array.isArray(changes.savedPlaces.value))
      changes.savedPlaces = { ...changes.savedPlaces, value: changes.savedPlaces.value.map(row) };
    return { ...snapshot, base, changes };
  }
  class AccountCache {
    constructor() {
      this.queue = Promise.resolve();
    }
    open() {
      return (this.opening ||= new Promise((resolve, reject) => {
        const request = root.indexedDB.open('whereIveBeen.account.v1', 1);
        let failed = false;
        const fail = (error) => {
          failed = true;
          clearTimeout(timer);
          this.opening = undefined;
          reject(error);
        };
        const timer = setTimeout(() => fail(new Error('Account cache could not open.')), 3000);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('outbox', { keyPath: 'key' });
        request.onerror = () => fail(request.error);
        request.onsuccess = () => {
          clearTimeout(timer);
          if (failed) {
            request.result.close();
            return;
          }
          request.result.onversionchange = () => {
            request.result.close();
            this.opening = undefined;
          };
          resolve(request.result);
        };
      }));
    }
    async transaction(mode, action) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', mode),
          store = tx.objectStore('outbox');
        let result;
        const timer = setTimeout(() => {
          try {
            tx.abort();
          } catch {}
          reject(new Error('Account cache timed out.'));
        }, 10000);
        tx.oncomplete = () => {
          clearTimeout(timer);
          resolve(result);
        };
        tx.onerror = tx.onabort = () => {
          clearTimeout(timer);
          reject(tx.error || new Error('Account cache unavailable.'));
        };
        try {
          action(store, (value) => {
            result = value;
          });
        } catch (error) {
          clearTimeout(timer);
          try {
            tx.abort();
          } catch {}
          reject(error);
        }
      });
    }
    async entries(prefix) {
      const rows = await this.transaction('readonly', (store, done) => {
        const request = store.getAll(root.IDBKeyRange.bound(prefix, prefix + '\uffff'));
        request.onsuccess = () => done(request.result);
      });
      return rows.map((row) => ({ ...row, source: 'cache' }));
    }
    save(key, snapshot) {
      // One atomic value contains assets and references, so interruption cannot
      // leave a checkpoint pointing at an asset that was never committed.
      const value = pack(snapshot),
        token = root.crypto.randomUUID();
      const write = this.queue
        .catch(() => {})
        .then(async () => {
          await this.transaction('readwrite', (store) => store.put({ key, token, value }));
          const stored = await this.transaction('readonly', (store, done) => {
            const request = store.get(key);
            request.onsuccess = () => done(request.result);
          });
          if (stored?.token !== token) throw new Error('Account cache verification failed.');
          unpack(stored.value); // Verify every artwork reference before retiring legacy copies.
          return true;
        });
      this.queue = write;
      return write;
    }
    remove(key, token) {
      return this.transaction('readwrite', (store) => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result?.token === token) store.delete(key);
        };
      });
    }
    async clearAccount(id) {
      await this.queue.catch(() => {});
      for (const row of await this.entries('whereIveBeen.outbox.v1.' + id + '.'))
        await this.remove(row.key, row.token);
    }
  }
  const api = { AccountCache, pack, unpack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WIBAccountCache = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Opt-in, metadata-only account timings. No travel details or credentials. */
(() => {
  'use strict';
  const enabled = ['localhost','127.0.0.1','[::1]'].includes(location.hostname) || new URLSearchParams(location.search).get('heraldDebug') === '1';
  const events = [];
  window.HVAccountDiagnostics = {
    record(operation, detail = {}) {
      if (!enabled) return;
      const entry = {operation, at:Math.round(performance.now()), ...detail};
      events.push(entry); if (events.length > 100) events.shift();
      console.debug('[Herald account]', entry);
    },
    async inspect() {
      const data = typeof state === 'undefined' ? {} : state;
      const bytes = value => JSON.stringify(value ?? null).length * 2;
      const storage = Object.keys(localStorage).map(key => ({key, bytes:(key.length + localStorage.getItem(key).length) * 2})).sort((a,b) => b.bytes-a.bytes);
      const rows = Object.entries(data).filter(([,value]) => Array.isArray(value)).map(([collection,value]) => ({collection,records:value.length,bytes:bytes(value)}));
      const logos = (data.savedPlaces || []).map(row => row.accommodationLogo?.src).filter(src => typeof src === 'string');
      const routes = (data.transports || []).filter(row => row.resolvedRoutes).map(row => bytes(row.resolvedRoutes));
      return {events:[...events], localStorage:{bytes:storage.reduce((n,row)=>n+row.bytes,0),keys:storage}, browserStorage:await navigator.storage?.estimate?.(), collections:rows, approximateAccountBytes:bytes(data), logos:{records:logos.length,unique:new Set(logos).size,bytes:logos.reduce((n,src)=>n+src.length*2,0),largest:Math.max(0,...logos.map(src=>src.length*2))}, routes:{records:routes.length,bytes:routes.reduce((n,b)=>n+b,0),largest:Math.max(0,...routes)}};
    }
  };
})();

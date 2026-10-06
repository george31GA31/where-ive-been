/* One authentication client shared by tracker, login and profile pages. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  let client;
  window.WIBAuth = {
    base,
    cachedSession() {
      // Identity is only for this device's account cache; the backend still verifies every request.
      try { const session=JSON.parse(localStorage.getItem('whereIveBeen.auth.v1'));return session?.user?.id&&session?.access_token?session:null; } catch {return null;}
    },
    url: path => new URL(path, base).href,
    client() {
      if (!window.supabase) throw new Error('Account service could not load. Check your connection and refresh.');
      return client ||= window.supabase.createClient(WIB_CONFIG.url, WIB_CONFIG.key, {
        global: {fetch: (input, options) => window.HVNetwork ? HVNetwork.request(input, options, {timeout:25000}) : fetch(input, options)},
        auth: {storageKey: 'whereIveBeen.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
      });
    }
  };
})();

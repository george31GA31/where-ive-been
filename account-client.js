/* One authentication client shared by tracker, login and profile pages. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  let client;
  window.WIBAuth = {
    base,
    url: path => new URL(path, base).href,
    client() {
      if (!window.supabase) throw new Error('Account service could not load. Check your connection and refresh.');
      return client ||= window.supabase.createClient(WIB_CONFIG.url, WIB_CONFIG.key, {
        auth: {storageKey: 'whereIveBeen.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
      });
    }
  };
})();

/* One authentication client shared by tracker, login and profile pages. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  let client, validation;
  function bounded(promise, timeout = 30000) {
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('Account sign-in check timed out. Your saved data is safe. Retry connection.');error.name='TimeoutError';reject(error);},timeout);})]).finally(()=>clearTimeout(timer));
  }
  window.WIBAuth = {
    base,
    cachedSession() {
      // Identity is only for this device's account cache; the backend still verifies every request.
      try { const session=JSON.parse(localStorage.getItem('whereIveBeen.auth.v1'));return session?.user?.id&&session?.access_token?session:null; } catch {return null;}
    },
    revalidate() {
      if (validation) return validation;
      validation = (async () => {
        if (navigator.onLine === false) { const e = new Error('You are offline. Reconnect and retry.'); e.kind = 'offline'; throw e; }
        const api = this.client(), deadline = Date.now()+30000;
        const within = promise => bounded(promise,Math.max(1,deadline-Date.now()));
        const result = await within(api.auth.getSession());
        if (result.error) throw result.error;
        let session = result.data.session;
        if (!session) { const e = new Error('Please sign in again. Your saved account data is safe.'); e.kind = 'auth'; throw e; }
        if (session.expires_at && session.expires_at <= Date.now() / 1000 + 30) {
          const refreshed = await within(api.auth.refreshSession());
          if (refreshed.error) throw refreshed.error;
          session = refreshed.data.session;
        }
        // getSession restores/refreshes locally; getUser verifies with Auth.
        const checked = await within(api.auth.getUser());
        if (checked.error) throw checked.error;
        if (!checked.data.user || checked.data.user.id !== session?.user?.id) { const e = new Error('Please sign in again. Your saved account data is safe.'); e.kind = 'auth'; throw e; }
        return session;
      })().finally(() => { validation = null; });
      return validation;
    },
    url: path => new URL(path, base).href,
    restoreSession() { return bounded(this.client().auth.getSession()); },
    client() {
      if (!window.supabase) throw new Error('Account service could not load. Check your connection and refresh.');
      return client ||= window.supabase.createClient(WIB_CONFIG.url, WIB_CONFIG.key, {
        global: {fetch: (input, options) => window.HVNetwork ? HVNetwork.request(input, options, {timeout:25000}) : fetch(input, options)},
        auth: {storageKey: 'whereIveBeen.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
      });
    }
  };
})();

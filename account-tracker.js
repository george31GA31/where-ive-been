/* Adapter: preserve the tracker calculations, replace only its persistence boundary. */
(() => {
  'use strict';
  const M = WIBModel, OWNER_KEY = 'whereIveBeen.localOwner.v1';
  let engine, userId = null, booted = false, authStarting = false, authSubscription, retryFlight, previewWorker, previewId = 0;
  let preservedRows = {};
  let displayBaseline;
  let hydrationSource;
  let tabId = sessionStorage.getItem('whereIveBeen.tab.v1');
  if (!tabId) { tabId = crypto.randomUUID(); sessionStorage.setItem('whereIveBeen.tab.v1', tabId); }
  const originalPersist = persist;
  function empty() { const d = defaultState(); d.activeProfileId = d.profiles[0].id; return d; }
  function status(message, kind) {
    for (const el of document.querySelectorAll('[data-sync-status]')) {
      el.textContent = message; el.className = 'status-badge ' + (kind || 'neutral');
      el.dataset.syncKind=kind||'neutral';
    }
    const retry = $('retrySaveBtn');
    if (retry) retry.hidden = kind !== 'bad' && !engine?.lastFailure;
  }
  function lock(value) { document.querySelector('.app-shell').inert = value; }
  function apply(data) {
    if (M.equal(WIBAccountRecords.restore(state,preservedRows), data)) {
      displayBaseline=userId&&engine?.ready?M.copy(state):undefined;
      hydrationSource=userId&&engine?.ready?engine.local:undefined;
      lock(false);return;
    }
    const projected=WIBAccountRecords.project(data);preservedRows=projected.preserved;
    state = projected.data; normalizeState(state);
    displayBaseline=userId&&engine?.ready?M.copy(state):undefined;
    hydrationSource=userId&&engine?.ready?engine.local:undefined;
    if(Object.keys(preservedRows).length)HVAccountDiagnostics?.record('legacy records isolated',{collections:Object.keys(preservedRows),records:Object.values(preservedRows).reduce((n,value)=>n+(value.rows?.length||1),0)});
    if (userId && engine?.ready) updatePassedPlannedTrips();
    const selections = new Map(['stayProfile', 'plannerProfile'].map(id => [id, $(id)?.value]));
    populateProfileSelects();
    for (const [id, value] of selections) if ($(id) && [...$(id).options].some(o => o.value === value)) $(id).value = value;
    renderAll(); window.dispatchEvent(new CustomEvent('hv-data-changed')); lock(false);
  }
  // Account copies never enter the legacy shared local key.
  persist = function () {
    if (userId) {
      try {
        const before=WIBAccountRecords.restore(displayBaseline,preservedRows),after=WIBAccountRecords.restore(state,preservedRows);
        engine.edit(WIBAccountRecords.changes(hydrationSource,before,after));return true;
      } catch (error) { status(error.message, 'bad'); return false; }
    } else if (!localStorage.getItem(OWNER_KEY)) {
      try { originalPersist(true); status('Saved on this device — sign in to sync', 'neutral'); return true; }
      catch { status('Could not save on this device. Keep this page open.', 'bad'); return false; }
    } else {
      try { localStorage.setItem('whereIveBeen.guest.v1', JSON.stringify(state)); status('Saved on this device — sign in to sync', 'neutral'); return true; }
      catch { status('Could not save on this device. Keep this page open.', 'bad'); return false; }
    }
  };
  // A claimed legacy copy stays preserved but is not shown to other accounts or guests.
  function guestState() { try { return JSON.parse(localStorage.getItem('whereIveBeen.guest.v1')) || empty(); } catch { return empty(); } }
  if (localStorage.getItem(OWNER_KEY)) state = guestState();
  installDataTransferUI = function () {};
  initCloudFromConfig = function () { if (booted) startAuth(); };
  // Remove old manual cloud controls and transfer flows from event binding.
  cloudPush = cloudPull = cloudSignIn = cloudSignUp = cloudSignOut = () => {};
  window.WIBResolveConflicts = conflicts => new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.className = 'dialog account-conflicts';
    const form = document.createElement('form'); form.className = 'dialog-card';
    const heading = document.createElement('h2'); heading.textContent = 'Choose which changes to keep'; form.append(heading);
    const explanation = document.createElement('p'); explanation.textContent = 'The same information changed in two places. Other changes will be combined automatically.'; form.append(explanation);
    const selectors = [];
    for (const c of conflicts) {
      const group = document.createElement('fieldset'), legend = document.createElement('legend');
      const description=M.describeConflict(c,state);legend.textContent = description.title; group.append(legend);
      const select = document.createElement('select'); select.required = true;
      for (const [value, text] of [['', 'Choose a version'], ['remote', 'Keep account version'], ['local', 'Keep this device version']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      for (const [label, value] of [['Account version', description.remote], ['This device’s version', description.local]]) {
        const p = document.createElement('p'); p.textContent = label + ': ' + value; group.append(p);
      }
      select.setAttribute('aria-label',description.title);group.append(select); form.append(group); selectors.push([c.path, select]);
    }
    const button = document.createElement('button'); button.className = 'primary'; button.textContent = 'Combine changes'; form.append(button);
    form.onsubmit = e => { e.preventDefault(); dialog.close(); dialog.remove(); resolve(Object.fromEntries(selectors.map(([path, el]) => [path, el.value]))); };
    // Dismissing leaves the pending data intact; require a choice before continuing.
    dialog.addEventListener('cancel', e => e.preventDefault()); dialog.append(form); document.body.append(dialog); dialog.showModal();
  });
  function deviceSource(){const guest=localStorage.getItem('whereIveBeen.guest.v1');if(guest){const source=JSON.parse(guest);normalizeState(source);return source;}return loadState(true);}
  function offerImport() {
    const button = $('importDeviceBtn');
    const owner = localStorage.getItem(OWNER_KEY);
    button.hidden = !userId || !!(owner && owner !== userId && !localStorage.getItem('whereIveBeen.guest.v1')) || ![APP_KEY, LEGACY_KEY,'whereIveBeen.guest.v1'].some(k => localStorage.getItem(k));
    if (!button.hidden && document.body.dataset.currentView === 'profiles') {
      const source = deviceSource();
      button.textContent = 'Add this data to my account';
      const request=++previewId,account=userId;
      const render=summary=>{if(request!==previewId||account!==userId)return;button.previousElementSibling&&(button.previousElementSibling.textContent=`We found existing travel history on this device: ${source.stays.length} stays, ${source.profiles.length} travellers, ${source.residences.length} home records, ${source.transports?.length||0} transport records and ${source.accommodations?.length||0} accommodation entries. ${summary?`${summary.duplicates} likely duplicates will be skipped; ${summary.conflicts} conflicts need a choice.`:'Checking for duplicates…'} Your original copy will be kept.`);};
      render();
      if(window.Worker){
        previewWorker?.terminate();const worker=previewWorker=new Worker(new URL('account-preview-worker.js',WIBAuth.base));
        const finish=()=>{worker.terminate();if(previewWorker===worker)previewWorker=null;};
        worker.onmessage=event=>{if(!event.data.error)render(event.data);finish();};
        worker.onerror=finish;
        worker.postMessage({id:request,account:state,source});
      }else{
        // The indexed fallback is linear; it is used only on the import page.
        const preview=M.importData(state,source),keys=Object.keys(preview.data).filter(key=>Array.isArray(preview.data[key]));
        const added=keys.reduce((n,key)=>n+preview.data[key].length-(state[key]?.length||0),0),total=keys.reduce((n,key)=>n+(source[key]?.length||0),0);
        render({duplicates:Math.max(0,total-added-preview.conflicts.length),conflicts:preview.conflicts.length});
      }
    }
  }
  async function importDevice() {
    if (!engine?.ready) return;
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId && !localStorage.getItem('whereIveBeen.guest.v1')) return;
    const source = deviceSource();
    M.validateImport(source);
    if (!confirm(`Import this device's ${source.stays.length} stays, ${source.residences.length} home records and ${source.profiles.length} traveller profiles into this account? Identical records will be skipped.`)) return;
    const importingUser = userId;
    lock(true);
    await engine.flush();
    if (userId !== importingUser) return;
    const beforeImport = M.copy(state);
    let target = M.copy(state);
    if (!target.manualCountryVisits?.length&&!target.tccVisits?.length&&!target.roadTrips?.length&&!target.currencyRates?.length&&!target.currencyPreferences?.length&&!target.trips?.length&&!target.notes?.length&&!target.checklists?.length&&!target.budgets?.length&&!target.expenses?.length&&!target.stays.length && !target.residences.length && !target.transports?.length && !target.accommodations?.length && !target.placeVisits?.length && !target.savedPlaces?.length && !target.visaAcknowledgements?.length && target.profiles.length === 1 && target.profiles[0].name === 'Me' && !target.profiles[0].citizenships.length) {
      target.profiles = []; target.activeProfileId = null;
    }
    let result = M.importData(target, source);
    if (result.conflicts.length) {
      const choices = await WIBResolveConflicts(result.conflicts);
      if (userId !== importingUser) return;
      result = M.importData(target, source, c => choices[c.path] === 'local' ? c.local : c.remote);
    }
    result.data = await engine.combine(beforeImport, result.data, state);
    if (userId !== importingUser) return;
    // Preserve an immutable original before linking the old device copy to this account.
    if (!localStorage.getItem('whereIveBeen.beforeAccounts.v1')) localStorage.setItem('whereIveBeen.beforeAccounts.v1', JSON.stringify(source));
    engine.edit(result.data);
    localStorage.setItem(OWNER_KEY, userId);
    apply(result.data); await engine.flush(); offerImport();
  }
  async function changed(session) {
    const next = session?.user?.id || null;
    if (next === userId && engine?.ready) return;
    if (next === userId && engine?.loading) return engine.loadFlight;
    const accountChanged = next !== userId;
    lock(true);
    if (accountChanged) {
      previewId++;previewWorker?.terminate();previewWorker=null;
      preservedRows={};
      engine.stop();
      userId = null;
      apply(empty());
      lock(true);
    }
    userId = next; cloudSession = null;
    document.querySelectorAll('[data-account-guest]').forEach(el=>el.hidden=!!next);
    document.querySelectorAll('[data-account-user],[data-account-logout]').forEach(el=>el.hidden=!next);
    $('accountLink').href=next?'profile/':'login/';
    if (accountChanged) document.querySelectorAll('dialog[open]').forEach(d => d.close());
    if (next) {
      await engine.start(next, empty());
      if (userId !== next) return;
      $('accountLink').textContent = 'Account';
    } else {
      engine.stop(); apply(localStorage.getItem(OWNER_KEY) ? guestState() : loadState());
      $('accountLink').textContent = 'Sign in';
      status('Saved on this device. Sign in to sync everywhere.', 'neutral');
    }
    offerImport();
    if (next && engine.ready && !$('importDeviceBtn').hidden && !localStorage.getItem('whereIveBeen.importNoticed.' + next)) {
      switchView('profiles');
      localStorage.setItem('whereIveBeen.importNoticed.' + next, 'yes');
    }
    if (new URLSearchParams(location.search).get('import') === 'device') switchView('profiles');
    // Retry is outside the locked tracker, so a failed initial load is recoverable.
    $('accountLoadError').hidden = !next || engine.ready;
  }
  async function startAuth() {
    if (authStarting) return;
    if (!window.supabase) { status('Saved on this device. Sign in when you want to sync.', 'neutral'); return; }
    authStarting = true;
    try {
      const client = WIBAuth.client();
      engine ||= new WIBAccountSync({client, storage: localStorage, cacheStore:window.indexedDB&&new WIBAccountCache.AccountCache(), tabId, onData: apply, onStatus: status, resolve: WIBResolveConflicts});
      authSubscription ||= client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setTimeout(() => changed(session).catch(()=>{lock(false);status('Account service unavailable. Your saved information is unchanged.','neutral');}), 0);
      });
      const cachedBefore=WIBAuth.cachedSession();
      if(navigator.onLine===false&&cachedBefore){await changed(cachedBefore);return;}
      let restored;
      try {restored=await WIBAuth.restoreSession();}catch(error){restored={error};}
      const {data, error} = restored;
      if (error) {
        const cached=WIBAuth.cachedSession()||cachedBefore,networkFailure=navigator.onLine===false||error.name==='TimeoutError'||error.name==='AuthRetryableFetchError'||/fetch|network|timeout/i.test(error.message||'');
        if(cached&&networkFailure){await changed(cached);return;}throw error;
      }
      await changed(data.session);
  } catch (error) { engine?.diagnostic('session restore',error);lock(false); status(userId?'Account sign-in could not be checked. Retry connection. Your saved information is unchanged.':'Saved on this device. Sign in when you want to sync.', userId?'bad':'neutral'); authStarting = false; }
  }
  function retryConnection() {
    if(retryFlight)return retryFlight;
    const buttons=[$('retrySaveBtn'),$('retryAccountLoadBtn')].filter(Boolean),labels=buttons.map(button=>button.textContent);
    buttons.forEach(button=>{button.disabled=true;button.textContent='Retrying…';button.setAttribute('aria-busy','true');});
    retryFlight=(async()=>{
      if(!window.supabase){
        await new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(new Error('Account library could not load. Check your connection and retry.'));},15000);script.src='vendor/supabase/supabase.min.js?v=2.57.4';script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Account library could not load. Check your connection and retry.'));};document.head.append(script);});
      }
      if(!engine){authStarting=false;await startAuth();}
      const session=await WIBAuth.revalidate();
      if(userId!==session.user.id||!engine.ready)await changed(session);else await engine.reconnect();
      $('accountLoadError').hidden=engine.ready;
    })().catch(error=>{engine?.diagnostic('reconnect',error);status(error.message||'Account service is unavailable. Your saved data is safe.','bad');})
    .finally(()=>{buttons.forEach((button,index)=>{button.disabled=false;button.textContent=labels[index];button.removeAttribute('aria-busy');});retryFlight=null;});
    return retryFlight;
  }
  document.addEventListener('DOMContentLoaded', () => {
    booted = true;
    document.addEventListener('click',async event=>{const button=event.target.closest('[data-account-logout]');if(!button)return;button.disabled=true;try{const {error}=await WIBAuth.client().auth.signOut({scope:'local'});if(error)throw error;}catch(error){status(error.message,'bad');}finally{button.disabled=false;}});
    $('importDeviceBtn').onclick = () => importDevice().catch(error => { lock(false); status(error.message, 'bad'); });
    $('retrySaveBtn').onclick = retryConnection;
    $('retryAccountLoadBtn').onclick = retryConnection;
    startAuth();
    window.addEventListener('hv-reconnect',()=>{if(userId)retryConnection();else if(!authStarting)startAuth();});
    window.addEventListener('hv-route',()=>{if(document.body.dataset.currentView==='profiles')offerImport();else{previewId++;previewWorker?.terminate();previewWorker=null;}});
    document.addEventListener('visibilitychange', () => { if (!document.hidden && engine?.ready) engine.flush({scheduled:true}); });
    setInterval(() => { if (!document.hidden && engine?.ready) engine.flush({scheduled:true}); }, 30000);
    window.addEventListener('beforeunload', e => { if (engine?.pending()) { e.preventDefault(); e.returnValue = ''; } });
  });
})();

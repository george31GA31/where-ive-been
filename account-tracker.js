/* Adapter: preserve the tracker calculations, replace only its persistence boundary. */
(() => {
  'use strict';
  const M = WIBModel, OWNER_KEY = 'whereIveBeen.localOwner.v1';
  let engine, userId = null, booted = false, authStarting = false;
  let tabId = sessionStorage.getItem('whereIveBeen.tab.v1');
  if (!tabId) { tabId = crypto.randomUUID(); sessionStorage.setItem('whereIveBeen.tab.v1', tabId); }
  const originalPersist = persist;
  function empty() { const d = defaultState(); d.activeProfileId = d.profiles[0].id; return d; }
  function status(message, kind) {
    for (const el of document.querySelectorAll('[data-sync-status]')) {
      el.textContent = message; el.className = 'status-badge ' + (kind || 'neutral');
    }
  }
  function lock(value) { document.querySelector('.app-shell').inert = value; }
  function apply(data) {
    if (M.equal(state, data)) { lock(false); return; }
    state = data; normalizeState(state);
    if (userId && engine?.ready) updatePassedPlannedTrips();
    const selections = new Map(['stayProfile', 'plannerProfile'].map(id => [id, $(id)?.value]));
    populateProfileSelects();
    for (const [id, value] of selections) if ($(id) && [...$(id).options].some(o => o.value === value)) $(id).value = value;
    renderAll(); lock(false);
  }
  // Account copies never enter the legacy shared local key.
  persist = function () {
    if (userId) {
      try { engine.edit(state); } catch (error) { status(error.message, 'bad'); }
    } else if (!localStorage.getItem(OWNER_KEY)) {
      try { originalPersist(true); status('Saved on this device — sign in to sync', 'neutral'); }
      catch { status('Could not save on this device. Keep this page open.', 'bad'); }
    } else {
      try { localStorage.setItem('whereIveBeen.guest.v1', JSON.stringify(state)); status('Saved on this device — sign in to sync', 'neutral'); }
      catch { status('Could not save on this device. Keep this page open.', 'bad'); }
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
      legend.textContent = c.path; group.append(legend);
      const select = document.createElement('select'); select.required = true;
      for (const [value, text] of [['', 'Choose a version'], ['remote', 'Keep account version'], ['local', 'Keep this device version']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      for (const [label, value] of [['Account', c.remote], ['This device', c.local]]) {
        const p = document.createElement('p'); p.textContent = label + ': ' + (value === undefined ? 'Deleted' : JSON.stringify(value)); group.append(p);
      }
      group.append(select); form.append(group); selectors.push([c.path, select]);
    }
    const button = document.createElement('button'); button.className = 'primary'; button.textContent = 'Combine changes'; form.append(button);
    form.onsubmit = e => { e.preventDefault(); dialog.close(); dialog.remove(); resolve(Object.fromEntries(selectors.map(([path, el]) => [path, el.value]))); };
    // Dismissing leaves the pending data intact; require a choice before continuing.
    dialog.addEventListener('cancel', e => e.preventDefault()); dialog.append(form); document.body.append(dialog); dialog.showModal();
  });
  function offerImport() {
    const button = $('importDeviceBtn');
    const owner = localStorage.getItem(OWNER_KEY);
    button.hidden = !userId || !!(owner && owner !== userId) || ![APP_KEY, LEGACY_KEY].some(k => localStorage.getItem(k));
  }
  async function importDevice() {
    if (!engine?.ready) return;
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId) return;
    const source = loadState();
    if (!confirm(`Import this device's ${source.stays.length} stays, ${source.residences.length} home records and ${source.profiles.length} traveller profiles into this account? Identical records will be skipped.`)) return;
    const importingUser = userId;
    lock(true);
    await engine.flush();
    if (userId !== importingUser) return;
    const beforeImport = M.copy(state);
    let target = M.copy(state);
    if (!target.stays.length && !target.residences.length && target.profiles.length === 1 && target.profiles[0].name === 'Me' && !target.profiles[0].citizenships.length) {
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
    lock(true);
    if (next !== userId) {
      engine.stop();
      userId = null;
      apply(empty());
      lock(true);
    }
    userId = next; cloudSession = null;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    if (next) {
      await engine.start(next, empty());
      if (userId !== next) return;
      $('accountLink').textContent = 'My profile';
    } else {
      engine.stop(); apply(localStorage.getItem(OWNER_KEY) ? guestState() : loadState());
      $('accountLink').textContent = 'Log in / Create account';
      status('Sign in to save and sync your travels', 'neutral');
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
    if (!window.supabase) { status('Account service unavailable — saved on this device only. Refresh to reconnect.', 'warn'); return; }
    authStarting = true;
    try {
      const client = WIBAuth.client();
      engine = new WIBAccountSync({client, storage: localStorage, tabId, onData: apply, onStatus: status, resolve: WIBResolveConflicts});
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setTimeout(() => changed(session), 0);
      });
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      await changed(data.session);
    } catch { lock(false); status('Account service unavailable. Refresh to retry.', 'bad'); authStarting = false; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    booted = true;
    $('importDeviceBtn').onclick = () => importDevice().catch(error => { lock(false); status(error.message, 'bad'); });
    $('retrySaveBtn').onclick = () => userId ? engine.ready ? engine.flush() : changed({user: {id: userId}}) : startAuth();
    $('retryAccountLoadBtn').onclick = () => changed({user: {id: userId}});
    startAuth();
    window.addEventListener('online', () => userId && (engine.ready ? engine.flush() : changed({user: {id: userId}})));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && engine?.ready) engine.flush(); });
    setInterval(() => { if (!document.hidden && engine?.ready) engine.flush(); }, 30000);
    window.addEventListener('beforeunload', e => { if (engine?.pending()) { e.preventDefault(); e.returnValue = ''; } });
  });
})();

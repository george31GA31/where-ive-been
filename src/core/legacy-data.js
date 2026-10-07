function installDataTransferUI() {
  let nav = document.querySelector('.nav-item[data-view="profiles"]');
  if (nav) nav.innerHTML = '<span>♙</span>Profiles & data';
  let exportBtn = $('exportBtn');
  if (exportBtn) exportBtn.textContent = 'Save backup';
  let importLabel = document.querySelector('label.file-label');
  if (importLabel) {
    let input = $('importInput');
    importLabel.innerHTML = 'Restore backup';
    if (input) {
      input.setAttribute('accept', '.travel,.json,application/json');
      importLabel.appendChild(input);
    }
  }
  let footer = document.querySelector('.sidebar-footer p');
  if (footer) footer.textContent = 'Your travel data is automatically saved on this device.';
  let profiles = $('profilesView');
  if (!profiles || $('dataTransferPanel')) return;
  let cloud = profiles.querySelector('.cloud-panel');
  if (cloud) cloud.style.display = 'none';
  let layout = profiles.querySelector('.profiles-layout');
  if (layout) layout.style.gridTemplateColumns = '1fr';
  profiles.insertAdjacentHTML(
    'beforeend',
    `
    <article class="panel data-transfer-panel" id="dataTransferPanel">
      <div class="panel-head">
        <div><p class="eyebrow">YOUR DATA</p><h2>Save & move your travel history</h2></div>
        <span id="localSaveBadge" class="status-badge good">Auto-saved ✓</span>
      </div>
      <p class="panel-copy">Your trips are saved automatically in this browser. No account is required. Use a transfer code to move everything to another device, or keep a backup file as extra protection.</p>
      <div id="localSaveDetail" class="local-save-detail">Saved on this device</div>
      <div class="transfer-grid">
        <div class="transfer-card">
          <p class="eyebrow">OLD DEVICE</p>
          <h3>Move to another device</h3>
          <p>Create a temporary, one-use code containing an encrypted copy of your travel data.</p>
          <button class="primary wide" id="createTransferBtn" type="button">Create transfer code</button>
          <div id="transferCodeArea" class="transfer-code-area hidden">
            <span>Your transfer code</span>
            <strong id="transferCodeValue" class="transfer-code-value">—</strong>
            <div class="button-row"><button class="secondary" id="copyTransferCodeBtn" type="button">Copy code</button></div>
            <small id="transferExpiry">Valid for 1 hour and can only be used once.</small>
          </div>
        </div>
        <div class="transfer-card">
          <p class="eyebrow">NEW DEVICE</p>
          <h3>Transfer to this device</h3>
          <p>Open this website on the new device and enter the temporary code from your old device.</p>
          <label class="field"><span>Transfer code</span><input id="transferCodeInput" class="transfer-code-input" type="text" inputmode="text" autocomplete="off" maxlength="19" placeholder="K7M9-P4Q2-X8CW-3TNR" /></label>
          <button class="primary wide" id="claimTransferBtn" type="button">Load my travel data</button>
        </div>
      </div>
      <div id="transferMessage" class="form-message transfer-message"></div>
      <div class="backup-strip">
        <div><strong>Backup file</strong><span>Useful if you clear browser data, lose a device, or want a permanent copy.</span></div>
        <div class="button-row"><button class="secondary" id="dataBackupBtn" type="button">Save backup</button><button class="secondary" id="dataRestoreBtn" type="button">Restore backup</button></div>
      </div>
      <div class="privacy-note"><strong>Private by design</strong><span>Transfer data is encrypted in your browser before upload. The temporary code expires after one hour and is single-use. No account, email or password is needed.</span></div>
    </article>`,
  );
  if (!$('dataTransferStyles')) {
    let style = document.createElement('style');
    style.id = 'dataTransferStyles';
    style.textContent = `
      .data-transfer-panel{margin-top:20px}.local-save-detail{font-size:13px;color:#7b8797;margin-top:-4px}.transfer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}.transfer-card{border:1px solid #e4e8ee;border-radius:18px;padding:20px;background:#fafbfc}.transfer-card h3{margin:5px 0 8px;font-size:19px}.transfer-card p:not(.eyebrow){margin:0 0 16px;color:#687386;line-height:1.5}.transfer-code-area{margin-top:14px;padding:16px;border:1px dashed #cbd3de;border-radius:14px;background:white}.transfer-code-area>span{display:block;font-size:12px;color:#7b8797;margin-bottom:5px}.transfer-code-value{display:block;font-size:27px;letter-spacing:2.5px;font-variant-numeric:tabular-nums;margin-bottom:12px;word-break:break-word}.transfer-code-area small{display:block;margin-top:9px;color:#7b8797;line-height:1.4}.transfer-code-input{text-transform:uppercase;letter-spacing:1.5px;font-weight:700}.transfer-message{margin-top:14px;min-height:18px}.backup-strip{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid #e8ebef;margin-top:20px;padding-top:18px}.backup-strip>div:first-child{display:flex;flex-direction:column;gap:4px}.backup-strip span,.privacy-note span{color:#687386;font-size:13px;line-height:1.45}.privacy-note{display:flex;gap:8px;align-items:flex-start;margin-top:16px;padding:13px 15px;border-radius:13px;background:#f5f7f9}.privacy-note strong{white-space:nowrap}.transfer-card button[disabled]{opacity:.6;cursor:wait}@media(max-width:760px){.transfer-grid{grid-template-columns:1fr}.backup-strip{align-items:flex-start;flex-direction:column}.privacy-note{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
}
function updateLocalSaveIndicator() {
  let badge = $('localSaveBadge'),
    detail = $('localSaveDetail');
  if (!badge || !detail) return;
  let raw = localStorage.getItem(LOCAL_SAVED_KEY);
  badge.textContent = 'Auto-saved ✓';
  badge.className = 'status-badge good';
  if (!raw) {
    detail.textContent = 'Your changes save automatically on this device.';
    return;
  }
  let d = new Date(raw),
    now = new Date(),
    mins = Math.floor((now - d) / 60000);
  detail.textContent =
    mins < 1
      ? 'Last saved just now'
      : mins < 60
        ? `Last saved ${mins} minute${mins === 1 ? '' : 's'} ago`
        : `Last saved ${d.toLocaleString()}`;
}
function transferServiceConfig() {
  let url = (TRANSFER_SERVICE.supabaseUrl || '').trim(),
    key = (TRANSFER_SERVICE.supabaseKey || '').trim(),
    valid =
      url.startsWith('https://') &&
      !url.includes('PASTE_YOUR_') &&
      key &&
      !key.includes('PASTE_YOUR_');
  if (!valid) {
    let local = getCloudConfig();
    if (local.url && local.key) {
      url = local.url;
      key = local.key;
      valid = true;
    }
  }
  return { url, key, valid };
}
function getTransferClient() {
  let cfg = transferServiceConfig();
  if (!cfg.valid) throw new Error('Device transfer has not been configured by the site owner yet.');
  if (!window.supabase)
    throw new Error('The transfer service is still loading. Try again in a moment.');
  if (!transferClient)
    transferClient = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  return transferClient;
}
function normalizeTransferCode(v = '') {
  let raw = String(v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return raw;
}
function displayTransferCode(raw = '') {
  let s = normalizeTransferCode(raw);
  return s.match(/.{1,4}/g)?.join('-') || s;
}
function generateTransferCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
function bytesToBase64(bytes) {
  let bin = '',
    step = 0x8000;
  for (let i = 0; i < bytes.length; i += step)
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}
function base64ToBytes(str) {
  let bin = atob(str),
    out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function sha256Hex(text) {
  let hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function transferCryptoKey(code) {
  let digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`where-ive-been-transfer:v1:${normalizeTransferCode(code)}`),
  );
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptTransferPayload(code) {
  let iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await transferCryptoKey(code),
    payload = {
      format: 'where-ive-been-transfer',
      version: 1,
      createdAt: new Date().toISOString(),
      state,
    },
    plain = new TextEncoder().encode(JSON.stringify(payload)),
    cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { encryptedPayload: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) };
}
async function decryptTransferPayload(code, encryptedPayload, ivB64) {
  let key = await transferCryptoKey(code),
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(encryptedPayload),
    ),
    payload = JSON.parse(new TextDecoder().decode(plain));
  if (payload?.format !== 'where-ive-been-transfer' || !payload.state)
    throw new Error('This transfer could not be read.');
  return payload.state;
}
function setTransferMessage(message, good = false) {
  if (!els.transferMessage) return;
  els.transferMessage.textContent = message || '';
  els.transferMessage.style.color = good ? 'var(--green)' : 'var(--red)';
}
function setTransferBusy(busy) {
  if (els.createTransferBtn) els.createTransferBtn.disabled = busy;
  if (els.claimTransferBtn) els.claimTransferBtn.disabled = busy;
}
async function createTransferCode() {
  try {
    setTransferBusy(true);
    setTransferMessage('Creating a secure transfer…', true);
    if (!window.crypto?.subtle)
      throw new Error(
        'Secure device transfer requires HTTPS. Open the GitHub Pages version of the site.',
      );
    let client = getTransferClient(),
      code = generateTransferCode(),
      lookup = await sha256Hex(`lookup:${code}`),
      enc = await encryptTransferPayload(code),
      { data, error } = await client.rpc('create_travel_device_transfer', {
        p_code_hash: lookup,
        p_encrypted_payload: enc.encryptedPayload,
        p_iv: enc.iv,
        p_expires_minutes: TRANSFER_SERVICE.expiresMinutes || 60,
      });
    if (error) throw error;
    lastTransferCode = displayTransferCode(code);
    els.transferCodeValue.textContent = lastTransferCode;
    els.transferCodeArea.classList.remove('hidden');
    let expiry = Array.isArray(data) ? data[0] : data;
    els.transferExpiry.textContent = expiry
      ? `Valid until ${new Date(expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It can only be used once.`
      : `Valid for ${TRANSFER_SERVICE.expiresMinutes || 60} minutes and can only be used once.`;
    setTransferMessage(
      'Transfer code ready. Open this website on your other device and enter the code there.',
      true,
    );
  } catch (e) {
    console.error(e);
    setTransferMessage(e?.message || 'Could not create a transfer code.');
  } finally {
    setTransferBusy(false);
  }
}
async function copyTransferCode() {
  if (!lastTransferCode) return;
  try {
    await navigator.clipboard.writeText(lastTransferCode);
    setTransferMessage('Transfer code copied.', true);
  } catch {
    window.prompt('Copy this transfer code:', lastTransferCode);
  }
}
async function claimTransferCode() {
  let raw = normalizeTransferCode(els.transferCodeInput?.value || '');
  if (raw.length !== 16) {
    setTransferMessage('Enter the complete 16-character transfer code.');
    return;
  }
  if (
    !confirm(
      'Load the transferred travel history onto this device? This will replace any travel data currently saved here.',
    )
  )
    return;
  try {
    setTransferBusy(true);
    setTransferMessage('Loading your encrypted travel data…', true);
    if (!window.crypto?.subtle)
      throw new Error(
        'Secure device transfer requires HTTPS. Open the GitHub Pages version of the site.',
      );
    let client = getTransferClient(),
      lookup = await sha256Hex(`lookup:${raw}`),
      { data, error } = await client.rpc('claim_travel_device_transfer', { p_code_hash: lookup });
    if (error) throw error;
    let row = Array.isArray(data) ? data[0] : data;
    if (!row?.encrypted_payload)
      throw new Error('That code is invalid, expired, or has already been used.');
    let incoming = await decryptTransferPayload(raw, row.encrypted_payload, row.iv);
    normalizeState(incoming);
    state = incoming;
    updatePassedPlannedTrips();
    persist(true);
    populateProfileSelects();
    renderAll();
    els.transferCodeInput.value = '';
    setTransferMessage(
      `Transfer complete — ${state.stays.length} stay${state.stays.length === 1 ? '' : 's'} loaded on this device.`,
      true,
    );
  } catch (e) {
    console.error(e);
    setTransferMessage(
      e?.name === 'OperationError'
        ? 'That transfer code could not decrypt the data. Check the code and try again.'
        : e?.message || 'Could not load this transfer.',
    );
  } finally {
    setTransferBusy(false);
  }
}
function exportData() {
  let backup = {
      format: 'where-ive-been-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      data: state,
    },
    blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Herald-Voyages-${isoDate(new Date())}.travel`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(e) {
  let f = e.target.files?.[0];
  if (!f) return;
  let r = new FileReader();
  r.onload = () => {
    try {
      let parsed = JSON.parse(r.result),
        v = parsed?.format === 'where-ive-been-backup' && parsed.data ? parsed.data : parsed;
      if (Array.isArray(v)) v = { ...defaultState(), stays: v };
      WIBModel.validateImport(v);
      normalizeState(v);
      if (
        !confirm(
          'Restore this backup? It will replace the travel data currently saved on this device.',
        )
      ) {
        e.target.value = '';
        return;
      }
      state = v;
      updatePassedPlannedTrips();
      persist();
      populateProfileSelects();
      renderAll();
      alert(
        `Backup restored — ${state.stays.length} stay${state.stays.length === 1 ? '' : 's'} loaded.`,
      );
    } catch {
      alert("That file is not a valid Where I've Been backup.");
    }
    e.target.value = '';
  };
  r.readAsText(f);
}
function getCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCloudConfig() {
  let c = getCloudConfig();
  c.url = els.supabaseUrl.value.trim();
  c.key = els.supabaseKey.value.trim();
  c.autoSync = els.autoSyncToggle.checked;
  localStorage.setItem(CLOUD_KEY, JSON.stringify(c));
  initCloudFromConfig();
}
async function initCloudFromConfig() {
  let c = getCloudConfig();
  els.supabaseUrl.value = c.url || '';
  els.supabaseKey.value = c.key || '';
  els.autoSyncToggle.checked = !!c.autoSync;
  if (!c.url || !c.key || !window.supabase) {
    setCloudUI('Local only', false);
    return;
  }
  try {
    cloudClient = window.supabase.createClient(c.url, c.key);
    let { data } = await cloudClient.auth.getSession();
    cloudSession = data.session || null;
    setCloudUI(cloudSession ? 'Signed in' : 'Configured', !!cloudSession);
  } catch (e) {
    setCloudMessage('Could not connect to Supabase. Check the URL/key.');
    setCloudUI('Local only', false);
  }
}
function setCloudUI(label, signed) {
  els.cloudStatusBadge.textContent = label;
  els.cloudStatusBadge.className = `status-badge ${signed ? 'good' : 'neutral'}`;
  els.cloudPullBtn.disabled = !signed;
  els.cloudPushBtn.disabled = !signed;
  els.cloudSignInBtn.classList.toggle('hidden', signed);
  els.cloudSignOutBtn.classList.toggle('hidden', !signed);
}
function setCloudMessage(m, good = false) {
  els.cloudMessage.textContent = m;
  els.cloudMessage.style.color = good ? 'var(--green)' : 'var(--red)';
}
async function cloudSignUp() {
  if (!cloudClient) {
    setCloudMessage('Save valid cloud settings first.');
    return;
  }
  let email = els.cloudEmail.value.trim(),
    password = els.cloudPassword.value;
  if (!email || !password) {
    setCloudMessage('Enter email and password.');
    return;
  }
  let { error } = await cloudClient.auth.signUp({ email, password });
  if (error) setCloudMessage(error.message);
  else
    setCloudMessage(
      'Account created. If email confirmation is enabled, confirm it before signing in.',
      true,
    );
}
async function cloudSignIn() {
  if (!cloudClient) {
    setCloudMessage('Save valid cloud settings first.');
    return;
  }
  let { data, error } = await cloudClient.auth.signInWithPassword({
    email: els.cloudEmail.value.trim(),
    password: els.cloudPassword.value,
  });
  if (error) {
    setCloudMessage(error.message);
    return;
  }
  cloudSession = data.session;
  setCloudUI('Signed in', true);
  setCloudMessage('Signed in. Use Pull or Push to choose which copy wins first.', true);
}
async function cloudSignOut() {
  if (cloudClient) await cloudClient.auth.signOut();
  cloudSession = null;
  setCloudUI('Configured', false);
  setCloudMessage('Signed out.', true);
}
async function cloudPush(silent = false) {
  if (!cloudClient || !cloudSession) return;
  let { error } = await cloudClient
    .from('travel_tracker_data')
    .upsert({
      user_id: cloudSession.user.id,
      payload: state,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    if (!silent) setCloudMessage(error.message);
    return;
  }
  if (!silent) setCloudMessage('Cloud copy updated.', true);
}
async function cloudPull() {
  if (!cloudClient || !cloudSession) return;
  let { data, error } = await cloudClient
    .from('travel_tracker_data')
    .select('payload')
    .eq('user_id', cloudSession.user.id)
    .maybeSingle();
  if (error) {
    setCloudMessage(error.message);
    return;
  }
  if (!data?.payload) {
    setCloudMessage('No cloud copy exists yet. Push this device first.');
    return;
  }
  state = data.payload;
  normalizeState(state);
  updatePassedPlannedTrips();
  persist(true);
  populateProfileSelects();
  renderAll();
  setCloudMessage('Cloud copy loaded onto this device.', true);
}

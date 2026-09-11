/* Herald Voyages — secure guest-to-account travel-data transfer.
   Presentation and branding live elsewhere; this module only protects migration. */
(() => {
  'use strict';
  const APP_KEY='whereIveBeen.data.v2', LEGACY_KEY='whereIveBeen.stays.v1', GUEST_KEY='whereIveBeen.guest.v1', OWNER_KEY='whereIveBeen.localOwner.v1';
  const FORMAT='where-ive-been-transfer', pendingMemory=new Map();
  const $=id=>document.getElementById(id), copy=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function normalize(v){
    let s=Array.isArray(v)?{stays:v}:v&&typeof v==='object'?copy(v):{};
    s.version=2;
    s.stays=Array.isArray(s.stays)?s.stays:[];
    s.residences=Array.isArray(s.residences)?s.residences:[];
    s.profiles=Array.isArray(s.profiles)?s.profiles:[];
    s.excludedCountryCodes=Array.isArray(s.excludedCountryCodes)?s.excludedCountryCodes:[];
    s.activeProfileId=s.activeProfileId||s.profiles[0]?.id||null;
    s.profiles.forEach(p=>{p.citizenships=Array.isArray(p.citizenships)?p.citizenships:[];p.enabledRules=Array.isArray(p.enabledRules)?p.enabledRules:['schengen']});
    s.stays.forEach(x=>{x.status=x.status||'actual';if(x.profileId===undefined)x.profileId=null});
    s.residences.forEach(x=>{if(x.profileId===undefined)x.profileId=null;if(x.end===undefined)x.end=null});
    return s;
  }

  function guestState(){
    const owner=localStorage.getItem(OWNER_KEY),key=owner?GUEST_KEY:APP_KEY;
    try{const v=JSON.parse(localStorage.getItem(key));if(v)return normalize(v)}catch{}
    if(!owner)try{const v=JSON.parse(localStorage.getItem(LEGACY_KEY));if(Array.isArray(v)&&v.length)return normalize(v)}catch{}
    return normalize({});
  }
  function code(v=''){return String(v).toUpperCase().replace(/[^A-Z0-9]/g,'')}
  function display(v=''){return code(v).match(/.{1,4}/g)?.join('-')||code(v)}
  function generated(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>a[x%a.length]).join('')}
  function b64(b){let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s)}
  function bytes(s){const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
  async function hex(text){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('')}
  async function key(c){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`where-ive-been-transfer:v1:${code(c)}`));return crypto.subtle.importKey('raw',h,{name:'AES-GCM'},false,['encrypt','decrypt'])}
  async function encrypt(c,state){const iv=crypto.getRandomValues(new Uint8Array(12)),k=await key(c),plain=new TextEncoder().encode(JSON.stringify({format:FORMAT,version:1,createdAt:new Date().toISOString(),state})),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,plain);return{payload:b64(new Uint8Array(cipher)),iv:b64(iv)}}
  async function decrypt(c,payload,iv){const k=await key(c),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},k,bytes(payload)),p=JSON.parse(new TextDecoder().decode(plain));if(p?.format!==FORMAT||!p.state)throw Error('This transfer code could not be read.');return normalize(p.state)}
  function transferClient(){if(!window.supabase||!window.WIB_CONFIG)throw Error('The secure transfer service is unavailable. Refresh and try again.');return supabase.createClient(WIB_CONFIG.url,WIB_CONFIG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
  async function createTransfer(){
    if(!crypto?.subtle)throw Error('Secure data transfer requires HTTPS.');
    const c=generated(),lookup=await hex(`lookup:${c}`),enc=await encrypt(c,guestState()),{data,error}=await transferClient().rpc('create_travel_device_transfer',{p_code_hash:lookup,p_encrypted_payload:enc.payload,p_iv:enc.iv,p_expires_minutes:60});
    if(error)throw error;
    return{code:display(c),expires:Array.isArray(data)?data[0]:data};
  }
  async function claimTransfer(value){
    if(!crypto?.subtle)throw Error('Secure data transfer requires HTTPS.');
    const c=code(value);if(c.length!==16)throw Error('Enter the complete 16-character transfer code.');
    const lookup=await hex(`lookup:${c}`),{data,error}=await transferClient().rpc('claim_travel_device_transfer',{p_code_hash:lookup});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.encrypted_payload)throw Error('That code is invalid, expired, or has already been used.');
    try{return await decrypt(c,row.encrypted_payload,row.iv)}catch(e){if(e?.name==='OperationError')throw Error('That transfer code could not decrypt the data. Check the code and try again.');throw e}
  }

  function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
  function sig(record){const r=copy(record)||{};delete r.id;if(r.citizenships)r.citizenships.sort();if(r.enabledRules)r.enabledRules.sort();return JSON.stringify(stable(r))}
  function safeSource(target,source){
    const incoming=normalize(source),used=new Set([...target.profiles,...target.stays,...target.residences,...incoming.profiles,...incoming.stays,...incoming.residences].map(x=>x.id).filter(Boolean));
    let n=0;
    const unique=old=>{let id;do{id=`${old||'record'}-herald-${Date.now().toString(36)}-${(++n).toString(36)}`}while(used.has(id));used.add(id);return id};
    const pm=new Map(),sm=new Map(),rp=new Map(target.profiles.map(x=>[x.id,x])),rs=new Map(target.stays.map(x=>[x.id,x])),rr=new Map(target.residences.map(x=>[x.id,x]));
    incoming.profiles.forEach(p=>{const x=rp.get(p.id);if(x&&sig(x)!==sig(p)){const old=p.id;p.id=unique(old);pm.set(old,p.id)}});
    incoming.stays.forEach(s=>{if(s.profileId&&pm.has(s.profileId))s.profileId=pm.get(s.profileId);const x=rs.get(s.id);if(x&&sig(x)!==sig(s)){const old=s.id;s.id=unique(old);sm.set(old,s.id)}});
    incoming.stays.forEach(s=>{if(s.autoFromPlannedId&&sm.has(s.autoFromPlannedId))s.autoFromPlannedId=sm.get(s.autoFromPlannedId)});
    incoming.residences.forEach(r=>{if(r.profileId&&pm.has(r.profileId))r.profileId=pm.get(r.profileId);const x=rr.get(r.id);if(x&&sig(x)!==sig(r))r.id=unique(r.id)});
    if(incoming.activeProfileId&&pm.has(incoming.activeProfileId))incoming.activeProfileId=pm.get(incoming.activeProfileId);
    return incoming;
  }
  function merge(targetValue,sourceValue){
    if(!window.WIBModel?.importData)throw Error('The Herald Voyages merge service did not load. Refresh and try again.');
    const target=normalize(targetValue);
    if(!target.stays.length&&!target.residences.length&&target.profiles.length===1&&target.profiles[0].name==='Me'&&!target.profiles[0].citizenships?.length){target.profiles=[];target.activeProfileId=null}
    const result=WIBModel.importData(target,safeSource(target,sourceValue));
    if(result.conflicts.length)throw Error('Some records could not be merged safely. No account data was changed.');
    return normalize(result.data);
  }
  async function readAccount(client,id){const{data,error}=await client.from('travel_tracker_data').select('payload,revision').eq('user_id',id).maybeSingle();if(error)throw error;return{payload:data?.payload||{},revision:Number(data?.revision||0)}}
  const pendingKey=id=>`herald.pendingImport.v1.${id}`;
  function preserve(id,state){const s=normalize(state),raw=JSON.stringify(s);pendingMemory.set(id,copy(s));try{localStorage.setItem(pendingKey(id),raw);return}catch{}try{sessionStorage.setItem(pendingKey(id),raw)}catch{}}
  function pending(id){if(pendingMemory.has(id))return copy(pendingMemory.get(id));for(const store of [localStorage,sessionStorage])try{const raw=store.getItem(pendingKey(id));if(raw)return normalize(JSON.parse(raw))}catch{}return null}
  function clearPending(id){pendingMemory.delete(id);try{localStorage.removeItem(pendingKey(id))}catch{}try{sessionStorage.removeItem(pendingKey(id))}catch{}}
  async function saveAccount(client,id,incoming){
    preserve(id,incoming);
    for(let i=0;i<5;i++){
      const remote=await readAccount(client,id),merged=merge(remote.payload,incoming),{error}=await client.rpc('save_travel_account',{p_payload:merged,p_revision:remote.revision});
      if(error?.code==='40001')continue;
      if(error)throw error;
      clearPending(id);return merged;
    }
    throw Error('Your account changed on another device while importing. The imported copy is still preserved in this browser; press Import Data again to retry.');
  }
  function status(el,text,kind='neutral'){if(el){el.textContent=text;el.dataset.kind=kind}}
  function exportGuestBackup(){
    const backup={format:'where-ive-been-backup',version:1,createdAt:new Date().toISOString(),data:guestState()};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`Herald Voyages Backup - ${new Date().toISOString().slice(0,10)}.travel`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  }

  async function guestPanel(){
    if(!$('profilesView')||$('heraldGuestTransferPanel'))return;
    let session=null;try{session=(await WIBAuth.client().auth.getSession()).data.session}catch{}
    if(session)return;
    const panel=document.createElement('article');
    panel.className='herald-transfer-panel';panel.id='heraldGuestTransferPanel';
    panel.innerHTML=`<div class="feature-head"><div><p class="eyebrow">GUEST DATA</p><h2>Keep a copy or move this history into Herald Voyages</h2></div><span class="status-badge neutral">Guest data</span></div><p class="panel-copy">Your guest travel history is stored in this browser. Download a permanent backup whenever you like, or create a secure one-use code to merge this history into your Herald Voyages account.</p><div class="herald-transfer-card"><h3>Guest history</h3><p>A backup contains your trips, traveller profiles, home history and tracker preferences. A transfer code carries an encrypted copy of the same data and expires after one hour.</p><div class="account-actions-row"><button class="secondary" id="heraldExportGuestBtn" type="button">Download backup</button><button class="primary" id="heraldCreateTransferBtn" type="button">Create transfer code</button></div><div id="heraldTransferCodeWrap" class="herald-code-wrap" hidden><span>Your transfer code</span><strong id="heraldTransferCode"></strong><button class="secondary compact" id="heraldCopyTransferBtn" type="button">Copy code</button><small id="heraldTransferExpiry">Valid for one hour and one use.</small></div></div><p id="heraldGuestTransferStatus" class="herald-transfer-status" role="status" aria-live="polite"></p>`;
    $('profilesView').append(panel);
    const btn=$('heraldCreateTransferBtn'),out=$('heraldGuestTransferStatus');let latest='';
    $('heraldExportGuestBtn').onclick=()=>{try{exportGuestBackup();status(out,'Backup downloaded. Keep it somewhere safe.','good')}catch(e){status(out,e.message||'Could not create the backup file.','bad')}};
    btn.onclick=async()=>{btn.disabled=true;status(out,'Creating your secure transfer code…');try{const r=await createTransfer();latest=r.code;$('heraldTransferCode').textContent=r.code;$('heraldTransferCodeWrap').hidden=false;$('heraldTransferExpiry').textContent=r.expires?`Valid until ${new Date(r.expires).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. It can only be used once.`:'Valid for one hour and one use.';status(out,'Transfer code ready. Copy it before logging in.','good')}catch(e){status(out,e.message||'Could not create a transfer code.','bad')}finally{btn.disabled=false}};
    $('heraldCopyTransferBtn').onclick=async()=>{if(!latest)return;try{await navigator.clipboard.writeText(latest);status(out,'Transfer code copied.','good')}catch{window.prompt('Copy this transfer code:',latest)}};
  }

  function recoveryPanel(){
    if(document.body?.dataset?.accountPage!=='profile'||$('heraldRecoveryPanel'))return;
    const host=$('signedInPanel');if(!host)return;
    const panel=document.createElement('section');panel.className='herald-recovery-panel';panel.id='heraldRecoveryPanel';
    panel.innerHTML=`<div class="panel-head"><div><p class="eyebrow">GUEST DATA RECOVERY</p><h2>Bring your guest history into this account</h2></div></div><p class="panel-copy herald-recovery-lead"><strong>If you created trips before making your account, that history may still be stored in the original browser.</strong></p><p class="panel-copy">Log out of Herald Voyages on that browser, open Profiles, create a one-use transfer code, then log back in and paste the code below.</p><ol class="herald-recovery-steps"><li>Log out of Herald Voyages.</li><li>Open the tracker as a guest.</li><li>Open <strong>Profiles</strong>.</li><li>Create a transfer code.</li><li>Copy the code somewhere safe.</li><li>Log back into this account.</li><li>Return to this Profile page.</li><li>Paste the transfer code below.</li><li>Choose <strong>Import Data</strong> and wait for the saved confirmation.</li></ol><div class="herald-import-box"><label class="field" for="transferImportCode"><span>Transfer code</span><input id="transferImportCode" class="herald-code-input" type="text" maxlength="19" autocomplete="off" placeholder="K7M9-P4Q2-X8CW-3TNR"></label><button id="transferImportBtn" class="primary" type="button">Import Data</button></div><p id="transferImportStatus" class="herald-transfer-status" role="status" aria-live="polite"></p><p class="herald-import-note">Herald Voyages merges imported history with the data already in your account. Identical records are skipped, existing records are not deleted, and the merged copy is saved before the transfer is marked complete.</p>`;
    const logout=$('logoutBtn');logout?host.insertBefore(panel,logout):host.append(panel);
  }

  async function profileImport(){
    if(document.body?.dataset?.accountPage!=='profile')return;
    recoveryPanel();
    const btn=$('transferImportBtn'),input=$('transferImportCode'),out=$('transferImportStatus');if(!btn||!input||!out)return;
    let client;try{client=WIBAuth.client()}catch(e){status(out,e.message,'bad');return}
    btn.onclick=async()=>{
      btn.disabled=input.disabled=true;status(out,'Importing…');
      try{
        const{data,error}=await client.auth.getUser();if(error)throw error;if(!data.user)throw Error('Please log in before importing guest data.');
        let incoming=pending(data.user.id);
        if(incoming)status(out,'Resuming your preserved import. Saving to your account…');
        else{incoming=await claimTransfer(input.value);preserve(data.user.id,incoming);status(out,'Data imported successfully. Saving to your account…')}
        const merged=await saveAccount(client,data.user.id,incoming);input.value='';
        status(out,`Saved to your Herald Voyages account — ${merged.stays.length} stay${merged.stays.length===1?'':'s'}, ${merged.profiles.length} traveller profile${merged.profiles.length===1?'':'s'} and ${merged.residences.length} home record${merged.residences.length===1?'':'s'} are now stored safely.`,'good');
      }catch(e){status(out,e.message||'The import failed. Your existing account data has not been changed.','bad')}
      finally{btn.disabled=input.disabled=false}
    };
  }

  function boot(){guestPanel();profileImport()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

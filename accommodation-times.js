(() => {
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=(a={})=>`<div class="form-grid accommodation-times"><label class="field"><span>Check-in time <em>optional, local</em></span><input type="time" name="checkInTime" value="${E(a.checkInTime||'')}"></label><label class="field"><span>Check-out time <em>optional, local</em></span><input type="time" name="checkOutTime" value="${E(a.checkOutTime||'')}"></label><label class="field"><span>Time zone <em>optional</em></span><input type="text" name="timeZone" value="${E(a.timeZone||a.place?.timeZone||'')}" placeholder="e.g. Europe/Ljubljana" list="accommodationTimeZones"></label></div>`;
 const read=root=>Object.fromEntries(['checkInTime','checkOutTime','timeZone'].map(k=>[k,root.querySelector(`[name=${k}]`)?.value.trim()||'']));
 function valid(a){if(a.timeZone)try{new Intl.DateTimeFormat('en',{timeZone:a.timeZone});}catch{return 'Choose a valid IANA time zone, such as Europe/London, or leave it blank.';}return '';}
 window.HVAccommodation={fields,read,valid};document.addEventListener('DOMContentLoaded',()=>{const list=document.createElement('datalist');list.id='accommodationTimeZones';list.innerHTML=(Intl.supportedValuesOf?.('timeZone')||[]).map(t=>`<option value="${E(t)}">`).join('');document.body.append(list);});
})();

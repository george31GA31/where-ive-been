/* Normal manual visits and the independent TCC tracker use existing account persistence. */
(() => {
  'use strict';
  const V=HVCountryVisits,T=HVTccDestinations,E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  const today=()=>isoDate(new Date());
  const destinations=T.regions.flatMap(r=>r.destinations);
  const manual=code=>V.manualRows(state,today()).find(r=>r.countryCode===code);
  const proven=()=>HVTravelHistory.history(state,today()).proven;
  let tracker;
  function commit(kind,destination,visited,details={}) {
    const key=kind==='tcc'?'tccVisits':'manualCountryVisits',before=JSON.parse(JSON.stringify(state[key]||[]));
    try {
      if(kind==='tcc')V.setTcc(state,destination,visited,details,today());else V.setManual(state,destination,visited,details,today(),proven());
      if(persist()===false)throw new Error('This change could not be saved. Keep the page open and try again.');
    } catch(error) {state[key]=before;throw error;}
    renderAll();updateMapColors();window.dispatchEvent(new CustomEvent('hv-visits-changed'));
  }
  function control(code) {
    const record=manual(code),real=proven().has(code)||HVJourney.homeCountryCodes(state,state.activeProfileId,today()).includes(code);
    return `<div class="manual-country-control">${real?'<span class="status-badge good">Visited ✓</span>':`<button type="button" class="${record?'secondary':'primary'} compact" data-manual-country="${E(code)}" aria-pressed="${!!record}">${record?'Visited ✓':'Mark as visited'}</button>`}${record?`<button type="button" class="text-btn" data-visit-details="${E(code)}">Visit details</button><button type="button" class="text-btn" data-remove-manual="${E(code)}">Remove manual status</button>`:''}<p class="helper">${record?record.date?'Manually recorded · '+E(fmt(record.date)):record.year?'Manually recorded · approximately '+record.year:'Manually recorded · date not known':real?'Recorded in your existing travel history.':'You can record a previous visit without adding a trip or dates.'}</p><p class="form-error" role="alert" data-manual-error></p></div>`;
  }
  function details(kind,destination) {
    const key=kind==='tcc'?'tccVisits':'manualCountryVisits',field=kind==='tcc'?'destinationId':'countryCode';
    const existing=V.scoped(state[key],state.activeProfileId).find(r=>r[field]===destination),name=kind==='tcc'?destinations.find(d=>d.id===destination)?.name:countryByCode(destination)?.name;
    if(!existing||!name)return;
    const data=state,profileId=state.activeProfileId,dialog=document.createElement('dialog');dialog.className='dialog visit-details-dialog';dialog.setAttribute('aria-label','Visit details for '+name);
    dialog.innerHTML=`<form class="dialog-card"><div class="dialog-head"><h2>${E(name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close visit details">×</button></div><p class="helper">All details are optional. An approximate year stays a year; it does not create a trip date.</p><label class="field"><span>${kind==='tcc'?'First visit':'Earliest known visit'} <em>optional</em></span><select name="precision"><option value="unknown">Date not known</option><option value="date">Exact date</option><option value="year">Approximate year</option></select></label><label class="field" data-date-field><span>Visit date</span><input name="date" type="date" max="${today()}" value="${E(existing.date||'')}"></label><label class="field" data-year-field><span>Visit year</span><input name="year" type="number" min="1" max="${today().slice(0,4)}" value="${E(existing.year??'')}" placeholder="e.g. 2018"></label>${kind==='country'?`<label class="field"><span>Number of visits <em>optional</em></span><input name="visits" type="number" min="1" max="100000" value="${E(existing.visits??'')}"></label>`:''}<label class="field"><span>Note <em>optional</em></span><textarea name="note" rows="3" maxlength="2000">${E(existing.note||'')}</textarea></label><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-cancel>Cancel</button><button type="submit" class="primary">Save details</button></div></form>`;
    document.body.append(dialog);const form=dialog.querySelector('form'),f=form.elements;
    f.precision.value=existing.date?'date':existing.year!=null?'year':'unknown';
    const fields=()=>{form.querySelector('[data-date-field]').hidden=f.precision.value!=='date';form.querySelector('[data-year-field]').hidden=f.precision.value!=='year';f.date.required=f.precision.value==='date';f.year.required=f.precision.value==='year';};f.precision.onchange=fields;fields();
    for(const button of form.querySelectorAll('[data-close],[data-cancel]'))button.onclick=()=>dialog.close();
    form.onsubmit=event=>{event.preventDefault();if(state!==data||state.activeProfileId!==profileId){dialog.close();return;}try{commit(kind,destination,true,{date:f.precision.value==='date'?f.date.value:null,year:f.precision.value==='year'?Number(f.year.value):null,visits:f.visits?.value?Number(f.visits.value):null,note:f.note.value.trim()});dialog.close();tracker?.render?.();}catch(error){form.querySelector('[role=alert]').textContent=error.message;}};
    dialog.onclose=()=>dialog.remove();dialog.showModal();
  }
  function open(kind) {
    tracker?.dialog.close();
    const data=state,profileId=state.activeProfileId,opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='dialog country-tracker-dialog';dialog.setAttribute('aria-labelledby','visitTrackerTitle');
    dialog.dataset.profileId=profileId;
    const tcc=kind==='tcc';
    dialog.innerHTML=`<div class="dialog-card country-tracker-card"><div class="dialog-head"><div><p class="eyebrow">${tcc?'SEPARATE DESTINATION TRACKER':'YOUR VISITED COUNTRIES'}</p><h2 id="visitTrackerTitle">${tcc?"Travelers’ Century Club":'Mark countries as visited'}</h2></div><button type="button" class="icon-btn" data-close aria-label="Close tracker">×</button></div><p class="helper">${tcc?'Tick the TCC destinations you have visited. These selections have their own total and do not change Herald’s country count or Atlas.':'Record old visits with no trip or date required. Countries already supported by travel history stay visited.'}</p><p class="country-tracker-count" aria-live="polite" data-count></p><label class="field"><span>${tcc?'Find a TCC destination':'Find a country or territory'}</span><input type="search" data-search placeholder="Search…" autocomplete="off"></label><p class="form-error" role="alert" data-error></p><div class="country-tracker-list" data-list></div>${tcc?`<p class="helper">Official geographical list · verified ${E(T.verified)} · <a href="${E(T.source)}" target="_blank" rel="noopener noreferrer">View the TCC list ↗</a></p>`:''}<div class="dialog-actions"><span class="helper">Changes save automatically.</span><button type="button" class="primary" data-done>Done</button></div></div>`;
    document.body.append(dialog);const list=dialog.querySelector('[data-list]'),search=dialog.querySelector('[data-search]'),count=dialog.querySelector('[data-count]');
    function render() {
      if(state!==data||state.activeProfileId!==profileId){dialog.close();return;}
      const term=search.value.trim().toLocaleLowerCase(),previous=new Map([...list.querySelectorAll('details')].map(d=>[d.dataset.region,d.open]));
      const rows=tcc?V.scoped(state.tccVisits,state.activeProfileId).filter(r=>r.visited!==false):V.manualRows(state,today()),selected=new Set(rows.map(r=>tcc?r.destinationId:r.countryCode)),real=tcc?new Set():proven(),visited=tcc?selected:HVJourney.summary(state,today()).countries;
      count.textContent=tcc?'TCC destinations visited: '+destinations.filter(d=>selected.has(d.id)).length+' / '+destinations.length:'Countries visited: '+[...visited].filter(WIBCountryCount.isCounted).length+' · your country definition';
      function row(id,name,region='') {
        const record=rows.find(r=>(tcc?r.destinationId:r.countryCode)===id),checked=selected.has(id)||real.has(id)||!tcc&&visited.has(id),disabled=!tcc&&checked&&!record;
        return `<div class="country-tracker-row"><label>${tcc?'':flagHtml(id,'flag-img flag-sm')}<span><strong>${E(name)}</strong><small>${region?E(region)+' · ':''}${disabled?'Travel history':record?.date?E(record.date):record?.year?'Approx. '+record.year:checked?'Visited · date not recorded':'Not yet visited'}</small></span><input type="checkbox" data-visit="${E(id)}" ${checked?'checked':''} ${disabled?'disabled':''} aria-label="Visited ${E(name)}"></label>${record?`<button type="button" class="text-btn" data-details="${E(id)}" aria-label="Visit details for ${E(name)}">Details</button>`:''}</div>`;
      }
      if(tcc) {
        const regions=T.regions.map(r=>({...r,matches:r.destinations.filter(d=>!term||(d.name+' '+r.name).toLocaleLowerCase().includes(term))})).filter(r=>r.matches.length);
        list.innerHTML=regions.length?regions.map(r=>`<details class="tcc-region" data-region="${E(r.id)}" ${term||previous.get(r.id)?'open':''}><summary>${E(r.name)} <span>${r.destinations.filter(d=>selected.has(d.id)).length} / ${r.destinations.length}</span></summary>${r.matches.map(d=>row(d.id,d.name,r.name)).join('')}</details>`).join(''):'<p class="empty-state">No TCC destinations match your search.</p>';
      } else {
        const countries=COUNTRIES.filter(c=>c.code!=='SEA'&&(!term||c.name.toLocaleLowerCase().includes(term))).sort((a,b)=>a.name.localeCompare(b.name));
        list.innerHTML=countries.length?countries.map(c=>row(c.code,c.name)).join(''):'<p class="empty-state">No countries match your search.</p>';
      }
    }
    const owner={dialog,render};tracker=owner;render();search.oninput=render;
    list.onchange=event=>{const input=event.target.closest('[data-visit]');if(!input)return;if(state!==data||state.activeProfileId!==profileId){dialog.close();return;}const destination=input.dataset.visit;try{commit(kind,destination,input.checked);dialog.querySelector('[data-error]').textContent='';render();list.querySelector(`[data-visit="${CSS.escape(destination)}"]`)?.focus();}catch(error){input.checked=!input.checked;dialog.querySelector('[data-error]').textContent=error.message;}};
    list.onclick=event=>{const button=event.target.closest('[data-details]');if(button)details(kind,button.dataset.details);};
    for(const button of dialog.querySelectorAll('[data-close],[data-done]'))button.onclick=()=>dialog.close();
    dialog.onclose=()=>{dialog.remove();if(tracker===owner)tracker=null;opener?.focus?.();};dialog.showModal();search.focus();
  }
  function boot() {
    const header=get('countriesView')?.querySelector('.atlas-directory .panel-head');
    if(header){const actions=document.createElement('div');actions.className='country-tracker-actions';actions.innerHTML='<button type="button" class="secondary compact" data-manual-tracker>Mark countries as visited</button><button type="button" class="secondary compact" data-tcc-tracker>Travelers’ Century Club</button>';header.append(actions);}
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-manual-tracker]')){open('country');return;}if(event.target.closest('[data-tcc-tracker]')){open('tcc');return;}
      const add=event.target.closest('[data-manual-country]'),remove=event.target.closest('[data-remove-manual]'),detail=event.target.closest('[data-visit-details]');
      if(detail){details('country',detail.dataset.visitDetails);return;}
      if(add&&manual(add.dataset.manualCountry)){details('country',add.dataset.manualCountry);return;}
      if(add||remove){const host=(add||remove).closest('.manual-country-control');try{commit('country',add?.dataset.manualCountry||remove.dataset.removeManual,!!add);}catch(error){host.querySelector('[data-manual-error]').textContent=error.message;}}
    });
    window.addEventListener('hv-data-changed',()=>tracker?.render());window.addEventListener('hv-visits-changed',()=>tracker?.render());
    window.addEventListener('hv-route',()=>{if(tracker&&state.activeProfileId!==profileIdOfTracker())tracker.dialog.close();});
  }
  const profileIdOfTracker=()=>tracker?.dialog.dataset.profileId;
  window.HVCountryTracker={open,control,details,commit};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

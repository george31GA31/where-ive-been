/* One transport dashboard over Herald's existing records, editors and map surface. */
(() => {
  'use strict';
  const D=window.HVTransportDashboardModel,O=window.HVOperators;
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  const pageSize=40,periods=new Map();
  const svg=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  const icons={search:svg('M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'),filter:svg('M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M9 15v6'),share:svg('M12 16V3m-4 4 4-4 4 4M7 10H5v11h14V10h-2'),chevron:svg('m6 9 6 6 6-6'),fit:svg('M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5')};
  let mode='flight',search='',year='',operator='',country='',page=0,selected='',source,sourceStamp,all=[],surface,mapStamp,detail,minuteTimer,lastRender;
  try{mode=D.mode(sessionStorage.getItem('herald.transport.mode.v1'))||'flight';}catch{}
  function records() {
    const stamp=[state,window.HVPages?.revision,state.activeProfileId];
    if(!sourceStamp||!stamp.every((value,i)=>value===sourceStamp[i])) {
      source=state;sourceStamp=stamp;
      all=D.rows(state).map(row=>{
        if(row.type!=='flight')return row;
        const endpoint=p=>({...HVJourneys.airportFor(p?.iata||p?.icao||p?.name),...p});
        return {...row,leg:{...row.leg,start:endpoint(row.leg.start),end:endpoint(row.leg.end)}};
      });
    }
    return all;
  }
  function currentPeriod() {
    if(!periods.has(mode))periods.set(mode,records().some(row=>row.type===mode&&D.period(row)==='upcoming')?'upcoming':'previous');
    return periods.get(mode);
  }
  const city=p=>HVAddress.text(p?.city||p?.area||p?.name||'Place to add');
  const routeTitle=row=>city(row.leg.start)+' to '+city(row.leg.end);
  const time=value=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value||'')?value.slice(11,16):'';
  function timetable(row) {
    if(row.record.dateOnly)return '<small>Date only</small>';
    const a=row.leg.start,b=row.leg.end,flight=row.type==='flight',arrival=D.overnight(row);
    const point=(p,value)=>`<span>${flight?`<b>${E(HVJourney.airportLabel(p,HVJourneys.airportFor))}</b> `:''}${time(value)?`<strong>${E(time(value))}</strong>`:'<small>Time to add</small>'}</span>`;
    return point(a,row.leg.startLocal)+'<span class="transport-arrow" aria-hidden="true">→</span>'+point(b,row.leg.endLocal)+(arrival?`<sup title="Arrival local date">${arrival>0?'+':''}${arrival}</sup>`:'');
  }
  function item(row,index) {
    const provider=D.provider(row),name=D.providerName(provider),service=row.type==='flight'?row.leg.flightNumber||row.record.flightNumber:row.leg.serviceNumber||row.record.serviceNumber;
    const countdown=D.countdown(row),previous=currentPeriod()==='previous';
    const historical=row.start&&HVJourney.validDate(row.start)?{value:row.start.slice(8,10),unit:HVJourneyUI.date(row.start,{day:undefined,year:undefined})}:{value:'',unit:'Date to add'};
    const leading=previous?historical:countdown;
    const cancelled=row.record.status==='cancelled';
    return `<li><button type="button" class="transport-row ${selected===row.key?'is-selected':''} ${!previous&&index===0?'transport-row-next':''}" data-transport-select="${E(row.key)}" aria-label="${E(routeTitle(row)+', '+HVJourneyUI.date(row.start))}" aria-pressed="${selected===row.key}">
      <span class="transport-countdown"><strong>${E(leading.value)}</strong><small>${E(leading.unit)}</small></span>
      <span class="transport-row-body">${!previous&&index===0?'<small class="transport-next-label">NEXT JOURNEY</small>':''}<span class="transport-service"><span class="transport-identity">${O.image(state,row.type,provider,row.leg.operatorId||row.record.operatorId)||HVTransportIcons.html(row.type)}<span>${E([name,service].filter(Boolean).join(' · ')||row.record.vehicle||row.record.name||D.modes[mode].singular)}</span></span><time datetime="${E(row.start)}">${E(HVJourneyUI.date(row.start,{weekday:'short',year:undefined}))}</time></span>
      <strong class="transport-cities">${E(routeTitle(row))}</strong><span class="transport-times">${timetable(row)}</span>${cancelled?'<small class="transport-cancelled">Cancelled</small>':''}</span>
    </button></li>`;
  }
  function mapRows(rows) {
    return rows.flatMap(row=>row.type==='flight'?[row]:HVJourney.groundLegs(row.record).map((leg,index)=>({...row,key:`transport:${row.record.id}:${index}`,leg,index})));
  }
  function render() {
    if(source&&source!==state){surface?.remove();surface=null;mapStamp=null;periods.clear();selected='';detail?.close();sourceStamp=null;}
    if(document.body.dataset.currentView!=='transport')return;
    const host=get('transportDashboard');if(!host)return;
    get('pageTitle').textContent=D.modes[mode].title;
    document.title=D.modes[mode].title+' — Herald Voyages';
    clearTimeout(minuteTimer);minuteTimer=setTimeout(()=>{if(document.body.dataset.currentView==='transport')render();},60000);
    const renderStamp=[state,window.HVPages?.revision,state.activeProfileId,mode,currentPeriod(),search,year,operator,country,page,Math.floor(Date.now()/60000)];
    if(surface&&lastRender&&renderStamp.every((value,index)=>value===lastRender[index])){surface.resize();return;}
    const rows=D.filter(records(),{mode,period:currentPeriod(),search,year,operator,country});
    page=Math.min(page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
    const visible=rows.slice(page*pageSize,(page+1)*pageSize);
    if(!visible.some(row=>row.key===selected))selected=visible[0]?.key||'';
    host.querySelector('[data-mode-title]').textContent=D.modes[mode].title;
    host.querySelectorAll('[data-transport-mode]').forEach(button=>{button.setAttribute('aria-checked',String(button.dataset.transportMode===mode));});
    host.querySelectorAll('[data-transport-period]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.transportPeriod===currentPeriod())));
    const own=records().filter(row=>row.type===mode),years=[...new Set(own.flatMap(row=>[row.start,row.end].map(date=>date.slice(0,4))).filter(Boolean))].sort().reverse();
    const operators=[...new Set(own.map(row=>D.providerName(D.provider(row))).filter(Boolean))].sort();
    const countries=[...new Set(own.flatMap(row=>[row.leg.start,row.leg.end].map(p=>p?.countryCode||p?.countryCodes?.[0])).filter(Boolean))].sort((a,b)=>(countryByCode(a)?.name||a).localeCompare(countryByCode(b)?.name||b));
    for(const [key,values,title]of [['year',years,'All years'],['operator',operators,'All operators'],['country',countries,'All countries']]) {
      const input=host.querySelector(`[data-transport-filter=${key}]`),value={year,operator,country}[key];
      input.innerHTML=`<option value="">${title}</option>`+values.map(value=>`<option value="${E(value)}">${E(key==='country'?countryByCode(value)?.name||value:value)}</option>`).join('');input.value=value;
    }
    host.querySelector('[data-transport-list]').innerHTML=visible.map(item).join('');
    const empty=host.querySelector('[data-transport-empty]');empty.hidden=!!rows.length;
    empty.innerHTML=`<h3>${search||year||operator||country?'No matching journeys':`No ${currentPeriod()==='upcoming'?'upcoming ':''}${D.modes[mode].plural}${own.length?'':' yet'}.`}</h3><p>${own.length?'Try Previous or Upcoming, or clear the filters.':`${D.modes[mode].plural.charAt(0).toUpperCase()+D.modes[mode].plural.slice(1)} you add to Herald Voyages will automatically appear here.`}</p><button type="button" class="primary" data-dashboard-add>Add ${D.modes[mode].singular}</button>`;
    const pagination=host.querySelector('[data-transport-pagination]');pagination.hidden=rows.length<=pageSize;
    pagination.querySelector('span').textContent=`${page*pageSize+1}–${Math.min((page+1)*pageSize,rows.length)} of ${rows.length}`;
    pagination.querySelector('[data-transport-page="-1"]').disabled=page===0;pagination.querySelector('[data-transport-page="1"]').disabled=(page+1)*pageSize>=rows.length;
    const nextStamp=[state,window.HVPages?.revision,state.activeProfileId,visible.map(row=>row.key).join('|')];
    if(!surface||!mapStamp||!nextStamp.every((value,i)=>value===mapStamp[i])) {
      surface?.remove();
      surface=HVJourneyMap.mountGlobal(host.querySelector('[data-transport-map]'),mapRows(visible),D.dayAt(Date.now()),host.querySelector('[data-transport-map-status]'),{viewer:true,onSelect:row=>{selected=row.type==='flight'?row.key:`transport:${row.record.id}:0`;highlight();}});
      mapStamp=nextStamp;
    }else surface.resize();
    lastRender=renderStamp;
  }
  function highlight() {
    const host=get('transportDashboard');
    for(const button of host.querySelectorAll('[data-transport-select]')){const yes=button.dataset.transportSelect===selected;button.classList.toggle('is-selected',yes);button.setAttribute('aria-pressed',String(yes));}
    surface?.select(selected);
  }
  function openDetails(row) {
    if(!detail){detail=document.createElement('dialog');detail.className='transport-detail-dialog';detail.setAttribute('aria-label','Journey details');document.body.append(detail);detail.addEventListener('click',event=>{if(event.target.closest('[data-close-transport-details],[data-journey-edit]'))detail.close();});}
    detail.innerHTML=`<div class="transport-detail-close"><button type="button" class="text-btn" data-close-transport-details aria-label="Close journey details">Close ×</button></div>${HVJourneyUI.popup(row)}`;
    const opener=document.activeElement;detail.addEventListener('close',()=>opener?.focus(),{once:true});detail.showModal();
  }
  async function share() {
    const rows=D.filter(records(),{mode,period:currentPeriod(),search,year,operator,country}),row=rows.find(row=>row.key===selected)||rows[0];
    if(!row)return;
    const text=[routeTitle(row),HVJourneyUI.date(row.start),[D.providerName(D.provider(row)),row.leg.flightNumber||row.record.serviceNumber].filter(Boolean).join(' · '),[time(row.leg.startLocal),time(row.leg.endLocal)].filter(Boolean).join(' → ')+' (local times)'].join('\n');
    try{if(navigator.share)await navigator.share({title:'My journey · Herald Voyages',text});else{await navigator.clipboard.writeText(text);get('transportDashboard').querySelector('[data-dashboard-message]').textContent='Journey details copied.';}}catch(error){if(error.name!=='AbortError')get('transportDashboard').querySelector('[data-dashboard-message]').textContent='Sharing is unavailable in this browser.';}
  }
  function boot() {
    const host=get('transportDashboard');if(!host)return;
    host.className='transport-dashboard';
    host.innerHTML=`<div class="transport-map-pane"><div class="transport-map" data-transport-map role="region" aria-label="Transport routes"></div><div class="transport-map-controls"><button type="button" class="map-expand-button" data-transport-fit aria-label="Fit these journeys" title="Fit these journeys">${icons.fit}</button></div><p class="transport-map-status" data-transport-map-status role="status"></p></div>
      <section class="transport-panel"><header class="transport-heading"><div class="transport-mode-control"><button type="button" class="transport-mode-title" data-mode-toggle aria-haspopup="menu" aria-expanded="false"><span data-mode-title>My Flights</span>${icons.chevron}</button><div class="transport-mode-menu" data-mode-menu role="menu" aria-label="Transport type" hidden>${Object.entries(D.modes).map(([key,value])=>`<button type="button" role="menuitemradio" data-transport-mode="${key}" aria-checked="${key===mode}">${HVTransportIcons.html(key)}<span>${value.title}</span><span class="transport-mode-check" aria-hidden="true">✓</span></button>`).join('')}</div></div>
      <div class="transport-heading-actions"><button type="button" class="transport-icon-button" data-search-toggle aria-label="Search journeys" aria-expanded="false">${icons.search}</button><button type="button" class="transport-icon-button" data-filter-toggle aria-label="Filter journeys" aria-expanded="false">${icons.filter}</button><button type="button" class="transport-icon-button" data-transport-share aria-label="Share selected journey">${icons.share}</button></div></header>
      <div class="transport-search" data-search-panel hidden><label class="field"><span>Search journeys</span><input type="search" data-transport-search placeholder="Operator, service, place or code"></label></div>
      <div class="transport-filters" data-filter-panel hidden><label class="field"><span>Year</span><select data-transport-filter="year"></select></label><label class="field"><span>Operator</span><select data-transport-filter="operator"></select></label><label class="field"><span>Country</span><select data-transport-filter="country"></select></label><button type="button" class="text-btn" data-clear-transport-filters>Clear filters</button></div>
      <div class="transport-tabs" role="tablist" aria-label="Journey dates"><button type="button" role="tab" data-transport-period="upcoming" aria-selected="true">Upcoming</button><button type="button" role="tab" data-transport-period="previous" aria-selected="false">Previous</button><button type="button" class="text-btn" data-dashboard-add aria-label="Add journey">+ Add</button></div>
      <div class="transport-list-scroll"><ul class="transport-list" data-transport-list></ul><div class="transport-empty" data-transport-empty></div></div>
      <div class="transport-pagination" data-transport-pagination hidden><button type="button" class="text-btn" data-transport-page="-1">Previous page</button><span></span><button type="button" class="text-btn" data-transport-page="1">Next page</button></div><p class="transport-dashboard-message helper" data-dashboard-message role="status"></p></section>`;
    host.querySelector('[data-transport-search]').oninput=event=>{search=event.target.value;page=0;render();};
    for(const field of host.querySelectorAll('[data-transport-filter]'))field.onchange=()=>{({year,operator,country}=Object.fromEntries([...host.querySelectorAll('[data-transport-filter]')].map(input=>[input.dataset.transportFilter,input.value])));page=0;render();};
    const menu=host.querySelector('[data-mode-menu]'),toggle=host.querySelector('[data-mode-toggle]');
    const closeMenu=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');};
    host.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button===toggle){menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('[aria-checked=true]')?.focus();return;}
      if(button.dataset.transportMode){mode=button.dataset.transportMode;try{sessionStorage.setItem('herald.transport.mode.v1',mode);}catch{}search=year=operator=country='';host.querySelector('[data-transport-search]').value='';page=0;selected='';closeMenu();render();toggle.focus();return;}
      if(button.dataset.transportPeriod){periods.set(mode,button.dataset.transportPeriod);page=0;selected='';render();return;}
      if(button.dataset.transportPage){page+=Number(button.dataset.transportPage);render();host.querySelector('.transport-list-scroll').scrollTop=0;return;}
      if(button.dataset.transportSelect){selected=button.dataset.transportSelect;highlight();const row=records().find(row=>row.key===selected);if(row)openDetails(row);return;}
      if(button.hasAttribute('data-dashboard-add')){HVJourneys.openTransport(null,{type:mode});return;}
      if(button.hasAttribute('data-transport-fit')){surface?.fit();return;}
      if(button.hasAttribute('data-transport-share')){share();return;}
      if(button.hasAttribute('data-clear-transport-filters')){search=year=operator=country='';host.querySelector('[data-transport-search]').value='';page=0;render();return;}
      for(const kind of ['search','filter'])if(button.hasAttribute(`data-${kind}-toggle`)){const panel=host.querySelector(`[data-${kind}-panel]`);panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)panel.querySelector('input,select')?.focus();}
    });
    host.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!menu.hidden){event.preventDefault();closeMenu();toggle.focus();}
      if(event.target.closest('[data-mode-menu]')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length].focus();}
      if(event.target.hasAttribute('data-transport-period')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=currentPeriod()==='upcoming'?'previous':'upcoming';periods.set(mode,next);page=0;render();host.querySelector(`[data-transport-period=${next}]`).focus();}
    });
    document.addEventListener('click',event=>{if(!event.target.closest('.transport-mode-control'))closeMenu();});
    const previous=window.renderAll;window.renderAll=function(...args){const result=previous.apply(this,args);render();return result;};
    window.addEventListener('hv-route',()=>{if(document.body.dataset.currentView!=='transport'){clearTimeout(minuteTimer);closeMenu();}else render();});
    window.addEventListener('hv-airports-ready',()=>{sourceStamp=null;lastRender=null;render();});window.addEventListener('hv-data-changed',()=>{sourceStamp=null;lastRender=null;render();});render();
  }
  window.HVTransportDashboard={render,surface:()=>surface,records,title:()=>D.modes[mode].title};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

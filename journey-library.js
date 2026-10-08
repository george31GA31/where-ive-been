/* Global map and catalogue are read-only projections of the active profile's records. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id)||window.HVPages?.get(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let query='',mapSurface,timer,range={from:'',to:''},lastStamp,fullScreen=false,previousFocus,background=[];
  const stamp=()=>[state,window.HVPages?.revision,state.activeProfileId,isoDate(new Date()),query,JSON.stringify(range),JSON.stringify(HVGlobalJourney.preferences(state))];
  function render(preserveMap=false){
    if(lastStamp&&lastStamp[0]!==state){mapSurface?.remove();mapSurface=null;lastStamp=null;}
    if(document.body.dataset.currentView!=='journeys')return;
    const next=stamp();
    if(mapSurface&&lastStamp&&next.every((value,index)=>value===lastStamp[index])){mapSurface.resize();return;}
    if(!preserveMap){mapSurface?.remove();mapSurface=null;}
    const page=$('journeysView'),host=$('journeyLibraryRecords');if(!host||!window.HVCalendar?.journeyGroups)return;
    const prefs=HVGlobalJourney.preferences(state),today=isoDate(new Date()),term=query.trim().toLowerCase(),groups=HVCalendar.journeyGroups();
    const transportGroups=new Map(),accommodationGroups=new Map(),stayGroups=new Map(),tripGroups=new Map();
    for(const group of groups){if(group.trip)tripGroups.set(group.trip.id,group);for(const record of group.transports)transportGroups.set(record.id,group);for(const record of group.accommodations)accommodationGroups.set(record.id,group);for(const record of group.stays)stayGroups.set(record.id,group);}
    page.querySelectorAll('[data-journey-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.journeyPeriod===prefs.period)));
    page.querySelectorAll('[data-journey-layer]').forEach(b=>b.setAttribute('aria-pressed',String(prefs[b.dataset.journeyLayer]!==false)));
    page.querySelector('[data-journey-date-summary]').textContent=range.from||range.to?'Selected dates':'All dates';
    page.querySelector('[data-journey-date-clear]').disabled=!range.from&&!range.to;
    const rows=HVGlobalJourney.filter(HVGlobalJourney.rows(state),prefs,today,range).map(r=>{
      const group=r.leg?transportGroups.get(r.record.id):r.kind==='accommodation'?accommodationGroups.get(r.record.id):r.destination?stayGroups.get(r.record.id):tripGroups.get(r.record.tripId);
      return {...r,group,title:r.leg?HVJourney.transportLabel({...r.leg,type:r.type}):HVAddress.text(r.record.propertyName||r.place?.name||'Location'),detail:r.leg?[HVJourney.types[r.type],r.leg.airline?.name,r.leg.flightNumber,...(r.type==='flight'?[HVJourney.airportDetails(r.leg.start,HVJourneys.airportFor)+' → '+HVJourney.airportDetails(r.leg.end,HVJourneys.airportFor)]:[])].filter(Boolean).join(' · '):[HVAddress.address(r.place)||HVAddress.text(r.record.location),r.record.checkInTime?'Check-in '+r.record.checkInTime:'',r.record.checkOutTime?'Check-out '+r.record.checkOutTime:'',r.record.timeZone].filter(Boolean).join(' · ')};
    }).filter(r=>[r.title,r.detail,r.group?.title,r.start,r.end,...(r.leg?[r.leg.start,r.leg.end].map(p=>[p?.name,p?.iata,p?.icao,p?.city,p?.countryName].join(' ')):[])].join(' ').toLowerCase().includes(term)).sort((a,b)=>(a.leg?a.record.startLocal.slice(0,10):a.start).localeCompare(b.leg?b.record.startLocal.slice(0,10):b.start)||(a.record===b.record?a.index-b.index:0));
    $('journeyLibraryCount').textContent=`${rows.length} ${rows.length===1?'entry':'entries'} · individual flight legs shown separately`;
    const sections=new Map();for(const r of rows){const key=r.group?.key||'ungrouped';if(!sections.has(key))sections.set(key,{group:r.group,rows:[]});sections.get(key).rows.push(r);}
    host.innerHTML=[...sections.values()].map(({group,rows})=>`<article class="journey-library-card"><header><div><p class="eyebrow">${E(group?.phase||'RECORDED PLACES')}</p><h2>${E(group?.title||'Other locations')}</h2></div>${group?`<button type="button" class="secondary" data-journey-map="${E(group.key)}">Focus journey →</button>`:''}</header><ul>${rows.map(r=>`<li><span class="journey-library-symbol" aria-hidden="true">${r.leg?HVTransportIcons.html(r.type):r.kind==='accommodation'?'⌂':'•'}</span><div><strong>${E(r.title)}</strong><p>${E(r.detail)}</p><small>${E(HVJourneyUI.range(r.start,r.end))}${r.end?' · '+(r.end<today?'Past':r.start>today?'Upcoming':'Current'):''}</small></div><button type="button" class="text-btn" ${r.leg?`data-transport-edit="${E(r.record.id)}"`:r.destination?`data-calendar-edit-stay="${E(r.record.id)}"`:r.kind==='accommodation'?`data-library-accommodation="${E(r.record.id)}"`:`data-library-location="${E(r.record.id)}"`} aria-label="Edit ${E(r.title)}">Edit</button></li>`).join('')}</ul></article>`).join('')||'<div class="empty-state"><h2>No matching entries</h2><p>Try another period or layer, clear your search, or add a record.</p></div>';
    if(page.isConnected&&window.L&&!mapSurface)mapSurface=HVJourneyMap.mountGlobal($('globalJourneyMap'),rows,today,$('globalJourneyStatus'));
    lastStamp=stamp();
  }
  function expand(value){
    if(fullScreen===value)return;fullScreen=value;
    const page=$('journeysView'),button=page.querySelector('[data-journey-fullscreen]');
    const camera=mapSurface?{center:mapSurface.map.getCenter(),zoom:mapSurface.map.getZoom()}:null;
    page.classList.toggle('journey-fullscreen',value);document.body.classList.toggle('journey-fullscreen-open',value);
    button.setAttribute('aria-pressed',String(value));button.setAttribute('aria-label',value?'Exit full screen':'Enter full screen');button.title=value?'Exit full screen':'Full screen';
    button.querySelector('span').textContent=value?'Exit full screen':'Full screen';
    button.querySelector('path').setAttribute('d',value?'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5':'M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5');
    if(value){previousFocus=document.activeElement;background=[...document.querySelectorAll('.sidebar,.main>.topbar,.herald-site-footer,.voyages-mobile-nav')].map(el=>({el,inert:el.inert}));for(const item of background)item.el.inert=true;button.focus();}
    else{for(const item of background)item.el.inert=item.inert;background=[];previousFocus?.focus();}
    requestAnimationFrame(()=>mapSurface?.resize(camera));
  }
  function boot(){
    const page=$('journeysView');if(!page)return;const oldLibrary=$('calendarTransportLibrary');if(oldLibrary){oldLibrary.hidden=true;oldLibrary.style.display='none';}
    page.querySelector('[name=journeySearch]').oninput=e=>{query=e.target.value;clearTimeout(timer);timer=setTimeout(render,200);};
    page.querySelector('[data-library-transport]').onclick=()=>HVJourneys.openTransport();page.querySelector('[data-library-stay]').onclick=()=>HVPlaces.open({accommodation:true});
    page.querySelector('[data-global-fit]').onclick=()=>mapSurface?.fit();
    page.querySelector('[data-journey-fullscreen]').onclick=()=>expand(!fullScreen);
    document.addEventListener('keydown',event=>{if(fullScreen&&event.key==='Escape'&&!document.querySelector('dialog[open]')&&!event.defaultPrevented){event.preventDefault();expand(false);}});
    for(const side of ['from','to'])page.querySelector(`[name=journey-${side}]`).onchange=e=>{
      const pending={from:page.querySelector('[name=journey-from]').value,to:page.querySelector('[name=journey-to]').value};
      const invalid=pending.from&&pending.to&&pending.to<pending.from;
      page.querySelector('[data-journey-date-error]').textContent=invalid?'Choose a To date on or after the From date.':'';
      if(!invalid){range=pending;render();}
    };
    page.querySelector('[data-journey-date-clear]').onclick=()=>{range={from:'',to:''};for(const side of ['from','to'])page.querySelector(`[name=journey-${side}]`).value='';page.querySelector('[data-journey-date-error]').textContent='';render();};
    page.addEventListener('click',e=>{const filter=e.target.closest('[data-journey-layer],[data-journey-period]');if(filter){state.visualLayers||={};state.visualLayers.journeys||={};const key=filter.dataset.journeyLayer;if(key)state.visualLayers.journeys[key]=HVGlobalJourney.preferences(state)[key]===false;else state.visualLayers.journeys.period=filter.dataset.journeyPeriod;persist();render();return;}const button=e.target.closest('[data-library-accommodation]');if(button){const record=HVJourney.scoped(state.accommodations,state.activeProfileId).find(a=>a.id===button.dataset.libraryAccommodation);if(record)HVPlaces.open({accommodationId:record.id});}const location=e.target.closest('[data-library-location]');if(location)HVPlaces.open({recordId:location.dataset.libraryLocation});});
    const previous=window.renderAll;window.renderAll=function(...args){const result=previous.apply(this,args);render();return result;};
    window.addEventListener('hv-airports-ready',()=>render(true));
    window.addEventListener('hv-route',()=>{if(fullScreen&&document.body.dataset.currentView!=='journeys')expand(false);clearTimeout(timer);render();});render();
  }
  window.HVJourneyLibrary={filters:()=>({range:{...range},prefs:HVGlobalJourney.preferences(state)}),surface:()=>mapSurface,expand};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

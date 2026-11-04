/* Context-preserving readers over the existing records. Opening or closing never persists. */
(() => {
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const collections={country:'stays',accommodation:'accommodations',transport:'transports',note:'notes',location:'placeVisits',saved:'savedPlaces'};
  const kinds={stays:'country',accommodations:'accommodation',transports:'transport',notes:'note',placeVisits:'location'};
  let active=null,identity=null,pendingReturn=null;
  const scoped=key=>HVJourney.scoped(state[key]||[],state.activeProfileId).filter(r=>!r.deleted);
  const find=(kind,id)=>scoped(collections[kind]).find(r=>r.id===id);
  const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
  function withoutReader(hash=location.hash) {const p=new URLSearchParams(hash.split('?')[1]||'');p.delete('recordKind');p.delete('recordId');return hash.split('?')[0]+(p.size?'?'+p:'');}
  function recordLink(kind,id,hash=withoutReader()) {const p=new URLSearchParams(hash.split('?')[1]||'');p.set('recordKind',kind);p.set('recordId',id);return hash.split('?')[0]+'?'+p;}
  function date(kind,row){return HVCalendarDetails.range(kind,row,isoDate(new Date()))[0]||isoDate(new Date());}
  function exactPlace(place,saved) {return !!place&&(place.savedPlaceId===saved.id||!!place.id&&(place.id===saved.place?.id||(saved.sourceIds||[]).includes(place.id)));}
  function relatedSaved(row) {
    const matches=[...scoped('accommodations').filter(r=>exactPlace(r.place,row)).map(r=>({kind:'accommodation',record:r,title:r.propertyName||'Stay',dates:HVJourneyUI.range(r.checkIn,r.checkOut)})),...scoped('placeVisits').filter(r=>exactPlace(r.place,row)).map(r=>({kind:'location',record:r,title:r.place?.name||'Recorded location',dates:HVJourneyUI.range(r.date,r.endDate||r.date)}))];
    return matches.length?`<section class="calendar-profile-related"><h3>Recorded here</h3><p class="helper">Records linked by a saved-place or source ID. Original details stay unchanged.</p>${matches.map(({kind,record,title,dates})=>`<button type="button" data-v1-read="${kind}" data-record-id="${E(record.id)}"><strong>${E(title)}</strong><small>${E(dates)}</small><span aria-hidden="true">›</span></button>`).join('')}</section>`:'<p class="helper">No travel records are linked to this saved-place ID.</p>';
  }
  function body(kind,row) {
    if(kind==='saved')return `<header class="calendar-profile-head"><div class="calendar-profile-art" aria-hidden="true">◎</div><div><p class="eyebrow">Saved place</p><h2 tabindex="-1">${E(HVAddress.field(row.place,'name')||'Saved location')}</h2><p>${E(row.place?.type||'Reusable address')}</p></div></header><dl class="calendar-profile-facts"><div><dt>Address</dt><dd>${E(HVAddress.address(row.place)||'Not recorded')}</dd></div><div><dt>Country</dt><dd>${E(HVAddress.field(row.place,'countryName')||countryByCode(row.place?.countryCode)?.name||'Not recorded')}</dd></div></dl>${row.place?.notes?'<p>'+E(row.place.notes)+'</p>':''}${relatedSaved(row)}<button type="button" class="secondary" data-v1-manage-place="${E(row.id)}">Manage saved place</button>`;
    const template=document.createElement('template');template.innerHTML=HVCalendarDetails.entry(kind,row.id,date(kind,row),true);
    template.content.querySelector('.calendar-profile-actions')?.remove();
    template.content.querySelectorAll('[data-calendar-entry]').forEach(b=>{b.dataset.v1Read=b.dataset.calendarEntry;b.dataset.recordId=b.dataset.calendarEntryId;delete b.dataset.calendarEntry;delete b.dataset.calendarEntryId;});
    template.content.querySelectorAll('[data-calendar-open-journey]').forEach(b=>{b.dataset.tripOpen=b.dataset.calendarOpenJourney.replace(/^trip:/,'');delete b.dataset.calendarOpenJourney;});
    return template.innerHTML+`<footer class="hv-v1-reader-actions"><a class="text-btn" href="#/calendar?kind=${E(kind)}&id=${encodeURIComponent(row.id)}&date=${E(date(kind,row))}">View in Calendar →</a></footer>`;
  }
  function restoreContext(context) {
    if(!context)return;
    if(state!==context.source||state.activeProfileId!==context.profile||withoutReader().split('?')[0]!==context.base.split('?')[0]){pendingReturn=null;return;}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(params().has('recordKind')||state!==context.source||state.activeProfileId!==context.profile)return;
      window.scrollTo(context.scroll.x,context.scroll.y);
      let opener=context.opener;
      if(!opener?.isConnected&&context.focusSelector)opener=document.querySelector(context.focusSelector);
      opener?.focus({preventScroll:true});if(pendingReturn===context)pendingReturn=null;
    }));
  }
  function removeSurface(restore=true) {if(!active)return;const context=active;active=null;context.dialog.close();context.dialog.remove();if(restore){pendingReturn=context;restoreContext(context);}}
  function dismiss({back=true,restore=true}={}) {
    if(!active)return;
    const pushed=active.pushed,base=active.base;
    removeSurface(restore);
    if(back&&pushed&&params().has('recordKind'))history.back();else if(params().has('recordKind'))history.replaceState(history.state,'',base);
  }
  function open(kind,id,{fromRoute=false,returnToTrip=null}={}) {
    if(active&&(active.source!==state||active.profile!==state.activeProfileId))removeSurface(false);
    if(!collections[kind])return false;const row=find(kind,id);if(!row)return false;
    if(active?.kind===kind&&active.id===id)return true;
    const previous=active,base=previous?.base||withoutReader(),pushed=previous?.pushed||!fromRoute,opener=previous?.opener||document.activeElement,scroll=previous?.scroll||{x:scrollX,y:scrollY};
    const focusAttributes=['data-agenda-hotel','data-agenda-place','data-transport-edit','data-calendar-edit-stay','data-day-note-edit','data-v1-read','data-record-id'];
    const focusSelector=previous?.focusSelector||focusAttributes.filter(a=>opener?.hasAttribute?.(a)).map(a=>'['+a+'="'+CSS.escape(opener.getAttribute(a))+'"]');
    removeSurface(false);
    const dialog=document.createElement('dialog');dialog.className='dialog hv-v1-reader';dialog.setAttribute('aria-label',kind==='saved'?'Saved place details':'Travel record details');
    dialog.innerHTML=`<article class="dialog-card"><nav class="hv-v1-reader-nav" aria-label="Record navigation"><span>YOUR TRAVEL RECORD</span>${kind!=='saved'?`<button type="button" class="secondary" data-v1-edit="${kind}" data-record-id="${E(row.id)}">Edit ${kind==='accommodation'?'stay':kind==='country'?'visit':kind==='location'?'location':kind}</button>`:''}<button type="button" class="text-btn" data-v1-close aria-label="Close record details">Close ×</button></nav>${body(kind,row)}</article>`;
    pendingReturn=null;document.body.append(dialog);active={kind,id,dialog,opener,focusSelector:Array.isArray(focusSelector)?focusSelector.join(''):focusSelector,scroll,source:state,profile:state.activeProfileId,base,pushed,returnToTrip};identity={source:state,profile:state.activeProfileId};
    if(!fromRoute){history[previous?'replaceState':'pushState']({...(history.state||{}),hvReader:true},'',recordLink(kind,id,base));}
    dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
    dialog.addEventListener('click',e=>{if(e.target.closest('[data-v1-close]'))dismiss();});
    dialog.showModal();dialog.querySelector('h2')?.focus({preventScroll:true});return true;
  }
  function edit(kind,id) {const row=find(kind,id);if(!row)return;dismiss({back:false,restore:false});if(kind==='accommodation')HVPlaces.open({accommodationId:id});else if(kind==='transport')HVJourneys.openTransport(id);else if(kind==='country')openStayDialog(id);else if(kind==='note')HVTravelTools.openNote(row);else HVPlaces.open({recordId:id});}
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    let kind=target.dataset.v1Read,id=target.dataset.recordId;
    const agenda=target.closest('#todayAgenda,#tomorrowAgenda');
    if(agenda&&!kind){for(const [attribute,type] of [['agendaHotel','accommodation'],['transportEdit','transport'],['calendarEditStay','country'],['dayNoteEdit','note'],['agendaPlace','location']])if(target.dataset[attribute]){kind=type;id=target.dataset[attribute];break;}}
    if(kind&&open(kind,id)){event.preventDefault();event.stopImmediatePropagation();return;}
    if(target.dataset.v1Edit){event.preventDefault();event.stopImmediatePropagation();edit(target.dataset.v1Edit,id);return;}
    if(target.dataset.v1ManagePlace){event.preventDefault();event.stopImmediatePropagation();const row=find('saved',target.dataset.v1ManagePlace);dismiss({back:false,restore:false});if(row)HVSavedPlaces.manage({search:HVAddress.field(row.place,'name')});return;}
    if(active&&target.closest('.hv-v1-reader')&&(target.hasAttribute('data-trip-open')||target.matches('a[href]')))dismiss({back:false,restore:false});
  },true);
  function syncRoute() {
    if(!window.HVCalendar?.ready)return;
    const p=params(),kind=p.get('recordKind'),id=p.get('recordId');
    if(active&&(active.source!==state||active.profile!==state.activeProfileId)){removeSurface();if(kind)history.replaceState(history.state,'',withoutReader());return;}
    if(kind&&id){if(!open(kind,id,{fromRoute:true})&&active)removeSurface();}else{removeSurface();restoreContext(pendingReturn);}
  }
  window.addEventListener('hashchange',syncRoute);window.addEventListener('popstate',syncRoute);window.addEventListener('hv-route',syncRoute);window.addEventListener('hv-data-changed',()=>{if(identity&&(identity.source!==state||identity.profile!==state.activeProfileId))syncRoute();});
  document.addEventListener('change',()=>{if(active&&(active.source!==state||active.profile!==state.activeProfileId))syncRoute();});
  const render=window.renderAll;window.renderAll=function(...args){const result=render.apply(this,args);if(active&&(active.source!==state||active.profile!==state.activeProfileId))syncRoute();return result;};
  window.HVV1Readers={open,saved:id=>open('saved',id),recordLink,exactPlace,kinds};
  document.addEventListener('DOMContentLoaded',()=>queueMicrotask(syncRoute));
  syncRoute();
})();

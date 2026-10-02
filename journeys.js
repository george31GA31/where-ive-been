/* Country reference pages, explicit place visits, home preferences and transport UI. */
(() => {
  'use strict';
  const root=new URL('./',document.currentScript?.src||location.href);
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const J=window.HVJourney, catalog={}, failures=new Set();
  let ready=false,category='mountains',search='',page=0,visitDate='',countryCode='',selectedMapCountry='',opener=null;
  const paths={flight:'m3 10 7 2 4 8 2-1-2-7 6-4-1-2-7 2-6-5-2 1 4 6-5-1Z',train:'M5 16V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10H5Zm0-6h14M8 20l2-4m6 4-2-4M8 13h1m6 0h1',bus:'M4 17V5h16v12H4Zm0-7h16M7 17v3m10-3v3M7 13h1m8 0h1',car:'m3 12 3-7h12l3 7v6H3v-6Zm0 0h18M6 18v3m12-3v3M6 15h2m8 0h2',boat:'M4 11h16l-3 7H7l-3-7Zm4 0V5h8v6M12 5V2M3 21l3-1 3 1 3-1 3 1 3-1 3 1',other:'M4 12h16m-6-6 6 6-6 6'};
  const icon=type=>HVTransportIcons.html(type);
  const items=kind=>catalog[kind]?.items||[];
  const today=()=>isoDate(new Date());
  const records=()=>J.visibleTransport(state);
  const layer=view=>({countries:true,transport:true,accommodation:true,...state.visualLayers?.[view]});
  function openCountry(code){if(!countryByCode(code)||code==='SEA')return;selectedMapCountry=code;if(get('worldMap'))get('worldMap').dataset.selectedCountry=code;renderMapSelection();updateMapColors();}
  function renderMapSelection(){
    const host=get('mapCountrySummary');if(!host)return;
    const code=selectedMapCountry,c=countryByCode(code);if(get('mapCountrySelect'))get('mapCountrySelect').value=code;
    if(!c){host.hidden=true;host.innerHTML='';return;}
    const todayDate=today(),records=staysForProfile().filter(s=>s.countryCode===code&&J.countsForPlanning(s)).sort((a,b)=>a.start.localeCompare(b.start));
    const actual=records.filter(s=>s.status==='actual'&&s.start<=todayDate),planned=records.filter(s=>s.status==='planned'&&s.start>todayDate).sort((a,b)=>a.start.localeCompare(b.start));
    const days=new Set(actual.flatMap(s=>datesForStay(s,null,todayDate)).filter(d=>!J.isHome(state,code,d)));
    host.hidden=false;
    host.innerHTML=`<div class="map-country-summary-head"><div>${flagHtml(code,'flag-img flag-lg')}<div><p class="eyebrow">SELECTED COUNTRY</p><h2>${E(c.name)}</h2></div></div><button type="button" class="text-btn" data-clear-map-country>Clear selection</button></div><div class="map-country-summary-stats"><div><strong>${actual.length}</strong><span>recorded stay${actual.length===1?'':'s'}</span></div><div><strong>${days.size}</strong><span>travel days</span></div><div><strong>${actual[0]?E(fmt(actual[0].start)):'—'}</strong><span>first visit</span></div><div><strong>${actual.at(-1)?E(fmt(actual.at(-1).end)):'—'}</strong><span>most recent</span></div></div>${planned[0]?`<p class="map-country-next"><strong>Next planned visit:</strong> ${E(fmt(planned[0].start))} to ${E(fmt(planned[0].end))}</p>`:''}<div class="map-country-summary-actions"><a class="secondary" href="#/country/${E(code)}">View full country details</a><button class="primary" type="button" data-atlas-add="${E(code)}">Add a trip</button></div>`;
  }
  function renderCountry(){
    const host=get('countryDetails');if(!host)return;
    const code=location.hash.match(/country\/([A-Z]{2,3})/i)?.[1]?.toUpperCase();
    if(!code||!countryByCode(code)){host.innerHTML='<a href="#/countries">Back to countries</a><h2>Country not found</h2>';return;}
    if(countryCode!==code){countryCode=code;search='';page=0;}
    const c=countryByCode(code),history=staysForProfile().filter(s=>s.countryCode===code&&s.status==='actual'&&s.start<=today()).sort((a,b)=>a.start.localeCompare(b.start));
    const next=staysForProfile().filter(s=>s.countryCode===code&&s.status==='planned'&&s.start>=today()).sort((a,b)=>a.start.localeCompare(b.start))[0];
    const days=new Set(history.flatMap(s=>datesForStay(s,null,today()))),travel=[...days].filter(d=>!J.isHome(state,code,d));
    document.title=c.name+' — Herald Voyages';if(get('pageTitle'))get('pageTitle').textContent='Country details';
    const rows=items(category).filter(r=>r.countryCodes.includes(code)&&[r.name,r.iata,r.icao,r.city].join(' ').toLowerCase().includes(search.toLowerCase()));
    page=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
    const visited=J.visits(state,category,today());
    host.innerHTML=`<a class="country-back" href="#/countries">← Countries</a><header class="country-heading">${flagHtml(code)}<div><p class="eyebrow">${E(HVAtlas.region(code))}</p><h1>${E(c.name)}</h1><p>Capital: ${E(catalog.capitals?.[code]||'Not available')}</p></div></header><div class="country-facts"><div><strong>${travel.length}</strong><span>travel days</span></div><div><strong>${days.size-travel.length}</strong><span>home-only days</span></div><div><strong>${history.length}</strong><span>recorded stays</span></div><div><strong>${history[0]?E(fmt(history[0].start)):'—'}</strong><span>first recorded visit</span></div><div><strong>${history.at(-1)?E(fmt(history.at(-1).end>today()?today():history.at(-1).end)):"—"}</strong><span>most recent visit</span></div><div><strong>${next?E(fmt(next.start)):"—"}</strong><span>next planned visit</span></div></div><details class="journey-accordion" open><summary>Your travel history · ${history.length} stays</summary><div class="reference-list">${history.map(s=>`<div class="reference-row"><span>${E(fmt(s.start))} to ${E(fmt(s.end))}</span><button type="button" class="secondary" data-action="edit-stay" data-id="${E(s.id)}">Edit stay</button></div>`).join('')||'<p>No recorded visits yet.</p>'}<button type="button" class="primary" data-atlas-add="${code}">Add trip</button></div></details><nav class="country-tabs" aria-label="Country information">${Object.entries(J.categories).map(([key,label])=>`<button type="button" data-country-tab="${key}" aria-pressed="${key===category}">${E(label)}</button>`).join('')}</nav><section class="country-reference"><div class="journey-tools"><h2>${E(J.categories[category])}</h2><label class="field"><span>Search ${category==='airports'?'airports, codes or cities':'names'}</span><input id="placeSearch" type="search" value="${E(search)}"></label></div><p class="helper">Mark the places you have personally visited.${category==='airports'?' Recorded flight endpoints can also count after their local date has passed.':''}</p><div class="reference-list">${!catalog[category]?`<p role="status">${failures.has(category)?'This reference list could not be loaded. Try again when connected.':'Loading country information…'}</p>`:!items(category).length?`<p class="empty-state">A verified ${E(J.categories[category].toLowerCase())} list is not available yet.</p>`:!rows.length?'<p class="empty-state">No matching entries for this country.</p>':rows.slice(page*20,page*20+20).map(r=>{
      const explicit=(state.placeVisits||[]).find(v=>v.category===category&&v.itemId===r.id&&(!v.profileId||v.profileId===state.activeProfileId));
      const inferred=visited.has(r.id)&&!explicit;
      return `<div class="reference-row"><div><strong>${E(r.name)}</strong><p>${r.heightMeters!==undefined?E(r.heightMeters.toLocaleString())+' m':''}${r.iata?' · '+E(r.iata):''}${r.icao?' · '+E(r.icao):''}${r.city?' · '+E(r.city):''}${r.type?' · '+E(r.type):''}</p>${r.url&&/^https:\/\//.test(r.url)?`<a href="${E(r.url)}" target="_blank" rel="noopener noreferrer">Official information ↗</a>`:''}</div><div class="place-visit-controls"><label class="field"><span>Your visit to ${E(r.name)}</span><select data-place-id="${E(r.id)}"><option value="not-recorded" ${!explicit&&!inferred||explicit?.status==='not-recorded'?'selected':''}>Not recorded</option><option value="visited" ${visited.has(r.id)?'selected':''}>Visited</option><option value="want" ${explicit?.status==='want'?'selected':''}>Want to visit</option></select></label><label class="field"><span>Visit date</span><input type="date" data-place-date="${E(r.id)}" value="${E(explicit?.date||'')}" max="${today()}" ${!visited.has(r.id)?'disabled':''}></label>${inferred?'<small>Inferred from a recorded flight. Set a date or change the status to review it.</small>':''}</div></div>`;
    }).join('')}</div>${rows.length>20?`<div class="journey-tools"><button type="button" data-place-page="-1" ${page===0?'disabled':''}>Previous</button><span>Page ${page+1} of ${Math.ceil(rows.length/20)} · ${rows.length} entries</span><button type="button" data-place-page="1" ${(page+1)*20>=rows.length?'disabled':''}>Next</button></div>`:''}${category==='unesco'?`<p><a href="https://whc.unesco.org/en/statesparties/${code.toLowerCase()}/" target="_blank" rel="noopener noreferrer">Explore this country on UNESCO ↗</a> · <a href="https://whc.unesco.org/en/list/" target="_blank" rel="noopener noreferrer">Official World Heritage List ↗</a></p>`:''}<p class="helper">${['mountains','buildings'].includes(category)?'Community reference list; entries have not been independently verified.':E(catalog[category]?.source||'')}</p></section><p class="helper">Capital reference: <a href="https://github.com/samayo/country-json">country-json</a>.</p>`;
    get('placeSearch').oninput=e=>{search=e.target.value;const at=e.target.selectionStart;page=0;renderCountry();get('placeSearch').focus();try{get('placeSearch').setSelectionRange(at,at);}catch{}};

  }
  function renderAchievements(){
    const host=get('atlasStatistics');if(!host)return;host.querySelector('#placeAchievements')?.remove();
    const panel=document.createElement('article');panel.id='placeAchievements';panel.className='panel';
    const universe=COUNTRIES.filter(c=>c.code!=='SEA'&&WIBCountryCount.isCounted(c.code)),visited=J.summary(state,today()).countries;
    panel.innerHTML=`<h2>Places experienced</h2><p class="helper">Your recorded visits, counted once per place. Totals reflect imported reference data.</p><div class="achievement-grid"><div><span>Countries visited</span><strong>${universe.filter(c=>visited.has(c.code)).length} <small>/ ${universe.length}</small></strong></div>${Object.entries(J.categories).map(([key,label])=>{const ids=J.visits(state,key,today()),list=items(key);return `<div><span>${E(label)} visited</span><strong>${list.length?list.filter(r=>ids.has(r.id)).length:'—'} <small>${list.length?'/ '+list.length:''}</small></strong>${!list.length?'<small>Data not available yet</small>':''}</div>`;}).join('')}</div>`;
    host.append(panel);
  }
  function renderYear(){
    const host=get('atlasYear');if(!host||host.hidden)return;
    const year=calendarCursor.getUTCFullYear(),show=layer('calendar'),accommodations=show.accommodation?J.scoped(state.accommodations,state.activeProfileId).filter(a=>!J.hiddenHomeRecord(state,a)):[];
    host.innerHTML=`<div class="year-legend"><span>● Travel</span><span class="home-legend">▧ Home</span><span>◐ Home & travel</span><span>○ Unrecorded</span><span class="accommodation-legend">⌂ Accommodation</span></div>`+Array.from({length:12},(_,m)=>{
      const prefix=`${year}-${String(m+1).padStart(2,'0')}`;let home=0,travel=0;
      const dots=Array.from({length:new Date(year,m+1,0).getDate()},(_,d)=>{const date=prefix+'-'+String(d+1).padStart(2,'0'),status=date<=today()?J.dayStatus(state,date):'unrecorded';if(status==='home')home++;if(['travel','mixed'].includes(status))travel++;
        const transport=show.transport&&records().some(t=>J.transportDates(t).includes(date));
        const accommodation=accommodations.some(a=>a.checkIn<=date&&a.checkOut>=date);
        return `<i class="${show.countries?status:'unrecorded'} ${transport?'has-transport':''} ${accommodation?'has-accommodation':''}" title="${date}: ${show.countries?status:'countries hidden'}${transport?', transport':''}${accommodation?', accommodation':''}"></i>`;}).join('');
      return `<button type="button" class="atlas-month" data-atlas-month="${m}" data-atlas-year="${year}"><strong>${new Date(year,m,1).toLocaleDateString('en-GB',{month:'long'})}</strong><div class="atlas-month-dots">${dots}</div><small>${show.countries?`${travel} travel · ${home} home-only days`:'Countries hidden'}</small></button>`;
    }).join('');
  }
  function renderCalendarExtras(){
    if(get('calendar')?.dataset.journeyCalendar==='true'){window.HVCalendar?.renderMonth?.();renderYear();renderTransportList();return;}
    const show=layer('calendar');get('calendarView')?.classList.toggle('hide-calendar-countries',!show.countries);
    get('calendar')?.querySelectorAll('[data-calendar-date]').forEach(day=>{
      day.querySelectorAll('.calendar-transport').forEach(el=>el.remove());const date=day.dataset.calendarDate;
      day.dataset.homeStatus=show.countries&&date<=today()?J.dayStatus(state,date):'unrecorded';
      day.querySelectorAll('.day-stay').forEach(el=>{const s=state.stays.find(s=>s.id===(el.dataset.id||el.dataset.calendarStayId));if(s)el.classList.toggle('home-stay',J.isHome(state,s.countryCode,date));});
      if(show.transport)records().filter(t=>J.transportDates(t).includes(date)).forEach(t=>{
        const b=document.createElement('button');b.type='button';b.className='calendar-transport';b.dataset.transportEdit=t.id;b.innerHTML=icon(t.type)+`<span>${E(t.type==='flight'?(t.flightNumber||'Flight'):J.types[t.type]||t.type)} · ${E(J.transportLabel(t,airportFor))}</span>`;b.title=`${t.startLocal} → ${t.endLocal} (each endpoint's local time)`;day.append(b);
      });
    });renderYear();renderTransportList();
  }
  function transportEndpoint(t,end){const p=t[end];return p?.airportId?({...items('airports').find(a=>a.id===p.airportId),...p}):p;}
  function renderMap(){
    window.HVPlaces?.renderMap?.();
  }
  function renderTimeline(){
    const all=staysForProfile().filter(countsForPlanning).filter(s=>J.isTravelStay(state,s));
    get('timelineEmpty').classList.toggle('hidden',all.length>0);get('timelineContent').classList.toggle('hidden',!all.length);if(!all.length)return;
    const dates=all.flatMap(r=>[r.start,r.end]).concat(today()).sort(),min=dates[0],max=dates.at(-1),total=Math.max(1,diffDays(min,max));
    els.timelineSlider.dataset.start=min;els.timelineSlider.max=total;timelineDate=timelineDate&&timelineDate>=min&&timelineDate<=max?timelineDate:today();els.timelineSlider.value=diffDays(min,timelineDate);
    els.timelineStartLabel.textContent=fmt(min);els.timelineEndLabel.textContent=fmt(max);
    els.timelineBars.innerHTML=all.map((r,i)=>{const a=r.start<r.end?r.start:r.end,b=r.start>r.end?r.start:r.end;return `<div class="timeline-bar ${r.transport?'transport-bar':''}" style="left:${diffDays(min,a)/total*100}%;width:${Math.max(.35,(diffDays(a,b)+1)/(total+1)*100)}%;top:${i%3*21+7}px;${r.transport?'background:'+J.routeColor(r.transport.type):''}" title="${E(r.countryName)}: ${a} — ${b}"></div>`;}).join('');
    const input=get('timelineManualDate');input.min=min;input.max=max;input.value=timelineDate;updateTimelineLabels();renderMap();
  }
  function renderTransportList(){
    const host=get('transportRecords');if(!host)return;const term=get('transportSearch')?.value.toLowerCase()||'';
    const list=J.scoped(state.transports,state.activeProfileId).filter(t=>[t.start.name,t.end.name,t.flightNumber,J.types[t.type]].join(' ').toLowerCase().includes(term)).sort((a,b)=>b.startLocal.localeCompare(a.startLocal));
    host.innerHTML=list.length?list.map(t=>`<div class="transport-record">${icon(t.type)}<div><strong>${E(J.transportLabel(t,airportFor))}</strong><p>${E(J.types[t.type]||t.type)}${t.flightNumber?' '+E(t.flightNumber):''} · ${E(t.status||'actual')}</p><small>${E(t.startLocal.replace('T',' '))} → ${E(t.endLocal.replace('T',' '))} · local times at each endpoint</small></div><button class="secondary" type="button" data-transport-edit="${E(t.id)}">Edit</button></div>`).join(''):'<p class="empty-state">No matching transport records. Add a flight, train or other journey.</p>';
  }
  function editTrip(id){
    const trip=state.trips.find(t=>t.id===id);if(!trip)return;
    const dialog=document.createElement('dialog');dialog.className='dialog';dialog.setAttribute('aria-label','Edit trip');
    const stays=state.stays,transport=state.transports,accommodations=state.accommodations||[];
    const accommodationRow=(a={})=>`<div class="trip-accommodation-row" data-trip-accommodation-row data-id="${E(a.id||'')}"><div class="trip-accommodation-grid"><label class="field"><span>Property name</span><input name="propertyName" value="${E(a.propertyName||'')}" maxlength="160" placeholder="e.g. Hotel Lovec"></label><label class="field"><span>Location</span><input name="location" value="${E(a.location||'')}" maxlength="160" placeholder="e.g. Bled"></label><label class="field"><span>Check-in</span><input type="date" name="checkIn" value="${E(a.checkIn||'')}"></label><label class="field"><span>Check-out</span><input type="date" name="checkOut" value="${E(a.checkOut||'')}"></label></div>${HVAccommodation.fields(a)}<label class="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="3" maxlength="4000">${E(a.notes||'')}</textarea></label><button class="text-btn" type="button" data-remove-trip-accommodation>Remove accommodation</button></div>`;
    dialog.innerHTML=`<form class="dialog-card"><h2>Edit trip</h2><label class="field"><span>Trip name</span><input name="name" value="${E(trip.name)}" required maxlength="80"></label><label class="field"><span>Notes</span><textarea name="notes">${E(trip.notes||'')}</textarea></label><p>Choose the stays and transport belonging to this trip. Unchecking a record keeps it as a standalone record. Selecting another traveller’s record explicitly adds that traveller to the trip.</p><label class="field"><span>Status for selected records</span><select name="status"><option value="">Keep individual statuses</option><option value="actual">Mark all selected travel completed</option><option value="planned">Keep all selected travel planned</option><option value="cancelled">Mark all selected travel cancelled</option></select></label><fieldset><legend>Stays</legend>${stays.filter(s=>!s.tripId||s.tripId===id).map(s=>`<label class="trip-member"><input type="checkbox" name="stay" value="${E(s.id)}" ${s.tripId===id?'checked':''}>${E(s.location||s.countryName)} · ${E(s.start)} to ${E(s.end)} · ${E(state.profiles.find(p=>p.id===s.profileId)?.name||'Shared')}</label>`).join('')||'<p>No available stays.</p>'}</fieldset><fieldset><legend>Transport</legend>${transport.filter(t=>!t.tripId||t.tripId===id).map(t=>`<label class="trip-member"><input type="checkbox" name="transport" value="${E(t.id)}" ${t.tripId===id?'checked':''}>${E(J.transportLabel(t,airportFor))} · ${E(t.startLocal)} · ${E(state.profiles.find(p=>p.id===t.profileId)?.name||'Shared')}</label>`).join('')||'<p>No available transport.</p>'}</fieldset><fieldset class="trip-accommodation-fieldset"><legend>Accommodation <em>optional</em></legend><p class="helper">Accommodation is kept separate from country stays and transport, so you can edit or remove it without changing the journey itself.</p><div data-trip-accommodation-list>${accommodations.filter(a=>a.tripId===id).map(accommodationRow).join('')}</div><button class="secondary compact" type="button" data-add-trip-accommodation>+ Add accommodation</button></fieldset><p class="form-error" data-trip-error role="alert"></p><div class="journey-tools"><button class="primary" type="submit">Save trip</button><button type="button" data-cancel>Cancel</button></div></form>`;
    const before=document.activeElement;document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();before?.focus();});
    const form=dialog.querySelector('form'),accommodationList=form.querySelector('[data-trip-accommodation-list]'),tripError=form.querySelector('[data-trip-error]');
    form.querySelector('[data-add-trip-accommodation]').onclick=()=>accommodationList.insertAdjacentHTML('beforeend',accommodationRow());
    accommodationList.onclick=e=>{const remove=e.target.closest('[data-remove-trip-accommodation]');if(remove)remove.closest('[data-trip-accommodation-row]').remove();};
    form.onsubmit=e=>{e.preventDefault();tripError.textContent='';
      const nextAccommodations=[];for(const row of accommodationList.querySelectorAll('[data-trip-accommodation-row]')){const value=name=>row.querySelector(`[name="${name}"]`).value.trim(),propertyName=value('propertyName'),location=value('location'),checkIn=value('checkIn'),checkOut=value('checkOut'),notes=value('notes');if(!propertyName&&!location&&!checkIn&&!checkOut&&!notes)continue;if(!propertyName||!location||!J.validDate(checkIn)||!J.validDate(checkOut)||checkOut<checkIn){tripError.textContent='Each accommodation needs a property, location and valid check-in/check-out dates.';return;}const timeError=HVAccommodation.valid(HVAccommodation.read(row));if(timeError){tripError.textContent=timeError;return;}const existing=accommodations.find(a=>a.id===row.dataset.id);nextAccommodations.push({...existing,id:existing?.id||uid(),tripId:id,profileId:existing?.profileId??trip.profileId??state.activeProfileId,propertyName,location,checkIn,checkOut,...HVAccommodation.read(row),notes});}
      trip.name=form.elements.name.value.trim();trip.notes=form.elements.notes.value.trim();for(const [key,list] of [['stay',stays],['transport',transport]]){const selected=new Set([...form.querySelectorAll(`input[name="${key}"]:checked`)].map(el=>el.value));for(const row of list){if(selected.has(row.id)){row.tripId=id;if(form.elements.status.value){row.status=form.elements.status.value;delete row.plannedReviewStart;}}else if(row.tripId===id)row.tripId=null;}}
      state.accommodations=[...accommodations.filter(a=>a.tripId!==id),...nextAccommodations];trip.profileIds=[...new Set([trip.profileId,...[...stays,...transport].filter(r=>r.tripId===id).map(r=>r.profileId),...nextAccommodations.map(a=>a.profileId)].filter(Boolean))];updatePassedPlannedTrips();persist();dialog.close();refresh();};dialog.showModal();
  }
  function openTransport(id,prefill={}){
    const t=state.transports?.find(t=>t.id===id),dialog=get('transportDialog');opener=document.activeElement;
    const form=get('transportForm');form.reset();form.dataset.id=id||'';
    form._pendingOutbound=null;form._saveCallback=prefill.onSave;form.querySelectorAll('.return-outbound-summary,[data-save-outbound-only]').forEach(n=>n.remove());form._flightRecord=t||prefill;form._flightInitialised=false;form._airportPrefill={...prefill};form._via=(t?.via||prefill.via||[]).map(a=>({...a}));renderVia();form.querySelectorAll('.airport-search-results').forEach(el=>el.replaceChildren());
    form.elements.type.value=t?.type||prefill.type||'flight';form.elements.status.value=t?.status||prefill.status||((prefill.startLocal||'').slice(0,10)>today()?'planned':'actual');form.elements.tripId.innerHTML='<option value="">No linked trip</option>'+J.scoped(state.trips,state.activeProfileId).map(x=>`<option value="${E(x.id)}">${E(x.name)}</option>`).join('');form.elements.tripId.value=t?.tripId||prefill.tripId||'';
    for(const key of ['startLocal','endLocal','flightNumber','bookingReference'])form.elements[key].value=t?.[key]||prefill[key]||(['startLocal','endLocal'].includes(key)?today()+'T12:00':'');
    for(const key of ['start','end'])for(const field of ['name','terminal','lat','lon'])form.elements[key+field].value=t?.[key]?.[field]??prefill[key]?.[field]??'';
HVTransportDetails.setup(form,t||prefill);get('transportDelete').hidden=!t;get('transportError').textContent='';get('transportDialogTitle').textContent=t?'Edit transport':'Add transport';updateTransportFields();dialog.showModal();form.elements.type.focus();
  }
  function updateTransportFields(){
    const form=get('transportForm'),flight=form.elements.type.value==='flight';HVTransportDetails.update(form);window.HVFlights?.toggle(form,flight);get('flightNumberField').hidden=!flight;get('flightViaFields').hidden=!flight;form.elements.flightNumber.required=false;
    for(const end of ['start','end']){
      let pick=form.querySelector(`[data-pick-endpoint="${end}"]`);if(!pick){pick=document.createElement('button');pick.type='button';pick.className='secondary compact';pick.dataset.pickEndpoint=end;pick.textContent='Find or plot on map';form.elements[end+'name'].closest('label').after(pick);pick.onclick=()=>HVPlaces.open({context:form.elements.type.value,place:HVRouteGeometry.point(form._airportPrefill[end])?form._airportPrefill[end]:null,onSelect:p=>HVTransportDetails.setPoint(form,end,p)});}pick.hidden=flight;
      get(end+'PlaceLabel').textContent=(end==='start'?'Departure':'Arrival')+(flight?' airport':form.elements.type.value==='train'?' station':form.elements.type.value==='bus'?' stop / terminal':form.elements.type.value==='boat'?' port / terminal':' address / place');
      form.elements[end+'name'].removeAttribute('list');form.querySelector(`[data-airport-results="${end}"]`)?.replaceChildren();
      form.elements[end+'name'].placeholder=flight?'Airport name or code':'Start typing a station, stop or address';
    }
  }
  function renderVia(){
    const form=get('transportForm'),host=get('flightViaList');if(!host)return;
    host.innerHTML=(form._via||[]).map((a,i)=>`<span class="flight-via-chip">${E(a.iata||a.icao||a.name)}<button type="button" data-remove-via="${i}" aria-label="Remove connection ${E(a.name)}">×</button></span>`).join('');
    host.onclick=e=>{const button=e.target.closest('[data-remove-via]');if(button){form._via.splice(Number(button.dataset.removeVia),1);renderVia();}};
  }
  function airportFor(value){const key=value.trim().toLowerCase();return items('airports').find(a=>[a.name,a.iata,a.icao,`${a.name} (${a.iata||a.icao||a.id})`].some(x=>x?.toLowerCase()===key));}
  function saveTransport(event){
    event.preventDefault();const form=event.currentTarget,f=form.elements;if(f.type.value==='flight'&&window.HVFlights)return HVFlights.save(form);const old=state.transports?.find(t=>t.id===form.dataset.id);
    const t={...old,id:old?.id||uid(),profileId:old?.profileId??state.activeProfileId,tripId:f.tripId.value||J.tripForDates(state,f.startLocal.value.slice(0,10),f.endLocal.value.slice(0,10)),type:f.type.value,status:f.status.value};
    for(const key of ['startLocal','endLocal','flightNumber','bookingReference'])t[key]=f[key].value.trim();
    if(t.type!=='flight')delete t.flightNumber;
    for(const end of ['start','end']){
      const name=f[end+'name'].value.trim(),savedAirport=form._airportPrefill?.[end]?.name===name?form._airportPrefill[end]:null,a=t.type==='flight'?(savedAirport||airportFor(name)):savedAirport;
      t[end]={...(old?.[end]?.name===name?old[end]:{}),name,terminal:f[end+'terminal'].value.trim(),lat:f[end+'lat'].value===''?(a?.lat??null):Number(f[end+'lat'].value),lon:f[end+'lon'].value===''?(a?.lon??null):Number(f[end+'lon'].value)};
      if(a){t[end]={...a,...t[end]};if(t.type==='flight')t[end].airportId=a.airportId||a.id;if(a.timezone)t[end].timezone=a.timezone;if(a.iata)t[end].iata=a.iata;if(a.icao)t[end].icao=a.icao;}
    }
    if(t.type==='flight'){if(f.vianame.value.trim()){get('transportError').textContent='Select the connecting airport from the results, or clear the Via search.';return;}t.via=(form._via||[]).map(a=>({...a}));}else {t.via=(form._via||[]).map(p=>({...p}));if(t.via.some(p=>!p.name?.trim())){get('transportError').textContent='Choose a place for each via stop or remove the empty stop.';return;}if(old?.type==='flight')delete t.legs;}
    const error=J.validateTransport(t);if(error){get('transportError').textContent=error;return;}
    HVTransportDetails.finish(form,t);
  }
  function refresh(){renderAll();render();renderCalendarExtras();renderTimeline();}
  function render(){if(!ready)return;renderPersonalPlaces();renderAchievements();renderYear();renderTransportList();if(document.body.dataset.currentView==='country'||location.hash.includes('/country/'))renderCountry();renderHomeSummary();renderMapSelection();}
  function renderPersonalPlaces(){
    const host=get('personalPlaces');if(!host)return;
    const visits=J.scoped(state.placeVisits,state.activeProfileId).filter(v=>v.status!=='not-recorded');
    host.innerHTML=visits.map(v=>{const place=v.category==='locations'?v.place:items(v.category).find(p=>p.id===v.itemId),code=place?.countryCode||place?.countryCodes?.[0];return `<div class="reference-row"><div><strong>${E(place?.name||'Saved place visit')}</strong><p>${E(J.categories[v.category]||place?.type||v.category)} · ${v.status==='want'?'Want to visit':E(v.date||'Date not recorded')}${v.tripId?' · Linked trip':''}</p></div>${v.category==='locations'?`<div class="place-actions"><button class="secondary compact" type="button" data-place-edit="${E(v.id)}">Edit</button><button class="text-btn" type="button" data-place-delete="${E(v.id)}">Remove</button></div>`:code?`<a class="secondary" href="#/country/${E(code)}">Review visit</a>`:'<span>Reference details unavailable</span>'}</div>`;}).join('')||'<div class="empty-state places-empty"><p>No individual places recorded yet.</p><p>Places are separate from country stays, so you can keep a personal list of things you visited or want to see.</p><a class="secondary" href="#/countries">Browse countries</a></div>';
  }
  function renderHomeSummary(){const host=get('homeCountriesSummary');if(host)host.textContent=(activeProfile()?.homeCountryCodes||[]).map(c=>countryByCode(c)?.name||c).join(' · ')||'No permanent home countries selected. Dated residence periods still apply.';}
  function installHome(){
    const panel=document.createElement('article');panel.className='panel';panel.innerHTML='<h2>Home countries</h2><p class="helper">Dated home history is the most accurate option. A permanent home country applies to every recorded date, including earlier years.</p><p id="homeCountriesSummary"></p><details class="journey-accordion"><summary>Choose permanent home countries</summary><p class="helper">Only use this when the country should be treated as home throughout your entire history.</p><label class="field"><span>Search countries</span><input type="search" id="homeCountrySearch"></label><div id="homeCountryChoices" class="home-country-choices"></div></details>';
    get('homesView').prepend(panel);
    function choices(){const term=get('homeCountrySearch').value.toLowerCase();get('homeCountryChoices').innerHTML=COUNTRIES.filter(c=>c.code!=='SEA'&&c.name.toLowerCase().includes(term)).map(c=>`<label><input type="checkbox" data-home-country="${c.code}" ${(activeProfile()?.homeCountryCodes||[]).includes(c.code)?'checked':''}>${flagHtml(c.code)} ${E(c.name)}</label>`).join('');}
    get('homeCountrySearch').oninput=choices;panel.querySelector('details').addEventListener('toggle',choices);choices();renderHomeSummary();
  }
  function installLayers(view){
    if(view!=='map')return;
    const field=document.createElement('fieldset');field.className='journey-layers';field.innerHTML=`<legend>Show</legend>${['countries','transport'].map(key=>`<label><input type="checkbox" data-layer-view="${view}" data-layer="${key}" ${layer(view)[key]?'checked':''}> ${key==='countries'?'Countries':'Transport'}</label>`).join('')}`;
    const toolbar=get('mapView').querySelector('.voyages-map-toolbar');(toolbar||get('mapView').querySelector('.map-panel')).append(field);
  }
  function init(){
    if(ready)return;ready=true;
    const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('journeys.css?v=flight-home-3&rollback=20261001-1',root);document.head.append(style);
    const mapTools=document.createElement('label');mapTools.className='field map-country-search';mapTools.innerHTML='<span>Find a country on the map</span><select id="mapCountrySelect" aria-label="Select country on the map"><option value="">Choose a country</option>'+COUNTRIES.filter(c=>c.code!=='SEA').map(c=>`<option value="${E(c.code)}">${E(c.name)}</option>`).join('')+'</select>';(get('mapView')?.querySelector('.voyages-map-toolbar')||get('mapView')).append(mapTools);get('mapCountrySelect').onchange=e=>openCountry(e.target.value);
    const mapPanel=get('mapView')?.querySelector('.map-panel');if(mapPanel&&!get('mapCountrySummary')){const summary=document.createElement('article');summary.id='mapCountrySummary';summary.className='panel map-country-summary';summary.hidden=true;mapPanel.after(summary);}
    const countries=get('countriesView'),directory=countries.querySelector('.atlas-directory');
    for(const [node,label,open] of [[directory,'Country Directory',true],[get('countryTotals')?.closest('.panel'),'Travel and home-day breakdown',false]]){
      if(!node)continue;const accordion=document.createElement('details');accordion.className='journey-accordion';accordion.open=open;const summary=document.createElement('summary');summary.textContent=label;node.before(accordion);accordion.append(summary,node);
    }
    installHome();
    const dateLabel=document.createElement('label');dateLabel.className='field timeline-manual';dateLabel.innerHTML='<span>Go to date</span><input type="date" id="timelineManualDate">';els.timelineSlider.before(dateLabel);
    get('timelineManualDate').onchange=e=>{if(J.validDate(e.target.value))setTimelineDate(e.target.value);};
    const transport=document.createElement('details');transport.className='journey-accordion';transport.innerHTML='<summary>Transport journeys</summary><label class="field"><span>Search journeys</span><input type="search" id="transportSearch"></label><div id="transportRecords"></div>';
    get('calendarView').append(transport);get('transportSearch').oninput=renderTransportList;
    const add=document.createElement('button');add.type='button';add.className='secondary compact';add.id='addTransportBtn';add.textContent='+ Add transport';add.onclick=()=>openTransport();get('calendarView').querySelector('.calendar-toolbar-actions')?.append(add);
    const dialog=document.createElement('dialog');dialog.id='transportDialog';dialog.className='transport-dialog';dialog.setAttribute('aria-labelledby','transportDialogTitle');
    dialog.innerHTML=`<form id="transportForm"><div class="journey-tools"><div><p class="eyebrow">TRANSPORT</p><h2 id="transportDialogTitle">Add transport</h2></div><button type="button" data-close-transport aria-label="Close transport form">Close</button></div><div class="transport-form-grid transport-basics"><label class="field"><span>Journey type</span><select name="type">${Object.entries(J.types).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><select name="tripId" hidden aria-hidden="true"><option value="">No linked trip</option></select><label class="field"><span>Is this planned or completed?</span><select name="status"><option value="actual">Completed</option><option value="planned">Planned</option><option value="cancelled">Cancelled</option></select></label></div><p class="helper">Use the local clock at each endpoint. Departure and arrival may use different time zones; these values are saved exactly as entered.</p><div class="transport-form-grid">${['start','end'].map(end=>`<fieldset><legend>${end==='start'?'Departure':'Arrival'}</legend><label class="field"><span>Local date and time</span><input type="datetime-local" name="${end}Local" required></label><label class="field"><span id="${end}PlaceLabel">Place</span><input name="${end}name" maxlength="200" required autocomplete="off" aria-controls="${end}AirportResults"></label><div id="${end}AirportResults" class="airport-search-results" data-airport-results="${end}" aria-label="Matching airports"></div><label class="field"><span>Station / terminal / port <em>optional</em></span><input name="${end}terminal" maxlength="200"></label><input type="hidden" name="${end}lat"><input type="hidden" name="${end}lon"></fieldset>`).join('')}</div><section id="flightViaFields"><label class="field"><span>Via airport <em>optional</em></span><input type="text" name="vianame" autocomplete="off" aria-controls="viaAirportResults" placeholder="Add a connection, e.g. Zurich or ZRH"></label><div id="viaAirportResults" class="airport-search-results" data-airport-results="via" aria-label="Connecting airports"></div><input type="hidden" name="vialat"><input type="hidden" name="vialon"><div id="flightViaList" aria-label="Connections in travel order"></div><p class="helper">Add connections in travel order. Transit airports do not count as countries visited.</p></section><details class="transport-more"><summary>Booking and flight details</summary><div class="transport-form-grid"><label class="field" id="flightNumberField"><span>Flight number <em>optional</em></span><input name="flightNumber" maxlength="30"></label><label class="field"><span>Booking reference <em>optional</em></span><input name="bookingReference" maxlength="100" autocomplete="off"></label></div></details><p id="transportError" role="alert"></p><div class="journey-tools"><button class="primary" type="submit">Save transport</button><button type="button" class="secondary" data-close-transport>Cancel</button><button type="button" id="transportDelete" class="danger">Delete transport</button></div></form>`;
    document.body.append(dialog);dialog.addEventListener('close',()=>{opener?.focus?.();});get('transportForm').onsubmit=saveTransport;get('transportForm').elements.type.onchange=updateTransportFields;
    for(const side of ['start','end','via']){
      const form=get('transportForm'),input=form.elements[side+'name'],host=form.querySelector(`[data-airport-results="${side}"]`);
      input.oninput=()=>{
        form.elements[side+'lat'].value='';form.elements[side+'lon'].value='';delete form._airportPrefill?.[side];
        const term=input.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        host.replaceChildren();if(form.elements.type.value!=='flight'||term.length<2)return;
        const matches=items('airports').filter(a=>[a.name,a.iata,a.icao,a.city].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term)).sort((a,b)=>Number([b.iata,b.icao].some(c=>c?.toLowerCase()===term))-Number([a.iata,a.icao].some(c=>c?.toLowerCase()===term))).slice(0,12);
        host.innerHTML=matches.length?matches.map((a,i)=>`<button type="button" data-airport-result="${i}">${flagHtml(a.countryCodes[0],'flag-img flag-sm')}<span><strong>${E(a.name)}</strong><small>${E([a.iata,a.icao,a.city,countryByCode(a.countryCodes[0])?.name||a.countryCodes[0]].filter(Boolean).join(' · '))}</small></span><b aria-hidden="true">→</b></button>`).join(''):'<p class="helper" role="status">'+(failures.has('airports')?'Airport directory unavailable. You can still enter a name.':items('airports').length?'No matching airport. Try a city or another code.':'Loading airport directory…')+'</p>';
        host.onclick=e=>{const button=e.target.closest('[data-airport-result]');if(!button)return;const a=matches[Number(button.dataset.airportResult)],name=a.name+' ('+(a.iata||a.icao)+')';input.value=name;form.elements[side+'lat'].value=a.lat;form.elements[side+'lon'].value=a.lon;form._airportPrefill[side]={...a,name,airportId:a.id};if(side==='via'){form._via.push({...a,name,airportId:a.id});input.value='';renderVia();}host.replaceChildren();input.focus();};
      };
      input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();host.querySelector('button')?.focus();}if(e.key==='Escape')host.replaceChildren();};
      host.onkeydown=e=>{const buttons=[...host.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){host.replaceChildren();input.focus();}};
    }
    get('transportDelete').onclick=()=>{if(!confirm('Delete this transport journey?'))return;state.transports=state.transports.filter(t=>t.id!==get('transportForm').dataset.id);persist();dialog.close();refresh();};
    window.addEventListener('hv-calendar-rendered',renderCalendarExtras);
    const timeline=window.renderMapTimeline;window.renderMapTimeline=function(){timeline();renderTimeline();};
    const labels=window.updateTimelineLabels;window.updateTimelineLabels=function(){labels();if(get('timelineManualDate'))get('timelineManualDate').value=timelineDate||'';};
    window.setTimelineDate=function(value){if(!J.validDate(value)||!els.timelineSlider.dataset.start)return;els.timelineSlider.value=Math.max(0,Math.min(Number(els.timelineSlider.max),diffDays(els.timelineSlider.dataset.start,value)));setTimelineFromSlider();};
    const colors=window.updateMapColors;window.updateMapColors=function(){colors();renderMap();};
    window.addEventListener('hv-route',()=>{render();renderCalendarExtras();for(const view of ['map','calendar'])get(view+'View')?.querySelectorAll('[data-layer]').forEach(input=>input.checked=layer(view)[input.dataset.layer]);});
    refresh();
    for(const key of ['capitals',...Object.keys(J.categories)])fetch(new URL('data/'+key+'.json?v=flight-home-3',root)).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{catalog[key]=data;render();renderMap();if(key==='airports'){window.HVCalendar?.renderMonth();window.dispatchEvent(new Event('hv-airports-ready'));}}).catch(()=>{failures.add(key);render();});
  }
  document.addEventListener('click',event=>{
    const trip=event.target.closest('[data-edit-trip]');if(trip){editTrip(trip.dataset.editTrip);return;}
    const addToTrip=event.target.closest('[data-add-transport-trip]');if(addToTrip){openTransport(null,{tripId:addToTrip.dataset.addTransportTrip});return;}
    const t=event.target.closest('[data-transport-edit]');if(t){event.preventDefault();event.stopPropagation();openTransport(t.dataset.transportEdit);return;}
    if(event.target.closest('[data-close-transport]'))get('transportDialog').close();
    if(event.target.closest('[data-clear-map-country]')){selectedMapCountry='';if(get('worldMap'))delete get('worldMap').dataset.selectedCountry;renderMapSelection();updateMapColors();}
    const tab=event.target.closest('[data-country-tab]');if(tab){category=tab.dataset.countryTab;page=0;search='';renderCountry();get('countryDetails').querySelector(`[data-country-tab="${category}"]`)?.focus();}
    const next=event.target.closest('[data-place-page]');if(next){page+=Number(next.dataset.placePage);renderCountry();get('placeSearch')?.focus();}
  },true);
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.matches('[data-home-country]')){if(target.checked&&!confirm('Treat this country as home for every recorded date, including past visits? Use a dated residence instead if you only lived there for part of your history.')){target.checked=false;return;}const p=activeProfile();if(!p)return;p.homeCountryCodes=[...new Set(target.checked?[...(p.homeCountryCodes||[]),target.dataset.homeCountry]:(p.homeCountryCodes||[]).filter(c=>c!==target.dataset.homeCountry))];persist();refresh();}
    if(target.matches('[data-layer]')){state.visualLayers||={};state.visualLayers[target.dataset.layerView]={...layer(target.dataset.layerView),[target.dataset.layer]:target.checked};persist();renderCalendarExtras();renderTimeline();renderMap();}
    if(target.matches('[data-place-id], [data-place-date]')){
      const id=target.dataset.placeId||target.dataset.placeDate,row=target.closest('.place-visit-controls'),select=row.querySelector('select'),input=row.querySelector('input'),status=select.value;
      input.disabled=status!=='visited';if(status==='visited'&&!input.value)input.value=today();
      if(status==='visited'&&(!J.validDate(input.value)||input.value>today())){input.reportValidity();return;}
      state.placeVisits||=[];const old=state.placeVisits.find(v=>v.category===category&&v.itemId===id&&(!v.profileId||v.profileId===state.activeProfileId));
      const record={...old,id:old?.id||uid(),profileId:state.activeProfileId,category,itemId:id,status,date:status==='visited'?input.value:null};
      if(old)Object.assign(old,record);else state.placeVisits.push(record);
      persist();renderAchievements();
    }
  });
  window.HVJourneys={airports:()=>items('airports'),airportFor,transportLabel:t=>J.transportLabel(t,airportFor),init,render,renderCountry,openCountry,renderMap,editTrip,openTransport};
})();

/* One lazy preview surface. All record views read the existing shared travel data. */
(() => {
  'use strict';
  const E = value => String(value??'').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const collections = {country:'stays',accommodation:'accommodations',transport:'transports',note:'notes',location:'placeVisits'};
  const labels = {country:'Country visit',accommodation:'Accommodation',transport:'Transport',note:'Travel note',location:'Saved location'};
  const localToday = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const dateFormat = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const dateText = value => HVJourney.validDate(String(value||'').slice(0,10)) ? dateFormat.format(new Date(value.slice(0,10)+'T12:00:00Z')) : 'Not recorded';
  const countDays = (start,end) => HVJourney.validDate(start)&&HVJourney.validDate(end)&&end>=start ? Math.round((Date.parse(end)-Date.parse(start))/86400000) : null;
  const fact = (label,value) => value!==null && value!==undefined && value!=='' ? `<div><dt>${E(label)}</dt><dd>${E(value)}</dd></div>` : '';
  const notes = value => value ? `<div class="calendar-profile-notes">${window.HVTravelTools?.noteBody(value)||'<p>'+E(value)+'</p>'}</div>` : '';

  function index() {
    return HVData.memo(state,'calendar-entry-index',[...Object.values(collections),'trips'],state.activeProfileId,() => {
      const out={};
      for (const [kind,key] of Object.entries(collections)) out[kind]=new Map(HVJourney.scoped(Array.isArray(state[key])?state[key]:[],state.activeProfileId).map(record => [record.id,record]));
      out.trip=new Map(HVJourney.scoped(state.trips||[],state.activeProfileId).map(trip => [trip.id,trip]));
      out.byTrip=new Map();out.linkedNotes=new Map();
      for(const kind of ['country','accommodation','transport','location'])for(const item of out[kind].values()){
        if(!item.tripId)continue;
        if(!out.byTrip.has(item.tripId))out.byTrip.set(item.tripId,[]);
        out.byTrip.get(item.tripId).push({kind,item});
      }
      for(const item of out.note.values())if(item.relatedType&&item.relatedId){
        const key=item.relatedType+':'+item.relatedId;
        if(!out.linkedNotes.has(key))out.linkedNotes.set(key,[]);
        out.linkedNotes.get(key).push(item);
      }
      return out;
    });
  }
  const record = (kind,id) => index()[kind]?.get(id)||null;
  function range(kind,row,date) {
    if (kind==='country') return [row.start,row.end||localToday()];
    if (kind==='accommodation') return [row.checkIn||row.checkOut,row.checkOut||row.checkIn];
    if (kind==='transport') {const dates=HVJourney.transportDates(row);return [dates[0],dates.at(-1)];}
    return [row.date||date,row.endDate||row.date||date];
  }
  function heading(kind,title,subtitle,icon) {
    return `<header class="calendar-profile-head"><div class="calendar-profile-art" aria-hidden="true">${icon||'✧'}</div><div><p class="eyebrow">${E(labels[kind])}</p><h2 data-calendar-detail-heading tabindex="-1">${E(title)}</h2>${subtitle ? '<p>'+E(subtitle)+'</p>' : ''}</div></header>`;
  }
  function tripLine(row) {
    const trip=index().trip.get(row.tripId);
    return trip ? `<button type="button" class="calendar-profile-trip text-btn" data-calendar-open-journey="trip:${E(trip.id)}">${E(trip.name||'Linked trip')} <span aria-hidden="true">↗</span></button>` : '';
  }
  function accommodation(row) {
    const nights=countDays(row.checkIn,row.checkOut),logo=window.HVAccommodationLogos?HVData.memo(state,'calendar-preview-logo',['accommodations','savedPlaces','logoData'],row.id,()=>HVAccommodationLogos.forRecord(state,row)):null;
    const location=[HVAddress.field(row.place,'area'),HVAddress.field(row.place,'countryName')].filter(Boolean).join(', ');
    const address=HVAddress.address(row.place)||HVAddress.text(row.location);
    return heading('accommodation',row.propertyName||'Accommodation',location||HVAddress.text(row.location),logo ? `<img src="${E(logo)}" alt="" width="52" height="52">` : '⌂')+
      `<div class="calendar-profile-stay"><div><span>Check-in</span><strong>${E(dateText(row.checkIn))}</strong>${row.checkInTime ? '<small>'+E(row.checkInTime)+' local</small>' : ''}</div><span aria-hidden="true">→</span><div><span>Check-out</span><strong>${E(dateText(row.checkOut))}</strong>${row.checkOutTime ? '<small>'+E(row.checkOutTime)+' local</small>' : ''}</div></div><dl class="calendar-profile-facts">${fact('Duration',nights===null ? null : nights+' '+(nights===1?'night':'nights'))}${fact('Type',row.type||row.place?.type)}${fact('Address',address)}${fact('Time zone',row.timeZone||row.place?.timeZone)}${fact('Booking reference',row.bookingReference)}${fact('Phone',row.phone||row.place?.phone)}</dl>${tripLine(row)}${notes(row.notes)}`;
  }
  function country(row,date) {
    const end=row.end||localToday(),days=countDays(row.start,end),current=localToday();
    const phase=row.status==='cancelled' ? 'Cancelled visit' : row.start>current ? 'Upcoming visit' : !row.end||row.end>=current ? 'Ongoing visit' : 'Past visit';
    return heading('country',row.countryName||row.countryCode,phase,flagHtml(row.domesticDestination||row.countryCode,'calendar-profile-flag'))+
      `<dl class="calendar-profile-facts">${fact(row.status==='cancelled'?'Scheduled arrival':row.start>current?'Arriving':'Entered',dateText(row.start))}${fact(!row.end?'Through today':row.status==='cancelled'?'Scheduled departure':row.end<current?'Left':'Leaving',dateText(end))}${fact('Visit length',days===null?null:(days+1)+' '+(days===0?'day':'days'))}${fact('City or area',row.location)}${fact('Selected day',dateText(date))}${fact('Status',row.status==='planned'?'Planned record':row.status==='cancelled'?'Cancelled':null)}</dl>${SCHENGEN.has(row.countryCode)?`<p class="calendar-profile-rule">Schengen Area${row.schengenExempt?' · this record is marked exempt':''} <a href="#/schengen">Open existing calculator →</a></p>`:''}${window.HVVisaNotices?.detailLink(row)||''}${tripLine(row)}${notes(row.notes)}`;
  }
  // Existing trip and map consumers retain their established compact transport view.
  function legs(t){return t.type==='flight'?HVJourney.flightLegs(t):HVJourney.groundLegs(t);}
  function transport(t){const items=legs(t);return `<strong class="transport-route-heading">${HVTransportIcons.html(t.type)} ${E(HVJourneys.transportLabel(t))}</strong><div class="journey-leg-details">${items.map((l,i)=>`<div>${items.length>1?'<strong>Leg '+(i+1)+' · '+E(HVJourney.transportLabel({...l,type:t.type}))+'</strong>':''}${t.type==='flight'?`<small>${E(HVJourney.airportDetails(l.start,HVJourneys.airportFor))} → ${E(HVJourney.airportDetails(l.end,HVJourneys.airportFor))}</small>`:''}<small>${E([l.airline?.name,l.flightNumber,l.operator||t.operator,l.serviceNumber||t.serviceNumber].filter(Boolean).join(' · '))}</small><small>${E(l.startLocal?.replace('T',' ')||'Time not recorded')} → ${E(l.endLocal?.replace('T',' ')||'Time not recorded')}${(l.start?.timeZone||l.start?.timezone)?' · Departure '+E(l.start.timeZone||l.start.timezone):''}${(l.end?.timeZone||l.end?.timezone)?' · Arrival '+E(l.end.timeZone||l.end.timezone):''}</small></div>`).join('')}</div>${t.bookingReference?'<p>Booking: '+E(t.bookingReference)+'</p>':''}${t.seat?'<p>Seat: '+E(t.seat)+'</p>':''}${t.notes?'<p class="trip-notes">'+E(t.notes)+'</p>':''}${HVPrices.detail(t)}`;}
  function transportProfile(row) {
    const legs=row.type==='flight'?HVJourney.flightLegs(row):HVJourney.groundLegs(row);
    const mode=HVJourney.types[row.type]||'Transport';
    return `<div class="calendar-transport-profile mode-${E(row.type)}">${heading('transport',HVJourneys.transportLabel(row),mode,HVTransportIcons.html(row.type))}${legs.map((leg,i) => {
      const provider=leg.airline||row.airline||leg.operator||row.operator;
      const logo=window.HVOperators?.image(state,row.type,provider,row.operatorId)||'';
      const name=typeof provider==='object'?provider.name:provider;
      const startZone=HVTransportDashboardModel.zone(leg.start),endZone=HVTransportDashboardModel.zone(leg.end);
      // Duration is only calculated with known endpoint zones or explicit offsets.
      const explicit=value=>/[zZ]$|[+-]\d{2}:\d{2}$/.test(value||'');
      const reliable=(startZone||explicit(leg.startLocal))&&(endZone||explicit(leg.endLocal));
      const departure=reliable?HVTransportDashboardModel.instant(leg.startLocal,startZone):null,arrival=reliable?HVTransportDashboardModel.instant(leg.endLocal,endZone):null;
      const duration=departure!==null&&arrival!==null?(arrival-departure)/60000:null;
      const durationLabel=duration!==null&&Number.isFinite(duration)&&duration>=0 ? Math.floor(duration/60)+'h '+Math.round(duration%60)+'m' : '';
      const pointLabel=p=>row.type==='flight'?HVJourney.airportLabel(p,HVJourneys.airportFor):p?.name||'Not recorded';
      return `<section class="calendar-profile-leg">${legs.length>1?'<p class="eyebrow">LEG '+(i+1)+'</p>':''}<div class="calendar-profile-provider">${logo}<strong>${E([name,leg.flightNumber||row.flightNumber,leg.serviceNumber||row.serviceNumber].filter(Boolean).join(' · '))}</strong></div><div class="calendar-ticket-route"><div><strong>${E(pointLabel(leg.start))}</strong><span>${E(leg.startLocal?.slice(11,16)||'Time not recorded')}</span><small>${E(dateText(leg.startLocal))}</small></div><span aria-hidden="true">${HVTransportIcons.html(row.type)}</span><div><strong>${E(pointLabel(leg.end))}</strong><span>${E(leg.endLocal?.slice(11,16)||'Time not recorded')}</span><small>${E(dateText(leg.endLocal))}</small></div></div>${row.type==='flight'?'<p class="calendar-profile-airports">'+E(HVJourney.airportDetails(leg.start,HVJourneys.airportFor))+' → '+E(HVJourney.airportDetails(leg.end,HVJourneys.airportFor))+'</p>':''}<dl class="calendar-profile-facts">${fact('Duration',durationLabel)}${fact('Departure zone',startZone)}${fact('Arrival zone',endZone)}${fact('Aircraft',leg.aircraftType||row.aircraftType)}${fact('Vessel',leg.vessel||row.vessel)}</dl></section>`;
    }).join('')}<p class="calendar-section-hint">Times and dates are local to each stop.</p><dl class="calendar-profile-facts">${fact('Booking reference',row.bookingReference)}${fact('Seat',row.seat)}</dl>${tripLine(row)}${notes(row.notes)}</div>`;
  }
  function note(row) {
    return heading('note',row.title||'Note',[row.endDate&&row.endDate!==row.date?dateText(row.date)+' to '+dateText(row.endDate):dateText(row.date),row.category].filter(Boolean).join(' · '),'✎')+notes(row.body)+tripLine(row);
  }
  function location(row) {
    return heading('location',HVAddress.field(row.place,'name')||'Saved location',row.place?.type||'Recorded place','◎')+`<dl class="calendar-profile-facts">${fact('From',dateText(row.date))}${row.endDate&&row.endDate!==row.date?fact('To',dateText(row.endDate)):''}${fact('Address',HVAddress.address(row.place))}${fact('Country',row.place?.countryName)}</dl>${tripLine(row)}${notes(row.notes)}`;
  }
  function related(kind,row,date) {
    const ids=index(),[start,end]=range(kind,row,date),matches=[];
    const overlaps=(type,item)=>{const [a,b]=range(type,item,date);return a&&b&&a<=end&&b>=start;};
    const add=(type,item,label)=>{if(type===kind&&item.id===row.id)return;matches.push({type,item,label});};
    // Explicit note associations are authoritative. Trip/date neighbours are labelled separately.
    if(kind==='note'&&row.relatedType&&row.relatedId){const item=ids[row.relatedType]?.get(row.relatedId);if(item)add(row.relatedType,item,'Linked record');}
    for(const item of ids.linkedNotes.get(kind+':'+row.id)||[])add('note',item,'Linked note');
    for(const {kind:type,item} of ids.byTrip.get(row.tripId)||[]){
      if(item.status==='cancelled'||!overlaps(type,item))continue;
      if(kind==='country'&&item.place?.countryCode&&item.place.countryCode!==row.countryCode)continue;
      add(type,item,'Same trip, overlapping dates');
    }
    if(!matches.length)return '';
    const unique=[...new Map(matches.map(m=>[m.type+':'+m.item.id,m])).values()];
    return `<section class="calendar-profile-related"><h3>Connected records</h3>${unique.map(({type,item,label})=>`<button type="button" data-calendar-entry="${type}" data-calendar-entry-id="${E(item.id)}" data-calendar-context-date="${E(date)}"><strong>${E(type==='country'?item.countryName:type==='accommodation'?item.propertyName:type==='transport'?HVJourneys.transportLabel(item):type==='note'?item.title:item.place?.name||'Location')}</strong><small>${label}</small><span aria-hidden="true">›</span></button>`).join('')}</section>`;
  }
  function actions(kind,row,date) {
    const edit={country:`data-calendar-edit-stay="${E(row.id)}"`,accommodation:`data-calendar-edit-accommodation="${E(row.id)}"`,transport:`data-calendar-edit-transport="${E(row.id)}"`,note:`data-day-note-edit="${E(row.id)}"`,location:`data-place-edit="${E(row.id)}"`}[kind];
    const group=HVCalendar.groupForEntry(kind,row.id) || (row.tripId?HVCalendar.journeyGroups().find(g=>g.trip?.id===row.tripId):null);
    const suggestion=group?.trip&&!row.tripId?`<p class="calendar-section-hint">Suggested trip: ${E(group.trip.name)} (dates match). This record has no trip link.</p>`:'';
    const noteAction=kind!=='note'?`<button type="button" class="text-btn" data-calendar-related-note="${kind}" data-calendar-related-id="${E(row.id)}" data-calendar-related-date="${E(date)}">+ Linked note</button>`:'';
    return `${suggestion}<div class="calendar-profile-actions"><button type="button" class="secondary compact" ${edit}>Edit ${kind==='country'?'visit':kind==='location'?'location':kind}</button>${group?`<button type="button" class="text-btn" data-journey-map="${E(group.key)}">View journey on map ↗</button>`:kind==='location'?'<a class="text-btn" href="#/journey-map">Journey Map ↗</a>':''}${kind==='country'&&row.countryCode!=='SEA'?`<a class="text-btn" href="#/country/${E(row.countryCode)}">Country history ↗</a>`:''}${noteAction}<button type="button" class="text-btn" data-make-tentative="${kind}" data-record-id="${E(row.id)}">Make tentative</button></div>`;
  }
  function entry(kind,id,date,detailed=false) {
    const row=record(kind,id);if(!row)return '';
    const render={country,accommodation,transport:transportProfile,note,location}[kind];if(!render)return '';
    const body=render(row,date);
    return body+(detailed?((kind==='accommodation'||kind==='transport')?HVPrices.detail(row):'')+related(kind,row,date)+actions(kind,row,date):`<button type="button" class="calendar-preview-open" data-calendar-entry="${kind}" data-calendar-entry-id="${E(id)}" data-calendar-context-date="${E(date)}">Explore ${kind==='country'?'this visit':kind==='accommodation'?'this stay':kind==='transport'?'this journey':kind} <span aria-hidden="true">↗</span></button>`);
  }

  let tip=null,active=null,openTimer,closeTimer;
  const selector='#calendar [data-calendar-entry]';
  const hoverEnabled=()=>state.visualLayers?.calendar?.hoverPreviews!==false;
  function highlight(button) {
    const kind=button.dataset.calendarEntry,row=record(kind,button.dataset.calendarEntryId);if(!row)return;
    const [start,end]=range(kind,row,button.dataset.calendarContextDate);
    document.querySelectorAll('#calendar .calendar-day').forEach(day=>day.classList.toggle('calendar-linked-date',!!start&&!!end&&day.dataset.calendarDate>=start&&day.dataset.calendarDate<=end));
    document.querySelectorAll(selector).forEach(node=>node.classList.toggle('calendar-linked-entry',node.dataset.calendarEntry===kind&&node.dataset.calendarEntryId===row.id));
  }
  function hide() {
    clearTimeout(openTimer);clearTimeout(closeTimer);
    tip?.remove();tip=null;
    if(active){active.removeAttribute('aria-describedby');active=null;}
    document.querySelectorAll('.calendar-linked-date,.calendar-linked-entry').forEach(node=>node.classList.remove('calendar-linked-date','calendar-linked-entry'));
  }
  function positionPreview() {
    if(!tip||!active)return;
    const box=active.getBoundingClientRect(),rect=tip.getBoundingClientRect(),gap=10;
    let left=box.right+gap;
    if(left+rect.width>innerWidth-gap)left=box.left-rect.width-gap;
    let top=box.top;
    if(left<gap){left=box.left;top=box.bottom+gap;if(top+rect.height>innerHeight-gap)top=box.top-rect.height-gap;}
    tip.style.left=Math.max(gap,Math.min(innerWidth-rect.width-gap,left))+'px';
    tip.style.top=Math.max(gap,Math.min(innerHeight-rect.height-gap,top))+'px';
  }
  function show(button) {
    if(document.getElementById('calendarJourneyDetail')?.hidden===false){hide();return;}
    if(!button||button===active||!button.isConnected||matchMedia('(max-width:700px)').matches)return;
    hide();
    const content=entry(button.dataset.calendarEntry,button.dataset.calendarEntryId,button.dataset.calendarContextDate);
    if(!content)return;
    active=button;tip=document.createElement('section');tip.id='calendarFloatingDetail';tip.className='calendar-floating-detail';tip.setAttribute('aria-label','Travel entry preview');tip.innerHTML=content;document.body.append(tip);
    button.setAttribute('aria-describedby',tip.id);highlight(button);
    positionPreview();
    tip.addEventListener('mouseenter',()=>clearTimeout(closeTimer));tip.addEventListener('mouseleave',()=>{closeTimer=setTimeout(hide,180);});
  }
  document.addEventListener('mouseover',event=>{
    if(!hoverEnabled())return;
    const button=event.target.closest(selector);if(!button)return;
    if(!matchMedia('(hover: hover)').matches)return;
    clearTimeout(closeTimer);clearTimeout(openTimer);if(button!==active)openTimer=setTimeout(()=>{if(hoverEnabled())show(button);},120);
  });
  document.addEventListener('mouseout',event=>{
    if(!hoverEnabled())return;
    const button=event.target.closest(selector);if(!button||button.contains(event.relatedTarget))return;
    clearTimeout(openTimer);if(tip?.contains(event.relatedTarget))return;closeTimer=setTimeout(hide,180);
  });
  document.addEventListener('focusin',event=>{const button=event.target.closest(selector);if(button&&(hoverEnabled()||button.matches(':focus-visible')))show(button);else if(!tip?.contains(event.target))hide();});
  document.addEventListener('focusout',event=>{if(active?.contains(event.target)&&!tip?.contains(event.relatedTarget))closeTimer=setTimeout(hide,180);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tip){hide();event.stopImmediatePropagation();}},true);
  document.addEventListener('click',event=>{if(!tip?.contains(event.target))hide();});
  window.addEventListener('scroll',event=>{if(tip?.contains(event.target))return;if(active===document.activeElement)positionPreview();else hide();},true);
  window.addEventListener('resize',hide);window.addEventListener('hashchange',hide);window.addEventListener('hv-calendar-rendered',hide);
  window.HVCalendarDetails={transport,entry,record,range,hide};
})();

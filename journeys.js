/* Country reference pages, explicit place visits, home preferences and transport UI. */
(() => {
  'use strict';
  const root=new URL('./',document.currentScript?.src||location.href);
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const J=window.HVJourney, catalog={}, failures=new Set();
  let ready=false,category='mountains',search='',page=0,visitDate='',countryCode='',opener=null;
  const paths={flight:'m3 10 7 2 4 8 2-1-2-7 6-4-1-2-7 2-6-5-2 1 4 6-5-1Z',train:'M5 16V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10H5Zm0-6h14M8 20l2-4m6 4-2-4M8 13h1m6 0h1',bus:'M4 17V5h16v12H4Zm0-7h16M7 17v3m10-3v3M7 13h1m8 0h1',car:'m3 12 3-7h12l3 7v6H3v-6Zm0 0h18M6 18v3m12-3v3M6 15h2m8 0h2',boat:'M4 11h16l-3 7H7l-3-7Zm4 0V5h8v6M12 5V2M3 21l3-1 3 1 3-1 3 1 3-1 3 1',other:'M4 12h16m-6-6 6 6-6 6'};
  const icon=type=>`<svg class="transport-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]||paths.other}"/></svg>`;
  const items=kind=>catalog[kind]?.items||[];
  const today=()=>isoDate(new Date());
  const records=()=>J.scoped(state.transports,state.activeProfileId);
  const layer=view=>({countries:true,transport:false,...state.visualLayers?.[view]});
  function openCountry(code){if(!countryByCode(code)||code==='SEA')return;get('mapView')?.querySelector('.map-panel')?.classList.remove('map-is-fullscreen');document.body.classList.remove('map-fullscreen-open');location.hash='/country/'+code;}
  function renderCountry(){
    const host=get('countryDetails');if(!host)return;
    const code=location.hash.match(/country\/([A-Z]{2,3})/i)?.[1]?.toUpperCase();
    if(!code||!countryByCode(code)){host.innerHTML='<a href="#/countries">Back to countries</a><h2>Country not found</h2>';return;}
    if(countryCode!==code){countryCode=code;search='';page=0;}
    const c=countryByCode(code),history=staysForProfile().filter(s=>s.countryCode===code&&s.status!=='planned'&&s.start<=today()).sort((a,b)=>a.start.localeCompare(b.start));
    const days=new Set(history.flatMap(s=>datesForStay(s,null,today()))),travel=[...days].filter(d=>!J.isHome(state,code,d));
    document.title=c.name+' — Herald Voyages';if(get('pageTitle'))get('pageTitle').textContent=c.name;
    const rows=items(category).filter(r=>r.countryCodes.includes(code)&&[r.name,r.iata,r.icao,r.city].join(' ').toLowerCase().includes(search.toLowerCase()));
    page=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
    const visited=J.visits(state,category,today());
    host.innerHTML=`<a class="country-back" href="#/countries">← Countries</a><header class="country-heading">${flagHtml(code)}<div><p class="eyebrow">${E(HVAtlas.region(code))}</p><h1>${E(c.name)}</h1><p>Capital: ${E(catalog.capitals?.[code]||'Not available in the reference dataset')}</p></div></header><div class="country-facts"><div><strong>${travel.length}</strong><span>travel days</span></div><div><strong>${days.size-travel.length}</strong><span>home-only days</span></div><div><strong>${history.length}</strong><span>recorded stays</span></div><div><strong>${history[0]?E(fmt(history[0].start)):'—'}</strong><span>first recorded visit</span></div></div><nav class="country-tabs" aria-label="Country information">${Object.entries(J.categories).map(([key,label])=>`<button type="button" data-country-tab="${key}" aria-pressed="${key===category}">${E(label)}</button>`).join('')}</nav><section class="country-reference"><div class="journey-tools"><h2>${E(J.categories[category])}</h2><label class="field"><span>Search ${category==='airports'?'all airports, codes or cities':'names'}</span><input id="placeSearch" type="search" value="${E(search)}"></label><label class="field"><span>Date visited</span><input type="date" id="placeVisitDate" value="${E(visitDate||today())}" max="${today()}"></label></div><p class="helper">Mark the places you have personally visited. Country stays do not automatically mark individual places visited.${category==='airports'?' Recorded flight endpoints also count once their local date has passed. All imported airport types are included.':''}</p><div class="reference-list">${!catalog[category]?`<p role="status">${failures.has(category)?'Could not load the dataset. Check your connection and reload.':'Loading country information…'}</p>`:!items(category).length?`<p class="empty-state">${E(J.categories[category])} dataset not imported yet.${category==='airports'?' The full airport file can be imported, including small airfields and other airport types.':''}</p>`:!rows.length?'<p class="empty-state">No matching entries for this country.</p>':rows.slice(page*20,page*20+20).map(r=>{
      const explicit=(state.placeVisits||[]).some(v=>v.category===category&&v.itemId===r.id&&(!v.profileId||v.profileId===state.activeProfileId));
      const inferred=visited.has(r.id)&&!explicit;
      return `<div class="reference-row"><div><strong>${E(r.name)}</strong><p>${r.heightMeters!==undefined?E(r.heightMeters.toLocaleString())+' m':''}${r.iata?' · '+E(r.iata):''}${r.icao?' · '+E(r.icao):''}${r.city?' · '+E(r.city):''}${r.type?' · '+E(r.type):''}</p>${r.url&&/^https:\/\//.test(r.url)?`<a href="${E(r.url)}" target="_blank" rel="noopener noreferrer">Official information ↗</a>`:''}</div><label class="visit-check"><input type="checkbox" data-place-id="${E(r.id)}" ${visited.has(r.id)?'checked':''} ${inferred?'disabled':''}>${inferred?'Visited via flight':'Visited'}</label></div>`;
    }).join('')}</div>${rows.length>20?`<div class="journey-tools"><button type="button" data-place-page="-1" ${page===0?'disabled':''}>Previous</button><span>Page ${page+1} of ${Math.ceil(rows.length/20)} · ${rows.length} entries</span><button type="button" data-place-page="1" ${(page+1)*20>=rows.length?'disabled':''}>Next</button></div>`:''}${category==='unesco'?`<p><a href="https://whc.unesco.org/en/statesparties/${code.toLowerCase()}/" target="_blank" rel="noopener noreferrer">Explore this country on UNESCO ↗</a> · <a href="https://whc.unesco.org/en/list/" target="_blank" rel="noopener noreferrer">Official World Heritage List ↗</a></p>`:''}<p class="helper">${E(catalog[category]?.source||'')}</p>${['mountains','buildings'].includes(category)?'<p class="helper">Names and heights are preserved from your supplied spreadsheet; high points may be hills or other natural features.</p>':''}</section><details class="journey-accordion"><summary>Travel history · ${history.length} stays</summary><div class="reference-list">${history.map(s=>`<div class="reference-row"><span>${E(fmt(s.start))} — ${E(fmt(s.end))}</span><button type="button" class="secondary" data-action="edit-stay" data-id="${E(s.id)}">Edit stay</button></div>`).join('')||'<p>No recorded visits yet.</p>'}<button type="button" class="primary" data-atlas-add="${code}">Add trip</button></div></details><p class="helper">Capital reference: <a href="https://github.com/samayo/country-json">country-json</a>.</p>`;
    get('placeSearch').oninput=e=>{search=e.target.value;const at=e.target.selectionStart;page=0;renderCountry();get('placeSearch').focus();try{get('placeSearch').setSelectionRange(at,at);}catch{}};
    get('placeVisitDate').onchange=e=>visitDate=e.target.value;
  }
  function renderAchievements(){
    const host=get('atlasStatistics');if(!host)return;host.querySelector('#placeAchievements')?.remove();
    const panel=document.createElement('article');panel.id='placeAchievements';panel.className='panel';
    const universe=COUNTRIES.filter(c=>c.code!=='SEA'&&WIBCountryCount.isCounted(c.code)),visited=new Set(staysForProfile().filter(s=>s.status!=='planned'&&s.start<=today()).map(s=>s.countryCode));
    panel.innerHTML=`<h2>Places experienced</h2><p class="helper">Your recorded visits, counted once per place. Totals reflect imported reference data.</p><div class="achievement-grid"><div><span>Countries visited</span><strong>${universe.filter(c=>visited.has(c.code)).length} <small>/ ${universe.length}</small></strong></div>${Object.entries(J.categories).map(([key,label])=>{const ids=J.visits(state,key,today()),list=items(key);return `<div><span>${E(label)} visited</span><strong>${list.filter(r=>ids.has(r.id)).length} <small>/ ${list.length||'—'}</small></strong>${!list.length?'<small>Dataset not imported</small>':''}</div>`;}).join('')}</div>`;
    host.append(panel);
  }
  function renderYear(){
    const host=get('atlasYear');if(!host||host.hidden)return;
    const year=calendarCursor.getUTCFullYear(),show=layer('calendar');
    host.innerHTML=`<div class="year-legend"><span>● Travel</span><span class="home-legend">▧ Home</span><span>◐ Home & travel</span><span>○ Unrecorded</span></div>`+Array.from({length:12},(_,m)=>{
      const prefix=`${year}-${String(m+1).padStart(2,'0')}`;let home=0,travel=0;
      const dots=Array.from({length:new Date(year,m+1,0).getDate()},(_,d)=>{const date=prefix+'-'+String(d+1).padStart(2,'0'),status=date<=today()?J.dayStatus(state,date):'unrecorded';if(status==='home')home++;if(['travel','mixed'].includes(status))travel++;
        const transport=show.transport&&records().some(t=>t.startLocal.slice(0,10)===date||t.endLocal.slice(0,10)===date);
        return `<i class="${show.countries?status:'unrecorded'} ${transport?'has-transport':''}" title="${date}: ${show.countries?status:'countries hidden'}${transport?', transport':''}"></i>`;}).join('');
      return `<button type="button" class="atlas-month" data-atlas-month="${m}" data-atlas-year="${year}"><strong>${new Date(year,m,1).toLocaleDateString(undefined,{month:'long'})}</strong><div class="atlas-month-dots">${dots}</div><small>${show.countries?`${travel} travel · ${home} home-only days`:'Countries hidden'}</small></button>`;
    }).join('');
  }
  function renderCalendarExtras(){
    const show=layer('calendar');get('calendarView')?.classList.toggle('hide-calendar-countries',!show.countries);
    get('calendar')?.querySelectorAll('[data-calendar-date]').forEach(day=>{
      day.querySelectorAll('.calendar-transport').forEach(el=>el.remove());const date=day.dataset.calendarDate;
      day.dataset.homeStatus=date<=today()?J.dayStatus(state,date):'unrecorded';
      day.querySelectorAll('.day-stay').forEach(el=>{const s=state.stays.find(s=>s.id===el.dataset.id);if(s)el.classList.toggle('home-stay',J.isHome(state,s.countryCode,date));});
      if(show.transport)records().filter(t=>t.startLocal.slice(0,10)===date||t.endLocal.slice(0,10)===date).forEach(t=>{
        const b=document.createElement('button');b.type='button';b.className='calendar-transport';b.dataset.transportEdit=t.id;b.innerHTML=icon(t.type)+`<span>${E(t.type==='flight'?t.flightNumber:J.types[t.type]||t.type)} · ${E(t.start.name)} → ${E(t.end.name)}</span>`;b.title=`${t.startLocal} → ${t.endLocal} (each endpoint's local time)`;day.append(b);
      });
    });renderYear();renderTransportList();
  }
  function transportEndpoint(t,end){const p=t[end];return p?.airportId?({...items('airports').find(a=>a.id===p.airportId),...p}):p;}
  function renderMap(){
    const svg=get('worldMap'),viewport=svg?.querySelector('.map-viewport');if(!viewport||!window.d3||!window.HVMapProjection)return;
    viewport.querySelector('.transport-routes')?.remove();const show=layer('map');svg.classList.toggle('countries-hidden',!show.countries);if(!show.transport)return;
    const group=d3.select(viewport).append('g').attr('class','transport-routes');
    records().filter(t=>!timelineDate||t.startLocal.slice(0,10)<=timelineDate).forEach(t=>{
      const a=transportEndpoint(t,'start'),b=transportEndpoint(t,'end');if(![a?.lat,a?.lon,b?.lat,b?.lon].every(Number.isFinite))return;
      const color=J.routeColor(t.type),coords=[[a.lon,a.lat],[b.lon,b.lat]],g=group.append('g');
      g.append('path').attr('d',d3.geoPath(window.HVMapProjection)({type:'LineString',coordinates:coords})).attr('fill','none').attr('stroke',color).attr('stroke-width',2.5).attr('vector-effect','non-scaling-stroke').attr('stroke-dasharray',t.status==='planned'?'5 4':null);
      const center=window.HVMapProjection(d3.geoInterpolate(coords[0],coords[1])(.5));
      if(center){const mark=g.append('g').attr('transform',`translate(${center[0]-7},${center[1]-7}) scale(.6)`).attr('role','button').attr('tabindex',0).attr('aria-label',`${J.types[t.type]||t.type}: ${t.start.name} to ${t.end.name}`);
        mark.append('rect').attr('width',24).attr('height',24).attr('rx',3).attr('fill','var(--hv-ink, #202a30)');mark.append('path').attr('d',paths[t.type]||paths.other).attr('fill','none').attr('stroke',color).attr('stroke-width',2);
        mark.on('click',e=>{e.stopPropagation();openTransport(t.id);}).on('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();openTransport(t.id);}});
      }
    });
    const missing=records().filter(t=>!['start','end'].every(k=>{const p=transportEndpoint(t,k);return Number.isFinite(p?.lat)&&Number.isFinite(p?.lon);})).length;
    get('transportMapNote').textContent=missing?`${missing} transport record(s) need endpoint coordinates to appear on the map. Routes are shown through the selected timeline date.`:'Routes are shown through the selected timeline date.';
  }
  function renderTimeline(){
    const show=layer('map'),all=[...(show.countries?staysForProfile():[]),...(show.transport?records().map(t=>({start:t.startLocal.slice(0,10),end:t.endLocal.slice(0,10),countryName:`${J.types[t.type]||t.type}: ${t.start.name} → ${t.end.name}`,transport:t})):[])];
    get('timelineEmpty').classList.toggle('hidden',all.length>0);get('timelineContent').classList.toggle('hidden',!all.length);if(!all.length)return;
    const dates=all.flatMap(r=>[r.start,r.end]).concat(today()).sort(),min=dates[0],max=dates.at(-1),total=Math.max(1,diffDays(min,max));
    els.timelineSlider.dataset.start=min;els.timelineSlider.max=total;timelineDate=timelineDate&&timelineDate>=min&&timelineDate<=max?timelineDate:today();els.timelineSlider.value=diffDays(min,timelineDate);
    els.timelineStartLabel.textContent=fmt(min);els.timelineEndLabel.textContent=fmt(max);
    els.timelineBars.innerHTML=all.map((r,i)=>{const a=r.start<r.end?r.start:r.end,b=r.start>r.end?r.start:r.end;return `<div class="timeline-bar ${r.transport?'transport-bar':''}" style="left:${diffDays(min,a)/total*100}%;width:${Math.max(.35,(diffDays(a,b)+1)/(total+1)*100)}%;top:${i%3*21+7}px;${r.transport?'background:'+J.routeColor(r.transport.type):''}" title="${E(r.countryName)}: ${a} — ${b}"></div>`;}).join('');
    const input=get('timelineManualDate');input.min=min;input.max=max;input.value=timelineDate;updateTimelineLabels();renderMap();
  }
  function renderTransportList(){
    const host=get('transportRecords');if(!host)return;const term=get('transportSearch')?.value.toLowerCase()||'';
    const list=records().filter(t=>[t.start.name,t.end.name,t.flightNumber,J.types[t.type]].join(' ').toLowerCase().includes(term)).sort((a,b)=>b.startLocal.localeCompare(a.startLocal));
    host.innerHTML=list.length?list.map(t=>`<div class="transport-record">${icon(t.type)}<div><strong>${E(t.start.name)} → ${E(t.end.name)}</strong><p>${E(J.types[t.type]||t.type)}${t.flightNumber?' '+E(t.flightNumber):''} · ${E(t.status||'actual')}</p><small>${E(t.startLocal.replace('T',' '))} → ${E(t.endLocal.replace('T',' '))} · local times at each endpoint</small></div><button class="secondary" type="button" data-transport-edit="${E(t.id)}">Edit</button></div>`).join(''):'<p class="empty-state">No matching transport records. Add a flight, train or other journey.</p>';
  }
  function openTransport(id){
    const t=state.transports?.find(t=>t.id===id),dialog=get('transportDialog');opener=document.activeElement;
    const form=get('transportForm');form.reset();form.dataset.id=id||'';
    form.elements.type.value=t?.type||'flight';form.elements.status.value=t?.status||'actual';
    for(const key of ['startLocal','endLocal','flightNumber','bookingReference'])form.elements[key].value=t?.[key]||(['startLocal','endLocal'].includes(key)?today()+'T12:00':'');
    for(const key of ['start','end'])for(const field of ['name','terminal','lat','lon'])form.elements[key+field].value=t?.[key]?.[field]??'';
    get('transportDelete').hidden=!t;get('transportError').textContent='';get('transportDialogTitle').textContent=t?'Edit transport':'Add transport';updateTransportFields();dialog.showModal();form.elements.type.focus();
  }
  function updateTransportFields(){
    const form=get('transportForm'),flight=form.elements.type.value==='flight';get('flightNumberField').hidden=!flight;form.elements.flightNumber.required=flight;
    for(const end of ['start','end']){
      get(end+'PlaceLabel').textContent=(end==='start'?'Departure':'Arrival')+(flight?' airport':' city / place');
      form.elements[end+'name'].setAttribute('list',flight?'airportOptions':'');
      form.elements[end+'name'].placeholder=flight?'Airport name or code':'City or place';
    }
  }
  function airportFor(value){const key=value.trim().toLowerCase();return items('airports').find(a=>[a.name,a.iata,a.icao,`${a.name} (${a.iata||a.icao||a.id})`].some(x=>x?.toLowerCase()===key));}
  function saveTransport(event){
    event.preventDefault();const form=event.currentTarget,f=form.elements,old=state.transports?.find(t=>t.id===form.dataset.id);
    const t={...old,id:old?.id||uid(),profileId:old?.profileId??state.activeProfileId,type:f.type.value,status:f.status.value};
    for(const key of ['startLocal','endLocal','flightNumber','bookingReference'])t[key]=f[key].value.trim();
    if(t.type!=='flight')delete t.flightNumber;
    for(const end of ['start','end']){
      const name=f[end+'name'].value.trim(),a=t.type==='flight'?airportFor(name):null;
      t[end]={name,terminal:f[end+'terminal'].value.trim(),lat:f[end+'lat'].value===''?(a?.lat??null):Number(f[end+'lat'].value),lon:f[end+'lon'].value===''?(a?.lon??null):Number(f[end+'lon'].value)};
      if(a){t[end].airportId=a.id;if(a.timezone)t[end].timezone=a.timezone;}
    }
    const error=J.validateTransport(t);if(error){get('transportError').textContent=error;return;}
    state.transports||=[];if(old)state.transports[state.transports.indexOf(old)]=t;else state.transports.push(t);
    persist();get('transportDialog').close();refresh();
  }
  function refresh(){renderAll();render();renderCalendarExtras();renderTimeline();}
  function render(){if(!ready)return;renderAchievements();renderYear();renderTransportList();if(document.body.dataset.currentView==='country'||location.hash.includes('/country/'))renderCountry();renderHomeSummary();}
  function renderHomeSummary(){const host=get('homeCountriesSummary');if(host)host.textContent=(activeProfile()?.homeCountryCodes||[]).map(c=>countryByCode(c)?.name||c).join(' · ')||'No permanent home countries selected. Dated residence periods still apply.';}
  function installHome(){
    const panel=document.createElement('article');panel.className='panel';panel.innerHTML='<h2>Home countries</h2><p class="helper">Applies to the current traveller. These countries count as home for all recorded dates; use Lived In for dated home periods. On a day with both home and travel, the day counts once as travel. This preference does not alter Schengen calculations.</p><p id="homeCountriesSummary"></p><details class="journey-accordion"><summary>Choose home countries</summary><label class="field"><span>Search countries</span><input type="search" id="homeCountrySearch"></label><div id="homeCountryChoices" class="home-country-choices"></div></details>';
    get('homesView').prepend(panel);
    function choices(){const term=get('homeCountrySearch').value.toLowerCase();get('homeCountryChoices').innerHTML=COUNTRIES.filter(c=>c.code!=='SEA'&&c.name.toLowerCase().includes(term)).map(c=>`<label><input type="checkbox" data-home-country="${c.code}" ${(activeProfile()?.homeCountryCodes||[]).includes(c.code)?'checked':''}>${flagHtml(c.code)} ${E(c.name)}</label>`).join('');}
    get('homeCountrySearch').oninput=choices;panel.querySelector('details').addEventListener('toggle',choices);choices();renderHomeSummary();
    const link=document.createElement('a');link.href='#/lived-in';link.className='secondary';link.textContent='Set home countries';get('calendarView').prepend(link);
  }
  function installLayers(view){
    const field=document.createElement('fieldset');field.className='journey-layers';field.innerHTML=`<legend>Show</legend>${['countries','transport'].map(key=>`<label><input type="checkbox" data-layer-view="${view}" data-layer="${key}" ${layer(view)[key]?'checked':''}> ${key==='countries'?'Countries':'Transport'}</label>`).join('')}`;
    if(view==='map')get('mapView').querySelector('.map-panel').prepend(field);else get('calendarView').prepend(field);
  }
  function init(){
    if(ready)return;ready=true;
    const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('journeys.css?v=journeys-1',root);document.head.append(style);
    const countries=get('countriesView'),directory=countries.querySelector('.atlas-directory');
    for(const [node,label,open] of [[directory,'Country Directory',true],[get('countryTotals')?.closest('.panel'),'Time Spent by Country / Location',false]]){
      if(!node)continue;const accordion=document.createElement('details');accordion.className='journey-accordion';accordion.open=open;const summary=document.createElement('summary');summary.textContent=label;node.before(accordion);accordion.append(summary,node);
    }
    installHome();installLayers('map');installLayers('calendar');
    const dateLabel=document.createElement('label');dateLabel.className='field timeline-manual';dateLabel.innerHTML='<span>Go to date</span><input type="date" id="timelineManualDate">';els.timelineSlider.before(dateLabel);
    get('timelineManualDate').onchange=e=>{if(J.validDate(e.target.value))setTimelineDate(e.target.value);};
    const note=document.createElement('p');note.id='transportMapNote';note.className='helper';get('mapView').querySelector('.map-panel').append(note);
    const transport=document.createElement('details');transport.className='journey-accordion';transport.innerHTML='<summary>Transport journeys</summary><label class="field"><span>Search journeys</span><input type="search" id="transportSearch"></label><div id="transportRecords"></div>';
    get('calendarView').append(transport);get('transportSearch').oninput=renderTransportList;
    const add=document.createElement('button');add.type='button';add.className='primary';add.id='addTransportBtn';add.textContent='+ Add Transport';add.onclick=()=>openTransport();get('calendarView').prepend(add);
    const dialog=document.createElement('dialog');dialog.id='transportDialog';dialog.className='transport-dialog';dialog.setAttribute('aria-labelledby','transportDialogTitle');
    dialog.innerHTML=`<form id="transportForm"><div class="journey-tools"><h2 id="transportDialogTitle">Add transport</h2><button type="button" data-close-transport aria-label="Close transport form">Close</button></div><div class="transport-form-grid"><label class="field"><span>Transport type</span><select name="type">${Object.entries(J.types).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="field"><span>Status</span><select name="status"><option value="actual">Actual</option><option value="planned">Planned</option></select></label></div><p class="helper">Use the local clock at each endpoint. Departure and arrival may use different time zones; these values are saved exactly as entered.</p><div class="transport-form-grid">${['start','end'].map(end=>`<fieldset><legend>${end==='start'?'Departure':'Arrival'}</legend><label class="field"><span>Local date and time</span><input type="datetime-local" name="${end}Local" required></label><label class="field"><span id="${end}PlaceLabel">Place</span><input name="${end}name" maxlength="200" required autocomplete="off"></label><label class="field"><span>Station / terminal / port (optional)</span><input name="${end}terminal" maxlength="200"></label><details><summary>Map coordinates (optional)</summary><p class="helper">Filled from the airport dataset when available. Add coordinates to draw other routes.</p><label class="field"><span>Latitude</span><input type="number" step="any" min="-90" max="90" name="${end}lat"></label><label class="field"><span>Longitude</span><input type="number" step="any" min="-180" max="180" name="${end}lon"></label></details></fieldset>`).join('')}</div><datalist id="airportOptions"></datalist><div class="transport-form-grid"><label class="field" id="flightNumberField"><span>Flight number</span><input name="flightNumber" maxlength="30"></label><label class="field"><span>Booking reference (optional)</span><input name="bookingReference" maxlength="100" autocomplete="off"></label></div><p id="transportError" role="alert"></p><div class="journey-tools"><button class="primary" type="submit">Save transport</button><button type="button" class="secondary" data-close-transport>Cancel</button><button type="button" id="transportDelete" class="danger">Delete transport</button></div></form>`;
    document.body.append(dialog);dialog.addEventListener('close',()=>{opener?.focus?.();});get('transportForm').onsubmit=saveTransport;get('transportForm').elements.type.onchange=updateTransportFields;
    for(const side of ['start','end'])get('transportForm').elements[side+'name'].oninput=e=>{const term=e.target.value.toLowerCase();get('transportForm').elements[side+'lat'].value='';get('transportForm').elements[side+'lon'].value='';get('airportOptions').innerHTML=term.length<2?'':items('airports').filter(a=>[a.name,a.iata,a.icao,a.city].join(' ').toLowerCase().includes(term)).slice(0,40).map(a=>`<option value="${E(a.name+' ('+(a.iata||a.icao||a.id)+')')}">${E(a.city||'')}</option>`).join('');};
    get('transportDelete').onclick=()=>{if(!confirm('Delete this transport journey?'))return;state.transports=state.transports.filter(t=>t.id!==get('transportForm').dataset.id);persist();dialog.close();refresh();};
    const calendar=window.renderCalendar;window.renderCalendar=function(){calendar();renderCalendarExtras();};
    const timeline=window.renderMapTimeline;window.renderMapTimeline=function(){timeline();renderTimeline();};
    const labels=window.updateTimelineLabels;window.updateTimelineLabels=function(){labels();if(get('timelineManualDate'))get('timelineManualDate').value=timelineDate||'';const show=layer('map');if(!show.countries)els.timelineLocationLabel.textContent='Countries hidden';if(show.transport&&timelineDate){const on=records().filter(t=>t.startLocal.slice(0,10)===timelineDate||t.endLocal.slice(0,10)===timelineDate);if(on.length)els.timelineLocationLabel.textContent+=(show.countries?' · ':' · ')+on.map(t=>`${J.types[t.type]||t.type}: ${t.start.name} → ${t.end.name}`).join(' · ');}};
    window.setTimelineDate=function(value){if(!J.validDate(value)||!els.timelineSlider.dataset.start)return;els.timelineSlider.value=Math.max(0,Math.min(Number(els.timelineSlider.max),diffDays(els.timelineSlider.dataset.start,value)));setTimelineFromSlider();};
    const colors=window.updateMapColors;window.updateMapColors=function(){colors();renderMap();};
    window.addEventListener('hv-route',()=>{render();renderCalendarExtras();for(const view of ['map','calendar'])get(view+'View')?.querySelectorAll('[data-layer]').forEach(input=>input.checked=layer(view)[input.dataset.layer]);});
    refresh();
    for(const key of ['capitals',...Object.keys(J.categories)])fetch(new URL('data/'+key+'.json?v=journeys-1',root)).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{catalog[key]=data;render();renderMap();}).catch(()=>{failures.add(key);render();});
  }
  document.addEventListener('click',event=>{
    const t=event.target.closest('[data-transport-edit]');if(t){event.preventDefault();event.stopPropagation();openTransport(t.dataset.transportEdit);return;}
    if(event.target.closest('[data-close-transport]'))get('transportDialog').close();
    const tab=event.target.closest('[data-country-tab]');if(tab){category=tab.dataset.countryTab;page=0;search='';renderCountry();get('countryDetails').querySelector(`[data-country-tab="${category}"]`)?.focus();}
    const next=event.target.closest('[data-place-page]');if(next){page+=Number(next.dataset.placePage);renderCountry();get('placeSearch')?.focus();}
  },true);
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.matches('[data-home-country]')){const p=activeProfile();if(!p)return;p.homeCountryCodes=[...new Set(target.checked?[...(p.homeCountryCodes||[]),target.dataset.homeCountry]:(p.homeCountryCodes||[]).filter(c=>c!==target.dataset.homeCountry))];persist();refresh();}
    if(target.matches('[data-layer]')){state.visualLayers||={};state.visualLayers[target.dataset.layerView]={...layer(target.dataset.layerView),[target.dataset.layer]:target.checked};persist();renderCalendarExtras();renderTimeline();renderMap();if(!layer('map').transport)get('transportMapNote').textContent='';}
    if(target.matches('[data-place-id]')){
      const date=visitDate||today();if(!J.validDate(date)||date>today()){target.checked=false;get('placeVisitDate').reportValidity();return;}
      state.placeVisits||=[];const id=target.dataset.placeId;
      if(target.checked)state.placeVisits.push({id:uid(),profileId:state.activeProfileId,category,itemId:id,date});
      else state.placeVisits=state.placeVisits.filter(v=>!(v.category===category&&v.itemId===id&&(!v.profileId||v.profileId===state.activeProfileId)));
      persist();renderAchievements();renderCountry();get('countryDetails').querySelector(`[data-place-id="${CSS.escape(id)}"]`)?.focus();
    }
  });
  window.HVJourneys={init,render,renderCountry,openCountry,renderMap};
})();

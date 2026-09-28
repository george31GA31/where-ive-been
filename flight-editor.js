/* Flight legs extend one transport record; legacy endpoints and via remain compatible. */
(() => {
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let airlines=[],airlineLoad;
  function loadAirlines(){return airlineLoad ||= fetch('data/airlines.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>airlines=r).catch(()=>{airlineLoad=null;return [];});}
  function toggle(form,flight){
    let host=form.querySelector('.flight-legs');
    if(!host){host=document.createElement('section');host.className='flight-legs';form.querySelector('.transport-basics').after(host);}
    if(!form._flightInitialised){form._legs=HVJourney.flightLegs(form._flightRecord||{});form._flightInitialised=true;render(form);}
    host.hidden=!flight;
    for(const key of ['startLocal','endLocal','startname','endname']){const input=form.elements[key];input.closest('fieldset').hidden=flight;input.disabled=flight;}
    for(const key of ['flightNumber','vianame']){form.elements[key].disabled=flight;}
    host.querySelectorAll('input,button').forEach(input=>{input.disabled=!flight;});host.querySelector('[data-leg-up="0"]')?.setAttribute('disabled','');host.querySelector(`[data-leg-down="${form._legs.length-1}"]`)?.setAttribute('disabled','');if(form._legs.length===1)host.querySelector('[data-leg-remove]')?.setAttribute('disabled','');
    // The previous connection control is retained in the DOM for older integrations only.
    queueMicrotask(()=>{form.querySelector('#flightViaFields').hidden=true;form.querySelector('#flightNumberField').hidden=true;});
    if(flight)loadAirlines();
  }
  function airportChoices(form){
    const personal=HVJourney.scoped(state.transports,state.activeProfileId).filter(t=>t.type==='flight').flatMap(t=>HVJourney.flightLegs(t).flatMap(l=>[l.start,l.end])).concat(form._legs.flatMap(l=>[l.start,l.end])).filter(p=>p?.manualAirport);
    return [...new Map([...HVJourneys.airports(),...personal].map(p=>[p.airportId||p.id,p])).values()];
  }
  function manualAirport(form,index,side){
    const previous=form._legs[index][side]||{},opener=document.activeElement;let position=Number.isFinite(previous.lat)&&Number.isFinite(previous.lon)?{...previous}:null;
    const dialog=document.createElement('dialog');dialog.className='place-search-dialog manual-airport-dialog';dialog.setAttribute('aria-label','Manual airport');
    dialog.innerHTML=`<form class="place-search-form"><div class="place-search-heading"><h3>Manual airport</h3><button class="text-btn" type="button" data-airport-cancel>Close ×</button></div><p class="helper">Add an airport missing from search. Use its assigned codes if known. This saves it with your flight and makes it available in your airport search.</p><label class="field"><span>Airport name</span><input type="text" name="airportName" value="${E(previous.name)}" maxlength="200" required></label><div class="form-grid"><label class="field"><span>IATA code <em>optional</em></span><input type="text" name="iata" value="${E(previous.iata)}" maxlength="3" pattern="[A-Za-z]{3}" placeholder="Three letters" autocapitalize="characters"></label><label class="field"><span>ICAO code <em>optional</em></span><input type="text" name="icao" value="${E(previous.icao)}" maxlength="4" pattern="[A-Za-z0-9]{4}" placeholder="Four characters" autocapitalize="characters"></label></div><label class="field"><span>City or region</span><input type="text" name="city" value="${E(previous.city||previous.area)}" maxlength="160"></label><label class="field"><span>Country</span><input type="text" name="country" list="countryList" value="${E(previous.countryName||countryByCode(previous.countryCode||previous.countryCodes?.[0])?.name)}" required></label><button type="button" class="secondary" data-airport-pin>Find or plot airport on map</button><p class="helper" data-airport-position role="status">${position?'Map position saved.':'No map position yet. Add a pin to show the airport on Journey Map.'}</p><p class="form-error" role="alert"></p><button type="submit" class="primary">Use this airport</button></form>`;
    document.body.append(dialog);const fields=dialog.querySelector('form').elements;
    dialog.querySelector('[data-airport-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-airport-pin]').onclick=()=>HVPlaces.open({airport:true,place:position?{...position,name:fields.airportName.value||position.name}:null,searchArea:[fields.city.value,fields.country.value].filter(Boolean).join(', '),onSelect:p=>{position=p;if(!fields.airportName.value.trim())fields.airportName.value=p.name;if(!fields.city.value.trim())fields.city.value=p.area||'';fields.country.value=p.countryName;dialog.querySelector('[data-airport-position]').textContent='Map position saved. You can adjust it before using this airport.';}});
    dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const country=countryByName(fields.country.value),error=dialog.querySelector('[role=alert]');if(!country||country.code==='SEA'){error.textContent='Choose the airport country from the list.';return;}
      const id=previous.manualAirport?previous.airportId||previous.id:'manual-airport:'+uid();
      form._legs[index][side]={...previous,id,airportId:id,manualAirport:true,name:fields.airportName.value.trim(),iata:fields.iata.value.trim().toUpperCase(),icao:fields.icao.value.trim().toUpperCase(),city:fields.city.value.trim(),countryCode:country.code,countryCodes:[country.code],countryName:country.name,lat:position?.lat??null,lon:position?.lon??null};
      dialog.close();render(form,index);
    };
    dialog.addEventListener('close',()=>{dialog.remove();opener?.focus?.();});dialog.showModal();fields.airportName.focus();
  }
  function render(form,focusIndex){
    const host=form.querySelector('.flight-legs');
    host.innerHTML=`<p class="helper">Add flights in travel order. Every leg has its own airline, flight number and local times. Connecting airports do not add countries visited.</p>${form._flightRecord?.flightNumber&&form._legs.length>1&&!form._legs.some(l=>l.flightNumber)?`<p class="helper">Previous flight number: <strong>${E(form._flightRecord.flightNumber)}</strong>. Check which leg this belongs to.</p>`:''}<div class="flight-leg-list">${form._legs.map((leg,i)=>`<fieldset class="flight-leg" data-leg="${i}"><legend>Leg ${i+1}</legend><div class="flight-leg-actions"><button type="button" data-leg-up="${i}" ${i===0?'disabled':''} aria-label="Move leg ${i+1} earlier">↑</button><button type="button" data-leg-down="${i}" ${i===form._legs.length-1?'disabled':''} aria-label="Move leg ${i+1} later">↓</button><button type="button" data-leg-remove="${i}" ${form._legs.length===1?'disabled':''}>Remove leg</button></div><div class="flight-fields">${['start','end'].map(side=>`<div><label class="field"><span>${side==='start'?'Departure':'Arrival'} airport</span><input data-leg-field="${side}" value="${E(leg[side]?.name)}" autocomplete="off" required placeholder="Airport, city, IATA or ICAO" aria-label="Leg ${i+1} ${side==='start'?'departure':'arrival'} airport"></label><div class="flight-search-results" data-results="${side}"></div><button type="button" class="text-btn" data-manual-airport="${side}" data-airport-leg="${i}">${leg[side]?.manualAirport?'Edit manual airport':'Airport missing? Add manually'}</button><details><summary>Terminal <em>optional</em></summary><input data-leg-field="${side}Terminal" value="${E(leg[side]?.terminal)}" maxlength="200" aria-label="Leg ${i+1} ${side==='start'?'departure':'arrival'} terminal"></details><label class="field"><span>${side==='start'?'Departure':'Arrival'} local date and time</span><input type="datetime-local" data-leg-field="${side}Local" value="${E(leg[side+'Local'])}" required></label></div>`).join('')}<div><label class="field"><span>Airline</span><input data-leg-field="airline" autocomplete="off" value="${E(leg.airline?.name)}" placeholder="Name, IATA or ICAO code"></label><div class="flight-search-results" data-results="airline"></div></div><label class="field"><span>Flight number</span><input data-leg-field="flightNumber" maxlength="30" value="${E(leg.flightNumber)}" placeholder="e.g. LX2279"></label></div></fieldset>`).join('')}</div><button type="button" class="secondary" data-leg-add>+ Add flight leg</button><p class="helper">Airline directory: OpenFlights (ODbL). If an airline is missing, enter its name. Logos are omitted when no reliable source is available.</p>`;
    host.oninput=event=>{
      const input=event.target,field=input.dataset.legField,row=input.closest('[data-leg]');if(!field||!row)return;
      const leg=form._legs[Number(row.dataset.leg)],term=norm(input.value.trim());
      if(field.endsWith('Terminal')){const side=field.replace('Terminal','');leg[side]={...leg[side],terminal:input.value};return;}
      if(!['start','end','airline'].includes(field)){leg[field]=input.value;return;}
      // Typing a new name clears stale coordinates and codes, never reuses the previous airport.
      leg[field]=field==='airline'?{name:input.value}:{name:input.value,lat:null,lon:null};
      const results=row.querySelector(`[data-results="${field}"]`);results.replaceChildren();if(term.length<2)return;
      const source=field==='airline'?airlines:airportChoices(form);
      const matches=source.filter(a=>[a.name,a.iata,a.icao,a.city].some(v=>norm(v).includes(term))).sort((a,b)=>Number([b.iata,b.icao].some(v=>norm(v)===term))-Number([a.iata,a.icao].some(v=>norm(v)===term))||Number(norm(b.name).startsWith(term))-Number(norm(a.name).startsWith(term))).slice(0,15);
      results.innerHTML=matches.map((a,j)=>`<button type="button" data-choice="${j}">${a.countryCodes?.[0]?flagHtml(a.countryCodes[0],'flag-img flag-sm'):''}<span><strong>${E(a.name)}</strong><small>${E([a.iata,a.icao,a.city,a.country||countryByCode(a.countryCodes?.[0])?.name].filter(Boolean).join(' · '))}</small></span><span aria-hidden="true">→</span></button>`).join('')||`<p class="helper" role="status">${source.length?'No match. You can enter the name manually.':'Directory loading or unavailable. You can enter the name manually.'}</p>`;
      results.onclick=e=>{const button=e.target.closest('[data-choice]');if(!button)return;const a=matches[Number(button.dataset.choice)];leg[field]={...a,...(field==='airline'?{}:{airportId:a.id,countryCode:a.countryCodes?.[0],countryName:countryByCode(a.countryCodes?.[0])?.name||''})};input.value=a.name;results.replaceChildren();input.focus();};
    };
    host.onkeydown=e=>{const input=e.target;if(input.matches('input[data-leg-field]')&&e.key==='ArrowDown'){const results=input.closest('[data-leg]').querySelector(`[data-results="${input.dataset.legField}"]`);if(results?.querySelector('button')){e.preventDefault();results.querySelector('button').focus();}}if(e.key==='Escape'){input.closest('.flight-search-results')?.replaceChildren();}};
    host.onclick=e=>{
      const b=e.target.closest('button');if(!b||b.hasAttribute('data-choice'))return;
      if(b.dataset.manualAirport){manualAirport(form,Number(b.dataset.airportLeg),b.dataset.manualAirport);return;}
      if(b.hasAttribute('data-leg-add')){const previous=form._legs.at(-1);form._legs.push({id:uid(),start:{...previous.end},end:{},startLocal:previous.endLocal||'',endLocal:'',airline:null,flightNumber:''});render(form,form._legs.length-1);return;}
      for(const [attr,delta] of [['legUp',-1],['legDown',1]])if(b.dataset[attr]!==undefined){const i=Number(b.dataset[attr]),j=i+delta;if(j<0||j>=form._legs.length)return;[form._legs[i],form._legs[j]]=[form._legs[j],form._legs[i]];render(form,j);return;}
      if(b.dataset.legRemove!==undefined&&form._legs.length>1){const i=Number(b.dataset.legRemove);form._legs.splice(i,1);render(form,Math.min(i,form._legs.length-1));}
    };
    if(focusIndex!==undefined)host.querySelector(`[data-leg="${focusIndex}"] input`)?.focus();
  }
  function save(form){
    const old=state.transports?.find(t=>t.id===form.dataset.id),f=form.elements,error=document.getElementById('transportError');
    const legs=form._legs.map(l=>({...l,id:l.id||uid()}));
    for(let i=0;i<legs.length;i++){
      const message=HVJourney.validateTransport({...legs[i],type:'flight'});if(message){error.textContent=`Leg ${i+1}: ${message}`;return;}
    }
    const first=legs[0],last=legs.at(-1),dates=legs.flatMap(l=>[l.startLocal.slice(0,10),l.endLocal.slice(0,10)]).sort();
    const record={...old,id:old?.id||uid(),profileId:old?.profileId??state.activeProfileId,type:'flight',status:f.status.value,tripId:old?.tripId||f.tripId.value||HVJourney.tripForDates(state,dates[0],dates.at(-1)),legs,start:{...first.start},end:{...last.end},startLocal:first.startLocal,endLocal:last.endLocal,via:legs.slice(0,-1).map(l=>({...l.end})),bookingReference:f.bookingReference.value.trim()};
    // Do not discard an old shared flight number; per-leg values take precedence in the UI.
    if(legs.length===1)record.flightNumber=first.flightNumber;
    if(typeof form._flightRecord?.onSave==='function'){form._flightRecord.onSave(record);document.getElementById('transportDialog').close();return;}
    state.transports||=[];if(old)state.transports[state.transports.indexOf(old)]=record;else state.transports.push(record);
    updatePassedPlannedTrips();persist();document.getElementById('transportDialog').close();renderAll();HVJourneys.render();HVCalendar.renderMonth();
  }
  window.HVFlights={toggle,save};
})();

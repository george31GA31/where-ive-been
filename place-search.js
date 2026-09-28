/* Dated places: search and map selection never create country stays or travel days. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id)||window.HVPages?.get(id);
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache=new Map();
  let dialog;
  const types=['Hotel','Hostel','Resort','Guest house','Holiday apartment','Airbnb','Campsite','Private accommodation','Other location'];
  function normalise(feature){
    const p=feature.properties||{},[lon,lat]=feature.geometry?.coordinates||[];
    const countryCode=(p.countrycode||'').toUpperCase(),area=p.city||p.town||p.county||p.state||'';
    return {id:`osm:${p.osm_type}:${p.osm_id}`,name:p.name||p.street||area||'Unnamed place',type:p.osm_value||'place',countryCode,countryName:countryByCode(countryCode)?.name||p.country||'',area,address:[p.housenumber,p.street,p.postcode,area,p.state,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),lat,lon};
  }
  function open(prefill={}){
    if(dialog?.open)dialog.close();
    const old=(state.placeVisits||[]).find(v=>v.id===prefill.recordId&&v.category==='locations');
    const oldAccommodation=(state.accommodations||[]).find(a=>a.id===prefill.accommodationId);
    const accommodation=!!(prefill.accommodation||oldAccommodation),date=old?.date||oldAccommodation?.checkIn||prefill.date||isoDate(new Date()),end=old?.endDate||old?.date||oldAccommodation?.checkOut||prefill.end||date;
    let selected=old?.place?{...old.place}:oldAccommodation?.place?{...oldAccommodation.place}:prefill.place?{...prefill.place}:null,results=[],shown=10,timer,controller,request=0,map,marker,manual=false;
    const opener=document.activeElement;
    dialog=document.createElement('dialog');const ownDialog=dialog;
    dialog.className='place-search-dialog';dialog.setAttribute('aria-label',accommodation?'Accommodation':'Add a location');
    dialog.innerHTML=`<form class="place-search-form"><div class="place-search-heading"><div><p class="eyebrow">${accommodation?'ACCOMMODATION':'SPECIFIC PLACES'}</p><h3>${old||oldAccommodation?'Edit':'Add'} ${accommodation?'accommodation':'a location'}</h3></div><button type="button" class="text-btn" data-place-close aria-label="Close place editor">Close ×</button></div>
      <label class="field"><span>Search a hotel, place or area</span><input type="search" name="query" autocomplete="off" placeholder="Hotel name, city or address" aria-controls="placeResults" aria-describedby="placeSearchStatus"></label>
      <label class="field"><span>Search near <em>optional city or country</em></span><input type="text" name="searchArea" placeholder="e.g. Algiers, Algeria" autocomplete="off"></label><p id="placeSearchStatus" class="helper" role="status">Type at least three characters to search.</p><div id="placeResults" class="place-search-results" aria-label="Matching places"></div>
      <button type="button" class="secondary compact" data-place-more hidden>Load more results</button>${accommodation?'<button type="button" class="text-btn" data-place-wider>Search wider accommodation listings</button>':''}<button type="button" class="secondary" data-place-plot>Plot on map</button>
      <div class="place-pin-editor" hidden><p class="helper">Search for an area above, then tap the exact position or drag the pin. With a keyboard, pan the map using arrow keys and choose its centre, or focus the pin and use arrow keys to move it.</p><div class="place-pin-map" aria-label="Choose a location on the map"></div><button type="button" class="secondary compact" data-pin-centre>Place pin at map centre</button><p class="helper" data-pin-status role="status">Choose a position.</p></div>
      <div class="place-selected" hidden></div>
      <div class="form-grid"><label class="field"><span>Place name</span><input type="text" name="placeName" maxlength="160" required></label><label class="field"><span>Place type</span><select name="placeType">${types.map(t=>`<option>${t}</option>`).join('')}</select></label></div>
      <label class="field"><span>Country <em>filled by search; confirm for a manual pin</em></span><input type="text" name="country" list="countryList" autocomplete="off" required></label>
      <div class="form-grid"><label class="field"><span>${accommodation?'Check-in':'From'}</span><input name="date" type="date" value="${E(date)}" required></label><label class="field"><span>${accommodation?'Check-out':'To'}</span><input name="endDate" type="date" value="${E(end)}" required></label></div>
      <p class="form-error" data-place-error role="alert"></p><div class="place-form-actions">${old||oldAccommodation?'<button class="danger-link" type="button" data-place-remove>Remove this entry</button>':''}<button class="primary" type="submit">Save ${accommodation?'accommodation':'location'}</button></div><small>Global place search by Photon / OpenStreetMap · Wider accommodation search by Overpass · © OpenStreetMap contributors</small></form>`;
    document.body.append(dialog);
    const form=dialog.querySelector('form'),f=form.elements,host=form.querySelector('.place-search-results'),status=form.querySelector('#placeSearchStatus'),error=form.querySelector('[data-place-error]');
    f.placeType.value=accommodation?'Hotel':'Other location';
    const context=HVJourney.scoped(state.stays,state.activeProfileId).find(s=>s.start<=date&&s.end>=date&&s.status!=='cancelled');f.searchArea.value=prefill.searchArea||context?.location||context?.countryName||'';
    if(prefill.onSelect){form.querySelector('[type=submit]').textContent='Use this location';form.querySelectorAll('input[type=date]').forEach(input=>{input.required=false;input.closest('.form-grid').hidden=true;});}
    function showSelected(fill=true){
      const box=form.querySelector('.place-selected');box.hidden=!selected;
      if(!selected)return;
      box.innerHTML=`${selected.countryCode?flagHtml(selected.countryCode,'flag-img flag-sm'):''}<strong>${E(selected.name)}</strong><span>${E(selected.address||selected.area||'Position selected on map')}</span>`;
      if(fill){f.placeName.value=selected.name;f.country.value=countryByCode(selected.countryCode)?.name||selected.countryName||'';if(types.includes(selected.type))f.placeType.value=selected.type;}
    }
    function placePin(latlng){
      if(!map)return;
      const lat=Math.max(-85,Math.min(85,latlng.lat)),lon=((latlng.lng+180)%360+360)%360-180;
      selected={...(selected||{}),id:manual?'manual:'+ (old?.itemId?.replace(/^manual:/,'')||oldAccommodation?.placeId?.replace(/^manual:/,'')||uid()):selected?.id||'manual:'+uid(),name:f.placeName.value.trim()||'New location',type:f.placeType.value,lat,lon};
      if(!marker){
        marker=L.marker([lat,lon],{draggable:true,autoPan:true,keyboard:true,title:'Location pin: drag or use arrow keys',icon:L.divIcon({className:'herald-map-pin',html:'<span aria-hidden="true"></span>',iconSize:[28,36],iconAnchor:[14,34]})}).addTo(map);
        marker.on('dragend',()=>{manual=true;placePin(marker.getLatLng());});
        marker.getElement().setAttribute('aria-label','Location pin. Use arrow keys to move.');
        marker.getElement().addEventListener('keydown',event=>{
          const delta={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();manual=true;
          const point=map.latLngToContainerPoint(marker.getLatLng());placePin(map.containerPointToLatLng([point.x+delta[0],point.y+delta[1]]));
        });
      }else marker.setLatLng([lat,lon]);
      form.querySelector('[data-pin-status]').textContent='Pin placed. Drag it to refine the position, then save.';showSelected(false);
    }
    function showMap(){
      form.querySelector('.place-pin-editor').hidden=false;
      if(!map){
        const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        map=L.map(form.querySelector('.place-pin-map'),{zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce}).setView(selected?[selected.lat,selected.lon]:[30,0],selected?15:2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).on('tileerror',()=>{form.querySelector('[data-pin-status]').textContent='Map tiles could not load. Check your connection or use a search result.';}).addTo(map);
        map.on('click',event=>{manual=true;placePin(event.latlng);});
        if(selected)placePin({lat:selected.lat,lng:selected.lon});
      }
      requestAnimationFrame(()=>map.invalidateSize());
    }
    function renderResults(){
      host.innerHTML=results.slice(0,shown).map((p,i)=>`<button type="button" data-place-result="${i}">${p.countryCode?flagHtml(p.countryCode,'flag-img flag-sm'):'<span aria-hidden="true">⌂</span>'}<span class="place-result-copy"><strong>${E(p.name)}</strong><span>${E([p.type,p.area,p.countryName].filter(Boolean).join(' · '))}</span><small>${E(p.address)}</small></span><span aria-hidden="true">→</span></button>`).join('');
      form.querySelector('[data-place-more]').hidden=shown>=results.length;status.textContent=results.length?`Showing ${Math.min(shown,results.length)} of ${results.length} matching places. Select one to continue.`:'No matching places. Try a city or address, or plot the location on the map.';
    }
    const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const tokens=term=>normal(term).split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>1&&!['hotel','hotels','hostel','resort','the','guest','house','camping'].includes(t));
    function ranked(list,term){
      const words=tokens(term),unique=new Map();
      for(const p of list){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;const name=normal(p.name),hay=normal([p.name,p.address,p.area,p.countryName].join(' '));const lexical=words.reduce((n,w)=>n+(name.includes(w)?4:hay.includes(w)?1:0),0)+(name===normal(term)?20:0);if(words.length&&!lexical&&!/[^\u0000-\u024f]/.test(p.name))continue;const score=lexical+(accommodation&&['hotel','hostel','resort','guest_house','apartment','camp_site','chalet','motel'].includes(p.type)?5:0);const key=p.id;if(!unique.has(key))unique.set(key,{...p,score});}
      return [...unique.values()].sort((a,b)=>b.score-a.score);
    }
    async function search(){
      const term=f.query.value.trim(),token=++request;controller?.abort();host.innerHTML='';shown=10;form.querySelector('[data-place-more]').hidden=true;
      if(term.length<3||(!tokens(term).length&&(!f.searchArea.value.trim()||normal(term).split(/[^\p{L}\p{N}]+/u).some(w=>w.length===1)))){status.textContent='Add a more specific name, town or address, or choose a search area.';return;}
      const area=f.searchArea.value.trim(),key=normal(term+'|'+area);if(cache.has(key)){results=cache.get(key);renderResults();return;}
      status.textContent='Searching places…';controller=new AbortController();
      try{
        const params=new URLSearchParams({q:[term,area].filter(Boolean).join(' '),limit:'50',lang:'en'});if(map){const centre=map.getCenter();params.set('lat',centre.lat);params.set('lon',centre.lng);}
        const response=await fetch('https://photon.komoot.io/api/?'+params,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error();
        const data=await response.json();if(token!==request||!ownDialog.open)return;
        results=ranked((data.features||[]).map(normalise),term);cache.set(key,results);if(cache.size>80)cache.delete(cache.keys().next().value);renderResults();
      }catch(e){if(e.name!=='AbortError'&&token===request)status.textContent='Search is unavailable. Try the wider listings or plot a location on the map.';}
    }
    form.querySelector('[data-place-more]').onclick=()=>{shown+=10;renderResults();};
    f.searchArea.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();request++;timer=setTimeout(search,650);});
    form.querySelector('[data-place-wider]')?.addEventListener('click',async event=>{
      const term=f.query.value.trim(),words=tokens(term);if(!words.length){status.textContent='Enter a specific accommodation name before searching wider listings.';return;}
      controller?.abort();controller=new AbortController();const token=++request,button=event.currentTarget;button.disabled=true;status.textContent='Searching wider OpenStreetMap accommodation listings…';
      const areaCountry=countryByName(f.searchArea.value.trim())||COUNTRIES.find(c=>(' '+normal(f.searchArea.value).replace(/,/g,' ')+' ').includes(' '+normal(c.name)+' '))||countryByName(f.country.value)||(!f.searchArea.value.trim()||[context?.location,context?.countryName].includes(f.searchArea.value.trim())?countryByCode(context?.countryCode):null);
      const name=words.sort((a,b)=>b.length-a.length)[0].replace(/[^\p{L}\p{N}]/gu,'');
      const area=areaCountry?`area["ISO3166-1"="${areaCountry.code}"][admin_level=2]->.scope;`:'';
      const query=`[out:json][timeout:18];${area}nwr${areaCountry?'(area.scope)':''}[tourism~"^(hotel|hostel|guest_house|apartment|resort|camp_site|caravan_site|motel|chalet|alpine_hut)$"][~"^(name|name:en|name:fr|alt_name|int_name)$"~"${name}",i];out center tags 100;`;
      const timeout=setTimeout(()=>controller?.abort(),22000);
      try{
        const response=await fetch('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),{signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(token!==request||!ownDialog.open)return;
        const extra=(data.elements||[]).map(el=>{const t=el.tags||{},code=(t['addr:country']||areaCountry?.code||'').toUpperCase(),area=t['addr:city']||t['addr:state']||'';return {id:`osm:${({node:'N',way:'W',relation:'R'})[el.type]}:${el.id}`,name:t['name:en']||t['name:fr']||t.name,type:(t.tourism||'accommodation').replaceAll('_',' '),countryCode:code,countryName:countryByCode(code)?.name||'',area,address:[t['addr:housenumber'],t['addr:street'],t['addr:postcode'],area,t['addr:country']].filter(Boolean).join(', ')||'Address not provided by OpenStreetMap — check the map',lat:el.lat??el.center?.lat,lon:el.lon??el.center?.lon};});
        results=ranked([...results,...extra],term);shown=Math.max(10,shown);renderResults();if(!extra.length)status.textContent+=' No additional indexed accommodation found. Plot on map is always available.';
      }catch(e){if(token===request)status.textContent='Wider search is unavailable or timed out. Try a country in Search near, or plot the property on the map.';}finally{clearTimeout(timeout);button.disabled=false;}
    });
    f.query.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();request++;host.replaceChildren();status.textContent=f.query.value.trim().length<3?'Type at least three characters to search.':'Searching places…';timer=setTimeout(search,450);});
    f.query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(timer);search();}if(e.key==='ArrowDown'){e.preventDefault();host.querySelector('button')?.focus();}});
    host.addEventListener('keydown',e=>{const buttons=[...host.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){f.query.focus();}});
    host.onclick=e=>{const button=e.target.closest('[data-place-result]');if(!button)return;clearTimeout(timer);controller?.abort();request++;selected={...results[Number(button.dataset.placeResult)]};manual=false;showSelected();host.innerHTML='';status.textContent='Place selected.';if(map){map.setView([selected.lat,selected.lon],15,{animate:false});placePin({lat:selected.lat,lng:selected.lon});}};
    form.querySelector('[data-place-plot]').onclick=()=>{manual=true;showMap();};
    form.querySelector('[data-pin-centre]').onclick=()=>{manual=true;placePin(map.getCenter());};
    form.querySelector('[data-place-close]').onclick=()=>ownDialog.close();
    form.querySelector('[data-place-remove]')?.addEventListener('click',()=>{if(!confirm('Remove only this entry?'))return;if(old)state.placeVisits=state.placeVisits.filter(v=>v.id!==old.id);if(oldAccommodation)state.accommodations=state.accommodations.filter(a=>a.id!==oldAccommodation.id);finish();});
    function finish(){persist();renderAll();window.HVJourneys?.render();window.HVCalendar?.renderMonth();renderMap();ownDialog.close();}
    form.onsubmit=e=>{
      e.preventDefault();error.textContent='';const start=f.date.value,end=f.endDate.value,country=countryByName(f.country.value);
      if(!HVJourney.validDate(start)||!HVJourney.validDate(end)||end<start){error.textContent='Check the start and end dates.';return;}
      if(!selected||!Number.isFinite(selected.lat)||!Number.isFinite(selected.lon)){error.textContent='Select a search result or place a pin on the map.';return;}
      if(!country){error.textContent='Choose the country from the list.';return;}
      const place={...selected,name:f.placeName.value.trim(),type:f.placeType.value,countryCode:country.code,countryName:country.name};
      if(prefill.onSelect){prefill.onSelect(place,{date:start,end});ownDialog.close();return;}
      const tripId=old?.tripId||oldAccommodation?.tripId||prefill.tripId||HVJourney.tripForDates(state,start,end);
      if(accommodation){
        state.accommodations||=[];
        if(state.accommodations.some(a=>a.id!==oldAccommodation?.id&&a.profileId===state.activeProfileId&&a.placeId===place.id&&a.checkIn<=end&&a.checkOut>=start)){error.textContent='This accommodation already overlaps these dates. Edit the existing entry.';return;}
        const record={...oldAccommodation,id:oldAccommodation?.id||uid(),tripId:tripId||null,profileId:oldAccommodation?.profileId??state.activeProfileId,propertyName:place.name,location:place.area||place.address||country.name,checkIn:start,checkOut:end,notes:oldAccommodation?.notes||'',placeId:place.id,lat:place.lat,lon:place.lon,place};
        if(oldAccommodation)Object.assign(oldAccommodation,record);else state.accommodations.push(record);
      }else{
        state.placeVisits||=[];
        if(state.placeVisits.some(v=>v.id!==old?.id&&v.category==='locations'&&v.profileId===state.activeProfileId&&v.itemId===place.id&&v.date<=end&&(v.endDate||v.date)>=start)){error.textContent='This place is already recorded on these dates.';return;}
        const record={...old,id:old?.id||uid(),profileId:old?.profileId??state.activeProfileId,category:'locations',itemId:place.id,status:'visited',date:start,endDate:end,tripId:tripId||null,place};
        if(old)Object.assign(old,record);else state.placeVisits.push(record);
      }
      finish();
    };
    ownDialog.addEventListener('close',()=>{clearTimeout(timer);controller?.abort();request++;map?.remove();ownDialog.remove();opener?.focus?.();});
    showSelected();if(!selected&&oldAccommodation){f.placeName.value=oldAccommodation.propertyName;f.query.value=oldAccommodation.propertyName;f.country.value=context?.countryName||'';}ownDialog.showModal();f.query.focus();
  }
  function renderMap(){
    const viewport=$('worldMap')?.querySelector('.map-viewport'),projection=window.HVMapProjection;if(!viewport||!projection||!window.d3)return;
    viewport.querySelector('.saved-places')?.remove();const pins=d3.select(viewport).append('g').attr('class','saved-places');
    const places=HVJourney.scoped(state.placeVisits||[],state.activeProfileId).filter(v=>v.category==='locations'&&v.status==='visited'&&v.place&&!types.slice(0,-1).some(t=>t.toLowerCase()===String(v.place.type||'').toLowerCase())&&(!timelineDate||v.date<=timelineDate));

    for(const v of places){const p=v.place,point=projection([p.lon,p.lat]);if(!point||!point.every(Number.isFinite))continue;const pin=pins.append('circle').attr('cx',point[0]).attr('cy',point[1]).attr('r',4/(d3.zoomTransform($('worldMap')).k||1)).attr('class','saved-place-pin');pin.append('title').text(`${p.name} · ${p.countryName} · ${v.date}`);}
  }
  function boot(){
    const button=document.createElement('button');button.type='button';button.className='secondary compact';button.textContent='+ Add a place';button.onclick=()=>open();$('mapView')?.querySelector('.map-panel .panel-head')?.append(button);
    document.addEventListener('click',event=>{const edit=event.target.closest('[data-place-edit]');if(edit){open({recordId:edit.dataset.placeEdit});return;}const remove=event.target.closest('[data-place-delete]');if(remove&&confirm('Remove this saved place?')){state.placeVisits=(state.placeVisits||[]).filter(v=>v.id!==remove.dataset.placeDelete);persist();renderAll();window.HVJourneys?.render();renderMap();}});renderMap();
  }
  window.HVPlaces={open,renderMap};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

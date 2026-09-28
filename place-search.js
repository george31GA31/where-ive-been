/* Explicit place search and confirmed, trip-linked map pins. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id) || window.HVPages?.get(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected = null, results = [], lastRequest = 0, plotMode = false, dialog = null;
  const cache = new Map();
  const profilePlaces = () => window.HVJourney.scoped(state.placeVisits || [], state.activeProfileId).filter(v => v.category === 'locations' && v.status === 'visited' && v.place);
  const code = tag => /^[A-Z]{3}$/.test(String(tag || '').toUpperCase()) ? String(tag).toUpperCase() : '';
  const airportCode = place => place.iata ? `IATA ${place.iata}` : place.icao ? `ICAO ${place.icao}` : '';
  const options = () => window.HVJourney.scoped(state.trips || [], state.activeProfileId).map(t => `<option value="${E(t.id)}">${E(t.name)}</option>`).join('');
  function refreshTrips(form, selectedId = '') {
    form.elements.tripId.innerHTML = `<option value="">No linked trip</option>${options()}`;
    form.elements.tripId.value = selectedId;
  }

  function normalise(item) {
    const tags = item.extratags || {}, names = item.namedetails || {}, address = item.address || {};
    const countryCode = (address.country_code || '').toUpperCase();
    return {id:`osm:${item.osm_type}:${item.osm_id}`,name:item.name || item.display_name?.split(',')[0] || 'Unnamed place',
      address:item.display_name || '',area:address.city || address.town || address.village || address.county || address.state || '',
      type:item.type || item.category || 'place',countryCode,countryName:address.country || '',
      lat:Number(item.lat),lon:Number(item.lon),iata:code(tags.iata || tags['aeroway:iata'] || names.iata),icao:/^[A-Z0-9]{4}$/.test(String(tags.icao || names.icao || '').toUpperCase()) ? String(tags.icao || names.icao).toUpperCase() : ''};
  }
  function formMarkup(date = '',tripId = '') {
    return `<form class="place-search-form"><div class="place-search-heading"><div><p class="eyebrow">SPECIFIC PLACES</p><h3>Find a place</h3></div><button type="button" class="text-btn" data-place-close aria-label="Close place search">Close</button></div>
      <p class="helper">Search on request for hotels, campsites, airports and other places. Choose a result before saving.</p>
      <div class="place-search-bar"><label class="field"><span>Place name or address</span><input name="query" type="search" minlength="3" required placeholder="Hotel, airport, town or address"></label><button class="secondary" type="submit">Search</button></div>
      <div class="place-search-results" role="status">Enter at least three characters, then search.</div>
      <div class="place-selected" hidden></div>
      <details class="place-manual"><summary>Can't find it? Plot a place manually</summary><label class="field"><span>Place name</span><input name="manualName" maxlength="160"></label><label class="field"><span>Area or address</span><input name="manualAddress" maxlength="240"></label><label class="field"><span>Country</span><input name="manualCountry" list="countryList" autocomplete="off"></label><div class="place-coordinates"><label class="field"><span>Latitude</span><input name="manualLat" type="number" step="any" min="-90" max="90"></label><label class="field"><span>Longitude</span><input name="manualLon" type="number" step="any" min="-180" max="180"></label></div><button class="secondary compact" type="button" data-place-plot>Choose position on map</button><p class="helper">You can enter coordinates, or choose a point on the Map.</p></details>
      <div class="place-save"><label class="field"><span>Date visited / check-in</span><input name="date" type="date" value="${E(date || isoDate(new Date()))}" required></label><label class="field"><span>Trip <em>optional</em></span><select name="tripId"><option value="">No linked trip</option>${options()}</select></label><label class="place-accommodation-choice"><input type="checkbox" name="asAccommodation"> Add as accommodation to this trip</label><label class="field"><span>Check-out <em>if staying here</em></span><input name="checkOut" type="date" value="${E(date || isoDate(new Date()))}"></label><button class="primary" type="button" data-place-save>Save selected place</button></div>
      <p class="form-error" data-place-error role="alert"></p><small>Search results © OpenStreetMap contributors</small></form>`;
  }
  function bind(root, prefill = {}) {
    const form = root.querySelector('form');
    refreshTrips(form,prefill.tripId || '');
    if (prefill.end) form.elements.checkOut.value = prefill.end;
    const existing = (state.placeVisits || []).find(v => v.id === prefill.recordId && v.category === 'locations');
    if (existing) {
      form.dataset.recordId = existing.id;
      form.elements.date.value = existing.date;
      form.elements.checkOut.value = existing.date;
      selected = {...existing.place};
      const chosen = form.querySelector('.place-selected');
      chosen.hidden = false;
      chosen.innerHTML = `<strong>Selected: ${E(selected.name)}</strong><span>${E(selected.address)} · ${E(selected.countryName)}</span>`;
    }
    if (prefill.tripId || existing?.tripId) form.elements.tripId.value = prefill.tripId || existing.tripId;
    form.onsubmit = search;
    form.querySelector('[data-place-close]').onclick = () => { if (dialog?.open) dialog.close(); else root.hidden = true; plotMode = false; };
    form.querySelector('[data-place-plot]').onclick = () => {
      plotMode = true;
      if (dialog?.open) dialog.close();
      location.hash = '#/map';
      $('mapPlacePanel')?.removeAttribute('hidden');
      $('mapPlacePanel')?.querySelector('.place-manual')?.setAttribute('open','');
      $('mapPlacePanel')?.querySelector('[data-place-error]') && ($('mapPlacePanel').querySelector('[data-place-error]').textContent = 'Click a position on the map to fill the coordinates.');
    };
    form.querySelector('[data-place-save]').onclick = () => save(form);
    form.querySelector('.place-search-results').onclick = event => {
      const button = event.target.closest('[data-place-result]');
      if (!button) return;
      selected = results[Number(button.dataset.placeResult)];
      const chosen = form.querySelector('.place-selected');
      chosen.hidden = false;
      chosen.innerHTML = `<strong>Selected: ${E(selected.name)}</strong><span>${E(selected.address)} · ${E(selected.type)}${airportCode(selected) ? ' · '+E(airportCode(selected)) : ''}</span>${selected.iata || selected.icao ? '<button type="button" class="secondary compact" data-place-airport-start>Use as departure</button><button type="button" class="secondary compact" data-place-airport-end>Use as arrival</button>' : ''}`;
    };
    form.querySelector('.place-selected').onclick = event => {
      const side = event.target.closest('[data-place-airport-start]') ? 'start' : event.target.closest('[data-place-airport-end]') ? 'end' : '';
      if (!side || !selected) return;
      const airport = {name:`${selected.name} (${selected.iata || selected.icao})`,lat:selected.lat,lon:selected.lon,airportId:selected.id,iata:selected.iata,icao:selected.icao};
      const prefill = {tripId:form.elements.tripId.value,[side]:airport,[side+'Local']:`${form.elements.date.value}T12:00`};
      if (dialog?.open) dialog.close();
      window.HVJourneys?.openTransport(null,prefill);
    };
  }
  async function search(event) {
    event.preventDefault();
    const form = event.currentTarget, term = form.elements.query.value.trim(), host = form.querySelector('.place-search-results'), error = form.querySelector('[data-place-error]');
    if (term.length < 3) return;
    error.textContent = '';selected = null;form.querySelector('.place-selected').hidden = true;
    if (cache.has(term.toLowerCase())) { results = cache.get(term.toLowerCase()); renderResults(host); return; }
    if (Date.now()-lastRequest < 1100) { error.textContent = 'Please wait a moment before searching again.'; return; }
    lastRequest = Date.now();host.textContent = 'Searching places…';
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({q:term,format:'jsonv2',addressdetails:'1',extratags:'1',namedetails:'1',limit:'10',dedupe:'1'});
      const response = await fetch(url,{headers:{Accept:'application/json'}});
      if (!response.ok) throw Error('search');
      results = (await response.json()).map(normalise).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      cache.set(term.toLowerCase(),results);renderResults(host);
    } catch { host.textContent = 'Place search is unavailable right now. You can plot a place manually.'; }
  }
  function renderResults(host) {
    host.innerHTML = results.length ? results.map((p,i) => `<button type="button" data-place-result="${i}"><strong>${E(p.name)}</strong><span>${E([p.area,p.countryName,p.type,airportCode(p)].filter(Boolean).join(' · '))}</span><small>${E(p.address)} · ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</small></button>`).join('') : '<p>No matching places. Try a more specific name or plot it manually.</p>';
  }
  function save(form) {
    const error = form.querySelector('[data-place-error]'), date = form.elements.date.value, tripId = form.elements.tripId.value;
    error.textContent = '';
    if (!window.HVJourney.validDate(date)) { error.textContent = 'Choose a valid visit date.'; return; }
    if (tripId && !(state.trips || []).some(t => t.id === tripId)) { error.textContent = 'Choose a valid trip.'; return; }
    let place = selected;
    if (form.querySelector('.place-manual').open && form.elements.manualName.value.trim()) {
      const country = countryByName(form.elements.manualCountry.value);
      const lat = Number(form.elements.manualLat.value), lon = Number(form.elements.manualLon.value);
      if (!country || form.elements.manualLat.value === '' || form.elements.manualLon.value === '' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) { error.textContent = 'Add a valid country and map coordinates for the manual place.'; return; }
      place = {id:`manual:${uid()}`,name:form.elements.manualName.value.trim(),address:form.elements.manualAddress.value.trim(),area:form.elements.manualAddress.value.trim(),type:'Custom place',countryCode:country.code,countryName:country.name,lat,lon,iata:'',icao:''};
    }
    if (!place) { error.textContent = 'Select a search result, or plot a place manually.'; return; }
    const accommodation = form.elements.asAccommodation.checked, checkOut = form.elements.checkOut.value;
    if (accommodation && (!tripId || !window.HVJourney.validDate(checkOut) || checkOut < date)) { error.textContent = 'Choose a trip and valid check-out date for accommodation.'; return; }
    if (accommodation && (state.accommodations || []).some(a => a.tripId === tripId && a.placeId === place.id && a.checkIn <= checkOut && a.checkOut >= date)) { error.textContent = 'This accommodation already overlaps these dates.'; return; }
    state.placeVisits ||= [];
    if (state.placeVisits.some(v => v.id !== form.dataset.recordId && v.category === 'locations' && v.profileId === state.activeProfileId && v.tripId === (tripId || null) && v.date === date && v.itemId === place.id)) { error.textContent = 'This place is already saved for this trip and date.'; return; }
    const old = state.placeVisits.find(v => v.id === form.dataset.recordId && v.category === 'locations');
    const record = {id:old?.id || uid(),profileId:old?.profileId ?? state.activeProfileId,category:'locations',itemId:place.id,status:'visited',date,tripId:tripId || null,place:{...place}};
    if (old) Object.assign(old,record); else state.placeVisits.push(record);
    if (accommodation) {
      state.accommodations ||= [];
      state.accommodations.push({id:uid(),tripId,profileId:state.activeProfileId,propertyName:place.name,location:place.area || place.address || place.countryName,checkIn:date,checkOut,notes:'',placeId:place.id,lat:place.lat,lon:place.lon});
    }
    persist();window.HVJourneys?.render();window.HVCalendar?.renderMonth();renderMap();
    if (dialog?.open) dialog.close();
    else { const host=$('mapPlacePanel');host.hidden = true; }
    selected = null;plotMode = false;
  }
  function renderMap() {
    const svg = $('worldMap'), viewport = svg?.querySelector('.map-viewport'), projection = window.HVMapProjection;
    if (!viewport || !projection || !window.d3) return;
    viewport.querySelector('.saved-places')?.remove();
    const pins = window.d3.select(viewport).append('g').attr('class','saved-places');
    profilePlaces().filter(v => !timelineDate || v.date <= timelineDate).forEach(v => {
      const p = v.place, point = projection([p.lon,p.lat]);
      if (!point || !point.every(Number.isFinite)) return;
      const pin = pins.append('circle').attr('cx',point[0]).attr('cy',point[1]).attr('r',4).attr('class','saved-place-pin');
      pin.append('title').text(`${p.name} · ${p.countryName} · ${v.date}`);
    });
  }
  function open(prefill = {}) {
    selected = null;results = [];
    dialog ||= document.createElement('dialog');
    dialog.className = 'place-search-dialog';
    dialog.innerHTML = formMarkup(prefill.date,prefill.tripId);
    if (!dialog.isConnected) document.body.append(dialog);
    bind(dialog,prefill);dialog.showModal();
  }
  function boot() {
    const host = document.createElement('section');
    host.id = 'mapPlacePanel';host.className = 'panel map-place-panel';host.hidden = true;
    host.innerHTML = formMarkup();
    $('mapView')?.querySelector('.map-panel')?.after(host);
    bind(host);
    const button = document.createElement('button');
    button.type = 'button';button.className = 'secondary compact';button.textContent = '+ Add a place';
    button.onclick = () => { host.hidden = !host.hidden; if (!host.hidden) { refreshTrips(host.querySelector('form')); host.querySelector('[name="query"]').focus(); } };
    $('mapView')?.querySelector('.map-panel .panel-head')?.append(button);
    $('worldMap')?.addEventListener('click', event => {
      if (!plotMode || !window.d3) return;
      event.preventDefault();event.stopPropagation();
      const viewport = $('worldMap').querySelector('.map-viewport');
      const point = window.d3.pointer(event,viewport), coordinates = window.HVMapProjection?.invert(point);
      if (!coordinates) return;
      host.querySelector('[name="manualLat"]').value = coordinates[1].toFixed(6);
      host.querySelector('[name="manualLon"]').value = coordinates[0].toFixed(6);
      host.querySelector('[data-place-error]').textContent = 'Position selected. Add the name and country, then save.';
      plotMode = false;
    },true);
    document.addEventListener('click', event => {
      const edit = event.target.closest('[data-place-edit]');
      if (edit) { open({recordId:edit.dataset.placeEdit}); return; }
      const remove = event.target.closest('[data-place-delete]');
      if (remove && confirm('Remove this saved place?')) {
        state.placeVisits = (state.placeVisits || []).filter(v => v.id !== remove.dataset.placeDelete);
        persist();window.HVJourneys?.render();window.HVCalendar?.renderMonth();renderMap();
      }
    });
    renderMap();
  }
  window.HVPlaces = {open,renderMap};
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',boot) : boot();
})();

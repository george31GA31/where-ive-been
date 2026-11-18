/* The itinerary and map edit one saved journey graph. */
(() => {
  'use strict';
  const M = HVTripPlannerModel;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const get = id => document.getElementById(id) || window.HVPages?.get(id);
  const newId = () => crypto.randomUUID();
  const modeFor = value => M.modes.find(mode => mode.id === value) || M.modes.at(-1);
  const date = value => String(value || '').slice(0, 10);
  const time = value => String(value || '').includes('T') ? value.slice(11, 16) : '';
  let draft, owner, baseline, selected, map, layers, bindings = [], request;
  let dirty = false, mapAction, drawnPoints = [], dragging, mobileMap = false;
  let saveMessage = '', searchFilter = 'other', remoteChanged = false;
  let viewStale = false;
  let draftEpoch = 0;
  const imageRequests = new Map();

  function scope() {
    return (window.HVAccountState?.userId || 'guest') + '.' + state.activeProfileId;
  }
  function draftKey() { return 'herald.tripPlanner.draft.v2.' + (owner || scope()); }
  const imageKey = selection => JSON.stringify([selection?.stopId || null, selection?.segmentId || null]);
  function invalidateImageRequests() {
    draftEpoch++;
    imageRequests.clear();
  }
  function newJourney() {
    return M.normalize({
      id: newId(), plannerVersion: 2, name: '', status: 'planned',
      profileId: state.activeProfileId === 'all' ? state.profiles[0]?.id : state.activeProfileId,
      stops: [{id:newId(), name:''}, {id:newId(), name:''}], segments:[]
    });
  }
  function remember() {
    if (!draft) return;
    try { sessionStorage.setItem(draftKey(), JSON.stringify({draft, baseline, dirty})); }
    catch { message('Draft backup is full. Save this journey before closing the tab.', true); }
  }
  function changed() {
    dirty = true;
    saveMessage = 'Unsaved changes';
    remember();
    updateStatus();
  }
  function message(value, error = false) {
    saveMessage = value;
    const status = get('plannerSaveStatus');
    if (status) {
      status.textContent = value;
      status.classList.toggle('planner-error', error);
    }
  }
  function updateStatus() {
    const status = get('plannerSaveStatus');
    if (status) status.textContent = saveMessage;
    get('plannerConflict')?.toggleAttribute('hidden', !remoteChanged);
    const reload = get('plannerReload');
    if (reload) reload.hidden = remoteChanged && baseline != null && !(state.roadTrips || []).some(record => record.id === draft?.id);
  }
  function cleanup() {
    request?.abort();
    bindings.forEach(binding => binding.cancel());
    bindings = [];
    map?.remove();
    map = null;
    layers = null;
  }
  function initialise() {
    if (owner === scope() && draft) return;
    if (draft) { readDetails(); remember(); }
    invalidateImageRequests();
    cleanup();
    owner = scope();
    draft = newJourney();
    baseline = null;
    dirty = false;
    remoteChanged = false;
    selected = null;
    mapAction = null;
    drawnPoints = [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey()));
      if (saved?.draft?.stops?.length >= 1) {
        draft = M.normalize(saved.draft);
        baseline = saved.baseline;
        dirty = !!saved.dirty;
      }
    } catch {}
    const current = (state.roadTrips || []).find(record => record.id === draft.id);
    if (current && !dirty) {
      draft = M.normalize(current);
      baseline = current.updatedAt || '';
    } else if (current ? baseline !== (current.updatedAt || '') : baseline != null) remoteChanged = true;
    saveMessage = dirty ? 'Recovered draft · unsaved changes' : '';
  }
  function defaultName() {
    return [draft.stops[0]?.name, draft.stops.at(-1)?.name].filter(Boolean).join(' → ') || 'New journey';
  }
  function routePoints(segment) {
    const saved = M.coordinates(segment.route);
    if (saved.length) return saved;
    const start = draft.stops.find(stop => stop.id === segment.fromStopId);
    const end = draft.stops.find(stop => stop.id === segment.toStopId);
    if (!M.positioned(start) || !M.positioned(end)) return [];
    if (segment.mode === 'flight') return HVRouteGeometry.flightArc(start, end);
    return [[Number(start.lat), Number(start.lon)], [Number(end.lat), Number(end.lon)]];
  }
  function thumbnail(media, fallback) {
    const item = Array.isArray(media) ? media[0] : media;
    return item?.src && /^data:image\/(jpeg|png|webp);base64,/.test(item.src)
      ? '<img class="planner-thumbnail" src="' + escape(item.src) + '" alt="">'
      : fallback;
  }
  function modeIcon(mode) {
    return HVTransportIcons.html(modeFor(mode).type);
  }
  function focusDetails() {
    get('plannerDetails')?.querySelector('h3')?.focus({preventScroll:true});
  }
  function itinerary() {
    bindings.forEach(binding => binding.cancel());
    bindings = [];
    const list = get('plannerStopList');
    if (!list) return;
    list.innerHTML = draft.stops.map((stop, index) => {
      const segment = draft.segments[index];
      const isSelected = selected?.stopId === stop.id;
      const hotelId = stop.accommodation?.sourceRecord?.id;
      const hotel = hotelId && (state.accommodations || []).find(record => record.id === hotelId);
      const logo = hotel && window.HVAccommodationLogos?.forRecord(state, hotel);
      const fallback = logo ? '<img class="planner-thumbnail" src="'+escape(logo)+'" alt="">'
        : '<span class="planner-stop-number">' + (index + 1) + '</span>';
      const icon = thumbnail(stop.media, fallback);
      const details = stop.arrivalLocal || stop.departureLocal;
      const stopRow = `<li class="planner-stop ${isSelected ? 'is-selected' : ''}" data-stop-id="${escape(stop.id)}" draggable="true">
        <div class="planner-stop-main">
          <button type="button" class="planner-stop-select" data-select-stop="${escape(stop.id)}" aria-label="Edit destination ${index+1}">${icon}</button>
          <div class="planner-stop-search">
            <label class="sr-only" for="plannerStop${index}">${index === 0 ? 'Starting point' : index === draft.stops.length-1 ? 'Destination' : 'Stop '+(index+1)}</label>
            <input id="plannerStop${index}" type="search" autocomplete="off" value="${escape(stop.name)}" placeholder="${index === 0 ? 'Starting point' : index === 1 && draft.stops.length === 2 ? 'Destination' : 'Add a place'}">
            <div class="planner-search-results" data-planner-results="${index}"></div>
            ${details ? '<button type="button" class="planner-stop-date" data-select-stop="'+escape(stop.id)+'">'+escape(HVJourneyUI.date(details))+'</button>' : ''}
          </div>
          <button type="button" class="planner-icon-button" data-select-stop="${escape(stop.id)}" aria-label="Details for destination ${index+1}">•••</button>
        </div>
        <div class="planner-stop-reorder">
          <button type="button" data-move-stop="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move destination ${index+1} earlier">↑</button>
          <button type="button" data-move-stop="${index}" data-direction="1" ${index === draft.stops.length-1 ? 'disabled' : ''} aria-label="Move destination ${index+1} later">↓</button>
          <button type="button" data-insert-stop="${index+1}" aria-label="Insert destination after ${index+1}">+ Stop</button>
          <button type="button" data-remove-stop="${escape(stop.id)}" ${draft.stops.length <= 2 ? 'disabled' : ''} aria-label="Remove destination ${index+1}">Remove</button>
        </div>
      </li>`;
      if (!segment) return stopRow;
      const routeLabel = segment.route?.kind === 'manual' ? 'Manually drawn'
        : segment.route?.kind === 'routed' ? segment.route.label || 'Mapped connection' : 'Illustrative connection';
      return stopRow + `<li class="planner-segment ${selected?.segmentId === segment.id ? 'is-selected' : ''}" data-segment-id="${escape(segment.id)}">
        ${thumbnail(segment.media, window.HVOperators?.image(state, modeFor(segment.mode).type, segment.operator, segment.operatorId, 'planner-thumbnail') || modeIcon(segment.mode))}
        <label class="sr-only" for="plannerMode${index}">Transport from destination ${index+1} to ${index+2}</label>
        <select id="plannerMode${index}" data-segment-mode="${escape(segment.id)}">${M.modes.map(mode => '<option value="'+mode.id+'"'+(segment.mode===mode.id?' selected':'')+'>'+escape(mode.label)+'</option>').join('')}</select>
        <button type="button" data-select-segment="${escape(segment.id)}" class="planner-segment-details"><span>${escape(segment.departureLocal ? HVJourneyUI.date(segment.departureLocal) : routeLabel)}</span><span aria-hidden="true">›</span></button>
      </li>`;
    }).join('');
    const previous = get('plannerPreviousConnections');
    if (previous) {
      const rows = draft.previousSegments || [];
      previous.hidden = !rows.length;
      previous.innerHTML = rows.length ? '<summary>Previous connections ('+rows.length+')</summary><p>Details saved before rearranging destinations. Copy missing details to a current connection, or reconnect the original destinations to restore them.</p>'
        +rows.map(segment => '<details class="planner-previous-item"><summary>'+escape((segment.fromName || 'Previous start')+' → '+(segment.toName || 'Previous destination'))+'</summary><p>'
          +escape([modeFor(segment.mode).label, segment.departureLocal, segment.arrivalLocal, segment.operator, segment.serviceNumber, segment.bookingReference].filter(Boolean).join(' · '))+'</p>'
          +(segment.notes?'<p>'+escape(segment.notes)+'</p>':'')+thumbnail(segment.media,'')
          +'<label class="planner-field"><span>Copy missing details to</span><select data-previous-target="'+escape(segment.id)+'">'+draft.segments.map(target=>'<option value="'+escape(target.id)+'"'+(selected?.segmentId===target.id?' selected':'')+'>'+escape(target.fromName+' → '+target.toName)+'</option>').join('')+'</select></label>'
          +'<button type="button" class="secondary" data-copy-previous="'+escape(segment.id)+'">Copy details</button></details>').join('') : '';
    }
    draft.stops.forEach((stop, index) => {
      const input = get('plannerStop'+index);
      const results = list.querySelector('[data-planner-results="'+index+'"]');
      bindings.push(HVTravelSearch.bind(input, results, {
        context: () => searchFilter,
        onType() {
          const current = draft.stops.find(item => item.id === stop.id);
          current.name = input.value;
          delete current.lat;
          delete current.lon;
          const nameField = get('plannerDetailForm')?.elements.namedItem('name');
          if (selected?.stopId === current.id && nameField) nameField.value = input.value;
          draft = M.reconcile(draft);
          changed();
          drawMap();
        },
        onSelect(place) {
          const old = draft.stops.find(item => item.id === stop.id);
          const location = HVAddress.place(place);
          Object.assign(old, location, {id:stop.id, placeId:place.externalPlaceId || place.id});
          draft = M.reconcile(draft);
          changed();
          itinerary();
          renderDetails();
          drawMap(true);
        }
      }));
    });
  }
  function choose(selection, focusMap = true) {
    readDetails();
    selected = selection;
    itinerary();
    renderDetails();
    drawMap();
    focusDetails();
    if (focusMap && selection.stopId) {
      const stop = draft.stops.find(item => item.id === selection.stopId);
      if (M.positioned(stop)) map?.setView([stop.lat, stop.lon], Math.max(5, map.getZoom()), {animate:false});
    }
  }
  function field(label, name, value = '', type = 'text', extra = '') {
    return '<label class="planner-field"><span>'+escape(label)+'</span><input name="'+name+'" type="'+type+'" value="'+escape(value)+'" '+extra+'></label>';
  }
  function localFields(label, key, value) {
    return '<fieldset class="planner-local-date"><legend>'+escape(label)+'</legend><div>'+field('Date', key+'Date', date(value), 'date')+field('Local time', key+'Time', time(value), 'time')+'</div></fieldset>';
  }
  function mediaFields(item) {
    const media = Array.isArray(item.media) ? item.media[0] : item.media;
    return '<div class="planner-media-editor">'+(media?.src ? thumbnail(item.media, '')+'<button type="button" class="text-btn" data-remove-media>Remove image</button>' : '')
      +'<label class="planner-upload">Add '+(media?.src?'replacement ':'')+'photo or logo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-planner-upload></label></div>';
  }
  function renderDetails() {
    const panel = get('plannerDetails');
    if (!panel) return;
    const stop = draft.stops.find(item => item.id === selected?.stopId);
    const segment = draft.segments.find(item => item.id === selected?.segmentId);
    panel.hidden = !stop && !segment;
    if (panel.hidden) { panel.replaceChildren(); return; }
    const item = stop || segment;
    let body;
    if (stop) {
      const stay = stop.accommodation || {};
      body = field('Name', 'name', stop.name)
        +'<button type="button" class="text-btn" data-map-relocate="'+escape(stop.id)+'">Choose location on map</button>'
        +localFields('Arrival', 'arrival', stop.arrivalLocal)
        +localFields('Departure', 'departure', stop.departureLocal)
        +'<details'+(stay.name?' open':'')+'><summary>Accommodation</summary>'
        +field('Property', 'stayName', stay.name)
        +'<div class="planner-field-pair">'+field('Check-in', 'checkIn', stay.checkIn, 'date')+field('Check-out', 'checkOut', stay.checkOut, 'date')+'</div>'
        +field('Booking reference', 'stayBooking', stay.bookingReference)+'</details>'
        +'<details'+(stop.activities?.length?' open':'')+'><summary>Activities</summary><div id="plannerActivities">'
        +(stop.activities || []).map((activity,index) => '<div class="planner-activity" data-activity-id="'+escape(activity.id)+'">'
          +field('Activity', 'activityName'+index, activity.name)
          +field('Date', 'activityDate'+index, activity.date, 'date')
          +'<button type="button" class="text-btn" data-remove-activity="'+escape(activity.id)+'">Remove activity</button></div>').join('')
        +'</div><button type="button" class="text-btn" data-add-activity>+ Add activity</button></details>';
    } else {
      const start = draft.stops.find(row => row.id === segment.fromStopId);
      const end = draft.stops.find(row => row.id === segment.toStopId);
      const distance = segment.route?.kind === 'routed' && Number.isFinite(segment.route.distance)
        ? new Intl.NumberFormat('en-GB', {maximumFractionDigits:1}).format(segment.route.distance/1000)+' km' : '';
      body = '<p class="planner-details-route">'+escape(start?.name)+' → '+escape(end?.name)+'</p>'
        +(segment.mode === 'other' ? field('Transport name', 'customLabel', segment.customLabel) : '')
        +localFields('Departure', 'departure', segment.departureLocal)
        +localFields('Arrival', 'arrival', segment.arrivalLocal)
        +'<details><summary>Booking & cost</summary>'+field('Operator', 'operator', segment.operator)
        +field('Service or flight number', 'serviceNumber', segment.serviceNumber)
        +field('Booking reference', 'bookingReference', segment.bookingReference)
        +'<div class="planner-field-pair">'+field('Amount', 'costAmount', segment.cost?.amount, 'number', 'min="0" step="any"')
        +field('Currency', 'costCurrency', segment.cost?.currency || 'GBP', 'text', 'maxlength="3" pattern="[A-Za-z]{3}"')+'</div>'
        +field('Duration (minutes)', 'durationMinutes', segment.durationMinutes, 'number', 'min="0" step="any"')
        +'<label class="planner-field"><span>Duration type</span><select name="durationKind"><option value="estimated"'+(segment.durationKind!=='confirmed'?' selected':'')+'>Estimated</option><option value="confirmed"'+(segment.durationKind==='confirmed'?' selected':'')+'>Confirmed</option></select></label></details>'
        +'<div class="planner-route-editing"><strong>Route</strong><p>'+escape(segment.route?.label || 'Illustrative connection')+(distance?' · '+escape(distance):'')+'</p>'
        +(!['other','cycle'].includes(segment.mode)?'<button type="button" class="secondary" data-route-lookup>Find mapped connection</button>':'')
        +'<button type="button" class="secondary" data-route-draw>Draw route on map</button>'
        +'<button type="button" class="text-btn" data-route-reset>Use illustrative connection</button></div>';
    }
    panel.innerHTML = '<header><h3 tabindex="-1">'+escape(stop?'Destination details':modeFor(segment.mode).label)+'</h3><button type="button" class="planner-icon-button" data-close-details aria-label="Close details">×</button></header>'
      +'<form id="plannerDetailForm">'+body+'<label class="planner-field"><span>Notes</span><textarea name="notes" rows="3">'+escape(item.notes || '')+'</textarea></label>'
      +mediaFields(item)
      +'<div class="planner-detail-actions"><button type="button" class="primary" data-detail-done>Done</button><button type="button" class="text-btn" data-entry-calendar>View dates in calendar</button></div></form>';
    get('plannerDetailForm').onsubmit = event => event.preventDefault();
  }
  function readDetails() {
    const form = get('plannerDetailForm');
    if (!form || !selected) return;
    const stop = draft.stops.find(item => item.id === selected.stopId);
    const segment = draft.segments.find(item => item.id === selected.segmentId);
    const item = stop || segment;
    if (!item) return;
    const old = copy(item);
    const value = name => form.elements.namedItem(name)?.value || '';
    const local = key => value(key+'Date') + (value(key+'Date') && value(key+'Time') ? 'T'+value(key+'Time') : '');
    const set = (target, key, next) => {
      if ((next === '' || next == null) && (target[key] === '' || target[key] == null)) return;
      target[key] = next;
    };
    set(item, 'notes', value('notes'));
    set(item, 'arrivalLocal', local('arrival'));
    set(item, 'departureLocal', local('departure'));
    if (stop) {
      stop.name = value('name');
      if (value('stayName') || stop.accommodation) {
        stop.accommodation ||= {};
        for (const [key, fieldName] of [['name','stayName'],['checkIn','checkIn'],['checkOut','checkOut'],['bookingReference','stayBooking']]) {
          set(stop.accommodation, key, value(fieldName));
        }
      }
      (stop.activities || []).forEach((activity,index) => {
        activity.name = value('activityName'+index);
        activity.date = value('activityDate'+index);
      });
    } else {
      for (const name of ['operator','serviceNumber','bookingReference']) set(segment, name, value(name));
      if (segment.mode === 'other') set(segment, 'customLabel', value('customLabel'));
      set(segment, 'durationMinutes', value('durationMinutes') === '' ? null : Number(value('durationMinutes')));
      if (segment.durationMinutes != null) set(segment, 'durationKind', value('durationKind'));
      set(segment, 'cost', value('costAmount') === '' ? null : {amount:Number(value('costAmount')), currency:value('costCurrency').toUpperCase()});
    }
    if (!WIBModel.equal(old, item)) changed();
  }
  function drawMap(fit = false) {
    if (!map) return;
    layers?.remove();
    layers = L.featureGroup().addTo(map);
    const bounds = [];
    draft.segments.forEach(segment => {
      const points = routePoints(segment);
      if (!points.length) return;
      const isSelected = selected?.segmentId === segment.id;
      const illustrative = !segment.route || segment.route.kind === 'illustrative';
      const colour = HVJourney.routeColor(modeFor(segment.mode).type);
      L.polyline(points, {color:'#fff9ef', weight:isSelected?7:5, opacity:.85, interactive:false}).addTo(layers);
      const line = L.polyline(points, {color:colour, weight:isSelected?3.5:2.3, opacity:.9, dashArray:illustrative?'5 7':undefined, bubblingMouseEvents:false}).addTo(layers);
      line.on('click', () => choose({segmentId:segment.id}, false));
      line.bindTooltip(escape(modeFor(segment.mode).label)+(illustrative?' · illustrative connection':''), {sticky:true});
    });
    draft.stops.forEach((stop,index) => {
      if (!M.positioned(stop)) return;
      const point = [Number(stop.lat), Number(stop.lon)];
      bounds.push(point);
      const marker = L.marker(point, {
        draggable:true, bubblingMouseEvents:false, title:stop.name || 'Destination '+(index+1),
        icon:L.divIcon({className:'planner-map-pin'+(selected?.stopId===stop.id?' is-selected':''), html:'<span><b>'+(index+1)+'</b></span>', iconSize:[30,36], iconAnchor:[15,33]})
      }).addTo(layers);
      marker.on('click', () => choose({stopId:stop.id}, false));
      marker.on('dragend', event => {
        const point = event.target.getLatLng();
        stop.lat = point.lat;
        stop.lon = point.lng;
        stop.address = '';
        draft = M.reconcile(draft);
        changed();
        drawMap();
      });
      marker.bindTooltip(escape(stop.name || 'Destination '+(index+1)));
    });
    if (drawnPoints.length) L.polyline(drawnPoints, {color:'#8d2637', weight:3, dashArray:'3 5', interactive:false}).addTo(layers);
    if (fit && bounds.length) map.fitBounds(bounds, {padding:[35,35], maxZoom:12, animate:false});
    get('plannerMapHint').textContent = mapAction?.kind === 'draw' ? 'Click along the route, then choose Finish drawing.'
      : mapAction?.kind === 'relocate' ? 'Click the new location for this destination.'
      : 'Click the map to add a destination.';
    get('plannerDrawActions').hidden = mapAction?.kind !== 'draw';
  }
  function addStop(index, point) {
    readDetails();
    request?.abort();
    const stop = {...point, id:newId(), name:point?.name || ''};
    draft.stops.splice(index, 0, stop);
    draft = M.reconcile(draft);
    changed();
    selected = point ? {stopId:stop.id} : null;
    itinerary();
    renderDetails();
    drawMap(!!point);
    get('plannerStop'+index)?.focus();
  }
  function onMapClick(event) {
    if (mapAction?.kind === 'draw') {
      drawnPoints.push([event.latlng.lat, event.latlng.lng]);
      drawMap();
      return;
    }
    const point = {lat:event.latlng.lat, lon:event.latlng.lng};
    if (mapAction?.kind === 'relocate') {
      const stop = draft.stops.find(row => row.id === mapAction.stopId);
      Object.assign(stop, point, {address:''});
      mapAction = null;
      draft = M.reconcile(draft);
      changed();
      itinerary();
      renderDetails();
      drawMap();
      return;
    }
    const empty = draft.stops.findIndex(stop => !stop.name && !M.positioned(stop));
    point.name = 'Map destination '+(empty >= 0 ? empty+1 : draft.stops.length+1);
    if (empty >= 0) {
      Object.assign(draft.stops[empty], point);
      selected = {stopId:draft.stops[empty].id};
      draft = M.reconcile(draft);
      changed();
      itinerary();
      renderDetails();
      drawMap();
    } else addStop(draft.stops.length, point);
  }
  function beginDrawing() {
    const segment = draft.segments.find(row => row.id === selected?.segmentId);
    const start = draft.stops.find(row => row.id === segment?.fromStopId);
    const end = draft.stops.find(row => row.id === segment?.toStopId);
    if (!M.positioned(start) || !M.positioned(end)) return message('Map both destinations before drawing this connection.', true);
    mapAction = {kind:'draw', segmentId:segment.id};
    drawnPoints = [[Number(start.lat), Number(start.lon)]];
    mobileMap = true;
    get('tripPlannerWorkspace').classList.add('show-map');
    get('plannerDetails').hidden = true;
    drawMap();
    map.invalidateSize();
  }
  function finishDrawing() {
    const segment = draft.segments.find(row => row.id === mapAction?.segmentId);
    const start = draft.stops.find(row => row.id === segment?.fromStopId);
    const end = draft.stops.find(row => row.id === segment?.toStopId);
    if (!segment || !start || !end) return;
    segment.route = {kind:'manual', label:'Manually drawn route', coordinates:[...drawnPoints, [Number(end.lat), Number(end.lon)]], signature:M.segmentSignature(segment,start,end)};
    mapAction = null;
    drawnPoints = [];
    changed();
    itinerary();
    renderDetails();
    drawMap();
  }
  async function findRoute() {
    readDetails();
    const segment = draft.segments.find(row => row.id === selected?.segmentId);
    const start = draft.stops.find(row => row.id === segment?.fromStopId);
    const end = draft.stops.find(row => row.id === segment?.toStopId);
    if (!M.positioned(start) || !M.positioned(end)) return message('Choose mapped locations for both destinations first.', true);
    const expectedOwner = scope(), expectedDraft = draft.id;
    const signature = M.segmentSignature(segment,start,end);
    request?.abort();
    request = new AbortController();
    const own = request, timer = setTimeout(() => own.abort(), 30000);
    message('Looking for a mapped connection…');
    try {
      const result = segment.mode === 'flight'
        ? {coordinates:HVRouteGeometry.flightArc(start,end), illustrative:true, label:'Illustrative flight connection'}
        : await HVJourneyMap.route(modeFor(segment.mode).type,start,end,own.signal);
      if (scope() !== expectedOwner || draft.id !== expectedDraft || own.signal.aborted) return;
      const current = draft.segments.find(row => row.id === segment.id);
      const a = draft.stops.find(row => row.id === current?.fromStopId);
      const b = draft.stops.find(row => row.id === current?.toStopId);
      if (!current || signature !== M.segmentSignature(current,a,b)) return;
      if (result.unavailable || !M.coordinates(result).length) throw Error('No mapped connection is available. You can draw this section or keep its illustrative connection.');
      current.route = {...result, kind:result.illustrative?'illustrative':'routed', signature};
      if (['bus','coach','taxi','shuttle'].includes(current.mode)) current.route.label = 'Road estimate · no timetable';
      changed();
      itinerary();
      renderDetails();
      drawMap();
    } catch (error) {
      if (scope() === expectedOwner && draft.id === expectedDraft) message(own.signal.aborted
        ? 'Route lookup timed out. You can draw this section or keep its illustrative connection.' : error.message, true);
    } finally { clearTimeout(timer); }
  }
  function savedJourneys() {
    const select = get('plannerSaved');
    if (!select) return;
    const records = HVJourney.scoped(state.roadTrips || [], state.activeProfileId);
    const saved = records.map(record => '<option value="'+escape(record.id)+'"'+(record.id===draft.id?' selected':'')+'>'+escape(record.name || 'Journey')+'</option>').join('');
    const importedTrips = new Set(records.filter(record => record.sourceRecords?.length).map(record => record.tripId));
    const trips = HVJourney.scoped(state.trips || [], state.activeProfileId).filter(trip => !importedTrips.has(trip.id));
    const looseTransport = HVJourney.scoped(state.transports || [], state.activeProfileId)
      .filter(record => !record.tripId && !M.hiddenLegacyTransport(state, record));
    const existing = trips.map(trip => '<option value="calendar-trip:'+escape(encodeURIComponent(trip.id))+'">'+escape(trip.name || 'Calendar journey')+'</option>')
      .concat(looseTransport.map(record => '<option value="calendar-transport:'+escape(encodeURIComponent(record.id))+'">'+escape(HVJourney.transportLabel(record))+'</option>')).join('');
    select.innerHTML = '<option value="">Saved journeys</option>'+(saved?'<optgroup label="Saved journeys">'+saved+'</optgroup>':'')
      +(existing?'<optgroup label="From your calendar">'+existing+'</optgroup>':'');
  }
  function save(asCopy = false) {
    readDetails();
    draft.name = get('plannerName').value.trim() || defaultName();
    draft = M.reconcile(draft);
    const problem = M.validate(draft);
    if (problem) return message(problem, true);
    const records = state.roadTrips || [];
    const current = records.find(record => record.id === draft.id);
    if (!asCopy && (current ? baseline !== (current.updatedAt || '') : baseline != null)) {
      remoteChanged = true;
      message('This journey changed elsewhere. Load that version or save your draft as a copy.', true);
      updateStatus();
      return false;
    }
    const record = copy(draft);
    if (!asCopy && record.sourceRecords?.length) {
      const sourceKey = source => JSON.stringify([source.collection, source.id, source.tripId || null, source.profileId || null]);
      const sources = new Set(record.sourceRecords.map(sourceKey));
      const existingOwner = records.find(row => row.id !== record.id && row.plannerVersion === 2
        && row.sourceRecords?.some(source => sources.has(sourceKey(source))));
      if (existingOwner) return message('These calendar records are already in '+existingOwner.name+'. Open that saved journey to edit them.', true);
    }
    if (asCopy) {
      record.id = newId();
      record.name += ' copy';
      delete record.linkedTransportId;
      delete record.tripId;
      delete record.sourceRecords;
      for (const segment of record.segments) delete segment.sourceRecord;
      for (const segment of record.previousSegments || []) delete segment.sourceRecord;
      for (const stop of record.stops) if (stop.accommodation) delete stop.accommodation.sourceRecord;
    }
    record.updatedAt = new Date().toISOString();
    const next = records.filter(row => row.id !== record.id).concat(record);
    try {
      const size = WIBAccountSize.measure({...state, roadTrips:next});
      if (size.bytes > size.limit) throw Error('Account storage is full. Remove a planner image or export a backup before saving.');
      WIBModel.validateImport({roadTrips:[record]});
    } catch (error) { message(error.message, true); return false; }
    state.roadTrips = next;
    if (persist() === false) {
      state.roadTrips = records;
      message('Could not save. Your draft is still open so you can retry.', true);
      return false;
    }
    draft = copy(record);
    baseline = record.updatedAt;
    dirty = false;
    remoteChanged = false;
    remember();
    HVData.observe(state);
    window.HVPages?.invalidateViews?.(['calendar','roadTrip']);
    renderAll();
    get('plannerName').value = draft.name;
    savedJourneys();
    message('Saved');
    updateStatus();
    window.dispatchEvent(new CustomEvent('hv-planner-saved', {detail:{plannerId:record.id}}));
    return true;
  }
  function open(id, selection = {}) {
    initialise();
    readDetails();
    if (dirty && draft.id !== id && !confirm('Open another journey? This unsaved draft will be replaced.')) return false;
    const record = (state.roadTrips || []).find(row => row.id === id);
    if (!record) return false;
    get('plannerDetails')?.replaceChildren();
    mapAction = null;
    drawnPoints = [];
    if (dirty && draft.id === id) {
      selected = selection;
    } else {
      invalidateImageRequests();
      draft = M.normalize(record);
      baseline = record.updatedAt || '';
      dirty = false;
      remoteChanged = false;
      selected = selection;
    }
    remember();
    viewStale = true;
    switchView('roadTrip');
    focusDetails();
    return true;
  }
  function openExisting(options) {
    initialise();
    readDetails();
    const collection = options.transportId ? 'transports' : 'accommodations';
    const id = options.transportId || options.accommodationId;
    const sourceRecord = (state[options.tripId ? 'trips' : collection] || []).find(record => record.id === (options.tripId || id));
    if (!sourceRecord || !HVJourney.scoped([sourceRecord], state.activeProfileId).length) return false;
    const matchesSource = (source, row, key) => source.collection === key && source.id === row.id
      && (source.tripId || null) === (row.tripId || null)
      && (source.profileId || null) === (row.profileId || null);
    const previous = HVJourney.scoped(state.roadTrips || [], state.activeProfileId).find(record => {
      if (record.plannerVersion !== 2) return false;
      if (!options.tripId) return record.sourceRecords?.some(source => matchesSource(source, sourceRecord, collection));
      if (record.tripId !== options.tripId || !record.sourceRecords?.length) return false;
      if (sourceRecord.profileId && !HVJourney.scoped([record], sourceRecord.profileId).length) return false;
      return record.sourceRecords.every(source => {
        const row = (state[source.collection] || []).find(item => item.id === source.id);
        return row && row.tripId === options.tripId && matchesSource(source, row, source.collection);
      });
    });
    if (previous) {
      const segment = options.transportId && previous.segments?.find(row => row.sourceRecord?.id === options.transportId);
      const stop = options.accommodationId && previous.stops?.find(row => row.accommodation?.sourceRecord?.id === options.accommodationId);
      return open(previous.id, {segmentId:segment?.id, stopId:stop?.id});
    }
    if (dirty && !confirm('Open this calendar journey? Save first to keep your current unsaved draft.')) return false;
    const existing = M.fromExisting(state, options);
    if (!existing) return false;
    if ((state.roadTrips || []).some(record => record.id === existing.id)) existing.id = newId();
    get('plannerDetails')?.replaceChildren();
    mapAction = null;
    drawnPoints = [];
    invalidateImageRequests();
    draft = existing;
    baseline = null;
    dirty = true;
    remoteChanged = false;
    selected = options.accommodationId ? {stopId:draft.stops.find(stop=>stop.accommodation?.sourceRecord?.id===options.accommodationId)?.id}
      : options.transportId ? {segmentId:draft.segments[0]?.id} : null;
    saveMessage = 'Calendar journey opened · save to keep planner edits';
    remember();
    HVCalendar?.clearSelection(false);
    viewStale = true;
    switchView('roadTrip');
    focusDetails();
    return true;
  }
  function openGroup(key) {
    const separator = key.indexOf(':'), kind = key.slice(0,separator), id = key.slice(separator+1);
    if (kind === 'trip') return openExisting({tripId:id});
    if (kind === 'transport') return openExisting({transportId:id});
    const group = window.HVCalendar?.journeyGroups().find(row => row.key === key);
    if (group?.trip) return openExisting({tripId:group.trip.id});
    if (group?.transports[0]) return openExisting({transportId:group.transports[0].id});
    if (group?.accommodations[0]) return openExisting({accommodationId:group.accommodations[0].id});
    switchView('roadTrip');
    return true;
  }
  function create(context = {}) {
    initialise();
    readDetails();
    if (dirty && !confirm('Start a new journey? Save first to keep your current unsaved draft.')) return false;
    get('plannerDetails')?.replaceChildren();
    mapAction = null;
    drawnPoints = [];
    invalidateImageRequests();
    draft = newJourney();
    const start = context.start || context.startDate;
    const end = context.end || context.endDate || start;
    if (HVJourney.validDate(start)) draft.stops[0].departureLocal = start;
    if (HVJourney.validDate(end)) draft.stops[1].arrivalLocal = end;
    baseline = null;
    dirty = false;
    selected = null;
    saveMessage = '';
    remoteChanged = false;
    viewStale = true;
    remember();
    switchView('roadTrip');
    get('plannerStop0')?.focus();
    return true;
  }
  async function upload(file) {
    if (!file) return;
    readDetails();
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) return message('Choose a JPEG, PNG, WebP or GIF image.', true);
    if (file.size > 20*1024*1024) return message('Choose an image smaller than 20 MB.', true);
    const identity = {scope:scope(), journey:draft.id, selection:copy(selected), epoch:draftEpoch};
    const key = imageKey(identity.selection), token = Symbol();
    imageRequests.set(key, token);
    const current = () => identity.epoch === draftEpoch && identity.scope === scope()
      && identity.journey === draft?.id && imageRequests.get(key) === token;
    let source;
    try {
      source = URL.createObjectURL(file);
      const image = new Image();
      image.src = source;
      await image.decode();
      if (!current()) return;
      const ratio = Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.naturalWidth*ratio));
      canvas.height = Math.max(1,Math.round(image.naturalHeight*ratio));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const src = canvas.toDataURL('image/webp',.76);
      readDetails();
      const item = identity.selection?.stopId ? draft.stops.find(row => row.id === identity.selection.stopId)
        : draft.segments.find(row => row.id === identity.selection?.segmentId);
      if (!item) return;
      const before = item.media;
      item.media = [{id:newId(), src, name:file.name, width:canvas.width, height:canvas.height}];
      const withDraft = (state.roadTrips || []).filter(row => row.id !== draft.id).concat(draft);
      if (WIBAccountSize.measure({...state,roadTrips:withDraft}).bytes > WIBAccountSize.limit) {
        item.media = before;
        return message('This image would exceed account storage. Use a smaller image or remove another planner image.', true);
      }
      changed();
      itinerary();
      renderDetails();
    } catch { if (current()) message('This image could not be read. Try another file.', true); }
    finally {
      if (imageRequests.get(key) === token) imageRequests.delete(key);
      if (source) URL.revokeObjectURL(source);
    }
  }
  function viewCalendar() {
    readDetails();
    const stop = draft.stops.find(row => row.id === selected?.stopId);
    const segment = draft.segments.find(row => row.id === selected?.segmentId);
    const when = date(segment?.departureLocal || segment?.arrivalLocal || stop?.arrivalLocal || stop?.departureLocal || stop?.accommodation?.checkIn);
    if (!when) return message('Add a date to see this destination or connection in Calendar.');
    if (dirty && !save()) return;
    switchView('calendar');
    window.HVSimpleCalendar?.showDate(when,'day');
  }
  function perform(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.selectStop) return choose({stopId:button.dataset.selectStop});
    if (button.dataset.selectSegment) return choose({segmentId:button.dataset.selectSegment});
    if (button.dataset.copyPrevious) {
      readDetails();
      const previousId = button.dataset.copyPrevious;
      const targetId = get('plannerPreviousConnections')?.querySelector('[data-previous-target="'+CSS.escape(previousId)+'"]')?.value;
      draft = M.copyPreviousDetails(draft, previousId, targetId);
      selected = {segmentId:targetId};
      changed();
      itinerary();
      renderDetails();
      drawMap();
      focusDetails();
      return;
    }
    if (button.hasAttribute('data-insert-stop')) return addStop(Number(button.dataset.insertStop));
    if (button.hasAttribute('data-move-stop')) {
      readDetails();
      const from = Number(button.dataset.moveStop), to = from+Number(button.dataset.direction);
      if (to < 0 || to >= draft.stops.length) return;
      draft.stops.splice(to,0,draft.stops.splice(from,1)[0]);
      draft = M.reconcile(draft);
      changed();
      itinerary();
      renderDetails();
      drawMap();
      return;
    }
    if (button.dataset.removeStop && draft.stops.length > 2) {
      readDetails();
      draft.stops = draft.stops.filter(stop => stop.id !== button.dataset.removeStop);
      draft = M.reconcile(draft);
      selected = null;
      changed();
      itinerary();
      renderDetails();
      drawMap();
      return;
    }
    if (button.hasAttribute('data-close-details') || button.hasAttribute('data-detail-done')) {
      const previous = selected;
      readDetails();
      selected = null;
      itinerary();
      renderDetails();
      drawMap();
      const attribute = previous?.stopId ? 'data-select-stop' : 'data-select-segment';
      const id = previous?.stopId || previous?.segmentId;
      get('plannerStopList')?.querySelector('['+attribute+'="'+CSS.escape(id || '')+'"]')?.focus({preventScroll:true});
    }
    if (button.dataset.mapRelocate) {
      mapAction = {kind:'relocate',stopId:button.dataset.mapRelocate};
      mobileMap = true;
      get('tripPlannerWorkspace').classList.add('show-map');
      get('plannerDetails').hidden = true;
      drawMap();
      map?.invalidateSize();
    }
    if (button.hasAttribute('data-route-lookup')) findRoute();
    if (button.hasAttribute('data-route-draw')) beginDrawing();
    if (button.hasAttribute('data-route-reset')) {
      const segment = draft.segments.find(row => row.id === selected?.segmentId);
      if (segment) { delete segment.route; changed(); itinerary(); renderDetails(); drawMap(); }
    }
    if (button.hasAttribute('data-entry-calendar')) viewCalendar();
    if (button.hasAttribute('data-add-activity')) {
      readDetails();
      const stop = draft.stops.find(row => row.id === selected?.stopId);
      stop.activities ||= [];
      stop.activities.push({id:newId(),name:'',date:date(stop.arrivalLocal)});
      changed();
      renderDetails();
    }
    if (button.dataset.removeActivity) {
      readDetails();
      const stop = draft.stops.find(row => row.id === selected?.stopId);
      stop.activities = stop.activities.filter(row => row.id !== button.dataset.removeActivity);
      changed();
      renderDetails();
    }
    if (button.hasAttribute('data-remove-media')) {
      readDetails();
      imageRequests.delete(imageKey(selected));
      const item = draft.stops.find(row => row.id === selected?.stopId) || draft.segments.find(row => row.id === selected?.segmentId);
      delete item.media;
      changed();
      itinerary();
      renderDetails();
    }
  }
  function renderPage() {
    initialise();
    readDetails();
    cleanup();
    const host = get('roadTripPlannerTool');
    if (!host) return;
    viewStale = false;
    host.innerHTML = `<div id="tripPlannerWorkspace" class="trip-planner-workspace ${mobileMap?'show-map':''}">
      <section class="planner-itinerary" aria-label="Journey itinerary">
        <header class="planner-toolbar">
          <label class="sr-only" for="plannerSaved">Open a saved journey</label><select id="plannerSaved"></select>
          <button type="button" class="planner-icon-button" id="plannerNew" aria-label="New journey">+</button>
        </header>
        <div class="planner-journey-title"><label class="sr-only" for="plannerName">Journey name</label><input id="plannerName" value="${escape(draft.name === 'New journey'?'':draft.name)}" placeholder="Name your journey"></div>
        <div id="plannerConflict" class="planner-conflict" role="status" ${remoteChanged?'':'hidden'}>This journey changed on another device.<button type="button" id="plannerReload">Load saved version</button><button type="button" id="plannerCopy">Save draft as copy</button></div>
        <div class="planner-search-filter"><label for="plannerSearchFilter">Search</label><select id="plannerSearchFilter">${[['other','All places'],['flight','Airports'],['bus','Bus & coach stops'],['train','Railway stations'],['boat','Ports & ferry terminals'],['accommodation','Hotels & accommodation']].map(([value,label])=>'<option value="'+value+'"'+(searchFilter===value?' selected':'')+'>'+label+'</option>').join('')}</select></div>
        <ol id="plannerStopList" class="planner-stop-list"></ol>
        <button type="button" class="planner-add-stop" id="plannerAddStop">+ Add destination</button>
        <details id="plannerPreviousConnections" class="planner-previous-connections" hidden></details>
        <footer class="planner-save-bar"><button type="button" class="primary" id="plannerSave">Save journey</button><span id="plannerSaveStatus" role="status" aria-live="polite">${escape(saveMessage)}</span></footer>
      </section>
      <div class="planner-map-area"><div id="tripPlannerMap" class="trip-planner-map" role="region" aria-label="Interactive journey map"></div>
        <div class="planner-map-actions"><button type="button" class="secondary" id="plannerFit">Fit journey</button><span id="plannerMapHint" role="status">Click the map to add a destination.</span>
          <span id="plannerDrawActions" hidden><button type="button" class="primary" id="plannerFinishDraw">Finish drawing</button><button type="button" class="secondary" id="plannerCancelDraw">Cancel</button></span>
        </div>
      </div>
      <aside id="plannerDetails" class="planner-details" aria-label="Selected journey item" hidden></aside>
      <button type="button" class="planner-mobile-toggle" id="plannerMobileToggle">${mobileMap?'Show itinerary':'Show map'}</button>
    </div>`;
    host.onclick = perform;
    host.onkeydown = event => {
      if (event.key !== 'Escape') return;
      if (mapAction) {
        mapAction = null;
        drawnPoints = [];
        renderDetails();
        drawMap();
        focusDetails();
      } else get('plannerDetails')?.querySelector('[data-close-details]')?.click();
    };
    host.onchange = event => {
      const target = event.target;
      if (target.matches('[data-planner-upload]')) {
        upload(target.files[0]);
        return;
      }
      if (target.dataset.segmentMode) {
        readDetails();
        const segment = draft.segments.find(row => row.id === target.dataset.segmentMode);
        segment.mode = target.value;
        delete segment.route;
        changed();
        itinerary();
        renderDetails();
        drawMap();
      }
      if (target.closest('#plannerDetailForm')) { readDetails(); drawMap(); }
    };
    get('plannerName').oninput = () => { draft.name = get('plannerName').value; changed(); };
    get('plannerSearchFilter').onchange = event => { searchFilter = event.target.value; bindings.forEach(binding => binding.clear()); };
    get('plannerSaved').onchange = event => {
      const value = event.target.value;
      if (value.startsWith('calendar-trip:')) openExisting({tripId:decodeURIComponent(value.slice(14))});
      else if (value.startsWith('calendar-transport:')) openExisting({transportId:decodeURIComponent(value.slice(19))});
      else if (value) open(value);
    };
    get('plannerSave').onclick = () => save();
    get('plannerCopy').onclick = () => save(true);
    get('plannerReload').onclick = () => { dirty=false; open(draft.id,selected || {}); };
    get('plannerNew').onclick = () => create();
    get('plannerAddStop').onclick = () => addStop(draft.stops.length);
    get('plannerFit').onclick = () => drawMap(true);
    get('plannerFinishDraw').onclick = finishDrawing;
    get('plannerCancelDraw').onclick = () => { mapAction=null; drawnPoints=[]; renderDetails(); drawMap(); };
    get('plannerMobileToggle').onclick = () => {
      readDetails();
      mobileMap = !mobileMap;
      get('tripPlannerWorkspace').classList.toggle('show-map',mobileMap);
      get('plannerMobileToggle').textContent = mobileMap?'Show itinerary':'Show map';
      requestAnimationFrame(() => map?.invalidateSize({pan:false}));
    };
    const list = get('plannerStopList');
    list.ondragstart = event => {
      if (event.target.closest('input,select,button')) return event.preventDefault();
      dragging = event.target.closest('[data-stop-id]')?.dataset.stopId;
      if (dragging) event.dataTransfer.setData('text/plain',dragging);
    };
    list.ondragover = event => { if (dragging && event.target.closest('[data-stop-id]')) event.preventDefault(); };
    list.ondrop = event => {
      event.preventDefault();
      const target = event.target.closest('[data-stop-id]')?.dataset.stopId;
      const from = draft.stops.findIndex(stop => stop.id === dragging), to = draft.stops.findIndex(stop => stop.id === target);
      dragging = null;
      if (from<0 || to<0 || from===to) return;
      readDetails();
      draft.stops.splice(to,0,draft.stops.splice(from,1)[0]);
      draft = M.reconcile(draft);
      changed();
      itinerary();
      renderDetails();
      drawMap();
    };
    savedJourneys();
    itinerary();
    renderDetails();
    if (window.L) {
      map = L.map(get('tripPlannerMap'), {scrollWheelZoom:true, zoomAnimation:false, fadeAnimation:false}).setView([24,0],2);
      HVJourneyMap.mountBasemap(map, {defaultStyle:'street'});
      map.on('click',onMapClick);
      requestAnimationFrame(() => { map?.invalidateSize(); drawMap(true); });
    } else message('The map is still loading. Saved journeys and itinerary editing remain available.');
    updateStatus();
  }
  function renderCurrent() {
    if (document.body.dataset.currentView === 'roadTrip') {
      initialise();
      if (map && !viewStale) {
        map.invalidateSize({pan:false});
        updateStatus();
      } else renderPage();
    } else if (map) {
      readDetails();
      remember();
      request?.abort();
    }
  }
  window.addEventListener('hv-route',renderCurrent);
  document.addEventListener('DOMContentLoaded',renderCurrent);
  window.addEventListener('hv-data-changed', () => {
    viewStale = true;
    if (owner !== scope()) {
      readDetails();
      remember();
      invalidateImageRequests();
      cleanup();
      selected = null;
      get('plannerDetails')?.replaceChildren();
      draft = null;
      if (document.body.dataset.currentView === 'roadTrip') renderPage();
      return;
    }
    const record = (state.roadTrips || []).find(row => row.id === draft?.id);
    if (record && (record.updatedAt || '') !== baseline) {
      if (!dirty) {
        invalidateImageRequests();
        get('plannerDetails')?.replaceChildren();
        draft = M.normalize(record);
        baseline = record.updatedAt || '';
        if (document.body.dataset.currentView === 'roadTrip') renderPage();
      } else { remoteChanged=true; updateStatus(); }
    } else if (!record && baseline != null) {
      remoteChanged = true;
      message('This journey was deleted elsewhere. Save your draft as a copy to keep these changes.');
      updateStatus();
    }
    savedJourneys();
  });
  window.addEventListener('beforeunload', () => { readDetails(); remember(); });
  window.addEventListener('click', event => {
    const plan = event.target.closest('[data-calendar-plan]');
    if (plan) {
      event.preventDefault();
      event.stopImmediatePropagation();
      create({start:calendarSelectionStart || window.HVSimpleCalendar?.date, end:calendarSelectionEnd || calendarSelectionStart || window.HVSimpleCalendar?.date});
      return;
    }
    const trigger = event.target.closest('[data-planner-open-trip],[data-planner-record-kind],[data-journey-map],[data-journey-view],[data-calendar-open-journey]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (trigger.dataset.plannerOpenTrip) openExisting({tripId:trigger.dataset.plannerOpenTrip});
    else if (trigger.dataset.plannerRecordKind) openExisting(trigger.dataset.plannerRecordKind === 'transport'
      ? {transportId:trigger.dataset.plannerRecordId} : {accommodationId:trigger.dataset.plannerRecordId});
    else openGroup(trigger.dataset.journeyMap || trigger.dataset.journeyView || trigger.dataset.calendarOpenJourney);
  }, true);
  window.HVTripPlanner = {open, openExisting, openGroup, create, render:renderPage};
  // Old calendar links can still open a saved road journey through this alias.
  window.HVRoadPlanner = window.HVTripPlanner;
})();

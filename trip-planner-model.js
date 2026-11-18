/* Canonical journey graphs and read-only Calendar projections. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const modes = [
    { id: 'car', label: 'Driving', type: 'car', searchContext: 'other' },
    { id: 'walk', label: 'Walking', type: 'walk', searchContext: 'other' },
    { id: 'bus', label: 'Bus', type: 'bus', searchContext: 'bus' },
    { id: 'coach', label: 'Coach', type: 'bus', searchContext: 'bus' },
    { id: 'train', label: 'Train', type: 'train', searchContext: 'train' },
    { id: 'metro', label: 'Metro / Tram', type: 'train', searchContext: 'train' },
    { id: 'boat', label: 'Boat', type: 'boat', searchContext: 'boat' },
    { id: 'ferry', label: 'Ferry', type: 'boat', searchContext: 'boat' },
    { id: 'flight', label: 'Flight', type: 'flight', searchContext: 'flight' },
    { id: 'taxi', label: 'Taxi', type: 'car', searchContext: 'other' },
    { id: 'shuttle', label: 'Private transfer / Shuttle', type: 'car', searchContext: 'other' },
    { id: 'cycle', label: 'Cycling', type: 'other', searchContext: 'other' },
    { id: 'other', label: 'Other / Custom', type: 'other', searchContext: 'other' },
  ];
  const byMode = new Map(modes.map(mode => [mode.id, mode]));
  const finite = value => value !== '' && value != null && typeof value !== 'boolean' && Number.isFinite(Number(value));
  const positioned = stop => finite(stop?.lat) && finite(stop?.lon) && Math.abs(Number(stop.lat)) <= 90 && Math.abs(Number(stop.lon)) <= 180;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  function validLocal(value) {
    if (validDate(value)) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
    return validDate(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60;
  }
  const day = value => validLocal(value) ? value.slice(0, 10) : '';
  const entryId = (plannerId, kind, id) => 'planner:' + [plannerId, kind, id].map(value => encodeURIComponent(String(value))).join(':');
  const pair = (start, end) => JSON.stringify([start, end]);
  function segmentSignature(segment, start, end) {
    return JSON.stringify([segment.mode, [start?.lat, start?.lon], [end?.lat, end?.lon]]);
  }
  function coordinates(route) {
    let value = route?.coordinates;
    if (!Array.isArray(value) && typeof route?.polyline === 'string') {
      // Account pages validate backups before the map/routing scripts load.
      let index = 0, latitude = 0, longitude = 0;
      const next = () => {
        let total = 0, multiplier = 1, byte, count = 0;
        do {
          if (index >= route.polyline.length || ++count > 12) throw Error('Invalid route');
          byte = route.polyline.charCodeAt(index++) - 63;
          if (byte < 0 || byte > 63) throw Error('Invalid route');
          total += byte % 32 * multiplier;
          multiplier *= 32;
        } while (byte >= 32);
        return total % 2 ? -(Math.floor(total / 2) + 1) : Math.floor(total / 2);
      };
      value = [];
      try {
        while (index < route.polyline.length) {
          latitude += next();
          longitude += next();
          value.push([latitude / 1e7, longitude / 1e7]);
        }
      } catch { return []; }
    }
    return Array.isArray(value) && value.length >= 2 && value.every(point => Array.isArray(point) && point.length >= 2 && finite(point[0]) && finite(point[1]) && Math.abs(Number(point[0])) <= 90 && Math.abs(Number(point[1])) <= 180) ? value.map(point => [Number(point[0]), Number(point[1])]) : [];
  }
  function uniqueId(preferred, used, fallback) {
    let id = typeof preferred === 'string' && preferred ? preferred : fallback;
    const base = id;
    for (let suffix = 2; used.has(id); suffix++) id = base + ':' + suffix;
    used.add(id);
    return id;
  }
  function normalize(road = {}) {
    const result = copy(road), legacy = road.plannerVersion !== 2, usedStops = new Set();
    result.plannerVersion = 2;
    result.stops = (Array.isArray(road.stops) ? road.stops : []).map((stop, index) => {
      const item = { ...copy(stop), id: uniqueId(stop?.id, usedStops, 'stop:' + (road.id || 'draft') + ':' + index) };
      if (legacy) {
        item.arrivalLocal = stop.arrivalLocal || stop.date || (index === 0 ? road.startDate : index === road.stops.length - 1 ? road.endDate : '') || '';
        item.departureLocal = stop.departureLocal || stop.date || '';
      }
      return item;
    });
    result.status = road.status || 'idea';
    result.name = String(road.name || '').trim() || [result.stops[0]?.name, result.stops.at(-1)?.name].filter(Boolean).join(' → ') || 'New journey';
    if (legacy) {
      const oldSignature = JSON.stringify(['road-v1', result.stops.map(stop => [String(stop.name || ''), String(stop.address || ''), Number(stop.lat), Number(stop.lon)])]);
      const savedRoute = road.route?.signature === oldSignature ? road.route : null;
      result.segments = result.stops.slice(1).map((end, index) => {
        const start = result.stops[index], route = savedRoute?.legs?.[index];
        const segment = {
          id: 'segment:' + index + ':' + start.id + ':' + end.id,
          fromStopId: start.id,
          toStopId: end.id,
          mode: 'car',
          departureLocal: road.stops[index].date || road.startDate || '',
          arrivalLocal: road.stops[index + 1].date || road.endDate || '',
        };
        if (coordinates(route).length) segment.route = { ...copy(route), kind: route.illustrative ? 'illustrative' : 'routed', signature: segmentSignature(segment, start, end) };
        return segment;
      });
    }
    return reconcile(result);
  }
  function reconcile(road) {
    if (road?.plannerVersion !== 2) return normalize(road);
    const result = copy(road), usedStops = new Set(), usedSegments = new Set();
    result.stops = (Array.isArray(result.stops) ? result.stops : []).map((stop, index) => ({
      ...stop, id: uniqueId(stop.id, usedStops, 'stop:' + (road.id || 'draft') + ':' + index),
    }));
    const archived = Array.isArray(result.previousSegments) ? result.previousSegments : [];
    const previous = new Map([...archived, ...(Array.isArray(result.segments) ? result.segments : [])].map(segment => [pair(segment.fromStopId, segment.toStopId), segment]));
    const connected = new Set();
    result.segments = result.stops.slice(1).map((end, index) => {
      const start = result.stops[index], key = pair(start.id, end.id), saved = previous.get(key);
      connected.add(key);
      const segment = { ...saved, id: uniqueId(saved?.id, usedSegments, 'segment:' + start.id + ':' + end.id), fromStopId: start.id, toStopId: end.id, fromName: start.name, toName: end.name, mode: saved?.mode || 'other' };
      if (segment.route?.signature && segment.route.signature !== segmentSignature(segment, start, end)) delete segment.route;
      return segment;
    });
    // Structural edits must not silently delete bookings, dates, notes or images.
    // Reconnecting the same endpoints restores their original section automatically.
    const identity = new Set(['id', 'fromStopId', 'toStopId', 'fromName', 'toName', 'mode']);
    const meaningful = segment => segment.mode !== 'other' || Object.entries(segment).some(([key, value]) => !identity.has(key) && value != null && value !== '' && (!Array.isArray(value) || value.length));
    const displaced = [...previous.entries()].filter(([key, segment]) => !connected.has(key) && meaningful(segment)).map(([, segment]) => segment);
    if (displaced.length) result.previousSegments = displaced;
    else delete result.previousSegments;
    return result;
  }
  function copyPreviousDetails(road, previousId, targetId) {
    const result = reconcile(road), previous = result.previousSegments?.find(segment => segment.id === previousId);
    const target = result.segments.find(segment => segment.id === targetId);
    if (!previous || !target) return result;
    // Fill gaps only; copying never replaces details already entered for this leg.
    for (const key of ['customLabel', 'departureLocal', 'arrivalLocal', 'operator', 'serviceNumber', 'bookingReference', 'durationMinutes', 'durationKind', 'cost', 'notes', 'media']) {
      if ((target[key] == null || target[key] === '' || Array.isArray(target[key]) && !target[key].length) && previous[key] != null) target[key] = copy(previous[key]);
    }
    if (target.mode === 'other') target.mode = previous.mode;
    return reconcile(result);
  }
  function validate(road) {
    const accommodationSource = road?.stops?.[0]?.accommodation?.sourceRecord;
    const singleAccommodation = road?.stops?.length === 1 && accommodationSource?.collection === 'accommodations' && (road.sourceRecords || []).some(source => source.collection === 'accommodations' && source.id === accommodationSource.id);
    if (!road || !Array.isArray(road.stops) || road.stops.length < (singleAccommodation ? 1 : 2)) return 'Add a starting point and destination.';
    if (road.previousSegments != null && (!Array.isArray(road.previousSegments) || road.previousSegments.some(segment => !segment || typeof segment.id !== 'string' || !segment.id || !byMode.has(segment.mode)))) return 'Check previous journey connections.';
    if (road.stops.some(stop => !stop || typeof stop.name !== 'string' || !stop.name.trim())) return 'Name every destination.';
    if (!['idea', 'planned', 'actual', 'cancelled'].includes(road.status || 'idea')) return 'Choose a valid journey status.';
    const stopIds = road.stops.map(stop => stop.id);
    if (stopIds.some(id => typeof id !== 'string' || !id) || new Set(stopIds).size !== stopIds.length) return 'Each destination needs a unique identifier.';
    if (!Array.isArray(road.segments) || road.segments.length !== road.stops.length - 1) return 'Connect each consecutive destination.';
    const segmentIds = new Set();
    for (const [index, segment] of road.segments.entries()) {
      if (!segment || !segment.id || segmentIds.has(segment.id) || segment.fromStopId !== stopIds[index] || segment.toStopId !== stopIds[index + 1]) return 'Check the order of journey sections.';
      segmentIds.add(segment.id);
      if (!byMode.has(segment.mode)) return 'Choose a transport method for each section.';
      if ([segment.departureLocal, segment.arrivalLocal].some(value => value && !validLocal(value))) return 'Check journey dates and times.';
      if (segment.route && !coordinates(segment.route).length) return 'Check the saved route coordinates.';
      if (segment.durationMinutes != null && segment.durationMinutes !== '' && (!finite(segment.durationMinutes) || Number(segment.durationMinutes) < 0)) return 'Enter a duration of zero or more minutes.';
      if (segment.cost != null && (!finite(segment.cost.amount) || Number(segment.cost.amount) < 0 || !/^[A-Z]{3}$/.test(segment.cost.currency || ''))) return 'Enter a nonnegative cost and a three-letter currency code.';
    }
    for (const stop of road.stops) {
      if ((stop.lat != null && stop.lat !== '' || stop.lon != null && stop.lon !== '') && !positioned(stop)) return 'Check destination coordinates.';
      if ([stop.arrivalLocal, stop.departureLocal].some(value => value && !validLocal(value))) return 'Check destination dates and times.';
      const accommodation = stop.accommodation;
      if (accommodation && [accommodation.checkIn, accommodation.checkOut].some(value => value && !validDate(value))) return 'Check accommodation dates.';
      if (accommodation?.checkIn && accommodation?.checkOut && accommodation.checkOut < accommodation.checkIn) return 'Check-out must be on or after check-in.';
      if (stop.activities && (!Array.isArray(stop.activities) || stop.activities.some(activity => [activity.date, activity.endDate].some(value => value && !validDate(value))))) return 'Check activity dates.';
    }
    return '';
  }
  const sourceReference = (collection, record) => ({ collection, id: record.id, tripId: record.tripId || null, profileId: record.profileId || null });
  function hiddenLegacyRecord(state, collection, record, profileId = state.activeProfileId) {
    if (!record?.id) return false;
    return (state.roadTrips || []).some(road => {
      if (road.plannerVersion !== 2) return false;
      if (profileId && profileId !== 'all' && road.profileId && road.profileId !== profileId && !road.profileIds?.includes(profileId)) return false;
      if (collection === 'transports' && record.roadTripId === road.id && road.linkedTransportId === record.id) return true;
      return (road.sourceRecords || []).some(source => source.collection === collection && source.id === record.id && (source.tripId || null) === (record.tripId || null) && (source.profileId || null) === (record.profileId || null));
    });
  }
  const hiddenLegacyTransport = (state, transport, profileId = state.activeProfileId) => hiddenLegacyRecord(state, 'transports', transport, profileId);
  function fromExisting(state, { tripId, transportId, accommodationId } = {}) {
    const trip = (state.trips || []).find(record => record.id === tripId);
    const transport = (state.transports || []).find(record => record.id === transportId);
    const accommodation = (state.accommodations || []).find(record => record.id === accommodationId);
    const selected = transport || accommodation || trip;
    if (!selected) return null;
    const kind = transport ? 'transport' : accommodation ? 'accommodation' : 'trip';
    const owner = selected.profileId || (state.activeProfileId !== 'all' ? state.activeProfileId : null) || null;
    const scoped = record => !record.profileId || !owner || record.profileId === owner;
    const transports = transport ? [transport] : trip ? (state.transports || []).filter(record => record.tripId === trip.id && scoped(record)) : [];
    const hotels = accommodation ? [accommodation] : trip ? (state.accommodations || []).filter(record => record.tripId === trip.id && scoped(record)) : [];
    const road = { id: 'existing:' + kind + ':' + selected.id, plannerVersion: 2, name: trip?.name || (transport ? transport.name || [transport.start?.name, transport.end?.name].filter(Boolean).join(' → ') : accommodation.propertyName), profileId: owner, tripId: trip?.id || selected.tripId || null, status: ['actual','planned','cancelled'].includes(selected.status) ? selected.status : 'planned', notes: typeof selected.notes === 'string' ? selected.notes : '', stops: [], segments: [], sourceRecords: [] };
    const locationKey = point => positioned(point) ? JSON.stringify([Number(point.lat).toFixed(6), Number(point.lon).toFixed(6), String(point.name || '').trim().toLowerCase()]) : JSON.stringify([point?.externalPlaceId || point?.placeId || point?.id || '', String(point?.name || '').trim().toLowerCase()]);
    const append = (point, id) => {
      const last = road.stops.at(-1);
      if (last && locationKey(last) === locationKey(point) && !last.accommodation) return last;
      const stop = { ...copy(point), id, placeId: point?.externalPlaceId || point?.placeId || point?.id || null };
      road.stops.push(stop);
      return stop;
    };
    const journey = node ? require('./journey-model.js') : root.HVJourney;
    const routeStore = node ? require('./route-persistence.js') : root.HVRouteStore;
    const items = [...transports.map(record => ({ collection: 'transports', record, date: record.startLocal || '' })), ...hotels.map(record => ({ collection: 'accommodations', record, date: record.checkIn || '' }))].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    for (const { collection, record } of items) {
      const source = sourceReference(collection, record);
      road.sourceRecords.push(source);
      if (collection === 'accommodations') {
        const point = { ...copy(record.place), name: record.propertyName || record.place?.name || record.location || 'Accommodation' };
        if (positioned(record)) Object.assign(point, { lat: record.lat, lon: record.lon });
        const stop = append(point, 'existing:hotel:' + record.id);
        stop.accommodation = { ...copy(record), name: record.propertyName || record.place?.name || '', sourceRecord: source };
        continue;
      }
      const type = record.type || 'other';
      const legs = journey ? (type === 'flight' ? journey.flightLegs(record) : journey.groundLegs(record)) : [{start:record.start,end:record.end,startLocal:record.startLocal,endLocal:record.endLocal}];
      const metadata = copy(record);
      for (const key of ['legs', 'via', 'resolvedRoutes', 'price', 'cost']) delete metadata[key];
      for (const [index, leg] of legs.entries()) {
        const start = append(leg.start || { name: 'Starting point' }, 'existing:transport:' + record.id + ':start:' + index);
        const end = { ...copy(leg.end), id: 'existing:transport:' + record.id + ':end:' + index, placeId: leg.end?.externalPlaceId || leg.end?.placeId || leg.end?.id || null };
        road.stops.push(end);
        const provider = leg.operator || record.operator || leg.airline?.name || record.airline?.name || '';
        const cost = leg.cost || leg.price || (legs.length === 1 ? record.cost || record.price : null);
        const segment = { ...copy(metadata), ...copy(leg), id: 'existing:segment:' + record.id + ':' + index, fromStopId: start.id, toStopId: end.id, mode: byMode.has(type) ? type : 'other', departureLocal: leg.startLocal || '', arrivalLocal: leg.endLocal || '', operator: typeof provider === 'object' ? provider.name || '' : provider, serviceNumber: leg.serviceNumber || leg.flightNumber || record.serviceNumber || record.flightNumber || '', cost: copy(cost || null), sourceRecord: source, sourceLegIndex: index };
        const saved = routeStore?.get(record, index, type, leg.start, leg.end, true);
        if (saved && coordinates(saved).length) segment.route = { ...copy(saved), kind: saved.illustrative ? 'illustrative' : 'routed', signature: segmentSignature(segment, start, end) };
        road.segments.push(segment);
      }
    }
    if (!road.stops.length && trip) {
      for (const stay of (state.stays || []).filter(record => record.tripId === trip.id && scoped(record)).sort((a,b) => String(a.start).localeCompare(String(b.start)))) {
        road.stops.push({ id: 'existing:stay:' + stay.id, name: stay.location || stay.countryName || stay.countryCode, countryCode: stay.countryCode, arrivalLocal: stay.start || '', departureLocal: stay.end || '', notes: stay.notes || '', sourceRecord: sourceReference('stays', stay) });
      }
    }
    if (!accommodation) while (road.stops.length < 2) road.stops.push({ id: 'existing:empty:' + road.stops.length, name: '' });
    return normalize(road);
  }
  function calendarEntries(state, profileId = state.activeProfileId) {
    const result = { transports: [], accommodations: [], places: [], notes: [] };
    for (const road of state.roadTrips || []) {
      if (road.plannerVersion !== 2 || road.status === 'cancelled' || profileId !== 'all' && road.profileId && road.profileId !== profileId && !road.profileIds?.includes(profileId)) continue;
      const planner = reconcile(road), stops = new Map(planner.stops.map(stop => [stop.id, stop]));
      const base = { plannerId: road.id, profileId: road.profileId ?? null, tripId: road.tripId || null, travelKind: 'trip', status: road.status === 'actual' ? 'actual' : 'planned' };
      for (const segment of planner.segments) {
        const start = stops.get(segment.fromStopId), end = stops.get(segment.toStopId);
        const departure = segment.departureLocal || start.departureLocal || '', arrival = segment.arrivalLocal || end.arrivalLocal || '';
        if (!day(departure) && !day(arrival)) continue;
        const mode = byMode.get(segment.mode) || byMode.get('other');
        const row = { ...copy(segment), ...base, id: entryId(road.id, 'segment', segment.id), plannerSegmentId: segment.id, plannerMode: mode.id, plannerModeLabel: mode.label, type: mode.type, start: copy(start), end: copy(end), startLocal: departure, endLocal: arrival, dateOnly: !departure.includes('T') && !arrival.includes('T') };
        result.transports.push(row);
      }
      for (const stop of planner.stops) {
        const reference = { ...base, plannerStopId: stop.id }, arrival = day(stop.arrivalLocal), departure = day(stop.departureLocal);
        if (arrival || departure) {
          const dates = [arrival, departure].filter(Boolean).sort();
          result.places.push({ ...reference, id: entryId(road.id, 'stop', stop.id), date: dates[0], endDate: dates.at(-1), category: 'locations', status: 'visited', place: copy(stop), notes: stop.notes || '', media: copy(stop.media) });
        }
        const accommodation = stop.accommodation;
        if (accommodation && (validDate(accommodation.checkIn) || validDate(accommodation.checkOut))) {
          result.accommodations.push({ ...copy(accommodation), ...reference, id: entryId(road.id, 'accommodation', stop.id), propertyName: accommodation.name || accommodation.propertyName || stop.name, location: accommodation.location || stop.address || stop.name, place: copy(stop), checkIn: accommodation.checkIn || '', checkOut: accommodation.checkOut || '' });
        }
        for (const [index, activity] of (stop.activities || []).entries()) {
          if (!validDate(activity.date)) continue;
          result.notes.push({ ...copy(activity), ...reference, category:'Activity', id: entryId(road.id, 'activity', stop.id + ':' + (activity.id || index)), plannerActivityId: activity.id || String(index), title: activity.name || activity.title || 'Activity', body: activity.notes || activity.body || '', endDate: activity.endDate || activity.date });
        }
      }
    }
    return result;
  }
  function findEntry(state, id) {
    const entries = calendarEntries(state, 'all');
    for (const rows of Object.values(entries)) {
      const row = rows.find(entry => entry.id === id);
      if (row) return { plannerId: row.plannerId, ...(row.plannerStopId ? { stopId: row.plannerStopId } : {}), ...(row.plannerSegmentId ? { segmentId: row.plannerSegmentId } : {}) };
    }
    return null;
  }
  const api = { modes, normalize, reconcile, copyPreviousDetails, validate, calendarEntries, findEntry, fromExisting, hiddenLegacyRecord, hiddenLegacyTransport, positioned, coordinates, segmentSignature };
  if (node) module.exports = api;
  else root.HVTripPlannerModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

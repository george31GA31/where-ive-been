/* Journey-led Calendar experience. Keeps Herald's existing records and sync model intact. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id) || window.HVPages?.get(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const E = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const journeyColours = ['#8d2637','#29556b','#8a6d2f','#3c7157','#72567b','#9c5d42','#4b6d8a'];

  let selectedJourneyKey = '';
  let selectedDate = '';
  let planner = null;
  let plannerDialog = null;

  const today = () => isoDate(new Date());
  const localDate = value => String(value || '').slice(0, 10);
  const days = (start, end) => start && end ? Math.max(1, diffDays(start, end) + 1) : 0;
  const dateText = value => value ? fmt(value) : '—';
  const dateRangeText = (start, end) => !start ? 'Dates to be added' : start === end ? dateText(start) : `${dateText(start)} to ${dateText(end)}`;
  const durationText = (start, end) => `${days(start, end)} ${days(start, end) === 1 ? 'day' : 'days'}`;
  const scoped = rows => window.HVJourney.scoped(rows || [], state.activeProfileId);
  const visibleLayers = () => ({countries:true,transport:true,...state.visualLayers?.calendar});

  function hash(value) {
    let result = 0;
    for (const character of String(value)) result = (result * 31 + character.charCodeAt(0)) >>> 0;
    return result;
  }

  function colourFor(key) { return journeyColours[hash(key) % journeyColours.length]; }

  function tripKey(id) { return `trip:${id}`; }
  function stayKey(id) { return `stay:${id}`; }
  function transportKey(id) { return `transport:${id}`; }

  function distanceToRange(date, start, end) {
    if (!date || !start || !end) return Infinity;
    if (date < start) return diffDays(date, start);
    if (date > end) return diffDays(end, date);
    return 0;
  }

  function createGroup(groups, key, trip = null) {
    if (!groups.has(key)) groups.set(key, {
      key,
      trip,
      stays: [],
      transports: [],
      accommodations: [],
      inferredTransportIds: new Set()
    });
    return groups.get(key);
  }

  function buildJourneys() {
    const groups = new Map();
    const trips = scoped(state.trips || []);
    const knownTrips = new Map(trips.map(trip => [trip.id, trip]));

    for (const trip of trips) createGroup(groups, tripKey(trip.id), trip);

    for (const stay of scoped(state.stays || [])) {
      const key = stay.tripId ? tripKey(stay.tripId) : stayKey(stay.id);
      createGroup(groups, key, knownTrips.get(stay.tripId) || null).stays.push(stay);
    }

    for (const accommodation of scoped(state.accommodations || [])) {
      if (!accommodation.tripId) continue;
      createGroup(groups, tripKey(accommodation.tripId), knownTrips.get(accommodation.tripId) || null).accommodations.push(accommodation);
    }

    const findInferredGroup = transport => {
      const transportDates = [localDate(transport.startLocal), localDate(transport.endLocal)].filter(Boolean);
      const candidates = [...groups.values()].filter(group => group.trip && group.stays.length && (!transport.profileId || !group.trip.profileId || transport.profileId === group.trip.profileId || group.trip.profileIds?.includes(transport.profileId))).map(group => {
        const start = group.stays.map(stay => stay.start).sort()[0];
        const end = group.stays.map(stay => stay.end).sort().at(-1);
        return {group, score: Math.min(...transportDates.map(date => distanceToRange(date, start, end)))};
      }).filter(candidate => candidate.score <= 1).sort((a, b) => a.score - b.score);
      if (!candidates.length) return null;
      if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
      return candidates[0].group;
    };

    for (const transport of scoped(state.transports || [])) {
      let group = transport.tripId ? createGroup(groups, tripKey(transport.tripId), knownTrips.get(transport.tripId) || null) : null;
      if (!group) {
        group = findInferredGroup(transport);
        if (group) group.inferredTransportIds.add(transport.id);
      }
      (group || createGroup(groups, transportKey(transport.id))).transports.push(transport);
    }

    return [...groups.values()].map(group => {
      group.stays.sort((a, b) => a.start.localeCompare(b.start) || Number(a.tripOrder || 0) - Number(b.tripOrder || 0) || a.end.localeCompare(b.end));
      group.transports.sort((a, b) => String(a.startLocal).localeCompare(String(b.startLocal)));
      group.accommodations.sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));
      const recordDates = [
        ...group.stays.flatMap(stay => [stay.start, stay.end]),
        ...group.transports.flatMap(transport => [localDate(transport.startLocal), localDate(transport.endLocal)]),
        ...group.accommodations.flatMap(accommodation => [accommodation.checkIn, accommodation.checkOut])
      ].filter(Boolean).sort();
      group.start = recordDates[0] || '';
      group.end = recordDates.at(-1) || '';
      const records = [...group.stays, ...group.transports];
      const allCancelled = records.length > 0 && records.every(record => record.status === 'cancelled');
      group.phase = allCancelled ? 'cancelled' : !group.start ? 'draft' : group.end < today() ? 'completed' : group.start > today() ? 'upcoming' : 'active';
      group.title = group.trip?.name || group.stays[0]?.location || group.stays[0]?.countryName || (group.transports[0] ? `${group.transports[0].start.name} → ${group.transports[0].end.name}` : 'Untitled journey');
      group.colour = colourFor(group.key);
      group.countries = [...new Set(group.stays.filter(stay => stay.countryCode !== 'SEA').map(stay => stay.countryCode))];
      return group;
    }).sort((a, b) => (a.start || '9999-12-31').localeCompare(b.start || '9999-12-31'));
  }

  function groupsForDate(date, groups, layers) {
    return groups.filter(group => {
      const country = layers.countries && group.stays.some(stay => stay.status !== 'cancelled' && stay.start <= date && stay.end >= date && !window.HVJourney.isHome(state, stay.countryCode, date));
      const transport = layers.transport && group.transports.some(record => record.status !== 'cancelled' && [localDate(record.startLocal), localDate(record.endLocal)].includes(date));
      return country || transport;
    });
  }

  function homesForDate(date) {
    return scoped(state.stays || []).filter(stay => stay.status !== 'cancelled' && stay.start <= date && stay.end >= date && window.HVJourney.isHome(state, stay.countryCode, date));
  }

  function seaForDate(date) {
    return scoped(state.stays || []).filter(stay => stay.status !== 'cancelled' && stay.countryCode === 'SEA' && stay.start <= date && stay.end >= date);
  }

  function locationForDate(group, date) {
    const stay = group.stays.find(item => item.status !== 'cancelled' && item.start <= date && item.end >= date);
    if (stay) return stay.location || stay.countryName;
    const transport = group.transports.find(item => item.status !== 'cancelled' && [localDate(item.startLocal), localDate(item.endLocal)].includes(date));
    return transport ? `${transport.start.name} → ${transport.end.name}` : group.title;
  }

  function phaseLabel(phase) {
    return ({active:'Travelling now',upcoming:'Upcoming',completed:'Completed',cancelled:'Cancelled',draft:'Draft'})[phase] || 'Journey';
  }

  function statusBadge(group) {
    const tone = group.phase === 'active' ? 'good' : group.phase === 'upcoming' ? 'warn' : group.phase === 'cancelled' ? 'bad' : 'neutral';
    return `<span class="calendar-phase status-badge ${tone}">${E(phaseLabel(group.phase))}</span>`;
  }

  function renderMonth() {
    const calendar = $('calendar');
    if (!calendar) return;
    calendar.dataset.journeyCalendar = 'true';
    const focusDate = document.activeElement?.dataset.calendarDateSelect;
    const cursor = calendarCursor;
    const first = (cursor.getUTCDay() + 6) % 7;
    const start = addDays(cursor, -first);
    const current = today();
    const layers = visibleLayers();
    const groups = buildJourneys();
    window.HVCalendar._groups = groups;

    $('calendarTitle').textContent = cursor.toLocaleDateString('en-GB', {month:'long',year:'numeric',timeZone:'UTC'});
    const monthJump = $('calendarMonthJump'), yearJump = $('calendarYearJump');
    if (monthJump) monthJump.value = String(cursor.getUTCMonth());
    if (yearJump) yearJump.value = String(cursor.getUTCFullYear());

    let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
    for (let index = 0; index < 42; index++) {
      const date = dayKey(addDays(start, index));
      const activeGroups = groupsForDate(date, groups, layers);
      const home = layers.countries ? homesForDate(date) : [];
      const sea = layers.countries ? seaForDate(date) : [];
      const selectionRange = calendarSelectionStart && calendarSelectionEnd && date >= calendarSelectionStart && date <= calendarSelectionEnd;
      const selectionStart = date === calendarSelectionStart;
      const selectionEnd = date === calendarSelectionEnd;
      const visible = activeGroups.slice(0, 3);
      const primary = visible[0]?.key || '';
      const chips = visible.map(group => {
        const transfer = group.transports.find(record => record.status !== 'cancelled' && [localDate(record.startLocal), localDate(record.endLocal)].includes(date));
        const location = transfer ? `${transfer.start.name} → ${transfer.end.name}` : locationForDate(group, date);
        const began = group.start === date;
        const ended = group.end === date;
        const transferCue = transfer ? `<span class="calendar-transport-cue" title="${E(window.HVJourney.types[transfer.type] || 'Transport')}: ${E(location)}" aria-hidden="true">${transportIcon(transfer.type)}</span>` : '';
        return `<button type="button" class="calendar-journey-chip phase-${group.phase} ${transfer ? 'has-transport' : ''} ${began ? 'journey-start' : ''} ${ended ? 'journey-end' : ''}" data-calendar-journey="${E(group.key)}" data-calendar-date="${E(date)}" style="--journey-colour:${E(group.colour)}" aria-label="Open ${E(group.title)}, ${E(location)}, ${E(phaseLabel(group.phase))}"><span class="calendar-journey-line" aria-hidden="true"></span><span class="calendar-journey-copy"><strong>${E(group.title)}</strong><small>${E(location)}</small></span>${transferCue}</button>`;
      }).join('');
      const more = activeGroups.length > visible.length ? `<button type="button" class="calendar-more-journeys" data-calendar-day-detail="${E(date)}">+${activeGroups.length - visible.length} more</button>` : '';
      const homeLabel = home.length ? `<span class="calendar-home-mark" title="Home / lived-in: ${E([...new Set(home.map(item => item.countryName))].join(', '))}">⌂ Home</span>` : '';
      const seaLabel = sea.length ? `<span class="calendar-sea-mark" title="At sea">≈ At sea</span>` : '';
      html += `<div class="calendar-day ${cursor.getUTCMonth() === addDays(start, index).getUTCMonth() ? '' : 'outside'} ${date === current ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${E(date)}" data-calendar-primary="${E(primary)}" data-home-status="${home.length ? 'home' : 'unrecorded'}" role="group" aria-label="${E(dateText(date))}"><div class="calendar-day-top"><button type="button" class="day-number" data-calendar-date-select="${E(date)}" aria-label="Plan a trip from ${E(dateText(date))}" aria-pressed="${!!(selectionRange || selectionStart || selectionEnd)}">${addDays(start, index).getUTCDate()}</button><div class="calendar-day-status">${date === current ? '<span>Today</span>' : ''}</div></div><div class="calendar-journeys">${chips}${more}</div><div class="calendar-day-markers">${homeLabel}${seaLabel}</div></div>`;
    }
    calendar.innerHTML = html;
    qa('[data-calendar-date]', calendar).forEach(day => {
      day.addEventListener('click', event => {
        if (event.target.closest('[data-calendar-journey], [data-calendar-date-select], [data-calendar-day-detail]')) return;
        event.stopPropagation();
        const key = day.dataset.calendarPrimary;
        if (key) selectJourney(key, day.dataset.calendarDate);
        else selectDate(day.dataset.calendarDate);
      });
      day.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === day) {
          event.preventDefault(); event.stopPropagation();
          day.dataset.calendarPrimary ? selectJourney(day.dataset.calendarPrimary, day.dataset.calendarDate) : selectDate(day.dataset.calendarDate);
        }
      });
    });
    if (typeof updateCalendarSelectionUI === 'function') updateCalendarSelectionUI();
    renderJourneyDetail();
    if (focusDate) calendar.querySelector(`[data-calendar-date-select="${CSS.escape(focusDate)}"]`)?.focus();
  }

  function selectDate(date) {
    selectedDate = date;
    selectedJourneyKey = '';
    if (!calendarSelectionStart) {
      calendarSelectionStart = date;
      calendarSelectionEnd = null;
      renderMonth();
      return;
    }
    if (calendarSelectionEnd) {
      calendarSelectionStart = date;
      calendarSelectionEnd = null;
      renderMonth();
      return;
    }
    const first = calendarSelectionStart;
    calendarSelectionStart = first <= date ? first : date;
    calendarSelectionEnd = first <= date ? date : first;
    const start = calendarSelectionStart, end = calendarSelectionEnd;
    renderMonth();
    queueMicrotask(() => openTripPlanner({start, end, source:'calendar'}));
  }

  function selectJourney(key, date = '') {
    selectedJourneyKey = key;
    selectedDate = date;
    renderJourneyDetail();
  }

  function monthInsight(groups) {
    const cursor = calendarCursor;
    const start = isoDate(cursor), end = isoDate(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)));
    const inMonth = groups.filter(group => group.start && group.start <= end && group.end >= start);
    const upcoming = groups.filter(group => group.phase === 'upcoming').slice(0, 3);
    return `<div class="calendar-detail-empty"><p class="eyebrow">YOUR MONTH</p><h2>${E(cursor.toLocaleDateString('en-GB', {month:'long',year:'numeric',timeZone:'UTC'}))}</h2><p>${inMonth.length ? `${inMonth.length} ${inMonth.length === 1 ? 'journey' : 'journeys'} touch this month. Select a coloured journey to see every stop, transfer and stay in order.` : 'No journeys touch this month yet. Pick dates on the calendar when you are ready to plan one.'}</p>${upcoming.length ? `<div class="calendar-next-list"><span>Coming up</span>${upcoming.map(group => `<button type="button" data-calendar-open-journey="${E(group.key)}"><i style="--journey-colour:${E(group.colour)}"></i><strong>${E(group.title)}</strong><small>${E(dateRangeText(group.start, group.end))}</small></button>`).join('')}</div>` : ''}<button type="button" class="primary wide" data-calendar-plan>Plan a trip</button></div>`;
  }

  function dayInsight(date, groups) {
    const layers = visibleLayers();
    const active = groupsForDate(date, groups, layers);
    return `<div class="calendar-detail-empty"><p class="eyebrow">${E(dateText(date))}</p><h2>${active.length ? 'Journeys on this date' : 'Plan this date'}</h2>${active.length ? `<div class="calendar-next-list">${active.map(group => `<button type="button" data-calendar-open-journey="${E(group.key)}"><i style="--journey-colour:${E(group.colour)}"></i><strong>${E(group.title)}</strong><small>${E(locationForDate(group, date))} · ${E(phaseLabel(group.phase))}</small></button>`).join('')}</div>` : '<p>This date does not have a recorded journey. You can start a new trip here, or choose a range in the month grid.</p>'}<button type="button" class="primary wide" data-calendar-plan data-calendar-plan-date="${E(date)}">Plan a trip</button></div>`;
  }

  function transportIcon(type) {
    return ({flight:'✈',train:'▰',bus:'▣',boat:'⌇',car:'▱',other:'→'})[type] || '→';
  }

  function transportDaySet(group) {
    return new Set(group.transports.filter(record => record.status !== 'cancelled').flatMap(record => [localDate(record.startLocal), localDate(record.endLocal)]).filter(Boolean));
  }

  function atLocationDayCount(group) {
    const travel = transportDaySet(group), atLocation = new Set();
    for (const stay of group.stays.filter(record => record.status !== 'cancelled')) {
      for (let date = stay.start; date <= stay.end; date = dayKey(addDays(parseDate(date), 1))) if (!travel.has(date)) atLocation.add(date);
    }
    return atLocation.size;
  }

  function schengenSummary(group) {
    const qualifying = group.stays.filter(stay => stay.status !== 'cancelled' && SCHENGEN.has(stay.countryCode) && !stay.schengenExempt);
    if (!qualifying.length) return '';
    const used = new Set();
    qualifying.forEach(stay => {
      for (let date = stay.start; date <= stay.end; date = dayKey(addDays(parseDate(date), 1))) used.add(date);
    });
    const exempt = isSchengenExemptProfile?.();
    return `<div class="calendar-rule-note"><strong>${exempt ? 'Schengen area' : 'Schengen 90/180'}</strong><span>${exempt ? `${used.size} day${used.size === 1 ? '' : 's'} in the Schengen area. Your saved passport profile is exempt from the short-stay calculator.` : `${used.size} day${used.size === 1 ? '' : 's'} in this journey count towards the calculator unless you mark a stay as exempt.`}</span><a href="#/schengen">Open planner</a></div>`;
  }

  function detailTimeline(group) {
    const entries = [
      ...group.stays.map(stay => ({kind:'stay', date:stay.start, end:stay.end, order:Number(stay.tripOrder || 0), record:stay})),
      ...group.transports.map(record => ({kind:'transport', date:localDate(record.startLocal), end:localDate(record.endLocal), order:1, record})),
      ...group.accommodations.map(record => ({kind:'accommodation', date:record.checkIn, end:record.checkOut, order:2, record}))
    ].filter(entry => entry.date).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    return entries.map(entry => {
      if (entry.kind === 'stay') {
        const stay = entry.record;
        const lodging = group.accommodations.filter(item => item.checkIn >= stay.start && item.checkIn <= stay.end);
        return `<li class="journey-timeline-item journey-stop"><div class="journey-timeline-date">${E(dateRangeText(stay.start, stay.end))}<small>${E(durationText(stay.start, stay.end))}</small></div><div class="journey-timeline-symbol">${stay.countryCode === 'SEA' ? '≈' : flagHtml(stay.countryCode, 'flag-img flag-sm')}</div><div class="journey-timeline-copy"><strong>${E(stay.location || stay.countryName)}</strong><span>${E(stay.countryName)}${stay.status === 'cancelled' ? ' · Cancelled' : ''}</span>${stay.notes ? `<p>${E(stay.notes)}</p>` : ''}${lodging.length ? `<div class="journey-inline-lodging">${lodging.map(item => `<span>⌂ ${E(item.propertyName)}${item.location ? ` · ${E(item.location)}` : ''}</span>`).join('')}</div>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-stay="${E(stay.id)}">Edit</button></li>`;
      }
      if (entry.kind === 'transport') {
        const record = entry.record;
        const inferred = group.inferredTransportIds.has(record.id);
        return `<li class="journey-timeline-item journey-transfer"><div class="journey-timeline-date">${E(dateRangeText(entry.date, entry.end))}<small>${E(record.startLocal.replace('T', ' '))} → ${E(record.endLocal.replace('T', ' '))}</small></div><div class="journey-timeline-symbol">${transportIcon(record.type)}</div><div class="journey-timeline-copy"><strong>${E(window.HVJourney.types[record.type] || record.type)} · ${E(record.start.name)} → ${E(record.end.name)}</strong><span>${E(record.flightNumber || record.bookingReference || (inferred ? 'Linked to this trip by its dates' : 'Travel day'))}${record.status === 'cancelled' ? ' · Cancelled' : ''}</span></div><button type="button" class="text-btn" data-calendar-edit-transport="${E(record.id)}">Edit</button></li>`;
      }
      const accommodation = entry.record;
      return `<li class="journey-timeline-item journey-accommodation"><div class="journey-timeline-date">${E(dateRangeText(accommodation.checkIn, accommodation.checkOut))}<small>${E(durationText(accommodation.checkIn, accommodation.checkOut))}</small></div><div class="journey-timeline-symbol">⌂</div><div class="journey-timeline-copy"><strong>${E(accommodation.propertyName)}</strong><span>${E(accommodation.location)}</span>${accommodation.notes ? `<p>${E(accommodation.notes)}</p>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-accommodation="${E(accommodation.id)}">Edit</button></li>`;
    }).join('') || '<li class="journey-timeline-empty">This journey has no stops or transport yet.</li>';
  }

  function renderJourneyDetail() {
    const host = $('calendarJourneyDetail');
    if (!host) return;
    const groups = window.HVCalendar?._groups || buildJourneys();
    const group = groups.find(item => item.key === selectedJourneyKey);
    if (!group) {
      host.innerHTML = selectedDate ? dayInsight(selectedDate, groups) : monthInsight(groups);
      return;
    }
    const travelDays = transportDaySet(group).size;
    const locations = [...new Set(group.stays.map(stay => stay.location || stay.countryName))];
    const tripNotes = [group.trip?.notes, ...group.stays.map(stay => stay.notes).filter(Boolean)].filter(Boolean);
    host.innerHTML = `<article class="calendar-detail-card"><header class="calendar-detail-head"><div><p class="eyebrow">${E(phaseLabel(group.phase))}</p><h2>${E(group.title)}</h2><p>${E(dateRangeText(group.start, group.end))} · ${E(durationText(group.start, group.end))}</p></div>${statusBadge(group)}</header><div class="calendar-detail-countries">${group.countries.map(code => `<span>${flagHtml(code, 'flag-img flag-sm')}${E(countryByCode(code)?.name || code)}</span>`).join('') || '<span class="calendar-sea-label">≈ At sea</span>'}</div><div class="calendar-detail-stats"><div><strong>${group.stays.length}</strong><span>stops</span></div><div><strong>${travelDays}</strong><span>travel days</span></div><div><strong>${atLocationDayCount(group)}</strong><span>at-location days</span></div></div><div class="calendar-detail-actions">${group.trip ? `<button type="button" class="secondary compact" data-calendar-edit-trip="${E(group.trip.id)}">Edit trip</button><button type="button" class="secondary compact" data-calendar-add-transport="${E(group.trip.id)}">Add transport</button><button type="button" class="secondary compact" data-calendar-add-accommodation="${E(group.trip.id)}">Add accommodation</button>` : group.stays[0] ? `<button type="button" class="secondary compact" data-calendar-edit-stay="${E(group.stays[0].id)}">Edit stay</button>` : `<button type="button" class="secondary compact" data-calendar-edit-transport="${E(group.transports[0]?.id || '')}">Edit journey</button>`}</div><section class="calendar-detail-route"><div class="calendar-detail-section-head"><p class="eyebrow">JOURNEY ORDER</p><span>${locations.length ? E(locations.join(' · ')) : 'Transport-only journey'}</span></div><ol class="journey-timeline">${detailTimeline(group)}</ol></section>${tripNotes.length ? `<section class="calendar-detail-notes"><p class="eyebrow">NOTES</p>${tripNotes.map(note => `<p>${E(note)}</p>`).join('')}</section>` : ''}${schengenSummary(group)}<div class="calendar-detail-links"><a href="#/visa">Check entry rules</a><a href="#/schengen">Review Schengen</a></div></article>`;
  }

  function plannerStatusFrom(prefill) {
    if (prefill.status) return prefill.status;
    const start = prefill.start || today();
    return start > today() || prefill.source === 'plan' ? 'planned' : 'actual';
  }

  function blankStop(start, end, countryName = '') { return {countryName, location:'', start, end}; }
  function blankTransport(start, end) { return {type:'flight', startLocal:`${start}T12:00`, endLocal:`${end}T12:00`, startName:'', endName:'', flightNumber:'', bookingReference:''}; }
  function blankAccommodation(start, end) { return {propertyName:'', location:'', checkIn:start, checkOut:end, notes:''}; }

  function ensurePlannerDialog() {
    if (plannerDialog) return plannerDialog;
    plannerDialog = document.createElement('dialog');
    plannerDialog.id = 'tripPlannerDialog';
    plannerDialog.className = 'dialog trip-planner-dialog';
    plannerDialog.addEventListener('close', () => { planner = null; });
    document.body.append(plannerDialog);
    return plannerDialog;
  }

  function openTripPlanner(prefill = {}) {
    const start = prefill.start || today();
    const end = prefill.end || start;
    planner = {
      step: 1,
      start,
      end,
      status: plannerStatusFrom(prefill),
      profileId: prefill.profileId || state.activeProfileId || '',
      name: prefill.tripName || '',
      notes: prefill.notes || '',
      stops: [blankStop(start, end, prefill.countryName || '')],
      transports: [],
      accommodations: []
    };
    const dialog = ensurePlannerDialog();
    renderPlanner();
    if (!dialog.open) dialog.showModal();
  }

  function plannerError(message = '') {
    const target = q('[data-planner-error]', plannerDialog);
    if (target) target.textContent = message;
  }

  function readPlannerStep() {
    if (!planner || !plannerDialog) return;
    const form = q('form', plannerDialog);
    if (!form) return;
    if (planner.step === 1) {
      const previousStart = planner.start, previousEnd = planner.end;
      planner.start = form.elements.start.value;
      planner.end = form.elements.end.value;
      planner.status = form.elements.status.value;
      planner.profileId = form.elements.profileId.value;
      planner.stops.forEach(stop => { if (stop.start === previousStart) stop.start = planner.start; if (stop.end === previousEnd) stop.end = planner.end; });
      planner.transports.forEach(transport => { if (localDate(transport.startLocal) === previousStart) transport.startLocal = `${planner.start}${transport.startLocal.slice(10) || 'T12:00'}`; if (localDate(transport.endLocal) === previousEnd) transport.endLocal = `${planner.end}${transport.endLocal.slice(10) || 'T12:00'}`; });
      planner.accommodations.forEach(accommodation => { if (accommodation.checkIn === previousStart) accommodation.checkIn = planner.start; if (accommodation.checkOut === previousEnd) accommodation.checkOut = planner.end; });
      return;
    }
    if (planner.step === 2) {
      planner.name = form.elements.tripName.value.trim();
      planner.notes = form.elements.tripNotes.value.trim();
      planner.stops = qa('[data-planner-stop]', form).map(row => ({
        countryName: q('[name="countryName"]', row).value.trim(),
        location: q('[name="location"]', row).value.trim(),
        start: q('[name="start"]', row).value,
        end: q('[name="end"]', row).value
      }));
      return;
    }
    if (planner.step === 3) {
      planner.transports = qa('[data-planner-transport]', form).map(row => ({
        type: q('[name="type"]', row).value,
        startLocal: q('[name="startLocal"]', row).value,
        endLocal: q('[name="endLocal"]', row).value,
        startName: q('[name="startName"]', row).value.trim(),
        endName: q('[name="endName"]', row).value.trim(),
        flightNumber: q('[name="flightNumber"]', row).value.trim(),
        bookingReference: q('[name="bookingReference"]', row).value.trim()
      }));
      return;
    }
    if (planner.step === 4) {
      planner.accommodations = qa('[data-planner-accommodation]', form).map(row => ({
        propertyName: q('[name="propertyName"]', row).value.trim(),
        location: q('[name="location"]', row).value.trim(),
        checkIn: q('[name="checkIn"]', row).value,
        checkOut: q('[name="checkOut"]', row).value,
        notes: q('[name="notes"]', row).value.trim()
      }));
    }
  }

  function validateDates() {
    if (!window.HVJourney.validDate(planner.start) || !window.HVJourney.validDate(planner.end) || planner.end < planner.start) return 'Choose a valid start and end date.';
    return '';
  }

  function validateStops() {
    if (!planner.name) return 'Give this journey a name.';
    if (!planner.stops.length) return 'Add at least one country or location.';
    for (const stop of planner.stops) {
      const country = countryByName(stop.countryName);
      if (!country) return 'Choose every country or location from the list.';
      if (!window.HVJourney.validDate(stop.start) || !window.HVJourney.validDate(stop.end) || stop.end < stop.start) return 'Check the dates for each stop.';
      if (stop.start < planner.start || stop.end > planner.end) return 'Each stop must sit inside the journey dates chosen in step 1.';
    }
    return '';
  }

  function validateTransport() {
    for (const transport of planner.transports) {
      const empty = !transport.startName && !transport.endName && !transport.flightNumber && !transport.bookingReference;
      if (empty) return 'Either remove the empty transport row or add the journey details.';
      const record = {type:transport.type, startLocal:transport.startLocal, endLocal:transport.endLocal, start:{name:transport.startName,lat:null,lon:null}, end:{name:transport.endName,lat:null,lon:null}};
      const error = window.HVJourney.validateTransport(record);
      if (error) return error;
    }
    return '';
  }

  function validateAccommodations() {
    for (const accommodation of planner.accommodations) {
      const empty = !accommodation.propertyName && !accommodation.location && !accommodation.checkIn && !accommodation.checkOut && !accommodation.notes;
      if (empty) continue;
      if (!accommodation.propertyName || !accommodation.location || !window.HVJourney.validDate(accommodation.checkIn) || !window.HVJourney.validDate(accommodation.checkOut) || accommodation.checkOut < accommodation.checkIn) return 'Each accommodation needs a property, location and valid check-in/check-out dates.';
      if (accommodation.checkIn < planner.start || accommodation.checkOut > planner.end) return 'Accommodation dates must sit inside the journey dates.';
    }
    return '';
  }

  function validateThrough(step) {
    const dateError = validateDates();
    if (dateError) return dateError;
    if (step >= 2) {
      const stopError = validateStops();
      if (stopError) return stopError;
    }
    if (step >= 3) {
      const transportError = validateTransport();
      if (transportError) return transportError;
    }
    if (step >= 4) return validateAccommodations();
    return '';
  }

  function stopRow(stop, index) {
    return `<div class="planner-stop-row" data-planner-stop><div class="planner-row-head"><span>Stop ${index + 1}</span>${planner.stops.length > 1 ? `<button type="button" class="text-btn" data-planner-remove-stop="${index}">Remove</button>` : ''}</div><div class="planner-stop-grid"><label class="field"><span>Country / location</span><input name="countryName" list="countryList" value="${E(stop.countryName)}" placeholder="Choose a country" required></label><label class="field"><span>Town, island or base <em>optional</em></span><input name="location" value="${E(stop.location)}" maxlength="120" placeholder="e.g. Ljubljana"></label><label class="field"><span>From</span><input name="start" type="date" value="${E(stop.start)}" required></label><label class="field"><span>To</span><input name="end" type="date" value="${E(stop.end)}" required></label></div></div>`;
  }

  function transportRow(transport, index) {
    return `<div class="planner-transport-row" data-planner-transport><div class="planner-row-head"><span>Transfer ${index + 1}</span><button type="button" class="text-btn" data-planner-remove-transport="${index}">Remove</button></div><div class="planner-transport-grid"><label class="field"><span>Type</span><select name="type">${Object.entries(window.HVJourney.types).map(([value, label]) => `<option value="${E(value)}" ${transport.type === value ? 'selected' : ''}>${E(label)}</option>`).join('')}</select></label><label class="field"><span>Departure</span><input name="startLocal" type="datetime-local" value="${E(transport.startLocal)}" required></label><label class="field"><span>From</span><input name="startName" value="${E(transport.startName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Arrival</span><input name="endLocal" type="datetime-local" value="${E(transport.endLocal)}" required></label><label class="field"><span>To</span><input name="endName" value="${E(transport.endName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Reference <em>optional</em></span><input name="flightNumber" value="${E(transport.flightNumber)}" maxlength="40" placeholder="Flight number or service"></label><label class="field planner-wide-field"><span>Booking reference <em>optional</em></span><input name="bookingReference" value="${E(transport.bookingReference)}" maxlength="100"></label></div></div>`;
  }

  function accommodationRow(accommodation, index) {
    return `<div class="planner-accommodation-row" data-planner-accommodation><div class="planner-row-head"><span>Stay ${index + 1}</span><button type="button" class="text-btn" data-planner-remove-accommodation="${index}">Remove</button></div><div class="planner-accommodation-grid"><label class="field"><span>Property name</span><input name="propertyName" value="${E(accommodation.propertyName)}" maxlength="160" placeholder="e.g. Hotel Lovec" required></label><label class="field"><span>Location</span><input name="location" value="${E(accommodation.location)}" maxlength="160" placeholder="e.g. Bled" required></label><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(accommodation.checkIn)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(accommodation.checkOut)}" required></label></div><label class="field"><span>Notes <em>optional</em></span><input name="notes" value="${E(accommodation.notes)}" maxlength="500" placeholder="Room, booking or useful notes"></label></div>`;
  }

  function reviewMarkup() {
    return `<div class="planner-review"><section><p class="eyebrow">JOURNEY</p><h3>${E(planner.name)}</h3><p>${E(dateRangeText(planner.start, planner.end))} · ${E(durationText(planner.start, planner.end))} · ${E(planner.status === 'planned' ? 'Planned' : 'Completed')}</p>${planner.notes ? `<p>${E(planner.notes)}</p>` : ''}</section><section><p class="eyebrow">STOPS IN ORDER</p>${planner.stops.map((stop, index) => `<div class="planner-review-row"><span>${index + 1}</span><strong>${E(stop.location || stop.countryName)}</strong><small>${E(stop.countryName)} · ${E(dateRangeText(stop.start, stop.end))}</small></div>`).join('')}</section><section><p class="eyebrow">TRANSPORT</p>${planner.transports.length ? planner.transports.map(transport => `<div class="planner-review-row"><span>${transportIcon(transport.type)}</span><strong>${E(transport.startName)} → ${E(transport.endName)}</strong><small>${E(window.HVJourney.types[transport.type] || transport.type)} · ${E(transport.startLocal.replace('T', ' '))}</small></div>`).join('') : '<p>No transport added. You can add it later from the trip details.</p>'}</section><section><p class="eyebrow">ACCOMMODATION</p>${planner.accommodations.filter(item => item.propertyName).length ? planner.accommodations.filter(item => item.propertyName).map(item => `<div class="planner-review-row"><span>⌂</span><strong>${E(item.propertyName)}</strong><small>${E(item.location)} · ${E(dateRangeText(item.checkIn, item.checkOut))}</small></div>`).join('') : '<p>No accommodation added. You can add it later without changing the journey.</p>'}</section></div>`;
  }

  function plannerStepMarkup() {
    if (planner.step === 1) return `<div class="planner-step-copy"><p class="eyebrow">STEP 1 OF 5</p><h3>When is the journey?</h3><p>Start with the dates. The calendar stays selected while you work through the rest of the plan.</p></div><div class="planner-date-grid"><label class="field"><span>Start date</span><input name="start" type="date" value="${E(planner.start)}" required></label><label class="field"><span>End date</span><input name="end" type="date" value="${E(planner.end)}" required></label><label class="field"><span>Journey status</span><select name="status"><option value="planned" ${planner.status === 'planned' ? 'selected' : ''}>Planned</option><option value="actual" ${planner.status === 'actual' ? 'selected' : ''}>Completed</option></select></label><label class="field"><span>Traveller</span><select name="profileId">${(state.profiles || []).map(profile => `<option value="${E(profile.id)}" ${profile.id === planner.profileId ? 'selected' : ''}>${E(profile.name)}</option>`).join('')}</select></label></div>`;
    if (planner.step === 2) return `<div class="planner-step-copy"><p class="eyebrow">STEP 2 OF 5</p><h3>Name the trip and add its stops.</h3><p>Add countries and locations in the order you will visit them. You can adjust each stop's dates below.</p></div><label class="field"><span>Trip name</span><input name="tripName" value="${E(planner.name)}" maxlength="80" placeholder="e.g. Eastern Alps 2026" required></label><label class="field"><span>Trip notes <em>optional</em></span><textarea name="tripNotes" maxlength="1000" placeholder="What is this journey for?">${E(planner.notes)}</textarea></label><div class="planner-row-list">${planner.stops.map(stopRow).join('')}</div><button type="button" class="secondary" data-planner-add-stop>+ Add another stop</button>`;
    if (planner.step === 3) return `<div class="planner-step-copy"><p class="eyebrow">STEP 3 OF 5</p><h3>How are you getting between stops?</h3><p>Transport stays part of this journey and is shown between the locations it connects. You can skip it and add it later.</p></div>${planner.transports.length ? `<div class="planner-row-list">${planner.transports.map(transportRow).join('')}</div>` : '<div class="planner-skip-card"><strong>No transport added yet</strong><span>Add flights, trains, ferries or road transfers when they are useful to the plan.</span></div>'}<button type="button" class="secondary" data-planner-add-transport>+ Add transport</button>`;
    if (planner.step === 4) return `<div class="planner-step-copy"><p class="eyebrow">STEP 4 OF 5</p><h3>Where are you staying?</h3><p>Accommodation is optional and separate from your country stays. Add it now, skip it, or update it later from the trip.</p></div>${planner.accommodations.length ? `<div class="planner-row-list">${planner.accommodations.map(accommodationRow).join('')}</div>` : '<div class="planner-skip-card"><strong>Accommodation is optional</strong><span>Nothing is required here. Add a hotel, apartment, cabin or other place only when you have it.</span></div>'}<button type="button" class="secondary" data-planner-add-accommodation>+ Add accommodation</button>`;
    return `<div class="planner-step-copy"><p class="eyebrow">STEP 5 OF 5</p><h3>Review your journey.</h3><p>Everything below will save as one linked trip. Stays, transport and accommodation can still be edited independently later.</p></div>${reviewMarkup()}`;
  }

  function plannerNav() {
    return `<div class="planner-dialog-actions"><button type="button" class="secondary" data-planner-cancel>Cancel</button><div class="planner-dialog-actions-right">${planner.step > 1 ? '<button type="button" class="secondary" data-planner-back>Back</button>' : ''}${planner.step < 5 ? '<button type="button" class="primary" data-planner-next>Continue</button>' : '<button type="submit" class="primary">Save journey</button>'}</div></div>`;
  }

  function renderPlanner() {
    const dialog = ensurePlannerDialog();
    dialog.innerHTML = `<form method="dialog" class="dialog-card trip-planner-card"><header class="trip-planner-head"><div><p class="eyebrow">PLAN A JOURNEY</p><h2>Build one complete trip</h2></div><button type="button" class="icon-btn" data-planner-cancel aria-label="Close">×</button></header><ol class="planner-progress" aria-label="Trip planning progress">${['Dates','Stops','Transport','Stay','Review'].map((label, index) => `<li class="${planner.step === index + 1 ? 'current' : planner.step > index + 1 ? 'complete' : ''}"><span>${index + 1}</span>${label}</li>`).join('')}</ol><div class="trip-planner-body">${plannerStepMarkup()}</div><p class="form-error" data-planner-error role="alert"></p>${plannerNav()}</form>`;
    const form = q('form', dialog);
    q('[data-planner-cancel]', form).onclick = () => dialog.close();
    q('[data-planner-back]', form)?.addEventListener('click', () => { readPlannerStep(); planner.step -= 1; renderPlanner(); });
    q('[data-planner-next]', form)?.addEventListener('click', () => {
      readPlannerStep();
      const error = validateThrough(planner.step);
      if (error) { plannerError(error); return; }
      planner.step += 1; renderPlanner();
    });
    q('[data-planner-add-stop]', form)?.addEventListener('click', () => { readPlannerStep(); planner.stops.push(blankStop(planner.start, planner.end)); renderPlanner(); });
    q('[data-planner-add-transport]', form)?.addEventListener('click', () => { readPlannerStep(); planner.transports.push(blankTransport(planner.start, planner.end)); renderPlanner(); });
    q('[data-planner-add-accommodation]', form)?.addEventListener('click', () => { readPlannerStep(); planner.accommodations.push(blankAccommodation(planner.start, planner.end)); renderPlanner(); });
    qa('[data-planner-remove-stop]', form).forEach(button => button.onclick = () => { readPlannerStep(); planner.stops.splice(Number(button.dataset.plannerRemoveStop), 1); renderPlanner(); });
    qa('[data-planner-remove-transport]', form).forEach(button => button.onclick = () => { readPlannerStep(); planner.transports.splice(Number(button.dataset.plannerRemoveTransport), 1); renderPlanner(); });
    qa('[data-planner-remove-accommodation]', form).forEach(button => button.onclick = () => { readPlannerStep(); planner.accommodations.splice(Number(button.dataset.plannerRemoveAccommodation), 1); renderPlanner(); });
    form.onsubmit = event => { event.preventDefault(); readPlannerStep(); const error = validateThrough(4); if (error) { plannerError(error); return; } savePlanner(); };
  }

  function savePlanner() {
    const trip = {id:uid(), name:planner.name, notes:planner.notes, profileId:planner.profileId || null, profileIds:planner.profileId ? [planner.profileId] : []};
    state.trips ||= []; state.stays ||= []; state.transports ||= []; state.accommodations ||= [];
    state.trips.push(trip);
    planner.stops.forEach((stop, index) => {
      const country = countryByName(stop.countryName);
      state.stays.push({id:uid(),tripId:trip.id,countryCode:country.code,countryName:country.name,location:stop.location,start:stop.start,end:stop.end,notes:'',schengenExempt:false,status:planner.status,profileId:planner.profileId || null,tripOrder:index});
    });
    planner.transports.forEach(transport => state.transports.push({id:uid(),tripId:trip.id,type:transport.type,status:planner.status,profileId:planner.profileId || null,startLocal:transport.startLocal,endLocal:transport.endLocal,start:{name:transport.startName,terminal:'',lat:null,lon:null},end:{name:transport.endName,terminal:'',lat:null,lon:null},flightNumber:transport.flightNumber,bookingReference:transport.bookingReference}));
    planner.accommodations.filter(accommodation => accommodation.propertyName).forEach(accommodation => state.accommodations.push({id:uid(),tripId:trip.id,profileId:planner.profileId || null,propertyName:accommodation.propertyName,location:accommodation.location,checkIn:accommodation.checkIn,checkOut:accommodation.checkOut,notes:accommodation.notes}));
    updatePassedPlannedTrips();
    calendarSelectionStart = null; calendarSelectionEnd = null;
    selectedJourneyKey = tripKey(trip.id); selectedDate = '';
    persist();
    plannerDialog.close();
    renderAll();
    window.HVJourneys?.render();
  }

  function openAccommodationDialog(tripId, accommodationId = '') {
    const trip = state.trips.find(item => item.id === tripId);
    if (!trip) return;
    const group = buildJourneys().find(item => item.trip?.id === tripId);
    const existing = (state.accommodations || []).find(item => item.id === accommodationId);
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog small-dialog';
    dialog.setAttribute('aria-label', existing ? 'Edit accommodation' : 'Add accommodation');
    const start = existing?.checkIn || group?.start || today(), end = existing?.checkOut || group?.end || start;
    dialog.innerHTML = `<form method="dialog" class="dialog-card accommodation-dialog-card"><div class="dialog-head"><div><p class="eyebrow">ACCOMMODATION</p><h2>${existing ? 'Edit accommodation' : 'Add accommodation'}</h2><p class="dialog-intro">${E(trip.name)}</p></div><button type="button" class="icon-btn" data-accommodation-close aria-label="Close">×</button></div><label class="field"><span>Property name</span><input name="propertyName" value="${E(existing?.propertyName || '')}" maxlength="160" required></label><label class="field"><span>Location</span><input name="location" value="${E(existing?.location || '')}" maxlength="160" required></label><div class="form-grid"><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(start)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(end)}" required></label></div><label class="field"><span>Notes <em>optional</em></span><textarea name="notes" maxlength="500">${E(existing?.notes || '')}</textarea></label><p class="form-error" data-accommodation-error role="alert"></p><div class="dialog-actions">${existing ? '<button type="button" class="danger-link" data-accommodation-delete>Remove accommodation</button>' : ''}<div class="spacer"></div><button type="button" class="secondary" data-accommodation-close>Cancel</button><button type="submit" class="primary">Save accommodation</button></div></form>`;
    document.body.append(dialog);
    const form = q('form', dialog), error = q('[data-accommodation-error]', form);
    qa('[data-accommodation-close]', form).forEach(button => button.onclick = () => dialog.close());
    q('[data-accommodation-delete]', form)?.addEventListener('click', () => { if (!confirm('Remove this accommodation from the trip?')) return; state.accommodations = (state.accommodations || []).filter(item => item.id !== existing.id); persist(); dialog.close(); renderAll(); });
    form.onsubmit = event => {
      event.preventDefault();
      const propertyName = form.elements.propertyName.value.trim(), location = form.elements.location.value.trim(), checkIn = form.elements.checkIn.value, checkOut = form.elements.checkOut.value, notes = form.elements.notes.value.trim();
      if (!propertyName || !location || !window.HVJourney.validDate(checkIn) || !window.HVJourney.validDate(checkOut) || checkOut < checkIn) { error.textContent = 'Add a property, location and valid check-in/check-out dates.'; return; }
      state.accommodations ||= [];
      const record = {id:existing?.id || uid(),tripId,profileId:existing?.profileId ?? trip.profileId ?? state.activeProfileId,propertyName,location,checkIn,checkOut,notes};
      if (existing) Object.assign(existing, record); else state.accommodations.push(record);
      persist(); dialog.close(); renderAll();
    };
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function moveLegacyTransportTools() {
    const library = $('calendarTransportLibrary');
    const records = $('transportRecords');
    const transportSection = records?.closest('details');
    if (library && transportSection) library.append(transportSection);
    const add = $('addTransportBtn');
    if (transportSection && add) transportSection.querySelector('summary')?.insertAdjacentElement('afterend', add);
  }

  function captureCalendarAction(event) {
    const target = event.target;
    const journey = target.closest('[data-calendar-journey]');
    if (journey) { event.preventDefault(); event.stopPropagation(); selectJourney(journey.dataset.calendarJourney, journey.dataset.calendarDate); return; }
    const date = target.closest('[data-calendar-date-select]');
    if (date) { event.preventDefault(); event.stopPropagation(); selectDate(date.dataset.calendarDateSelect); return; }
    const more = target.closest('[data-calendar-day-detail]');
    if (more) { event.preventDefault(); event.stopPropagation(); selectedJourneyKey = ''; selectedDate = more.dataset.calendarDayDetail; renderJourneyDetail(); return; }
    const open = target.closest('[data-calendar-open-journey]');
    if (open) { event.preventDefault(); event.stopPropagation(); selectJourney(open.dataset.calendarOpenJourney); return; }
    const plan = target.closest('[data-calendar-plan]');
    if (plan) { event.preventDefault(); event.stopPropagation(); const start = plan.dataset.calendarPlanDate || calendarSelectionStart || today(); openTripPlanner({start, end:calendarSelectionEnd || start, source:'calendar'}); return; }
    const editTrip = target.closest('[data-calendar-edit-trip]');
    if (editTrip) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.editTrip(editTrip.dataset.calendarEditTrip); return; }
    const editStay = target.closest('[data-calendar-edit-stay]');
    if (editStay) { event.preventDefault(); event.stopPropagation(); openStayDialog(editStay.dataset.calendarEditStay); return; }
    const transport = target.closest('[data-calendar-edit-transport]');
    if (transport?.dataset.calendarEditTransport) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.openTransport(transport.dataset.calendarEditTransport); return; }
    const addTransport = target.closest('[data-calendar-add-transport]');
    if (addTransport) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.openTransport(null, {tripId:addTransport.dataset.calendarAddTransport}); return; }
    const addAccommodation = target.closest('[data-calendar-add-accommodation]');
    if (addAccommodation) { event.preventDefault(); event.stopPropagation(); openAccommodationDialog(addAccommodation.dataset.calendarAddAccommodation); return; }
    const editAccommodation = target.closest('[data-calendar-edit-accommodation]');
    if (editAccommodation) { event.preventDefault(); event.stopPropagation(); const accommodation = (state.accommodations || []).find(item => item.id === editAccommodation.dataset.calendarEditAccommodation); if (accommodation) openAccommodationDialog(accommodation.tripId, accommodation.id); }
  }

  function boot() {
    const calendar = $('calendar');
    if (!calendar || window.HVCalendar?.ready) return;
    const styles = $('calendarExperienceStyles');
    if (styles) document.head.append(styles);
    state.accommodations ||= [];
    window.HVCalendar = {ready:true,renderMonth,openTripPlanner};
    calendar.dataset.journeyCalendar = 'true';
    moveLegacyTransportTools();
    $('calendarPlanTripBtn')?.addEventListener('click', () => openTripPlanner({source:'calendar'}));
    $('addStayBtn').onclick = () => openTripPlanner({source:'manual'});
    $('addStayFromListBtn').onclick = () => openTripPlanner({source:'manual'});
    document.addEventListener('click', captureCalendarAction, true);
    renderMonth();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

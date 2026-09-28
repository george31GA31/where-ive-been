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
  let dateAction = '';
  let planner = null;
  let plannerDialog = null;

  const today = () => isoDate(new Date());
  const localDate = value => String(value || '').slice(0, 10);
  const days = (start, end) => start && end ? Math.max(1, diffDays(start, end) + 1) : 0;
  const dateText = value => value ? fmt(value) : '—';
  const dateRangeText = (start, end) => !start ? 'Dates to be added' : start === end ? dateText(start) : `${dateText(start)} to ${dateText(end)}`;
  const durationText = (start, end) => `${days(start, end)} ${days(start, end) === 1 ? 'day' : 'days'}`;
  const scoped = rows => window.HVJourney.scoped(rows || [], state.activeProfileId);
  const visibleLayers = () => ({countries:true,transport:false,accommodation:true,...state.visualLayers?.calendar});

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
      const candidates = !accommodation.tripId ? [...groups.values()].filter(g=>g.stays.some(stay=>stay.status!=='cancelled'&&stay.start<=accommodation.checkIn&&stay.end>=accommodation.checkOut)) : [];
      const key=accommodation.tripId ? tripKey(accommodation.tripId) : candidates.length===1 ? candidates[0].key : `accommodation:${accommodation.id}`;
      createGroup(groups,key,knownTrips.get(accommodation.tripId)||null).accommodations.push(accommodation);
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
        ...(!group.trip && !group.stays.length && !group.transports.length ? group.accommodations.flatMap(a=>[a.checkIn,a.checkOut]) : []),
        ...group.stays.flatMap(stay => [stay.start, stay.end]),
        ...group.transports.flatMap(transport => HVJourney.transportDates(transport))
      ].filter(Boolean).sort();
      group.start = recordDates[0] || '';
      group.end = recordDates.at(-1) || '';
      const records = [...group.stays, ...group.transports];
      const allCancelled = records.length > 0 && records.every(record => record.status === 'cancelled');
      group.phase = allCancelled ? 'cancelled' : !group.start ? 'draft' : group.end < today() ? 'completed' : group.start > today() ? 'upcoming' : 'active';
      group.title = group.trip?.name || group.stays[0]?.location || group.stays[0]?.countryName || (group.transports[0] ? (window.HVJourneys?.transportLabel(group.transports[0]) || window.HVJourney.transportLabel(group.transports[0])) : group.accommodations[0]?.propertyName || 'Untitled journey');
      group.colour = colourFor(group.key);
      group.countries = [...new Set(group.stays.filter(stay => stay.countryCode !== 'SEA').map(stay => stay.countryCode))];
      return group;
    }).sort((a, b) => (a.start || '9999-12-31').localeCompare(b.start || '9999-12-31'));
  }

  function groupsForDate(date, groups, layers) {
    return groups.filter(group => {
      const country = layers.countries && group.stays.some(stay => stay.status !== 'cancelled' && stay.start <= date && stay.end >= date && (HVJourney.isDomesticHoliday(stay)||!window.HVJourney.isHome(state, stay.countryCode, date)));
      const transport = layers.transport && group.transports.some(record => record.status !== 'cancelled' && HVJourney.transportDates(record).includes(date));
      const accommodation = layers.accommodation && group.accommodations.some(record => record.checkIn <= date && record.checkOut >= date);
      return country || transport || accommodation;
    });
  }

  function homesForDate(date) {
    return scoped(state.stays || []).filter(stay => stay.status !== 'cancelled' && stay.start <= date && stay.end >= date && !HVJourney.isDomesticHoliday(stay) && window.HVJourney.isHome(state, stay.countryCode, date));
  }

  function seaForDate(date) {
    return scoped(state.stays || []).filter(stay => stay.status !== 'cancelled' && stay.countryCode === 'SEA' && stay.start <= date && stay.end >= date);
  }

  function locationForDate(group, date) {
    const stay = group.stays.find(item => item.status !== 'cancelled' && item.start <= date && item.end >= date);
    if (stay) return stay.location || stay.countryName;
    const transport = group.transports.find(item => item.status !== 'cancelled' && [localDate(item.startLocal), localDate(item.endLocal)].includes(date));
    return transport ? (window.HVJourneys?.transportLabel(transport) || window.HVJourney.transportLabel(transport)) : group.title;
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
      const travelGroups = activeGroups.filter(group => (layers.countries && group.stays.some(stay => stay.status !== 'cancelled' && stay.start <= date && stay.end >= date && (HVJourney.isDomesticHoliday(stay)||!window.HVJourney.isHome(state, stay.countryCode, date)))) || (layers.transport && group.transports.some(record => record.status !== 'cancelled' && HVJourney.transportDates(record).includes(date))));
      const visible = travelGroups.slice(0, 3);
      const accommodationGroups = layers.accommodation ? activeGroups.filter(group => group.accommodations.some(item => item.checkIn <= date && item.checkOut >= date)) : [];
      const primary = visible[0]?.key || accommodationGroups[0]?.key || '';
      const chips = visible.map(group => {
        const transfer = group.transports.find(record => record.status !== 'cancelled' && HVJourney.transportDates(record).includes(date));
        const location = transfer ? (window.HVJourneys?.transportLabel(transfer) || window.HVJourney.transportLabel(transfer)) : locationForDate(group, date);
        const flags = layers.countries ? [...new Set(group.stays.filter(item => item.status !== 'cancelled' && item.start <= date && item.end >= date && item.countryCode !== 'SEA' && (HVJourney.isDomesticHoliday(item)||!window.HVJourney.isHome(state, item.countryCode, date))).map(item => item.domesticDestination||item.countryCode))].map(code => flagHtml(code, 'calendar-chip-flag')).join('') : '';
        const countryCodes = group.stays.filter(item => item.status !== 'cancelled' && item.start <= date && item.end >= date && item.countryCode !== 'SEA').map(item => item.countryCode);
        const countryTitle = [...new Set(group.stays.filter(s=>s.status!=='cancelled'&&s.start<=date&&s.end>=date).map(s=>s.countryName||countryByCode(s.countryCode)?.name||s.countryCode))].join(' · ') || group.title;
        const schengen = countryCodes.length ? countryCodes.every(code => SCHENGEN.has(code)) ? 'Schengen' : countryCodes.some(code => SCHENGEN.has(code)) ? 'Mixed' : 'Outside Schengen' : '';
        const began = group.start === date;
        const ended = group.end === date;
        const transferCue = transfer ? `<span class="calendar-transport-cue" title="${E(window.HVJourney.types[transfer.type] || 'Transport')}: ${E(location)}" aria-hidden="true">${transportIcon(transfer.type)}</span>` : '';
        return `<button type="button" class="calendar-journey-chip phase-${group.phase} ${transfer ? 'has-transport' : ''} ${began ? 'journey-start' : ''} ${ended ? 'journey-end' : ''}" data-calendar-journey="${E(group.key)}" data-calendar-date="${E(date)}" style="--journey-colour:${E(group.colour)}" aria-label="Open ${E(group.title)}, ${E(location)}, ${E(schengen)}, ${E(phaseLabel(group.phase))}"><span class="calendar-journey-line" aria-hidden="true"></span>${flags}<span class="calendar-journey-copy"><strong>${E(countryTitle)}</strong>${location.trim().toLowerCase() !== countryTitle.toLowerCase() && !countryCodes.some(code=>(countryByCode(code)?.name||code).toLowerCase()===location.trim().toLowerCase()) ? `<small>${E(location)}</small>` : ''}</span>${schengen ? `<span class="calendar-schengen ${schengen === 'Schengen' ? 'in' : 'out'}" title="${E(schengen)}" role="img" aria-label="${E(schengen)}"></span>` : ''}${transferCue}</button>`;
      }).join('');
      const lodging = accommodationGroups.slice(0, 3).map(group => {
        const segments = [0,1].map(half => {
          const items = group.accommodations.filter(item => item.checkIn <= date && item.checkOut >= date && (item.checkIn === item.checkOut || item.checkIn < date || half === 1) && (item.checkIn === item.checkOut || item.checkOut > date || half === 0));
          const item = items[0];
          const label = item && (item.checkOut === date ? half === 0 : half === 1);
          return `<span class="calendar-lodging-half ${item ? 'occupied' : ''} ${item?.checkIn === date && half === 1 ? 'lodging-start' : ''} ${item?.checkOut === date && half === 0 ? 'lodging-end' : ''}" ${item ? `style="--lodging-tone:${16 + hash(item.id) % 12}%"` : ''} title="${item ? `${E(item.propertyName)} · ${E(item.location)} · ${E(dateRangeText(item.checkIn,item.checkOut))}` : ''}">${label ? `<span aria-hidden="true">⌂</span><small>${E(item.propertyName)}</small>` : ''}</span>`;
        }).join('');
        return group.accommodations.some(item => item.checkIn <= date && item.checkOut >= date) ? `<button type="button" class="calendar-lodging-row" data-calendar-lodging-group="${E(group.key)}" data-calendar-date="${E(date)}" aria-label="Accommodation on ${E(dateText(date))}: ${E(group.accommodations.filter(item => item.checkIn <= date && item.checkOut >= date).map(item => `${item.propertyName}, ${item.location}`).join('; '))}">${segments}</button>` : '';
      }).join('');
      const more = travelGroups.length > visible.length ? `<button type="button" class="calendar-more-journeys" data-calendar-day-detail="${E(date)}">+${travelGroups.length - visible.length} more</button>` : '';
      const places = layers.countries ? scoped(state.placeVisits || []).filter(v=>v.category==='locations'&&v.status==='visited'&&v.date<=date&&(v.endDate||v.date)>=date) : [];
      const placeChips=places.map(v=>`<button type="button" class="calendar-place-chip" data-place-edit="${E(v.id)}" title="${E(v.place?.address||'')}">◎ ${E(v.place?.name||'Saved location')}</button>`).join('');
      const homeLabel = '';
      const seaLabel = sea.length ? `<span class="calendar-sea-mark" title="At sea">≈ At sea</span>` : '';
      html += `<div class="calendar-day ${cursor.getUTCMonth() === addDays(start, index).getUTCMonth() ? '' : 'outside'} ${date === current ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${E(date)}" data-calendar-primary="${E(primary)}" data-home-status="${home.length ? 'home' : 'unrecorded'}" role="group" aria-label="${E(dateText(date))}"><div class="calendar-day-top"><button type="button" class="day-number" data-calendar-date-select="${E(date)}" aria-label="Select ${E(dateText(date))}" aria-pressed="${!!(selectionRange || selectionStart || selectionEnd)}">${addDays(start, index).getUTCDate()}</button><div class="calendar-day-status">${date === current ? '<span>Today</span>' : ''}</div></div><div class="calendar-journeys">${chips}${more}${placeChips}</div>${lodging ? `<div class="calendar-lodging">${lodging}</div>` : ''}<div class="calendar-day-markers">${homeLabel}${seaLabel}</div></div>`;
    }
    calendar.innerHTML = html;
    qa('[data-calendar-date]', calendar).forEach(day => {
      day.addEventListener('click', event => {
        if (event.target.closest('[data-calendar-journey], [data-calendar-date-select], [data-calendar-day-detail], [data-place-edit]')) return;
        event.stopPropagation();
        selectDate(day.dataset.calendarDate);
      });
      day.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === day) {
          event.preventDefault(); event.stopPropagation();
          selectDate(day.dataset.calendarDate);
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
    dateAction = '';
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
    renderMonth();
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
    const start = calendarSelectionStart || date, end = calendarSelectionEnd || start;
    const active = groups.filter(group => group.stays.some(s => s.status !== 'cancelled' && s.start <= end && s.end >= start) || group.accommodations.some(a => a.checkIn <= end && a.checkOut >= start) || group.transports.some(t => HVJourney.transportDates(t).some(d => d >= start && d <= end)));
    const entries = active.map(group => `<div class="date-entry-group"><strong>${E(group.title)}</strong><button type="button" class="text-btn" data-journey-map="${E(group.key)}">Journey Map →</button>${group.stays.filter(s => s.start <= end && s.end >= start).map(s => `<button type="button" data-calendar-edit-stay="${E(s.id)}">${flagHtml(s.domesticDestination||s.countryCode,'calendar-chip-flag')} ${E(s.countryName)} · ${E(dateRangeText(s.start,s.end))} <span>Edit</span></button>`).join('')}${group.accommodations.filter(a => a.checkIn <= end && a.checkOut >= start).map(a => `<button type="button" data-calendar-edit-accommodation="${E(a.id)}">⌂ ${E(a.propertyName)} · ${E(dateRangeText(a.checkIn,a.checkOut))} <span>Edit</span></button>`).join('')}${group.transports.filter(t => HVJourney.transportDates(t).some(d => d >= start && d <= end)).map(t => `<button type="button" data-calendar-edit-transport="${E(t.id)}">${transportIcon(t.type)} ${E(window.HVJourneys?.transportLabel(t) || window.HVJourney.transportLabel(t))} <span>Edit</span></button>`).join('')}</div>`).join('') + scoped(state.placeVisits || []).filter(v => v.category === 'locations' && v.status === 'visited' && v.date <= end && (v.endDate || v.date) >= start).map(v => `<div class="date-entry-group"><button type="button" data-place-edit="${E(v.id)}">◎ ${E(v.place?.name || 'Saved place')} · ${E(dateText(v.date))} <span>Edit</span></button></div>`).join('');
    const action = dateAction === 'country' ? `<form id="calendarQuickCountry" class="calendar-quick-form"><label class="field"><span>Country</span><input type="text" name="country" list="countryList" required autocomplete="off" placeholder="Search a country"></label><label class="field"><span>City or area <em>optional</em></span><input type="text" name="location" maxlength="160"></label><button class="primary" type="submit">Save country stay</button><p class="form-error" role="alert"></p></form>` : dateAction === 'accommodation' ? `<form id="calendarQuickAccommodation" class="calendar-quick-form"><label class="field"><span>Accommodation</span><input type="text" name="propertyName" maxlength="160" required placeholder="Hotel, Airbnb or campsite"></label><label class="field"><span>Location</span><input type="text" name="location" maxlength="160" required></label><p class="helper">Check-in ${E(dateText(start))} · check-out ${E(dateText(end))}. You can edit both dates after saving.</p><button class="primary" type="submit">Save accommodation</button><p class="form-error" role="alert"></p></form>` : '';
    return `<div class="calendar-date-panel"><button class="calendar-date-close text-btn" type="button" data-calendar-close-date aria-label="Close date editor">Close ×</button><p class="eyebrow">SELECTED ${start === end ? 'DATE' : 'RANGE'}</p><h2>${E(dateRangeText(start,end))}</h2><p class="calendar-date-hint">${calendarSelectionEnd ? 'Add an entry across these dates, or select a new start date.' : 'Select another date to extend this range, or add an entry for this day.'}</p><div class="form-grid calendar-range-fields"><label class="field"><span>From</span><input type="date" data-range-start value="${E(start)}"></label><label class="field"><span>To</span><input type="date" data-range-end value="${E(end)}"></label></div><div class="calendar-date-actions"><button type="button" data-calendar-date-action="country" aria-pressed="${dateAction === 'country'}">+ Country</button><button type="button" data-calendar-date-action="accommodation" aria-pressed="${dateAction === 'accommodation'}">+ Accommodation</button><button type="button" data-calendar-date-action="transport">+ Transport</button><button type="button" data-calendar-date-action="location">+ Location</button></div>${action}<section class="calendar-date-entries"><p class="eyebrow">ON THESE DATES</p>${entries || '<p>No entries recorded for these dates yet.</p>'}</section><button type="button" class="text-btn" data-calendar-plan data-calendar-plan-date="${E(start)}">Plan a full trip →</button></div>`;
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
        return `<li class="journey-timeline-item journey-stop"><div class="journey-timeline-date">${E(dateRangeText(stay.start, stay.end))}<small>${E(durationText(stay.start, stay.end))}</small></div><div class="journey-timeline-symbol">${stay.countryCode === 'SEA' ? '≈' : flagHtml(stay.domesticDestination||stay.countryCode, 'flag-img flag-sm')}</div><div class="journey-timeline-copy"><strong>${E(stay.location || stay.countryName)}</strong><span>${stay.location && stay.location !== stay.countryName ? E(stay.countryName) : ''}${stay.status === 'cancelled' ? ' · Cancelled' : ''}</span>${stay.notes ? `<p>${E(stay.notes)}</p>` : ''}${lodging.length ? `<div class="journey-inline-lodging">${lodging.map(item => `<span>⌂ ${E(item.propertyName)}${item.location ? ` · ${E(item.location)}` : ''}</span>`).join('')}</div>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-stay="${E(stay.id)}">Edit</button></li>`;
      }
      if (entry.kind === 'transport') {
        const record = entry.record;
        const inferred = group.inferredTransportIds.has(record.id);
        return `<li class="journey-timeline-item journey-transfer"><div class="journey-timeline-date">${E(dateRangeText(entry.date, entry.end))}<small>${E(record.startLocal.replace('T', ' '))} → ${E(record.endLocal.replace('T', ' '))}</small></div><div class="journey-timeline-symbol">${transportIcon(record.type)}</div><div class="journey-timeline-copy"><strong>${E(window.HVJourney.types[record.type] || record.type)} · ${E(window.HVJourneys?.transportLabel(record) || window.HVJourney.transportLabel(record))}</strong><span>${E((record.legs||[]).map(l=>[l.airline?.name,l.flightNumber].filter(Boolean).join(' ')).filter(Boolean).join(' · ') || record.flightNumber || record.bookingReference || (inferred ? 'Linked to this trip by its dates' : 'Travel day'))}${record.status === 'cancelled' ? ' · Cancelled' : ''}</span></div><button type="button" class="text-btn" data-calendar-edit-transport="${E(record.id)}">Edit</button></li>`;
      }
      const accommodation = entry.record;
      return `<li class="journey-timeline-item journey-accommodation"><div class="journey-timeline-date">${E(dateRangeText(accommodation.checkIn, accommodation.checkOut))}<small>${E(durationText(accommodation.checkIn, accommodation.checkOut))}</small></div><div class="journey-timeline-symbol">⌂</div><div class="journey-timeline-copy"><strong>${E(accommodation.propertyName)}</strong><span>${E(accommodation.location)}</span>${accommodation.notes ? `<p>${E(accommodation.notes)}</p>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-accommodation="${E(accommodation.id)}">Edit</button></li>`;
    }).join('') || '<li class="journey-timeline-empty">This journey has no stops or transport yet.</li>';
  }

  function renderJourneyDetail() {
    const host = $('calendarJourneyDetail');
    if (!host) return;
    host.classList.toggle('date-range-complete', !!calendarSelectionEnd);
    const groups = window.HVCalendar?._groups || buildJourneys();
    const group = groups.find(item => item.key === selectedJourneyKey);
    if (!group) {
      host.innerHTML = selectedDate ? dayInsight(selectedDate, groups) : monthInsight(groups);
      if (selectedDate) {
        const start = calendarSelectionStart || selectedDate, end = calendarSelectionEnd || start;
        const matching = groups.filter(g => g.trip && g.start <= end && g.end >= start);
        if (matching.length === 1) {
          const select = q('.calendar-quick-form [name="tripId"]',host);
          if (select) select.value = matching[0].trip.id;
        }
      }
      return;
    }
    const travelDays = transportDaySet(group).size;
    const locations = [...new Set(group.stays.map(stay => stay.location || stay.countryName))];
    const tripNotes = [group.trip?.notes, ...group.stays.map(stay => stay.notes).filter(Boolean)].filter(Boolean);
    host.innerHTML = `<article class="calendar-detail-card"><header class="calendar-detail-head"><div><p class="eyebrow">${E(phaseLabel(group.phase))}</p><h2>${E(group.title)}</h2><p>${E(dateRangeText(group.start, group.end))} · ${E(durationText(group.start, group.end))}</p></div>${statusBadge(group)}</header><div class="calendar-detail-countries">${[...new Map(group.stays.filter(s=>s.countryCode!=='SEA').map(s=>[s.domesticDestination||s.countryCode,s])).values()].map(s => `<span>${flagHtml(s.domesticDestination||s.countryCode, 'flag-img flag-sm')}${E(s.countryName||countryByCode(s.countryCode)?.name||s.countryCode)}</span>`).join('') || (group.stays.some(s=>s.countryCode==='SEA'&&s.status!=='cancelled')?'<span class="calendar-sea-label">≈ At sea</span>':'')}</div><div class="calendar-detail-stats"><div><strong>${group.stays.length}</strong><span>stops</span></div><div><strong>${travelDays}</strong><span>travel days</span></div><div><strong>${atLocationDayCount(group)}</strong><span>at-location days</span></div></div><div class="calendar-detail-actions"><button type="button" class="secondary compact" data-journey-map="${E(group.key)}">Journey Map</button>${group.trip ? `<button type="button" class="secondary compact" data-calendar-edit-trip="${E(group.trip.id)}">Edit trip</button><button type="button" class="secondary compact" data-calendar-add-transport="${E(group.trip.id)}">Add transport</button><button type="button" class="secondary compact" data-calendar-add-accommodation="${E(group.trip.id)}">Add accommodation</button>` : group.stays[0] ? `<button type="button" class="secondary compact" data-calendar-edit-stay="${E(group.stays[0].id)}">Edit stay</button>` : `<button type="button" class="secondary compact" data-calendar-edit-transport="${E(group.transports[0]?.id || '')}">Edit journey</button>`}</div><section class="calendar-detail-route"><div class="calendar-detail-section-head"><p class="eyebrow">JOURNEY ORDER</p><span>${locations.length ? E(locations.join(' · ')) : group.transports.length ? 'Transport-only journey' : 'Accommodation'}</span></div><ol class="journey-timeline">${detailTimeline(group)}</ol></section>${tripNotes.length ? `<section class="calendar-detail-notes"><p class="eyebrow">NOTES</p>${tripNotes.map(note => `<p>${E(note)}</p>`).join('')}</section>` : ''}${schengenSummary(group)}<div class="calendar-detail-links"><a href="#/visa">Check entry rules</a><a href="#/schengen">Review Schengen</a></div></article>`;
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
      planner.transports.forEach(transport => { if(transport.legs?.length)return; if (localDate(transport.startLocal) === previousStart) transport.startLocal = `${planner.start}${transport.startLocal.slice(10) || 'T12:00'}`; if (localDate(transport.endLocal) === previousEnd) transport.endLocal = `${planner.end}${transport.endLocal.slice(10) || 'T12:00'}`; });
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
      planner.transports = qa('[data-planner-transport]', form).map((row,index) => ({
        ...(q('[name="type"]',row).value==='flight'?planner.transports[index]:{}),
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
      planner.accommodations = qa('[data-planner-accommodation]', form).map((row,index) => ({
        ...planner.accommodations[index],
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
    return `<div class="planner-stop-row" data-planner-stop><div class="planner-row-head"><span>Stop ${index + 1}</span>${planner.stops.length > 1 ? `<button type="button" class="text-btn" data-planner-remove-stop="${index}">Remove</button>` : ''}</div><div class="planner-stop-grid"><label class="field"><span>Country / location</span><input name="countryName" list="countryList" value="${E(stop.countryName)}" placeholder="Choose a country" required></label><label class="field"><span>Town, island or base <em>optional</em></span><input type="text" name="location" value="${E(stop.location)}" maxlength="120" placeholder="e.g. Ljubljana"></label><label class="field"><span>From</span><input name="start" type="date" value="${E(stop.start)}" required></label><label class="field"><span>To</span><input name="end" type="date" value="${E(stop.end)}" required></label></div></div>`;
  }

  function transportRow(transport, index) {
    return `<div class="planner-transport-row" data-planner-transport><div class="planner-row-head"><span>Transfer ${index + 1}</span><button type="button" class="secondary compact" data-planner-flight="${index}">Flight legs & airlines</button><button type="button" class="text-btn" data-planner-remove-transport="${index}">Remove</button></div><div class="planner-transport-grid"><label class="field"><span>Type</span><select name="type">${Object.entries(window.HVJourney.types).map(([value, label]) => `<option value="${E(value)}" ${transport.type === value ? 'selected' : ''}>${E(label)}</option>`).join('')}</select></label><label class="field"><span>Departure</span><input name="startLocal" type="datetime-local" value="${E(transport.startLocal)}" required></label><label class="field"><span>From</span><input name="startName" value="${E(transport.startName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Arrival</span><input name="endLocal" type="datetime-local" value="${E(transport.endLocal)}" required></label><label class="field"><span>To</span><input name="endName" value="${E(transport.endName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Reference <em>optional</em></span><input name="flightNumber" value="${E(transport.flightNumber)}" maxlength="40" placeholder="Flight number or service"></label><label class="field planner-wide-field"><span>Booking reference <em>optional</em></span><input name="bookingReference" value="${E(transport.bookingReference)}" maxlength="100"></label></div></div>`;
  }

  function accommodationRow(accommodation, index) {
    return `<div class="planner-accommodation-row" data-planner-accommodation><div class="planner-row-head"><span>Stay ${index + 1}</span><button type="button" class="secondary compact" data-planner-place="${index}">Search / plot on map</button><button type="button" class="text-btn" data-planner-remove-accommodation="${index}">Remove</button></div><div class="planner-accommodation-grid"><label class="field"><span>Property name</span><input type="text" name="propertyName" value="${E(accommodation.propertyName)}" maxlength="160" placeholder="e.g. Hotel Lovec" required></label><label class="field"><span>Location</span><input type="text" name="location" value="${E(accommodation.location)}" maxlength="160" placeholder="e.g. Bled" required></label><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(accommodation.checkIn)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(accommodation.checkOut)}" required></label></div><label class="field"><span>Notes <em>optional</em></span><input name="notes" value="${E(accommodation.notes)}" maxlength="500" placeholder="Room, booking or useful notes"></label></div>`;
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
    qa('[data-planner-flight]',form).forEach(button=>button.onclick=()=>{
      readPlannerStep();const index=Number(button.dataset.plannerFlight),t=planner.transports[index];
      HVJourneys.openTransport(null,{...t,type:'flight',status:planner.status,start:t.start||{name:t.startName},end:t.end||{name:t.endName},onSave:record=>{planner.transports[index]={...t,...record,startName:record.start.name,endName:record.end.name};renderPlanner();}});
    });
    qa('[data-planner-place]',form).forEach(button=>button.onclick=()=>{
      readPlannerStep();const index=Number(button.dataset.plannerPlace),a=planner.accommodations[index];
      HVPlaces.open({accommodation:true,date:a.checkIn,end:a.checkOut,place:a.place,searchArea:planner.stops[0]?.location||planner.stops[0]?.countryName,onSelect:(place,dates)=>{planner.accommodations[index]={...a,place,placeId:place.id,lat:place.lat,lon:place.lon,propertyName:place.name,location:place.area||place.address||place.countryName,checkIn:dates.date,checkOut:dates.end};renderPlanner();}});
    });
    qa('[data-planner-transport]',form).forEach((row,index)=>{q('[name="type"]',row).onchange=()=>{readPlannerStep();renderPlanner();};if(planner.transports[index]?.legs?.length){for(const name of ['startLocal','endLocal','startName','endName','flightNumber'])q(`[name="${name}"]`,row).readOnly=true;}});
    form.onsubmit = event => { event.preventDefault(); readPlannerStep(); const error = validateThrough(4); if (error) { plannerError(error); return; } savePlanner(); };
  }

  function savePlanner() {
    const trip = {id:uid(), name:planner.name, notes:planner.notes, profileId:planner.profileId || null, profileIds:planner.profileId ? [planner.profileId] : []};
    state.trips ||= []; state.stays ||= []; state.transports ||= []; state.accommodations ||= [];
    state.trips.push(trip);
    planner.stops.forEach((stop, index) => {
      const country = countryByName(stop.countryName);
      state.stays.push({id:uid(),tripId:trip.id,countryCode:country.code,countryName:country.name,...HVJourney.domesticFields(country),location:stop.location,start:stop.start,end:stop.end,notes:'',schengenExempt:false,status:planner.status,profileId:planner.profileId || null,tripOrder:index});
    });
    planner.transports.forEach(transport => state.transports.push({...(transport.legs?.length?{legs:transport.legs,via:transport.via}:{}),id:uid(),tripId:trip.id,type:transport.type,status:planner.status,profileId:planner.profileId || null,startLocal:transport.startLocal,endLocal:transport.endLocal,start:{...(transport.start||{}),name:transport.startName,lat:transport.start?.lat??null,lon:transport.start?.lon??null},end:{...(transport.end||{}),name:transport.endName,lat:transport.end?.lat??null,lon:transport.end?.lon??null},flightNumber:transport.flightNumber,bookingReference:transport.bookingReference}));
    planner.accommodations.filter(accommodation => accommodation.propertyName).forEach(accommodation => state.accommodations.push({...(accommodation.place?{place:accommodation.place,placeId:accommodation.placeId,lat:accommodation.lat,lon:accommodation.lon}:{}),id:uid(),tripId:trip.id,profileId:planner.profileId || null,propertyName:accommodation.propertyName,location:accommodation.location,checkIn:accommodation.checkIn,checkOut:accommodation.checkOut,notes:accommodation.notes}));
    updatePassedPlannedTrips();
    calendarSelectionStart = null; calendarSelectionEnd = null;
    selectedJourneyKey = tripKey(trip.id); selectedDate = '';
    persist();
    plannerDialog.close();
    renderAll();
    window.HVJourneys?.render();
  }

  function openCalendarStay(id) {
    openStayDialog(id);
    const picker=$('stayTripSelect');if(picker)picker.closest('label').hidden=true;
  }

  function openAccommodationDialog(tripId, accommodationId = '') {
    const trip = state.trips.find(item => item.id === tripId);
    const group = buildJourneys().find(item => item.trip?.id === tripId);
    const existing = (state.accommodations || []).find(item => item.id === accommodationId);
    if(window.HVPlaces&&(!existing||existing.place)){window.HVPlaces.open({accommodation:true,accommodationId:existing?.id,tripId,date:group?.start||today(),end:group?.end||today()});return;}
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog small-dialog';
    dialog.setAttribute('aria-label', existing ? 'Edit accommodation' : 'Add accommodation');
    const start = existing?.checkIn || group?.start || today(), end = existing?.checkOut || group?.end || start;
    dialog.innerHTML = `<form method="dialog" class="dialog-card accommodation-dialog-card"><div class="dialog-head"><div><p class="eyebrow">ACCOMMODATION</p><h2>${existing ? 'Edit accommodation' : 'Add accommodation'}</h2><p class="dialog-intro">${E(trip?.name || 'Dated stay')}</p></div><button type="button" class="icon-btn" data-accommodation-close aria-label="Close">×</button></div><label class="field"><span>Property name</span><input type="text" name="propertyName" value="${E(existing?.propertyName || '')}" maxlength="160" required></label><label class="field"><span>Location</span><input type="text" name="location" value="${E(existing?.location || '')}" maxlength="160" required></label><div class="form-grid"><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(start)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(end)}" required></label></div><button type="button" class="secondary" data-accommodation-map>Find or plot on map</button><label class="field"><span>Notes <em>optional</em></span><textarea name="notes" maxlength="500">${E(existing?.notes || '')}</textarea></label><p class="form-error" data-accommodation-error role="alert"></p><div class="dialog-actions">${existing ? '<button type="button" class="danger-link" data-accommodation-delete>Remove accommodation</button>' : ''}<div class="spacer"></div><button type="button" class="secondary" data-accommodation-close>Cancel</button><button type="submit" class="primary">Save accommodation</button></div></form>`;
    document.body.append(dialog);
    const form = q('form', dialog), error = q('[data-accommodation-error]', form);
    qa('[data-accommodation-close]', form).forEach(button => button.onclick = () => dialog.close());
    q('[data-accommodation-map]',form)?.addEventListener('click',()=>{dialog.close();HVPlaces.open({accommodationId:existing.id});});
    q('[data-accommodation-delete]', form)?.addEventListener('click', () => { if (!confirm('Remove this accommodation from the trip?')) return; state.accommodations = (state.accommodations || []).filter(item => item.id !== existing.id); persist(); dialog.close(); renderAll(); });
    form.onsubmit = event => {
      event.preventDefault();
      const propertyName = form.elements.propertyName.value.trim(), location = form.elements.location.value.trim(), checkIn = form.elements.checkIn.value, checkOut = form.elements.checkOut.value, notes = form.elements.notes.value.trim();
      if (!propertyName || !location || !window.HVJourney.validDate(checkIn) || !window.HVJourney.validDate(checkOut) || checkOut < checkIn) { error.textContent = 'Add a property, location and valid check-in/check-out dates.'; return; }
      state.accommodations ||= [];
      const record = {id:existing?.id || uid(),tripId,profileId:existing?.profileId ?? trip?.profileId ?? state.activeProfileId,propertyName,location,checkIn,checkOut,notes};
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

  function saveDateEntry(event) {
    const form = event.target;
    if (!['calendarQuickCountry','calendarQuickAccommodation'].includes(form.id)) return;
    event.preventDefault();
    const error = q('[role="alert"]', form), start = calendarSelectionStart || selectedDate, end = calendarSelectionEnd || start;
    const tripId = window.HVJourney.tripForDates(state,start,end);
    const trip = (state.trips || []).find(t => t.id === tripId);
    if (!window.HVJourney.validDate(start) || !window.HVJourney.validDate(end)) { error.textContent = 'Select valid dates first.'; return; }
    if (form.id === 'calendarQuickCountry') {
      const country = countryByName(form.elements.country.value);
      if (!country) { error.textContent = 'Choose a country from the list.'; return; }
      if (tripId && !trip) { error.textContent = 'Choose a valid trip.'; return; }
      if ((state.stays || []).some(s => (s.tripId || null) === tripId && s.countryCode === country.code && (s.domesticDestination||null)===(country.domesticDestination||null) && s.start <= end && s.end >= start && (s.location || '').toLowerCase() === form.elements.location.value.trim().toLowerCase() && (!s.profileId || s.profileId === state.activeProfileId))) { error.textContent = 'This stay overlaps an existing entry. Edit that stay to change its dates.'; return; }
      const owner = state.activeProfileId;
      state.stays ||= [];
      state.stays.push({id:uid(),tripId,countryCode:country.code,countryName:country.name,...HVJourney.domesticFields(country),location:form.elements.location.value.trim(),start,end,notes:'',schengenExempt:false,status:end < today()?'actual':'planned',profileId:owner,tripOrder:(state.stays || []).filter(s => s.tripId === tripId).length});
    } else {
      const propertyName = form.elements.propertyName.value.trim(), location = form.elements.location.value.trim();
      if (!propertyName || !location) { error.textContent = 'Add the property and its location.'; return; }
      if ((state.accommodations || []).some(a => a.tripId === tripId && a.propertyName.toLowerCase() === propertyName.toLowerCase() && a.checkIn <= end && a.checkOut >= start)) { error.textContent = 'This accommodation already overlaps these dates. Edit its existing entry instead.'; return; }
      state.accommodations ||= [];
      state.accommodations.push({id:uid(),tripId,profileId:state.activeProfileId,propertyName,location,checkIn:start,checkOut:end,notes:''});
    }
    updatePassedPlannedTrips(); persist(); dateAction = ''; renderAll(); window.HVJourneys?.render();
  }

  function captureCalendarAction(event) {
    const target = event.target;
    if(target.closest('[data-place-edit]')) return;
    const lodging = target.closest('[data-calendar-lodging-group]');
    if (lodging) {
      event.preventDefault();event.stopPropagation();
      const group = (window.HVCalendar?._groups || []).find(g => g.key === lodging.dataset.calendarLodgingGroup);
      const matches = group?.accommodations.filter(a => a.checkIn <= lodging.dataset.calendarDate && a.checkOut >= lodging.dataset.calendarDate) || [];
      if (matches.length === 1) openAccommodationDialog(matches[0].tripId,matches[0].id);
      else selectDate(lodging.dataset.calendarDate);
      return;
    }
    if (target.closest('[data-calendar-close-date]')) { event.preventDefault(); event.stopPropagation(); calendarSelectionStart = null; calendarSelectionEnd = null; selectedDate = ''; dateAction = ''; renderMonth(); return; }
    if (target.closest('#clearCalendarSelectionBtn')) { selectedDate = ''; dateAction = ''; }
    const journey = target.closest('[data-calendar-journey]');
    if (journey) { event.preventDefault(); event.stopPropagation(); const group=buildJourneys().find(g=>g.key===journey.dataset.calendarJourney),date=journey.dataset.calendarDate; const stays=group?.stays.filter(s=>s.start<=date&&s.end>=date&&s.status!=='cancelled')||[]; if(stays.length===1){openCalendarStay(stays[0].id);}else selectJourney(journey.dataset.calendarJourney,date); return; }
    const date = target.closest('[data-calendar-date-select]');
    if (date) { event.preventDefault(); event.stopPropagation(); selectDate(date.dataset.calendarDateSelect); return; }
    const action = target.closest('[data-calendar-date-action]');
    if (action) {
      event.preventDefault(); event.stopPropagation();
      const kind = action.dataset.calendarDateAction;
      if (kind === 'transport') { window.HVJourneys?.openTransport(null,{startLocal:`${calendarSelectionStart || selectedDate}T12:00`,endLocal:`${calendarSelectionEnd || calendarSelectionStart || selectedDate}T12:00`}); return; }
      if (kind === 'accommodation') { window.HVPlaces?.open({date:calendarSelectionStart || selectedDate,end:calendarSelectionEnd || calendarSelectionStart || selectedDate,accommodation:true}); return; }
      if (kind === 'location') { window.HVPlaces?.open({date:calendarSelectionStart || selectedDate,end:calendarSelectionEnd || calendarSelectionStart || selectedDate,tripId:''}); return; }
      dateAction = dateAction === kind ? '' : kind; renderJourneyDetail(); q('#calendarJourneyDetail input')?.focus(); return;
    }
    const more = target.closest('[data-calendar-day-detail]');
    if (more) { event.preventDefault(); event.stopPropagation(); selectedJourneyKey = ''; selectedDate = more.dataset.calendarDayDetail; renderJourneyDetail(); return; }
    const open = target.closest('[data-calendar-open-journey]');
    if (open) { event.preventDefault(); event.stopPropagation(); selectJourney(open.dataset.calendarOpenJourney); return; }
    const plan = target.closest('[data-calendar-plan]');
    if (plan) { event.preventDefault(); event.stopPropagation(); const start = plan.dataset.calendarPlanDate || calendarSelectionStart || today(); openTripPlanner({start, end:calendarSelectionEnd || start, source:'calendar'}); return; }
    const editTrip = target.closest('[data-calendar-edit-trip]');
    if (editTrip) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.editTrip(editTrip.dataset.calendarEditTrip); return; }
    const editStay = target.closest('[data-calendar-edit-stay]');
    if (editStay) { event.preventDefault(); event.stopPropagation(); openCalendarStay(editStay.dataset.calendarEditStay); return; }
    const transport = target.closest('[data-calendar-edit-transport]');
    if (transport?.dataset.calendarEditTransport) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.openTransport(transport.dataset.calendarEditTransport); return; }
    const addTransport = target.closest('[data-calendar-add-transport]');
    if (addTransport) { event.preventDefault(); event.stopPropagation(); window.HVJourneys?.openTransport(null, {tripId:addTransport.dataset.calendarAddTransport}); return; }
    const addAccommodation = target.closest('[data-calendar-add-accommodation]');
    if (addAccommodation) { event.preventDefault(); event.stopPropagation(); openAccommodationDialog(addAccommodation.dataset.calendarAddAccommodation); return; }
    const editAccommodation = target.closest('[data-calendar-edit-accommodation]');
    if (editAccommodation) { event.preventDefault(); event.stopPropagation(); const accommodation = (state.accommodations || []).find(item => item.id === editAccommodation.dataset.calendarEditAccommodation); if (accommodation) openAccommodationDialog(accommodation.tripId, accommodation.id); }
    const layer = target.closest('[data-calendar-layer]');
    if (layer) {
      event.preventDefault();
      state.visualLayers ||= {}; state.visualLayers.calendar ||= {};
      const key = layer.dataset.calendarLayer;
      state.visualLayers.calendar[key] = !visibleLayers()[key];
      layer.setAttribute('aria-pressed', String(state.visualLayers.calendar[key]));
      persist(); renderMonth();
    }
  }

  function boot() {
    const calendar = $('calendar');
    if (!calendar || window.HVCalendar?.ready) return;
    const styles = $('calendarExperienceStyles');
    if (styles) document.head.append(styles);
    state.accommodations ||= [];
    qa('[data-calendar-layer]').forEach(button => button.setAttribute('aria-pressed', String(visibleLayers()[button.dataset.calendarLayer] !== false)));
    window.HVCalendar = {ready:true,renderMonth,openTripPlanner,openAccommodationDialog,journeyGroups:buildJourneys};
    calendar.dataset.journeyCalendar = 'true';
    moveLegacyTransportTools();
    $('calendarPlanTripBtn')?.addEventListener('click', () => openTripPlanner({source:'calendar'}));
    $('addStayBtn').onclick = () => openTripPlanner({source:'manual'});
    $('addStayFromListBtn').onclick = () => openTripPlanner({source:'manual'});
    document.addEventListener('click', captureCalendarAction, true);
    document.addEventListener('submit', saveDateEntry, true);
    document.addEventListener('change',event=>{
      if(!event.target.matches('[data-range-start],[data-range-end]'))return;
      const host=event.target.closest('.calendar-date-panel'),start=host.querySelector('[data-range-start]').value,end=host.querySelector('[data-range-end]').value;
      if(!window.HVJourney.validDate(start)||!window.HVJourney.validDate(end))return;
      calendarSelectionStart=start<end?start:end;calendarSelectionEnd=start<end?end:start;selectedDate=calendarSelectionStart;renderMonth();
    });
    renderMonth();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

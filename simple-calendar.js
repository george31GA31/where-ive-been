/* Month, week and day read the same saved calendar window. */
(function (root) {
  'use strict';

  const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const nextDate = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
  function viewRange(date, view) {
    if (!isDate(date)) throw new Error('Choose a valid calendar date.');
    const offset = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
    return view === 'week' ? {start: nextDate(date, -offset), count: 7} : {start: date, count: 1};
  }
  function shiftAnchor(date, view, direction) {
    if (view !== 'month') return nextDate(date, direction * (view === 'week' ? 7 : 1));
    const current = new Date(date + 'T12:00:00Z');
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + direction, 1)).toISOString().slice(0, 10);
  }
  const timeOf = value => String(value || '').includes('T') ? String(value).slice(11, 16) : '';
  function dayEntries(day) {
    const rows = [];
    for (const row of day.stays || []) rows.push({kind: 'country', row, title: row.countryName || row.location || 'Destination', detail: row.location || '', priority: 0});
    for (const row of day.accommodations || []) {
      const phase = row.checkOut === day.date ? 'Check-out' : row.checkIn === day.date ? 'Check-in' : 'Staying';
      rows.push({kind: 'accommodation', row, title: row.propertyName || 'Accommodation', detail: [phase, row.location].filter(Boolean).join(' · '), time: phase === 'Check-out' ? row.checkOutTime : phase === 'Check-in' ? row.checkInTime : '', priority: 1});
    }
    for (const row of day.transports || []) {
      const departure = String(row.startLocal || '').slice(0, 10), arrival = String(row.endLocal || '').slice(0, 10);
      const timings = [departure === day.date ? timeOf(row.startLocal) : '', arrival === day.date ? timeOf(row.endLocal) : ''].filter(Boolean);
      rows.push({kind: 'transport', row, title: [row.start?.name || 'Departure', row.end?.name || 'Arrival'].join(' → '), detail: [row.plannerModeLabel || row.modeLabel || row.operator || row.type, timings.length > 1 ? timings.join(' – ') : departure === day.date ? 'Departure' : arrival === day.date ? 'Arrival' : 'Travelling'].filter(Boolean).join(' · '), time: departure === day.date ? timeOf(row.startLocal) : arrival === day.date ? timeOf(row.endLocal) : '', priority: 2});
    }
    for (const row of day.places || []) rows.push({kind: 'location', row, title: row.place?.name || row.location || 'Destination', detail: row.notes || row.place?.city || '', priority: 2});
    for (const row of day.notes || []) rows.push({kind: 'note', row, title: row.title || 'Note', detail: row.body || '', priority: 2});
    return rows.sort((a, b) => a.priority - b.priority || String(a.time || '99:99').localeCompare(String(b.time || '99:99')) || a.title.localeCompare(b.title));
  }
  const helpers = {isDate, viewRange, shiftAnchor, dayEntries};
  if (typeof module !== 'undefined' && module.exports) {module.exports = helpers; return;}

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  const formatDate = (date, options) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {...options, timeZone: 'UTC'});
  const get = id => document.getElementById(id) || root.HVPages?.get(id);
  const today = () => {const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');};
  let view = 'month', anchor = today(), ready = false, rendering = false;
  try {const saved = localStorage.getItem('herald.calendar.view.v2'); if (['month', 'week', 'day'].includes(saved)) view = saved;} catch {}

  function labelForKind(kind, row) {
    if (kind === 'transport') {
      const mode = root.HVTripPlannerModel?.modes?.find(mode => mode.id === row.plannerMode || mode.id === row.mode);
      return mode?.label || root.HVJourney?.types?.[row.type] || 'Transport';
    }
    return {country: 'Destination', accommodation: 'Accommodation', note: row.category === 'Activity' ? 'Activity' : 'Note', location: 'Location'}[kind];
  }

  function entryHTML(entry, date) {
    const {kind, row} = entry, label = labelForKind(kind, row);
    const tentative = root.HVCalendarPlanning?.planFor(kind, row.id);
    const planner = row.plannerId ? ' · Journey' : '';
    return `<li class="simple-calendar-entry type-${kind}"><button type="button" data-simple-entry-kind="${kind}" data-simple-entry-id="${escapeHTML(row.id)}" data-simple-entry-date="${date}" aria-label="${escapeHTML(label + ', ' + entry.title)}"><span class="simple-calendar-entry-time">${escapeHTML(entry.time || label)}</span><span class="simple-calendar-entry-copy"><strong>${escapeHTML(entry.title)}</strong>${entry.detail ? `<small>${escapeHTML(entry.detail)}</small>` : ''}${tentative || planner ? `<small class="simple-calendar-entry-context">${tentative ? 'Tentative' : 'Journey'}</small>` : ''}</span><span class="simple-calendar-entry-arrow" aria-hidden="true">↗</span></button></li>`;
  }

  function dayHTML(day) {
    const keys = {country:'countries', accommodation:'accommodation', transport:'transport', location:'locations', note:'notes'};
    const rows = dayEntries(day).filter(entry => get('calendarView')?.querySelector(`[data-calendar-layer="${keys[entry.kind]}"]`)?.getAttribute('aria-pressed') !== 'false');
    const current = day.date === today();
    return `<section class="simple-calendar-day${current ? ' is-today' : ''}" aria-label="${escapeHTML(formatDate(day.date, {weekday: 'long', day: 'numeric', month: 'long'}))}"><header><button type="button" class="simple-calendar-date-heading" data-simple-day="${day.date}" aria-label="Open ${escapeHTML(formatDate(day.date, {weekday: 'long', day: 'numeric', month: 'long'}))}"><span>${escapeHTML(formatDate(day.date, {weekday: 'short'}))}</span><strong>${escapeHTML(formatDate(day.date, {day: 'numeric', month: view === 'day' ? 'long' : 'short'}))}</strong>${current ? '<small>Today</small>' : ''}</button><button type="button" class="simple-calendar-add" data-simple-add="${day.date}" aria-label="Add an entry on ${escapeHTML(formatDate(day.date, {day: 'numeric', month: 'long'}))}">+</button></header>${rows.length ? `<ul>${rows.map(entry => entryHTML(entry, day.date)).join('')}</ul>` : '<p class="simple-calendar-empty">No entries</p>'}</section>`;
  }

  function syncChrome() {
    const panel = get('calendarView')?.querySelector('.calendar-month-panel');
    if (!panel) return;
    panel.dataset.calendarView = view;
    get('calendar').hidden = view !== 'month';
    get('simpleCalendarDates').hidden = view === 'month';
    if (get('calendarAgenda')) get('calendarAgenda').hidden = true;
    if (get('atlasYear')) get('atlasYear').hidden = true;
    panel.querySelectorAll('[data-simple-calendar-view]').forEach(button => {
      const selected = button.dataset.simpleCalendarView === view;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    });
    panel.querySelectorAll('.calendar-jump-controls').forEach(element => {element.hidden = true;});
    get('simpleCalendarJump').value = anchor;
    panel.querySelectorAll('[data-simple-add-current]').forEach(button => {button.dataset.simpleAdd = anchor;});
    get('prevMonth').setAttribute('aria-label', 'Previous ' + view);
    get('nextMonth').setAttribute('aria-label', 'Next ' + view);
    const selection = get('calendarSelectionInfo');
    if (selection) selection.hidden = view !== 'month';
    panel.querySelectorAll('[data-calendar-select-range],#clearCalendarSelectionBtn').forEach(button => {button.hidden = view !== 'month';});
    if (view === 'month') return;
    const range = viewRange(anchor, view), end = nextDate(range.start, range.count - 1);
    get('calendarTitle').textContent = view === 'day' ? formatDate(anchor, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}) : formatDate(range.start, {day: 'numeric', month: 'short'}) + ' – ' + formatDate(end, {day: 'numeric', month: 'short', year: 'numeric'});
  }

  function render() {
    if (!ready || rendering || document.body.dataset.currentView !== 'calendar') return;
    rendering = true;
    try {
      syncChrome();
      if (view === 'month') return;
      const range = viewRange(anchor, view);
      const dates = root.HVCalendarPlanning?.window(range.start, range.count) || root.HVCalendarData.window(state, range.start, range.count);
      const host = get('simpleCalendarDates');
      host.className = 'simple-calendar-dates simple-calendar-view-' + view;
      host.innerHTML = [...dates.values()].map(dayHTML).join('');
    } finally {rendering = false;}
  }

  function setView(nextView, date = anchor) {
    if (!['month', 'week', 'day'].includes(nextView) || !isDate(date)) return;
    view = nextView;
    anchor = date;
    try {localStorage.setItem('herald.calendar.view.v2', view);} catch {}
    root.HVCalendar?.clearSelection(false);
    calendarCursor = new Date(anchor.slice(0, 7) + '-01T00:00:00Z');
    if (view === 'month') root.HVCalendar?.renderMonth();
    render();
  }

  function showDate(date, nextView = 'day') {
    if (!isDate(date)) return;
    if (typeof switchView === 'function') switchView('calendar');
    else location.hash = '#/calendar';
    boot();
    setView(nextView, date);
  }

  function plannerEntry(id) {
    return root.HVTripPlannerModel?.findEntry?.(state, id);
  }

  function openEntry(kind, id, date) {
    const planner = plannerEntry(id);
    if (planner) {root.HVTripPlanner?.open(planner.plannerId, {stopId: planner.stopId || planner.plannerStopId, segmentId: planner.segmentId || planner.plannerSegmentId}); return;}
    const tentative = root.HVCalendarPlanning?.planFor(kind, id);
    if (tentative) root.HVCalendarPlanning.open(tentative.id);
    else root.HVCalendar?.openEntry(kind, id, date);
  }

  function addEntry(date, opener) {
    const choices = document.createElement('dialog');
    choices.className = 'dialog small-dialog simple-calendar-add-dialog';
    choices.setAttribute('aria-labelledby', 'simpleCalendarAddHeading');
    choices.innerHTML = `<div class="dialog-card"><header><h2 id="simpleCalendarAddHeading">Add to ${escapeHTML(formatDate(date, {day: 'numeric', month: 'short'}))}</h2><button type="button" class="icon-btn" data-simple-add-close aria-label="Close">×</button></header><div class="simple-calendar-add-choices">${[['accommodation', 'Accommodation'], ['transport', 'Transport'], ['activity', 'Activity'], ['note', 'Note'], ['location', 'Location']].map(([kind, label]) => `<button type="button" class="secondary" data-simple-add-kind="${kind}">${label}</button>`).join('')}</div></div>`;
    document.body.append(choices);
    let kind = '';
    choices.addEventListener('click', event => {
      const button = event.target.closest('[data-simple-add-kind],[data-simple-add-close]');
      if (!button) return;
      kind = button.dataset.simpleAddKind || '';
      choices.close();
    });
    choices.addEventListener('close', () => {
      choices.remove();
      if (kind === 'activity') root.HVTravelTools?.openNote(null, {date, rangeEnd: date, category: 'Activity'});
      else if (kind) root.HVTravelActions?.add(kind, {start: date, end: date});
      else opener?.focus();
    });
    choices.showModal();
  }

  function captureClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const entry = target.closest('[data-simple-entry-id],[data-calendar-entry-id],[data-calendar-edit-transport],[data-calendar-edit-accommodation],[data-day-note-edit],[data-place-edit]');
    if (entry) {
      const id = entry.dataset.simpleEntryId || entry.dataset.calendarEntryId || entry.dataset.calendarEditTransport || entry.dataset.calendarEditAccommodation || entry.dataset.dayNoteEdit || entry.dataset.placeEdit;
      if (entry.hasAttribute('data-simple-entry-id') || plannerEntry(id)) {
        event.preventDefault(); event.stopImmediatePropagation();
        openEntry(entry.dataset.simpleEntryKind || entry.dataset.calendarEntry, id, entry.dataset.simpleEntryDate || entry.dataset.calendarContextDate);
        return;
      }
    }
    const modeButton = target.closest('[data-simple-calendar-view]');
    const add = target.closest('[data-simple-add]');
    const day = target.closest('[data-simple-day]');
    if (modeButton || add || day) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (modeButton) setView(modeButton.dataset.simpleCalendarView);
      if (day) setView('day', day.dataset.simpleDay);
      if (add) addEntry(add.dataset.simpleAdd, add);
      return;
    }
    const selected = target.closest('[data-calendar-date-select]');
    if (selected && isDate(selected.dataset.calendarDateSelect)) anchor = selected.dataset.calendarDateSelect;
    if (view === 'month' || document.body.dataset.currentView !== 'calendar') return;
    const nav = target.closest('#prevMonth,#nextMonth,#todayBtn');
    if (!nav) return;
    event.preventDefault(); event.stopImmediatePropagation();
    setView(view, nav.id === 'todayBtn' ? today() : shiftAnchor(anchor, view, nav.id === 'prevMonth' ? -1 : 1));
  }

  function boot() {
    const panel = get('calendarView')?.querySelector('.calendar-month-panel');
    if (!panel || !root.HVCalendar?.ready) return;
    const stylesheet = document.querySelector('link[href^="simple-calendar.css"]');
    if (stylesheet) document.head.append(stylesheet);
    if (!ready) {
      let controls = panel.querySelector('.calendar-view-switch');
      if (!controls) {controls = document.createElement('div'); controls.className = 'calendar-view-switch'; panel.querySelector('.calendar-toolbar-primary').append(controls);}
      controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Calendar view');
      controls.innerHTML = ['month', 'week', 'day'].map(mode => `<button type="button" data-simple-calendar-view="${mode}" aria-pressed="${view === mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('');
      const jump = document.createElement('label'); jump.className = 'simple-calendar-jump';
      jump.innerHTML = '<span class="sr-only">Go to date</span><input type="date" id="simpleCalendarJump" aria-label="Go to date">';
      panel.querySelector('.calendar-toolbar-primary').append(jump);
      jump.querySelector('input').addEventListener('change', event => {if (isDate(event.target.value)) setView(view, event.target.value);});
      const dates = document.createElement('div'); dates.id = 'simpleCalendarDates'; dates.hidden = true;
      get('calendar').after(dates);
      const addMenu = panel.querySelector('.calendar-add-toolbar');
      if (addMenu) {
        const add = document.createElement('button');
        add.type = 'button'; add.className = 'secondary compact'; add.dataset.simpleAddCurrent = ''; add.dataset.simpleAdd = anchor;
        add.textContent = '+ Add entry'; addMenu.replaceWith(add);
      }
      panel.querySelectorAll('button[data-calendar-view]').forEach(button => button.remove());
      ready = true;
      if (calendarCursor instanceof Date) {
        const month = calendarCursor.toISOString().slice(0, 7);
        anchor = month === today().slice(0, 7) ? today() : month + '-01';
      }
    }
    render();
  }

  root.addEventListener('click', captureClick, true);
  root.addEventListener('hv-calendar-rendered', () => {
    if (!ready) boot();
    else {
      if (view === 'month' && calendarCursor instanceof Date && anchor.slice(0, 7) !== calendarCursor.toISOString().slice(0, 7)) anchor = calendarCursor.toISOString().slice(0, 10);
      render();
    }
  });
  root.addEventListener('hv-route', boot);
  root.addEventListener('hv-data-changed', render);
  root.addEventListener('hv-calendar-plans-changed', render);
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
  root.HVSimpleCalendar = {...helpers, showDate, render, setView, addEntry: (date = anchor, opener = document.activeElement) => addEntry(date, opener), get view() {return view;}, get date() {return anchor;}};
})(typeof window !== 'undefined' ? window : globalThis);

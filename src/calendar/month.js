function phaseLabel(phase) {
  return {active:'Travelling now', upcoming:'Upcoming', completed:'Completed', cancelled:'Cancelled', draft:'Draft'}[phase] || 'Journey';
}

function statusBadge(group) {
  const tone = {active:'good', upcoming:'warn', cancelled:'bad'}[group.phase] || 'neutral';
  return `<span class="calendar-phase status-badge ${tone}">${E(phaseLabel(group.phase))}</span>`;
}

function renderCalendarLegend(layers) {
  const host = q('#calendarView .calendar-layer-switch');
  if (!host) return;
  host.innerHTML = calendarKinds.map(([key, label, , icon]) => `<button type="button" data-calendar-layer="${key}" aria-pressed="${layers[key] !== false}" title="Show or hide ${label.toLowerCase()}. Shift-click to show only this category."><span class="calendar-type-symbol type-${key}" aria-hidden="true">${key === 'transport' ? transportIcon('flight') : icon}</span>${label}</button>`).join('');
  const reset = q('[data-calendar-show-all]');
  if (reset) reset.hidden = calendarKinds.every(([key]) => layers[key] !== false);
}

function countryRow(countries, date) {
  if (!countries.length) return '';
  const visible = countries.slice(0, 2), extra = countries.length - visible.length;
  return `<div class="calendar-country-row ${countries.length > 1 ? 'calendar-country-split' : ''}" style="grid-template-columns:repeat(${visible.length},minmax(0,1fr))${extra ? ' 23px' : ''}">${visible.map(({record:s}) => {
    const schengen = SCHENGEN.has(s.countryCode);
    return `<div class="calendar-country-section"><button type="button" class="calendar-journey-chip${schengen ? ' is-schengen' : ''}" data-calendar-edit-country="${E(s.id)}" ${entryAttributes('country',s.id,date)} aria-label="${E(s.countryName)}${schengen ? ' · Schengen Area' : ''}">${flagHtml(s.domesticDestination || s.countryCode,'calendar-chip-flag')}<span class="calendar-journey-copy"><strong class="country-name-full">${E(s.countryName)}</strong><strong class="country-name-compact" aria-hidden="true">${E(s.domesticDestination ? s.countryName.slice(0,3) : s.countryCode)}</strong></span>${schengen ? '<span class="calendar-schengen in" aria-hidden="true"></span>' : ''}</button>${window.HVVisaNotices?.indicator(s) || ''}</div>`;
  }).join('')}${extra ? `<button type="button" class="calendar-more-countries" data-calendar-countries-detail="${date}" aria-label="Explore all ${countries.length} countries on ${E(dateText(date))}"><span class="calendar-more-desktop">+${extra}</span><span class="calendar-more-mobile">+${countries.length-1}</span></button>` : ''}</div>`;
}

function calendarTransportChip(record, date) {
  const label = HVJourneys.transportLabel(record);
  const compact = record.type === 'flight' ? HVJourney.flightLegs(record).flatMap((leg,index) => index ? [HVJourney.airportLabel(leg.end,HVJourneys.airportFor)] : [HVJourney.airportLabel(leg.start,HVJourneys.airportFor),HVJourney.airportLabel(leg.end,HVJourneys.airportFor)]).filter(Boolean).join(' → ') : label;
  return `<button type="button" class="calendar-day-transport" data-calendar-edit-transport="${E(record.id)}" ${entryAttributes('transport',record.id,date)} aria-label="${E(label)}"><span class="calendar-transport-cue" aria-hidden="true">${transportIcon(record.type)}</span><span class="calendar-route-label">${E(compact)}</span></button>`;
}

function renderMonth() {
  if (document.body.dataset.currentView && document.body.dataset.currentView !== 'calendar') return;
  const calendar = $('calendar');
  if (!calendar) return;
  calendar.dataset.journeyCalendar = 'true';
  const focused = document.activeElement;
  const focusDate = focused?.dataset.calendarDateSelect;
  const cursor = calendarCursor, start = addDays(cursor,-((cursor.getUTCDay()+6)%7));
  const layers = visibleLayers(), current = today(), groups = buildJourneys();
  renderCalendarLegend(layers);
  window.HVCalendar._groups = groups;
  const dateWindow = HVCalendarData.window(state,dayKey(start),42);
  $('calendarTitle').textContent = cursor.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  if ($('calendarMonthJump')) $('calendarMonthJump').value = String(cursor.getUTCMonth());
  if ($('calendarYearJump')) $('calendarYearJump').value = String(cursor.getUTCFullYear());

  const monthDays = [...dateWindow.values()].map(day => ({
    day,
    segments:HVCalendarLayout.lodging(layers.accommodation ? day.accommodations : [],day.date),
    countries:HVCalendarLayout.countries(layers.countries ? day.stays : [],day.transports,day.date),
  }));
  // Every day uses the same lanes, independent of the number of entries on that day.
  calendar.style.setProperty('--calendar-country-rows',Number(layers.countries && monthDays.some(item => item.countries.length)));
  calendar.style.setProperty('--calendar-has-lodging',Number(layers.accommodation && monthDays.some(item => item.segments.length)));
  calendar.style.setProperty('--calendar-transport-rows',layers.transport ? Math.min(2,Math.max(0,...monthDays.map(item => item.day.transports.length))) : 0);
  calendar.classList.toggle('calendar-has-countries',layers.countries && monthDays.some(item => item.countries.length));
  let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
  for (let index=0; index<monthDays.length; index++) {
    const {day,segments,countries} = monthDays[index], date = day.date;
    const transports = layers.transport ? [...day.transports].sort((a,b) => String(a.startLocal||'').localeCompare(String(b.startLocal||''))) : [];
    const notes = layers.notes ? day.notes : [], places = layers.locations ? day.places : [];
    const selection = calendarSelectionStart && date >= calendarSelectionStart && date <= (calendarSelectionEnd||calendarSelectionStart);
    const lodging = renderLodgingLane(segments,date);
    const noteChips = notes.slice(0,1).map(note => `<button type="button" class="calendar-note-chip" ${entryAttributes('note',note.id,date)}><span aria-hidden="true">✎</span><span>${E(note.title || note.body || 'Note')}</span></button>`).join('');
    const placeChips = (notes.length ? [] : places.slice(0,1)).map(place => `<button type="button" class="calendar-place-chip" ${entryAttributes('location',place.id,date)}><span aria-hidden="true">◎</span><span>${E(HVAddress.field(place.place,'name') || 'Saved location')}</span></button>`).join('');
    const count = countries.length+segments.length+transports.length+notes.length+places.length;
    const hiddenCount = Math.max(0,countries.length-2)+Math.max(0,transports.length-2)+Math.max(0,notes.length-1)+Math.max(0,places.length-(notes.length?0:1));
    const status = day.status === 'home' ? `<button type="button" class="calendar-home-icon" data-calendar-home-select="${date}" aria-label="Home on ${E(dateText(date))}">⌂</button>` : '';
    html += `<div class="calendar-day ${cursor.getUTCMonth() === addDays(start,index).getUTCMonth() ? '' : 'outside'} ${date === current ? 'today' : ''} ${selection ? 'selection-range' : ''} ${date === calendarSelectionStart ? 'selection-start' : ''} ${date === calendarSelectionEnd ? 'selection-end' : ''}" data-calendar-date="${date}" data-home-status="${day.status}" role="group" aria-label="${E(dateText(date))}">
      <div class="calendar-day-top"><button type="button" class="day-number" data-calendar-date-select="${date}" aria-label="Explore ${E(dateText(date))}" aria-pressed="${!!selection}">${addDays(start,index).getUTCDate()}</button><div class="calendar-day-status">${status}${notes.length ? `<button type="button" class="calendar-note-indicator" data-calendar-notes-date="${date}" aria-label="${notes.length} notes on ${E(dateText(date))}">✎</button>` : ''}${date === current ? '<span>Today</span>' : ''}</div></div>
      <div class="calendar-journeys"><div class="calendar-countries">${countryRow(countries,date)}${layers.countries && day.sea.length && !countries.length ? '<span class="calendar-sea-mark">≈ At sea</span>' : ''}</div>${lodging ? `<div class="calendar-lodging">${lodging}</div>` : '<div class="calendar-lodging-space" aria-hidden="true"></div>'}<div class="calendar-transports">${transports.slice(0,2).map(record => calendarTransportChip(record,date)).join('')}</div></div>
      <div class="calendar-secondary-entries">${noteChips}${placeChips}</div>
      ${count ? `<button type="button" class="calendar-day-detail-link" data-calendar-day-detail="${date}" aria-controls="calendarJourneyDetail" aria-label="Explore all ${count} entries for ${E(dateText(date))}"><span class="calendar-detail-desktop">${hiddenCount ? '+'+hiddenCount+' more' : 'Explore day'}</span><span class="calendar-detail-mobile">${count} ${count===1 ? 'entry' : 'entries'}</span><span aria-hidden="true">↗</span></button>` : ''}</div>`;
  }
  window.HVCalendarDetails?.hide();
  calendar.innerHTML = html;
  if (typeof updateCalendarSelectionUI === 'function') updateCalendarSelectionUI();
  const info = $('calendarSelectionInfo');
  if (info) info.innerHTML = rangeSelecting ? `<strong>${calendarSelectionStart ? 'Choose the last day' : 'Choose the first day'}</strong><span>Select dates in the month. Escape cancels.</span>` : calendarSelectionEnd ? `<strong>${E(dateRangeText(calendarSelectionStart,calendarSelectionEnd))}</strong><span>Selected range · add travel from the explorer.</span>` : '<strong>Your journey, day by day</strong><span>Select a day to explore. Hover an entry for a preview.</span>';
  if(info && calendarKinds.some(([key])=>layers[key]===false))info.innerHTML += '<button type="button" class="text-btn" data-calendar-show-all>Show all</button>';
  q('[data-calendar-select-range]')?.setAttribute('aria-pressed',String(rangeSelecting));
  renderJourneyDetail();
  if (focusDate) calendar.querySelector(`[data-calendar-date-select="${CSS.escape(focusDate)}"]`)?.focus({preventScroll:true});
  window.dispatchEvent(new CustomEvent('hv-calendar-rendered'));
}

function renderLodgingLane(segments,date) {
  if (!segments.length) return '';
  const labels = {checkout:'Check-out',checkin:'Check-in',continuing:'Staying','same-day':'Same-day check-in and check-out',incomplete:'Dates incomplete'};
  if (segments.some(segment => segment.complex)) return `<button type="button" class="calendar-lodging-summary" data-calendar-lodging-detail="${date}" aria-label="${E(segments.map(({record,phase}) => `${record.propertyName || 'Accommodation'} · ${labels[phase]}`).join('; '))}. Explore accommodation"><span aria-hidden="true">⌂</span> ${segments.length === 1 && segments[0].phase === 'incomplete' ? 'Dates needed' : segments.length+' '+(segments.length===1 ? 'stay' : 'stays')} <span class="lodging-summary-detail">· explore</span></button>`;
  return `<div class="calendar-lodging-row" role="group" aria-label="Accommodation on ${date}: ${E(segments.map(({record})=>[record.propertyName,HVAddress.text(record.location)].filter(Boolean).join(', ')).join('; '))}" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[...segments].sort((a,b) => a.column-b.column).map(({record:a,phase,column,span}) => `<button type="button" class="calendar-lodging-half occupied ${phase === 'checkout' ? 'lodging-end' : phase === 'checkin' ? 'lodging-start' : 'lodging-continuing'}" style="grid-column:${column}/span ${span}" data-calendar-edit-accommodation="${E(a.id)}" ${entryAttributes('accommodation',a.id,date)} aria-label="${E(a.propertyName || 'Accommodation')} · ${labels[phase]}"><span class="${phase === 'checkout' || phase === 'checkin' ? 'calendar-lodging-state' : 'calendar-lodging-cue'}" aria-hidden="true">${phase === 'checkout' ? 'Out' : phase === 'checkin' ? 'In' : '⌂'}</span><small class="calendar-lodging-name">${E(a.propertyName || 'Accommodation')}</small></button>`).join('')}</div>`;
}

function focusCalendarDetail() {
  const host = $('calendarJourneyDetail');
  if (host && !host.hidden) {
    host.scrollTop=0;
    (q('[data-calendar-detail-heading]',host)||host).focus({preventScroll:true});
  }
}

function selectDate(date, extend = false) {
  detailReturnFocus = document.activeElement;
  selectedEntry = null;
  selectedJourneyKey = '';
  dateAction = '';
  if (rangeSelecting || extend) {
    if (!calendarSelectionStart || calendarSelectionEnd) {
      calendarSelectionStart = date;
      calendarSelectionEnd = null;
      selectedDate = '';
    } else {
      const first = calendarSelectionStart;
      calendarSelectionStart = first < date ? first : date;
      calendarSelectionEnd = first < date ? date : first;
      selectedDate = calendarSelectionStart;
      rangeSelecting = false;
    }
  } else {
    selectedDate = date;
    calendarSelectionStart = date;
    calendarSelectionEnd = null;
  }
  renderMonth();
  focusCalendarDetail();
}

function openCalendarEntry(kind,id,date) {
  if (!window.HVCalendarDetails?.record(kind,id)) return;
  if (!selectedEntry) {
    detailReturnFocus = document.activeElement;
    dayExplorerScroll = $('calendarJourneyDetail').scrollTop;
  }
  selectedEntry = {kind,id,date:date||selectedDate||today()};
  selectedJourneyKey = '';
  window.HVCalendarDetails.hide();
  renderJourneyDetail();
  focusCalendarDetail();
}

function selectJourney(key, date = '') {
  detailReturnFocus = document.activeElement;
  selectedEntry = null;
  selectedJourneyKey = key;
  selectedDate = date;
  renderJourneyDetail();
  focusCalendarDetail();
}

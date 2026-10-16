function phaseLabel(phase) {
  return (
    {
      active: 'Travelling now',
      upcoming: 'Upcoming',
      completed: 'Completed',
      cancelled: 'Cancelled',
      draft: 'Draft',
    }[phase] || 'Journey'
  );
}

function statusBadge(group) {
  const tone =
    group.phase === 'active'
      ? 'good'
      : group.phase === 'upcoming'
        ? 'warn'
        : group.phase === 'cancelled'
          ? 'bad'
          : 'neutral';
  return `<span class="calendar-phase status-badge ${tone}">${E(phaseLabel(group.phase))}</span>`;
}

function renderMonth() {
  if (document.body.dataset.currentView && document.body.dataset.currentView !== 'calendar') return;
  const calendar = $('calendar');
  if (!calendar) return;
  calendar.dataset.journeyCalendar = 'true';
  const focusDate = document.activeElement?.dataset.calendarDateSelect;
  const cursor = calendarCursor;
  const first = (cursor.getUTCDay() + 6) % 7;
  const start = addDays(cursor, -first);
  const current = today();
  const layers = visibleLayers();
  qa('[data-calendar-layer]').forEach((button) =>
    button.setAttribute('aria-pressed', String(layers[button.dataset.calendarLayer] !== false)),
  );
  const groups = buildJourneys();
  window.HVCalendar._groups = groups;
  const dateWindow=HVCalendarData.window(state,dayKey(start),42);

  $('calendarTitle').textContent = cursor.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const monthJump = $('calendarMonthJump'),
    yearJump = $('calendarYearJump');
  if (monthJump) monthJump.value = String(cursor.getUTCMonth());
  if (yearJump) yearJump.value = String(cursor.getUTCFullYear());

  // Compute the month once. Shared slot heights keep the accommodation lane
  // at the same position in every day, including quiet days and week boundaries.
  const monthDays=[...dateWindow.values()].map(day=>{
    const segments=HVCalendarLayout.lodging(layers.accommodation?day.accommodations:[],day.date);
    const countries=HVCalendarLayout.countries(layers.countries?day.stays:[],day.transports,day.date);
    const countryLimit=(layers.transport?day.transports.length:0)+segments.length>2?2:4;
    const visible=countries.slice(0,countryLimit),columns=countries.length>=4?2:Math.max(1,countries.length);
    return {day,segments,countries,countryLimit,countryRows:Math.ceil(visible.length/columns)};
  });
  const max=project=>Math.max(0,...monthDays.map(project));
  calendar.style.setProperty('--calendar-country-rows',max(item=>item.countryRows));
  calendar.style.setProperty('--calendar-country-more',max(item=>Number(item.countries.length>item.countryLimit)));
  calendar.style.setProperty('--calendar-transport-rows',layers.transport?max(item=>Math.min(2,item.day.transports.length)):0);
  calendar.style.setProperty('--calendar-has-lodging',Number(layers.accommodation&&monthDays.some(item=>item.segments.length)));
  calendar.classList.toggle('calendar-has-countries',layers.countries&&monthDays.some(item=>item.countries.length));
  let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join('');
  for (let index = 0; index < monthDays.length; index++) {
    const {day,segments,countries,countryLimit}=monthDays[index],date=day.date;
    const activeGroups = groupsForDate(date, groups, layers,day);

    const sea = layers.countries ? day.sea : [];
    const selectionRange =
      calendarSelectionStart &&
      calendarSelectionEnd &&
      date >= calendarSelectionStart &&
      date <= calendarSelectionEnd;
    const selectionStart = date === calendarSelectionStart;
    const selectionEnd = date === calendarSelectionEnd;
    const allTransport=day.transports;
    const visibleCountries = countries.slice(0, countryLimit),
      columns = countries.length >= 4 ? 2 : Math.max(1, countries.length);
    const countryRows = [];
    for (let n = 0; n < visibleCountries.length; n += columns) {
      const chunk = visibleCountries.slice(n, n + columns),
        split = countries.length > 1;
      countryRows.push(
        `<div class="calendar-country-row ${countries.length === 2 ? 'calendar-country-pair' : ''} ${split ? 'calendar-country-split' : ''} ${countries.length === 3 ? 'calendar-country-triple' : ''}" style="grid-template-columns:${chunk.map((s) => `minmax(0,${split ? 1 : s.width}fr)`).join(' ')}">${chunk
          .map(({ record: s }) => {
            const group = journeyCache.memberships.stays.get(s.id);
            return `<div class="calendar-country-section"><button type="button" class="calendar-journey-chip" data-calendar-journey="${E(group?.key || stayKey(s.id))}" data-calendar-edit-country="${E(s.id)}" aria-label="${E(s.countryName)}${SCHENGEN.has(s.countryCode) ? ' · Schengen Area' : ''}" data-calendar-date="${date}" title="${E(s.countryName)}${s.location ? ' · ' + E(s.location) : ''}">${flagHtml(s.domesticDestination || s.countryCode, 'calendar-chip-flag')}<span class="calendar-journey-copy"><strong class="country-name-full">${E(s.countryName)}</strong><strong class="country-name-compact" aria-hidden="true">${E(s.domesticDestination ? s.countryName.slice(0, 3) : s.countryCode)}</strong></span>${SCHENGEN.has(s.countryCode) ? '<span class="calendar-schengen in" role="img" aria-label="Schengen Area" title="Schengen Area">' + (countries.length === 1 ? 'S' : '') + '</span>' : ''}</button>${window.HVVisaNotices?.indicator(s) || ''}</div>`;
          })
          .join('')}</div>`,
      );
    }
    const extraCountries = countries.slice(countryLimit).map(({ record }) => record);
    const moreCountries = extraCountries.length
      ? `<button type="button" class="calendar-more-countries" data-calendar-more-countries="${E(JSON.stringify(extraCountries.map((s) => s.id)))}" aria-label="${E(extraCountries.length + ' more countries: ' + extraCountries.map((s) => s.countryName).join(', '))}" title="${E(extraCountries.map((s) => s.countryName).join(', '))}">+${extraCountries.length}<span class="calendar-more-label"> countries</span></button>`
      : '';
    const chips = countryRows.join('') + moreCountries;
    const transportChips = layers.transport
      ? allTransport.slice(0,2)
          .map((t) => {
            const fullLabel = HVJourneys.transportLabel(t),
              cellLabel =
                t.type === 'flight'
                  ? HVJourney.flightLegs(t)
                      .flatMap((leg, index) =>
                        index
                          ? [HVJourney.airportLabel(leg.end, HVJourneys.airportFor)]
                          : [
                              HVJourney.airportLabel(leg.start, HVJourneys.airportFor),
                              HVJourney.airportLabel(leg.end, HVJourneys.airportFor),
                            ],
                      )
                      .filter(Boolean)
                      .join(' → ')
                  : fullLabel;
            return `<button type="button" class="calendar-day-transport" aria-label="${E(fullLabel)}" data-calendar-edit-transport="${E(t.id)}" title="${E(fullLabel)}"><span class="calendar-transport-cue" aria-hidden="true">${transportIcon(t.type)}</span><span class="calendar-route-label">${E(cellLabel)}</span></button>`;
          })
          .join('')
      : '';
    const lodging = renderLodgingLane(segments,date);
    const places=layers.countries?day.places:[];
    const placeChips = places.slice(0,1)
      .map(
        (v) =>
          `<button type="button" class="calendar-place-chip" data-place-edit="${E(v.id)}" title="${E(HVAddress.address(v.place))}">◎ ${E(HVAddress.field(v.place, 'name') || 'Saved location')}</button>`,
      )
      .join('');
    const homeStatus = day.status;
    const homeLabel =
      homeStatus === 'home'
        ? `<button type="button" class="calendar-home-icon" data-calendar-home-select="${date}" aria-label="Home, select ${date}" title="Home">⌂</button>`
        : '';
    const entryCount=countries.length+(layers.transport?allTransport.length:0)+segments.length+places.length+day.notes.length;
    const busy=countries.length>1||segments.length>1||segments.some(s=>s.complex)||(layers.transport&&allTransport.length>2)||places.length>1;
    const dayDetails=entryCount?`<button type="button" class="calendar-day-detail-link ${busy?'':'calendar-detail-mobile'}" data-calendar-day-detail="${date}" aria-controls="calendarJourneyDetail" aria-label="View all ${entryCount} entries for ${E(dateText(date))}">${busy?'View all '+entryCount:'Details'}</button>`:'';
    const primary = activeGroups[0]?.key || '';
    const seaLabel = sea.length
      ? `<span class="calendar-sea-mark" title="At sea">≈ At sea</span>`
      : '';
    html += `<div class="calendar-day ${cursor.getUTCMonth() === addDays(start, index).getUTCMonth() ? '' : 'outside'} ${date === current ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${E(date)}" data-calendar-primary="${E(primary)}" data-home-status="${homeStatus}" role="group" aria-label="${E(dateText(date))}"><div class="calendar-day-top"><button type="button" class="day-number" data-calendar-date-select="${E(date)}" aria-label="Select ${E(dateText(date))}" aria-pressed="${!!(selectionRange || selectionStart || selectionEnd)}">${addDays(start, index).getUTCDate()}</button><div class="calendar-day-status">${homeLabel}${day.notes.length?`<button type="button" class="calendar-note-indicator" data-calendar-notes-date="${date}" aria-label="${day.notes.length} notes on ${E(dateText(date))}" title="${E(day.notes.map(n=>n.title).join('; '))}">✎</button>`:''}${date === current ? '<span>Today</span>' : ''}</div></div><div class="calendar-journeys"><div class="calendar-countries">${chips}</div><div class="calendar-transports">${transportChips}</div>${lodging ? `<div class="calendar-lodging">${lodging}</div>` : '<div class="calendar-lodging-space" aria-hidden="true"></div>'}</div>${placeChips ? `<div class="calendar-place-row">${placeChips}</div>` : ''}<div class="calendar-day-markers">${seaLabel}</div>${dayDetails}</div>`;
  }
  window.HVCalendarDetails?.hide();
  calendar.innerHTML = html;
  qa('[data-calendar-date]', calendar).forEach((day) => {
    day.addEventListener('click', (event) => {
      if (event.target.closest('button,a,input,select,textarea')) return;
      event.stopPropagation();
      selectDate(day.dataset.calendarDate);
    });
    day.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === day) {
        event.preventDefault();
        event.stopPropagation();
        selectDate(day.dataset.calendarDate);
      }
    });
  });
  if (typeof updateCalendarSelectionUI === 'function') updateCalendarSelectionUI();
  renderJourneyDetail();
  if (focusDate)
    calendar.querySelector(`[data-calendar-date-select="${CSS.escape(focusDate)}"]`)?.focus();
}

function renderLodgingLane(segments,date) {
  if(!segments.length)return '';
  const phaseLabel={checkout:'Check-out',checkin:'Check-in',continuing:'Staying', 'same-day':'Same-day check-in and check-out',incomplete:'Dates incomplete'};
  const label=segments.map(({record,phase})=>`${record.propertyName||'Accommodation'} · ${phaseLabel[phase]}`).join('; ');
  if(segments.some(segment=>segment.complex))return `<button type="button" class="calendar-lodging-summary" data-calendar-lodging-detail="${date}" aria-controls="calendarJourneyDetail" aria-label="${E(label)}. View all accommodation details"><span aria-hidden="true">⌂</span> ${segments.length===1&&segments[0].phase==='incomplete'?'Dates needed':segments.length+' '+(segments.length===1?'stay':'stays')} <span class="lodging-summary-detail">· details</span></button>`;
  return `<div class="calendar-lodging-row" role="group" aria-label="Accommodation on ${date}: ${E(segments.map(({record:a})=>[a.propertyName,HVAddress.text(a.location)].filter(Boolean).join(', ')).join('; '))}" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[...segments].sort((a,b)=>a.column-b.column).map(({record:a,phase,column,span})=>{
    const boundary=phase==='checkout'||phase==='checkin';
    return `<button type="button" class="calendar-lodging-half occupied ${phase==='checkout'?'lodging-end':phase==='checkin'?'lodging-start':'lodging-continuing'}" style="grid-column:${column}/span ${span}" data-calendar-edit-accommodation="${E(a.id)}" aria-label="${E(a.propertyName||'Accommodation')} · ${phaseLabel[phase]}" title="${E(a.propertyName)} · ${E([a.checkIn,a.checkInTime,'to',a.checkOut,a.checkOutTime].filter(Boolean).join(' '))}">${boundary?`<span class="calendar-lodging-state">${phase==='checkout'?'Out':'In'}</span>`:'<span class="calendar-lodging-cue" aria-hidden="true">⌂</span>'}<small class="calendar-lodging-name">${E(a.propertyName||'Accommodation')}</small></button>`;
  }).join('')}</div>`;
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
  const detail=$('calendarJourneyDetail');
  detail?.setAttribute('tabindex','-1');
  detail?.focus();
  detail?.scrollIntoView({block:'nearest'});
}

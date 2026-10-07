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

  $('calendarTitle').textContent = cursor.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const monthJump = $('calendarMonthJump'),
    yearJump = $('calendarYearJump');
  if (monthJump) monthJump.value = String(cursor.getUTCMonth());
  if (yearJump) yearJump.value = String(cursor.getUTCFullYear());

  let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join('');
  for (let index = 0; index < 42; index++) {
    const date = dayKey(addDays(start, index));
    const activeGroups = groupsForDate(date, groups, layers);

    const sea = layers.countries ? seaForDate(date) : [];
    const selectionRange =
      calendarSelectionStart &&
      calendarSelectionEnd &&
      date >= calendarSelectionStart &&
      date <= calendarSelectionEnd;
    const selectionStart = date === calendarSelectionStart;
    const selectionEnd = date === calendarSelectionEnd;
    const allTransport = HVJourney.visibleTransport(state).filter(
      (t) => !HVJourney.hiddenHomeRecord(state, t) && HVJourney.transportDates(t).includes(date),
    );
    const dayStays = layers.countries
      ? scoped(state.stays).filter(
          (s) =>
            s.status !== 'cancelled' &&
            s.start <= date &&
            s.end >= date &&
            HVJourney.isTravelStay(state, s, date),
        )
      : [];
    const countries = HVCalendarLayout.countries(dayStays, allTransport, date);
    const visibleCountries = countries.slice(0, 4),
      columns = countries.length >= 4 ? 2 : Math.max(1, countries.length);
    const countryRows = [];
    for (let n = 0; n < visibleCountries.length; n += columns) {
      const chunk = visibleCountries.slice(n, n + columns),
        split = countries.length > 1;
      countryRows.push(
        `<div class="calendar-country-row ${countries.length === 2 ? 'calendar-country-pair' : ''} ${split ? 'calendar-country-split' : ''} ${countries.length === 3 ? 'calendar-country-triple' : ''}" style="grid-template-columns:${chunk.map((s) => `minmax(0,${split ? 1 : s.width}fr)`).join(' ')}">${chunk
          .map(({ record: s }) => {
            const group = groups.find((g) => g.stays.some((x) => x.id === s.id));
            return `<div class="calendar-country-section"><button type="button" class="calendar-journey-chip" data-calendar-journey="${E(group?.key || stayKey(s.id))}" data-calendar-edit-country="${E(s.id)}" aria-label="${E(s.countryName)}${SCHENGEN.has(s.countryCode) ? ' · Schengen Area' : ''}" data-calendar-date="${date}" title="${E(s.countryName)}${s.location ? ' · ' + E(s.location) : ''}">${flagHtml(s.domesticDestination || s.countryCode, 'calendar-chip-flag')}<span class="calendar-journey-copy"><strong class="country-name-full">${E(s.countryName)}</strong><strong class="country-name-compact" aria-hidden="true">${E(s.domesticDestination ? s.countryName.slice(0, 3) : s.countryCode)}</strong></span>${SCHENGEN.has(s.countryCode) ? '<span class="calendar-schengen in" role="img" aria-label="Schengen Area" title="Schengen Area">' + (countries.length === 1 ? 'S' : '') + '</span>' : ''}</button>${window.HVVisaNotices?.indicator(s) || ''}</div>`;
          })
          .join('')}</div>`,
      );
    }
    const extraCountries = countries.slice(4).map(({ record }) => record);
    const moreCountries = extraCountries.length
      ? `<button type="button" class="calendar-more-countries" data-calendar-more-countries="${E(JSON.stringify(extraCountries.map((s) => s.id)))}" aria-label="${E(extraCountries.length + ' more countries: ' + extraCountries.map((s) => s.countryName).join(', '))}" title="${E(extraCountries.map((s) => s.countryName).join(', '))}">+${extraCountries.length} countries</button>`
      : '';
    const chips = countryRows.join('') + moreCountries;
    const transportChips = layers.transport
      ? allTransport
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
    const stays = layers.accommodation
      ? scoped(state.accommodations).filter(
          (a) =>
            !HVJourney.hiddenHomeRecord(state, a) &&
            !state.trips.some((t) => t.id === a.tripId && t.status === 'cancelled'),
        )
      : [];
    const segments = HVCalendarLayout.lodging(stays, date);
    const lodging = segments.length
      ? `<div class="calendar-lodging-row" aria-label="Accommodation on ${date}: ${E(segments.map(({ record: a }) => a.propertyName + ', ' + a.location).join('; '))}" style="grid-template-columns:${segments[0].columns.map((width) => `minmax(0,${width}fr)`).join(' ')}">${segments.map(({ record: a, column, span }) => `<button type="button" class="calendar-lodging-half occupied ${a.checkOut === date ? 'lodging-end' : ''} ${a.checkIn === date ? 'lodging-start' : ''}" style="grid-column:${column}/span ${span};grid-row:1" data-calendar-edit-accommodation="${E(a.id)}" aria-label="${E(a.propertyName)} · ${a.checkIn === date ? 'Check-in' : a.checkOut === date ? 'Check-out' : 'Staying'}" title="${E(a.propertyName)} · ${E(a.checkIn + ' ' + (a.checkInTime || '') + ' to ' + a.checkOut + ' ' + (a.checkOutTime || ''))}"><small><span class="calendar-lodging-cue" aria-hidden="true">⌂</span>${E(a.propertyName)}</small></button>`).join('')}</div>`
      : '';
    const places = layers.countries
      ? scoped(state.placeVisits).filter(
          (v) =>
            v.category === 'locations' &&
            v.status === 'visited' &&
            v.date <= date &&
            (v.endDate || v.date) >= date &&
            !HVJourney.hiddenHomeRecord(state, v),
        )
      : [];
    const placeChips = places
      .map(
        (v) =>
          `<button type="button" class="calendar-place-chip" data-place-edit="${E(v.id)}" title="${E(HVAddress.address(v.place))}">◎ ${E(HVAddress.field(v.place, 'name') || 'Saved location')}</button>`,
      )
      .join('');
    const homeStatus = HVJourney.dayStatus(state, date);
    const homeLabel =
      homeStatus === 'home'
        ? `<button type="button" class="calendar-home-icon" data-calendar-home-select="${date}" aria-label="Home, select ${date}" title="Home">⌂</button>`
        : '';
    const primary = activeGroups[0]?.key || '';
    const seaLabel = sea.length
      ? `<span class="calendar-sea-mark" title="At sea">≈ At sea</span>`
      : '';
    html += `<div class="calendar-day ${cursor.getUTCMonth() === addDays(start, index).getUTCMonth() ? '' : 'outside'} ${date === current ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${E(date)}" data-calendar-primary="${E(primary)}" data-home-status="${homeStatus}" role="group" aria-label="${E(dateText(date))}"><div class="calendar-day-top"><button type="button" class="day-number" data-calendar-date-select="${E(date)}" aria-label="Select ${E(dateText(date))}" aria-pressed="${!!(selectionRange || selectionStart || selectionEnd)}">${addDays(start, index).getUTCDate()}</button><div class="calendar-day-status">${homeLabel}${date === current ? '<span>Today</span>' : ''}</div></div><div class="calendar-journeys">${chips}${lodging ? `<div class="calendar-lodging">${lodging}</div>` : ''}${transportChips}</div>${placeChips ? `<div class="calendar-place-row">${placeChips}</div>` : ''}<div class="calendar-day-markers">${seaLabel}</div></div>`;
  }
  window.HVCalendarDetails?.hide();
  calendar.innerHTML = html;
  fitCalendarContent(calendar);
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

function fitCalendarContent(calendar) {
  // Measure real content, rather than abbreviating because a day is classified dense.
  if (!calendar.querySelector('.calendar-day')?.getBoundingClientRect().width) return;
  const canvas = document.createElement('canvas'),
    context = canvas.getContext('2d');
  if (!context) return;
  const natural = (node) => {
    context.font = getComputedStyle(node).font;
    return context.measureText(node.textContent).width;
  };
  for (const day of calendar.querySelectorAll('.calendar-day')) {
    if (!day.getBoundingClientRect().width) continue;
    day.classList.remove('calendar-day-dense');
    day
      .querySelectorAll('.calendar-entry-wrap')
      .forEach((n) => n.classList.remove('calendar-entry-wrap'));
    const bottom = () =>
      Math.max(
        ...[
          ...day.querySelectorAll(
            '.calendar-day-top,.calendar-journeys,.calendar-place-row,.calendar-day-markers:has(*)',
          ),
        ].map((n) => n.getBoundingClientRect().bottom),
      );
    const limit = () => {
      const style = getComputedStyle(day);
      return (
        day.getBoundingClientRect().bottom -
        parseFloat(style.paddingBottom) -
        (parseFloat(style.borderBottomWidth) || 0)
      );
    };
    for (const row of day.querySelectorAll('.calendar-country-row')) {
      if (row.classList.contains('calendar-country-split')) continue;
      const sections = [...row.children],
        needs = sections.map((section) => {
          const label = section.querySelector('.country-name-full'),
            chip = section.querySelector('button'),
            style = getComputedStyle(chip);
          return (
            natural(label) +
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight) +
            (section.querySelector('.calendar-chip-flag')?.getBoundingClientRect().width || 0) +
            (parseFloat(style.columnGap) || 0) +
            1
          );
        });
      row.style.gridTemplateColumns = needs.map((n) => `minmax(0,${Math.max(1, n)}fr)`).join(' ');
      if (sections.length > 1 && needs.reduce((a, b) => a + b, 0) > row.clientWidth) {
        row.style.gridTemplateColumns = 'minmax(0,1fr)';
        if (bottom() > limit())
          row.style.gridTemplateColumns = needs
            .map((n) => `minmax(0,${Math.max(1, n)}fr)`)
            .join(' ');
      }
    }
    // Use the established compact treatment only when the actual rows exceed this cell.
    if (bottom() > limit()) day.classList.add('calendar-day-dense');
    const labels = [
      ...day.querySelectorAll(
        '.country-name-full,.calendar-route-label,.calendar-lodging-half small',
      ),
    ];
    for (const label of labels) {
      if (!label.getClientRects().length) continue;
      if (label.scrollWidth > label.clientWidth + 1) {
        const button = label.closest('button');
        button.classList.add('calendar-entry-wrap');
        // Hotels wrap inside their fixed row; other entries may use a second line only if it fits.
        if (button.matches('.calendar-lodging-half')) {
          const style = getComputedStyle(button),
            available =
              button.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
          if (parseFloat(getComputedStyle(label).lineHeight) * 2 > available)
            button.classList.remove('calendar-entry-wrap');
        } else if (bottom() > limit()) button.classList.remove('calendar-entry-wrap');
      }
    }
  }
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

function monthInsight(groups) {
  const cursor = calendarCursor;
  const start = isoDate(cursor),
    end = isoDate(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)));
  const inMonth = groups
    .filter(
      (group) =>
        group.stays.some((s) => HVJourney.isTravelStay(state, s)) ||
        group.transports.length ||
        group.accommodations.length,
    )
    .filter((group) => group.start && group.start <= end && group.end >= start);
  const upcoming = groups.filter((group) => group.phase === 'upcoming').slice(0, 3);
  return `<div class="calendar-detail-empty"><p class="eyebrow">YOUR MONTH</p><h2>${E(cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h2><p>${inMonth.length ? `${inMonth.length} ${inMonth.length === 1 ? 'journey' : 'journeys'} touch this month. Select a journey to see every stop, transfer and stay in order.` : 'No journeys touch this month yet. Pick dates on the calendar when you are ready to plan one.'}</p>${upcoming.length ? `<div class="calendar-next-list"><span>Coming up</span>${upcoming.map((group) => `<button type="button" data-calendar-open-journey="${E(group.key)}"><i style="--journey-colour:${E(group.colour)}"></i><strong>${E(group.title)}</strong><small>${E(dateRangeText(group.start, group.end))}</small></button>`).join('')}</div>` : ''}<button type="button" class="primary wide" data-calendar-plan>Plan a trip</button></div>`;
}

function dayInsight(date, groups) {
  const start = calendarSelectionStart || date,
    end = calendarSelectionEnd || start;
  const active = groups.filter(
    (group) =>
      group.stays.some((s) => s.status !== 'cancelled' && s.start <= end && s.end >= start) ||
      group.accommodations.some((a) => a.checkIn <= end && a.checkOut >= start) ||
      group.transports.some((t) => HVJourney.transportDates(t).some((d) => d >= start && d <= end)),
  );
  const entries =
    active
      .map(
        (group) =>
          `<div class="date-entry-group"><strong>${E(!group.trip && !group.stays.length && group.transports.length === 1 ? (group.transports[0].type === 'flight' ? 'Flight details' : 'Transport details') : group.title)}</strong><button type="button" class="text-btn" data-journey-map="${E(group.key)}">Journey Map →</button>${group.stays
            .filter((s) => s.start <= end && s.end >= start)
            .map(
              (s) =>
                `<button type="button" data-calendar-edit-stay="${E(s.id)}">${flagHtml(s.domesticDestination || s.countryCode, 'calendar-chip-flag')} ${E(s.countryName)} · ${E(dateRangeText(s.start, s.end))} <span>Edit</span></button>`,
            )
            .join('')}${group.accommodations
            .filter((a) => a.checkIn <= end && a.checkOut >= start)
            .map(
              (a) =>
                `<button type="button" data-calendar-edit-accommodation="${E(a.id)}">⌂ ${E(a.propertyName)} · ${E(dateRangeText(a.checkIn, a.checkOut))}${a.checkInTime || a.checkOutTime ? ' · ' + E([a.checkInTime, a.checkOutTime, a.timeZone].filter(Boolean).join(' / ')) : ''} <span>Edit</span></button>`,
            )
            .join('')}${group.transports
            .filter((t) => HVJourney.transportDates(t).some((d) => d >= start && d <= end))
            .map(
              (t) =>
                `${window.HVCalendarDetails?.transport(t) || ''}<button type="button" class="text-btn" data-calendar-edit-transport="${E(t.id)}">Edit transport</button>`,
            )
            .join('')}</div>`,
      )
      .join('') +
    scoped(state.placeVisits || [])
      .filter(
        (v) =>
          v.category === 'locations' &&
          v.status === 'visited' &&
          v.date <= end &&
          (v.endDate || v.date) >= start,
      )
      .map(
        (v) =>
          `<div class="date-entry-group"><button type="button" data-place-edit="${E(v.id)}">◎ ${E(v.place?.name || 'Saved place')} · ${E(dateText(v.date))} <span>Edit</span></button></div>`,
      )
      .join('');
  const action =
    dateAction === 'country'
      ? `<form id="calendarQuickCountry" class="calendar-quick-form"><label class="field"><span>Country</span><input type="text" name="country" list="countryList" required autocomplete="off" placeholder="Search a country"></label><label class="field"><span>City or area <em>optional</em></span><input type="text" name="location" maxlength="160"></label><button class="primary" type="submit">Save country stay</button><p class="form-error" role="alert"></p></form>`
      : dateAction === 'accommodation'
        ? `<form id="calendarQuickAccommodation" class="calendar-quick-form"><label class="field"><span>Accommodation</span><input type="text" name="propertyName" maxlength="160" required placeholder="Hotel, Airbnb or campsite"></label><label class="field"><span>Location</span><input type="text" name="location" maxlength="160" required></label><p class="helper">Check-in ${E(dateText(start))} · check-out ${E(dateText(end))}. You can edit both dates after saving.</p><button class="primary" type="submit">Save accommodation</button><p class="form-error" role="alert"></p></form>`
        : '';
  return `<div class="calendar-date-panel"><button class="calendar-date-close text-btn" type="button" data-calendar-close-date aria-label="Close date editor">Close ×</button><p class="eyebrow">SELECTED ${start === end ? 'DATE' : 'RANGE'}</p><h2>${E(dateRangeText(start, end))}</h2><p class="calendar-date-hint">${calendarSelectionEnd ? 'Add an entry across these dates, or select a new start date.' : 'Select another date to extend this range, or add an entry for this day.'}</p><div class="form-grid calendar-range-fields"><label class="field"><span>From</span><input type="date" data-range-start value="${E(start)}"></label><label class="field"><span>To</span><input type="date" data-range-end value="${E(end)}"></label></div><div class="calendar-date-actions"><button type="button" data-calendar-date-action="country" aria-pressed="${dateAction === 'country'}">+ Country</button><button type="button" data-calendar-date-action="accommodation" aria-pressed="${dateAction === 'accommodation'}">+ Accommodation</button><button type="button" data-calendar-date-action="transport">+ Transport</button><button type="button" data-calendar-date-action="location">+ Location</button></div><button type="button" class="secondary compact" data-create-range-trip data-start="${E(start)}" data-end="${E(end)}">Create Trip</button>${action}<section class="calendar-date-entries"><p class="eyebrow">ON THESE DATES</p>${entries || '<p>No entries recorded for these dates yet.</p>'}</section><button type="button" class="text-btn" data-calendar-plan data-calendar-plan-date="${E(start)}">Plan a full trip →</button></div>`;
}

function transportIcon(type) {
  return HVTransportIcons.html(type);
}

function transportDaySet(group) {
  return new Set(
    group.transports
      .filter((record) => record.status !== 'cancelled')
      .flatMap((record) => HVJourney.transportDates(record))
      .filter(Boolean),
  );
}

function atLocationDayCount(group) {
  const travel = transportDaySet(group),
    atLocation = new Set();
  for (const stay of group.stays.filter((record) => record.status !== 'cancelled')) {
    for (let date = stay.start; date <= stay.end; date = dayKey(addDays(parseDate(date), 1)))
      if (!travel.has(date)) atLocation.add(date);
  }
  return atLocation.size;
}

function schengenSummary(group) {
  const qualifying = group.stays.filter(
    (stay) => stay.status !== 'cancelled' && SCHENGEN.has(stay.countryCode) && !stay.schengenExempt,
  );
  if (!qualifying.length) return '';
  const used = new Set();
  qualifying.forEach((stay) => {
    for (let date = stay.start; date <= stay.end; date = dayKey(addDays(parseDate(date), 1)))
      used.add(date);
  });
  const exempt = isSchengenExemptProfile?.();
  return `<div class="calendar-rule-note"><strong>${exempt ? 'Schengen area' : 'Schengen 90/180'}</strong><span>${exempt ? `${used.size} day${used.size === 1 ? '' : 's'} in the Schengen area. Your saved passport profile is exempt from the short-stay calculator.` : `${used.size} day${used.size === 1 ? '' : 's'} in this journey count towards the calculator unless you mark a stay as exempt.`}</span><a href="#/schengen">Open planner</a></div>`;
}

function detailTimeline(group) {
  const entries = [
    ...group.stays.map((stay) => ({
      kind: 'stay',
      date: stay.start,
      end: stay.end,
      order: Number(stay.tripOrder || 0),
      record: stay,
    })),
    ...group.transports.map((record) => ({
      kind: 'transport',
      date: localDate(record.startLocal),
      end: localDate(record.endLocal),
      order: 1,
      time: record.startLocal?.slice(11) || '',
      record,
    })),
    ...group.accommodations.map((record) => ({
      kind: 'accommodation',
      date: record.checkIn,
      end: record.checkOut,
      order: 2,
      time: record.checkInTime || '',
      zone: record.timeZone || '',
      record,
    })),
  ]
    .filter((entry) => entry.date)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time && b.time && (!a.zone || !b.zone || a.zone === b.zone)
          ? a.time.localeCompare(b.time)
          : 0) ||
        (a.record.journeyOrder ?? a.order) - (b.record.journeyOrder ?? b.order),
    );
  return (
    entries
      .map((entry) => {
        if (entry.kind === 'stay') {
          const stay = entry.record;
          const lodging = group.accommodations.filter(
            (item) => item.checkIn >= stay.start && item.checkIn <= stay.end,
          );
          return `<li class="journey-timeline-item journey-stop"><div class="journey-timeline-date">${E(dateRangeText(stay.start, stay.end))}<small>${E(durationText(stay.start, stay.end))}</small></div><div class="journey-timeline-symbol">${stay.countryCode === 'SEA' ? '≈' : flagHtml(stay.domesticDestination || stay.countryCode, 'flag-img flag-sm')}</div><div class="journey-timeline-copy"><strong>${E(stay.location || stay.countryName)}</strong><span>${stay.location && stay.location !== stay.countryName ? E(stay.countryName) : ''}${stay.status === 'cancelled' ? ' · Cancelled' : ''}</span>${stay.notes ? `<p>${E(stay.notes)}</p>` : ''}${lodging.length ? `<div class="journey-inline-lodging">${lodging.map((item) => `<span>⌂ ${E(item.propertyName)}${item.location ? ` · ${E(HVAddress.text(item.location))}` : ''}</span>`).join('')}</div>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-stay="${E(stay.id)}">Edit</button></li>`;
        }
        if (entry.kind === 'transport') {
          const record = entry.record;
          const inferred = group.inferredTransportIds.has(record.id);
          return `<li class="journey-timeline-item journey-transfer"><div class="journey-timeline-date">${E(dateRangeText(entry.date, entry.end))}</div><div class="journey-timeline-symbol">${transportIcon(record.type)}</div><div class="journey-timeline-copy">${window.HVCalendarDetails?.transport(record) || E(HVJourneys.transportLabel(record))}${record.status === 'cancelled' ? '<span>Cancelled</span>' : ''}</div><button type="button" class="text-btn" data-calendar-edit-transport="${E(record.id)}">Edit</button></li>`;
        }
        const accommodation = entry.record;
        return `<li class="journey-timeline-item journey-accommodation"><div class="journey-timeline-date">${E(dateRangeText(accommodation.checkIn, accommodation.checkOut))}<small>${E(durationText(accommodation.checkIn, accommodation.checkOut))}</small></div><div class="journey-timeline-symbol">⌂</div><div class="journey-timeline-copy"><strong>${E(accommodation.propertyName)}</strong><span>${E(HVAddress.address(accommodation.place) || HVAddress.text(accommodation.location))}</span><small>${E([accommodation.checkInTime, accommodation.checkOutTime, accommodation.timeZone].filter(Boolean).join(' · '))}</small>${accommodation.notes ? `<p>${E(accommodation.notes)}</p>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-accommodation="${E(accommodation.id)}">Edit</button></li>`;
      })
      .join('') ||
    '<li class="journey-timeline-empty">This journey has no stops or transport yet.</li>'
  );
}

function renderJourneyDetail() {
  const host = $('calendarJourneyDetail');
  if (!host) return;
  host.classList.toggle('date-range-complete', !!calendarSelectionEnd);
  const groups = window.HVCalendar?._groups || buildJourneys();
  const group = groups.find((item) => item.key === selectedJourneyKey);
  if (!group) {
    host.innerHTML = selectedDate ? dayInsight(selectedDate, groups) : monthInsight(groups);
    if (selectedDate) {
      const start = calendarSelectionStart || selectedDate,
        end = calendarSelectionEnd || start;
      const matching = groups.filter((g) => g.trip && g.start <= end && g.end >= start);
      if (matching.length === 1) {
        const select = q('.calendar-quick-form [name="tripId"]', host);
        if (select) select.value = matching[0].trip.id;
      }
    }
    return;
  }
  const travelDays = transportDaySet(group).size;
  const locations = [...new Set(group.stays.map((stay) => stay.location || stay.countryName))];
  const tripNotes = [
    group.trip?.notes,
    ...group.stays.map((stay) => stay.notes).filter(Boolean),
  ].filter(Boolean);
  host.innerHTML = `<article class="calendar-detail-card"><header class="calendar-detail-head"><div><p class="eyebrow">${E(phaseLabel(group.phase))}</p><h2>${E(!group.trip && !group.stays.length && group.transports.length === 1 ? (group.transports[0].type === 'flight' ? 'Flight details' : 'Transport details') : group.title)}</h2><p>${E(dateRangeText(group.start, group.end))} · ${E(durationText(group.start, group.end))}</p></div>${statusBadge(group)}</header><div class="calendar-detail-countries">${[...new Map(group.stays.filter((s) => s.countryCode !== 'SEA').map((s) => [s.domesticDestination || s.countryCode, s])).values()].map((s) => `<span>${flagHtml(s.domesticDestination || s.countryCode, 'flag-img flag-sm')}${E(s.countryName || countryByCode(s.countryCode)?.name || s.countryCode)}${window.HVVisaNotices?.detailLink(s) || ''}</span>`).join('') || (group.stays.some((s) => s.countryCode === 'SEA' && s.status !== 'cancelled') ? '<span class="calendar-sea-label">≈ At sea</span>' : '')}</div><div class="calendar-detail-stats"><div><strong>${group.stays.length}</strong><span>stops</span></div><div><strong>${travelDays}</strong><span>travel day${travelDays === 1 ? '' : 's'}</span></div><div><strong>${atLocationDayCount(group)}</strong><span>at-location day${atLocationDayCount(group) === 1 ? '' : 's'}</span></div></div><div class="calendar-detail-actions"><button type="button" class="secondary compact" data-journey-map="${E(group.key)}">Journey Map</button>${group.trip ? `<button type="button" class="secondary compact" data-calendar-edit-trip="${E(group.trip.id)}">Edit trip</button><button type="button" class="secondary compact" data-calendar-add-transport="${E(group.trip.id)}">Add transport</button><button type="button" class="secondary compact" data-calendar-add-accommodation="${E(group.trip.id)}">Add accommodation</button>` : group.stays[0] ? `<button type="button" class="secondary compact" data-calendar-edit-stay="${E(group.stays[0].id)}">Edit stay</button>` : `<button type="button" class="secondary compact" data-calendar-edit-transport="${E(group.transports[0]?.id || '')}">Edit journey</button>`}</div><section class="calendar-detail-route"><div class="calendar-detail-section-head"><p class="eyebrow">JOURNEY ORDER</p><span>${locations.length ? E(locations.join(' · ')) : group.transports.length ? 'Transport-only journey' : 'Accommodation'}</span></div><ol class="journey-timeline">${detailTimeline(group)}</ol></section>${tripNotes.length ? `<section class="calendar-detail-notes"><p class="eyebrow">NOTES</p>${tripNotes.map((note) => `<p>${E(note)}</p>`).join('')}</section>` : ''}${schengenSummary(group)}<div class="calendar-detail-links"><a href="#/visa">Check entry rules</a><a href="#/schengen">Review Schengen</a></div></article>`;
}

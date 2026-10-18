function accommodationDateText(record) {
  if (record.checkIn && record.checkOut) return dateRangeText(record.checkIn,record.checkOut);
  if (record.checkIn) return `Check-in ${dateText(record.checkIn)} · check-out not recorded`;
  if (record.checkOut) return `Check-out ${dateText(record.checkOut)} · check-in not recorded`;
  return 'Dates to be added';
}

function calendarRangeRecords(start,end) {
  if (start === end) {
    const day = HVCalendarData.window(state,start,1).get(start);
    return {country:[...day.stays,...day.homes],accommodation:day.accommodations,transport:day.transports,note:day.notes,location:day.places};
  }
  const cancelled = new Set((state.trips||[]).filter(t => t.status==='cancelled').map(t => t.id));
  const rows = key => scoped(Array.isArray(state[key]) ? state[key] : []).filter(row => row.status!=='cancelled' && !cancelled.has(row.tripId));
  const overlap = (a,b) => a && b && a<=end && b>=start;
  return {
    country:rows('stays').filter(s => overlap(s.start,s.end||today())),
    accommodation:rows('accommodations').filter(a => !HVJourney.hiddenHomeRecord(state,a) && overlap(a.checkIn||a.checkOut,a.checkOut||a.checkIn)),
    transport:HVJourney.visibleTransport(state,state.activeProfileId).filter(t => !HVJourney.hiddenHomeRecord(state,t) && !cancelled.has(t.tripId) && HVJourney.transportDates(t).some(date => date>=start && date<=end)),
    note:rows('notes').filter(n => HVJourney.validDate(n.date) && n.date>=start && n.date<=end),
    location:rows('placeVisits').filter(v => v.category==='locations' && v.status==='visited' && !HVJourney.hiddenHomeRecord(state,v) && overlap(v.date,v.endDate||v.date)),
  };
}

function calendarEntryRow(kind,record,start,end) {
  let title='', subtitle='', badge='', icon='', edit='';
  if (kind==='country') {
    title=record.countryName || record.countryCode;
    subtitle=dateRangeText(record.start,record.end||today());
    icon=flagHtml(record.domesticDestination||record.countryCode,'calendar-chip-flag');
    edit=`data-calendar-edit-stay="${E(record.id)}"`;
  } else if (kind==='accommodation') {
    title=record.propertyName || 'Accommodation';
    subtitle=HVAddress.address(record.place)||HVAddress.text(record.location)||accommodationDateText(record);
    badge=start===end ? (record.checkIn===start && record.checkOut===start ? 'Same-day stay' : record.checkOut===start ? 'Checking out' : record.checkIn===start ? 'Checking in' : 'Staying') : accommodationDateText(record);
    icon='⌂'; edit=`data-calendar-edit-accommodation="${E(record.id)}"`;
  } else if (kind==='transport') {
    title=HVJourneys.transportLabel(record);
    subtitle=[record.startLocal?.slice(11,16),record.endLocal?.slice(11,16)].filter(Boolean).join(' → ') || dateRangeText(localDate(record.startLocal),localDate(record.endLocal));
    icon=transportIcon(record.type);edit=`data-calendar-edit-transport="${E(record.id)}"`;
  } else if (kind==='note') {
    title=record.title||'Note';subtitle=record.body||'';icon='✎';edit=`data-day-note-edit="${E(record.id)}"`;
  } else {
    title=HVAddress.field(record.place,'name')||'Saved location';
    subtitle=HVAddress.address(record.place)||record.notes||dateRangeText(record.date,record.endDate||record.date);
    icon='◎';edit=`data-place-edit="${E(record.id)}"`;
  }
  return `<article class="calendar-explorer-row type-${kind}"><button type="button" class="calendar-explorer-entry" ${entryAttributes(kind,record.id,start)}><span class="calendar-explorer-symbol" aria-hidden="true">${icon}</span><span><strong>${E(title)}</strong>${badge ? `<span class="calendar-entry-phase">${E(badge)}</span>` : ''}${subtitle ? `<small>${E(subtitle)}</small>` : ''}</span><span aria-hidden="true">›</span></button><button type="button" class="text-btn calendar-row-edit" ${edit} aria-label="Edit ${E(title)}">Edit</button></article>`;
}

function dayInsight(date) {
  const start=calendarSelectionStart||date, end=calendarSelectionEnd||start;
  const records=calendarRangeRecords(start,end);
  records.accommodation.sort((a,b) => (a.checkOut===start ? 0 : a.checkIn===start ? 2 : 1)-(b.checkOut===start ? 0 : b.checkIn===start ? 2 : 1)||String(a.checkIn).localeCompare(String(b.checkIn)));
  records.transport.sort((a,b) => String(a.startLocal||'').localeCompare(String(b.startLocal||'')));
  const count=Object.values(records).reduce((sum,rows) => sum+rows.length,0);
  const heading=start===end ? new Date(start+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : dateRangeText(start,end);
  const countryNames=[...new Set(records.country.map(s => s.countryName))].filter(Boolean).join(' · ');
  const sections=calendarKinds.map(([,label,kind,icon]) => records[kind].length ? `<section class="calendar-explorer-section"><h3><span aria-hidden="true">${kind==='transport' ? transportIcon('flight') : icon}</span>${label}<small>${records[kind].length}</small></h3>${kind==='accommodation' && records.accommodation.length>1 ? '<p class="calendar-section-hint">Check-outs first, then ongoing stays and check-ins. Overlapping reservations are kept separately.</p>' : ''}${records[kind].map(record => calendarEntryRow(kind,record,start,end)).join('')}</section>` : '').join('');
  const action=dateAction==='country' ? `<form id="calendarQuickCountry" class="calendar-quick-form"><label class="field"><span>Country</span><input type="text" name="country" list="countryList" required autocomplete="off" placeholder="Search a country"></label><div class="form-grid calendar-range-fields"><label class="field"><span>Start date</span><input type="date" name="start" value="${E(start)}" required></label><label class="field"><span>End date</span><input type="date" name="end" value="${E(end)}" required></label></div><label class="field"><span>City or area <em>optional</em></span><input type="text" name="location" maxlength="160"></label><button class="primary" type="submit">Save country stay</button><p class="form-error" role="alert"></p></form>` : '';
  return `<div class="calendar-date-panel"><header class="calendar-explorer-head"><div><p class="eyebrow">DAY EXPLORER${start!==end ? ' · DATE RANGE' : ''}</p><h2 data-calendar-detail-heading tabindex="-1">${E(heading)}</h2>${countryNames ? `<p class="calendar-explorer-country">${E(countryNames)}</p>` : ''}<p class="calendar-section-hint">${count} ${count===1 ? 'entry' : 'entries'} recorded${calendarKinds.some(([key]) => visibleLayers()[key]===false) ? ' · showing all categories here' : ''}</p></div><button type="button" class="icon-btn" data-calendar-close-date aria-label="Close Day Explorer">×</button></header>
    <div class="calendar-explorer-tools">${start===end ? `<button type="button" class="text-btn" data-calendar-day-nav="${HVCalendarData.next(start,-1)}" aria-label="Previous day">←</button><button type="button" class="text-btn" data-calendar-day-nav="${HVCalendarData.next(start)}" aria-label="Next day">→</button>` : ''}<details class="calendar-range-editor"><summary>Change dates</summary><div class="form-grid calendar-range-fields"><label class="field"><span>From</span><input type="date" data-range-start value="${E(start)}"></label><label class="field"><span>To</span><input type="date" data-range-end value="${E(end)}"></label></div></details></div>
    <details class="calendar-add-menu"${dateAction || calendarSelectionEnd ? ' open' : ''}><summary>+ Add to ${start===end ? 'this day' : 'these dates'}</summary><div class="calendar-date-actions"><button type="button" data-calendar-date-action="country">▏ Add country</button><button type="button" data-calendar-date-action="accommodation">⌂ Add accommodation</button><button type="button" data-calendar-date-action="transport">↗ Add transport</button><button type="button" data-calendar-date-action="note">✎ Add note</button><button type="button" data-calendar-date-action="location">◎ Add location</button><button type="button" data-calendar-cancel-range>Cancel selection</button></div><div class="calendar-explicit-plan"><button type="button" class="text-btn" data-create-range-trip data-start="${E(start)}" data-end="${E(end)}">Create trip from records</button><button type="button" class="text-btn" data-calendar-plan>Plan a Journey →</button></div></details>${action}
    <div class="calendar-explorer-sections">${sections||'<div class="calendar-explorer-empty"><span aria-hidden="true">✧</span><strong>A day waiting to be recorded</strong><p>Add a country, a stay, a journey or a small memory.</p></div>'}</div></div>`;
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
      date: record.checkIn || record.checkOut,
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
        return `<li class="journey-timeline-item journey-accommodation"><div class="journey-timeline-date">${E(accommodationDateText(accommodation))}<small>${HVJourney.validDate(accommodation.checkIn)&&HVJourney.validDate(accommodation.checkOut)?E(plural(Math.max(0,diffDays(accommodation.checkIn,accommodation.checkOut)),'night')):'Dates incomplete'}</small></div><div class="journey-timeline-symbol">⌂</div><div class="journey-timeline-copy"><strong>${E(accommodation.propertyName)}</strong><span>${E(HVAddress.address(accommodation.place) || HVAddress.text(accommodation.location))}</span><small>${E([accommodation.checkInTime, accommodation.checkOutTime, accommodation.timeZone].filter(Boolean).join(' · '))}</small>${accommodation.notes ? `<p>${E(accommodation.notes)}</p>` : ''}</div><button type="button" class="text-btn" data-calendar-edit-accommodation="${E(accommodation.id)}">Edit</button></li>`;
      })
      .join('') ||
    '<li class="journey-timeline-empty">This journey has no stops or transport yet.</li>'
  );
}

function renderJourneyDetail() {
  const host = $('calendarJourneyDetail');
  if (!host) return;
  host.classList.toggle('date-range-complete', !!calendarSelectionEnd);
  const groups = selectedJourneyKey ? buildJourneys() : [];
  const group = selectedJourneyKey ? groups.find((item) => item.key === selectedJourneyKey) : null;
  host.hidden = !selectedDate && !group && !selectedEntry;
  host.setAttribute('role','dialog');
  host.setAttribute('aria-modal','false');
  host.setAttribute('tabindex','-1');
  if (selectedEntry) {
    const {kind,id,date} = selectedEntry;
    const content = window.HVCalendarDetails?.entry(kind,id,date,true);
    if (content) {
      host.innerHTML = `<article class="calendar-entry-detail"><div class="calendar-entry-detail-nav"><button type="button" class="text-btn" data-calendar-back-day="${E(date)}">← ${selectedDate ? 'Back to day' : 'Explore this day'}</button><button type="button" class="icon-btn" data-calendar-close-date aria-label="Close entry details">×</button></div>${content}</article>`;
      host.setAttribute('aria-label','Travel entry details');
      return;
    }
    selectedEntry = null;
    host.hidden = !selectedDate && !group;
  }
  host.setAttribute('aria-label', group ? 'Journey details' : 'Day Explorer');
  if (host.hidden) {
    host.replaceChildren();
    return;
  }
  if (!group) {
    host.innerHTML = dayInsight(selectedDate, groups);
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
  host.innerHTML = `<article class="calendar-detail-card"><button class="calendar-date-close text-btn" type="button" data-calendar-close-date aria-label="Close journey details">Close ×</button><header class="calendar-detail-head"><div><p class="eyebrow">${E(phaseLabel(group.phase))}</p><h2 data-calendar-detail-heading tabindex="-1">${E(!group.trip && !group.stays.length && group.transports.length === 1 ? (group.transports[0].type === 'flight' ? 'Flight details' : 'Transport details') : group.title)}</h2><p>${E(dateRangeText(group.start, group.end))} · ${E(durationText(group.start, group.end))}</p></div>${statusBadge(group)}</header><div class="calendar-detail-countries">${[...new Map(group.stays.filter((s) => s.countryCode !== 'SEA').map((s) => [s.domesticDestination || s.countryCode, s])).values()].map((s) => `<span>${flagHtml(s.domesticDestination || s.countryCode, 'flag-img flag-sm')}${E(s.countryName || countryByCode(s.countryCode)?.name || s.countryCode)}${window.HVVisaNotices?.detailLink(s) || ''}</span>`).join('') || (group.stays.some((s) => s.countryCode === 'SEA' && s.status !== 'cancelled') ? '<span class="calendar-sea-label">≈ At sea</span>' : '')}</div><div class="calendar-detail-stats"><div><strong>${group.stays.length}</strong><span>stops</span></div><div><strong>${travelDays}</strong><span>travel day${travelDays === 1 ? '' : 's'}</span></div><div><strong>${atLocationDayCount(group)}</strong><span>at-location day${atLocationDayCount(group) === 1 ? '' : 's'}</span></div></div><div class="calendar-detail-actions"><button type="button" class="secondary compact" data-journey-map="${E(group.key)}">Journey Map</button>${group.trip ? `<button type="button" class="secondary compact" data-calendar-edit-trip="${E(group.trip.id)}">Edit trip</button><button type="button" class="secondary compact" data-calendar-add-transport="${E(group.trip.id)}">Add transport</button><button type="button" class="secondary compact" data-calendar-add-accommodation="${E(group.trip.id)}">Add accommodation</button>` : group.stays[0] ? `<button type="button" class="secondary compact" data-calendar-edit-stay="${E(group.stays[0].id)}">Edit stay</button>` : `<button type="button" class="secondary compact" data-calendar-edit-transport="${E(group.transports[0]?.id || '')}">Edit journey</button>`}</div><section class="calendar-detail-route"><div class="calendar-detail-section-head"><p class="eyebrow">JOURNEY ORDER</p><span>${locations.length ? E(locations.join(' · ')) : group.transports.length ? 'Transport-only journey' : 'Accommodation'}</span></div><ol class="journey-timeline">${detailTimeline(group)}</ol></section>${tripNotes.length ? `<section class="calendar-detail-notes"><p class="eyebrow">NOTES</p>${tripNotes.map((note) => `<p>${E(note)}</p>`).join('')}</section>` : ''}${schengenSummary(group)}<div class="calendar-detail-links"><a href="#/visa">Check entry rules</a><a href="#/schengen">Review Schengen</a></div></article>`;
}

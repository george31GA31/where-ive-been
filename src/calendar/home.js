/* Home reuses Calendar journey membership, with its own current-month context. */
function renderHomeOverview() {
  const summary = $('homeMonthSummary'), upcomingHost = $('homeUpcomingTravelItems');
  if (!summary || !upcomingHost) return;
  const current = today(), start = current.slice(0, 7) + '-01';
  const end = HVCalendarData.next(startOfNextMonth(start), -1);
  const groups = buildJourneys().filter(group => group.trip?.status !== 'cancelled' && group.phase !== 'cancelled');
  const cancelled = new Set((state.trips||[]).filter(trip=>trip.status==='cancelled').map(trip=>trip.id));
  const eligible = record => record.status !== 'cancelled' && !cancelled.has(record.tripId);
  const touching = groups.filter(group => group.start && group.start <= end && group.end >= start && (
    group.stays.some(s => eligible(s) && HVJourney.isTravelStay(state, s)) ||
    group.transports.some(eligible) || group.accommodations.some(eligible)
  ));
  const month = new Date(start + 'T00:00:00Z').toLocaleDateString('en-GB', {month:'long',year:'numeric',timeZone:'UTC'});
  summary.innerHTML = `<button type="button" class="text-btn" data-home-calendar-month="${start}" aria-label="Open ${E(month)} calendar"><strong>${E(month)}</strong><span>${touching.length} ${touching.length === 1 ? 'journey' : 'journeys'} this month <span aria-hidden="true">↗</span></span></button>`;

  const journeys = groups.filter(group => group.phase === 'upcoming' && (group.trip || group.stays.length));
  const transports = groups.flatMap(group => group.transports).filter(record => eligible(record) && localDate(record.startLocal) >= current)
    .sort((a,b) => String(a.startLocal).localeCompare(String(b.startLocal)));
  const accommodation = groups.filter(group => !group.trip && !group.stays.length && !group.transports.length)
    .flatMap(group => group.accommodations).filter(record => eligible(record) && record.checkIn >= current)
    .sort((a,b) => String(a.checkIn).localeCompare(String(b.checkIn)));
  const notes = scoped(Array.isArray(state.notes) ? state.notes : []).filter(note => eligible(note) && HVJourney.validDate(note.date) && note.date >= current)
    .sort((a,b) => a.date.localeCompare(b.date));
  const row = (kind, label, dates, action, date) => ({date,html:`<button type="button" class="home-upcoming-row" ${action}><span>${E(kind)}</span><strong>${E(label)}</strong><small>${E(dates)}</small></button>`});
  const items = [
    ...journeys.slice(0,3).map(group => row(group.trip ? 'Trip' : 'Country stay', group.title, dateRangeText(group.start,group.end), `data-home-journey="${E(group.key)}"`,group.start)),
    ...transports.slice(0,2).map(record => row(HVJourney.types[record.type] || 'Transport', HVJourneys.transportLabel(record), dateText(localDate(record.startLocal)), `data-calendar-edit-transport="${E(record.id)}"`,localDate(record.startLocal))),
    ...accommodation.slice(0,2).map(record => row('Accommodation', record.propertyName, dateRangeText(record.checkIn,record.checkOut), `data-calendar-edit-accommodation="${E(record.id)}"`,record.checkIn)),
    ...notes.slice(0,2).map(note => row('Date to remember', note.title || 'Note', dateText(note.date), `data-day-note-edit="${E(note.id)}"`,note.date)),
  ].sort((a,b)=>a.date.localeCompare(b.date));
  upcomingHost.innerHTML = items.map(item=>item.html).join('') + `<button type="button" class="text-btn home-all-dates" data-home-calendar-month="${start}">All dates in the calendar →</button>`;
  const details = $('homeUpcomingTravel'), count = journeys.length + transports.length + accommodation.length + notes.length;
  details.hidden = !count;
  q('summary', details).textContent = 'Coming up';
}

function startOfNextMonth(start) {
  return new Date(Date.UTC(Number(start.slice(0,4)), Number(start.slice(5,7)), 1)).toISOString().slice(0,10);
}

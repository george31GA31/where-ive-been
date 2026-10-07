function schengenBreakdownGroups(min, max, profileId = state.activeProfileId) {
  let dayMap = new Map();
  staysForProfile(profileId)
    .filter(countsForPlanning)
    .forEach((s) => {
      if (!SCHENGEN.has(s.countryCode) || s.schengenExempt) return;
      datesForStay(s, min, max).forEach((d) => {
        if (!dayMap.has(d)) dayMap.set(d, new Map());
        let countries = dayMap.get(d),
          rec = countries.get(s.countryCode) || {
            code: s.countryCode,
            name: s.countryName,
            statuses: new Set(),
          };
        rec.statuses.add(s.status);
        countries.set(s.countryCode, rec);
      });
    });
  let groups = new Map();
  [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, countries]) => {
      let list = [...countries.values()].sort((a, b) => a.code.localeCompare(b.code)),
        key = list.map((c) => c.code).join('+'),
        g = groups.get(key) || { countries: list, dates: [], hasPlanned: false };
      g.dates.push(date);
      if (list.some((c) => c.statuses.has('planned'))) g.hasPlanned = true;
      groups.set(key, g);
    });
  return [...groups.values()].sort(
    (a, b) => b.dates.length - a.dates.length || a.countries.length - b.countries.length,
  );
}
function compactBreakdownDates(dates) {
  if (!dates.length) return '';
  if (dates.length === 1) return fmt(dates[0], { day: 'numeric', month: 'short' });
  if (dates.length <= 3)
    return dates.map((d) => fmt(d, { day: 'numeric', month: 'short' })).join(', ');
  return `${fmt(dates[0], { day: 'numeric', month: 'short' })} … ${fmt(dates[dates.length - 1], { day: 'numeric', month: 'short' })}`;
}
function renderSchengen() {
  let p = activeProfile(),
    check = els.checkDate.value || isoDate(new Date()),
    exempt = isSchengenExemptProfile(p);
  els.schengenProfileNote.textContent = exempt
    ? `${p.name} has an EU/EEA/Swiss citizenship recorded, so this short-stay tracker is not applied to this profile.`
    : `For ${p.name}: choose any date to count Schengen days in that date and the previous 179 days. A calendar date counts once even if you visit more than one Schengen country that day. This estimate uses your recorded history; missing stays can change the result. Stay-specific exclusions are omitted.`;
  if (exempt) {
    els.ringUsed.textContent = '—';
    els.calcUsed.textContent = 'Not applied';
    els.calcRemaining.textContent = '—';
    els.windowDates.textContent = 'Free-movement profile';
    els.forecastBox.className = 'forecast-box good-box';
    els.forecastTitle.textContent = '90/180 tracker disabled for this profile';
    els.forecastText.textContent = 'Local registration or residence requirements can still apply.';
    els.schengenBreakdown.className = 'breakdown empty-state';
    els.schengenBreakdown.textContent =
      'Switch to a non-EU/EEA/Swiss traveller to use the short-stay calculator.';
    return;
  }
  let r = rollingStatus(check),
    st = statusForUsed(r.used),
    hasSchengenRecords = staysForProfile(p.id).some(
      (s) => countsForPlanning(s) && SCHENGEN.has(s.countryCode) && !s.schengenExempt,
    );
  els.ringUsed.textContent = r.used;
  els.calcUsed.textContent = plural(r.used, 'day');
  els.calcRemaining.textContent = plural(Math.max(0, r.remaining), 'day');
  els.windowDates.textContent = `${fmtObj(r.start, { day: 'numeric', month: 'short', year: '2-digit' })} – ${fmtObj(r.end, { day: 'numeric', month: 'short', year: '2-digit' })}`;
  els.schengenRing.style.setProperty('--p', `${Math.min(360, (r.used / 90) * 360)}deg`);
  let col = st.kind === 'bad' ? 'var(--red)' : st.kind === 'warn' ? 'var(--amber)' : 'var(--green)';
  els.schengenRing.style.background = `radial-gradient(circle at center,#fff 58%,transparent 59%),conic-gradient(${col} var(--p),#edf0f3 0)`;
  let future = hasSchengenRecords ? firstOverstay(check) : null;
  els.forecastBox.className =
    'forecast-box ' +
    (!hasSchengenRecords
      ? 'neutral-box'
      : r.used > 90
        ? 'bad-box'
        : future
          ? 'warn-box'
          : 'good-box');
  els.forecastTitle.textContent = !hasSchengenRecords
    ? 'Add Schengen stays to calculate'
    : r.used > 90
      ? 'Possible overstay in your records'
      : future
        ? 'A future recorded stay may cross the limit'
        : 'No recorded overstay';
  els.forecastText.textContent = !hasSchengenRecords
    ? 'No Schengen travel has been recorded for this traveller yet.'
    : r.used > 90
      ? `This date has ${plural(r.used, 'countable Schengen day')} in its rolling window.`
      : future
        ? `Your current records first exceed 90 days on ${fmt(future.date)}.`
        : 'Your currently recorded stays remain within the rule over the next 500 days.';
  let groups = schengenBreakdownGroups(dayKey(r.start), dayKey(r.end), p.id);
  els.schengenBreakdown.className = groups.length ? 'breakdown' : 'breakdown empty-state';
  els.schengenBreakdown.innerHTML = groups.length
    ? groups
        .map((g) => {
          let overlap = g.countries.length > 1,
            names = g.countries.map((c) => esc(c.name)).join(' + '),
            flags = g.countries.map((c) => flagHtml(c.code, 'flag-img flag-sm')).join(' '),
            dateText = compactBreakdownDates(g.dates),
            detail = overlap
              ? `${dateText} · multi-country ${g.dates.length === 1 ? 'travel day' : 'travel days'} · counted once ${g.dates.length === 1 ? '' : 'each'}`
              : `${dateText}${g.hasPlanned ? ' · includes planned' : ''}`;
          return `<div class="breakdown-row"><div class="flag">${flags}</div><div><strong>${overlap ? 'Multi-country: ' : ''}${names}</strong><span>${detail}</span></div><div class="breakdown-days">${g.dates.length}d</div></div>`;
        })
        .join('')
    : 'No Schengen days in this period.';
}
function stayRowHtml(s) {
  let label =
    s.status === 'actual' ? 'COMPLETED' : s.status === 'planned' ? 'PLANNED' : 'CANCELLED';
  return `<div class="stay-row ${s.status}"><div class="flag-box">${flagHtml(s.domesticDestination || s.countryCode)}</div><div class="stay-main"><strong>${esc(s.countryName)} <span class="pill ${s.status}">${label}</span></strong><span>${fmt(s.start)} – ${fmt(s.end)}${s.notes ? ` · ${esc(s.notes)}` : ''}</span></div><div class="stay-days"><strong>${daysInclusive(s.start, s.end)}</strong><span>days</span></div><button class="edit-btn" data-action="edit-stay" data-id="${esc(s.id)}" aria-label="Edit ${esc(s.countryName)} stay">⋯</button></div>`;
}
function renderStayLists() {
  const term = ($('tripSearch')?.value || '').toLowerCase(),
    status = $('tripStatusFilter')?.value || 'all',
    year = $('tripYearFilter')?.value || '',
    groups = new Map();
  for (const stay of staysForProfile()) {
    const key = stay.tripId || 'stay:' + stay.id;
    if (!groups.has(key))
      groups.set(key, {
        trip: state.trips.find((t) => t.id === stay.tripId),
        stays: [],
        transports: [],
      });
    groups.get(key).stays.push(stay);
  }
  for (const trip of HVJourney.scoped(state.trips, state.activeProfileId))
    if (!groups.has(trip.id)) groups.set(trip.id, { trip, stays: [], transports: [] });
  for (const t of HVJourney.scoped(state.transports, state.activeProfileId)) {
    const key = t.tripId || 'transport:' + t.id;
    if (!groups.has(key)) groups.set(key, { stays: [], transports: [] });
    groups.get(key).transports.push(t);
  }
  const today = isoDate(new Date()),
    list = [...groups.values()]
      .map((g) => {
        const dates = [
          g.trip?.start,
          g.trip?.end,
          ...g.stays.flatMap((s) => [s.start, s.end]),
          ...g.transports.flatMap((t) => HVJourney.transportDates(t)),
        ]
          .filter(Boolean)
          .sort();
        return { ...g, start: dates[0], end: dates.at(-1) };
      })
      .filter((g) => {
        const records = [...g.stays, ...g.transports],
          matches = records.some((r) => r.status === status) || g.trip?.status === status;
        const phase = g.end < today ? 'completed' : g.start > today ? 'upcoming' : 'current';
        return (
          (status === 'all' || matches || (status === phase && records.some(countsAsTravel))) &&
          (!year || (g.start <= year + '-12-31' && g.end >= year + '-01-01')) &&
          [
            g.trip?.name,
            g.trip?.notes,
            ...g.stays.flatMap((s) => [s.countryName, s.notes]),
            ...g.transports.flatMap((t) => [t.start.name, t.end.name]),
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        );
      })
      .sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  els.allStays.className = 'trip-list';
  els.allStays.innerHTML =
    list
      .map((g) => {
        const countries = [...new Set(g.stays.map((s) => s.countryCode))],
          name =
            g.trip?.name ||
            g.stays[0]?.countryName ||
            (g.transports[0]
              ? window.HVJourneys?.transportLabel(g.transports[0]) ||
                HVJourney.transportLabel(g.transports[0])
              : 'Journey');
        return `<article class="trip-group"><div class="trip-group-head"><div><h3>${esc(name)}</h3><p>${g.start ? `${fmt(g.start)} to ${fmt(g.end)}` : 'Add stays or transport to set dates'} · ${esc(activeProfile().name)}</p><p>${countries.map((c) => flagHtml(c, 'flag-img flag-sm') + ' ' + esc(countryByCode(c)?.name || c)).join(' · ')}</p></div>${g.trip ? `<div class="trip-group-actions"><button type="button" class="secondary compact" data-trip-open="${esc(g.trip.id)}">Trip details</button><button type="button" class="secondary compact" data-journey-map="trip:${esc(g.trip.id)}">Journey Map</button><button type="button" class="secondary compact" data-add-transport-trip="${esc(g.trip.id)}">+ Add transport</button><button type="button" class="secondary compact" data-edit-trip="${esc(g.trip.id)}">Edit trip</button></div>` : ''}</div>${g.trip?.notes ? `<p>${esc(g.trip.notes)}</p>` : ''}<div class="trip-group-stays">${g.stays
          .sort((a, b) => a.start.localeCompare(b.start))
          .map(stayRowHtml)
          .join('')}${g.transports
          .sort((a, b) => a.startLocal.localeCompare(b.startLocal))
          .map(
            (t) =>
              `<div class="trip-transport"><span>${esc(HVJourney.types[t.type] || t.type)} · ${esc(window.HVJourneys?.transportLabel(t) || HVJourney.transportLabel(t))} · ${esc(t.status || 'actual')}</span><button type="button" class="secondary compact" data-transport-edit="${esc(t.id)}">Edit transport</button></div>`,
          )
          .join('')}</div></article>`;
      })
      .join('') || '<p class="empty-state">No trips match these filters. Add a trip to begin.</p>';
  const gaps = findGaps();
  els.gapList.className = gaps.length ? 'gap-list' : 'gap-list empty-state';
  els.gapList.innerHTML = gaps.length
    ? gaps.map((g) => gapCard(g, false)).join('')
    : 'No gaps detected.';
}

function renderStayList(container, list) {
  if (!list.length) {
    container.className = 'stay-list empty-state';
    container.textContent = 'No trips or stays added yet.';
    return;
  }
  container.className = 'stay-list';
  container.innerHTML = list.map(stayRowHtml).join('');
}
function gapCard(g, compact) {
  let prev = g.prev?.countryCode,
    next = g.next?.countryCode;
  return `<div class="gap-card"><div class="gap-card-head"><strong>${fmt(g.start)} – ${fmt(g.end)}</strong><span class="status-badge neutral">${plural(g.missingDays ?? Math.max(0, g.days - 2), 'unlogged day')}</span></div><p>Between ${g.prev ? flagHtml(prev, 'flag-img flag-sm') + ' ' + esc(g.prev.countryName) : 'record'} and ${g.next ? flagHtml(next, 'flag-img flag-sm') + ' ' + esc(g.next.countryName) : 'record'}. The fill range includes both boundary travel days, so those dates can contain two countries.</p><div class="gap-actions">${prev ? `<button class="tiny-btn" data-action="fill-gap" data-start="${g.start}" data-end="${g.end}" data-country="${prev}">Use ${flagHtml(prev, 'flag-img flag-sm')} ${esc(g.prev.countryName)}</button>` : ''}${next && next !== prev ? `<button class="tiny-btn" data-action="fill-gap" data-start="${g.start}" data-end="${g.end}" data-country="${next}">Use ${flagHtml(next, 'flag-img flag-sm')} ${esc(g.next.countryName)}</button>` : ''}<button class="tiny-btn" data-action="fill-gap" data-start="${g.start}" data-end="${g.end}">Choose country</button></div></div>`;
}
function addDateRange(start = isoDate(new Date()), end = start) {
  let row = document.createElement('div');
  row.className = 'date-range-row';
  row.innerHTML = `<label><span>From</span><input type="date" class="range-start" value="${start}" required></label><label><span>To</span><input type="date" class="range-end" value="${end}" required></label><button type="button" class="remove-range" data-action="remove-range" aria-label="Remove date range">×</button>`;
  let validate = () => {
    let st = row.querySelector('.range-start').value,
      en = row.querySelector('.range-end').value;
    row.classList.toggle('invalid-range', !!st && !!en && en < st);
  };
  row.querySelector('.range-start').onchange = validate;
  row.querySelector('.range-end').onchange = validate;
  els.dateRanges.appendChild(row);
}
function openStayDialog(id = null, prefill = {}) {
  if (!id && window.HVCalendar?.openTripPlanner) return window.HVCalendar.openTripPlanner(prefill);
  stayDialogContext = prefill.source || 'manual';
  els.stayForm.reset();
  els.dateRanges.innerHTML = '';
  els.formError.textContent = '';
  els.stayId.value = id || '';
  els.deleteStayBtn.classList.toggle('hidden', !id);
  let s = id ? state.stays.find((x) => x.id === id) : null,
    trip = s?.tripId ? state.trips.find((t) => t.id === s.tripId) : null,
    isPlan = !id && stayDialogContext === 'plan';
  els.dialogTitle.textContent = id ? 'Edit trip stop' : isPlan ? 'Plan a trip' : 'Add a trip';
  if ($('stayDialogIntro'))
    $('stayDialogIntro').textContent = id
      ? 'Change the dates, status or details for this stop.'
      : isPlan
        ? 'Add the first stop and dates. You can keep the rest of the journey together below.'
        : 'Start with where you went and when. You can add the extra details if you need them.';
  if ($('saveStayBtn'))
    $('saveStayBtn').textContent = id ? 'Save changes' : isPlan ? 'Save planned trip' : 'Save trip';
  const more = els.stayDialog.querySelector('.trip-form-more');
  if (more) more.open = !!(id || trip || prefill.tripName);
  const picker = $('stayTripSelect');
  picker.closest('label').hidden = false;
  picker.innerHTML =
    '<option value="">Keep as its own trip</option><option value="new">Create a new trip</option>' +
    HVJourney.scoped(state.trips, s?.profileId || state.activeProfileId)
      .map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
      .join('');
  picker.value = trip?.id || (prefill.tripName ? 'new' : '');
  picker.onchange = () => {
    $('newTripNameField').hidden = picker.value !== 'new';
    els.tripNameInput.required = picker.value === 'new';
  };
  picker.onchange();
  els.tripNameInput.value = prefill.tripName || '';
  els.countryInput.value = s?.countryName || prefill.countryName || '';
  $('stayLocationInput').value = s?.location || '';
  els.notesInput.value = s?.notes || '';
  els.stayStatus.value = s?.status || prefill.status || 'actual';
  els.stayProfile.value = s?.profileId || state.activeProfileId || '';
  els.schengenExempt.checked = !!s?.schengenExempt;
  addDateRange(
    s?.start || prefill.start || isoDate(new Date()),
    s?.end || prefill.end || prefill.start || isoDate(new Date()),
  );
  updateStayCountry();
  els.stayDialog.showModal();
}
function updateStayCountry() {
  let c = countryByName(els.countryInput.value);
  els.countryFlag.innerHTML = c ? flagHtml(c.domesticDestination || c.code) : '';
  els.schengenExemptRow.classList.toggle('hidden', !c || !SCHENGEN.has(c.code));
}
async function saveStay(e) {
  e.preventDefault();
  let c = countryByName(els.countryInput.value);
  if (!c) {
    els.formError.textContent = 'Choose a country from the list.';
    return;
  }
  let rows = [...els.dateRanges.querySelectorAll('.date-range-row')].map((r) => ({
    start: r.querySelector('.range-start').value,
    end: r.querySelector('.range-end').value,
  }));
  if (!rows.length) {
    els.formError.textContent = 'Add at least one date range.';
    return;
  }
  for (let r of rows)
    if (!HVJourney.validDate(r.start) || !HVJourney.validDate(r.end) || r.end < r.start) {
      els.formError.textContent =
        'Check each From/To date range. The To date must be on or after the From date.';
      return;
    }
  const travelKind = await HVHome.choose(
    c,
    rows[0].start,
    els.stayProfile.value || state.activeProfileId,
    state.stays.find((s) => s.id === els.stayId.value),
  );
  if (travelKind === 'cancel') return;
  let tripName = els.tripNameInput.value.trim(),
    profileId = els.stayProfile.value || null,
    selection = $('stayTripSelect').value,
    trip = state.trips.find((t) => t.id === selection);
  if (
    trip &&
    trip.profileId &&
    trip.profileId !== profileId &&
    !trip.profileIds?.includes(profileId)
  ) {
    els.formError.textContent = 'Choose a trip belonging to this traveller, or create a new trip.';
    return;
  }
  if (selection === 'new' && !tripName) {
    els.formError.textContent = 'Enter a name for the new trip.';
    return;
  }
  if (selection === 'new') {
    trip = { id: uid(), name: tripName, profileId, notes: '' };
    state.trips.push(trip);
  }
  let base = {
    tripId: trip?.id || null,
    countryCode: c.code,
    countryName: c.name,
    ...HVJourney.domesticFields(c),
    travelKind,
    domesticHoliday: travelKind === 'trip' || (!travelKind && !!c.domesticDestination),
    location: $('stayLocationInput').value.trim(),
    notes: els.notesInput.value.trim(),
    schengenExempt: SCHENGEN.has(c.code) ? els.schengenExempt.checked : false,
    status: els.stayStatus.value,
    profileId,
  };
  let id = els.stayId.value;
  if (id) {
    let ix = state.stays.findIndex((s) => s.id === id);
    state.stays[ix] = { ...state.stays[ix], ...base, ...rows[0] };
    rows.slice(1).forEach((r) => state.stays.push({ id: uid(), ...base, ...r }));
  } else rows.forEach((r) => state.stays.push({ id: uid(), ...base, ...r }));
  updatePassedPlannedTrips();
  if (stayDialogContext === 'calendar') {
    calendarSelectionStart = null;
    calendarSelectionEnd = null;
  }
  stayDialogContext = 'manual';
  persist();
  els.stayDialog.close();
  renderAll();
}
function deleteStay() {
  let id = els.stayId.value;
  if (!id) return;
  state.stays = state.stays.filter((s) => s.id !== id);
  persist();
  els.stayDialog.close();
  renderAll();
}
function openGapDialog(start, end, code = '') {
  els.gapStart.value = start;
  els.gapEnd.value = end;
  els.gapDateSummary.textContent = `Fill ${fmt(start)} to ${fmt(end)} (${plural(daysInclusive(start, end), 'day')}). The first and last dates are intentionally included so travel days can overlap with the country either side.`;
  els.gapCountry.value = countryByCode(code)?.name || '';
  els.gapError.textContent = '';
  els.gapDialog.showModal();
}
async function saveGap(e) {
  e.preventDefault();
  let c = countryByName(els.gapCountry.value);
  if (!c) {
    els.gapError.textContent = 'Choose a country from the list.';
    return;
  }
  const travelKind = await HVHome.choose(c, els.gapStart.value, state.activeProfileId);
  if (travelKind === 'cancel') return;
  state.stays.push({
    id: uid(),
    countryCode: c.code,
    countryName: c.name,
    ...HVJourney.domesticFields(c),
    travelKind,
    domesticHoliday: travelKind === 'trip',
    start: els.gapStart.value,
    end: els.gapEnd.value,
    notes: 'Filled from gap detector',
    schengenExempt: false,
    status: 'actual',
    profileId: state.activeProfileId,
  });
  persist();
  els.gapDialog.close();
  renderAll();
}

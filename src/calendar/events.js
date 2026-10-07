async function saveDateEntry(event) {
  const form = event.target;
  if (!['calendarQuickCountry', 'calendarQuickAccommodation'].includes(form.id)) return;
  event.preventDefault();
  const error = q('[role="alert"]', form),
    start = calendarSelectionStart || selectedDate,
    end = calendarSelectionEnd || start;
  const tripId = window.HVJourney.tripForDates(state, start, end);
  const trip = (state.trips || []).find((t) => t.id === tripId);
  if (!window.HVJourney.validDate(start) || !window.HVJourney.validDate(end)) {
    error.textContent = 'Select valid dates first.';
    return;
  }
  if (form.id === 'calendarQuickCountry') {
    const country = countryByName(form.elements.country.value);
    if (!country) {
      error.textContent = 'Choose a country from the list.';
      return;
    }
    if (tripId && !trip) {
      error.textContent = 'Choose a valid trip.';
      return;
    }
    if (
      (state.stays || []).some(
        (s) =>
          (s.tripId || null) === tripId &&
          s.countryCode === country.code &&
          (s.domesticDestination || null) === (country.domesticDestination || null) &&
          s.start <= end &&
          s.end >= start &&
          (s.location || '').toLowerCase() === form.elements.location.value.trim().toLowerCase() &&
          (!s.profileId || s.profileId === state.activeProfileId),
      )
    ) {
      error.textContent =
        'This stay overlaps an existing entry. Edit that stay to change its dates.';
      return;
    }
    const travelKind = await HVHome.choose(country, start, state.activeProfileId);
    if (travelKind === 'cancel') return;
    const owner = state.activeProfileId;
    state.stays ||= [];
    state.stays.push({
      id: uid(),
      tripId,
      countryCode: country.code,
      countryName: country.name,
      ...HVJourney.domesticFields(country),
      travelKind,
      domesticHoliday: travelKind === 'trip' || (!travelKind && !!country.domesticDestination),
      location: form.elements.location.value.trim(),
      start,
      end,
      notes: '',
      schengenExempt: false,
      status: end < today() ? 'actual' : 'planned',
      profileId: owner,
      tripOrder: (state.stays || []).filter((s) => s.tripId === tripId).length,
    });
  } else {
    const propertyName = form.elements.propertyName.value.trim(),
      location = form.elements.location.value.trim();
    if (!propertyName || !location) {
      error.textContent = 'Add the property and its location.';
      return;
    }
    if (
      (state.accommodations || []).some(
        (a) =>
          a.tripId === tripId &&
          a.propertyName.toLowerCase() === propertyName.toLowerCase() &&
          a.checkIn <= end &&
          a.checkOut >= start,
      )
    ) {
      error.textContent =
        'This accommodation already overlaps these dates. Edit its existing entry instead.';
      return;
    }
    state.accommodations ||= [];
    state.accommodations.push({
      id: uid(),
      tripId,
      profileId: state.activeProfileId,
      propertyName,
      location,
      checkIn: start,
      checkOut: end,
      notes: '',
    });
  }
  updatePassedPlannedTrips();
  persist();
  dateAction = '';
  renderAll();
  window.HVJourneys?.render();
}

function captureCalendarAction(event) {
  const target = event.target;
  if (target.closest('[data-place-edit],[data-visa-notice]')) return;
  const countryEntry = target.closest('[data-calendar-edit-country]');
  if (countryEntry) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarStay(countryEntry.dataset.calendarEditCountry);
    return;
  }
  const lodging = target.closest('[data-calendar-lodging-group]');
  if (lodging) {
    event.preventDefault();
    event.stopPropagation();
    const group = (window.HVCalendar?._groups || []).find(
      (g) => g.key === lodging.dataset.calendarLodgingGroup,
    );
    const matches =
      group?.accommodations.filter(
        (a) =>
          a.checkIn <= lodging.dataset.calendarDate && a.checkOut >= lodging.dataset.calendarDate,
      ) || [];
    if (matches.length === 1) openAccommodationDialog(matches[0].tripId, matches[0].id);
    else selectDate(lodging.dataset.calendarDate);
    return;
  }
  if (target.closest('[data-calendar-close-date]')) {
    event.preventDefault();
    event.stopPropagation();
    calendarSelectionStart = null;
    calendarSelectionEnd = null;
    selectedDate = '';
    dateAction = '';
    renderMonth();
    return;
  }
  if (target.closest('#clearCalendarSelectionBtn')) {
    selectedDate = '';
    dateAction = '';
  }
  const journey = target.closest('[data-calendar-journey]');
  if (journey) {
    event.preventDefault();
    event.stopPropagation();
    const group = buildJourneys().find((g) => g.key === journey.dataset.calendarJourney),
      date = journey.dataset.calendarDate;
    const stays =
      group?.stays.filter((s) => s.start <= date && s.end >= date && s.status !== 'cancelled') ||
      [];
    if (stays.length === 1) {
      openCalendarStay(stays[0].id);
    } else selectJourney(journey.dataset.calendarJourney, date);
    return;
  }
  const homeDate = target.closest('[data-calendar-home-select]');
  if (homeDate) {
    event.preventDefault();
    event.stopPropagation();
    selectDate(homeDate.dataset.calendarHomeSelect);
    return;
  }
  const date = target.closest('[data-calendar-date-select]');
  if (date) {
    event.preventDefault();
    event.stopPropagation();
    selectDate(date.dataset.calendarDateSelect);
    return;
  }
  const action = target.closest('[data-calendar-date-action]');
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    const kind = action.dataset.calendarDateAction;
    if (kind === 'transport') {
      window.HVJourneys?.openTransport(null, {
        startLocal: `${calendarSelectionStart || selectedDate}T12:00`,
        endLocal: `${calendarSelectionEnd || calendarSelectionStart || selectedDate}T12:00`,
      });
      return;
    }
    if (kind === 'accommodation') {
      window.HVPlaces?.open({
        date: calendarSelectionStart || selectedDate,
        end: calendarSelectionEnd || calendarSelectionStart || selectedDate,
        accommodation: true,
      });
      return;
    }
    if (kind === 'location') {
      window.HVPlaces?.open({
        date: calendarSelectionStart || selectedDate,
        end: calendarSelectionEnd || calendarSelectionStart || selectedDate,
        tripId: '',
      });
      return;
    }
    dateAction = dateAction === kind ? '' : kind;
    renderJourneyDetail();
    q('#calendarJourneyDetail input')?.focus();
    return;
  }
  const more = target.closest('[data-calendar-day-detail]');
  if (more) {
    event.preventDefault();
    event.stopPropagation();
    selectedJourneyKey = '';
    selectedDate = more.dataset.calendarDayDetail;
    renderJourneyDetail();
    return;
  }
  const open = target.closest('[data-calendar-open-journey]');
  if (open) {
    event.preventDefault();
    event.stopPropagation();
    selectJourney(open.dataset.calendarOpenJourney);
    return;
  }
  const plan = target.closest('[data-calendar-plan]');
  if (plan) {
    event.preventDefault();
    event.stopPropagation();
    const start = plan.dataset.calendarPlanDate || calendarSelectionStart || today();
    openTripPlanner({ start, end: calendarSelectionEnd || start, source: 'calendar' });
    return;
  }
  const editTrip = target.closest('[data-calendar-edit-trip]');
  if (editTrip) {
    event.preventDefault();
    event.stopPropagation();
    window.HVJourneys?.editTrip(editTrip.dataset.calendarEditTrip);
    return;
  }
  const editStay = target.closest('[data-calendar-edit-stay]');
  if (editStay) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarStay(editStay.dataset.calendarEditStay);
    return;
  }
  const transport = target.closest('[data-calendar-edit-transport]');
  if (transport?.dataset.calendarEditTransport) {
    event.preventDefault();
    event.stopPropagation();
    window.HVJourneys?.openTransport(transport.dataset.calendarEditTransport);
    return;
  }
  const addTransport = target.closest('[data-calendar-add-transport]');
  if (addTransport) {
    event.preventDefault();
    event.stopPropagation();
    window.HVJourneys?.openTransport(null, { tripId: addTransport.dataset.calendarAddTransport });
    return;
  }
  const addAccommodation = target.closest('[data-calendar-add-accommodation]');
  if (addAccommodation) {
    event.preventDefault();
    event.stopPropagation();
    openAccommodationDialog(addAccommodation.dataset.calendarAddAccommodation);
    return;
  }
  const editAccommodation = target.closest('[data-calendar-edit-accommodation]');
  if (editAccommodation) {
    event.preventDefault();
    event.stopPropagation();
    const accommodation = (state.accommodations || []).find(
      (item) => item.id === editAccommodation.dataset.calendarEditAccommodation,
    );
    if (accommodation) openAccommodationDialog(accommodation.tripId, accommodation.id);
  }
  const layer = target.closest('[data-calendar-layer]');
  if (layer) {
    event.preventDefault();
    state.visualLayers ||= {};
    state.visualLayers.calendar ||= {};
    const key = layer.dataset.calendarLayer;
    state.visualLayers.calendar[key] = !visibleLayers()[key];
    layer.setAttribute('aria-pressed', String(state.visualLayers.calendar[key]));
    persist();
    renderMonth();
  }
}

function boot() {
  const calendar = $('calendar');
  if (!calendar || window.HVCalendar?.ready) return;
  const styles = $('calendarExperienceStyles');
  if (styles) document.head.append(styles);
  const editorStyles = $('journeyPresentationStyles');
  if (editorStyles) document.head.append(editorStyles);
  state.accommodations ||= [];
  qa('[data-calendar-layer]').forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(visibleLayers()[button.dataset.calendarLayer] !== false),
    ),
  );
  window.HVCalendar = {
    clearSelection() {
      calendarSelectionStart = null;
      calendarSelectionEnd = null;
      selectedDate = '';
      selectedJourneyKey = '';
      dateAction = '';
      renderMonth();
    },
    ready: true,
    renderMonth,
    openTripPlanner,
    openAccommodationDialog,
    journeyGroups: buildJourneys,
  };
  calendar.dataset.journeyCalendar = 'true';
  moveLegacyTransportTools();
  $('calendarPlanTripBtn')?.addEventListener('click', () =>
    openTripPlanner({ source: 'calendar' }),
  );
  $('addStayBtn').onclick = () => openTripPlanner({ source: 'manual' });
  $('addStayFromListBtn').onclick = () => openTripPlanner({ source: 'manual' });
  document.addEventListener('click', captureCalendarAction, true);
  document.addEventListener('submit', saveDateEntry, true);
  document.addEventListener('click', (event) => {
    if (
      (calendarSelectionStart || selectedDate) &&
      !event.target.closest(
        'button,a,input,select,textarea,label,summary,[role=button],dialog,#calendarJourneyDetail,.calendar-day',
      )
    )
      HVCalendar.clearSelection();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]'))
      HVCalendar.clearSelection();
  });
  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-range-start],[data-range-end]')) return;
    const host = event.target.closest('.calendar-date-panel'),
      start = host.querySelector('[data-range-start]').value,
      end = host.querySelector('[data-range-end]').value;
    if (!window.HVJourney.validDate(start) || !window.HVJourney.validDate(end)) return;
    calendarSelectionStart = start < end ? start : end;
    calendarSelectionEnd = start < end ? end : start;
    selectedDate = calendarSelectionStart;
    renderMonth();
  });
  window.addEventListener('hv-route', () =>
    requestAnimationFrame(() => fitCalendarContent(calendar)),
  );
  let fitTimer;
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => fitCalendarContent(calendar), 120);
  });
  renderMonth();
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();

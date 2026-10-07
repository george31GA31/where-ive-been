function plannerStatusFrom(prefill) {
  if (prefill.status) return prefill.status;
  const start = prefill.start || today();
  return start > today() || prefill.source === 'plan' ? 'planned' : 'actual';
}

function blankStop(start, end, countryName = '') {
  return { countryName, location: '', start, end };
}
function blankTransport(start, end) {
  return {
    type: 'flight',
    startLocal: `${start}T12:00`,
    endLocal: `${end}T12:00`,
    startName: '',
    endName: '',
    flightNumber: '',
    bookingReference: '',
  };
}
function blankAccommodation(start, end) {
  return { propertyName: '', location: '', checkIn: start, checkOut: end, notes: '' };
}

function ensurePlannerDialog() {
  if (plannerDialog) return plannerDialog;
  plannerDialog = document.createElement('dialog');
  plannerDialog.id = 'tripPlannerDialog';
  plannerDialog.className = 'dialog trip-planner-dialog';
  plannerDialog.addEventListener('close', () => {
    planner = null;
  });
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
    accommodations: [],
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
    const previousStart = planner.start,
      previousEnd = planner.end;
    planner.start = form.elements.start.value;
    planner.end = form.elements.end.value;
    planner.status = form.elements.status.value;
    planner.profileId = form.elements.profileId.value;
    planner.stops.forEach((stop) => {
      if (stop.start === previousStart) stop.start = planner.start;
      if (stop.end === previousEnd) stop.end = planner.end;
    });
    planner.transports.forEach((transport) => {
      if (transport.legs?.length) return;
      if (localDate(transport.startLocal) === previousStart)
        transport.startLocal = `${planner.start}${transport.startLocal.slice(10) || 'T12:00'}`;
      if (localDate(transport.endLocal) === previousEnd)
        transport.endLocal = `${planner.end}${transport.endLocal.slice(10) || 'T12:00'}`;
    });
    planner.accommodations.forEach((accommodation) => {
      if (accommodation.checkIn === previousStart) accommodation.checkIn = planner.start;
      if (accommodation.checkOut === previousEnd) accommodation.checkOut = planner.end;
    });
    return;
  }
  if (planner.step === 2) {
    planner.name = form.elements.tripName.value.trim();
    planner.notes = form.elements.tripNotes.value.trim();
    planner.stops = qa('[data-planner-stop]', form).map((row) => ({
      countryName: q('[name="countryName"]', row).value.trim(),
      location: q('[name="location"]', row).value.trim(),
      start: q('[name="start"]', row).value,
      end: q('[name="end"]', row).value,
    }));
    return;
  }
  if (planner.step === 3) {
    planner.transports = qa('[data-planner-transport]', form).map((row, index) => ({
      ...planner.transports[index],
      type: q('[name="type"]', row).value,
      startLocal: q('[name="startLocal"]', row).value,
      endLocal: q('[name="endLocal"]', row).value,
      startName: q('[name="startName"]', row).value.trim(),
      endName: q('[name="endName"]', row).value.trim(),
      flightNumber: q('[name="flightNumber"]', row).value.trim(),
      bookingReference: q('[name="bookingReference"]', row).value.trim(),
    }));
    return;
  }
  if (planner.step === 4) {
    planner.accommodations = qa('[data-planner-accommodation]', form).map((row, index) => ({
      ...planner.accommodations[index],
      propertyName: q('[name="propertyName"]', row).value.trim(),
      location: q('[name="location"]', row).value.trim(),
      checkIn: q('[name="checkIn"]', row).value,
      checkOut: q('[name="checkOut"]', row).value,
      ...HVAccommodation.read(row),
      notes: q('[name="notes"]', row).value.trim(),
      price: HVPrices.read(row),
    }));
  }
}

function validateDates() {
  if (
    !window.HVJourney.validDate(planner.start) ||
    !window.HVJourney.validDate(planner.end) ||
    planner.end < planner.start
  )
    return 'Choose a valid start and end date.';
  return '';
}

function validateStops() {
  if (!planner.name) return 'Give this journey a name.';
  if (!planner.stops.length) return 'Add at least one country or location.';
  for (const stop of planner.stops) {
    const country = countryByName(stop.countryName);
    if (!country) return 'Choose every country or location from the list.';
    if (
      !window.HVJourney.validDate(stop.start) ||
      !window.HVJourney.validDate(stop.end) ||
      stop.end < stop.start
    )
      return 'Check the dates for each stop.';
    if (stop.start < planner.start || stop.end > planner.end)
      return 'Each stop must sit inside the journey dates chosen in step 1.';
  }
  return '';
}

function validateTransport() {
  for (const transport of planner.transports) {
    const empty =
      !transport.startName &&
      !transport.endName &&
      !transport.flightNumber &&
      !transport.bookingReference;
    if (empty) return 'Either remove the empty transport row or add the journey details.';
    const record = {
      type: transport.type,
      startLocal: transport.startLocal,
      endLocal: transport.endLocal,
      start: { name: transport.startName, lat: null, lon: null },
      end: { name: transport.endName, lat: null, lon: null },
    };
    const error = window.HVJourney.validateTransport(record);
    if (error) return error;
  }
  return '';
}

function validateAccommodations() {
  for (const accommodation of planner.accommodations) {
    const empty =
      !accommodation.propertyName &&
      !accommodation.location &&
      !accommodation.checkIn &&
      !accommodation.checkOut &&
      !accommodation.notes;
    if (empty) continue;
    if (
      !accommodation.propertyName ||
      !accommodation.location ||
      !window.HVJourney.validDate(accommodation.checkIn) ||
      !window.HVJourney.validDate(accommodation.checkOut) ||
      accommodation.checkOut < accommodation.checkIn
    )
      return 'Each accommodation needs a property, location and valid check-in/check-out dates.';
    const timeError = HVAccommodation.valid(accommodation);
    if (timeError) return timeError;
    const priceError = HVPrices.valid(accommodation.price);
    if (priceError) return priceError;
    if (accommodation.checkIn < planner.start || accommodation.checkOut > planner.end)
      return 'Accommodation dates must sit inside the journey dates.';
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
  return `<div class="planner-transport-row" data-planner-transport><div class="planner-row-head"><span>Transfer ${index + 1}</span><button type="button" class="secondary compact" data-planner-flight="${index}">Flight legs & airlines</button><button type="button" class="text-btn" data-planner-remove-transport="${index}">Remove</button></div><div class="planner-transport-grid"><label class="field"><span>Type</span><select name="type">${Object.entries(
    window.HVJourney.types,
  )
    .map(
      ([value, label]) =>
        `<option value="${E(value)}" ${transport.type === value ? 'selected' : ''}>${E(label)}</option>`,
    )
    .join(
      '',
    )}</select></label><label class="field"><span>Departure</span><input name="startLocal" type="datetime-local" value="${E(transport.startLocal)}" required></label><label class="field"><span>From</span><input name="startName" value="${E(transport.startName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Arrival</span><input name="endLocal" type="datetime-local" value="${E(transport.endLocal)}" required></label><label class="field"><span>To</span><input name="endName" value="${E(transport.endName)}" maxlength="200" placeholder="Airport, station, port or place" required></label><label class="field"><span>Reference <em>optional</em></span><input name="flightNumber" value="${E(transport.flightNumber)}" maxlength="40" placeholder="Flight number or service"></label><label class="field planner-wide-field"><span>Booking reference <em>optional</em></span><input name="bookingReference" value="${E(transport.bookingReference)}" maxlength="100"></label></div></div>`;
}

function accommodationRow(accommodation, index) {
  return `<div class="planner-accommodation-row" data-planner-accommodation><div class="planner-row-head"><span>Stay ${index + 1}</span><button type="button" class="secondary compact" data-planner-place="${index}">Search / plot on map</button><button type="button" class="text-btn" data-planner-remove-accommodation="${index}">Remove</button></div><div class="planner-accommodation-grid"><label class="field"><span>Property name</span><input type="text" name="propertyName" value="${E(accommodation.propertyName)}" maxlength="160" placeholder="e.g. Hotel Lovec" required></label><label class="field"><span>Location</span><input type="text" name="location" value="${E(HVAddress.address(accommodation.place) || HVAddress.text(accommodation.location))}" maxlength="160" placeholder="e.g. Bled" required></label><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(accommodation.checkIn)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(accommodation.checkOut)}" required></label></div>${HVAccommodation.fields(accommodation)}${HVPrices.fields(accommodation)}${HVAccommodationLogos.editor(accommodation)}<label class="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="3" maxlength="4000" placeholder="Room, booking or useful notes">${E(accommodation.notes)}</textarea></label></div>`;
}

function reviewMarkup() {
  return `<div class="planner-review"><section><p class="eyebrow">JOURNEY</p><h3>${E(planner.name)}</h3><p>${E(dateRangeText(planner.start, planner.end))} · ${E(durationText(planner.start, planner.end))} · ${E(planner.status === 'planned' ? 'Planned' : 'Completed')}</p>${planner.notes ? `<p>${E(planner.notes)}</p>` : ''}</section><section><p class="eyebrow">STOPS IN ORDER</p>${planner.stops.map((stop, index) => `<div class="planner-review-row"><span>${index + 1}</span><strong>${E(stop.location || stop.countryName)}</strong><small>${E(stop.countryName)} · ${E(dateRangeText(stop.start, stop.end))}</small></div>`).join('')}</section><section><p class="eyebrow">TRANSPORT</p>${planner.transports.length ? planner.transports.map((transport) => `<div class="planner-review-row"><span>${transportIcon(transport.type)}</span><strong>${E(transport.startName)} → ${E(transport.endName)}</strong><small>${E(window.HVJourney.types[transport.type] || transport.type)} · ${E(transport.startLocal.replace('T', ' '))}</small></div>`).join('') : '<p>No transport added. You can add it later from the trip details.</p>'}</section><section><p class="eyebrow">ACCOMMODATION</p>${
    planner.accommodations.filter((item) => item.propertyName).length
      ? planner.accommodations
          .filter((item) => item.propertyName)
          .map(
            (item) =>
              `<div class="planner-review-row"><span>⌂</span><strong>${E(item.propertyName)}</strong><small>${E(HVAddress.text(item.location))} · ${E(dateRangeText(item.checkIn, item.checkOut))}</small></div>`,
          )
          .join('')
      : '<p>No accommodation added. You can add it later without changing the journey.</p>'
  }</section></div>`;
}

function plannerStepMarkup() {
  if (planner.step === 1)
    return `<div class="planner-step-copy"><p class="eyebrow">STEP 1 OF 5</p><h3>When is the journey?</h3><p>Start with the dates. The calendar stays selected while you work through the rest of the plan.</p></div><div class="planner-date-grid"><label class="field"><span>Start date</span><input name="start" type="date" value="${E(planner.start)}" required></label><label class="field"><span>End date</span><input name="end" type="date" value="${E(planner.end)}" required></label><label class="field"><span>Journey status</span><select name="status"><option value="planned" ${planner.status === 'planned' ? 'selected' : ''}>Planned</option><option value="actual" ${planner.status === 'actual' ? 'selected' : ''}>Completed</option></select></label><label class="field"><span>Traveller</span><select name="profileId">${(state.profiles || []).map((profile) => `<option value="${E(profile.id)}" ${profile.id === planner.profileId ? 'selected' : ''}>${E(profile.name)}</option>`).join('')}</select></label></div>`;
  if (planner.step === 2)
    return `<div class="planner-step-copy"><p class="eyebrow">STEP 2 OF 5</p><h3>Name the trip and add its stops.</h3><p>Add countries and locations in the order you will visit them. You can adjust each stop's dates below.</p></div><label class="field"><span>Trip name</span><input name="tripName" value="${E(planner.name)}" maxlength="80" placeholder="e.g. Eastern Alps 2026" required></label><label class="field"><span>Trip notes <em>optional</em></span><textarea name="tripNotes" maxlength="1000" placeholder="What is this journey for?">${E(planner.notes)}</textarea></label><div class="planner-row-list">${planner.stops.map(stopRow).join('')}</div><button type="button" class="secondary" data-planner-add-stop>+ Add another stop</button>`;
  if (planner.step === 3)
    return `<div class="planner-step-copy"><p class="eyebrow">STEP 3 OF 5</p><h3>How are you getting between stops?</h3><p>Transport stays part of this journey and is shown between the locations it connects. You can skip it and add it later.</p></div>${planner.transports.length ? `<div class="planner-row-list">${planner.transports.map(transportRow).join('')}</div>` : '<div class="planner-skip-card"><strong>No transport added yet</strong><span>Add flights, trains, ferries or road transfers when they are useful to the plan.</span></div>'}<button type="button" class="secondary" data-planner-add-transport>+ Add transport</button>`;
  if (planner.step === 4)
    return `<div class="planner-step-copy"><p class="eyebrow">STEP 4 OF 5</p><h3>Where are you staying?</h3><p>Accommodation is optional and separate from your country stays. Add it now, skip it, or update it later from the trip.</p></div>${planner.accommodations.length ? `<div class="planner-row-list">${planner.accommodations.map(accommodationRow).join('')}</div>` : '<div class="planner-skip-card"><strong>Accommodation is optional</strong><span>Nothing is required here. Add a hotel, apartment, cabin or other place only when you have it.</span></div>'}<button type="button" class="secondary" data-planner-add-accommodation>+ Add accommodation</button>`;
  return `<div class="planner-step-copy"><p class="eyebrow">STEP 5 OF 5</p><h3>Review your journey.</h3><p>Everything below will save as one linked trip. Stays, transport and accommodation can still be edited independently later.</p></div>${reviewMarkup()}`;
}

function plannerNav() {
  return `<div class="planner-dialog-actions"><button type="button" class="secondary" data-planner-cancel>Cancel</button><div class="planner-dialog-actions-right">${planner.step > 1 ? '<button type="button" class="secondary" data-planner-back>Back</button>' : ''}${planner.step < 5 ? '<button type="button" class="primary" data-planner-next>Continue</button>' : '<button type="submit" class="primary">Save journey</button>'}</div></div>`;
}

function renderPlanner() {
  const dialog = ensurePlannerDialog();
  dialog.innerHTML = `<form method="dialog" class="dialog-card trip-planner-card"><header class="trip-planner-head"><div><p class="eyebrow">PLAN A JOURNEY</p><h2>Build one complete trip</h2></div><button type="button" class="icon-btn" data-planner-cancel aria-label="Close">×</button></header><ol class="planner-progress" aria-label="Trip planning progress">${['Dates', 'Stops', 'Transport', 'Stay', 'Review'].map((label, index) => `<li class="${planner.step === index + 1 ? 'current' : planner.step > index + 1 ? 'complete' : ''}"><span>${index + 1}</span>${label}</li>`).join('')}</ol><div class="trip-planner-body">${plannerStepMarkup()}</div><p class="form-error" data-planner-error role="alert"></p>${plannerNav()}</form>`;
  const form = q('form', dialog);
  qa('[data-planner-accommodation]', form).forEach((row, index) => {
    row._logoEditor = HVAccommodationLogos.bindEditor(row, planner.accommodations[index], (src) => {
      planner.accommodations[index].logoDraft = src;
    });
  });
  q('[data-planner-cancel]', form).onclick = () => dialog.close();
  q('[data-planner-back]', form)?.addEventListener('click', () => {
    readPlannerStep();
    planner.step -= 1;
    renderPlanner();
  });
  q('[data-planner-next]', form)?.addEventListener('click', () => {
    if (qa('[data-planner-accommodation]', form).some((row) => row._logoEditor?.busy)) {
      plannerError('Wait for the logo to finish preparing.');
      return;
    }
    readPlannerStep();
    const error = validateThrough(planner.step);
    if (error) {
      plannerError(error);
      return;
    }
    planner.step += 1;
    renderPlanner();
  });
  q('[data-planner-add-stop]', form)?.addEventListener('click', () => {
    readPlannerStep();
    planner.stops.push(blankStop(planner.start, planner.end));
    renderPlanner();
  });
  q('[data-planner-add-transport]', form)?.addEventListener('click', () => {
    readPlannerStep();
    planner.transports.push(blankTransport(planner.start, planner.end));
    renderPlanner();
  });
  q('[data-planner-add-accommodation]', form)?.addEventListener('click', () => {
    readPlannerStep();
    planner.accommodations.push(blankAccommodation(planner.start, planner.end));
    renderPlanner();
  });
  qa('[data-planner-remove-stop]', form).forEach(
    (button) =>
      (button.onclick = () => {
        readPlannerStep();
        planner.stops.splice(Number(button.dataset.plannerRemoveStop), 1);
        renderPlanner();
      }),
  );
  qa('[data-planner-remove-transport]', form).forEach(
    (button) =>
      (button.onclick = () => {
        readPlannerStep();
        planner.transports.splice(Number(button.dataset.plannerRemoveTransport), 1);
        renderPlanner();
      }),
  );
  qa('[data-planner-remove-accommodation]', form).forEach(
    (button) =>
      (button.onclick = () => {
        readPlannerStep();
        planner.accommodations.splice(Number(button.dataset.plannerRemoveAccommodation), 1);
        renderPlanner();
      }),
  );
  qa('[data-planner-flight]', form).forEach((button) => {
    button.textContent =
      planner.transports[Number(button.dataset.plannerFlight)]?.type === 'flight'
        ? 'Flight legs & details'
        : 'Stations, vias & details';
    button.onclick = () => {
      readPlannerStep();
      const index = Number(button.dataset.plannerFlight),
        t = planner.transports[index];
      let saved = 0;
      HVJourneys.openTransport(null, {
        ...t,
        status: planner.status,
        start: t.start?.name === t.startName ? t.start : { name: t.startName },
        end: t.end?.name === t.endName ? t.end : { name: t.endName },
        onSave: (record) => {
          const draft = { ...t, ...record, startName: record.start.name, endName: record.end.name };
          if (saved === 0) planner.transports[index] = draft;
          else planner.transports.splice(index + saved, 0, draft);
          saved++;
          renderPlanner();
        },
      });
    };
  });
  qa('[data-planner-place]', form).forEach(
    (button) =>
      (button.onclick = () => {
        readPlannerStep();
        const index = Number(button.dataset.plannerPlace),
          a = planner.accommodations[index];
        HVPlaces.open({
          ...a,
          accommodation: true,
          date: a.checkIn,
          end: a.checkOut,
          place: a.place,
          searchArea: planner.stops[0]?.location || planner.stops[0]?.countryName,
          onSelect: (place, dates) => {
            planner.accommodations[index] = {
              ...a,
              place,
              placeId: place.id,
              lat: place.lat,
              lon: place.lon,
              propertyName: place.name,
              type: place.type,
              location: place.area || place.address || place.countryName,
              checkIn: dates.date,
              checkOut: dates.end,
              checkInTime: dates.checkInTime,
              checkOutTime: dates.checkOutTime,
              timeZone: dates.timeZone,
              price: dates.price,
              notes: dates.notes,
              ...(Object.hasOwn(dates, 'logoDraft') ? { logoDraft: dates.logoDraft } : {}),
            };
            renderPlanner();
          },
        });
      }),
  );
  qa('[data-planner-transport]', form).forEach((row, index) => {
    q('[name="type"]', row).onchange = () => {
      readPlannerStep();
      if (planner.transports[index].type !== 'flight') delete planner.transports[index].legs;
      renderPlanner();
    };
    if (planner.transports[index]?.legs?.length || planner.transports[index]?.id) {
      for (const name of ['startLocal', 'endLocal', 'startName', 'endName', 'flightNumber'])
        q(`[name="${name}"]`, row).readOnly = true;
    }
  });
  form.onsubmit = (event) => {
    event.preventDefault();
    if (qa('[data-planner-accommodation]', form).some((row) => row._logoEditor?.busy)) {
      plannerError('Wait for the logo to finish preparing.');
      return;
    }
    readPlannerStep();
    const error = validateThrough(4);
    if (error) {
      plannerError(error);
      return;
    }
    savePlanner();
  };
}

async function savePlanner() {
  const data = state,
    activeProfileId = state.activeProfileId;
  for (const stop of planner.stops) {
    const choice = await HVHome.choose(
      countryByName(stop.countryName),
      stop.start,
      planner.profileId,
      stop,
    );
    if (choice === 'cancel') return;
    stop.travelKind = choice;
  }
  if (state !== data || state.activeProfileId !== activeProfileId) {
    plannerError('Your account or traveller changed. Reopen this journey.');
    return;
  }
  const beforeSave = JSON.parse(JSON.stringify(data));
  try {
    const trip = {
      id: uid(),
      name: planner.name,
      notes: planner.notes,
      start: planner.start,
      end: planner.end,
      profileId: planner.profileId || null,
      profileIds: planner.profileId ? [planner.profileId] : [],
    };
    state.trips ||= [];
    state.stays ||= [];
    state.transports ||= [];
    state.accommodations ||= [];
    state.trips.push(trip);
    planner.stops.forEach((stop, index) => {
      const country = countryByName(stop.countryName);
      state.stays.push({
        id: uid(),
        tripId: trip.id,
        countryCode: country.code,
        countryName: country.name,
        ...HVJourney.domesticFields(country),
        travelKind: stop.travelKind,
        domesticHoliday:
          stop.travelKind === 'trip' || (!stop.travelKind && !!country.domesticDestination),
        location: stop.location,
        start: stop.start,
        end: stop.end,
        notes: '',
        schengenExempt: false,
        status: planner.status,
        profileId: planner.profileId || null,
        tripOrder: index,
      });
    });
    planner.transports.forEach((transport) => {
      const { startName, endName, ...details } = transport;
      state.transports.push({
        ...details,
        id: transport.id || uid(),
        tripId: trip.id,
        type: transport.type,
        status: planner.status,
        profileId: planner.profileId || null,
        startLocal: transport.startLocal,
        endLocal: transport.endLocal,
        start: {
          ...(transport.start || {}),
          name: startName,
          lat: transport.start?.lat ?? null,
          lon: transport.start?.lon ?? null,
        },
        end: {
          ...(transport.end || {}),
          name: endName,
          lat: transport.end?.lat ?? null,
          lon: transport.end?.lon ?? null,
        },
      });
    });
    planner.accommodations
      .filter((accommodation) => accommodation.propertyName)
      .forEach((accommodation) => {
        const { logoDraft, ...details } = accommodation,
          record = {
            ...details,
            id: uid(),
            tripId: trip.id,
            profileId: planner.profileId || null,
            propertyName: accommodation.propertyName,
            location: accommodation.location,
            checkIn: accommodation.checkIn,
            checkOut: accommodation.checkOut,
            checkInTime: accommodation.checkInTime || '',
            checkOutTime: accommodation.checkOutTime || '',
            timeZone: accommodation.timeZone || '',
            notes: accommodation.notes,
          };
        state.accommodations.push(record);
        if (Object.hasOwn(accommodation, 'logoDraft'))
          HVAccommodationLogos.set(state, record.id, logoDraft);
      });
    updatePassedPlannedTrips();
    if (persist() === false)
      throw new Error('This journey could not be saved. Keep the page open and try again.');
    calendarSelectionStart = null;
    calendarSelectionEnd = null;
    selectedJourneyKey = tripKey(trip.id);
    selectedDate = '';
    plannerDialog.close();
    renderAll();
    window.HVJourneys?.render();
  } catch (error) {
    Object.assign(data, beforeSave);
    plannerError(error.message);
  }
}

function openCalendarStay(id) {
  openStayDialog(id);
  const picker = $('stayTripSelect');
  if (picker) picker.closest('label').hidden = true;
}

function openAccommodationDialog(tripId, accommodationId = '') {
  const trip = state.trips.find((item) => item.id === tripId);
  const group = buildJourneys().find((item) => item.trip?.id === tripId);
  const existing = (state.accommodations || []).find((item) => item.id === accommodationId);
  if (window.HVPlaces && (!existing || existing.place)) {
    window.HVPlaces.open({
      accommodation: true,
      accommodationId: existing?.id,
      tripId,
      date: group?.start || today(),
      end: group?.end || today(),
    });
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog small-dialog';
  dialog.setAttribute('aria-label', existing ? 'Edit accommodation' : 'Add accommodation');
  const start = existing?.checkIn || group?.start || today(),
    end = existing?.checkOut || group?.end || start;
  dialog.innerHTML = `<form method="dialog" class="dialog-card accommodation-dialog-card"><div class="dialog-head"><div><p class="eyebrow">ACCOMMODATION</p><h2>${existing ? 'Edit accommodation' : 'Add accommodation'}</h2><p class="dialog-intro">${E(trip?.name || 'Dated stay')}</p></div><button type="button" class="icon-btn" data-accommodation-close aria-label="Close">×</button></div><label class="field"><span>Property name</span><input type="text" name="propertyName" value="${E(existing?.propertyName || '')}" maxlength="160" required></label><label class="field"><span>Location</span><input type="text" name="location" value="${E(HVAddress.address(existing?.place) || HVAddress.text(existing?.location))}" maxlength="160" required></label><div class="form-grid"><label class="field"><span>Check-in</span><input name="checkIn" type="date" value="${E(start)}" required></label><label class="field"><span>Check-out</span><input name="checkOut" type="date" value="${E(end)}" required></label></div>${HVAccommodation.fields(existing)}${HVPrices.fields(existing)}${HVAccommodationLogos.editor(existing || {})}<button type="button" class="secondary" data-accommodation-map>Find or plot on map</button><label class="field"><span>Notes <em>optional</em></span><textarea name="notes" maxlength="500">${E(existing?.notes || '')}</textarea></label><p class="form-error" data-accommodation-error role="alert"></p><div class="dialog-actions">${existing ? '<button type="button" class="danger-link" data-accommodation-delete>Remove accommodation</button>' : ''}<div class="spacer"></div><button type="button" class="secondary" data-accommodation-close>Cancel</button><button type="submit" class="primary">Save accommodation</button></div></form>`;
  document.body.append(dialog);
  const data = state,
    activeProfileId = state.activeProfileId,
    form = q('form', dialog),
    error = q('[data-accommodation-error]', form),
    logoEditor = HVAccommodationLogos.bindEditor(form, existing || {});
  qa('[data-accommodation-close]', form).forEach(
    (button) => (button.onclick = () => dialog.close()),
  );
  q('[data-accommodation-map]', form)?.addEventListener('click', () => {
    dialog.close();
    HVPlaces.open({ accommodationId: existing.id });
  });
  q('[data-accommodation-delete]', form)?.addEventListener('click', () => {
    if (!confirm('Remove this accommodation from the trip?')) return;
    HVJourney.removeAccommodationStay(state, existing.id);
    state.accommodations = (state.accommodations || []).filter((item) => item.id !== existing.id);
    persist();
    dialog.close();
    renderAll();
  });
  form.onsubmit = (event) => {
    event.preventDefault();
    if (state !== data || state.activeProfileId !== activeProfileId) {
      error.textContent = 'Your account or traveller changed. Reopen this accommodation.';
      return;
    }
    if (logoEditor?.busy) {
      error.textContent = 'Wait for the logo to finish preparing.';
      return;
    }
    const propertyName = form.elements.propertyName.value.trim(),
      location = form.elements.location.value.trim(),
      checkIn = form.elements.checkIn.value,
      checkOut = form.elements.checkOut.value,
      notes = form.elements.notes.value.trim();
    if (
      !propertyName ||
      !location ||
      !window.HVJourney.validDate(checkIn) ||
      !window.HVJourney.validDate(checkOut) ||
      checkOut < checkIn
    ) {
      error.textContent = 'Add a property, location and valid check-in/check-out dates.';
      return;
    }
    state.accommodations ||= [];
    const times = HVAccommodation.read(form);
    if (HVAccommodation.valid(times)) {
      error.textContent = HVAccommodation.valid(times);
      return;
    }
    const price = HVPrices.read(form);
    if (HVPrices.valid(price)) {
      error.textContent = HVPrices.valid(price);
      return;
    }
    const record = {
      ...existing,
      ...times,
      price,
      id: existing?.id || uid(),
      tripId,
      profileId: existing?.profileId ?? trip?.profileId ?? state.activeProfileId,
      propertyName,
      location,
      checkIn,
      checkOut,
      notes,
    };
    const beforeSave = JSON.parse(JSON.stringify(data));
    try {
      if (existing)
        Object.assign(
          state.accommodations.find((a) => a.id === existing.id),
          record,
        );
      else state.accommodations.push(record);
      HVJourney.syncAccommodationStay(state, record);
      logoEditor?.apply(record.id);
      if (persist() === false)
        throw new Error('This accommodation could not be saved. Keep the page open and try again.');
      dialog.close();
      renderAll();
    } catch (failure) {
      Object.assign(data, beforeSave);
      error.textContent = failure.message;
    }
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
  if (transportSection && add)
    transportSection.querySelector('summary')?.insertAdjacentElement('afterend', add);
}

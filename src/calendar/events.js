async function saveDateEntry(event) {
  const form = event.target;
  if (!['calendarQuickCountry', 'calendarQuickAccommodation'].includes(form.id)) return;
  event.preventDefault();
  const error = q('[role="alert"]', form),
    start = form.elements.start?.value || calendarSelectionStart || selectedDate,
    end = form.elements.end?.value || calendarSelectionEnd || start;
  const tripId = window.HVJourney.tripForDates(state, start, end);
  const trip = (state.trips || []).find((t) => t.id === tripId);
  if (!window.HVJourney.validDate(start) || !window.HVJourney.validDate(end) || end < start) {
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
  if(target.closest('[data-calendar-cancel-range]')){
    event.preventDefault();event.stopPropagation();HVCalendar.clearSelection();return;
  }
  if(target.closest('[data-calendar-explore-selected]')){
    event.preventDefault();event.stopPropagation();selectDate(calendarSelectionStart);return;
  }
  if(target.closest('#prevMonth,#nextMonth,#todayBtn,button[data-calendar-view]'))HVCalendar.clearSelection(false);
  const entry = target.closest('[data-calendar-entry]');
  if (entry) {
    event.preventDefault();
    event.stopPropagation();
    if(entry.dataset.calendarSearchResultDate){
      const date=entry.dataset.calendarSearchResultDate;
      if($('calendar').hidden)q('button[data-calendar-view=month]')?.click();
      calendarCursor=new Date(date.slice(0,7)+'-01T00:00:00Z');
      selectedDate=date;calendarSelectionStart=date;calendarSelectionEnd=null;rangeSelecting=false;
      renderMonth();
    }
    openCalendarEntry(entry.dataset.calendarEntry,entry.dataset.calendarEntryId,entry.dataset.calendarContextDate);
    return;
  }
  if(target.closest('[data-calendar-search-toggle]')){
    event.preventDefault();event.stopPropagation();
    const panel=$('calendarSearchPanel'),button=target.closest('[data-calendar-search-toggle]');
    panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden){renderCalendarSearch();$('calendarSearchInput')?.focus();}return;
  }
  const linkedNote = target.closest('[data-calendar-related-note]');
  if (linkedNote) {
    event.preventDefault();event.stopPropagation();
    const row=HVCalendarDetails.record(linkedNote.dataset.calendarRelatedNote,linkedNote.dataset.calendarRelatedId);
    if(row)HVTravelTools.openNote(null,{date:linkedNote.dataset.calendarRelatedDate,tripId:row.tripId||null,relatedType:linkedNote.dataset.calendarRelatedNote,relatedId:row.id});
    return;
  }
  const back = target.closest('[data-calendar-back-day],[data-calendar-day-nav]');
  if (back) {
    event.preventDefault();event.stopPropagation();
    const date=back.dataset.calendarBackDay||back.dataset.calendarDayNav;
    if(back.hasAttribute('data-calendar-back-day') && selectedDate){
      const previous=selectedEntry;selectedEntry=null;renderJourneyDetail();
      $('calendarJourneyDetail').scrollTop=dayExplorerScroll;
      const row=previous&&q(`#calendarJourneyDetail [data-calendar-entry="${previous.kind}"][data-calendar-entry-id="${CSS.escape(previous.id)}"]`);
      (row||q('[data-calendar-detail-heading]',$('calendarJourneyDetail')))?.focus({preventScroll:true});
    }
    else {
      if(dayKey(calendarCursor).slice(0,7)!==date.slice(0,7)){
        calendarCursor=new Date(date.slice(0,7)+'-01T00:00:00Z');
        renderMonth();
      }
      selectDate(date);
    }
    return;
  }
  if (target.closest('[data-calendar-select-range]')) {
    event.preventDefault();event.stopPropagation();
    rangeMode=!rangeMode;
    HVCalendar.clearSelection();
    return;
  }
  if(target.closest('[data-calendar-show-all]')){
    event.preventDefault();event.stopPropagation();
    calendarFilters=Object.fromEntries(calendarKinds.map(([key])=>[key,true]));renderMonth();
    q('[data-calendar-layer]')?.focus({preventScroll:true});return;
  }
  const home = target.closest('[data-home-calendar-month],[data-home-journey]');
  if (home) {
    event.preventDefault();
    event.stopPropagation();
    const group = home.dataset.homeJourney ? buildJourneys().find(g => g.key === home.dataset.homeJourney) : null;
    const date = home.dataset.homeCalendarMonth || group?.start || today();
    calendarCursor = new Date(date.slice(0,7) + '-01T00:00:00Z');
    switchView('calendar');
    HVCalendar.clearSelection();
    q('[data-calendar-view="month"]')?.click();
    if (group) selectJourney(group.key,date);
    return;
  }
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
    HVCalendar.clearSelection();
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
    pickCalendarDate(date.dataset.calendarDateSelect,event.shiftKey);
    return;
  }
  const noteDate=target.closest('[data-calendar-notes-date]');
  if(noteDate){event.preventDefault();event.stopPropagation();selectDate(noteDate.dataset.calendarNotesDate);return;}
  const noteAction=target.closest('[data-calendar-date-action="note"]');
  if(noteAction){event.preventDefault();event.stopPropagation();window.HVTravelTools?.openNote(null,{date:calendarSelectionStart||selectedDate,tripId:null,rangeEnd:calendarSelectionEnd});return;}
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
  const more = target.closest('[data-calendar-day-detail],[data-calendar-lodging-detail],[data-calendar-countries-detail]');
  if (more) {
    event.preventDefault();
    event.stopPropagation();
    selectDate(more.dataset.calendarDayDetail || more.dataset.calendarLodgingDetail || more.dataset.calendarCountriesDetail);
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
    event.stopPropagation();
    const key = layer.dataset.calendarLayer;
    if(event.shiftKey)calendarFilters=Object.fromEntries(calendarKinds.map(([kind])=>[kind,kind===key]));
    else calendarFilters[key]=!visibleLayers()[key];
    renderMonth();
    q(`[data-calendar-layer="${key}"]`)?.focus({preventScroll:true});
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
    clearSelection(render = true) {
      const returnDate = selectedDate || calendarSelectionStart;
      const returnEntry = selectedEntry;
      const restoreFocus = $('calendarJourneyDetail')?.contains(document.activeElement);
      calendarSelectionStart = null;
      calendarSelectionEnd = null;
      selectedDate = '';
      selectedJourneyKey = '';
      dateAction = '';
      selectedEntry = null;
      rangeSelecting = false;
      if(render)updateDateSelection();
      else {
        const host=$('calendarJourneyDetail');if(host){host.hidden=true;host.replaceChildren();}
        window.HVCalendarDetails?.hide();
        qa('#calendar .selection-range,#calendar .selection-start,#calendar .selection-end').forEach(day=>{day.classList.remove('selection-range','selection-start','selection-end');q('.day-number',day)?.setAttribute('aria-pressed','false');});
      }
      if (render && restoreFocus) {
        const entry=returnEntry&&q(`#calendar [data-calendar-entry="${returnEntry.kind}"][data-calendar-entry-id="${CSS.escape(returnEntry.id)}"]`);
        (detailReturnFocus?.isConnected?detailReturnFocus:entry||q(`[data-calendar-date-select="${CSS.escape(returnDate || '')}"]`)||$('calendarMonthJump'))?.focus({preventScroll:true});
      }
    },
    ready: true,
    renderMonth,
    openTripPlanner,
    openAccommodationDialog,
    journeyGroups: buildJourneys,
    renderHomeOverview,
    openEntry: openCalendarEntry,
    selectDate,
    pickDate: pickCalendarDate,
    groupForEntry(kind,id) {
      buildJourneys();
      const key={country:'stays',accommodation:'accommodations',transport:'transports'}[kind];
      return key ? journeyCache.memberships[key].get(id) : null;
    },
  };
  calendar.dataset.journeyCalendar = 'true';
  moveLegacyTransportTools();
  $('addStayBtn').onclick = () => openTripPlanner({ source: 'manual' });
  $('addStayFromListBtn').onclick = () => openTripPlanner({ source: 'manual' });
  window.addEventListener('hv-airports-ready',()=>{journeyCache=undefined;});
  document.addEventListener('click', captureCalendarAction, true);
  document.addEventListener('submit', saveDateEntry, true);
  $('calendarSearchInput')?.addEventListener('input',renderCalendarSearch);
  document.addEventListener('change',event=>{if(event.target.matches('#calendarMonthJump,#calendarYearJump'))HVCalendar.clearSelection(false);},true);
  calendar.addEventListener('click', event => {
    if(event.target.closest('button,a,input,select,textarea'))return;
    const day=event.target.closest('.calendar-day');
    if(day){event.preventDefault();event.stopPropagation();pickCalendarDate(day.dataset.calendarDate,event.shiftKey);}
  });
  calendar.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-calendar-date-select]');if(!button)return;
    const move={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
    if(!move)return;
    event.preventDefault();const date=HVCalendarData.next(button.dataset.calendarDateSelect,move);
    if(!q(`[data-calendar-date-select="${date}"]`,calendar)){calendarCursor=new Date(date.slice(0,7)+'-01T00:00:00Z');renderMonth();}
    q(`[data-calendar-date-select="${date}"]`,calendar)?.focus({preventScroll:true});
  });
  document.addEventListener('pointerdown', (event) => {
    if (
      (calendarSelectionStart || selectedDate) &&
      !event.target.closest(
        'dialog,#calendar,#calendarJourneyDetail,#calendarSelectionInfo,.calendar-toolbar,#calendarSearchPanel,.calendar-floating-detail',
      )
    )
      HVCalendar.clearSelection();
  });
  document.addEventListener('keydown', (event) => {
    if(event.key==='Escape'&&event.target.closest('#calendarSearchPanel')){
      $('calendarSearchPanel').hidden=true;const button=q('[data-calendar-search-toggle]');button?.setAttribute('aria-expanded','false');button?.focus({preventScroll:true});return;
    }
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
    selectedEntry = null;
    rangeSelecting = false;
    updateDateSelection();
    const rangeEditor=q('.calendar-range-editor',$('calendarJourneyDetail'));if(rangeEditor)rangeEditor.open=true;
    q(event.target.matches('[data-range-start]')?'[data-range-start]':'[data-range-end]',$('calendarJourneyDetail'))?.focus({preventScroll:true});
  });
  document.addEventListener('change', event => {
    if(!event.target.matches('[data-calendar-hover-previews]'))return;
    state.visualLayers ||= {};
    state.visualLayers.calendar = {...state.visualLayers.calendar,hoverPreviews:event.target.checked};
    window.HVCalendarDetails?.hide();
    persist();
  });
  renderMonth();
  renderHomeOverview();
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();

function installCalendarJumpUI() {
  if ($('calendarMonthJump')) return;
  let prev = $('prevMonth'),
    next = $('nextMonth');
  if (!prev || !next) return;
  let host = prev.parentElement,
    wrapper = document.createElement('div'),
    months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
  wrapper.className = 'calendar-jump-controls';
  wrapper.innerHTML = `<select id="calendarMonthJump" class="calendar-jump-select" aria-label="Choose month">${months.map((m, i) => `<option value="${i}">${m}</option>`).join('')}</select><select id="calendarYearJump" class="calendar-jump-select year" aria-label="Choose year">${Array.from(
    { length: 301 },
    (_, i) => 1900 + i,
  )
    .map((y) => `<option value="${y}">${y}</option>`)
    .join('')}</select>`;
  host.insertBefore(wrapper, next);
  let month = $('calendarMonthJump'),
    year = $('calendarYearJump'),
    jump = () => {
      calendarCursor = new Date(Date.UTC(Number(year.value), Number(month.value), 1));
      renderCalendar();
    };
  month.addEventListener('change', jump);
  year.addEventListener('change', jump);
  let style = document.createElement('style');
  style.textContent = `.calendar-jump-controls{display:flex;align-items:center;gap:8px}.calendar-jump-select{background:#fff;border:1px solid #dfe4ea;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;font-weight:600;color:#172033;cursor:pointer}.calendar-jump-select.year{min-width:90px}.calendar-jump-select:focus{outline:none;border-color:#172033}@media(max-width:700px){.calendar-jump-controls{width:100%}.calendar-jump-select{flex:1}}`;
  document.head.appendChild(style);
}
function installResidenceUI() {
  if ($('residencePanel')) return;
  let profiles = $('profilesView');
  if (!profiles) return;
  let panel = document.createElement('article');
  panel.className = 'panel';
  panel.id = 'residencePanel';
  panel.style.marginTop = '20px';
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">HOME HISTORY</p><h2>Places you've lived</h2></div></div><p class="panel-copy">Add the places you've called home. Days when your only recorded location was somewhere you lived won't count towards Travel days logged.</p><form id="residenceForm" class="residence-form"><label class="field"><span>Country</span><input id="residenceCountry" list="countryList" placeholder="Start typing a country…" required></label><label class="field"><span>From</span><input id="residenceStart" type="date" required></label><label class="field"><span>To</span><input id="residenceEnd" type="date"></label><button type="submit" class="primary">Add</button><label class="residence-present"><input id="residencePresent" type="checkbox"> I still live here / Present</label></form><div id="residenceError" class="form-message"></div><div id="residenceList" class="stay-list residence-list"></div>`;
  let dataPanel = $('dataTransferPanel');
  if (dataPanel) profiles.insertBefore(panel, dataPanel);
  else profiles.appendChild(panel);
  if (!$('residenceStyles')) {
    let style = document.createElement('style');
    style.id = 'residenceStyles';
    style.textContent = `.residence-form{display:grid;grid-template-columns:minmax(180px,1.5fr) minmax(140px,1fr) minmax(140px,1fr) auto;gap:12px;align-items:end;margin-top:18px}.residence-present{grid-column:2 / 4;display:flex;gap:8px;align-items:center;font-size:14px}.residence-list{margin-top:18px}@media(max-width:760px){.residence-form{grid-template-columns:1fr}.residence-present{grid-column:auto}}`;
    document.head.appendChild(style);
  }
}
function cacheEls() {
  [
    'countriesLogged',
    'daysLogged',
    'schengenBadge',
    'schengenUsed',
    'schengenProgress',
    'schengenSummary',
    'schengenRemaining',
    'remainingSummary',
    'miniCalendarTitle',
    'miniCalendar',
    'recentStays',
    'schengenAlertPanel',
    'alertTitle',
    'alertBody',
    'dashboardGaps',
    'calendarTitle',
    'calendar',
    'calendarSelectionInfo',
    'clearCalendarSelectionBtn',
    'countryTotals',
    'checkDate',
    'schengenProfileNote',
    'ringUsed',
    'calcUsed',
    'calcRemaining',
    'windowDates',
    'schengenRing',
    'forecastBox',
    'forecastTitle',
    'forecastText',
    'schengenBreakdown',
    'allStays',
    'gapList',
    'pageTitle',
    'stayDialog',
    'stayForm',
    'stayId',
    'tripNameInput',
    'countryInput',
    'countryFlag',
    'dateRanges',
    'notesInput',
    'stayStatus',
    'stayProfile',
    'schengenExempt',
    'schengenExemptRow',
    'formError',
    'dialogTitle',
    'deleteStayBtn',
    'worldMap',
    'mapFallback',
    'mapSelectionSummary',
    'timelineEmpty',
    'timelineContent',
    'timelineSlider',
    'timelineDateLabel',
    'timelineLocationLabel',
    'timelineStartLabel',
    'timelineEndLabel',
    'timelineBars',
    'timelineSchengenLabel',
    'plannerProfile',
    'plannerCountry',
    'plannerEntry',
    'plannerExit',
    'plannerResultTitle',
    'plannerResultBody',
    'addPlannedTripBtn',
    'visaPassport',
    'visaDestination',
    'visaProfileHint',
    'runVisaCheckBtn',
    'visaResultTitle',
    'visaResultBody',
    'visaDataStatus',
    'profileDialog',
    'profileForm',
    'profileId',
    'profileName',
    'citizenshipInput',
    'citizenshipChips',
    'profileError',
    'profileDialogTitle',
    'deleteProfileBtn',
    'profileList',
    'gapDialog',
    'gapForm',
    'gapStart',
    'gapEnd',
    'gapDateSummary',
    'gapCountry',
    'gapError',
    'supabaseUrl',
    'supabaseKey',
    'cloudEmail',
    'cloudPassword',
    'cloudStatusBadge',
    'cloudMessage',
    'cloudPullBtn',
    'cloudPushBtn',
    'cloudSignInBtn',
    'cloudSignOutBtn',
    'autoSyncToggle',
    'localSaveBadge',
    'localSaveDetail',
    'createTransferBtn',
    'transferCodeArea',
    'transferCodeValue',
    'copyTransferCodeBtn',
    'transferExpiry',
    'transferCodeInput',
    'claimTransferBtn',
    'transferMessage',
    'dataBackupBtn',
    'dataRestoreBtn',
    'residenceForm',
    'residenceCountry',
    'residenceStart',
    'residenceEnd',
    'residencePresent',
    'residenceError',
    'residenceList',
  ].forEach((id) => (els[id] = $(id)));
}
function init() {
  installDataTransferUI();
  installResidenceUI();
  installCalendarJumpUI();
  cacheEls();
  updatePassedPlannedTrips();
  $('countryList').innerHTML = [...COUNTRIES, ...HVJourney.domesticDestinations]
    .map((c) => `<option value="${esc(c.name)}"></option>`)
    .join('');
  els.checkDate.value = isoDate(new Date());
  els.plannerEntry.value = isoDate(new Date());
  bindEvents();
  populateProfileSelects();
  renderAll();
  updateLocalSaveIndicator();
  initCloudFromConfig();
}
function bindEvents() {
  document
    .querySelectorAll('.nav-item')
    .forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
  document
    .querySelectorAll('[data-go-view]')
    .forEach((b) => (b.onclick = () => switchView(b.dataset.goView)));
  $('addStayBtn').onclick = () => openStayDialog();
  $('addStayFromListBtn').onclick = () => openStayDialog();
  $('closeDialog').onclick = $('cancelDialog').onclick = () => els.stayDialog.close();
  $('addDateRangeBtn').onclick = () => addDateRange();
  els.stayForm.onsubmit = saveStay;
  $('deleteStayBtn').onclick = deleteStay;
  els.countryInput.oninput = updateStayCountry;
  document.addEventListener('click', handleDelegatedClick);
  $('prevMonth').onclick = () => {
    calendarCursor = new Date(
      Date.UTC(calendarCursor.getUTCFullYear(), calendarCursor.getUTCMonth() - 1, 1),
    );
    renderCalendar();
  };
  $('nextMonth').onclick = () => {
    calendarCursor = new Date(
      Date.UTC(calendarCursor.getUTCFullYear(), calendarCursor.getUTCMonth() + 1, 1),
    );
    renderCalendar();
  };
  $('todayBtn').onclick = () => {
    calendarCursor = startOfMonth(new Date());
    renderCalendar();
  };
  els.clearCalendarSelectionBtn.onclick = clearCalendarSelection;
  els.checkDate.onchange = renderSchengen;
  $('timelineTodayBtn').onclick = () => setTimelineDate(isoDate(new Date()));
  els.timelineSlider.oninput = () => setTimelineFromSlider();
  $('runPlannerBtn').onclick = runPlanner;
  if (els.runVisaCheckBtn) els.runVisaCheckBtn.onclick = runVisaCheck;
  if (els.visaPassport)
    els.visaPassport.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runVisaCheck();
      }
    });
  if (els.visaDestination)
    els.visaDestination.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runVisaCheck();
      }
    });
  els.addPlannedTripBtn.onclick = addPlannerTrip;
  $('addProfileBtn').onclick = () => openProfileDialog();
  $('closeProfileDialog').onclick = $('cancelProfileDialog').onclick = () =>
    els.profileDialog.close();
  $('addCitizenshipBtn').onclick = addCitizenship;
  els.profileForm.onsubmit = saveProfile;
  els.deleteProfileBtn.onclick = deleteProfile;
  els.gapForm.onsubmit = saveGap;
  $('closeGapDialog').onclick = $('cancelGapDialog').onclick = () => els.gapDialog.close();
  if (els.residenceForm) els.residenceForm.onsubmit = saveResidence;
  if (els.residencePresent)
    els.residencePresent.onchange = () => {
      els.residenceEnd.disabled = els.residencePresent.checked;
      if (els.residencePresent.checked) els.residenceEnd.value = '';
    };
}

function handleDelegatedClick(e) {
  let go = e.target.closest('[data-go-view]');
  if (go) {
    switchView(go.dataset.goView);
    return;
  }
  let b = e.target.closest('[data-action]');
  if (b) {
    let a = b.dataset.action;
    if (a === 'edit-stay') openStayDialog(b.dataset.id);
    if (a === 'remove-range') b.closest('.date-range-row').remove();
    if (a === 'fill-gap') openGapDialog(b.dataset.start, b.dataset.end, b.dataset.country || '');
    if (a === 'delete-residence') deleteResidence(b.dataset.id);
    if (a === 'exclude-country') {
      let code = b.dataset.country;
      state.excludedCountryCodes = Array.from(
        new Set([...(state.excludedCountryCodes || []), code]),
      );
      persist();
      renderDashboard();
      renderCountries();
      updateMapColors();
    }
    if (a === 'include-country') {
      let code = b.dataset.country;
      state.excludedCountryCodes = (state.excludedCountryCodes || []).filter((c) => c !== code);
      persist();
      renderDashboard();
      renderCountries();
      updateMapColors();
    }
    if (a === 'set-profile') {
      state.activeProfileId = b.dataset.id;
      persist();
      populateProfileSelects();
      renderAll();
    }
    if (a === 'edit-profile') openProfileDialog(b.dataset.id);
    if (a === 'use-profile-passport') {
      let c = countryByCode(b.dataset.country);
      if (c) {
        els.visaPassport.value = c.name;
        runVisaCheck();
      }
    }
    return;
  }
  let day = e.target.closest('[data-calendar-date]');
  if (day) handleCalendarDateClick(day.dataset.calendarDate);
}
function switchView(v, { render = true } = {}) {
  document.querySelectorAll('.view').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
  $(`${v}View`).classList.add('active');
  document.querySelector(`.nav-item[data-view="${v}"]`)?.classList.add('active');
  let t = {
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    map: 'Map & timeline',
    countries: 'Countries',
    schengen: 'Schengen 90/180',
    planner: 'Plan a Trip',
    stayPlanner: 'Stay planner',
    rules: 'Entry Requirements',
    stays: 'All stays',
    profiles: 'Profiles & data',
  };
  els.pageTitle.textContent = t[v] || 'Travel tracker';
  if (render && v === 'map') renderMapTimeline();
  if (render && v === 'schengen') renderSchengen();
  if (v === 'stayPlanner') populateProfileSelects();
  if (render && v === 'rules') renderVisaChecker();
  if (render && v === 'stays') renderStayLists();
  if (render && v === 'profiles') renderProfiles();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function renderAll() {
  const view = document.body.dataset.currentView || 'dashboard';
  if (view === 'profiles' || view === 'homes') renderProfiles();
  if (view === 'dashboard') {
    renderDashboard();
    renderMiniCalendar();
  }
  if (view === 'calendar') renderCalendar();
  if (view === 'countries') renderCountries();
  if (view === 'schengen') renderSchengen();
  if (view === 'stays') renderStayLists();
  if (view === 'rules') renderVisaChecker();
  if (view === 'map') renderMapTimeline();
  window.HVJourneys?.render();
}
function renderDashboard() {
  const p = activeProfile(),
    today = isoDate(new Date()),
    r = rollingStatus(today),
    st = statusForUsed(r.used),
    exempt = isSchengenExemptProfile(p),
    profileStays = staysForProfile();
  els.countriesLogged.textContent = [...HVJourney.summary(state, today).countries].filter(
    WIBCountryCount.isCounted,
  ).length;
  els.daysLogged.textContent = travelDaySet().size;
  if (exempt) {
    els.schengenUsed.textContent = '—';
    els.schengenRemaining.textContent = '—';
    els.schengenBadge.className = 'status-badge good';
    els.schengenBadge.textContent = 'EXEMPT';
    els.schengenProgress.style.width = '0';
    els.schengenSummary.textContent = `${p.name} has an EU/EEA/Swiss citizenship recorded`;
    els.remainingSummary.textContent = '90/180 short-stay rule not applied';
    els.schengenAlertPanel.hidden = true;
  } else {
    els.schengenUsed.textContent = r.used;
    els.schengenRemaining.textContent = Math.max(0, r.remaining);
    els.schengenProgress.style.width = `${Math.min(100, (r.used / 90) * 100)}%`;
    els.schengenProgress.style.background =
      st.kind === 'bad' ? 'var(--red)' : st.kind === 'warn' ? 'var(--amber)' : 'var(--green)';
    els.schengenBadge.className = `status-badge ${st.kind}`;
    els.schengenBadge.textContent = st.label;
    els.schengenSummary.textContent = `${plural(r.used, 'day')} used from ${fmtObj(r.start, { day: 'numeric', month: 'short' })} to ${fmtObj(r.end, { day: 'numeric', month: 'short' })}`;
    els.remainingSummary.textContent = `As of ${fmtObj(r.end)}`;
    els.schengenAlertPanel.hidden = st.kind === 'good';
    els.schengenAlertPanel.className = `panel warning-panel ${st.kind}`;
    els.alertTitle.textContent =
      st.kind === 'warn'
        ? 'Your Schengen allowance is getting tight'
        : r.used > 90
          ? 'Your records show a possible overstay'
          : 'You are very close to the limit';
    els.alertBody.textContent = st.text;
  }
  const gaps = findGaps().slice(0, 3);
  els.dashboardGaps.className = 'gap-list';
  els.dashboardGaps.innerHTML = `<details class="home-history-check"><summary>Trips update automatically <span class="status-badge good">ON</span></summary><p>Planned trips and transport become completed the day after their final date. Edit or cancel anything before then.</p>${gaps.length ? `<div class="home-gap-list">${gaps.map((g) => gapCard(g, true)).join('')}</div>` : '<p>No gaps in your completed travel history.</p>'}</details>`;
  renderStayList(els.recentStays, [
    ...profileStays
      .filter((s) => s.status === 'planned' && s.start > today)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3),
    ...profileStays
      .filter((s) => s.status === 'actual' && s.start <= today)
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, 3),
  ]);
}
function renderMiniCalendar() {
  let c = startOfMonth(new Date()),
    first = (c.getUTCDay() + 6) % 7,
    start = addDays(c, -first),
    today = isoDate(new Date()),
    list = staysForProfile().filter(countsForPlanning);
  els.miniCalendarTitle.textContent = c.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  let h = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    .map((d) => `<div class="mini-weekday">${d}</div>`)
    .join('');
  for (let i = 0; i < 42; i++) {
    let d = addDays(start, i),
      k = dayKey(d),
      has = list.some((s) => s.start <= k && s.end >= k);
    h += `<div class="mini-day ${d.getUTCMonth() === c.getUTCMonth() ? '' : 'muted'} ${k === today ? 'today' : ''} ${has ? 'has-stay' : ''}">${d.getUTCDate()}</div>`;
  }
  els.miniCalendar.innerHTML = h;
}

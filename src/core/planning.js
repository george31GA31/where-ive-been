function renderVisaChecker() {
  if (!els.visaPassport) return;
  let p = activeProfile(),
    cit = p?.citizenships || [];
  if (!els.visaPassport.value && cit.length) {
    let c = countryByCode(cit[0]);
    if (c) els.visaPassport.value = c.name;
  }
  if (cit.length) {
    els.visaProfileHint.innerHTML =
      `${esc(p.name)} has ${cit.length === 1 ? 'this passport' : 'these passports'} saved: ` +
      cit
        .map((code) => {
          let c = countryByCode(code);
          return c
            ? `<button type="button" data-action="use-profile-passport" data-country="${code}">${flagHtml(code, 'flag-img flag-sm')} ${esc(c.name)}</button>`
            : '';
        })
        .filter(Boolean)
        .join(' · ');
  } else
    els.visaProfileHint.innerHTML = `No passport saved for ${esc(p?.name || 'this traveller')}. You can still type one above, or <button type="button" data-go-view="profiles">add it to the profile</button>.`;
  HVEntryChecker.init();
  const coverage = HVEntryRules.coverage();
  if (els.visaDataStatus)
    els.visaDataStatus.textContent =
      coverage.passports +
      ' passports · ' +
      coverage.routes.toLocaleString() +
      ' routes. Worldwide visa data with reviewed official corrections.';
}
async function runVisaCheck() {
  HVEntryChecker.init();
  const from = countryByName(els.visaPassport.value),
    to = countryByName(els.visaDestination.value),
    host = els.visaPassport.closest('.panel'),
    input = HVEntryChecker.read(host);
  if (!from || !to || from.code === 'SEA' || to.code === 'SEA' || input.error) {
    els.visaResultTitle.textContent = 'Check your details';
    els.visaResultBody.innerHTML =
      '<p class="visa-error">' +
      esc(input.error || 'Choose a valid passport country and destination.') +
      '</p>';
    return;
  }
  const display = () => {
    const rule = HVEntryRules.lookup(from.code, to.code, input.options);
    els.visaResultTitle.innerHTML = flagHtml(to.code) + ' ' + esc(to.name);
    els.visaResultBody.innerHTML = HVEntryChecker.resultHtml(rule);
  };
  display();
  const button = els.runVisaCheckBtn;
  button.disabled = true;
  try {
    await HVEntryRules.refresh();
    if (els.visaPassport.value === from.name && els.visaDestination.value === to.name) display();
  } finally {
    button.disabled = false;
  }
}

function visitBlocksForRule(rule, profileId) {
  let dates = new Set();
  staysForProfile(profileId)
    .filter(countsForPlanning)
    .filter((s) => rule.countries.includes(s.countryCode))
    .forEach((s) => datesForStay(s).forEach((d) => dates.add(d)));
  let a = [...dates].sort(),
    out = [];
  for (let d of a) {
    let last = out.at(-1);
    if (!last || diffDays(last.end, d) > 1) out.push({ start: d, end: d, days: 1 });
    else {
      last.end = d;
      last.days++;
    }
  }
  return out;
}
function runPlanner() {
  let p = state.profiles.find((x) => x.id === els.plannerProfile.value) || activeProfile(),
    c = countryByName(els.plannerCountry.value),
    entry = els.plannerEntry.value,
    exit = els.plannerExit.value;
  lastPlannerTrip = null;
  els.addPlannedTripBtn.classList.add('hidden');
  if (!c || !entry) {
    els.plannerResultTitle.textContent = 'Add a destination and entry date';
    els.plannerResultBody.innerHTML =
      '<div class="planner-placeholder">Choose a valid country and date.</div>';
    return;
  }
  if (c.code === 'SEA') {
    els.plannerResultTitle.innerHTML = `${flagHtml('SEA')} At Sea`;
    els.plannerResultBody.innerHTML =
      '<div class="result-message">At Sea can be recorded as a planned travel location, but it does not have a visa-day rule.</div>';
    if (exit) {
      lastPlannerTrip = { country: c, start: entry, end: exit, profileId: p.id };
      els.addPlannedTripBtn.classList.remove('hidden');
    }
    return;
  }
  if (exit && exit < entry) {
    els.plannerResultTitle.textContent = 'Check your dates';
    els.plannerResultBody.innerHTML =
      '<div class="result-message bad">Departure cannot be before entry.</div>';
    return;
  }
  if (SCHENGEN.has(c.code)) {
    if (isSchengenExemptProfile(p)) {
      els.plannerResultTitle.textContent = 'Schengen 90/180 does not apply to this profile';
      els.plannerResultBody.innerHTML =
        '<div class="result-message">An EU/EEA/Swiss citizenship is recorded for this traveller. Free-movement and local registration/residence rules are different from the visitor 90/180 rule.</div>';
      return;
    }
    let max = maxContinuousSchengen(entry, p.id),
      safeEnd = max ? dayKey(addDays(parseDate(entry), max - 1)) : null,
      tripExit = exit || safeEnd,
      trial = tripExit
        ? {
            id: 'planner',
            countryCode: c.code,
            countryName: c.name,
            start: entry,
            end: tripExit,
            schengenExempt: false,
            status: 'planned',
            profileId: p.id,
          }
        : null,
      over = trial
        ? firstOverstay(entry, Math.max(1, daysInclusive(entry, tripExit)), p.id, [trial])
        : null,
      reentry = safeEnd
        ? earliestOneDayEntry(dayKey(addDays(parseDate(safeEnd), 1)), p.id, [
            {
              id: 'usedmax',
              countryCode: c.code,
              countryName: c.name,
              start: entry,
              end: safeEnd,
              schengenExempt: false,
              status: 'planned',
              profileId: p.id,
            },
          ])
        : earliestOneDayEntry(entry, p.id);
    els.plannerResultTitle.innerHTML = `${flagHtml(c.code)} ${esc(c.name)} · Schengen`;
    let ok = !exit || !over;
    els.plannerResultBody.innerHTML = `<div class="result-hero"><div class="result-stat"><span>MAX CONTINUOUS STAY</span><strong>${plural(max, 'day')}</strong></div><div class="result-stat"><span>SAFE DEPARTURE</span><strong>${safeEnd ? fmt(safeEnd, { day: 'numeric', month: 'short' }) : 'Not available'}</strong></div><div class="result-stat"><span>RE-ENTRY AFTER USING MAX</span><strong>${reentry ? fmt(reentry, { day: 'numeric', month: 'short' }) : '—'}</strong></div></div><div class="result-message ${ok ? '' : 'bad'}">${exit ? (over ? `Your proposed trip would first exceed the 90/180 limit on <strong>${fmt(over.date)}</strong>. Shorten the trip or change the dates.` : `Your proposed ${daysInclusive(entry, exit)}-day trip stays within the recorded 90/180 history.`) : max ? `If you enter on <strong>${fmt(entry)}</strong>, your current records allow up to <strong>${plural(max, 'consecutive day')}</strong>, leaving by <strong>${fmt(safeEnd)}</strong>.` : `Your recorded history does not leave a Schengen day available on ${fmt(entry)}. Earliest one-day entry found: <strong>${reentry ? fmt(reentry) : 'not within the next 2 years'}</strong>.`}</div>`;
    if (tripExit && ok) {
      lastPlannerTrip = { country: c, start: entry, end: tripExit, profileId: p.id };
      els.addPlannedTripBtn.classList.remove('hidden');
    }
    return;
  }
  let rule = RULES.find((r) => r.countries.includes(c.code));
  els.plannerResultTitle.innerHTML = `${flagHtml(c.code)} ${esc(c.name)}`;
  if (rule) {
    let leave = rule.months
      ? dayKey(addDays(addMonths(parseDate(entry), rule.months), -1))
      : rule.limit
        ? dayKey(addDays(parseDate(entry), rule.limit - 1))
        : null;
    els.plannerResultBody.innerHTML = `<div class="result-hero"><div class="result-stat"><span>TRACKER TEMPLATE</span><strong>${rule.months ? `Up to ${rule.months} months` : `${plural(rule.limit, 'day')}`}</strong></div><div class="result-stat"><span>PLANNING DATE</span><strong>${leave ? fmt(leave, { day: 'numeric', month: 'short' }) : '—'}</strong></div></div><div class="result-message warn">${esc(rule.desc)} This is only a planning template; verify that you are eligible and check the actual permission granted to you.</div>`;
  } else
    els.plannerResultBody.innerHTML =
      '<div class="result-message">No built-in visa-day template is attached to this country yet. You can still add the trip to your travel history.</div>';
  if (exit) {
    lastPlannerTrip = { country: c, start: entry, end: exit, profileId: p.id };
    els.addPlannedTripBtn.classList.remove('hidden');
  }
}
async function addPlannerTrip() {
  if (!lastPlannerTrip) return;
  let t = lastPlannerTrip;
  const travelKind = await HVHome.choose(t.country, t.start, t.profileId);
  if (travelKind === 'cancel') return;
  state.stays.push({
    id: uid(),
    countryCode: t.country.code,
    countryName: t.country.name,
    ...HVJourney.domesticFields(t.country),
    travelKind,
    domesticHoliday: travelKind === 'trip',
    start: t.start,
    end: t.end,
    notes: 'Added from trip planner',
    schengenExempt: false,
    status: 'planned',
    profileId: t.profileId,
  });
  updatePassedPlannedTrips();
  persist();
  renderAll();
  els.addPlannedTripBtn.classList.add('hidden');
  els.plannerResultBody.insertAdjacentHTML(
    'beforeend',
    '<div class="form-message" style="color:var(--green)">Planned trip added to your calendar.</div>',
  );
}

function activeProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
}
function isSchengenExemptProfile(p = activeProfile()) {
  return !!p && p.citizenships.some((c) => EU_EEA_CH.has(c));
}
function staysForProfile(profileId = state.activeProfileId) {
  return HVJourney.scoped(state.stays, profileId);
}
function countsAsTravel(s) {
  return HVJourney.isActual(s);
}
function countsForPlanning(s) {
  return HVJourney.countsForPlanning(s);
}
function datesForStay(s, min = null, max = null) {
  let a = parseDate(s.start),
    b = parseDate(s.end),
    lo = min ? parseDate(min) : a,
    hi = max ? parseDate(max) : b,
    start = a > lo ? a : lo,
    end = b < hi ? b : hi,
    out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(dayKey(d));
  return out;
}
function residenceAppliesOnDate(countryCode, date, profileId = state.activeProfileId) {
  if (countryCode === 'SEA') return false;
  return (state.residences || []).some(
    (r) =>
      (!r.profileId || r.profileId === profileId) &&
      r.countryCode === countryCode &&
      r.start <= date &&
      (!r.end || r.end >= date),
  );
}
function travelDaySet(list = staysForProfile(state.activeProfileId)) {
  return HVJourney.summary({ ...state, stays: list }, isoDate(new Date())).days;
}
function schengenDaySet(min = null, max = null, profileId = state.activeProfileId, extra = []) {
  let set = new Set();
  [...staysForProfile(profileId), ...extra].filter(countsForPlanning).forEach((s) => {
    if (SCHENGEN.has(s.countryCode) && !s.schengenExempt)
      datesForStay(s, min, max).forEach((d) => set.add(d));
  });
  return set;
}
function rollingStatus(check, profileId = state.activeProfileId, extra = []) {
  let end = parseDate(check),
    start = addDays(end, -179),
    set = schengenDaySet(dayKey(start), dayKey(end), profileId, extra),
    used = set.size;
  return { start, end, used, remaining: 90 - used };
}
function statusForUsed(n) {
  if (n > 90)
    return {
      kind: 'bad',
      label: 'OVER',
      text: `Your records show ${plural(n, 'Schengen day')} in this rolling 180-day window.`,
    };
  if (n >= 86)
    return {
      kind: 'bad',
      label: 'VERY CLOSE',
      text: `Only ${plural(90 - n, 'Schengen day')} remain in this rolling window.`,
    };
  if (n >= 75)
    return {
      kind: 'warn',
      label: 'WATCH',
      text: `You have ${plural(90 - n, 'Schengen day')} remaining in this rolling window.`,
    };
  return {
    kind: 'good',
    label: 'OK',
    text: `You have ${plural(90 - n, 'Schengen day')} remaining in this rolling window.`,
  };
}
function firstOverstay(from, horizon = 500, profileId = state.activeProfileId, extra = []) {
  const start = parseDate(from),
    min = dayKey(addDays(start, -179)),
    max = dayKey(addDays(start, horizon)),
    days = schengenDaySet(min, max, profileId, extra);
  let used = 0;
  for (let i = -179; i <= 0; i++) if (days.has(dayKey(addDays(start, i)))) used++;
  for (let i = 0; i <= horizon; i++) {
    const date = dayKey(addDays(start, i));
    if (i) {
      if (days.has(dayKey(addDays(start, i - 180)))) used--;
      if (days.has(date)) used++;
    }
    if (used > 90) return { date, used };
  }
  return null;
}
function maxContinuousSchengen(entry, profileId = state.activeProfileId) {
  let extra = [],
    last = null;
  for (let i = 0; i < 180; i++) {
    let d = dayKey(addDays(parseDate(entry), i)),
      trial = {
        id: 'planner',
        countryCode: 'FR',
        countryName: 'Schengen',
        start: entry,
        end: d,
        schengenExempt: false,
        status: 'planned',
        profileId,
      };
    let r = rollingStatus(d, profileId, [trial]);
    if (r.used > 90) break;
    last = d;
  }
  return last ? daysInclusive(entry, last) : 0;
}
function earliestOneDayEntry(from, profileId = state.activeProfileId, extra = []) {
  let d = parseDate(from);
  for (let i = 0; i < 730; i++, d = addDays(d, 1)) {
    let k = dayKey(d),
      trial = {
        id: 'reentry',
        countryCode: 'FR',
        countryName: 'Schengen',
        start: k,
        end: k,
        schengenExempt: false,
        status: 'planned',
        profileId,
      };
    if (rollingStatus(k, profileId, [...extra, trial]).used <= 90) return k;
  }
  return null;
}
function findGaps() {
  let source = staysForProfile(state.activeProfileId).filter(countsAsTravel);
  if (source.length < 2) return [];
  let arr = [...source].sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    ),
    gaps = [],
    curEnd = arr[0].end,
    prev = arr[0];
  for (let i = 1; i < arr.length; i++) {
    let s = arr[i];
    if (parseDate(s.start) > addDays(parseDate(curEnd), 1)) {
      let missingStart = dayKey(addDays(parseDate(curEnd), 1)),
        missingEnd = dayKey(addDays(parseDate(s.start), -1)),
        gs = curEnd,
        ge = s.start;
      gaps.push({
        start: gs,
        end: ge,
        days: daysInclusive(gs, ge),
        missingStart,
        missingEnd,
        missingDays: daysInclusive(missingStart, missingEnd),
        prev,
        next: s,
      });
    }
    if (s.end > curEnd) {
      curEnd = s.end;
      prev = s;
    }
  }
  return gaps;
}
function updatePassedPlannedTrips() {
  const today = isoDate(new Date()),
    staysChanged = HVJourney.reviewPlanned(state.stays, today),
    transportChanged = HVJourney.reviewTransport(state.transports, today);
  if (staysChanged || transportChanged) persist(true);
}

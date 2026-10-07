let state = loadState(),
  calendarCursor = startOfMonth(new Date()),
  timelineDate = null,
  worldFeatures = null,
  worldLoading = false,
  profileCitizenships = [],
  calendarSelectionStart = null,
  calendarSelectionEnd = null,
  stayDialogContext = 'manual';

let cloudClient = null,
  cloudSession = null,
  cloudTimer = null,
  lastPlannerTrip = null;
let transferClient = null,
  lastTransferCode = '';
const $ = (id) => document.getElementById(id) || window.HVPages?.get(id),
  els = {};
function defaultState() {
  return {
    version: 2,
    trips: [],
    stays: [],
    transports: [],
    accommodations: [],
    notes: [],
    checklists: [],
    budgets: [],
    expenses: [],
    roadTrips: [],
    currencyRates: [],
    currencyPreferences: [],
    manualCountryVisits: [],
    tccVisits: [],
    placeVisits: [],
    savedPlaces: [],
    visaAcknowledgements: [],
    residences: [],
    profiles: [{ id: uid(), name: 'Me', citizenships: [], enabledRules: ['schengen'] }],
    activeProfileId: null,
    excludedCountryCodes: [],
  };
}
function loadState(includeClaimed = false) {
  const claimed = !includeClaimed && localStorage.getItem('whereIveBeen.localOwner.v1');
  try {
    let v = JSON.parse(localStorage.getItem(claimed ? 'whereIveBeen.guest.v1' : APP_KEY));
    if (v) {
      normalizeState(v);
      return v;
    }
  } catch {}
  let d = defaultState();
  if (!claimed)
    try {
      let legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || [];
      d.stays = legacy.map((s) => ({
        ...s,
        status: s.status || 'actual',
        profileId: s.profileId || null,
      }));
    } catch {}
  d.activeProfileId = d.profiles[0].id;
  return d;
}
function normalizeState(v) {
  v.version = 2;
  for (const k of [
    'roadTrips',
    'currencyRates',
    'currencyPreferences',
    'manualCountryVisits',
    'tccVisits',
  ])
    v[k] = Array.isArray(v[k]) ? v[k] : [];
  v.savedPlaces = Array.isArray(v.savedPlaces) ? v.savedPlaces : [];
  v.visaAcknowledgements = Array.isArray(v.visaAcknowledgements) ? v.visaAcknowledgements : [];
  v.trips = Array.isArray(v.trips) ? v.trips : [];
  v.transports = Array.isArray(v.transports) ? v.transports : [];
  v.accommodations = Array.isArray(v.accommodations) ? v.accommodations : [];
  if (!Array.isArray(v.notes)) {
    if (v.notes != null) v.legacyTravelNotes ??= v.notes;
    v.notes =
      typeof v.notes === 'string' && v.notes.trim()
        ? [
            {
              id: 'legacy-travel-note',
              title: 'Imported travel notes',
              body: v.notes,
              profileId: v.activeProfileId || null,
              category: 'General',
            },
          ]
        : [];
  }
  v.checklists = Array.isArray(v.checklists) ? v.checklists : [];
  v.budgets = Array.isArray(v.budgets) ? v.budgets : [];
  v.expenses = Array.isArray(v.expenses) ? v.expenses : [];
  v.placeVisits = Array.isArray(v.placeVisits) ? v.placeVisits : [];
  v.stays = Array.isArray(v.stays) ? v.stays : [];
  v.residences = Array.isArray(v.residences) ? v.residences : [];
  v.profiles =
    Array.isArray(v.profiles) && v.profiles.length ? v.profiles : defaultState().profiles;
  v.activeProfileId = v.activeProfileId || v.profiles[0].id;
  v.excludedCountryCodes = Array.isArray(v.excludedCountryCodes) ? v.excludedCountryCodes : [];
  v.profiles.forEach((p) => {
    p.citizenships = p.citizenships || [];
    p.enabledRules = p.enabledRules || ['schengen'];
  });
  v.stays.forEach((s) => {
    s.status = ['actual', 'planned', 'unconfirmed', 'cancelled'].includes(s.status)
      ? s.status
      : 'actual';
    if (s.profileId === undefined) s.profileId = null;
  });
  v.transports.forEach((t) => {
    t.status = ['actual', 'planned', 'cancelled'].includes(t.status) ? t.status : 'actual';
    if (t.profileId === undefined) t.profileId = null;
  });
  v.accommodations.forEach((a) => {
    if (a.profileId === undefined) a.profileId = null;
    if (a.tripId === undefined) a.tripId = null;
    a.propertyName = String(a.propertyName || a.name || '').trim();
    a.location = String(a.location || '').trim();
    a.notes = String(a.notes || '').trim();
  });
  v.residences.forEach((r) => {
    if (r.profileId === undefined) r.profileId = null;
    if (r.end === undefined) r.end = null;
  });
}
function persist(noCloud = false) {
  localStorage.setItem(APP_KEY, JSON.stringify(state));
  localStorage.setItem(LOCAL_SAVED_KEY, new Date().toISOString());
  updateLocalSaveIndicator();
  if (!noCloud && cloudSession && getCloudConfig().autoSync) {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => cloudPush(true), 700);
  }
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

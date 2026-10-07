const $ = (id) => document.getElementById(id) || window.HVPages?.get(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const E = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const journeyColours = [
  '#8d2637',
  '#29556b',
  '#8a6d2f',
  '#3c7157',
  '#72567b',
  '#9c5d42',
  '#4b6d8a',
];

let selectedJourneyKey = '';
let selectedDate = '';
let dateAction = '';
let planner = null;
let plannerDialog = null;
let journeyCache;

const today = () => isoDate(new Date());
const localDate = (value) => String(value || '').slice(0, 10);
const days = (start, end) => (start && end ? Math.max(1, diffDays(start, end) + 1) : 0);
const dateText = (value) => (value ? fmt(value) : '—');
const dateRangeText = (start, end) =>
  !start
    ? 'Dates to be added'
    : start === end
      ? dateText(start)
      : `${dateText(start)} to ${dateText(end)}`;
const durationText = (start, end) =>
  `${days(start, end)} ${days(start, end) === 1 ? 'day' : 'days'}`;
const scoped = (rows) => window.HVJourney.scoped(rows || [], state.activeProfileId);
const visibleLayers = () => ({
  countries: true,
  transport: true,
  accommodation: true,
  ...state.visualLayers?.calendar,
});

function hash(value) {
  let result = 0;
  for (const character of String(value)) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function colourFor(key) {
  return journeyColours[hash(key) % journeyColours.length];
}

function tripKey(id) {
  return `trip:${id}`;
}
function stayKey(id) {
  return `stay:${id}`;
}
function transportKey(id) {
  return `transport:${id}`;
}

function distanceToRange(date, start, end) {
  if (!date || !start || !end) return Infinity;
  if (date < start) return diffDays(date, start);
  if (date > end) return diffDays(end, date);
  return 0;
}

function createGroup(groups, key, trip = null) {
  if (!groups.has(key))
    groups.set(key, {
      key,
      trip,
      stays: [],
      transports: [],
      accommodations: [],
      inferredTransportIds: new Set(),
    });
  return groups.get(key);
}

function buildJourneys() {
  const lists = [
    state.trips,
    state.stays,
    state.accommodations,
    state.transports,
    state.profiles,
    state.residences,
  ];
  const omitted = new Set([
    'notes',
    'body',
    'resolvedRoutes',
    'geometry',
    'coordinates',
    'polyline',
    'src',
    'artwork',
    'logoDraft',
  ]);
  const stamp = JSON.stringify([state.activeProfileId, today(), lists], (key, value) =>
    omitted.has(key) ? undefined : value,
  );
  if (
    journeyCache?.stamp === stamp &&
    lists.every(
      (rows, i) =>
        (rows || []).length === journeyCache.rows[i].length &&
        (rows || []).every((row, j) => row === journeyCache.rows[i][j]),
    )
  )
    return journeyCache.groups;
  const groups = new Map();
  const trips = scoped(state.trips || []);
  const knownTrips = new Map(trips.map((trip) => [trip.id, trip]));

  for (const trip of trips) createGroup(groups, tripKey(trip.id), trip);

  for (const stay of scoped(state.stays || [])) {
    const key = stay.tripId ? tripKey(stay.tripId) : stayKey(stay.id);
    createGroup(groups, key, knownTrips.get(stay.tripId) || null).stays.push(stay);
  }

  for (const accommodation of scoped(state.accommodations || [])) {
    const candidates = !accommodation.tripId
      ? [...groups.values()].filter(
          (g) =>
            !g.trip?.excludedRecordIds?.accommodations?.includes(accommodation.id) &&
            g.stays.some(
              (stay) =>
                stay.status !== 'cancelled' &&
                stay.start <= accommodation.checkIn &&
                stay.end >= accommodation.checkOut &&
                HVJourney.isTravelStay(state, stay) &&
                HVJourney.isTravelStay(state, stay, accommodation.checkIn) &&
                HVJourney.isTravelStay(state, stay, accommodation.checkOut),
            ),
        )
      : [];
    const linkedStay = state.stays.find(
      (s) => s.source === 'accommodation' && s.sourceAccommodationId === accommodation.id,
    );
    const key = accommodation.tripId
      ? tripKey(accommodation.tripId)
      : linkedStay
        ? stayKey(linkedStay.id)
        : candidates.length === 1
          ? candidates[0].key
          : `accommodation:${accommodation.id}`;
    createGroup(groups, key, knownTrips.get(accommodation.tripId) || null).accommodations.push(
      accommodation,
    );
  }

  const findInferredGroup = (transport) => {
    const transportDates = [localDate(transport.startLocal), localDate(transport.endLocal)].filter(
      Boolean,
    );
    const candidates = [...groups.values()]
      .filter(
        (group) =>
          group.trip &&
          !group.trip.excludedRecordIds?.transports?.includes(transport.id) &&
          group.stays.length &&
          (!transport.profileId ||
            !group.trip.profileId ||
            transport.profileId === group.trip.profileId ||
            group.trip.profileIds?.includes(transport.profileId)),
      )
      .map((group) => {
        const start = group.stays.map((stay) => stay.start).sort()[0];
        const end = group.stays
          .map((stay) => stay.end)
          .sort()
          .at(-1);
        return {
          group,
          score: Math.min(...transportDates.map((date) => distanceToRange(date, start, end))),
        };
      })
      .filter((candidate) => candidate.score <= 1)
      .sort((a, b) => a.score - b.score);
    if (!candidates.length) return null;
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
    return candidates[0].group;
  };

  for (const transport of scoped(state.transports || [])) {
    let group = transport.tripId
      ? createGroup(groups, tripKey(transport.tripId), knownTrips.get(transport.tripId) || null)
      : null;
    if (!group) {
      group = findInferredGroup(transport);
      if (group) group.inferredTransportIds.add(transport.id);
    }
    (group || createGroup(groups, transportKey(transport.id))).transports.push(transport);
  }

  const result = [...groups.values()]
    .map((group) => {
      group.stays.sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          Number(a.tripOrder || 0) - Number(b.tripOrder || 0) ||
          a.end.localeCompare(b.end),
      );
      group.transports.sort((a, b) => String(a.startLocal).localeCompare(String(b.startLocal)));
      group.accommodations.sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));
      const recordDates = [
        group.trip?.start,
        group.trip?.end,
        ...(!group.trip && !group.stays.length && !group.transports.length
          ? group.accommodations.flatMap((a) => [a.checkIn, a.checkOut])
          : []),
        ...group.stays.flatMap((stay) => [stay.start, stay.end]),
        ...group.transports.flatMap((transport) => HVJourney.transportDates(transport)),
      ]
        .filter(Boolean)
        .sort();
      group.start = recordDates[0] || '';
      group.end = recordDates.at(-1) || '';
      const records = [...group.stays, ...group.transports];
      const allCancelled =
        records.length > 0 && records.every((record) => record.status === 'cancelled');
      group.phase = allCancelled
        ? 'cancelled'
        : !group.start
          ? 'draft'
          : group.end < today()
            ? 'completed'
            : group.start > today()
              ? 'upcoming'
              : 'active';
      group.title =
        group.trip?.name ||
        group.stays[0]?.location ||
        group.stays[0]?.countryName ||
        (group.transports[0]
          ? window.HVJourneys?.transportLabel(group.transports[0]) ||
            window.HVJourney.transportLabel(group.transports[0])
          : group.accommodations[0]?.propertyName || 'Untitled journey');
      group.colour = colourFor(group.key);
      group.countries = [
        ...new Set(
          group.stays.filter((stay) => stay.countryCode !== 'SEA').map((stay) => stay.countryCode),
        ),
      ];
      return group;
    })
    .sort((a, b) => (a.start || '9999-12-31').localeCompare(b.start || '9999-12-31'));
  journeyCache = { stamp, rows: lists.map((rows) => [...(rows || [])]), groups: result };
  return result;
}

function groupsForDate(date, groups, layers) {
  return groups.filter((group) => {
    const country =
      layers.countries &&
      group.stays.some(
        (stay) =>
          stay.status !== 'cancelled' &&
          stay.start <= date &&
          stay.end >= date &&
          HVJourney.isTravelStay(state, stay, date),
      );
    const transport =
      layers.transport &&
      group.transports.some(
        (record) =>
          record.status !== 'cancelled' && HVJourney.transportDates(record).includes(date),
      );
    const accommodation =
      layers.accommodation &&
      group.accommodations.some((record) => record.checkIn <= date && record.checkOut >= date);
    return country || transport || accommodation;
  });
}

function homesForDate(date) {
  return scoped(state.stays || []).filter(
    (stay) =>
      stay.status !== 'cancelled' &&
      stay.start <= date &&
      stay.end >= date &&
      !HVJourney.isDomesticHoliday(stay) &&
      window.HVJourney.isHome(state, stay.countryCode, date),
  );
}

function seaForDate(date) {
  return scoped(state.stays || []).filter(
    (stay) =>
      stay.status !== 'cancelled' &&
      stay.countryCode === 'SEA' &&
      stay.start <= date &&
      stay.end >= date,
  );
}

function locationForDate(group, date) {
  const stay = group.stays.find(
    (item) => item.status !== 'cancelled' && item.start <= date && item.end >= date,
  );
  if (stay) return stay.location || stay.countryName;
  const transport = group.transports.find(
    (item) =>
      item.status !== 'cancelled' &&
      [localDate(item.startLocal), localDate(item.endLocal)].includes(date),
  );
  return transport
    ? window.HVJourneys?.transportLabel(transport) || window.HVJourney.transportLabel(transport)
    : group.title;
}

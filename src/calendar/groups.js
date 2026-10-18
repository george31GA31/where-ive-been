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
let selectedEntry = null;
let rangeSelecting = false;
let rangeMode = true;
let detailReturnFocus = null;
let dayExplorerScroll = 0;
let calendarFilters = {};

const calendarKinds = [
  ['countries', 'Countries', 'country', '▏'],
  ['accommodation', 'Accommodation', 'accommodation', '⌂'],
  ['transport', 'Transport', 'transport', '↗'],
  ['notes', 'Notes', 'note', '✎'],
  ['locations', 'Locations', 'location', '◎'],
];
const entryAttributes = (kind, id, date = '') =>
  `data-calendar-entry="${kind}" data-calendar-entry-id="${E(id)}" data-calendar-context-date="${E(date)}" aria-haspopup="dialog"`;

const today = () => isoDate(new Date());
const localDate = (value) => String(value || '').slice(0, 10);
const days = (start, end) => (start && end ? Math.max(1, diffDays(start, end) + 1) : 0);
const calendarDateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const dateText = (value) => (HVJourney.validDate(value) ? calendarDateFormat.format(parseDate(value)) : value ? 'Date not recorded' : '—');
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
  notes: true,
  locations: true,
  ...state.visualLayers?.calendar,
  ...calendarFilters,
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
  const stamp=HVData.token(state,['trips','stays','accommodations','transports','profiles','residences'],state.activeProfileId+'|'+today());
  if(journeyCache?.state===state&&journeyCache.stamp===stamp)return journeyCache.groups;
  const groups = new Map();
  const trips = scoped(state.trips || []);
  const knownTrips = new Map(trips.map((trip) => [trip.id, trip]));

  for (const trip of trips) createGroup(groups, tripKey(trip.id), trip);

  for (const stay of scoped(state.stays || [])) {
    const key = stay.tripId ? tripKey(stay.tripId) : stayKey(stay.id);
    createGroup(groups, key, knownTrips.get(stay.tripId) || null).stays.push(stay);
  }

  const stayIndex=new HVData.Intervals(scoped(state.stays||[])),linkedAccommodation=new Map((state.stays||[]).filter(s=>s.source==='accommodation').map(s=>[s.sourceAccommodationId,s]));
  const stayOwners=new Map();for(const group of groups.values())for(const stay of group.stays)stayOwners.set(stay.id,group);
  for (const accommodation of scoped(state.accommodations || [])) {
    const candidates=!accommodation.tripId?[...new Set(stayIndex.containing(accommodation.checkIn,accommodation.checkOut).filter(stay=>stay.status!=='cancelled'&&HVJourney.isTravelStay(state,stay)&&HVJourney.isTravelStay(state,stay,accommodation.checkIn)&&HVJourney.isTravelStay(state,stay,accommodation.checkOut)).map(stay=>stayOwners.get(stay.id)))].filter(group=>!group.trip?.excludedRecordIds?.accommodations?.includes(accommodation.id)):[];
    const linkedStay=linkedAccommodation.get(accommodation.id);
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

  const ranges=new HVData.Intervals([...groups.values()].filter(g=>g.trip&&g.stays.length).map(group=>({group,start:group.stays.map(s=>s.start).sort()[0],end:group.stays.map(s=>s.end||today()).sort().at(-1)})));
  const findInferredGroup=transport=>{
    const dates=[localDate(transport.startLocal),localDate(transport.endLocal)].filter(Boolean),nearby=new Set();
    for(const date of dates)for(const range of ranges.overlap(HVCalendarData.next(date,-1),HVCalendarData.next(date)))nearby.add(range);
    const candidates=[...nearby].filter(({group})=>!group.trip.excludedRecordIds?.transports?.includes(transport.id)&&(!transport.profileId||!group.trip.profileId||transport.profileId===group.trip.profileId||group.trip.profileIds?.includes(transport.profileId))).map(({group,start,end})=>({group,score:Math.min(...dates.map(date=>distanceToRange(date,start,end)))})).filter(row=>row.score<=1).sort((a,b)=>a.score-b.score);
    if(!candidates.length||candidates.length>1&&candidates[0].score===candidates[1].score)return null;return candidates[0].group;
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
          String(a.end||today()).localeCompare(String(b.end||today())),
      );
      group.transports.sort((a, b) => String(a.startLocal).localeCompare(String(b.startLocal)));
      group.accommodations.sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));
      const recordDates = [
        group.trip?.start,
        group.trip?.end,
        ...(!group.trip && !group.stays.length && !group.transports.length
          ? group.accommodations.flatMap((a) => [a.checkIn, a.checkOut])
          : []),
        ...group.stays.flatMap((stay) => [stay.start, stay.end||today()]),
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
  const memberships={stays:new Map(),transports:new Map(),accommodations:new Map()};const order=new Map();
  result.forEach((group,index)=>{order.set(group,index);for(const key of Object.keys(memberships))for(const row of group[key])memberships[key].set(row.id,group);});
  journeyCache={state,stamp,groups:result,memberships,order};
  return result;
}

function groupsForDate(date,groups,layers,day=HVCalendarData.window(state,date,1).get(date)){
  const selected=new Set();for(const key of ['stays','transports','accommodations']){
    if(!(key==='stays'?layers.countries:key==='transports'?layers.transport:layers.accommodation))continue;
    for(const row of day[key]){const group=journeyCache.memberships[key].get(row.id);if(group)selected.add(group);}
  }
  return [...selected].sort((a,b)=>journeyCache.order.get(a)-journeyCache.order.get(b));
}

function homesForDate(date) {
  return scoped(state.stays || []).filter(
    (stay) =>
      stay.status !== 'cancelled' &&
      stay.start <= date &&
      (!stay.end || stay.end >= date) &&
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
      (!stay.end || stay.end >= date),
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

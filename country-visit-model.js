/* Explicit visit assertions. These records never manufacture travel history. */
(function (root) {
  'use strict';
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const validYear = value => Number.isInteger(value) && value >= 1 && value <= 9999;
  const scoped = (rows, profileId) => (rows || []).filter(r => profileId === 'all' || !r.profileId || r.profileId === profileId);
  const id = (kind, profileId, destination) => kind + ':' + (profileId || 'shared') + ':' + destination;
  function validate(details, today) {
    if (details.date && (!validDate(details.date) || details.date > today)) return 'Choose a valid past or present visit date.';
    if (details.year != null && (!validYear(details.year) || details.year > Number(today.slice(0,4)))) return 'Choose a valid past or present visit year.';
    if (details.date && details.year != null) return 'Use an exact date or an approximate year.';
    if (details.visits != null && (!Number.isInteger(details.visits) || details.visits < 1 || details.visits > 100000)) return 'Enter a positive number of visits.';
    if (details.note != null && (typeof details.note !== 'string' || details.note.length > 2000)) return 'Keep the note within 2,000 characters.';
    return '';
  }
  function manualRows(data, today, profileId = data.activeProfileId) {
    return scoped(data.manualCountryVisits, profileId).filter(r => r.visited !== false && /^[A-Z]{2,3}$/.test(r.countryCode || '') && (!r.date || validDate(r.date) && r.date <= today) && (r.year == null || validYear(r.year) && r.year <= Number(today.slice(0,4))));
  }
  function manualCodes(data, today, profileId = data.activeProfileId) {
    return new Set(manualRows(data,today,profileId).map(r => r.countryCode).filter(c => c !== 'SEA'));
  }
  function setManual(data, code, visited, details = {}, today = new Date().toISOString().slice(0,10), proven = new Set()) {
    if (!/^[A-Z]{2,3}$/.test(code) || code === 'SEA') throw new Error('Choose a country.');
    const error = validate(details,today); if (error) throw new Error(error);
    data.manualCountryVisits ||= [];
    const existing = scoped(data.manualCountryVisits,data.activeProfileId).find(r => r.countryCode === code);
    if (!visited) { data.manualCountryVisits = data.manualCountryVisits.filter(r => r !== existing); return; }
    if (!existing && proven.has(code)) return; // A real visit already supplies the assertion.
    const record = {...existing, id:existing?.id || id('manual-country',data.activeProfileId,code), profileId:existing?.profileId ?? data.activeProfileId, countryCode:code, visited:true, date:details.date || null, year:details.year ?? null, visits:details.visits ?? null, note:details.note || ''};
    if (existing) Object.assign(existing,record); else data.manualCountryVisits.push(record);
  }
  function setTcc(data, destinationId, visited, details = {}, today = new Date().toISOString().slice(0,10)) {
    if (!/^tcc-[a-z0-9-]+$/.test(destinationId)) throw new Error('Choose a TCC destination.');
    const error = validate(details,today); if (error) throw new Error(error);
    data.tccVisits ||= [];
    const existing = scoped(data.tccVisits,data.activeProfileId).find(r => r.destinationId === destinationId);
    if (!visited) { data.tccVisits = data.tccVisits.filter(r => r !== existing); return; }
    const record = {...existing, id:existing?.id || id('tcc-visit',data.activeProfileId,destinationId), profileId:existing?.profileId ?? data.activeProfileId, destinationId, visited:true, date:details.date || null, year:details.year ?? null, note:details.note || ''};
    if (existing) Object.assign(existing,record); else data.tccVisits.push(record);
  }
  const api = {validDate, validYear, scoped, id, validate, manualRows, manualCodes, setManual, setTcc};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HVCountryVisits = api;
})(typeof window !== 'undefined' ? window : globalThis);

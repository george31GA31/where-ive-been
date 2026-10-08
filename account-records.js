/* Keep unreadable legacy rows intact while healthy rows remain usable. */
(function (root) {
  'use strict';
  const M =
    typeof module !== 'undefined' && module.exports ? require('./account-model.js') : root.WIBModel;
  const collections = [
    'profiles',
    'stays',
    'trips',
    'residences',
    'transports',
    'transportOperators',
    'accommodations',
    'savedPlaces',
    'placeVisits',
    'checklists',
    'budgets',
    'expenses',
    'roadTrips',
    'currencyRates',
    'currencyPreferences',
    'manualCountryVisits',
    'tccVisits',
    'visaAcknowledgements',
  ];
  const date = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value));
  function usable(key, row) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')
      return false;
    if (['stays', 'residences'].includes(key))
      return (
        typeof row.countryCode === 'string' &&
        date(row.start) &&
        ((key === 'residences' && !row.end) || date(row.end))
      );
    if (key === 'accommodations') return date(row.checkIn) && date(row.checkOut);
    if (key === 'transports')
      return (
        typeof row.startLocal === 'string' &&
        typeof row.endLocal === 'string' &&
        row.start &&
        row.end
      );
    if (key === 'profiles')
      return ['citizenships', 'enabledRules', 'homeCountryCodes'].every(
        (field) => row[field] == null || Array.isArray(row[field]),
      );
    return true;
  }
  function project(original) {
    const data = { ...original },
      preserved = {};
    for (const key of collections) {
      if (original[key] == null) continue;
      if (!Array.isArray(original[key])) {
        preserved[key] = { value: original[key] };
        data[key] = [];
        continue;
      }
      const kept = [],
        hidden = [],
        ids = new Set();
      original[key].forEach((row, index) => {
        if (usable(key, row) && !ids.has(row.id)) {
          kept.push(row);
          ids.add(row.id);
        } else hidden.push({ index, row });
      });
      if (hidden.length) {
        data[key] = kept;
        preserved[key] = { rows: hidden };
      }
    }
    if (Array.isArray(original.notes)) {
      const rows = original.notes
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !usable('notes', row));
      if (rows.length) {
        data.notes = original.notes.filter((row) => usable('notes', row));
        preserved.notes = { rows };
      }
    }
    return { data, preserved };
  }
  function restore(data, preserved) {
    const result = { ...data };
    for (const [key, saved] of Object.entries(preserved)) {
      if (Object.hasOwn(saved, 'value')) {
        if (result[key]?.length)
          throw new Error(
            'The original ' +
              key +
              ' data needs recovery before adding records. Your original data is safe.',
          );
        result[key] = saved.value;
      } else {
        const rows = [...(result[key] || [])];
        for (const { index, row } of saved.rows) rows.splice(Math.min(index, rows.length), 0, row);
        result[key] = rows;
      }
    }
    return result;
  }
  // Display normalization may add empty/default fields. Apply only differences
  // from the displayed baseline to the original account, never those defaults.
  function changes(original, before, after) {
    if (M.equal(before, after)) return original;
    if (Array.isArray(before) && Array.isArray(after) && Array.isArray(original)) {
      const index = (rows) => {
        const seen = new Set();
        return new Map(
          rows.map((row, i) => {
            const id = row?.id,
              unique = typeof id === 'string' && !seen.has(id);
            seen.add(id);
            return [unique ? id : '\u0000legacy:' + i, row];
          }),
        );
      };
      const records = (rows) =>
        rows.every((row) => row == null || (typeof row === 'object' && !Array.isArray(row)));
      if (records(before) && records(after)) {
        const raw = index(original),
          previous = index(before),
          current = index(after);
        return [...current].map(([key, row]) => changes(raw.get(key), previous.get(key), row));
      }
      return after;
    }
    if (
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const result = {
        ...(original && typeof original === 'object' && !Array.isArray(original) ? original : {}),
      };
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (M.equal(before[key], after[key])) continue;
        if (!Object.hasOwn(after, key)) delete result[key];
        else
          Object.defineProperty(result, key, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: changes(original?.[key], before[key], after[key]),
          });
      }
      return result;
    }
    return after;
  }
  const api = { project, restore, changes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WIBAccountRecords = api;
})(typeof window !== 'undefined' ? window : globalThis);

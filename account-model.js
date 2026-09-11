/* Pure merge rules shared by account syncing and migration tests. */
(function (root) {
  'use strict';
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
    return value;
  }
  const canonical = value => JSON.stringify(stable(value));
  const equal = (a, b) => canonical(a) === canonical(b);
  const collections = new Set(['stays', 'profiles', 'residences', 'transports', 'placeVisits']);
  function merge(base, local, remote, resolve) {
    const conflicts = [];
    function field(b, l, r, path) {
      if (equal(l, r) || equal(b, r)) return copy(l);
      if (equal(b, l)) return copy(r);
      if (b && l && r && !Array.isArray(l) && typeof l === 'object' && typeof r === 'object') {
        return Object.fromEntries([...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])]
          .map(k => [k, field(b[k], l[k], r[k], path + '.' + k)]).filter(([, v]) => v !== undefined));
      }
      const conflict = {path, local: copy(l), remote: copy(r)};
      conflicts.push(conflict);
      return copy(resolve ? resolve(conflict) : r);
    }
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      if (collections.has(key)) {
        const b = new Map((base[key] || []).map(x => [x.id, x]));
        const l = new Map((local[key] || []).map(x => [x.id, x]));
        const r = new Map((remote[key] || []).map(x => [x.id, x]));
        result[key] = [...new Set([...r.keys(), ...l.keys(), ...b.keys()])]
          .map(id => field(b.get(id), l.get(id), r.get(id), key + '.' + id)).filter(x => x !== undefined);
      } else result[key] = field(base[key], local[key], remote[key], key);
    }
    return {data: result, conflicts};
  }
  function importData(remote, source, resolve) {
    // Compare complete records without IDs. Different notes/passports are never discarded.
    const result = copy(remote), conflicts = [], profileIds = new Map(), stayIds = new Map();
    const signature = record => {
      const r = copy(record); delete r.id;
      if (r.citizenships) r.citizenships.sort();
      if (r.enabledRules) r.enabledRules.sort();
      return canonical(r);
    };
    for (const key of ['profiles', 'stays', 'residences', 'transports', 'placeVisits']) {
      result[key] ||= [];
      for (const original of source[key] || []) {
        const record = copy(original);
        if (record.profileId) record.profileId = profileIds.get(record.profileId) || record.profileId;
        if (record.autoFromPlannedId) record.autoFromPlannedId = stayIds.get(record.autoFromPlannedId) || record.autoFromPlannedId;
        const same = result[key].find(x => x.id === record.id);
        const duplicate = result[key].find(x => signature(x) === signature(record));
        const mapping = key === 'profiles' ? profileIds : key === 'stays' ? stayIds : null;
        if (duplicate) { mapping?.set(original.id, duplicate.id); continue; }
        if (same) {
          const conflict = {path: key + '.' + record.id, local: record, remote: same};
          conflicts.push(conflict);
          if (resolve) result[key][result[key].indexOf(same)] = copy(resolve(conflict));
          mapping?.set(original.id, same.id);
        } else { result[key].push(record); mapping?.set(original.id, record.id); }
      }
    }
    for (const key of Object.keys(source)) {
      if (collections.has(key)) continue;
      if (key === 'excludedCountryCodes') result[key] = [...new Set([...(remote[key] || []), ...(source[key] || [])])];
      else if (result[key] === undefined || result[key] === null) result[key] = copy(source[key]);
    }
    if (result.activeProfileId) result.activeProfileId = profileIds.get(result.activeProfileId) || result.activeProfileId;
    return {data: result, conflicts};
  }
  const api = {copy, equal, merge, importData};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WIBModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

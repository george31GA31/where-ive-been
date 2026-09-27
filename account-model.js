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
  const collections = new Set(['trips', 'stays', 'profiles', 'residences', 'transports', 'placeVisits']);
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
    const result = copy(remote), conflicts = [], profileIds = new Map(), tripIds = new Map(), stayIds = new Map();
    const signature = record => {
      const r = copy(record); delete r.id;
      if (r.citizenships) r.citizenships.sort();
      if (r.enabledRules) r.enabledRules.sort();
      if (r.profileIds) r.profileIds.sort();
      return canonical(r);
    };
    for (const key of ['profiles', 'trips', 'stays', 'residences', 'transports', 'placeVisits']) {
      result[key] ||= [];
      for (const original of source[key] || []) {
        const record = copy(original);
        if (record.profileId) record.profileId = profileIds.get(record.profileId) || record.profileId;
        if (Array.isArray(record.profileIds)) record.profileIds=[...new Set(record.profileIds.map(id=>profileIds.get(id)||id))].sort();
        if (record.tripId) record.tripId = tripIds.get(record.tripId) || record.tripId;
        if (record.autoFromPlannedId) record.autoFromPlannedId = stayIds.get(record.autoFromPlannedId) || record.autoFromPlannedId;
        const same = result[key].find(x => x.id === record.id);
        const duplicate = result[key].find(x => signature(x) === signature(record));
        const mapping = key === 'profiles' ? profileIds : key === 'trips' ? tripIds : key === 'stays' ? stayIds : null;
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
      if (['excludedCountryCodes','countryCountExcludedCodes','countryCountIncludedExtraCodes'].includes(key)) result[key] = [...new Set([...(remote[key] || []), ...(source[key] || [])])];
      else if (key === 'visualLayers') result[key] = Object.fromEntries([...new Set([...Object.keys(source[key] || {}),...Object.keys(remote[key] || {})])].map(view => [view,{...(source[key]?.[view] || {}),...(remote[key]?.[view] || {})}]));
      else if (result[key] === undefined || result[key] === null) result[key] = copy(source[key]);
    }
    if (result.activeProfileId) result.activeProfileId = profileIds.get(result.activeProfileId) || result.activeProfileId;
    return {data: result, conflicts};
  }
  function describeConflict(conflict,data={}) {
    const [collection,id,field]=conflict.path.split('.'),record=(data[collection]||[]).find?.(r=>r.id===id)||conflict.local||conflict.remote||{};
    const labels={stays:'Stay',trips:'Trip',transports:'Transport',residences:'Home period',profiles:'Traveller',placeVisits:'Place visit',start:'Start date',end:'End date',status:'Status',notes:'Notes',countryCode:'Country',profileId:'Traveller',tripId:'Linked trip',homeCountryCodes:'Permanent home countries',activeProfileId:'Selected traveller',countryCountExcludedCodes:'Excluded countries',countryCountIncludedExtraCodes:'Included territories'};
    const name=record.countryName||record.name||(record.start?.name?record.start.name+' to '+record.end?.name:'')||labels[collection]||'Preference';
    const display=value=>{
      if(value===undefined)return 'Deleted';if(value===null||value==='')return 'Not recorded';
      if(Array.isArray(value))return value.map(display).join(', ')||'None';
      if(typeof value==='object')return Object.entries(value).filter(([k])=>!['id','profileId','tripId'].includes(k)).map(([k,v])=>(labels[k]||k)+': '+display(v)).join(' · ');
      if(field==='profileId'||field==='activeProfileId')return(data.profiles||[]).find(p=>p.id===value)?.name||'Traveller';
      if(field==='tripId')return(data.trips||[]).find(t=>t.id===value)?.name||'Trip';
      return String(value);
    };
    return {title:name+' · '+(labels[field]||labels[collection]||'Preference'),local:display(conflict.local),remote:display(conflict.remote)};
  }
  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose a valid travel backup.');
    for (const key of collections) {
      if (data[key] === undefined) continue;
      if (!Array.isArray(data[key])) throw new Error(key + ' must be a list.');
      const ids=new Set();
      for (const row of data[key]) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Invalid or duplicate record in ' + key + '.');
        ids.add(row.id);
        if(row.profileId!=null&&typeof row.profileId!=='string')throw new Error('Invalid traveller reference in '+key+'.');
        if(row.tripId!=null&&typeof row.tripId!=='string')throw new Error('Invalid trip reference in '+key+'.');
        if(key==='transports'){
          const local=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'Z'))&&new Date(v+'Z').toISOString().slice(0,16)===v;
          if(!['flight','train','bus','boat','car','other'].includes(row.type)||!local(row.startLocal)||!local(row.endLocal))throw new Error('Check transport type and local times.');
          for(const side of ['start','end'])if(!row[side]||typeof row[side].name!=='string'||!row[side].name.trim())throw new Error('Check transport locations.');
        }
        if(key==='placeVisits'&&(typeof row.category!=='string'||typeof row.itemId!=='string'||(!['want','not-recorded'].includes(row.status)&&!/^\d{4}-\d{2}-\d{2}$/.test(row.date||''))))throw new Error('Check place visit details.');
        if (key==='stays' || key==='residences') {
          const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
          if (typeof row.countryCode!=='string'||!/^[A-Z]{2,3}$/.test(row.countryCode)||!date(row.start)||(key==='stays'&&!date(row.end))||(row.end&&(!date(row.end)||row.end<row.start))) throw new Error('Check country and date ranges in ' + key + '.');
        }
      }
    }
    return data;
  }
  const api = {copy, equal, merge, importData, validateImport, describeConflict};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WIBModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

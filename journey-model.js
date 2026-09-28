/* Pure, additive travel data rules. No storage or network side effects. */
(function(root) {
  'use strict';
  const categories = {buildings:'Tallest buildings', mountains:'Highest natural points', unesco:'UNESCO sites', airports:'Airports'};
  const types = {flight:'Flight',train:'Train',bus:'Bus',boat:'Boat',car:'Car',other:'Other'};
  const scoped = (rows,profileId) => (rows || []).filter(r => profileId === 'all' || !r.profileId || r.profileId === profileId || r.profileIds?.includes(profileId));
  const visibleTransport = (state,profileId=state.activeProfileId) => scoped(state.transports,profileId).filter(t => t.status !== 'cancelled' && !(state.trips||[]).some(trip=>trip.id===t.tripId&&trip.status==='cancelled'));
  const summary = (state,today,profileId=state.activeProfileId) => {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=today),countries=new Set(),days=new Set(),home=new Set(),trips=new Set();
    for(const stay of stays){for(let ms=Date.parse(stay.start),last=Math.min(Date.parse(stay.end),Date.parse(today));ms<=last;ms+=86400000){const date=new Date(ms).toISOString().slice(0,10);const owner=stay.profileId||state.activeProfileId;const atHome=profileId==='all'&&!stay.profileId?state.profiles.every(p=>isHome(state,stay.countryCode,date,p.id)):isHome(state,stay.countryCode,date,owner);(atHome?home:days).add(date);if(!atHome){countries.add(stay.countryCode);trips.add(stay.tripId||'stay:'+stay.id);}}}
    countries.delete('SEA');for(const date of days)home.delete(date);
    return {stays,countries,days,home,trips};
  };
  function isHome(state,code,date,profileId=state.activeProfileId) {
    if(code==='SEA') return false;
    return (state.profiles.find(p=>p.id===profileId)?.homeCountryCodes || []).includes(code) || scoped(state.residences,profileId).some(r=>r.countryCode===code&&r.start<=date&&(!r.end||r.end>=date));
  }
  // Association is derived from existing dates only; never extend or create a trip.
  function tripForDates(state,start,end=start,profileId=state.activeProfileId) {
    const candidates=scoped(state.trips,profileId).filter(t=>{
      const dates=scoped(state.stays,profileId).filter(s=>s.tripId===t.id&&s.status!=='cancelled').flatMap(s=>[s.start,s.end]).concat(scoped(state.transports,profileId).filter(r=>r.tripId===t.id&&r.status!=='cancelled').flatMap(r=>[r.startLocal?.slice(0,10),r.endLocal?.slice(0,10)])).filter(Boolean).sort();
      return dates.length&&dates[0]<=start&&dates.at(-1)>=end;
    });
    return candidates.length===1?candidates[0].id:null;
  }
  function homeCountryCodes(state,profileId=state.activeProfileId,date=new Date().toISOString().slice(0,10)) {
    const configured=(state.profiles||[]).find(p=>p.id===profileId)?.homeCountryCodes||[];
    // Older accounts recorded their home as a residence, without permanent-home settings.
    return [...new Set([...configured,...(!configured.length?scoped(state.residences,profileId).filter(r=>r.start<=date&&(!r.end||r.end>=date)).map(r=>r.countryCode):[])])];
  }
  function transportLabel(record,lookup=()=>null) {
    if(record.type!=='flight')return `${record.start?.name||''} → ${record.end?.name||''}`;
    const label=p=>p?.iata||lookup(p?.name||'')?.iata||String(p?.name||'').match(/\(([A-Z]{3})\)$/)?.[1]||p?.icao||p?.name||'';
    return `${label(record.start)}-${label(record.end)}`+(record.via?.length?` via ${record.via.map(label).join(', ')}`:'');
  }
  function memories(state,today,profileId=state.activeProfileId) {
    const year=Number(today.slice(0,4)),suffix=today.slice(4);
    const records=[...scoped(state.stays,profileId).filter(isActual),...scoped(state.residences,profileId),...scoped(state.placeVisits,profileId).filter(v=>v.category==='locations'&&v.status==='visited').map(v=>({...v,...v.place,start:v.date,end:v.endDate||v.date,location:v.place?.name}))];
    const homeCodes=new Set(homeCountryCodes(state,profileId,today));
    const eligible=records.filter(r=>r.countryCode&&r.countryCode!=='SEA'&&!homeCodes.has(r.countryCode)&&validDate(r.start));
    const first=Math.min(year,...eligible.map(r=>Number(r.start.slice(0,4)))),result=[];
    for(let y=year-1;y>=first;y--){const date=y+suffix;if(!validDate(date))continue;
      const seen=new Map();
      for(const r of eligible){if(r.start>date||(r.end&&r.end<date))continue;
        // Permanent home settings apply even to linked trips and plotted places.
        const ownerHomes=homeCountryCodes(state,r.profileId||profileId,today);
        if(ownerHomes.includes(r.countryCode)||(!ownerHomes.length&&homeCountryCodes(state,r.profileId||profileId,date).includes(r.countryCode)))continue;
        const country=r.countryName||r.countryCode,label=r.location||'';
        const name=label&&label.toLowerCase()!==country.toLowerCase()?label+', '+country:country;
        seen.set(r.countryCode+'|'+label.toLowerCase(),{code:r.countryCode,name});
      }
      if(seen.size)result.push({year:y,places:[...seen.values()]});
    }
    return result;
  }
  const isActual = s => s?.status === 'actual' || s?.status === undefined;
  const countsForPlanning = s => isActual(s) || s?.status === 'planned';
  function reviewPlanned(stays,today) {
    let changed=false;
    for(const stay of stays || []) {
      // A plan becomes completed only once its final calendar day has passed.
      // This leaves active journeys editable as planned and avoids inventing a
      // partial completed trip while the traveller is still away.
      const finished=(stay.end||stay.start)<today;
      if(stay.status==='planned'&&finished){stay.status='actual';delete stay.plannedReviewStart;changed=true;}
      // Earlier versions created a manual-review state. Retire it safely so
      // existing records follow the new automatic-completion behaviour.
      if(stay.status==='unconfirmed'){
        stay.status=finished?'actual':'planned';
        delete stay.plannedReviewStart;
        changed=true;
      }
    }
    return changed;
  }
  function reviewTransport(transports,today) {
    let changed=false;
    for(const transport of transports || []) if(transport.status==='planned') {
      // Use the later local calendar date so date-line journeys cannot be
      // marked complete before both their departure and arrival dates pass.
      const finalDate=[transport.startLocal,transport.endLocal].map(value=>value?.slice(0,10)).filter(validDate).sort().at(-1);
      if(finalDate&&finalDate<today){transport.status='actual';changed=true;}
    }
    return changed;
  }
  function dayStatus(state,date,profileId=state.activeProfileId) {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=date&&s.end>=date);
    const home=stays.some(s=>isHome(state,s.countryCode,date,profileId));
    const travel=stays.some(s=>!isHome(state,s.countryCode,date,profileId));
    return travel ? (home?'mixed':'travel') : home||(state.profiles||[]).find(p=>p.id===profileId)?.homeCountryCodes?.length?'home':'unrecorded';
  }
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  const validLocal = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s||'') && validDate(s.slice(0,10)) && Number(s.slice(11,13))<24 && Number(s.slice(14,16))<60;
  function validateTransport(r) {
    if(!Object.hasOwn(types,r.type)) return 'Choose a transport type.';
    if(!validLocal(r.startLocal)||!validLocal(r.endLocal)) return 'Enter valid departure and arrival dates and local times.';
    if(!r.start?.name?.trim()||!r.end?.name?.trim()) return 'Enter both locations.';
    // Local clocks cannot be ordered across time zones, including date-line crossings.
    for(const point of [r.start,r.end]) {
      const hasLat=point.lat!==null&&point.lat!==undefined,hasLon=point.lon!==null&&point.lon!==undefined;
      if(hasLat!==hasLon) return 'Provide both latitude and longitude, or leave both blank.';
      if(hasLat&&(!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon)||Math.abs(point.lon)>180)) return 'Coordinates must be valid latitude (−90 to 90) and longitude (−180 to 180).';
    }
    return '';
  }
  function visits(state,category,today,profileId=state.activeProfileId) {
    const result=new Set(scoped(state.placeVisits,profileId).filter(v=>v.category===category&&(!v.status||v.status==='visited')&&v.date<=today).map(v=>v.itemId));
    if(category==='airports') visibleTransport(state,profileId).filter(t=>t.type==='flight'&&isActual(t)).forEach(t=>{
      if(t.startLocal?.slice(0,10)<=today&&t.start?.airportId)result.add(t.start.airportId);
      if(t.endLocal?.slice(0,10)<=today&&t.end?.airportId)result.add(t.end.airportId);
    });
    for(const visit of scoped(state.placeVisits,profileId))if(visit.category===category&&visit.status&&visit.status!=='visited')result.delete(visit.itemId);
    return result;
  }
  const api={categories,types,scoped,summary,tripForDates,memories,homeCountryCodes,transportLabel,visibleTransport,isActual,countsForPlanning,reviewPlanned,reviewTransport,isHome,dayStatus,validDate,validLocal,validateTransport,visits,routeColor:type=>({flight:'#66DCE3',train:'#b99aff',bus:'#f3b64c',boat:'#5db8ff',car:'#74F94B',other:'#ee9bd1'}[type]||'#ee9bd1')};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVJourney=api;
})(typeof window!=='undefined'?window:globalThis);

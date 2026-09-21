/* Pure, additive travel data rules. No storage or network side effects. */
(function(root) {
  'use strict';
  const categories = {buildings:'Tallest buildings', mountains:'Highest natural points', unesco:'UNESCO sites', airports:'Airports'};
  const types = {flight:'Flight',train:'Train',bus:'Bus',boat:'Boat',car:'Car',other:'Other'};
  const scoped = (rows,profileId) => (rows || []).filter(r => profileId === 'all' || !r.profileId || r.profileId === profileId || r.profileIds?.includes(profileId));
  const visibleTransport = (state,profileId=state.activeProfileId) => scoped(state.transports,profileId).filter(t => t.status !== 'cancelled' && !(state.trips||[]).some(trip=>trip.id===t.tripId&&trip.status==='cancelled'));
  const summary = (state,today,profileId=state.activeProfileId) => {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=today),countries=new Set(),days=new Set(),home=new Set(),trips=new Set();
    for(const stay of stays){countries.add(stay.countryCode);trips.add(stay.tripId||'stay:'+stay.id);for(let ms=Date.parse(stay.start),last=Math.min(Date.parse(stay.end),Date.parse(today));ms<=last;ms+=86400000){const date=new Date(ms).toISOString().slice(0,10);const owner=stay.profileId||state.activeProfileId;((profileId==='all'&&!stay.profileId?state.profiles.every(p=>isHome(state,stay.countryCode,date,p.id)):isHome(state,stay.countryCode,date,owner))?home:days).add(date);}}
    countries.delete('SEA');for(const date of days)home.delete(date);
    return {stays,countries,days,home,trips};
  };
  function isHome(state,code,date,profileId=state.activeProfileId) {
    if(code==='SEA') return false;
    return (state.profiles.find(p=>p.id===profileId)?.homeCountryCodes || []).includes(code) || scoped(state.residences,profileId).some(r=>r.countryCode===code&&r.start<=date&&(!r.end||r.end>=date));
  }
  const isActual = s => s?.status === 'actual' || s?.status === undefined;
  const countsForPlanning = s => isActual(s) || s?.status === 'planned';
  function reviewPlanned(stays,today) {
    let changed=false;
    for(const stay of stays) if(stay.status==='planned'&&stay.start<today&&stay.plannedReviewStart!==stay.start) {stay.status='unconfirmed';changed=true;}
    return changed;
  }
  function dayStatus(state,date,profileId=state.activeProfileId) {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=date&&s.end>=date);
    const home=stays.some(s=>isHome(state,s.countryCode,date,profileId));
    const travel=stays.some(s=>!isHome(state,s.countryCode,date,profileId));
    return travel ? (home?'mixed':'travel') : home?'home':'unrecorded';
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
  const api={categories,types,scoped,summary,visibleTransport,isActual,countsForPlanning,reviewPlanned,isHome,dayStatus,validDate,validLocal,validateTransport,visits,routeColor:type=>({flight:'#66DCE3',train:'#b99aff',bus:'#f3b64c',boat:'#5db8ff',car:'#74F94B',other:'#ee9bd1'}[type]||'#ee9bd1')};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVJourney=api;
})(typeof window!=='undefined'?window:globalThis);

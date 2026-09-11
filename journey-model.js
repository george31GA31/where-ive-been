/* Pure, additive travel data rules. No storage or network side effects. */
(function(root) {
  'use strict';
  const categories = {buildings:'Tallest buildings', mountains:'Highest natural points', unesco:'UNESCO sites', airports:'Airports'};
  const types = {flight:'Flight',train:'Train',bus:'Bus',boat:'Boat',car:'Car',other:'Other'};
  const scoped = (rows,profileId) => (rows || []).filter(r => !r.profileId || r.profileId === profileId);
  function isHome(state,code,date,profileId=state.activeProfileId) {
    if(code==='SEA') return false;
    return (state.profiles.find(p=>p.id===profileId)?.homeCountryCodes || []).includes(code) || scoped(state.residences,profileId).some(r=>r.countryCode===code&&r.start<=date&&(!r.end||r.end>=date));
  }
  function dayStatus(state,date,profileId=state.activeProfileId) {
    const stays=scoped(state.stays,profileId).filter(s=>s.status!=='planned'&&s.start<=date&&s.end>=date);
    const home=stays.some(s=>isHome(state,s.countryCode,date,profileId));
    const travel=stays.some(s=>!isHome(state,s.countryCode,date,profileId));
    return travel ? (home?'mixed':'travel') : home?'home':'unrecorded';
  }
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  const validLocal = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s||'') && validDate(s.slice(0,10)) && Number(s.slice(11,13))<24 && Number(s.slice(14,16))<60;
  function validateTransport(r) {
    if(!r.type) return 'Choose a transport type.';
    if(!validLocal(r.startLocal)||!validLocal(r.endLocal)) return 'Enter valid departure and arrival dates and local times.';
    if(!r.start?.name?.trim()||!r.end?.name?.trim()) return 'Enter both locations.';
    if(r.type==='flight'&&!r.flightNumber?.trim()) return 'Enter the flight number.';
    // Local clocks cannot be ordered across time zones, including date-line crossings.
    for(const point of [r.start,r.end]) {
      const hasLat=point.lat!==null&&point.lat!==undefined,hasLon=point.lon!==null&&point.lon!==undefined;
      if(hasLat!==hasLon) return 'Provide both latitude and longitude, or leave both blank.';
      if(hasLat&&(!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon)||Math.abs(point.lon)>180)) return 'Coordinates must be valid latitude (−90 to 90) and longitude (−180 to 180).';
    }
    return '';
  }
  function visits(state,category,today,profileId=state.activeProfileId) {
    const result=new Set(scoped(state.placeVisits,profileId).filter(v=>v.category===category&&v.date<=today).map(v=>v.itemId));
    if(category==='airports') scoped(state.transports,profileId).filter(t=>t.type==='flight'&&t.status!=='planned').forEach(t=>{
      if(t.startLocal?.slice(0,10)<=today&&t.start?.airportId)result.add(t.start.airportId);
      if(t.endLocal?.slice(0,10)<=today&&t.end?.airportId)result.add(t.end.airportId);
    });
    return result;
  }
  const api={categories,types,scoped,isHome,dayStatus,validDate,validLocal,validateTransport,visits,routeColor:type=>type==='flight'?'#66DCE3':'#74F94B'};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVJourney=api;
})(typeof window!=='undefined'?window:globalThis);

/* Pure, additive travel data rules. No storage or network side effects. */
(function(root) {
  'use strict';
  const A=typeof module!=='undefined'&&module.exports?require('./address-display.js'):null;
  const V=typeof module!=='undefined'&&module.exports?require('./country-visit-model.js'):null;
  const roman=value=>(A||root.HVAddress)?.text(value)||value;
  const categories = {buildings:'Tallest buildings', mountains:'Highest natural points', unesco:'UNESCO sites', airports:'Airports'};
  const types = {flight:'Flight',train:'Train',bus:'Bus / coach',boat:'Boat / ferry',car:'Car / taxi',walk:'Walking',other:'Other'};
  const scoped = (rows,profileId) => (rows || []).filter(r => profileId === 'all' || !r.profileId || r.profileId === profileId || r.profileIds?.includes(profileId));
  const visibleTransport = (state,profileId=state.activeProfileId) => scoped(state.transports,profileId).filter(t => t.status !== 'cancelled' && !(state.trips||[]).some(trip=>trip.id===t.tripId&&trip.status==='cancelled'));
  const summary = (state,today,profileId=state.activeProfileId) => {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=today),countries=new Set(),days=new Set(),home=new Set(),trips=new Set();
    for(const stay of stays){for(let ms=Date.parse(stay.start),last=Math.min(Date.parse(stay.end),Date.parse(today));ms<=last;ms+=86400000){const date=new Date(ms).toISOString().slice(0,10);const owner=stay.profileId||profileId;const atHome=!isTravelStay(state,stay,date,owner);(atHome?home:days).add(date);if(!atHome){if(!homeCountryCodes(state,owner,today).includes(stay.countryCode))countries.add(stay.countryCode);trips.add(stay.tripId||'stay:'+stay.id);}}}
    for(const p of (profileId==='all'?state.profiles:[{id:profileId}]))homeCountryCodes(state,p.id,today).forEach(c=>countries.add(c));
    for(const code of (V||root.HVCountryVisits)?.manualCodes(state,today,profileId)||[]) countries.add(code);
    countries.delete('SEA');for(const date of days)home.delete(date);
    return {stays,countries,days,home,trips};
  };
  function isHome(state,code,date,profileId=state.activeProfileId) {
    if(code==='SEA') return false;
    return (state.profiles.find(p=>p.id===profileId)?.homeCountryCodes || []).includes(code) || scoped(state.residences,profileId).some(r=>r.countryCode===code&&r.start<=date&&(!r.end||r.end>=date));
  }
  function homeKind(state,r,date=r.start||r.date,profileId=r.profileId||state.activeProfileId){
    if(r.travelKind==='home')return 'home';
    if(r.travelKind==='trip')return 'trip';
    if(r.travelKind==='foreign')return isHome(state,r.countryCode||r.place?.countryCode,date,profileId)?'trip':'foreign';
    if(r.isHome===true||r.home===true||r.location==='Home')return 'home';
    if(r.domesticHoliday===true)return 'trip';
    if(!isHome(state,r.countryCode||r.place?.countryCode,date,profileId))return 'foreign';
    if(r.tripId&&(state.trips||[]).some(t=>t.id===r.tripId))return 'trip';
    // A domestic hotel/transport is evidence only for its recorded dates. It
    // must not turn the surrounding unclassified home interval into a trip.
    const evidence=[...scoped(state.accommodations,profileId),...scoped(state.transports,profileId)].some(a=>{
      const start=a.checkIn||a.startLocal?.slice(0,10),end=a.checkOut||a.endLocal?.slice(0,10)||start;
      return !(state.stays||[]).some(s=>s.source==='accommodation'&&s.sourceAccommodationId===a.id&&s.id!==r.id)&&a.status!=='cancelled'&&a.travelKind!=='home'&&validDate(date)&&start<=date&&end>=date&&((r.tripId&&a.tripId===r.tripId)||(a.place?.countryCode===r.countryCode||a.start?.countryCode===r.countryCode||a.end?.countryCode===r.countryCode));
    });
    return evidence?'trip':'ambiguous';
  }
  // New/edited domestic hotels get a country record with explicit, authoritative
  // dates. Only records carrying our provenance are ever updated or removed.
  function removeAccommodationStay(state,id){
    state.stays=(state.stays||[]).filter(s=>!(s.source==='accommodation'&&s.sourceAccommodationId===id));
  }
  function syncAccommodationStay(state,a,today=new Date().toISOString().slice(0,10)){
    if(!a?.id)return;
    const country=a.place?.countryCode,owner=a.profileId||state.activeProfileId;
    const previous=(state.stays||[]).find(s=>s.source==='accommodation'&&s.sourceAccommodationId===a.id);
    if(a.travelKind!=='trip'||!country||!isHome(state,country,a.checkIn,owner)||!validDate(a.checkIn)||!validDate(a.checkOut)||a.checkOut<a.checkIn||a.status==='cancelled'){
      if(previous)removeAccommodationStay(state,a.id);return;
    }
    const explicit=scoped(state.stays,owner).some(s=>s!==previous&&s.status!=='cancelled'&&s.countryCode===country&&!s.sourceAccommodationId&&isDomesticHoliday(s)&&s.start<=a.checkIn&&s.end>=a.checkOut);
    if(explicit){if(previous)removeAccommodationStay(state,a.id);return;}
    const record={...previous,id:previous?.id||'accommodation-stay:'+a.id,source:'accommodation',sourceAccommodationId:a.id,profileId:a.profileId??null,tripId:a.tripId||null,countryCode:country,countryName:a.place.countryName||country,location:a.location||a.propertyName,start:a.checkIn,end:a.checkOut,travelKind:'trip',domesticHoliday:true,status:a.checkOut<today?'actual':'planned',notes:previous?.notes||'',schengenExempt:previous?.schengenExempt||false};
    state.stays||=[];if(previous)Object.assign(previous,record);else state.stays.push(record);
  }
  function isTravelStay(state,r,date=r.start,profileId=r.profileId||state.activeProfileId){return !['home','ambiguous'].includes(homeKind(state,r,date,profileId));}
  function hiddenHomeRecord(state,r){
    if(r.travelKind==='home')return true;
    if(['trip','foreign'].includes(r.travelKind)||r.domesticHoliday===true)return false;
    const date=r.checkIn||r.date||r.startLocal?.slice(0,10),end=r.checkOut||r.endDate||r.endLocal?.slice(0,10)||date;
    const countryCodes=[r.place?.countryCode,r.start?.countryCode,r.end?.countryCode,...(r.legs||[]).flatMap(l=>[l.start?.countryCode,l.end?.countryCode])].filter(Boolean);
    if(countryCodes.some(code=>!isHome(state,code,date,r.profileId||state.activeProfileId)))return false;
    const own=scoped(state.stays,r.profileId||state.activeProfileId).filter(s=>s.status!=='cancelled'&&s.start<=date&&s.end>=end&&(!r.tripId||s.tripId===r.tripId));
    return own.some(s=>homeKind(state,s)==='home')&&!own.some(s=>isTravelStay(state,s));
  }
  function travelFrequency(state,today,profileId=state.activeProfileId){
    const dates=new Set();for(const s of scoped([...(state.stays||[]),...(state.residences||[])],profileId).filter(isActual)){
      const owner=s.profileId||profileId;
      if(s.countryCode==='SEA'||!validDate(s.start)||homeCountryCodes(state,owner,today).includes(s.countryCode)||homeKind(state,s,s.start,owner)==='home')continue;
      for(let n=Date.parse(s.start),end=Math.min(Date.parse(s.end||today),Date.parse(today));n<=end;n+=86400000)dates.add(new Date(n).toISOString().slice(0,10));
    }
    const weekdays=Array(7).fill(0),anniversaries=new Map();for(const d of dates){weekdays[new Date(d).getUTCDay()]++;const key=d.slice(5);if(!anniversaries.has(key))anniversaries.set(key,new Set());anniversaries.get(key).add(d.slice(0,4));}
    const weekdayMax=Math.max(...weekdays),yearMax=Math.max(0,...[...anniversaries.values()].map(x=>x.size));
    return {days:dates.size,weekdayMax,weekdays:weekdays.flatMap((n,i)=>n&&n===weekdayMax?[i]:[]),yearMax,dates:[...anniversaries].filter(([,v])=>v.size===yearMax).map(([k])=>k).sort()};
  }
  // Association is derived from existing dates only; never extend or create a trip.
  function tripForDates(state,start,end=start,profileId=state.activeProfileId,record=null) {
    const candidates=scoped(state.trips,profileId).filter(t=>{
      if(t.status==='cancelled'||(record&&t.excludedRecordIds?.[record.collection]?.includes(record.id)))return false;
      const dates=[t.start,t.end,...scoped(state.stays,profileId).filter(s=>s.tripId===t.id&&s.status!=='cancelled').flatMap(s=>[s.start,s.end]),...scoped(state.transports,profileId).filter(r=>r.tripId===t.id&&r.status!=='cancelled').flatMap(r=>transportDates(r)),...scoped(state.accommodations,profileId).filter(a=>a.tripId===t.id&&a.status!=='cancelled').flatMap(a=>[a.checkIn,a.checkOut]),...scoped(state.placeVisits,profileId).filter(v=>v.tripId===t.id&&v.status!=='not-recorded').flatMap(v=>[v.date,v.endDate||v.date])].filter(validDate).sort();
      return dates.length&&dates[0]<=start&&dates.at(-1)>=end;
    });
    return candidates.length===1?candidates[0].id:null;
  }
  function homeCountryCodes(state,profileId=state.activeProfileId,date=new Date().toISOString().slice(0,10)) {
    const configured=(state.profiles||[]).find(p=>p.id===profileId)?.homeCountryCodes||[];
    // Older accounts recorded their home as a residence, without permanent-home settings.
    return [...new Set([...configured,...(!configured.length?scoped(state.residences,profileId).filter(r=>r.start<=date&&(!r.end||r.end>=date)).map(r=>r.countryCode):[])])];
  }
  const domesticDestinations = [
    {code:'GB',name:'England',domesticDestination:'GB-ENG'},
    {code:'GB',name:'Scotland',domesticDestination:'GB-SCT'},
    {code:'GB',name:'Wales',domesticDestination:'GB-WLS'},
    {code:'GB',name:'Northern Ireland',domesticDestination:'GB-NIR'}
  ];
  const isDomesticHoliday = r => r?.travelKind!=='home' && (r?.travelKind==='trip'||r?.domesticHoliday===true);
  const domesticFields = c => ({domesticDestination:c?.domesticDestination||null,domesticHoliday:!!c?.domesticDestination});
  function flightLegs(record) {
    if(record.legs?.length)return record.legs.map(l=>({...l,start:{...l.start},end:{...l.end}}));
    const points=[record.start,...(record.via||[]),record.end];
    return points.slice(1).map((end,i)=>({start:{...points[i]},end:{...end},startLocal:i===0?record.startLocal:'',endLocal:i===points.length-2?record.endLocal:'',flightNumber:points.length===2?record.flightNumber||'':'',airline:points.length===2?record.airline||null:null}));
  }
  const airportLabel=(p,lookup=()=>null)=>p?.manualAirport?(p.iata||p.icao||p.name||''):p?.iata||(p?.name?.trim()?lookup(p.name)?.iata:'')||String(p?.name||'').match(/\(([A-Z]{3})\)$/)?.[1]||p?.icao||p?.name||'';
  function airportDetails(p,lookup=()=>null){
    if(!p)return '';const key=p.iata||p.icao||p.name||'';if(!key.trim())return '';const found=lookup(key)||{},a={...found,...p,name:p.manualAirport||p.personal?p.name:found.name||p.name};
    const country=a.countryName||((typeof Intl.DisplayNames==='function'&&(a.countryCode||a.countryCodes?.[0]))?new Intl.DisplayNames(['en'],{type:'region'}).of(a.countryCode||a.countryCodes[0]):'');
    return roman([...new Set([a.name,a.city||a.area,country].filter(Boolean))].join(', '))+(a.iata||a.icao?' ('+[a.iata,a.icao].filter(Boolean).join(' / ')+')':'');
  }
  function transportLabel(record,lookup=()=>null) {
    if(record.type!=='flight')return [record.start,...(record.via||[]),record.end].map(p=>roman(p?.name||'')).join(' → ');
    const legs=flightLegs(record),parts=[];
    legs.forEach((leg,i)=>{const start=airportLabel(leg.start,lookup),end=airportLabel(leg.end,lookup);if(!i||parts.at(-1)!==start)parts.push(start);parts.push(end);});
    return roman(parts.join(' → '));
  }
  function groundLegs(record){
    const points=[record.start,...(record.via||[]),record.end];
    if(record.dateOnly&&Array.isArray(record.roadLegDates))return points.slice(1).map((end,i)=>({start:{...points[i]},end:{...end},startLocal:record.roadLegDates[i]?.startLocal||record.startLocal,endLocal:record.roadLegDates[i]?.endLocal||record.endLocal,operator:record.operator||'',serviceNumber:record.serviceNumber||''}));
    return points.slice(1).map((end,i)=>({start:{...points[i]},end:{...end},startLocal:i===0?record.startLocal:points[i]?.departureLocal||'',endLocal:i===points.length-2?record.endLocal:end?.arrivalLocal||'',operator:points[i]?.operator||record.operator||'',serviceNumber:points[i]?.serviceNumber||record.serviceNumber||''}));
  }
  function transportDates(record){
    const dates=[record.startLocal,record.endLocal,...(record.legs||[]).flatMap(l=>[l.startLocal,l.endLocal]),...(record.via||[]).flatMap(p=>[p.arrivalLocal,p.departureLocal])].filter(Boolean).map(d=>d.slice(0,10)).filter(validDate).sort();
    if(!dates.length)return [];const result=[];
    for(let ms=Date.parse(dates[0]),last=Date.parse(dates.at(-1));ms<=last;ms+=86400000)result.push(new Date(ms).toISOString().slice(0,10));
    return result;
  }
  function memories(state,today,profileId=state.activeProfileId) {
    const year=Number(today.slice(0,4)),suffix=today.slice(4);
    const records=[...scoped(state.stays,profileId).filter(isActual),...scoped(state.residences,profileId).map(r=>({...r,memoryResidence:true})),...scoped(state.placeVisits,profileId).filter(v=>v.category==='locations'&&v.status==='visited').map(v=>({...v,...v.place,start:v.date,end:v.endDate||v.date,location:v.place?.name}))];
    const homeCodes=new Set(homeCountryCodes(state,profileId,today));
    const eligible=records.filter(r=>r.countryCode&&r.countryCode!=='SEA'&&(!homeCodes.has(r.countryCode)||isTravelStay(state,r,r.start))&&validDate(r.start));
    const first=Math.min(year,...eligible.map(r=>Number(r.start.slice(0,4)))),result=[];
    for(let y=year-1;y>=first;y--){const date=y+suffix;if(!validDate(date))continue;
      const seen=new Map();
      for(const r of eligible){if(r.start>date||(r.end&&r.end<date))continue;
        // Permanent home settings apply even to linked trips and plotted places.
        const ownerHomes=homeCountryCodes(state,r.profileId||profileId,today);
        if((r.memoryResidence&&ownerHomes.includes(r.countryCode))||homeKind(state,r,date,r.profileId||profileId)==='home'||(ownerHomes.includes(r.countryCode)&&homeKind(state,r,date)!=='trip')||(!ownerHomes.length&&isHome(state,r.countryCode,date,r.profileId||profileId)&&homeKind(state,r,date)!=='trip'))continue;
        const country=r.countryName||r.countryCode,label=r.location||'';
        const name=label&&label.toLowerCase()!==country.toLowerCase()?label+', '+country:country;
        seen.set((r.domesticDestination||r.countryCode)+'|'+label.toLowerCase(),{code:r.countryCode,...(r.domesticDestination?{flagCode:r.domesticDestination}:{}),name});
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
      const finalDate=transportDates(transport).filter(validDate).sort().at(-1);
      if(finalDate&&finalDate<today){transport.status='actual';changed=true;}
    }
    return changed;
  }
  function dayStatus(state,date,profileId=state.activeProfileId) {
    const stays=scoped(state.stays,profileId).filter(s=>isActual(s)&&s.start<=date&&s.end>=date);
    const home=stays.some(s=>!isTravelStay(state,s,date,s.profileId||profileId));
    const planned=scoped(state.stays,profileId).filter(s=>countsForPlanning(s)&&s.start<=date&&s.end>=date);
    const places=scoped([...(state.accommodations||[]),...(state.placeVisits||[])],profileId).filter(r=>!hiddenHomeRecord(state,r)&&r.status!=='not-recorded'&&r.status!=='cancelled'&&(r.checkIn||r.date)<=date&&(r.checkOut||r.endDate||r.date)>=date);
    const travel=places.some(r=>homeKind(state,r,date,r.profileId||profileId)==='trip'||(r.place?.countryCode&&!isHome(state,r.place.countryCode,date,r.profileId||profileId)))||planned.some(s=>isTravelStay(state,s,date,s.profileId||profileId))||visibleTransport(state,profileId).some(t=>!hiddenHomeRecord(state,t)&&transportDates(t).includes(date));
    return travel ? (home?'mixed':'travel') : home||homeCountryCodes(state,profileId,date).length?'home':'unrecorded';
  }
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  const validLocal = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s||'') && validDate(s.slice(0,10)) && Number(s.slice(11,13))<24 && Number(s.slice(14,16))<60;
  function validateTransport(r) {
    if(!Object.hasOwn(types,r.type)) return 'Choose a transport type.';
    if(!(r.dateOnly&&r.roadTripId?validDate(r.startLocal)&&validDate(r.endLocal):validLocal(r.startLocal)&&validLocal(r.endLocal))) return 'Enter valid departure and arrival dates and local times.';
    if(!r.start?.name?.trim()||!r.end?.name?.trim()) return 'Enter both locations.';
    // Local clocks cannot be ordered across time zones, including date-line crossings.
    for(const point of [r.start,...(r.via||[]),r.end]) {
      const hasLat=point.lat!==null&&point.lat!==undefined,hasLon=point.lon!==null&&point.lon!==undefined;
      if(hasLat!==hasLon) return 'Provide both latitude and longitude, or leave both blank.';
      if(hasLat&&(!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon)||Math.abs(point.lon)>180)) return 'Coordinates must be valid latitude (−90 to 90) and longitude (−180 to 180).';
    }
    return '';
  }
  function visits(state,category,today,profileId=state.activeProfileId) {
    const result=new Set(scoped(state.placeVisits,profileId).filter(v=>v.category===category&&(!v.status||v.status==='visited')&&v.date<=today).map(v=>v.itemId));
    if(category==='airports') visibleTransport(state,profileId).filter(t=>t.type==='flight'&&isActual(t)).forEach(t=>{
      for(const leg of flightLegs(t)){if(leg.startLocal?.slice(0,10)<=today&&leg.start?.airportId)result.add(leg.start.airportId);if(leg.endLocal?.slice(0,10)<=today&&leg.end?.airportId)result.add(leg.end.airportId);}
    });
    for(const visit of scoped(state.placeVisits,profileId))if(visit.category===category&&visit.status&&visit.status!=='visited')result.delete(visit.itemId);
    return result;
  }
  const api={syncAccommodationStay,removeAccommodationStay,airportDetails,homeKind,isTravelStay,hiddenHomeRecord,travelFrequency,domesticDestinations,isDomesticHoliday,domesticFields,flightLegs,groundLegs,airportLabel,transportDates,categories,types,scoped,summary,tripForDates,memories,homeCountryCodes,transportLabel,visibleTransport,isActual,countsForPlanning,reviewPlanned,reviewTransport,isHome,dayStatus,validDate,validLocal,validateTransport,visits,routeColor:type=>({flight:'#006768',bus:'#076800',boat:'#001B68',car:'#680000',train:'#685600',walk:'#535353',other:'#5C004C'}[type]||'#5C004C')};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVJourney=api;
})(typeof window!=='undefined'?window:globalThis);

/* Saved road routes share Herald's transport and route-persistence architecture. */
(function(root){
  'use strict';
  const R=typeof module!=='undefined'&&module.exports?require('./route-persistence'):root.HVRouteStore;
  const J=typeof module!=='undefined'&&module.exports?require('./journey-model'):root.HVJourney;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const numeric=value=>value!==''&&value!=null&&typeof value!=='boolean'&&Number.isFinite(Number(value));
  const positioned=stop=>numeric(stop?.lat)&&numeric(stop?.lon)&&Math.abs(Number(stop.lat))<=90&&Math.abs(Number(stop.lon))<=180;
  function signature(stops){return JSON.stringify(['road-v1',stops.map(p=>[String(p.name||''),String(p.address||''),Number(p.lat),Number(p.lon)])]);}
  function hasRoute(road){return road.route?.signature===signature(road.stops)&&road.route.legs?.length===road.stops.length-1&&road.route.legs.every(l=>R.validCoordinates(coordinates(l)));}
  function coordinates(leg){try{const coords=leg.coordinates||R.decode(leg.polyline||'');return R.validCoordinates(coords)&&coords.every(p=>Math.abs(Number(p[0]))<=90&&Math.abs(Number(p[1]))<=180)?coords:[];}catch{return[];}}
  function totals(road){const legs=hasRoute(road)?road.route.legs:[];return{distance:legs.length&&legs.every(l=>numeric(l.distance)&&l.distance>=0)?legs.reduce((n,l)=>n+Number(l.distance),0):null,duration:legs.length&&legs.every(l=>numeric(l.duration)&&l.duration>=0)?legs.reduce((n,l)=>n+Number(l.duration),0):null};}
  function validate(road,today=new Date().toISOString().slice(0,10)){
    if(!road.name?.trim())return'Give this road trip a name.';
    if(!Array.isArray(road.stops)||road.stops.length<2||road.stops.some(p=>!p.name?.trim()))return'Add a starting location and destination, and name every stop.';
    if(road.startDate||road.endDate){if(!J.validDate(road.startDate)||!J.validDate(road.endDate)||road.endDate<road.startDate)return'Enter a valid start and end date, in order.';}
    let previous=road.startDate||'';
    for(const stop of road.stops){if(!stop.date)continue;if(!J.validDate(stop.date)||stop.date<previous||road.endDate&&stop.date>road.endDate)return'Stop dates must be in order and inside the journey dates.';previous=stop.date;}
    if(!['idea','planned','actual'].includes(road.status))return'Choose whether this is an idea or a genuine journey.';
    if(road.status!=='idea'){
      if(!road.startDate||!road.endDate)return'Add dates before adding a genuine journey to Herald.';
      if(road.status==='actual'&&road.endDate>today)return'A completed journey cannot end in the future. Choose a planned trip.';
      if(road.status==='planned'&&road.endDate<today)return'These dates are in the past. Choose a completed journey.';
      if(road.stops.some(p=>!positioned(p))||!hasRoute(road))return'Calculate the complete road route before adding it to Herald.';
    }
    return'';
  }
  function legDates(road,index){const a=road.stops[index],b=road.stops[index+1];return{startLocal:a.date||road.startDate||'',endLocal:b.date||road.endDate||''};}
  function estimate(road){const distance=totals(road).distance,e=road.estimator||{},efficiency=Number(e.efficiency),price=Number(e.price);if(distance==null||!numeric(e.efficiency)||efficiency<=0)return null;const use=distance/100000*efficiency;return{use,unit:e.mode==='ev'?'kWh':'L',cost:numeric(e.price)&&price>=0?use*price:null,currency:e.currency||'GBP'};}
  function unlink(state,road){
    // Only planner-created transport is removed. Other Herald records are kept.
    state.transports=state.transports.filter(t=>!(t.id===road.linkedTransportId&&t.roadTripId===road.id));
    road.linkedTransportId=null;
    const trip=state.trips.find(t=>t.id===road.tripId),note=(state.notes||[]).find(n=>n.id===road.notesId);
    if(note){note.relatedType=null;note.relatedId=null;}
    const used=['stays','transports','accommodations','placeVisits','checklists','budgets','expenses'].some(key=>(state[key]||[]).some(r=>r.tripId===trip?.id))||(state.notes||[]).some(n=>n.tripId===trip?.id&&n.id!==road.notesId);
    if(trip?.createdByRoadTrip===road.id&&!used&&!trip.notes&&!trip.photos?.length){state.trips=state.trips.filter(t=>t.id!==trip.id);road.tripId=null;if(note)note.tripId=null;}
  }
  function link(state,road,{id=()=>root.crypto.randomUUID()}={}){
    if(road.status==='idea'){unlink(state,road);return null;}
    let trip=(state.trips||[]).find(t=>t.id===road.tripId);
    if(!trip){trip={id:id(),name:road.name,profileId:road.profileId,start:road.startDate,end:road.endDate,notes:'',createdByRoadTrip:road.id};state.trips.push(trip);road.tripId=trip.id;}
    if(trip.createdByRoadTrip===road.id){trip.name=road.name;trip.start=road.startDate;trip.end=road.endDate;}
    const old=state.transports.find(t=>t.id===road.linkedTransportId&&t.roadTripId===road.id),points=road.stops.map(p=>({...copy(p),arrivalLocal:p.date||'',departureLocal:p.date||''}));
    const t={...old,id:old?.id||id(),roadTripId:road.id,profileId:road.profileId,tripId:road.tripId,type:'car',status:road.status,travelKind:'trip',start:points[0],end:points.at(-1),via:points.slice(1,-1),startLocal:road.startDate,endLocal:road.endDate,dateOnly:true,roadLegDates:road.stops.slice(1).map((_,i)=>legDates(road,i)),notes:(state.notes||[]).find(n=>n.id===road.notesId)?.body||'',resolvedRoutes:{}};
    road.route.legs.forEach((l,i)=>R.set(t,i,'car',points[i],points[i+1],{...l,coordinates:coordinates(l)}));
    const at=state.transports.findIndex(r=>r.id===t.id);if(at<0)state.transports.push(t);else state.transports[at]=t;road.linkedTransportId=t.id;
    return t;
  }
  async function calculate(stops,{route,signal,onProgress=()=>{},previous}={}){
    if(stops.length<2||stops.some(p=>!positioned(p)))throw Error('Choose a search result or enter map coordinates for every stop.');
    const legs=[];
    // One shared, throttled route lookup per leg has no exposed waypoint limit.
    // Unchanged legs reuse their exact saved geometry after a stop is edited.
    for(let i=0;i<stops.length-1;i++){
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      const key=signature([stops[i],stops[i+1]]),saved=previous?.legs?.find(l=>l.stopSignature===key&&R.validCoordinates(coordinates(l)));
      const result=saved||await route('car',stops[i],stops[i+1],signal);
      const coords=coordinates(result);if(result.unavailable||!R.validCoordinates(coords))throw Error('No road route could be found for leg '+(i+1)+'. Your previously saved route is kept.');
      legs.push({...result,polyline:R.encode(coords),points:coords.length,stopSignature:key});delete legs.at(-1).coordinates;
      onProgress(i+1,stops.length-1);
    }
    return{signature:signature(stops),legs,calculatedAt:new Date().toISOString(),source:'FOSSGIS / OpenStreetMap'};
  }
  const api={positioned,signature,hasRoute,coordinates,totals,validate,legDates,estimate,link,unlink,calculate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRoadTrip=api;
})(typeof window!=='undefined'?window:globalThis);

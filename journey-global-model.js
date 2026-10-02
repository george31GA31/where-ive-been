/* Read-only projections: one row per existing flight leg, transport or plotted stay. */
(function(root){
  'use strict';
  const J=typeof module!=='undefined'&&module.exports?require('./journey-model.js'):root.HVJourney;
  const defaults={period:'all',flights:true,transport:true,accommodation:true,locations:true};
  function preferences(state){const saved=state.visualLayers?.journeys||{};return {...defaults,...saved,period:['all','past','upcoming'].includes(saved.period)?saved.period:'all'};}
  function rows(state){
    const active=r=>!J.hiddenHomeRecord(state,r)&&r.status!=='cancelled'&&!(state.trips||[]).some(t=>t.id===r.tripId&&t.status==='cancelled');
    const result=J.visibleTransport(state).filter(active).flatMap(record=>(record.type==='flight'?J.flightLegs(record):J.groundLegs(record)).map((leg,index)=>({key:`transport:${record.id}:${index}`,kind:record.type==='flight'?'flights':'transport',type:record.type,record,leg,index,start:(leg.startLocal||record.startLocal||'').slice(0,10),end:(leg.endLocal||(record.type==='flight'&&record.legs?.length?leg.startLocal:record.endLocal)||leg.startLocal||record.startLocal||'').slice(0,10)})));
    result.push(...J.scoped(state.accommodations,state.activeProfileId).filter(active).map(record=>({key:`accommodation:${record.id}`,kind:'accommodation',type:'accommodation',record,place:record.place||{name:record.propertyName,lat:record.lat,lon:record.lon},start:record.checkIn||'',end:record.checkOut||record.checkIn||''})));
    result.push(...J.scoped(state.placeVisits,state.activeProfileId).filter(r=>r.category==='locations'&&r.status!=='not-recorded'&&active(r)).map(record=>({key:`location:${record.id}`,kind:'locations',type:'location',record,place:record.place,start:record.date||'',end:record.endDate||record.date||''})));
    result.push(...J.scoped(state.stays,state.activeProfileId).filter(r=>active(r)&&J.isTravelStay(state,r)).map(record=>({key:`destination:${record.id}`,kind:'locations',type:'location',record,place:{...record.place,name:record.location||record.countryName,lat:record.place?.lat??record.lat,lon:record.place?.lon??record.lon},start:record.start,end:record.end,domestic:J.homeKind(state,record)==='trip',destination:true})));
    return result;
  }
  function intersects(row,range={}){
    const from=J.validDate(range.from)?range.from:'',to=J.validDate(range.to)?range.to:'';
    if(!from&&!to)return true;
    let start=J.validDate(row.start)?row.start:'',end=J.validDate(row.end)?row.end:'';
    if(!start&&!end)return false;start||=end;end||=start;
    // Local arrival dates can precede departure dates when crossing the date line.
    if(end<start)[start,end]=[end,start];
    return (!to||start<=to)&&(!from||end>=from);
  }
  function filter(rows,prefs,today,range={}){return rows.filter(r=>prefs[r.kind]!==false&&(prefs.period==='all'||(r.end||r.start)&&(prefs.period==='past'?[r.end,r.start].filter(Boolean).sort().at(-1)<today:[r.end,r.start].filter(Boolean).sort().at(-1)>=today))&&intersects(r,range));}
  const api={defaults,preferences,rows,filter,intersects};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVGlobalJourney=api;
})(typeof window!=='undefined'?window:globalThis);

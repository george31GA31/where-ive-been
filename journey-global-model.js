/* Read-only projections: one row per existing flight leg, transport or plotted stay. */
(function(root){
  'use strict';
  const J=typeof module!=='undefined'&&module.exports?require('./journey-model.js'):root.HVJourney;
  const defaults={period:'all',flights:true,transport:true,accommodation:true,locations:true};
  function preferences(state){const saved=state.visualLayers?.journeys||{};return {...defaults,...saved,period:['all','past','upcoming'].includes(saved.period)?saved.period:'all'};}
  function rows(state){
    const active=r=>!J.hiddenHomeRecord(state,r)&&r.status!=='cancelled'&&!(state.trips||[]).some(t=>t.id===r.tripId&&t.status==='cancelled');
    const result=J.visibleTransport(state).filter(active).flatMap(record=>(record.type==='flight'?J.flightLegs(record):[record]).map((leg,index)=>({key:`transport:${record.id}:${index}`,kind:record.type==='flight'?'flights':'transport',type:record.type,record,leg,index,start:(leg.startLocal||record.startLocal||'').slice(0,10),end:(leg.endLocal||leg.startLocal||record.endLocal||record.startLocal||'').slice(0,10)})));
    result.push(...J.scoped(state.accommodations,state.activeProfileId).filter(active).map(record=>({key:`accommodation:${record.id}`,kind:'accommodation',type:'accommodation',record,place:record.place||{name:record.propertyName,lat:record.lat,lon:record.lon},start:record.checkIn||'',end:record.checkOut||record.checkIn||''})));
    result.push(...J.scoped(state.placeVisits,state.activeProfileId).filter(r=>r.category==='locations'&&r.status!=='not-recorded'&&active(r)).map(record=>({key:`location:${record.id}`,kind:'locations',type:'location',record,place:record.place,start:record.date||'',end:record.endDate||record.date||''})));
    result.push(...J.scoped(state.stays,state.activeProfileId).filter(r=>active(r)&&J.homeKind(state,r)==='trip').map(record=>({key:`domestic:${record.id}`,kind:'locations',type:'location',record,place:{name:record.location||record.countryName},start:record.start,end:record.end,domestic:true})));
    return result;
  }
  function filter(rows,prefs,today){return rows.filter(r=>prefs[r.kind]!==false&&(prefs.period==='all'||r.end&&(prefs.period==='past'?r.end<today:r.end>=today)));}
  const api={defaults,preferences,rows,filter};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVGlobalJourney=api;
})(typeof window!=='undefined'?window:globalThis);

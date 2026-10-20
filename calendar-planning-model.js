/* Tentative payloads live outside every confirmed-travel collection. */
(function (root) {
  'use strict';
  const J = typeof module !== 'undefined' && module.exports ? require('./journey-model.js') : root.HVJourney;
  const collections = {country:'stays', accommodation:'accommodations', transport:'transports', note:'notes', location:'placeVisits'};
  const copy = value => JSON.parse(JSON.stringify(value));
  const date = value => String(value || '').slice(0,10);
  const offset = (from,to) => Math.round((Date.parse(to)-Date.parse(from))/86400000);
  function next(value, amount) {
    const result = new Date(Date.parse(date(value)) + amount*86400000).toISOString().slice(0,10);
    if (!J.validDate(result)) throw Error('Choose dates between 0001 and 9999.');
    return result + String(value).slice(10);
  }
  function range(kind, row) {
    if (kind === 'country') return [row.start,row.end || row.start];
    if (kind === 'accommodation') return [row.checkIn || row.checkOut,row.checkOut || row.checkIn];
    if (kind === 'transport') {
      const dates=[row.startLocal,row.endLocal,...(row.legs||[]).flatMap(leg=>[leg.startLocal,leg.endLocal]),...(row.via||[]).flatMap(point=>[point.arrivalLocal,point.departureLocal])].filter(Boolean).map(date).filter(J.validDate).sort();
      return [dates[0],dates.at(-1)];
    }
    return [row.date,row.endDate || row.date];
  }
  function validate(plan) {
    if (!plan || !Object.hasOwn(collections,plan.kind) || !plan.record || typeof plan.id !== 'string' || !plan.id || typeof plan.record.id !== 'string' || !plan.record.id) return 'This plan is incomplete.';
    const [start,end] = range(plan.kind,plan.record);
    if (!J.validDate(start) || !J.validDate(end) || end < start) return 'Choose a valid start and end date.';
    const row = plan.record;
    if (plan.kind === 'country' && (!row.countryCode || !row.countryName)) return 'Choose a country from the list.';
    if (plan.kind === 'accommodation' && (!row.propertyName?.trim() || !row.location?.trim())) return 'Add the property and its location.';
    if (plan.kind === 'transport') {
      if (!Object.hasOwn(J.types,row.type) || !row.start?.name?.trim() || !row.end?.name?.trim()) return 'Add a transport type, departure and destination.';
      if (!row.dateOnly && (!J.validLocal(row.startLocal) || !J.validLocal(row.endLocal))) return 'Add valid local departure and arrival times.';
      for (const leg of row.legs || []) {
        if (!J.validLocal(leg.startLocal) || !J.validLocal(leg.endLocal) || [leg.startLocal,leg.endLocal].some(value=>date(value)<start||date(value)>end)) return 'Keep all connecting legs within these dates, or edit the individual legs after confirming.';
      }
    }
    if (plan.kind === 'note' && !row.title?.trim()) return 'Give this note a title.';
    if (plan.kind === 'location' && !row.place?.name?.trim()) return 'Add a location name.';
    return '';
  }
  function reschedule(plan,start,end) {
    const changed = {...plan,record:{...plan.record},companions:(plan.companions||[]).map(item=>({...item,record:{...item.record}}))}, row = changed.record, [oldStart,oldEnd] = range(plan.kind, row);
    if(row.legs)row.legs=row.legs.map(leg=>({...leg}));
    if(row.via)row.via=row.via.map(point=>({...point}));
    if (!J.validDate(start) || !J.validDate(end) || end < start) throw Error('The end date must be on or after the start date.');
    const shift = offset(oldStart,start), sameDuration = offset(start,end) === offset(oldStart,oldEnd);
    if (plan.kind === 'transport') {
      const adjust=value=>!value?value:sameDuration?next(value,shift):(date(value)===oldStart?start:date(value)===oldEnd?end:date(value))+value.slice(10);
      for(const record of [row,...row.legs||[]])for(const key of ['startLocal','endLocal'])record[key]=adjust(record[key]);
      if(!sameDuration&&oldStart===oldEnd){row.startLocal=start+row.startLocal.slice(10);row.endLocal=end+row.endLocal.slice(10);if(row.legs?.length){row.legs[0].startLocal=row.startLocal;row.legs.at(-1).endLocal=row.endLocal;}}
      for(const point of row.via||[])for(const key of ['arrivalLocal','departureLocal'])if(point[key])point[key]=adjust(point[key]);
      const values=[row.startLocal,row.endLocal,...(row.legs||[]).flatMap(leg=>[leg.startLocal,leg.endLocal]),...(row.via||[]).flatMap(point=>[point.arrivalLocal,point.departureLocal])].filter(Boolean);
      if(values.some(value=>date(value)<start||date(value)>end))throw Error('Keep all connecting legs within these dates, or edit the individual legs after confirming.');
    } else if (plan.kind === 'country') {row.start=start;row.end=end;}
    else if (plan.kind === 'accommodation') {row.checkIn=start;row.checkOut=end;}
    else {row.date=start;if(end!==start || Object.hasOwn(row,'endDate'))row.endDate=end;}
    for (const companion of changed.companions || []) {
      if (companion.key==='stays') {companion.record.start=start;companion.record.end=end;}
    }
    const error = validate(changed); if (error) throw Error(error);
    return changed;
  }
  function move(plan, amount) {
    const [start,end] = range(plan.kind,plan.record);
    return reschedule(plan,next(start,amount),next(end,amount));
  }
  function visible(data,profileId=data.activeProfileId) {
    return (Array.isArray(data.calendarPlans)?data.calendarPlans:[]).filter(plan=>!validate(plan)&&J.scoped([plan.record],profileId).length>0);
  }
  function makeTentative(data,kind,id,planId) {
    const key=collections[kind], record=(data[key]||[]).find(row=>row.id===id);
    if (!record) throw Error('This entry is no longer available.');
    if (kind==='country' && record.source==='accommodation') throw Error('Make the linked accommodation tentative to keep its automatic country record together.');
    const plan={id:planId,kind,profileId:record.profileId??null,record:copy(record),companions:[]};
    const error=validate(plan);if(error)throw Error(error);
    if(kind==='accommodation') {
      plan.companions=(data.stays||[]).filter(row=>row.source==='accommodation'&&row.sourceAccommodationId===id).map(record=>({key:'stays',record:copy(record)}));
      data.stays=(data.stays||[]).filter(row=>!plan.companions.some(item=>item.record.id===row.id));
    }
    data[key]=data[key].filter(row=>row.id!==id);
    data.calendarPlans=[...(data.calendarPlans||[]),plan];
    return plan;
  }
  function confirm(data,id) {
    const plan=(data.calendarPlans||[]).find(row=>row.id===id);
    const error=validate(plan);if(error)throw Error(error);
    const key=collections[plan.kind];
    const additions=[{key,record:plan.record},...(plan.companions||[])];
    for(const item of additions) {
      if(!Object.values(collections).includes(item.key))throw Error('This linked record cannot be confirmed.');
      if((data[item.key]||[]).some(row=>row.id===item.record.id))throw Error('A confirmed entry already uses this ID. Duplicate the plan to keep both.');
    }
    for(const item of additions)data[item.key]=[...(data[item.key]||[]),copy(item.record)];
    data.calendarPlans=data.calendarPlans.filter(row=>row.id!==id);
    if(plan.kind==='accommodation'&&!plan.companions?.length)J.syncAccommodationStay(data,data[key].at(-1));
    return data[key].find(row=>row.id===plan.record.id);
  }
  // A display projection only. The shared Calendar window and account stay untouched.
  function projectWindow(data,window,show=true,profileId=data.activeProfileId) {
    const out=new Map([...window].map(([date,day])=>[date,{...day,stays:[...day.stays],accommodations:[...day.accommodations],transports:[...day.transports],notes:[...day.notes],places:[...day.places]}]));
    if(!show)return out;
    for(const plan of visible(data,profileId)) {
      const [start,end]=range(plan.kind,plan.record),key={country:'stays',accommodation:'accommodations',transport:'transports',note:'notes',location:'places'}[plan.kind];
      for(const [date,day] of out)if(date>=start&&date<=end)day[key].push(plan.record);
    }
    return out;
  }
  const api={collections,copy,range,validate,reschedule,move,visible,makeTentative,confirm,projectWindow,offset};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVCalendarPlanningModel=api;
})(typeof window!=='undefined'?window:globalThis);

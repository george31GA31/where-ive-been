/* Read-only transport views. Local endpoint times remain local endpoint times. */
(function(root) {
  'use strict';
  const J = typeof module !== 'undefined' && module.exports ? require('./journey-model.js') : root.HVJourney;
  const modes = {
    flight: {title:'My Flights', singular:'flight', plural:'flights'},
    train: {title:'My Trains', singular:'train journey', plural:'train journeys'},
    boat: {title:'My Ferries', singular:'ferry journey', plural:'ferry journeys'},
    bus: {title:'My Buses', singular:'bus journey', plural:'bus journeys'},
    car: {title:'My Cars', singular:'car journey', plural:'car journeys'}
  };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const mode = type => ({plane:'flight',air:'flight',rail:'train',ferry:'boat',ship:'boat',coach:'bus',taxi:'car',road:'car'}[norm(type)] || (modes[norm(type)] ? norm(type) : null));
  const zone = point => point?.timezone || point?.timeZone || '';
  // Date-only comparisons use a stable UTC reference when an endpoint zone is
  // unavailable. They never imply an exact departure or arrival instant.
  function dayAt(now, timeZone) {
    const formatter=J.timeFormatter(timeZone)||J.timeFormatter('UTC');
    const p=Object.fromEntries(formatter.formatToParts(new Date(now)).map(part=>[part.type,part.value]));
    return `${p.year.padStart(4,'0')}-${p.month}-${p.day}`;
  }
  function instant(local, timeZone, choice='') {
    const result=J.resolveLocalTime(local,timeZone,choice);
    return result.status==='known'?result.instant:null;
  }
  function period(row, now=Date.now()) {
    const value = row.leg.endLocal || row.leg.startLocal || row.record.endLocal || row.record.startLocal || '';
    const side=row.leg.endLocal?'end':row.leg.startLocal?'start':row.record.endLocal?'end':'start';
    const endpoint=(row.leg[side+'Local']?row.leg:row.record),timeZone=zone(endpoint[side]);
    const end = row.record.dateOnly?null:instant(value,timeZone,endpoint[side+'Disambiguation']);
    return end === null ? value.slice(0,10) && value.slice(0,10) < dayAt(now,timeZone) ? 'previous' : 'upcoming' : end < now ? 'previous' : 'upcoming';
  }
  function rows(data) {
    const cancelledTrips = new Set((data.trips || []).filter(t => t.status === 'cancelled').map(t => t.id));
    return J.scoped(data.transports || [], data.activeProfileId).filter(t => mode(t.type) && !cancelledTrips.has(t.tripId)).flatMap(record => {
      const type = mode(record.type);
      const legs = type === 'flight' ? J.flightLegs(record) : [{...record,start:{...record.start},end:{...record.end}}];
      return legs.map((leg,index) => ({key:`transport:${record.id}:${index}`,kind:type==='flight'?'flights':'transport',type,record,leg,index,start:(leg.startLocal||record.startLocal||'').slice(0,10),end:(leg.endLocal||leg.startLocal||record.endLocal||'').slice(0,10)}));
    });
  }
  function provider(row) {return row.type === 'flight' ? row.leg.airline || row.record.airline || null : row.leg.operator || row.record.operator || row.record.rentalCompany || null;}
  function providerName(value) {return typeof value === 'string' ? value : value?.name || '';}
  function filter(all, options={}, now=Date.now()) {
    const term=norm(options.search),type=options.mode==='all'?'all':mode(options.mode)||'flight',selected=options.period||'upcoming';
    return all.filter(row => (type==='all'||row.type===type) && period(row,now)===selected && (!options.year || [row.start,row.end].some(d=>d.slice(0,4)===options.year)) && (!options.operator || norm(providerName(provider(row)))===norm(options.operator)) && (!options.country || [row.leg.start,row.leg.end].some(p=>(p?.countryCode||p?.countryCodes?.[0])===options.country)) && (!term || norm([providerName(provider(row)),row.leg.flightNumber,row.record.flightNumber,row.leg.serviceNumber,row.record.serviceNumber,row.record.name,row.record.vehicle,row.record.vessel,row.start,row.end,...[row.leg.start,row.leg.end].flatMap(p=>[p?.name,p?.city,p?.area,p?.countryName,p?.countryCode,p?.iata,p?.icao])].join(' ')).includes(term))).sort((a,b) => {
      const left=instant(a.leg.startLocal,zone(a.leg.start),a.leg.startDisambiguation),right=instant(b.leg.startLocal,zone(b.leg.start),b.leg.startDisambiguation);
      const byDate=left!==null&&right!==null?left-right:String(a.leg.startLocal||a.start).localeCompare(String(b.leg.startLocal||b.start));
      return (selected==='previous'?-byDate:byDate)||a.key.localeCompare(b.key);
    });
  }
  function countdown(row, now=Date.now()) {
    if (row.record.status==='cancelled') return {value:'',unit:'Cancelled'};
    if (period(row,now)==='previous') return {value:'',unit:'Previous'};
    const local=row.leg.startLocal||'',date=(local||row.start).slice(0,10),today=dayAt(now,zone(row.leg.start));
    if (!J.validDate(date)) return {value:'',unit:'Date to add'};
    const days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
    const resolved=J.resolveLocalTime(local,zone(row.leg.start),row.leg.startDisambiguation);
    if(!row.record.dateOnly&&resolved.status!=='known')return {value:'',unit:resolved.status==='unknown'?(resolved.reason==='invalidZone'?'Time zone unrecognised':resolved.reason==='missingZone'?'Time zone not recorded':'Time not recorded'):resolved.status==='ambiguous'?'Repeated local time':'Check local time'};
    const start=row.record.dateOnly?null:resolved.instant,remaining=start===null?null:start-now;
    if (days<=0) {
      if (remaining>0 && remaining<=6*3600000) {
        const minutes=Math.ceil(remaining/60000),hours=Math.ceil(remaining/3600000);
        return minutes<60 ? {value:minutes,unit:minutes===1?'minute':'minutes'} : {value:hours,unit:hours===1?'hour':'hours'};
      }
      return {value:'',unit:'Today'};
    }
    if (days>=60) {const months=Math.max(2,Math.floor(days/30.4375));return {value:months,unit:months===1?'month':'months'};}
    return {value:days,unit:days===1?'day':'days'};
  }
  function overnight(row) {
    const a=row.leg.startLocal?.slice(0,10),b=row.leg.endLocal?.slice(0,10);
    return J.validDate(a)&&J.validDate(b)?Math.round((Date.parse(b)-Date.parse(a))/86400000):0;
  }
  const api={modes,mode,norm,zone,instant,dayAt,period,rows,provider,providerName,filter,countdown,overnight};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVTransportDashboardModel=api;
})(typeof window!=='undefined'?window:globalThis);

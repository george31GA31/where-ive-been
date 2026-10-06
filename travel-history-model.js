/* Read-only historical travel days and country chronology, shared by all six stats. */
(function (root) {
  'use strict';
  const J = typeof module !== 'undefined' && module.exports ? require('./journey-model.js') : root.HVJourney;
  const V = typeof module !== 'undefined' && module.exports ? require('./country-visit-model.js') : root.HVCountryVisits;
  const DAY = 86400000;
  const nextDate = date => new Date(Date.parse(date) + DAY).toISOString().slice(0,10);
  function history(data, today, profileId = data.activeProfileId) {
    const dates = new Map(), first = new Map(), countryYears = new Map(), proven = new Set(), returns = new Set();
    if (!J.validDate(today)) return {dates,first,countryYears,proven,returns};
    const eligible = r => !['cancelled','unconfirmed','want','not-recorded'].includes(r.status) && !(data.trips || []).some(t => t.id === r.tripId && t.status === 'cancelled');
    function country(code,date) {
      if (!code || code === 'SEA') return;
      proven.add(code);
      if (!first.has(code) || date < first.get(code).date) first.set(code,{date,year:Number(date.slice(0,4)),precision:'date'});
      if (!countryYears.has(code)) countryYears.set(code,new Set());
      countryYears.get(code).add(Number(date.slice(0,4)));
    }
    function day(date,code,r,countsCountry = true) {
      if (!J.validDate(date) || date > today || !code) return;
      const owner = r.profileId || profileId;
      const kind = J.homeKind(data,{...r,countryCode:code},date,owner);
      const away = kind === 'trip' || kind === 'foreign';
      const travelling = away || kind === 'trip';
      if (!dates.has(date)) dates.set(date,{away:false,home:false,countries:new Set()});
      const entry = dates.get(date); entry.away ||= away; entry.home ||= !away;
      if (travelling && countsCountry && code !== 'SEA') {entry.countries.add(code);country(code,date);}
    }
    function range(start,end,code,r) {
      if (!J.validDate(start) || start > today || !eligible(r)) return;
      const last = end || (J.isActual(r) ? today : start);
      if (!J.validDate(last) || last < start) return;
      for (let n=Date.parse(start),limit=Math.min(Date.parse(last),Date.parse(today));n<=limit;n+=DAY) day(new Date(n).toISOString().slice(0,10),code,r);
    }
    for (const r of J.scoped(data.stays,profileId)) range(r.start,r.end,r.countryCode,r);
    for (const r of J.scoped(data.accommodations,profileId).filter(r=>!J.hiddenHomeRecord(data,r))) range(r.checkIn,r.checkOut,r.place?.countryCode || r.countryCode,r);
    for (const r of J.scoped(data.placeVisits,profileId).filter(r => r.category === 'locations' && (!r.status || r.status === 'visited') && !J.hiddenHomeRecord(data,r))) range(r.date,r.endDate || r.date,r.place?.countryCode || r.countryCode,r);
    for (const r of J.scoped(data.transports,profileId).filter(eligible)) {
      if (J.hiddenHomeRecord(data,r)) continue;
      const legs = r.type === 'flight' ? J.flightLegs(r) : J.groundLegs(r);
      for (const leg of legs) {
        const start = leg.startLocal?.slice(0,10),end = leg.endLocal?.slice(0,10);
        // An airport connection proves a travel day, not entry into a new country.
        // A foreign journey's return endpoint is not a domestic holiday.
        const domestic=leg.start?.countryCode&&leg.start.countryCode===leg.end?.countryCode;
        const provesCountry=(point,date)=>r.type!=='flight'&&(domestic||!J.isHome(data,point?.countryCode,date,r.profileId||profileId));
        day(start,leg.start?.countryCode,r,provesCountry(leg.start,start));day(end,leg.end?.countryCode,r,provesCountry(leg.end,end));
        if (J.validDate(end) && end <= today && leg.start?.countryCode && leg.end?.countryCode && !J.isHome(data,leg.start.countryCode,start,r.profileId || profileId) && J.isHome(data,leg.end.countryCode,end,r.profileId || profileId)) returns.add(end);
        if (r.type !== 'flight' && J.validDate(start) && J.validDate(end) && end >= start && leg.start?.countryCode === leg.end?.countryCode) range(start,end,leg.start.countryCode,r);
      }
    }
    // An explicitly dated, ongoing actual trip can extend known foreign travel
    // to today. A named trip without dates never implies an open-ended absence.
    for (const trip of J.scoped(data.trips,profileId)) {
      if (trip.status !== 'actual' || !J.validDate(trip.start) || trip.start > today || trip.end) continue;
      const evidence = J.scoped(data.stays,profileId).filter(r => r.tripId === trip.id && eligible(r) && r.start <= today && r.countryCode !== 'SEA' && !J.isHome(data,r.countryCode,r.start,r.profileId || profileId));
      if (!evidence.length) continue;
      const returnDate = [...returns].filter(d => d >= trip.start).sort()[0];
      for (let n=Date.parse(trip.start),limit=Date.parse(returnDate || today);n<=limit;n+=DAY) {
        const date=new Date(n).toISOString().slice(0,10),known=dates.get(date);
        if (known?.home && !known.away) continue;
        if (!known) dates.set(date,{away:true,home:false,countries:new Set()}); else known.away=true;
      }
    }
    for (const r of V.manualRows(data,today,profileId)) {
      const code = r.countryCode; if (code === 'SEA') continue;
      const known = first.get(code);
      if (r.date) {
        const year=Number(r.date.slice(0,4)),earlier=!known||known.precision==='date'&&r.date<known.date||known.precision==='year'&&year<known.year;
        if (earlier) first.set(code,{date:r.date,year,precision:'date'});
        if (!countryYears.has(code)) countryYears.set(code,new Set());countryYears.get(code).add(Number(r.date.slice(0,4)));
      } else if (r.year != null) {
        // A year is kept as a year, never turned into an invented January date.
        if (!known || known.precision !== 'unknown' && r.year <= known.year) first.set(code,{year:r.year,precision:'year'});
        if (!countryYears.has(code)) countryYears.set(code,new Set());countryYears.get(code).add(r.year);
      } else first.set(code,{precision:'unknown'});
    }
    return {dates,first,countryYears,proven,returns};
  }
  function calculate(data,today,profileId = data.activeProfileId,isCounted = () => true) {
    const result=history(data,today,profileId),months=new Map(),years=new Map();
    const away=[...result.dates].filter(([,d]) => d.away).map(([date]) => date).sort();
    let longest=null,current=null;
    for (const date of away) {
      const month=date.slice(0,7),year=date.slice(0,4);months.set(month,(months.get(month)||0)+1);years.set(year,(years.get(year)||0)+1);
      if (!current || nextDate(current.end) !== date || result.returns.has(current.end)) current={start:date,end:date,days:1};
      else {current.end=date;current.days++;}
      if (!longest || current.days > longest.days || current.days === longest.days && current.end > longest.end) longest={...current};
    }
    if (longest) longest.ongoing=longest.end === today && !result.returns.has(today);
    const best = values => [...values].sort((a,b) => b[1]-a[1] || b[0].localeCompare(a[0]))[0] || null;
    const currentYear=Number(today.slice(0,4));
    const countriesThisYear=[...result.countryYears].filter(([code,y]) => isCounted(code) && y.has(currentYear)).map(([code]) => code).sort();
    const newCountriesThisYear=[...result.first].filter(([code,v]) => isCounted(code) && v.year === currentYear).map(([code]) => code).sort();
    const latest=[...result.first].filter(([code,v]) => isCounted(code) && v.precision === 'date').sort((a,b) => b[1].date.localeCompare(a[1].date) || a[0].localeCompare(b[0]));
    const mostMonth=best(months),mostYear=best(years);
    const lastNew=latest[0]?{date:latest[0][1].date,countries:latest.filter(([,v])=>v.date===latest[0][1].date).map(([code])=>code),days:Math.round((Date.parse(today)-Date.parse(latest[0][1].date))/DAY)}:null;
    return {...result,awayDays:new Set(away),mostMonth:mostMonth?{month:mostMonth[0],days:mostMonth[1]}:null,mostYear:mostYear?{year:Number(mostYear[0]),days:mostYear[1],daysInYear:J.validDate(mostYear[0]+'-02-29')?366:365}:null,longest,lastNew,countriesThisYear,newCountriesThisYear};
  }
  const api={history,calculate};
  if (typeof module !== 'undefined' && module.exports) module.exports=api; else root.HVTravelHistory=api;
})(typeof window !== 'undefined' ? window : globalThis);

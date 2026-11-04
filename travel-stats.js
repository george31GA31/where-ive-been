/* Six personal statistics, all derived from the same historical travel-day engine. */
(() => {
  'use strict';
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names=codes=>codes.map(code=>countryByCode(code)?.name||code).join(', ');
  let cache;
  let selectedCountry='',explorerIdentity=null;
  function explorer(data,today) {
    if(explorerIdentity?.data!==data||explorerIdentity?.profile!==data.activeProfileId){selectedCountry='';explorerIdentity={data,profile:data.activeProfileId};}
    const history=HVTravelHistory.history(data,today,data.activeProfileId),years=[...new Set([...history.countryYears.values()].flatMap(set=>[...set]))].filter(y=>y<=Number(today.slice(0,4))).sort((a,b)=>b-a);
    const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('year'),year=years.includes(Number(requested))?String(requested):'';
    const counts=new Map();for(const [date,entry] of history.dates){if(year&&date.slice(0,4)!==year)continue;for(const code of entry.countries){if(WIBCountryCount.isCounted(code))counts.set(code,(counts.get(code)||0)+1);}}
    const countries=[...history.countryYears].filter(([code,set])=>WIBCountryCount.isCounted(code)&&(!year||set.has(Number(year)))).map(([code])=>code).sort((a,b)=>(countryByCode(a)?.name||a).localeCompare(countryByCode(b)?.name||b));
    if(!countries.includes(selectedCountry))selectedCountry='';
    const away=[...history.dates].filter(([date,entry])=>entry.away&&(!year||date.slice(0,4)===year)).length;
    let records='';
    if(selectedCountry){
      const empty={stays:[],accommodations:[],transports:[],placeVisits:[],manualCountryVisits:[]};
      const rows=[];
      // Ask the same history engine which individual records establish this country/year.
      // No date proximity, similar names or display totals are used as a membership rule.
      for(const [key,kind] of [['stays','country'],['accommodations','accommodation'],['transports','transport'],['placeVisits','location']])for(const row of HVJourney.scoped(data[key]||[],data.activeProfileId)){
        const contribution=HVTravelHistory.history({...data,...empty,[key]:[row]},today,data.activeProfileId).countryYears.get(selectedCountry);
        if(!contribution||year&&!contribution.has(Number(year)))continue;
        const dates=kind==='country'?[row.start,row.end||today]:kind==='accommodation'?[row.checkIn,row.checkOut]:kind==='transport'?HVJourney.transportDates(row):[row.date,row.endDate||row.date];
        rows.push({kind,id:row.id,start:dates[0],title:kind==='country'?row.countryName:kind==='accommodation'?row.propertyName:kind==='transport'?HVJourneys.transportLabel(row):row.place?.name||'Location',dates:HVJourneyUI.range(dates[0],dates.at(-1))});
      }
      const manual=HVCountryVisits.manualRows(data,today,data.activeProfileId).filter(r=>r.countryCode===selectedCountry&&(!year||String(r.year||r.date?.slice(0,4))===year));
      records=`<section class="hv-year-records"><h3>${E(countryByCode(selectedCountry)?.name||selectedCountry)} · ${year||'recorded history'}</h3><p class="helper">Contributing records, with their original dates. Days in overlapping records count once. Flight connections do not establish a country visit.</p>${rows.sort((a,b)=>String(a.start).localeCompare(String(b.start))).map(row=>`<button type="button" class="text-btn" data-v1-read="${row.kind}" data-record-id="${E(row.id)}"><strong>${E(row.title||'Travel record')}</strong><small>${E(row.dates)}</small><span aria-hidden="true">→</span></button>`).join('')}${manual.map(r=>`<p class="helper">Manual visit · ${E(r.date||r.year||'Date unknown')}${!r.date?' · exact dates not recorded':''}</p>`).join('')}${!rows.length&&!manual.length?'<p>No individual dated records are available.</p>':''}<a class="text-btn" href="#/country/${E(selectedCountry)}">Open country history →</a></section>`;
    }
    return `<section class="hv-year-explorer" data-year-explorer><div class="panel-head"><div><p class="eyebrow">EXPLORE YOUR HISTORY</p><h2>A year in your world</h2></div><label class="field"><span>Period</span><select data-year-scope><option value="">All recorded years</option>${years.map(y=>`<option value="${y}" ${String(y)===year?'selected':''}>${y}</option>`).join('')}</select></label></div><p role="status">${countries.length} ${countries.length===1?'country':'countries'} with a date or recorded year · ${away} unique days away${year?' in '+year:''}.</p><p class="helper">Country counts include manual years; manual dates and years never add days away. Future, tentative and cancelled travel is excluded. Home and country-definition rules match your other statistics.</p>${countries.length?`<div class="hv-year-table-scroll"><table class="hv-year-table"><caption>${year||'All recorded years'} · choose a country to inspect its records</caption><thead><tr><th scope="col">Country</th><th scope="col">Recorded travel days</th><th scope="col">History</th></tr></thead><tbody>${countries.map(code=>`<tr><th scope="row">${E(countryByCode(code)?.name||code)}</th><td>${counts.get(code)||0}</td><td><button type="button" class="text-btn" data-history-country="${E(code)}" aria-pressed="${selectedCountry===code}">${selectedCountry===code?'Hide':'View'} records</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-state">Add dated travel or a manual visit year to explore your history.</p>'}${records}</section>`;
  }
  function cards(data,today) {
    const relevant=['stays','trips','transports','accommodations','placeVisits','profiles','residences','manualCountryVisits','excludedCountryCodes','countryCountExcludedCodes','countryCountIncludedExtraCodes'];
    const signature=HVData.token(data,relevant,today+'|'+data.activeProfileId);
    if(cache?.data!==data||cache.signature!==signature){const started=performance.now();cache={data,signature,stats:HVTravelHistory.calculate(data,today,data.activeProfileId,WIBCountryCount.isCounted)};window.HVAccountDiagnostics?.record('statistics calculated',{elapsed:Math.round(performance.now()-started)});}
    const stats=cache.stats;
    const date=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    const dayCount=n=>n+' '+(n===1?'day':'days');
    const month=stats.mostMonth,year=stats.mostYear,longest=stats.longest,last=stats.lastNew;
    const rows=[
      ['most-month','Most travelled month',month?new Date(month.month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}):'No dated travel yet',month?dayCount(month.days)+' away':'Add dated travel to see this statistic.','The calendar month with the most unique days away from home, including genuine domestic trips.'],
      ['longest-away','Longest away from home',longest?dayCount(longest.days)+(longest.ongoing?' · ongoing':''):'No dated travel yet',longest?date(longest.start)+' – '+date(longest.end):'Add dated travel to see this statistic.','Your longest continuous recorded period away. Countries may change; a return home or a gap in recorded dates ends the period.'],
      ['most-year','Most travelled year',year?String(year.year):'No dated travel yet',year?dayCount(year.days)+' away · '+(year.days/year.daysInYear*100).toFixed(1)+'% of the year':'Add dated travel to see this statistic.','The calendar year with the most unique days away. Cross-year travel is split by date.'],
      ['last-new','Time since your last new country',last?last.days===0?'Today':dayCount(last.days)+' ago':'Not enough dated travel history yet',last?names(last.countries)+' · '+date(last.date):'Undated and approximate-year visits do not establish an exact first-visit date.','Time since the latest first known country visit with an exact date. Revisits do not change this.'],
      ['new-year','New countries this year',String(stats.newCountriesThisYear.length),stats.newCountriesThisYear.length?names(stats.newCountriesThisYear):'No first visits recorded in '+today.slice(0,4)+'.','Countries whose earliest known visit falls in this calendar year. Undated visits do not establish a first-visit year.'],
      ['countries-year','Countries visited this year',String(stats.countriesThisYear.length),stats.countriesThisYear.length?names(stats.countriesThisYear):'No dated country visits recorded in '+today.slice(0,4)+'.','Unique countries visited this year, including revisits and genuine domestic trips. Ordinary time at home is excluded.']
    ];
    return `<section class="personal-travel-stats" aria-label="Personal travel statistics">${rows.map(([id,title,value,detail,help])=>`<article class="personal-travel-stat" data-travel-stat="${id}"><div class="travel-stat-heading"><h3>${E(title)}</h3><span class="travel-stat-help"><button type="button" aria-label="${E(title+': '+help)}" aria-describedby="stat-help-${id}">i</button><span role="tooltip" id="stat-help-${id}">${E(help)}</span></span></div><strong class="travel-stat-value">${E(value)}</strong><p>${E(detail)}</p></article>`).join('')}</section><p class="helper travel-stats-note">Recorded travel through ${E(date(today))}. Each date counts once. Manual visit dates and years can establish country chronology, but never add days away. TCC selections are separate.</p>`+(document.body.dataset.currentView==='stats'?explorer(data,today):'');
  }
  document.addEventListener('change',event=>{if(!event.target.matches('[data-year-scope]'))return;const p=new URLSearchParams(location.hash.split('?')[1]||'');if(event.target.value)p.set('year',event.target.value);else p.delete('year');history.replaceState(history.state,'',location.hash.split('?')[0]+(p.size?'?'+p:''));selectedCountry='';const host=document.querySelector('[data-year-explorer]');host.outerHTML=explorer(state,isoDate(new Date()));document.querySelector('[data-year-scope]')?.focus({preventScroll:true});});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-history-country]');if(!b)return;selectedCountry=selectedCountry===b.dataset.historyCountry?'':b.dataset.historyCountry;document.querySelector('[data-year-explorer]').outerHTML=explorer(state,isoDate(new Date()));document.querySelector(`[data-history-country="${CSS.escape(selectedCountry||b.dataset.historyCountry)}"]`)?.focus({preventScroll:true});});
  window.HVTravelStats={cards};
})();

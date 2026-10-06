/* Six personal statistics, all derived from the same historical travel-day engine. */
(() => {
  'use strict';
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names=codes=>codes.map(code=>countryByCode(code)?.name||code).join(', ');
  function cards(data,today) {
    const stats=HVTravelHistory.calculate(data,today,data.activeProfileId,WIBCountryCount.isCounted);
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
    return `<section class="personal-travel-stats" aria-label="Personal travel statistics">${rows.map(([id,title,value,detail,help])=>`<article class="personal-travel-stat" data-travel-stat="${id}"><div class="travel-stat-heading"><h3>${E(title)}</h3><span class="travel-stat-help"><button type="button" aria-label="${E(title+': '+help)}" aria-describedby="stat-help-${id}">i</button><span role="tooltip" id="stat-help-${id}">${E(help)}</span></span></div><strong class="travel-stat-value">${E(value)}</strong><p>${E(detail)}</p></article>`).join('')}</section><p class="helper travel-stats-note">Recorded travel through ${E(date(today))}. Each date counts once. Manual visit dates and years can establish country chronology, but never add days away. TCC selections are separate.</p>`;
  }
  window.HVTravelStats={cards};
})();

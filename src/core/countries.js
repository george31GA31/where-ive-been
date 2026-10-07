function renderCountries() {
  const today = isoDate(new Date());
  const totals = new Map();

  staysForProfile().forEach((stay) => {
    if (stay.start > today || stay.status !== 'actual') return;
    const days = datesForStay(stay).filter((day) => day <= today);
    if (!days.length) return;

    if (!totals.has(stay.countryCode)) totals.set(stay.countryCode, { days: new Set() });
    days.forEach((day) => totals.get(stay.countryCode).days.add(day));
  });

  for (const record of HVCountryVisits.manualRows(state, today)) {
    if (!totals.has(record.countryCode))
      totals.set(record.countryCode, { days: new Set(), manual: record });
  }

  if (!totals.size) {
    els.countryTotals.className = 'country-totals empty-state';
    els.countryTotals.textContent = 'No country data yet.';
    return;
  }

  const allRows = [...totals]
    .map(([code, record]) => ({
      code,
      name:
        countryByCode(code)?.name ||
        staysForProfile().find((stay) => stay.countryCode === code)?.countryName ||
        code,
      total: record.days.size,
      manual: record.manual,
      home: [...record.days].filter(
        (d) =>
          !staysForProfile().some(
            (s) =>
              s.countryCode === code &&
              s.status === 'actual' &&
              s.start <= d &&
              s.end >= d &&
              HVJourney.isTravelStay(state, s, d),
          ),
      ).length,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const hiddenCodes = new Set(state.excludedCountryCodes || []);
  const rows = allRows.filter((row) => !hiddenCodes.has(row.code));
  const hidden = allRows.filter((row) => hiddenCodes.has(row.code));
  const max = rows.length ? Math.max(...rows.map((row) => row.total)) : 1;

  els.countryTotals.className = 'country-totals';
  const visibleHtml = rows.length
    ? rows
        .map(
          (row) => `
      <div class="country-row">
        <div class="flag">${flagHtml(row.code)}</div>
        <div class="country-name">
          <a href="#/country/${row.code}"><strong>${esc(row.name)}</strong></a>
          <span>${row.manual ? 'Visited · ' + (row.manual.date ? esc(fmt(row.manual.date)) : row.manual.year ? 'approximately ' + row.manual.year : 'date not recorded') : `${row.total - row.home} travel · ${plural(row.home, 'home day')}`}</span>
          <button type="button" class="country-remove-btn" data-action="exclude-country" data-country="${row.code}" aria-label="Hide ${esc(row.name)} from country totals">Hide from totals</button>
        </div>
        <div class="country-bar"><span style="width:${Math.max(0, Math.min(100, (row.total / max) * 100))}%"></span></div>
        <div class="country-count"><strong>${row.manual ? '✓' : row.total}</strong><span>${row.manual ? 'visited' : row.total === 1 ? 'day' : 'days'}</span></div>
      </div>
    `,
        )
        .join('')
    : '<div class="empty-state">All visited countries are currently removed from this list.</div>';

  const hiddenHtml = hidden.length
    ? `
      <div class="gap-card removed-country-card" style="margin-top:14px">
        <div class="gap-card-head"><strong>Removed from country totals</strong><span class="status-badge neutral">${hidden.length}</span></div>
        <p>These stays are still saved in your calendar and travel history. Re-add a country at any time.</p>
        <div class="gap-actions">${hidden.map((row) => `<button type="button" class="tiny-btn" data-action="include-country" data-country="${row.code}">${flagHtml(row.code, 'flag-img flag-sm')} Re-add ${esc(row.name)}</button>`).join('')}</div>
      </div>
    `
    : '';

  els.countryTotals.innerHTML = visibleHtml + hiddenHtml;
}

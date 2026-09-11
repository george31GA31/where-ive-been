/* Where I've Been — post-core fixes, 2026-09-10 */
(() => {
  'use strict';

  // Keep the new personal-country-count preference compatible with all old data.
  state.countryCountExcludedCodes = Array.isArray(state.countryCountExcludedCodes)
    ? state.countryCountExcludedCodes
    : [];

  const coreDefaultState = defaultState;
  defaultState = function () {
    const next = coreDefaultState();
    next.countryCountExcludedCodes = Array.isArray(next.countryCountExcludedCodes)
      ? next.countryCountExcludedCodes
      : [];
    return next;
  };

  const coreNormalizeState = normalizeState;
  normalizeState = function (value) {
    coreNormalizeState(value);
    value.countryCountExcludedCodes = Array.isArray(value.countryCountExcludedCodes)
      ? value.countryCountExcludedCodes
      : [];
  };

  // Use a proper non-country icon for At Sea and keep flags dimensionally stable.
  const coreFlagHtml = flagHtml;
  flagHtml = function (code, cls = 'flag-img') {
    if (!code) return '';
    if (String(code).toUpperCase() === 'SEA') {
      return `<span class="${esc(cls)} special-location-icon" title="At Sea" aria-label="At Sea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 9q3-4 6 0t6 0t8 0M2 16q3-4 6 0t6 0t8 0"/></svg></span>`;
    }
    return coreFlagHtml(code, cls);
  };

  function hasBeenEnteredBy(code, date = isoDate(new Date())) {
    return state.stays.some(stay => stay.countryCode === code && stay.start <= date);
  }

  function visitedCountryCodesAsOf(date = isoDate(new Date())) {
    return new Set(
      state.stays
        .filter(stay => stay.start <= date)
        .map(stay => stay.countryCode)
        .filter(code => code && code !== 'SEA')
    );
  }

  // "Countries logged" is a personal count of places actually entered by today.
  // Future planned destinations stay out of the headline until their entry date arrives.
  const coreRenderDashboard = renderDashboard;
  renderDashboard = function () {
    coreRenderDashboard();
    const today = isoDate(new Date());
    const notCounted = new Set(state.countryCountExcludedCodes || []);
    const visited = visitedCountryCodesAsOf(today);
    const counted = [...visited].filter(code => !notCounted.has(code));

    if (els.countriesLogged) {
      els.countriesLogged.textContent = counted.length;
      const card = els.countriesLogged.closest('.stat-card');
      const note = card?.querySelector('small');
      if (note) note.textContent = 'Visited countries as of today';
    }
  };

  // Country totals are historical-to-today only. Future planned days and destinations
  // do not inflate either the list or the bars; they appear once the entry date arrives.
  renderCountries = function () {
    const today = isoDate(new Date());
    const map = new Map();

    state.stays.forEach(stay => {
      if (stay.start > today) return;
      const days = datesForStay(stay).filter(day => day <= today);
      if (!days.length) return;

      if (!map.has(stay.countryCode)) {
        map.set(stay.countryCode, {
          name: stay.countryName,
          days: new Set()
        });
      }

      const record = map.get(stay.countryCode);
      days.forEach(day => record.days.add(day));
    });

    if (!map.size) {
      els.countryTotals.className = 'country-totals empty-state';
      els.countryTotals.textContent = 'No country data yet.';
      return;
    }

    const allRows = [...map].map(([code, record]) => ({
      code,
      name: record.name,
      total: record.days.size
    })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const excluded = new Set(state.excludedCountryCodes || []);
    const rows = allRows.filter(row => !excluded.has(row.code));
    const hidden = allRows.filter(row => excluded.has(row.code));
    const max = rows.length ? Math.max(...rows.map(row => row.total)) : 1;

    els.countryTotals.className = 'country-totals';

    const visibleHtml = rows.length
      ? rows.map(row => `
        <div class="country-row">
          <div class="flag">${flagHtml(row.code)}</div>
          <div class="country-name">
            <strong>${esc(row.name)}</strong>
            <span>${row.total} actual</span>
            <button
              type="button"
              class="country-remove-btn"
              data-action="exclude-country"
              data-country="${row.code}"
              aria-label="Remove ${esc(row.name)} from country totals"
            >Remove</button>
          </div>
          <div class="country-bar"><span style="width:${Math.max(0, Math.min(100, row.total / max * 100))}%"></span></div>
          <div class="country-count"><strong>${row.total}</strong><span>days</span></div>
        </div>
      `).join('')
      : '<div class="empty-state">All visited countries are currently removed from this list.</div>';

    const hiddenHtml = hidden.length
      ? `<div class="gap-card removed-country-card" style="margin-top:14px">
          <div class="gap-card-head"><strong>Removed from country totals</strong><span class="status-badge neutral">${hidden.length}</span></div>
          <p>These stays are still saved in your calendar and travel history. Re-add a country at any time.</p>
          <div class="gap-actions">${hidden.map(row => `<button type="button" class="tiny-btn" data-action="include-country" data-country="${row.code}">${flagHtml(row.code, 'flag-img flag-sm')} Re-add ${esc(row.name)}</button>`).join('')}</div>
        </div>`
      : '';

    els.countryTotals.innerHTML = visibleHtml + hiddenHtml;
  };

  // Replace the calendar renderer so each country chip is a real edit control.
  // Direct click handling prevents the click from also selecting the calendar day.
  renderCalendar = function () {
    const c = calendarCursor;
    const first = (c.getUTCDay() + 6) % 7;
    const start = addDays(c, -first);
    const today = isoDate(new Date());

    els.calendarTitle.textContent = c.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });

    const monthJump = $('calendarMonthJump');
    const yearJump = $('calendarYearJump');
    if (monthJump) monthJump.value = String(c.getUTCMonth());
    if (yearJump) yearJump.value = String(c.getUTCFullYear());

    let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      .map(day => `<div class="calendar-weekday">${day}</div>`)
      .join('');

    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const key = dayKey(d);
      const on = state.stays.filter(stay => stay.start <= key && stay.end >= key);
      const selectionRange = calendarSelectionStart && calendarSelectionEnd && key >= calendarSelectionStart && key <= calendarSelectionEnd;
      const selectionStart = key === calendarSelectionStart;
      const selectionEnd = key === calendarSelectionEnd;

      html += `<div class="calendar-day ${d.getUTCMonth() === c.getUTCMonth() ? '' : 'outside'} ${key === today ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${key}" role="button" tabindex="0" aria-label="${fmt(key)}">
        <div class="day-number">${d.getUTCDate()}</div>
        ${on.slice(0, 4).map(stay => `
          <button
            type="button"
            class="day-stay calendar-stay-button ${SCHENGEN.has(stay.countryCode) && !stay.schengenExempt ? 'schengen' : ''} ${stay.status === 'planned' ? 'planned' : ''}"
            data-calendar-stay-id="${stay.id}"
            aria-label="Edit ${esc(stay.countryName)} stay"
            title="Edit ${esc(stay.countryName)}"
          >
            ${flagHtml(stay.countryCode, 'flag-img flag-sm')}
            <span class="calendar-stay-name">${esc(stay.countryName)}</span>
          </button>
        `).join('')}
        ${on.length > 4 ? `<div class="day-stay calendar-more">+${on.length - 4} more</div>` : ''}
      </div>`;
    }

    els.calendar.innerHTML = html;

    els.calendar.querySelectorAll('[data-calendar-stay-id]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openStayDialog(button.dataset.calendarStayId);
      });
    });

    els.calendar.querySelectorAll('[data-calendar-date]').forEach(day => {
      day.onkeydown = event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-calendar-stay-id]')) {
          event.preventDefault();
          handleCalendarDateClick(day.dataset.calendarDate);
        }
      };
    });

    updateCalendarSelectionUI();
  };

  function installCountryCountEditorFix() {
    if ($('countryCountDialog')) return;

    const number = $('countriesLogged');
    if (!number) return;

    const card = number.closest('.stat-card') || number.parentElement;
    if (card && !$('editCountryCountBtn')) {
      card.style.position = 'relative';
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'editCountryCountBtn';
      button.className = 'country-count-edit-btn';
      button.textContent = 'Edit';
      button.setAttribute('aria-label', 'Choose which visited places count as countries');
      button.addEventListener('click', openCountryCountEditorFix);
      card.appendChild(button);
    }

    const dialog = document.createElement('dialog');
    dialog.id = 'countryCountDialog';
    dialog.className = 'dialog country-count-dialog';
    dialog.innerHTML = `
      <div class="dialog-card country-count-card">
        <div class="dialog-head">
          <div>
            <p class="eyebrow">YOUR COUNTRY COUNT</p>
            <h2>What counts as a country?</h2>
          </div>
          <button type="button" id="closeCountryCountDialog" class="icon-btn" aria-label="Close">×</button>
        </div>
        <p class="country-count-help">Untick dependent territories or any other places you personally don't count as countries. Only places you have actually entered by today appear here. Nothing is removed from your dates, travel history or map.</p>
        <div id="countryCountEditorList" class="country-count-editor-list"></div>
        <div class="dialog-actions">
          <div class="spacer"></div>
          <button type="button" id="doneCountryCountBtn" class="primary">Done</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    $('closeCountryCountDialog').addEventListener('click', () => dialog.close());
    $('doneCountryCountBtn').addEventListener('click', () => dialog.close());
  }

  function openCountryCountEditorFix() {
    const dialog = $('countryCountDialog');
    const list = $('countryCountEditorList');
    if (!dialog || !list) return;

    const today = isoDate(new Date());
    const recorded = [...visitedCountryCodesAsOf(today)].sort((a, b) =>
      (countryByCode(a)?.name || a).localeCompare(countryByCode(b)?.name || b)
    );
    const excluded = new Set(state.countryCountExcludedCodes || []);

    list.innerHTML = recorded.length
      ? recorded.map(code => {
          const country = countryByCode(code);
          const name = country?.name || code;
          return `<label class="country-count-choice">
            ${flagHtml(code, 'flag-img flag-sm')}
            <strong>${esc(name)}</strong>
            <input type="checkbox" data-country-count-code="${code}" ${excluded.has(code) ? '' : 'checked'} aria-label="Count ${esc(name)} as a country">
          </label>`;
        }).join('')
      : '<div class="empty-state">No countries have been visited yet.</div>';

    list.querySelectorAll('[data-country-count-code]').forEach(input => {
      input.addEventListener('change', () => {
        const next = new Set(state.countryCountExcludedCodes || []);
        const code = input.dataset.countryCountCode;
        if (input.checked) next.delete(code);
        else next.add(code);
        state.countryCountExcludedCodes = [...next];
        persist();
        renderDashboard();
      });
    });

    dialog.showModal();
  }

  function installResponsiveFixes() {
    if ($('wibResponsiveFixes')) return;
    const style = document.createElement('style');
    style.id = 'wibResponsiveFixes';
    style.textContent = `
      .country-count-edit-btn{position:absolute;top:18px;right:18px;z-index:4;border:0;background:transparent;color:var(--gold,#b8860b);font:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:6px 9px;border-radius:8px}
      .country-count-edit-btn:hover{background:rgba(184,134,11,.09)}
      .country-count-card{max-width:650px}
      .country-count-help{color:#687386;line-height:1.55;margin:0 0 18px}
      .country-count-editor-list{display:flex;flex-direction:column;max-height:55vh;overflow:auto;border:1px solid #e4e8ee;border-radius:14px}
      .country-count-choice{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #edf0f3;cursor:pointer}
      .country-count-choice:last-child{border-bottom:0}
      .country-count-choice:hover{background:#f8f9fb}
      .country-count-choice strong{flex:1;min-width:0}
      .country-count-choice input{width:18px;height:18px;margin-left:auto;flex:0 0 auto;cursor:pointer}

      .country-name{align-items:flex-start!important}
      .country-remove-btn{display:block;margin:5px 0 0;padding:0;border:0;background:transparent;color:var(--muted);font:inherit;font-size:11px;font-weight:800;line-height:1.25;cursor:pointer;text-align:left}
      .country-remove-btn:hover{color:var(--gold,#b8860b);text-decoration:underline;text-underline-offset:2px}
      [data-theme="dark"] .country-count-help{color:var(--muted)}
      [data-theme="dark"] .country-count-choice{border-color:var(--line)}
      [data-theme="dark"] .country-count-choice:hover{background:rgba(255,255,255,.035)}

      .calendar-stay-button{appearance:none;-webkit-appearance:none;border:0!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:6px!important;text-align:left!important;cursor:pointer!important;font:inherit!important;color:inherit!important;overflow:hidden!important}
      .calendar-stay-button:hover{filter:brightness(.97)}
      .calendar-stay-button:focus-visible{outline:2px solid #2e69c7!important;outline-offset:1px}
      .calendar-stay-name{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}
      .calendar-stay-button .flag-img,.calendar-day .flag-img{display:block!important;width:20px!important;height:14px!important;min-width:20px!important;max-width:20px!important;flex:0 0 20px!important;object-fit:cover!important;object-position:center!important;border-radius:2px!important}
      .calendar-stay-button .special-location-icon,.calendar-day .special-location-icon{display:inline-flex!important;width:20px!important;height:14px!important;min-width:20px!important;max-width:20px!important;flex:0 0 20px!important;align-items:center!important;justify-content:center!important;font-size:14px!important;line-height:1!important;border-radius:2px!important}
      .calendar-more{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      @media(max-width:900px){
        .calendar-stay-button{padding-left:6px!important;padding-right:6px!important;gap:4px!important}
        .calendar-stay-name{font-size:11px}
      }
      @media(max-width:700px){
        .calendar-stay-button{justify-content:center!important;padding:5px 2px!important;min-height:27px!important}
        .calendar-stay-name{display:none!important}
        .calendar-stay-button .flag-img,.calendar-day .flag-img{width:22px!important;height:15px!important;min-width:22px!important;max-width:22px!important;flex-basis:22px!important}
        .calendar-stay-button .special-location-icon,.calendar-day .special-location-icon{width:22px!important;height:15px!important;min-width:22px!important;max-width:22px!important;flex-basis:22px!important}
        .country-count-edit-btn{top:12px;right:12px}
      }
    `;
    document.head.appendChild(style);
  }

  installResponsiveFixes();

  // Core's DOMContentLoaded listener was registered first, so this runs immediately
  // after its normal init/cache/render and adds the editor without changing stored stays.
  document.addEventListener('DOMContentLoaded', () => {
    state.countryCountExcludedCodes = Array.isArray(state.countryCountExcludedCodes)
      ? state.countryCountExcludedCodes
      : [];
    installCountryCountEditorFix();
    renderDashboard();
    renderCountries();
    renderCalendar();
  });
})();

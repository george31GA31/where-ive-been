/* Where I've Been — country-count model and full country/territory editor. */
(() => {
  'use strict';

  // 193 UN member states + Vatican City + Palestine.
  const DEFAULT_COUNTRY_CODES = new Set(`
AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CR HR CU CY CZ CI CD DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW PS
  `.trim().split(/\s+/));

  const DISPLAY_NAME_OVERRIDES = {
    MF: 'Saint Martin',
    SX: 'Sint Maarten'
  };

  function applyDisplayNames() {
    COUNTRIES.forEach(country => {
      if (DISPLAY_NAME_OVERRIDES[country.code]) country.name = DISPLAY_NAME_OVERRIDES[country.code];
    });

  }

  state.countryCountExcludedCodes = Array.isArray(state.countryCountExcludedCodes)
    ? state.countryCountExcludedCodes
    : [];
  state.countryCountIncludedExtraCodes = Array.isArray(state.countryCountIncludedExtraCodes)
    ? state.countryCountIncludedExtraCodes
    : [];

  const previousDefaultState = defaultState;
  defaultState = function () {
    const next = previousDefaultState();
    next.countryCountExcludedCodes = Array.isArray(next.countryCountExcludedCodes) ? next.countryCountExcludedCodes : [];
    next.countryCountIncludedExtraCodes = Array.isArray(next.countryCountIncludedExtraCodes) ? next.countryCountIncludedExtraCodes : [];
    return next;
  };

  const previousNormalizeState = normalizeState;
  normalizeState = function (value) {
    previousNormalizeState(value);
    value.countryCountExcludedCodes = Array.isArray(value.countryCountExcludedCodes) ? value.countryCountExcludedCodes : [];
    value.countryCountIncludedExtraCodes = Array.isArray(value.countryCountIncludedExtraCodes) ? value.countryCountIncludedExtraCodes : [];
  };

  function isCountedCountryCode(code) {
    if (!code || code === 'SEA') return false;
    if (DEFAULT_COUNTRY_CODES.has(code)) {
      return !(state.countryCountExcludedCodes || []).includes(code);
    }
    return (state.countryCountIncludedExtraCodes || []).includes(code);
  }

  function visitedCountryCodesAsOf(date = isoDate(new Date())) {
    return new Set(
      staysForProfile()
        .filter(stay => stay.status === 'actual' && stay.start <= date)
        .map(stay => stay.countryCode)
        .filter(code => code && code !== 'SEA')
    );
  }

  window.WIBCountryCount = {
    defaultCodes: DEFAULT_COUNTRY_CODES,
    isCounted: isCountedCountryCode,
    visitedCodesAsOf: visitedCountryCodesAsOf
  };

  applyDisplayNames();

  // Country totals are actual/history-to-today only. Future planned days do not inflate the list or bars.

  function checkedForEditor(code) {
    return isCountedCountryCode(code);
  }

  function setEditorChoice(code, checked) {
    const excluded = new Set(state.countryCountExcludedCodes || []);
    const includedExtras = new Set(state.countryCountIncludedExtraCodes || []);

    if (DEFAULT_COUNTRY_CODES.has(code)) {
      if (checked) excluded.delete(code);
      else excluded.add(code);
    } else {
      if (checked) includedExtras.add(code);
      else includedExtras.delete(code);
    }

    state.countryCountExcludedCodes = [...excluded];
    state.countryCountIncludedExtraCodes = [...includedExtras];
    persist();
    renderDashboard();
  }

  function editorRows(filterText = '') {
    const query = filterText.trim().toLowerCase();
    const places = COUNTRIES
      .filter(country => country.code !== 'SEA')
      .filter(country => !query || country.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const groupA = DEFAULT_COUNTRY_CODES.has(a.code) ? 0 : 1;
        const groupB = DEFAULT_COUNTRY_CODES.has(b.code) ? 0 : 1;
        return groupA - groupB || a.name.localeCompare(b.name);
      });

    if (!places.length) return '<div class="empty-state">No matching countries or territories.</div>';

    let lastGroup = null;
    return places.map(country => {
      const sovereign = DEFAULT_COUNTRY_CODES.has(country.code);
      const group = sovereign ? 'Countries — 193 UN members + Vatican City + Palestine' : 'Dependent territories & other countries';
      const heading = group !== lastGroup ? `<div class="country-count-group-label">${group}</div>` : '';
      lastGroup = group;
      return `${heading}<label class="country-count-choice">
        ${flagHtml(country.code, 'flag-img flag-sm')}
        <strong>${esc(country.name)}</strong>
        <input type="checkbox" data-country-count-code="${country.code}" ${checkedForEditor(country.code) ? 'checked' : ''} aria-label="Count ${esc(country.name)} as a country">
      </label>`;
    }).join('');
  }

  function bindEditorChoices(list) {
    list.querySelectorAll('[data-country-count-code]').forEach(input => {
      input.addEventListener('change', () => setEditorChoice(input.dataset.countryCountCode, input.checked));
    });
  }

  function openCountryCountEditor() {
    const dialog = $('countryCountDialog');
    const list = $('countryCountEditorList');
    const search = $('countryCountSearch');
    if (!dialog || !list) return;

    const render = () => {
      list.innerHTML = editorRows(search?.value || '');
      bindEditorChoices(list);
    };

    render();
    if (search) {
      search.value = '';
      search.oninput = render;
    }
    dialog.showModal();
  }

  function replaceEditor() {
    const oldDialog = $('countryCountDialog');
    if (oldDialog) oldDialog.remove();

    const oldButton = $('editCountryCountBtn');
    if (oldButton) {
      const button = oldButton.cloneNode(true);
      oldButton.replaceWith(button);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openCountryCountEditor();
      });
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
        <p class="country-count-help">All countries and territories in the tracker are shown below. The 193 UN member states plus Vatican City and Palestine are ticked by default. Dependent territories and other places are unticked unless you choose to count them.</p>
        <label class="field country-count-search-field">
          <span>Find a country or territory</span>
          <input id="countryCountSearch" type="search" placeholder="Search…" autocomplete="off">
        </label>
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

  document.addEventListener('DOMContentLoaded', () => {
    replaceEditor();
    renderDashboard();
    renderCountries();
  });
})();

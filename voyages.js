/* Herald Voyages — 2026 product shell and interaction layer.
   Travel/account persistence remains in the existing app core; this layer handles
   branding, routing, responsive navigation and progressive-disclosure UI. */
(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : new URL('voyages.js', location.href);
  const rootUrl = new URL('./', scriptUrl);
  const $ = (id) => document.getElementById(id) || window.HVPages?.get(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const ROUTES = {
    places:'places', dashboard: 'dashboard', map: 'map', stays: 'trips', countries: 'countries', country: 'country', calendar: 'calendar',
    stats: 'stats', homes: 'lived-in', settings: 'settings', schengen: 'schengen', planner: 'planner', rules: 'visa', profiles: 'people'
  };
  const ROUTE_TO_VIEW = Object.fromEntries(Object.entries(ROUTES).map(([view, route]) => [route, view]));
  const VIEW_TITLES = {
    places:'Places visited', dashboard: 'Overview', map: 'Map', stays: 'Trips', countries: 'Countries', country: 'Country details', calendar: 'Calendar',
    stats: 'Statistics', homes: 'Home history', settings: 'Preferences', schengen: 'Schengen', planner: 'Trip planner', rules: 'Entry requirements', profiles: 'Travellers'
  };
  const ACCOUNT_TITLES = {
    login: 'Log in', register: 'Create account', 'reset-password': 'Reset password', profile: 'My profile'
  };

  const ICONS = {
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
    homes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M9 15v6"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2V6Z"/><path d="M8 4v14M16 6v14"/></svg>',
    stays: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v12H5z"/><path d="M9 7V5h6v2M4 11h16"/></svg>',
    countries: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21M12 3C9.5 5.6 8.2 8.6 8.2 12S9.5 18.4 12 21"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    schengen: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M6.5 5.5l11 13"/></svg>',
    planner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M10 5h9v9"/></svg>',
    rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></svg>',
    profiles: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.3 3.3-6.5 7.5-6.5s6.7 2.2 7.5 6.5"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>'
  };

  function installStyles() {
    if ($('heraldVoyagesStyles') || q('link[href*="voyages.css"]')) return;
    const link = document.createElement('link');
    link.id = 'heraldVoyagesStyles';
    link.rel = 'stylesheet';
    link.href = new URL('voyages.css?v=completion-2', rootUrl).href;
    document.head.append(link);
  }
  installStyles();

  const brandAssetUrl = () => new URL(document.documentElement.dataset.theme === 'dark' ? 'assets/herald-logo-light.png' : 'assets/herald-logo-dark.png', rootUrl).href;

  function replaceText(root, re, replacement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = node.nodeValue.replace(re, replacement); });
  }

  function activeView() {
    return q('.view.active')?.id?.replace(/View$/, '') || 'dashboard';
  }

  function installBranding() {
    document.documentElement.dataset.brand = 'herald-voyages';
    const accountPage = document.body?.dataset?.accountPage;
    const view = activeView();
    document.title = accountPage
      ? `${ACCOUNT_TITLES[accountPage] || 'Account'} — Herald Voyages`
      : `${VIEW_TITLES[view] || 'Dashboard'} — Herald Voyages`;

    let theme = q('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.append(theme);
    }
    theme.content = '#8d2637';

    let desc = q('meta[name="description"]');
    if (!desc) {
      desc = document.createElement('meta');
      desc.name = 'description';
      document.head.append(desc);
    }
    desc.content = 'Herald Voyages — your personal travel atlas for trips, countries, travel days and Schengen planning.';

    qa('.brand').forEach((brand) => {
      const strong = q('strong', brand);
      const subtitle = q('span:not(.brand-mark)', brand);
      const mark = q('.brand-mark', brand);
      if (strong) strong.textContent = 'Herald Voyages';
      if (subtitle) subtitle.textContent = 'Where you’ve been. Where you’re going.';
      if (mark && !q('img', mark)) {
        mark.textContent = '';
        const img = document.createElement('img');
        img.src = brandAssetUrl();
        img.alt = '';
        img.className = 'brand-logo-mark';
        mark.append(img);
      }
    });

    qa('#heraldGuestTransferPanel, #heraldRecoveryPanel').forEach((panel) => {
      replaceText(panel, /\bHerald\b(?!\s+Voyages)/g, 'Herald Voyages');
    });
  }

  const icon = (name) => `<span class="nav-icon">${ICONS[name] || ICONS.more}</span>`;

  function installNavigation() {
    const nav = q('.sidebar .nav');
    if (!nav) return;
    const buttons = Object.fromEntries(qa('.nav-item', nav).map(b => [b.dataset.view,b]));
    ['stats','homes','settings','places'].forEach(view => {
      const b=document.createElement('button'); b.type='button'; b.className='nav-item'; b.dataset.view=view;
      b.addEventListener('click',()=>navigateToView(view)); buttons[view]=b;
    });
    Object.entries(buttons).forEach(([view,b]) => {b.innerHTML=`${icon(view)}<span class="nav-label">${VIEW_TITLES[view]}</span>`;});
    nav.replaceChildren();
    ['dashboard','stays','map','calendar'].forEach(view=>nav.append(buttons[view]));
    const group=(label,views)=>{const details=document.createElement('details');details.className='desktop-more nav-group';details.innerHTML=`<summary>${label}</summary><div class="desktop-more-links"></div>`;views.forEach(view=>q('div',details).append(buttons[view]));nav.append(details);return details};
    const explore=group('Explore',['countries','places','stats']);
    const tools=group('Tools',['schengen','planner','rules']);
    const preferences=group('Account',['homes','profiles','settings']);
    const dataButton=document.createElement('button');dataButton.type='button';dataButton.className='nav-item';dataButton.dataset.goView='settings';dataButton.textContent='Data and exports';q('div',preferences).append(dataButton);
    const logout=document.createElement('button');logout.type='button';logout.className='nav-item';logout.dataset.accountLogout='';logout.textContent='Log out';logout.hidden=true;q('div',preferences).append(logout);
    nav.addEventListener('click',e=>{if(e.target.closest('.nav-item')){explore.open=false;tools.open=false;preferences.open=false}});
    nav.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=e.target.closest('details[open]');if(open){open.open=false;open.querySelector('summary').focus();}}});
    const account=$('accountLink');if(account){account.textContent='Account';q('div',preferences).prepend(account);}
    const sync=q('[data-sync-status]');if(sync){q('.topbar').append(sync);sync.classList.add('header-sync');}
    const retry=$('retrySaveBtn');if(retry){const feedback=document.createElement('div');feedback.className='sync-feedback';q('.topbar').append(feedback);if(sync)feedback.append(sync);feedback.append(retry);}
    q('.sidebar')?.classList.remove('island');
  }

  function openMoreSheet() {
    const sheet = $('voyagesMoreSheet');
    if (!sheet) return;
    sheet.hidden = false;
    sheet._previousFocus=document.activeElement;
    setTimeout(()=>q('.sheet-close',sheet)?.focus(),0);
    requestAnimationFrame(() => sheet.classList.add('open'));
    document.body.classList.add('voyages-sheet-open');
  }

  function closeMoreSheet() {
    const sheet = $('voyagesMoreSheet');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    sheet._previousFocus?.focus();
    document.body.classList.remove('voyages-sheet-open');
    setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 220);
  }

  function installMobileNavigation() {
    if ($('voyagesMobileNav') || document.body.dataset.accountPage) return;
    const nav = document.createElement('nav');
    nav.id = 'voyagesMobileNav';
    nav.className = 'voyages-mobile-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');
    const items = [['dashboard', 'Overview'], ['stays', 'Trips'], ['map', 'Map'], ['calendar', 'Calendar']];
    nav.innerHTML = items.map(([view, label]) => `<button type="button" data-mobile-view="${view}">${icon(view)}<span>${label}</span></button>`).join('') +
      `<button type="button" data-mobile-more>${icon('more')}<span>More</span></button>`;
    document.body.append(nav);

    const sheet = document.createElement('div');
    sheet.id = 'voyagesMoreSheet';
    sheet.className = 'voyages-more-sheet';
    sheet.hidden = true;
    sheet.innerHTML = `<button class="voyages-sheet-backdrop" type="button" aria-label="Close menu"></button>
      <section class="voyages-sheet-panel" role="dialog" aria-modal="true" aria-label="More navigation">
        <div class="voyages-sheet-handle" aria-hidden="true"></div>
        <div class="voyages-sheet-head"><div><span>Herald Voyages</span><strong>More</strong></div><button type="button" class="sheet-close" aria-label="Close">${ICONS.close}</button></div>
        <p class="sheet-section-label">Explore</p><div class="voyages-sheet-grid">
          ${['countries','places','stats'].map((view) => `<button type="button" data-sheet-view="${view}">${icon(view)}<span>${VIEW_TITLES[view]}</span></button>`).join('')}
        </div><p class="sheet-section-label">Tools</p><div class="voyages-sheet-grid">
          ${['schengen','planner','rules'].map((view) => `<button type="button" data-sheet-view="${view}">${icon(view)}<span>${VIEW_TITLES[view]}</span></button>`).join('')}
        </div><p class="sheet-section-label">Account & preferences</p><div class="voyages-sheet-grid">
          ${['homes','profiles','settings'].map((view) => `<button type="button" data-sheet-view="${view}">${icon(view)}<span>${VIEW_TITLES[view]}</span></button>`).join('')}
        </div>
        <button type="button" data-sheet-view="settings">Data and exports</button><button type="button" data-account-logout hidden>Log out</button><a class="voyages-profile-link" href="profile/">${icon('profiles')}<span><strong>Profile & account</strong><small>Login, sync and guest-data transfer</small></span></a>
      </section>`;
    document.body.append(sheet);

    nav.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-mobile-view]');
      if (viewButton) { navigateToView(viewButton.dataset.mobileView); return; }
      if (event.target.closest('[data-mobile-more]')) openMoreSheet();
    });
    sheet.addEventListener('keydown', e=>{if(e.key==='Escape')closeMoreSheet();if(e.key==='Tab'){const a=qa('.voyages-sheet-panel button,.voyages-sheet-panel a',sheet);const first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
    sheet.addEventListener('click', (event) => {
      if (event.target.closest('.voyages-sheet-backdrop, .sheet-close')) { closeMoreSheet(); return; }
      const button = event.target.closest('[data-sheet-view]');
      if (button) { closeMoreSheet(); navigateToView(button.dataset.sheetView); }
    });
  }

  function installTravellerSelector() {
    const topbar=q('.topbar');
    if(!topbar||$('globalTraveller'))return;
    const label=document.createElement('label');label.className='global-traveller';label.innerHTML='<span>Traveller</span><select id="globalTraveller" aria-label="Selected traveller"></select>';
    const actions=q('.topbar-actions',topbar);topbar.insertBefore(label,actions||null);
    const refresh=()=>{const select=$('globalTraveller');if(!select)return;select.innerHTML=(state.profiles||[]).map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===state.activeProfileId?'selected':''}>${escapeHtml(p.name)}</option>`).join('');label.hidden=(state.profiles||[]).length<2;};
    label.onchange=()=>{state.activeProfileId=$('globalTraveller').value;persist();populateProfileSelects();$('visaPassport').value='';$('visaResultTitle').textContent='Choose a passport and destination';$('visaResultBody').textContent='Run a new check for the selected traveller.';lastPlannerTrip=null;$('plannerResultBody').textContent='Calculate a trip for the selected traveller.';renderAll();window.HVJourneys?.render();};
    const current=window.renderProfiles;if(typeof current==='function')window.renderProfiles=function(){current();refresh();};
    refresh();
  }

  function routeFromHash() {
    const route = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0].trim();
    if(/^country\/[A-Z]{2,3}$/i.test(route)) return 'country';
    return ROUTE_TO_VIEW[route] || (route && ROUTES[route] ? route : null);
  }

  function setRoute(view, replace = false) {
    const route = view==='country' ? 'country/'+(location.hash.match(/country\/([A-Z]{2,3})/i)?.[1]||'').toUpperCase() : ROUTES[view] || 'dashboard';
    const target = `${location.pathname}${location.search}#/${route}`;
    if (`${location.pathname}${location.search}${location.hash}` === target) return;
    history[replace ? 'replaceState' : 'pushState']({ heraldVoyagesView: view }, '', target);
  }

  function applyViewChrome(view) {
    const pageTitle = $('pageTitle');
    if (pageTitle) pageTitle.textContent = VIEW_TITLES[view] || 'Dashboard';
    document.title = `${VIEW_TITLES[view] || 'Dashboard'} — Herald Voyages`;
    if(view==='country') window.HVJourneys?.renderCountry();
    document.body.dataset.currentView = view;
    qa('.voyages-mobile-nav [data-mobile-view]').forEach((button) => button.classList.toggle('active', button.dataset.mobileView === view));
    const more = q('.voyages-mobile-nav [data-mobile-more]');
    if (more) more.classList.toggle('active', !['dashboard','map','stays','calendar'].includes(view));
    if($(`${view}View`)) $(`${view}View`).setAttribute('aria-label', VIEW_TITLES[view] || view);
    qa('.nav-item').forEach((button) => button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'));
  }

  function navigateToView(view, { replace = false, fromHistory = false } = {}) {
    if (!ROUTES[view]) view = 'dashboard';
    try {
      if (typeof window.switchView === 'function') window.switchView(view);
      else q(`.nav-item[data-view="${view}"]`)?.click();
    } catch (_) {
      q(`.nav-item[data-view="${view}"]`)?.click();
    }
    applyViewChrome(view);
    if (!fromHistory) setRoute(view, replace);
  }

  function installRouting() {
    if (document.body.dataset.accountPage) return;
    const requested = routeFromHash() || 'dashboard';
    if (requested) navigateToView(requested, { replace: true, fromHistory: true });
    else setRoute('dashboard', true);
    applyViewChrome(requested || activeView());

    window.addEventListener('popstate', () => navigateToView(routeFromHash() || 'dashboard', { fromHistory: true }));
    window.addEventListener('hashchange', () => navigateToView(routeFromHash() || 'dashboard', { fromHistory: true }));
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('.nav-item[data-view], [data-go-view]');
      if (!trigger) return;
      const view = trigger.dataset.view || trigger.dataset.goView;
      if (!ROUTES[view]) return;
      queueMicrotask(() => { applyViewChrome(view); setRoute(view); });
    });
  }

  function polishCopy() {
    if ($('addStayBtn')) $('addStayBtn').textContent = '+ Add trip';
    if ($('addStayFromListBtn')) $('addStayFromListBtn').textContent = '+ Add trip';
    const latest = q('#dashboardView #recentStays')?.closest('.panel');
    if (latest && q('h2', latest)) q('h2', latest).textContent = 'Recent and upcoming stays';
    const staysHeading = q('#staysView h2');
    if (staysHeading) staysHeading.textContent = 'Your trips';
  }

  function installCountrySearch() {
    const totals = $('countryTotals');
    if (!totals || $('countrySearch')) return;
    const panel = totals.closest('.panel');
    if (!panel) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'countries-toolbar';
    toolbar.innerHTML = `<label class="countries-search" for="countrySearch">${ICONS.search}<input id="countrySearch" type="search" placeholder="Search your countries…" autocomplete="off"><span class="sr-only">Search countries</span></label><div class="countries-summary"><strong id="countriesSummaryCount">0</strong><span>places shown</span></div>`;
    panel.insertBefore(toolbar, totals);
    const input = $('countrySearch');
    const apply = () => {
      const term = input.value.trim().toLocaleLowerCase();
      let visible = 0;
      qa('.country-row', totals).forEach((row) => {
        const match = !term || row.textContent.toLocaleLowerCase().includes(term);
        row.hidden = !match;
        if (match) visible++;
      });
      if ($('countriesSummaryCount')) $('countriesSummaryCount').textContent = String(visible);
    };
    input.addEventListener('input', apply);
    new MutationObserver(apply).observe(totals, { childList: true, subtree: true });
    apply();
  }

  function safeCountryName(code) {
    try {
      if (typeof countryByCode === 'function') return countryByCode(code)?.name || code;
      if (typeof window.countryByCode === 'function') return window.countryByCode(code)?.name || code;
    } catch (_) {}
    return code;
  }

  function friendlyDate(value) {
    if (!value) return '—';
    try { return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch (_) { return value; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function installMapExperience() {
    const map = $('worldMap');
    const panel = q('#mapView .map-panel');
    if (!map || !panel || panel.dataset.voyagesMap) return;
    panel.dataset.voyagesMap = '1';

    const toolbar = document.createElement('div');
    toolbar.className = 'voyages-map-toolbar';
    toolbar.innerHTML = `<div class="voyages-map-toolbar-copy"><span>Interactive atlas</span><strong>Select a country for its travel history</strong></div><button type="button" class="map-fullscreen-btn" aria-pressed="false">${ICONS.expand}<span>Full screen</span></button>`;
    const wrap = q('.map-wrap', panel);
    if (wrap) panel.insertBefore(toolbar, wrap);

    const accessibleCountries=()=>qa('.map-country',map).forEach(path=>{path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',safeCountryName(path.dataset.code));});
    new MutationObserver(accessibleCountries).observe(map,{childList:true,subtree:true});accessibleCountries();
    map.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.map-country')){event.preventDefault();window.HVJourneys?.openCountry(event.target.dataset.code);}});
    const full = q('.map-fullscreen-btn', toolbar);
    full?.addEventListener('click', () => {
      const next = !panel.classList.contains('map-is-fullscreen');
      panel.classList.toggle('map-is-fullscreen', next);
      document.body.classList.toggle('map-fullscreen-open', next);
      full.setAttribute('aria-pressed', String(next));
      const label = q('span', full);
      if (label) label.textContent = next ? 'Exit full screen' : 'Full screen';
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (panel.classList.contains('map-is-fullscreen')) full?.click();

      closeMoreSheet();
    });
  }

  function installDashboardHierarchy() {
    const dashboard = $('dashboardView');
    if (!dashboard || dashboard.dataset.voyagesDashboard) return;
    dashboard.dataset.voyagesDashboard = '1';
    const grid = q('.stats-grid', dashboard);
    if (!grid) return;
    qa('.stat-card', grid).forEach((card, index) => {
      card.classList.add(`voyages-stat-${index + 1}`);

    });
  }

  function installAccountChrome() {
    if (!document.body.dataset.accountPage) return;
    document.body.classList.add('voyages-account-body');
    const page = q('.account-page');
    if (page && !q('.account-brand-note', page)) {
      const brand = q('.brand', page);
      const note = document.createElement('p');
      note.className = 'account-brand-note';
      note.textContent = 'Private travel history, available wherever you go.';
      brand?.insertAdjacentElement('afterend', note);
    }
  }

  function watchDynamicBranding() {
    const observer = new MutationObserver((records) => {
      let shouldRefresh = false;
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('#heraldGuestTransferPanel, #heraldRecoveryPanel') || q('#heraldGuestTransferPanel, #heraldRecoveryPanel', node)) shouldRefresh = true;
      }));
      if (shouldRefresh) installBranding();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function installPageRouter() {
    const pages=new Map(qa('main > .view').map(el=>[el.id.replace(/View$/,''),el]));
    const host=q('.main');
    window.HVPages={
      get(id){for(const page of pages.values()){if(page.id===id)return page;const found=page.querySelector(`[id="${CSS.escape(id)}"]`);if(found)return found;}return null;},
      mount(view){const target=pages.get(view);if(!target)return;for(const page of pages.values())if(page!==target)page.remove();host.append(target);target.classList.add('active');}
    };
    const previous=window.switchView;
    window.switchView=function(view){window.HVPages.mount(view);previous(view);applyViewChrome(view);setRoute(view);window.dispatchEvent(new CustomEvent('hv-route',{detail:view}));};
    window.HVPages.mount(routeFromHash()||'dashboard');
  }

  function installAtlasPages() {
    for(const id of ['tripSearch','tripStatusFilter','tripYearFilter'])if($(id))$(id).addEventListener('input',renderStayLists);
    const homes=$('residencePanel');if(homes)$('homesView').append(homes);
    $('settingsTheme').onclick=()=>$('themeToggleBtn')?.click();
    $('settingsCount').onclick=()=>$('editCountryCountBtn')?.click();
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='secondary';exportButton.textContent='Export travel data';exportButton.onclick=()=>exportData();
    const exportNote=document.createElement('p');exportNote.className='helper';exportNote.textContent='Download all travellers and records currently loaded in this account or guest session. Keep the file private.';
    $('settingsView').querySelector('.panel').append(exportNote,exportButton);
    const privacy=document.createElement('div');privacy.innerHTML='<hr><h2>Data on this device</h2><p class="helper">Logging out keeps unsent account changes on this device so they can sync when you return. Guest history and recoverable backups also remain here. Use Account to remove pending account changes from a shared device.</p><button type="button" class="secondary" id="exportGuestData">Export guest data</button> <button type="button" class="danger-link" id="clearGuestData">Clear guest data from this device</button>';$('settingsView').querySelector('.panel').append(privacy);
    const guestKeys=()=>localStorage.getItem('whereIveBeen.localOwner.v1')?['whereIveBeen.guest.v1']:['whereIveBeen.data.v2','whereIveBeen.stays.v1'];
    $('exportGuestData').onclick=()=>{const data=guestKeys().map(k=>localStorage.getItem(k)).find(Boolean);if(!data){alert('No guest data is stored on this device.');return;}const blob=new Blob([data],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Herald-Voyages-guest.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    $('clearGuestData').onclick=()=>{if(!confirm('Clear guest history from this device? Export it first if you want to keep a copy. Account data and account recovery copies will remain.'))return;for(const key of guestKeys())localStorage.removeItem(key);location.reload();};

    const dashboard=$('dashboardView');
    const overview=document.createElement('div');overview.id='atlasOverview';overview.className='atlas-overview';
    q('.stats-grid',dashboard).before(overview);
    const calendar=$('calendarView'),calendarPanel=q('.calendar-panel',calendar),yearTools=document.createElement('div');yearTools.className='atlas-calendar-switch';
    yearTools.innerHTML='<div class="calendar-view-switch" role="group" aria-label="Calendar view"><button type="button" data-calendar-view="month" aria-pressed="true">Month</button><button type="button" data-calendar-view="year" aria-pressed="false">Year</button><button type="button" data-calendar-view="agenda" aria-pressed="false">Agenda</button></div><div id="atlasYear" class="atlas-year" hidden></div><div id="calendarAgenda" class="calendar-agenda" hidden></div>';
    calendarPanel.before(yearTools);
    const viewSwitch=q('.calendar-view-switch',yearTools);q('.calendar-toolbar',calendarPanel).append(viewSwitch);
    const showCalendarView=view=>{$('calendar').hidden=view!=='month';calendarPanel.dataset.calendarView=view;$('atlasYear').hidden=view!=='year';$('calendarAgenda').hidden=view!=='agenda';qa('button[data-calendar-view]',calendar).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calendarView===view)));renderAtlas();};
    qa('button[data-calendar-view]',calendar).forEach(button=>button.onclick=()=>showCalendarView(button.dataset.calendarView));
    calendarPanel.append($('atlasYear'),$('calendarAgenda'));yearTools.remove();
    const calendarAdd=document.createElement('button');calendarAdd.type='button';calendarAdd.className='primary compact';calendarAdd.textContent='+ Add trip';calendarAdd.onclick=()=>$('addStayBtn').click();q('.calendar-toolbar-actions',calendarPanel)?.append(calendarAdd);if(window.matchMedia('(max-width: 430px)').matches)showCalendarView('agenda');
    const countries=$('countriesView');const directory=document.createElement('article');directory.className='panel atlas-directory';
    directory.innerHTML=`<div class="panel-head"><div><p class="eyebrow">YOUR WORLD</p><h2>Country directory</h2></div></div><div class="atlas-directory-controls"><label class="field"><span>Find a country</span><input type="search" id="atlasCountrySearch" placeholder="Search countries" autocomplete="off"></label><label class="field"><span>Show</span><select id="atlasCountryFilter"><option value="visited">Visited</option><option value="all">All countries</option><option value="unvisited">Not yet visited</option><option value="planned">Planned</option></select></label></div><label class="field"><span>Continent</span><select id="atlasContinent"><option value="all">All continents</option>${['Europe','Asia','Africa','North America','South America','Oceania','Antarctica','Other locations'].map(x=>`<option>${x}</option>`).join('')}</select></label><div id="atlasCountryDirectory"></div>`;
    countries.prepend(directory);$('atlasCountrySearch').oninput=renderDirectory;$('atlasCountryFilter').onchange=renderDirectory;$('atlasContinent').onchange=renderDirectory;
    const currentDashboard=window.renderDashboard;window.renderDashboard=function(){currentDashboard();renderAtlas();};
    renderAtlas();
  }

  function atlasRecords() {
    const today=isoDate(new Date());
    return staysForProfile().filter(s=>s.start<=today&&s.status==='actual');
  }
  function atlasCoverage() {
    const universe=COUNTRIES.filter(c=>c.code!=='SEA'&&WIBCountryCount.isCounted(c.code));
    const codes=HVJourney.summary(state,isoDate(new Date())).countries;
    const visited=universe.filter(c=>codes.has(c.code));
    return {universe,visited,codes,percent:universe.length?(visited.length/universe.length*100).toFixed(1):'0.0'};
  }
  function renderDirectory() {
    const el=$('atlasCountryDirectory');if(!el)return;
    const {codes}=atlasCoverage();const term=$('atlasCountrySearch').value.trim().toLocaleLowerCase(),filter=$('atlasCountryFilter').value;
    const rows=COUNTRIES.filter(c=>c.code!=='SEA'&&c.name.toLocaleLowerCase().includes(term)&&($('atlasContinent').value==='all'||HVAtlas.region(c.code)===$('atlasContinent').value)).filter(c=>filter==='all'||filter==='visited'&&codes.has(c.code)||filter==='unvisited'&&!codes.has(c.code)||filter==='planned'&&staysForProfile().some(s=>s.countryCode===c.code&&s.status==='planned'));
    el.innerHTML=rows.length?rows.map(c=>{
      const records=atlasRecords().filter(s=>s.countryCode===c.code).sort((a,b)=>a.start.localeCompare(b.start));
      const days=new Set(records.flatMap(s=>datesForStay(s,null,isoDate(new Date()))));
      return `<a class="atlas-country country-link" href="#/country/${c.code}"><span class="atlas-country-name">${flagHtml(c.code)}<strong>${escapeHtml(c.name)}</strong></span><span>${records.length?`${days.size} logged days`:'Not yet visited'}</span><span aria-hidden="true">↗</span></a>`;
    }).join(''):'<p class="empty-state">No countries match your filters.</p>';
  }
  function renderAtlas() {
    if(!$('atlasOverview'))return;
    const {universe,visited,percent}=atlasCoverage(),records=atlasRecords(),todayDate=isoDate(new Date()),all=staysForProfile().filter(countsForPlanning);const current=all.find(s=>s.start<=todayDate&&s.end>=todayDate),next=all.filter(s=>s.status==='planned'&&s.start>todayDate).sort((a,b)=>a.start.localeCompare(b.start))[0],recent=[...records].sort((a,b)=>b.start.localeCompare(a.start))[0],featured=current||next||recent,featuredLabel=current?'CURRENT TRIP':next?'NEXT TRIP':'MOST RECENT TRIP';const members=featured?.tripId?staysForProfile().filter(s=>s.tripId===featured.tripId&&s.status!=='cancelled'):[featured].filter(Boolean),featuredDates=members.flatMap(s=>[s.start,s.end]).sort();
    const regions=HVAtlas.progress(universe,new Set(visited.map(c=>c.code))),continents=new Set(records.map(s=>HVAtlas.region(s.countryCode)).filter(r=>r!=='Other locations'));
    const today=isoDate(new Date()),year=today.slice(0,4),thisYear=new Set(records.filter(s=>s.start<=`${year}-12-31`&&s.end>=`${year}-01-01`).map(s=>s.countryCode).filter(c=>c!=='SEA'));
    $('atlasOverview').innerHTML=`<a class="atlas-current" ${featured?'href="#/trips"':'href="#/trips" data-add-first-trip'}><p class="eyebrow">${featured?featuredLabel:'YOUR TRAVEL STORY'}</p><h2>${featured?escapeHtml(state.trips.find(t=>t.id===featured.tripId)?.name||countryByCode(featured.countryCode)?.name||featured.countryName):'Your next chapter starts here'}</h2><p>${featured?`${friendlyDate(featuredDates[0])} to ${friendlyDate(featuredDates.at(-1))}`:'Add a trip to start building your personal travel atlas.'}</p><span>${featured?'Open trips':'Add your first trip'} ↗</span></a><a class="atlas-coverage" href="#/countries"><div><p class="eyebrow">WORLD COVERAGE</p><strong>${percent}<small>%</small></strong><p>${visited.length} of ${universe.length} countries in your definition · ${continents.size} continents</p></div><div class="atlas-coverage-bar" role="img" aria-label="${percent} percent visited" style="--coverage:${percent}%"></div></a><a class="atlas-year-count" href="#/stats"><p class="eyebrow">${year} SO FAR</p><strong>${thisYear.size}</strong><p>countries with recorded visits</p></a>`;
    $('dashboardGaps').closest('.panel').hidden=!staysForProfile().some(s=>s.status==='unconfirmed')&&!findGaps().length;
    const summary=HVJourney.summary(state,todayDate);
    if($('recordedTripCount'))$('recordedTripCount').textContent=summary.trips.size;
    $('schengenRemaining').closest('.stat-card').hidden=isSchengenExemptProfile()||!staysForProfile().some(s=>countsForPlanning(s)&&SCHENGEN.has(s.countryCode));
    const counts=new Map();records.forEach(s=>{if(!counts.has(s.countryCode))counts.set(s.countryCode,{days:new Set(),trips:0});const c=counts.get(s.countryCode);datesForStay(s,null,today).filter(d=>!HVJourney.isHome(state,s.countryCode,d)).forEach(d=>c.days.add(d));c.trips++;});
    const sorted=[...counts].sort((a,b)=>b[1].days.size-a[1].days.size);const max=sorted[0]?.[1].days.size||1;
    $('atlasStatistics').innerHTML=`<div class="atlas-stats-heading"><p class="eyebrow">THE SHAPE OF YOUR TRAVELS</p><h2>${visited.length} countries.<br><em>Countless memories.</em></h2><p>${percent}% of your selected country definition · ${summary.trips.size} recorded trips · ${escapeHtml(activeProfile().name)} · confirmed stays only, including home countries in country totals</p></div><article class="panel"><div class="panel-head"><h2>Travel days by country</h2><span>Excludes home days · overlapping dates counted once per country</span></div>${sorted.length?sorted.map(([code,c])=>`<div class="atlas-rank"><strong>${escapeHtml(countryByCode(code)?.name||code)}</strong><div><span style="width:${c.days.size/max*100}%"></span></div><span>${c.days.size} days · ${c.trips} stays</span></div>`).join(''):'<p class="empty-state">Your travel statistics will appear after you add your first trip.</p>'}</article>`;
    const regionPanel=document.createElement('article');regionPanel.className='panel atlas-region-panel';regionPanel.innerHTML=`<div class="panel-head"><h2>Continents explored</h2><span>${continents.size} visited · your country definition</span></div><div class="atlas-regions">${regions.map(r=>`<div><strong>${r.name}</strong><span>${r.visited} / ${r.total} countries</span><div class="atlas-coverage-bar" style="--coverage:${r.total?r.visited/r.total*100:0}%"></div></div>`).join('')}</div><p class="helper">Russia is grouped with Europe; Turkey, Cyprus and the Caucasus with Asia. Antarctica can be recorded as a place even when excluded from your country count.</p>`;$('atlasStatistics').append(regionPanel);
    const shared=document.createElement('details');shared.className='panel journey-accordion';const everyone=HVJourney.summary(state,today,'all');shared.innerHTML=`<summary>All travellers summary</summary><p>${[...everyone.countries].filter(WIBCountryCount.isCounted).length} countries · ${everyone.days.size} travel dates · ${everyone.trips.size} recorded trips</p><p class="helper">Combined confirmed history for all travellers. Each date counts once; a date is travel if any traveller was away from their own home. Individual passport tools use the traveller selected above.</p>`;$('atlasStatistics').append(shared);
    if(!$('atlasYear').hidden){const activeYear=typeof calendarCursor!=='undefined'?calendarCursor.getUTCFullYear():Number(year);$('atlasYear').innerHTML=Array.from({length:12},(_,m)=>{const prefix=`${activeYear}-${String(m+1).padStart(2,'0')}`,days=new Set(records.flatMap(s=>datesForStay(s)).filter(d=>d.startsWith(prefix)));return `<button type="button" class="atlas-month" data-atlas-month="${m}" data-atlas-year="${activeYear}"><strong>${new Date(activeYear,m,1).toLocaleDateString('en-GB',{month:'long'})}</strong><div class="atlas-month-dots">${Array.from({length:new Date(activeYear,m+1,0).getDate()},(_,d)=>`<i class="${days.has(`${prefix}-${String(d+1).padStart(2,'0')}`)?'travel':''}"></i>`).join('')}</div><small>${days.size} logged days</small></button>`}).join('');}
    if(!$('calendarAgenda').hidden){const agenda=staysForProfile().filter(s=>s.status!=='cancelled').sort((a,b)=>a.start.localeCompare(b.start));$('calendarAgenda').innerHTML=agenda.length?agenda.map(s=>`<button type="button" class="agenda-row" data-action="edit-stay" data-id="${escapeHtml(s.id)}"><span class="agenda-date">${friendlyDate(s.start)}${s.end!==s.start?` to ${friendlyDate(s.end)}`:''}</span>${flagHtml(s.countryCode,'flag-img flag-sm')}<strong>${escapeHtml(s.countryName)}</strong><span class="status-badge ${s.status==='actual'?'good':s.status==='planned'?'neutral':'warn'}">${s.status==='actual'?'CONFIRMED':s.status.toUpperCase()}</span></button>`).join(''):'<p class="empty-state">No trips or stays to show.</p>';}
    renderDirectory();
    window.HVJourneys?.render();
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-add-first-trip]')){e.preventDefault();openStayDialog();return;}
    const add=e.target.closest('[data-atlas-add]');if(add){$('addStayBtn').click();$('countryInput').value=countryByCode(add.dataset.atlasAdd)?.name||'';$('countryInput').dispatchEvent(new Event('input',{bubbles:true}));}
    const month=e.target.closest('[data-atlas-month]');if(month){calendarCursor=new Date(Date.UTC(Number(month.dataset.atlasYear),Number(month.dataset.atlasMonth),1));renderCalendar();q('[data-calendar-view="month"]')?.click();}
  });

  function boot() {
    installBranding();
    installAccountChrome();
    if (!document.body.dataset.accountPage) {
      installNavigation();
      installTravellerSelector();
      installMobileNavigation();
      installRouting();
      polishCopy();

      installDashboardHierarchy();
      installCountrySearch();
      installMapExperience();
      installAtlasPages();
      window.HVJourneys?.init();
    }
    watchDynamicBranding();
    if (!document.body.dataset.accountPage) installPageRouter();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

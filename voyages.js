/* Herald Voyages — 2026 product shell and interaction layer.
   Travel/account persistence remains in the existing app core; this layer handles
   branding, routing, responsive navigation and progressive-disclosure UI. */
(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : new URL('voyages.js', location.href);
  const rootUrl = new URL('./', scriptUrl);
  const $ = (id) => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const ROUTES = {
    dashboard: 'dashboard', map: 'map', stays: 'trips', countries: 'countries', calendar: 'calendar',
    schengen: 'schengen', planner: 'planner', rules: 'visa', profiles: 'people'
  };
  const ROUTE_TO_VIEW = Object.fromEntries(Object.entries(ROUTES).map(([view, route]) => [route, view]));
  const VIEW_TITLES = {
    dashboard: 'Dashboard', map: 'Map', stays: 'Trips', countries: 'Countries', calendar: 'Calendar',
    schengen: 'Schengen', planner: 'Trip planner', rules: 'Visa tools', profiles: 'People & homes'
  };
  const ACCOUNT_TITLES = {
    login: 'Log in', register: 'Create account', 'reset-password': 'Reset password', profile: 'My profile'
  };

  const ICONS = {
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
    if ($('heraldVoyagesStyles')) return;
    const link = document.createElement('link');
    link.id = 'heraldVoyagesStyles';
    link.rel = 'stylesheet';
    link.href = new URL('voyages.css?v=voyages-2', rootUrl).href;
    document.head.append(link);
  }
  installStyles();

  const brandAssetUrl = () => new URL('assets/wib-logo-mark.png', rootUrl).href;

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
    theme.content = '#2a2023';

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
    if (!nav || nav.dataset.voyagesReady) return;
    nav.dataset.voyagesReady = '1';

    const buttons = Object.fromEntries(qa('.nav-item', nav).map((b) => [b.dataset.view, b]));
    const labels = {
      dashboard: 'Dashboard', map: 'Map', stays: 'Trips', countries: 'Countries', calendar: 'Calendar',
      schengen: 'Schengen', planner: 'Plan a trip', rules: 'Visa tools', profiles: 'People & homes'
    };

    Object.entries(buttons).forEach(([view, button]) => {
      button.innerHTML = `${icon(view)}<span class="nav-label">${labels[view] || VIEW_TITLES[view] || view}</span>`;
      button.setAttribute('aria-label', labels[view] || view);
    });

    nav.textContent = '';
    const explore = document.createElement('div');
    explore.className = 'nav-kicker';
    explore.textContent = 'Explore';
    nav.append(explore);
    ['dashboard', 'map', 'stays', 'countries', 'calendar', 'schengen'].forEach((view) => buttons[view] && nav.append(buttons[view]));

    const tools = document.createElement('div');
    tools.className = 'nav-kicker nav-kicker-tools';
    tools.textContent = 'Tools';
    nav.append(tools);
    ['planner', 'rules', 'profiles'].forEach((view) => buttons[view] && nav.append(buttons[view]));

    const accountLink = $('accountLink');
    if (accountLink) {
      accountLink.textContent = 'Profile & account';
      accountLink.classList.add('account-nav-link');
    }
  }

  function openMoreSheet() {
    const sheet = $('voyagesMoreSheet');
    if (!sheet) return;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    document.body.classList.add('voyages-sheet-open');
  }

  function closeMoreSheet() {
    const sheet = $('voyagesMoreSheet');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    document.body.classList.remove('voyages-sheet-open');
    setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 220);
  }

  function installMobileNavigation() {
    if ($('voyagesMobileNav') || document.body.dataset.accountPage) return;
    const nav = document.createElement('nav');
    nav.id = 'voyagesMobileNav';
    nav.className = 'voyages-mobile-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');
    const items = [['dashboard', 'Dashboard'], ['map', 'Map'], ['stays', 'Trips'], ['calendar', 'Calendar']];
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
        <div class="voyages-sheet-grid">
          ${['countries','schengen','planner','rules','profiles'].map((view) => `<button type="button" data-sheet-view="${view}">${icon(view)}<span>${VIEW_TITLES[view]}</span></button>`).join('')}
        </div>
        <a class="voyages-profile-link" href="profile/">${icon('profiles')}<span><strong>Profile & account</strong><small>Login, sync and guest-data transfer</small></span></a>
      </section>`;
    document.body.append(sheet);

    nav.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-mobile-view]');
      if (viewButton) { navigateToView(viewButton.dataset.mobileView); return; }
      if (event.target.closest('[data-mobile-more]')) openMoreSheet();
    });
    sheet.addEventListener('click', (event) => {
      if (event.target.closest('.voyages-sheet-backdrop, .sheet-close')) { closeMoreSheet(); return; }
      const button = event.target.closest('[data-sheet-view]');
      if (button) { closeMoreSheet(); navigateToView(button.dataset.sheetView); }
    });
  }

  function routeFromHash() {
    const route = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0].trim();
    return ROUTE_TO_VIEW[route] || (route && ROUTES[route] ? route : null);
  }

  function setRoute(view, replace = false) {
    const route = ROUTES[view] || 'dashboard';
    const target = `${location.pathname}${location.search}#/${route}`;
    if (`${location.pathname}${location.search}${location.hash}` === target) return;
    history[replace ? 'replaceState' : 'pushState']({ heraldVoyagesView: view }, '', target);
  }

  function applyViewChrome(view) {
    const pageTitle = $('pageTitle');
    if (pageTitle) pageTitle.textContent = VIEW_TITLES[view] || 'Dashboard';
    document.title = `${VIEW_TITLES[view] || 'Dashboard'} — Herald Voyages`;
    document.body.dataset.currentView = view;
    qa('.voyages-mobile-nav [data-mobile-view]').forEach((button) => button.classList.toggle('active', button.dataset.mobileView === view));
    const more = q('.voyages-mobile-nav [data-mobile-more]');
    if (more) more.classList.toggle('active', !['dashboard','map','stays','calendar'].includes(view));
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
    const requested = routeFromHash();
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
    if (latest && q('h2', latest)) q('h2', latest).textContent = 'Recent journeys';
    const staysHeading = q('#staysView h2');
    if (staysHeading) staysHeading.textContent = 'Trips & journeys';
  }

  function installPageIntros() {
    if (document.body.dataset.accountPage) return;
    const intros = {
      dashboard: ['Your travel atlas', 'A clear view of where you have been, what is coming next, and the practical limits that matter.'],
      map: ['The world, your way', 'Explore your recorded countries across time and open a country to see the journeys behind it.'],
      stays: ['Journeys', 'Your travel history in chronological form — easy to scan, add to and edit.'],
      countries: ['World coverage', 'Search the places in your travel record and see how your personal country count is building.'],
      calendar: ['Travel calendar', 'See home, travel and planned days in context, then select dates to add a journey.'],
      schengen: ['90 / 180 at a glance', 'A practical rolling-window view of Schengen use, remaining days and upcoming risk.'],
      planner: ['Plan before you book', 'Test a proposed entry date against your existing travel history.'],
      rules: ['Visa tools', 'A fast planning check with clear reminders to verify live entry rules.'],
      profiles: ['People, passports & homes', 'Manage traveller profiles and the places you have lived without mixing them into your trip list.']
    };
    Object.entries(intros).forEach(([view, [title, copy]]) => {
      const section = $(`${view}View`);
      if (!section || q(':scope > .voyages-page-intro', section)) return;
      const intro = document.createElement('div');
      intro.className = 'voyages-page-intro';
      intro.innerHTML = `<div><p>${title}</p><span>${copy}</span></div>`;
      section.prepend(intro);
    });
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

  function countryHistory(code) {
    try {
      const records = typeof state !== 'undefined' && Array.isArray(state.stays) ? state.stays : (Array.isArray(window.state?.stays) ? window.state.stays : []);
      const stays = records.filter((stay) => stay.countryCode === code).sort((a, b) => a.start.localeCompare(b.start));
      const actual = stays.filter((stay) => stay.status !== 'planned');
      const first = actual[0] || stays[0] || null;
      const latest = actual.at(-1) || stays.at(-1) || null;
      let days = 0;
      try {
        const unique = new Set();
        stays.forEach((stay) => (typeof datesForStay === 'function' ? datesForStay(stay) : []).forEach((day) => unique.add(day)));
        days = unique.size;
      } catch (_) {}
      return { stays, first, latest, days };
    } catch (_) {
      return { stays: [], first: null, latest: null, days: 0 };
    }
  }

  function friendlyDate(value) {
    if (!value) return '—';
    try { return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch (_) { return value; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function closeCountryDrawer() {
    const drawer = $('voyagesCountryDrawer');
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('open');
    setTimeout(() => { if (!drawer.classList.contains('open')) drawer.hidden = true; }, 180);
  }

  function openCountryDrawer(code) {
    const drawer = $('voyagesCountryDrawer');
    if (!drawer) return;
    const history = countryHistory(code);
    const name = safeCountryName(code);
    drawer.innerHTML = `<div class="country-drawer-head"><div><span>Country record</span><strong>${escapeHtml(name)}</strong></div><button type="button" class="country-drawer-close" aria-label="Close">${ICONS.close}</button></div>
      <div class="country-drawer-stats"><div><span>Trips</span><strong>${history.stays.length}</strong></div><div><span>Logged days</span><strong>${history.days || '—'}</strong></div></div>
      <dl><div><dt>First visit</dt><dd>${friendlyDate(history.first?.start)}</dd></div><div><dt>Most recent</dt><dd>${friendlyDate(history.latest?.end || history.latest?.start)}</dd></div></dl>
      <button type="button" class="secondary country-drawer-link">Open Countries</button>`;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('open'));
    q('.country-drawer-close', drawer)?.addEventListener('click', closeCountryDrawer);
    q('.country-drawer-link', drawer)?.addEventListener('click', () => {
      closeCountryDrawer();
      navigateToView('countries');
      const search = $('countrySearch');
      if (search) {
        search.value = name;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.focus();
      }
    });
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

    const drawer = document.createElement('aside');
    drawer.id = 'voyagesCountryDrawer';
    drawer.className = 'voyages-country-drawer';
    drawer.setAttribute('aria-live', 'polite');
    drawer.hidden = true;
    panel.append(drawer);

    map.addEventListener('click', (event) => {
      const code = event.target.closest('.map-country')?.dataset?.code;
      if (code) openCountryDrawer(code);
    });

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
      closeCountryDrawer();
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
      card.setAttribute('tabindex', '0');
    });
  }

  function installSyncBadge() {
    if (document.body.dataset.accountPage) return;
    const sync = q('[data-sync-status]');
    const topbar = q('.topbar');
    if (!sync || !topbar || $('voyagesTopSync')) return;
    const badge = document.createElement('div');
    badge.id = 'voyagesTopSync';
    badge.className = 'voyages-top-sync';
    badge.innerHTML = '<span class="sync-dot"></span><span>Loading account…</span>';
    const action = $('addStayBtn');
    if (action) action.before(badge);
    const text = q('span:last-child', badge);
    const update = () => { if (text) text.textContent = sync.textContent.trim() || 'Saved locally'; };
    new MutationObserver(update).observe(sync, { childList: true, characterData: true, subtree: true });
    update();
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

  function boot() {
    installBranding();
    installAccountChrome();
    if (!document.body.dataset.accountPage) {
      installNavigation();
      installMobileNavigation();
      installRouting();
      polishCopy();
      installPageIntros();
      installDashboardHierarchy();
      installCountrySearch();
      installMapExperience();
      installSyncBadge();
    }
    watchDynamicBranding();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

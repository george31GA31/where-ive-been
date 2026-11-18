/* Herald's shared shell. Saved travel stays in the existing account/core model. */
(() => {
  'use strict';

  const scriptURL = new URL(document.currentScript?.src || 'voyages.js', location.href);
  const rootURL = new URL('./', scriptURL);
  const routes = {calendar:'calendar', roadTrip:'trip-planner', currency:'currency', settings:'settings'};
  const titles = {calendar:'Calendar', roadTrip:'Trip Planner', currency:'Currency Converter', settings:'Settings'};
  const accountTitles = {login:'Sign in', register:'Create account', 'reset-password':'Reset password', profile:'Account'};
  const plannerViews = new Set(['roadTrip', 'journeys', 'planner', 'stayPlanner']);
  const plannerRoutes = new Set(['road-trip', 'roadTrip', 'journey-map', 'plan-a-trip', 'planner', 'travel-tools/road-trip', 'travel-tools/stay-planner']);
  const get = id => document.getElementById(id) || window.HVPages?.get(id);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));

  function allowedView(view) {
    if (routes[view]) return view;
    if (plannerViews.has(view)) return 'roadTrip';
    if (['profiles', 'homes'].includes(view)) return 'settings';
    return 'calendar';
  }

  function routeView() {
    const route = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0].replace(/\/$/, '');
    if (plannerRoutes.has(route)) return 'roadTrip';
    if (route === 'travel-tools/currency') return 'currency';
    if (['people', 'profiles', 'lived-in'].includes(route)) return 'settings';
    return Object.keys(routes).find(view => routes[view] === route) || 'calendar';
  }

  function updateRoute(view, replace) {
    const suffix = routeView() === view ? location.hash.match(/[?&].*$/)?.[0] || '' : '';
    const next = `${location.pathname}${location.search}#/${routes[view]}${suffix}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next) {
      history[replace ? 'replaceState' : 'pushState']({heraldVoyagesView:view}, '', next);
    }
  }

  function updateChrome(view) {
    document.body.dataset.currentView = view;
    if (get('pageTitle')) get('pageTitle').textContent = titles[view];
    document.title = `${titles[view]} — Herald Voyages`;
    for (const link of document.querySelectorAll('[data-nav-view]')) {
      const current = link.dataset.navView === view;
      link.classList.toggle('active', current);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    get(`${view}View`)?.setAttribute('aria-label', titles[view]);
  }

  function branding() {
    document.documentElement.dataset.brand = 'herald-voyages';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Herald Voyages — your travel calendar and journey planner.';
    for (let brand of document.querySelectorAll('.brand')) {
      if (brand.tagName !== 'A') {
        const link = document.createElement('a');
        link.className = brand.className;
        link.append(...brand.childNodes);
        brand.replaceWith(link);
        brand = link;
      }
      brand.href = new URL('index.html#/calendar', rootURL).href;
      brand.setAttribute('aria-label', 'Herald Voyages Calendar');
      brand.querySelector('strong')?.replaceChildren(document.createTextNode('Herald'));
      const subtitle = brand.querySelector('div > span');
      subtitle?.remove();
      const mark = brand.querySelector('.brand-mark');
      if (mark && !mark.querySelector('img')) {
        const image = document.createElement('img');
        image.src = new URL(document.documentElement.dataset.theme === 'dark' ? 'assets/herald-logo-light.png' : 'assets/herald-logo-dark.png', rootURL).href;
        image.className = 'brand-logo-mark';
        image.alt = '';
        mark.replaceChildren(image);
      }
    }
  }

  function navigation() {
    const nav = document.querySelector('.sidebar .nav');
    const sidebar = document.querySelector('.sidebar');
    if (!nav || !sidebar) return;
    nav.id = 'heraldPrimaryNav';
    nav.replaceChildren();
    for (const view of ['calendar', 'roadTrip', 'currency']) {
      const link = document.createElement('a');
      link.href = '#/' + routes[view];
      link.className = 'nav-item';
      link.dataset.navView = view;
      link.textContent = titles[view];
      nav.append(link);
    }

    const existingAccess = document.querySelector('.topbar .herald-account-access');
    const footer = document.querySelector('.sidebar-footer');
    const account = document.createElement('details');
    account.className = 'simple-account-menu';
    const summary = document.createElement('summary');
    summary.textContent = 'Account';
    const menu = document.createElement('div');
    menu.className = 'simple-account-options';
    const controls = [get('accountLink'), footer?.querySelector('[data-account-guest]'), existingAccess?.querySelector('[data-account-logout]')];
    for (const control of controls) if (control) menu.append(control);
    const settingsLink = document.createElement('a');
    settingsLink.href = '#/settings';
    settingsLink.dataset.navView = 'settings';
    settingsLink.textContent = 'Settings';
    menu.append(settingsLink);
    account.append(summary, menu);

    const status = sidebar.querySelector('[data-sync-status]');
    const retry = get('retrySaveBtn');
    const statusRow = document.createElement('div');
    statusRow.className = 'page-save-status';
    for (const node of [status, retry]) if (node) statusRow.append(node);
    document.querySelector('.topbar')?.append(statusRow);
    const theme = get('themeToggleBtn');
    footer?.replaceChildren(...[theme, account].filter(Boolean));
    existingAccess?.remove();
    sidebar.classList.remove('island');

    document.addEventListener('click', event => { if (!account.contains(event.target)) account.open = false; });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && account.open) { account.open = false; summary.focus(); }
    });
    for (const container of [nav, menu]) container.addEventListener('click', event => {
      const link = event.target.closest('[data-nav-view]');
      if (!link) return;
      event.preventDefault();
      account.open = false;
      window.switchView(link.dataset.navView);
    });
  }

  function settings() {
    const page = get('settingsView');
    const profiles = get('profilesView');
    const travellerDetails = page?.querySelector('[data-settings-travellers]');
    if (travellerDetails && profiles) travellerDetails.append(...profiles.children);
    const dataDetails = page?.querySelector('[data-settings-data]');
    const dataPanel = get('dataTransferPanel');
    if (dataDetails && dataPanel) dataDetails.append(dataPanel);
    if (dataDetails && !dataPanel) {
      const description = document.createElement('p');
      description.className = 'helper';
      description.textContent = 'Download all records currently loaded for this account or guest session.';
      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.id = 'simpleExportData';
      exportButton.className = 'secondary';
      exportButton.textContent = 'Export travel data';
      exportButton.addEventListener('click', () => exportData());
      const accountLink = document.createElement('a');
      accountLink.href = 'profile/';
      accountLink.className = 'text-btn';
      accountLink.textContent = 'Guest transfers & account sync';
      const links = document.createElement('p');
      links.append(accountLink);
      dataDetails.append(description, exportButton, links);
    }
    get('settingsTheme')?.addEventListener('click', () => get('themeToggleBtn')?.click());

    const label = document.createElement('label');
    label.className = 'global-traveller';
    label.innerHTML = '<span>Traveller</span><select id="globalTraveller" aria-label="Selected traveller"></select>';
    document.querySelector('.topbar')?.append(label);
    let lastSignature = '';
    const refresh = () => {
      const signature = JSON.stringify([state.activeProfileId, (state.profiles || []).map(profile => [profile.id, profile.name])]);
      if (signature === lastSignature) return;
      lastSignature = signature;
      label.hidden = (state.profiles || []).length < 2;
      label.querySelector('select').innerHTML = (state.profiles || []).map(profile => `<option value="${escapeHTML(profile.id)}" ${profile.id === state.activeProfileId ? 'selected' : ''}>${escapeHTML(profile.name)}</option>`).join('');
    };
    label.addEventListener('change', () => {
      state.activeProfileId = label.querySelector('select').value;
      persist();
      populateProfileSelects();
      window.renderAll();
      window.dispatchEvent(new CustomEvent('hv-data-changed'));
    });
    window.addEventListener('hv-data-changed', refresh);
    window.addEventListener('hv-route', refresh);
    const renderProfiles = window.renderProfiles;
    window.renderProfiles = function(...args) { const result = renderProfiles.apply(this, args); refresh(); return result; };
    refresh();
  }

  function router() {
    const pages = new Map([...document.querySelectorAll('main > .view')].map(page => [page.id.replace(/View$/, ''), page]));
    const host = document.querySelector('.main');
    const elements = new Map();
    const revisions = new Map();
    const rendered = new Map();
    const scrollPositions = new Map();
    let revision = 0;
    let forcedRevision = 0;
    let previousView = 'calendar';
    const featureRevision = view => HVData.token(state, [...new Set([...HVData.collections, 'roadTrips'])]) + '|' + (revisions.get(view) || 0);
    const stamp = view => [state, forcedRevision, featureRevision(view), state.activeProfileId, isoDate(new Date()), view === 'calendar' ? calendarCursor.getTime() : ''];
    window.HVPages = {
      get(id) {
        const cached = elements.get(id);
        if (cached && [...pages.values()].some(page => page === cached || page.contains(cached))) return cached;
        for (const page of pages.values()) {
          const element = page.id === id ? page : page.querySelector(`[id="${CSS.escape(id)}"]`);
          if (element) { elements.set(id, element); return element; }
        }
        return null;
      },
      get revision() { return revision; },
      revisionFor:featureRevision,
      reusing:false,
      invalidateViews(views) { for (const view of views) { revisions.set(view, (revisions.get(view) || 0) + 1); rendered.delete(view); } },
      markRendered(view) { rendered.set(view, stamp(view)); },
      invalidate(changed) { revision++; if (!changed) { forcedRevision++; rendered.clear(); } },
      mount(view) {
        const target = pages.get(allowedView(view));
        if (!target) return;
        for (const page of pages.values()) if (page !== target) page.remove();
        host.append(target);
        target.classList.add('active');
      }
    };
    const save = window.persist;
    window.persist = function(...args) {
      window.HVPages.invalidate(HVData.observe(state, [...HVData.collections, 'roadTrips', 'routeData', 'logoData']));
      return save.apply(this, args);
    };
    const render = window.renderAll;
    window.renderAll = function(...args) {
      HVData.observe(state);
      const result = render.apply(this, args);
      const view = document.body.dataset.currentView || 'calendar';
      if (view === 'settings') window.renderProfiles();
      rendered.set(view, stamp(view));
      return result;
    };
    const switchView = window.switchView;
    window.switchView = function(requested, {replaceRoute = false} = {}) {
      const view = allowedView(requested);
      scrollPositions.set(previousView, window.scrollY);
      const old = rendered.get(view);
      const reuse = old && stamp(view).every((value, index) => value === old[index]);
      window.HVPages.mount(view);
      switchView(view, {render:false, scroll:false});
      updateChrome(view);
      updateRoute(view, replaceRoute || view !== requested);
      if (!reuse) window.renderAll();
      window.HVPages.reusing = !!reuse;
      try { window.dispatchEvent(new CustomEvent('hv-route', {detail:view})); }
      finally { window.HVPages.reusing = false; }
      previousView = view;
      window.scrollTo({top:scrollPositions.get(view) || 0, behavior:'instant'});
    };
    window.addEventListener('hv-data-changed', () => { elements.clear(); rendered.clear(); });
    window.addEventListener('popstate', () => window.switchView(routeView(), {replaceRoute:true}));
    window.addEventListener('hashchange', () => window.switchView(routeView(), {replaceRoute:true}));
    window.switchView(routeView(), {replaceRoute:true});
  }

  function boot() {
    branding();
    if (document.body.dataset.accountPage) {
      document.title = `${accountTitles[document.body.dataset.accountPage] || 'Account'} — Herald Voyages`;
      return;
    }
    navigation();
    settings();
    window.HVJourneys?.init();
    router();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

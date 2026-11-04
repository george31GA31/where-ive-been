/* Herald V1 presentation: projections only; travel writes stay in explicit editors. */
(() => {
  'use strict';
  const get = id => document.getElementById(id) || window.HVPages?.get(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const motionKey = 'herald.experience.motion.v1', themeKey = 'herald.experience.theme.v1';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  let features, mapLoad, observer, frame = 0, pointerTarget, activeProfile;
  const scoped = rows => HVJourney.scoped(rows || [], state.activeProfileId);
  const cancelled = () => new Set((state.trips || []).filter(t => t.status === 'cancelled').map(t => t.id));
  const eligible = r => r.status !== 'cancelled' && !cancelled().has(r.tripId);
  function motionAllowed() { return !reduced.matches && localStorage.getItem(motionKey) !== 'off'; }
  function syncPreferences() {
    document.documentElement.dataset.experienceMotion = motionAllowed() ? 'on' : 'off';
    const button = get('v1Motion');
    if (button) { button.setAttribute('aria-pressed', String(localStorage.getItem(motionKey) !== 'off')); button.textContent = reduced.matches ? 'Motion reduced by device' : localStorage.getItem(motionKey) === 'off' ? 'Motion off' : 'Motion on'; }
  }
  function chooseTheme(mode) {
    localStorage.setItem(themeKey, mode);
    const select = get('v1ThemeMode'); if (select) select.value = mode;
    if (mode === 'clock') {
      const hour = new Date().getHours(), desired = hour >= 7 && hour < 19 ? 'light' : 'dark';
      if (document.documentElement.dataset.theme !== desired) get('themeToggleBtn')?.click();
    }
  }
  function preferences() {
    const host = get('settingsView')?.querySelector('.panel');
    if (!host || get('v1Appearance')) return;
    const section = document.createElement('section'); section.id = 'v1Appearance'; section.className = 'v1-preferences';
    section.innerHTML = '<h2>Make the atlas feel yours</h2><p class="helper">Motion follows your device’s accessibility setting. A time-based theme is applied when you open Herald; your theme button always remains available.</p><button type="button" class="secondary" id="v1Motion" aria-pressed="true">Motion on</button><label class="field"><span>Theme schedule</span><select id="v1ThemeMode"><option value="manual">My chosen light or dark theme</option><option value="clock">Local daytime and night</option></select></label><label class="field"><span>Home map atmosphere</span><select id="v1Atmosphere"><option value="none">None</option><option value="sun">Golden light · decorative</option><option value="rain">Rain · decorative</option><option value="snow">Snow · decorative</option></select></label><p class="helper">Atmosphere is an artistic effect, not recorded weather. It appears only on the Home map.</p>';
    host.prepend(section);
    get('v1Motion').onclick = () => { localStorage.setItem(motionKey, localStorage.getItem(motionKey) === 'off' ? 'on' : 'off'); syncPreferences(); };
    get('v1ThemeMode').value = localStorage.getItem(themeKey) || 'manual';
    get('v1ThemeMode').onchange = event => chooseTheme(event.target.value);
    const atmosphere = get('v1Atmosphere');
    atmosphere.value = localStorage.getItem('herald.experience.atmosphere.v1') || 'none';
    document.documentElement.dataset.atmosphere = atmosphere.value;
    atmosphere.onchange = () => { localStorage.setItem('herald.experience.atmosphere.v1', atmosphere.value); document.documentElement.dataset.atmosphere = atmosphere.value; home(); };
    // Manual theme input takes precedence over an opted-in schedule.
    get('themeToggleBtn')?.addEventListener('click', event => { if (event.isTrusted) { localStorage.setItem(themeKey, 'manual'); get('v1ThemeMode').value = 'manual'; } });
    get('settingsTheme')?.addEventListener('click', event => { if (event.isTrusted) { localStorage.setItem(themeKey, 'manual'); get('v1ThemeMode').value = 'manual'; } });
    chooseTheme(localStorage.getItem(themeKey) || 'manual'); syncPreferences();
  }
  function home() {
    if (window.HVMotionExperience) { HVMotionExperience.home(); return; }
    const host = get('dashboardView'), hero = host?.querySelector('.home-hero');
    if (!hero) return;
    if (!hero.querySelector('.v1-geography')) {
      const figure = document.createElement('figure'); figure.className = 'v1-geography';
      figure.innerHTML = '<span class="v1-map-grid" aria-hidden="true"></span><a href="#/map" aria-label="Explore your recorded countries in Atlas"><svg viewBox="0 0 600 290" role="img" aria-label="Your recorded countries on a world map"></svg><span class="v1-map-fallback" hidden>Map unavailable. Explore your recorded countries in Atlas →</span><span class="v1-map-caption">YOUR WORLD, CONNECTED <span aria-hidden="true">↗</span></span></a><span class="v1-compass" aria-hidden="true">N<br>✧</span>';
      hero.append(figure);
    }
    let atmosphereLabel = hero.querySelector('.v1-atmosphere-label');
    const atmosphere = get('v1Atmosphere')?.value || 'none';
    if (atmosphere !== 'none') { if (!atmosphereLabel) { atmosphereLabel = document.createElement('span'); atmosphereLabel.className = 'v1-atmosphere-label'; hero.querySelector('.v1-geography').append(atmosphereLabel); } atmosphereLabel.textContent = 'Decorative ' + (atmosphere === 'sun' ? 'golden light' : atmosphere); } else atmosphereLabel?.remove();
    if (!host.querySelector('.v1-explore')) {
      const nav = document.createElement('nav'); nav.className = 'v1-explore'; nav.setAttribute('aria-label', 'Explore your travel');
      nav.innerHTML = [['calendar','Calendar','Every date, in place'],['trips','Journeys','The whole story'],['map','Atlas','Follow your history'],['places','Places','Find a saved address'],['stats','Statistics','Explore the years']].map(([route,label,description], i) => `<a href="#/${route}"><span class="v1-index">0${i+1}</span><span><strong>${label}</strong><small>${description}</small></span><span aria-hidden="true">↗</span></a>`).join('');
      get('atlasOverview').after(nav);
    }
    drawHomeMap();
  }
  function drawHomeMap() {
    if (window.HVMotionExperience) { if (document.body.dataset.currentView === 'dashboard') HVMotionExperience.home(); return; }
    const svg = get('dashboardView')?.querySelector('.v1-geography svg');
    if (!svg || matchMedia('(max-width:650px)').matches || !window.d3 || !window.topojson) return;
    if (!features) {
      if (!mapLoad) mapLoad = fetch('data/countries-110m.json').then(r => { if (!r.ok) throw Error('map'); return r.json(); }).then(data => { features = topojson.feature(data, data.objects.countries).features; const fallback = svg.parentElement.querySelector('.v1-map-fallback'); if (fallback) fallback.hidden = true; drawHomeMap(); }).catch(() => { mapLoad = null; svg.setAttribute('aria-label', 'Map unavailable. Open Atlas to explore the country list.'); const fallback = svg.parentElement.querySelector('.v1-map-fallback'); if (fallback) fallback.hidden = false; });
      return;
    }
    const summary = HVJourney.summary(state, isoDate(new Date()));
    const current = new Set(scoped(state.stays).filter(eligible).filter(r => r.start <= isoDate(new Date()) && (!r.end || r.end >= isoDate(new Date()))).map(r => r.countryCode));
    const signature = state.activeProfileId + ':' + [...summary.countries].sort().join(',') + ':' + [...current].sort().join(',');
    if (svg.dataset.signature === signature) return;
    svg.dataset.signature = signature;
    const projection = d3.geoNaturalEarth1().fitExtent([[8,8],[592,282]], {type:'FeatureCollection',features});
    const path = d3.geoPath(projection), ns = 'http://www.w3.org/2000/svg';
    svg.replaceChildren();
    for (const feature of features) {
      const code = NUMERIC_TO_ALPHA2[String(feature.id).padStart(3,'0')];
      const shape = document.createElementNS(ns, 'path'); shape.setAttribute('d', path(feature) || '');
      shape.setAttribute('class', 'v1-land' + (summary.countries.has(code) ? ' v1-land-visited' : '') + (current.has(code) ? ' v1-land-current' : '')); svg.append(shape);
    }
  }
  function atlas() {
    const host = get('mapView'), panel = host?.querySelector('.map-panel'), summary = get('mapCountrySummary');
    if (!panel || !summary) return;
    let layout = host.querySelector('.v1-atlas-layout');
    if (!layout) {
      layout = document.createElement('div'); layout.className = 'v1-atlas-layout'; panel.before(layout); layout.append(panel, summary);
      const welcome = document.createElement('aside'); welcome.className = 'v1-atlas-index';
      welcome.innerHTML = '<p class="eyebrow">YOUR PERSONAL ATLAS</p><h2>A world of your own.</h2><p>Choose a country on the map or explore your recorded places below.</p><label class="field"><span>Find a recorded country</span><input type="search" id="v1AtlasSearch" placeholder="Country name" autocomplete="off"></label><div class="v1-atlas-countries"></div><a class="text-btn" href="#/countries">All countries & definitions →</a>';
      layout.append(welcome);
      welcome.querySelector('input').oninput = () => atlasIndex();
      new MutationObserver(() => { welcome.hidden = !summary.hidden; layout.classList.toggle('has-selection', !summary.hidden); }).observe(summary, {attributes:true, attributeFilter:['hidden']});
      welcome.hidden = !summary.hidden;
    }
    atlasIndex();
  }
  function atlasIndex() {
    const host = get('mapView')?.querySelector('.v1-atlas-countries'); if (!host) return;
    const term = (get('v1AtlasSearch')?.value || '').trim().toLocaleLowerCase();
    const summary = HVJourney.summary(state, isoDate(new Date()));
    const countries = [...summary.countries].map(code => countryByCode(code)).filter(Boolean).filter(c => c.name.toLocaleLowerCase().includes(term)).sort((a,b) => a.name.localeCompare(b.name));
    host.innerHTML = countries.map(c => `<button type="button" data-v1-atlas-country="${E(c.code)}">${flagHtml(c.code, 'flag-img flag-sm')}<span>${E(c.name)}</span><span aria-hidden="true">↗</span></button>`).join('') || '<p class="helper">No recorded countries match. The directory includes unvisited places too.</p>';
  }
  function country() {
    const host = get('countryDetails');
    if (!host || host.querySelector('.v1-country-context')) return;
    const code = location.hash.match(/country\/([A-Z]{2,3})/i)?.[1]?.toUpperCase();
    if (!code) return;
    const header = host.querySelector('.country-heading'); if (!header) return;
    const context = document.createElement('nav'); context.className = 'v1-country-context'; context.setAttribute('aria-label', 'Country exploration');
    context.innerHTML = '<a class="text-btn" href="#/map">← Back to Atlas</a><a class="text-btn" href="#/trips">Explore journeys →</a>'; header.before(context);
    const records = HVJourney.summary(state, isoDate(new Date())).stays.filter(s => s.countryCode === code).sort((a,b) => a.start.localeCompare(b.start));
    const rows = [...host.querySelectorAll('.journey-accordion .reference-row')];
    rows.forEach((row, index) => {
      const stay = records[index]; if (!stay) return;
      const edit = row.querySelector('[data-action="edit-stay"]');
      if (edit) { edit.removeAttribute('data-action'); edit.removeAttribute('data-id'); edit.dataset.v1Read = 'country'; edit.dataset.recordId = stay.id; edit.textContent = 'View visit'; }
      const trip = scoped(state.trips).find(t => t.id === stay.tripId);
      if (!trip) return;
      const links = document.createElement('div'); links.className = 'v1-related-journey';
      const hotels = scoped(state.accommodations).filter(eligible).filter(r => r.tripId === trip.id && r.checkIn <= (stay.end || isoDate(new Date())) && r.checkOut >= stay.start);
      links.innerHTML = `<a href="#/trips?trip=${encodeURIComponent(trip.id)}">${E(trip.name)} ↗</a>` + hotels.map(r => `<a href="${E(window.HVV1Readers?.recordLink('accommodation', r.id) || '#/calendar')}">${E(r.propertyName || 'Accommodation')} →</a>`).join('');
      links.setAttribute('aria-label','Named journey and its accommodation on these dates'); row.append(links);
    });
  }
  function decorate() {
    const view = document.body.dataset.currentView;
    if (activeProfile !== state.activeProfileId) { activeProfile = state.activeProfileId; pointerTarget = null; }
    if (view === 'dashboard') home();
    if (view === 'map') atlas();
    if (view === 'country') country();
    // Native lists and controls remain usable without observer/animation support.
    document.querySelectorAll('.home-upcoming-row,.trip-card,.travel-memory-panel,.travel-tool-link').forEach(el => {
      if (!el.dataset.v1Reveal) { el.dataset.v1Reveal = 'ready'; observer?.observe(el); }
    });
    updateProgress();
  }
  function journeyStory(dialog) {
    if (!dialog?.matches('dialog[data-trip-id]') || dialog.querySelector('.v1-journey-story')) return;
    const trip = scoped(state.trips).find(t => t.id === dialog.dataset.tripId), panel = dialog.querySelector('#tripOverviewPanel');
    if (!trip || !panel) return;
    const stays = scoped(state.stays).filter(eligible).filter(r => r.tripId === trip.id).sort((a,b) => a.start.localeCompare(b.start));
    if (!stays.length) return;
    const story = document.createElement('details'); story.className = 'v1-journey-story';
    story.innerHTML = `<summary>Follow this journey <span>${stays.length} recorded ${stays.length === 1 ? 'chapter' : 'chapters'} <span aria-hidden="true">↗</span></span></summary><p class="helper">A sequence of your linked country visits. Open a chapter for its field notes. This is chronology, not a navigation route.</p><div class="v1-story-chapters"><span class="v1-story-meter" aria-hidden="true"></span>${stays.map((stay,i) => `<article class="v1-story-chapter"><span class="v1-story-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><p class="eyebrow">${E(stay.start)} ${stay.end ? '— '+E(stay.end) : '— ongoing'}</p><h3><a href="#/country/${E(stay.countryCode)}">${E(stay.countryName || countryByCode(stay.countryCode)?.name || 'Recorded visit')}</a></h3>${stay.notes ? `<details class="v1-field-note"><summary>Read field notes</summary><p>${E(stay.notes)}</p></details>` : '<p class="helper">No field notes recorded for this visit.</p>'}<button type="button" class="text-btn" data-v1-read="country" data-record-id="${E(stay.id)}">Open visit details →</button></div></article>`).join('')}</div>`;
    panel.prepend(story);
    const progress = () => { const rect = story.getBoundingClientRect(), port = dialog.getBoundingClientRect(); const value = Math.max(0, Math.min(1, (port.bottom - rect.top) / Math.max(1, rect.height + port.height * .2))); story.style.setProperty('--v1-story-progress', String(value)); };
    if (dialog._v1StoryScroll) dialog.removeEventListener('scroll',dialog._v1StoryScroll,true);
    dialog._v1StoryScroll = progress;
    dialog.addEventListener('scroll', progress, {passive:true,capture:true}); story.addEventListener('toggle',progress); progress();
  }
  function updateProgress() {
    const range = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--v1-read-progress', String(range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0));
  }
  function boot() {
    if (document.body.dataset.accountPage || !window.HVPages) return;
    document.documentElement.dataset.heraldEdition = 'v1';
    preferences();
    get('calendarView')?.querySelectorAll('.calendar-filter-menu,.calendar-display-menu').forEach(menu => { menu.open = false; });
    if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.dataset.v1Reveal = 'visible'; observer.unobserve(entry.target); } }), {rootMargin:'40px'});
    const progress = document.createElement('div'); progress.className = 'v1-reading-progress'; progress.setAttribute('aria-hidden','true'); document.body.append(progress);
    const announcement = document.createElement('p'); announcement.className = 'sr-only'; announcement.id = 'v1RouteAnnouncement'; announcement.setAttribute('role','status'); document.body.append(announcement);
    const render = window.renderAll; window.renderAll = function(...args) { const result = render.apply(this,args); decorate(); return result; };
    window.addEventListener('hv-route', () => { decorate(); announcement.textContent = (get('pageTitle')?.textContent || 'Herald') + ' · ' + (state.profiles?.find(p => p.id === state.activeProfileId)?.name || 'selected traveller'); });
    window.addEventListener('travel-libs-ready', drawHomeMap);
    window.addEventListener('online', () => { if (document.body.dataset.currentView === 'dashboard') drawHomeMap(); });
    const countryHost = get('countryDetails'); if (countryHost) new MutationObserver(() => { if (document.body.dataset.currentView === 'country' && !countryHost.querySelector('.v1-country-context')) country(); }).observe(countryHost,{childList:true});
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node instanceof Element) { journeyStory(node); const dialog = node.closest('dialog[data-trip-id]'); if (dialog) journeyStory(dialog); } }))).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click', event => { const target = event.target.closest('[data-v1-atlas-country]'); if (target) { HVJourneys.openCountry(target.dataset.v1AtlasCountry); const heading = get('mapCountrySummary')?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); } } });
    document.addEventListener('keydown', event => { if (event.key !== 'Escape') return; const menu = get('calendarView')?.querySelector('.calendar-filter-menu[open],.calendar-display-menu[open]'); if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); } });
    reduced.addEventListener('change', syncPreferences);
    window.addEventListener('scroll', updateProgress, {passive:true}); window.addEventListener('resize', () => { updateProgress(); if (document.body.dataset.currentView === 'dashboard') drawHomeMap(); }, {passive:true});
    document.addEventListener('pointermove', event => {
      if (!motionAllowed() || !fine.matches) return;
      const target = event.target.closest('.v1-geography,.home-hero-actions .primary');
      if (pointerTarget && pointerTarget !== target) { pointerTarget.style.removeProperty('--v1-x'); pointerTarget.style.removeProperty('--v1-y'); pointerTarget.style.removeProperty('--v1-dx'); pointerTarget.style.removeProperty('--v1-dy'); }
      pointerTarget = target; if (!target || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; if (!target.isConnected) return; const rect = target.getBoundingClientRect(); target.style.setProperty('--v1-x', (event.clientX - rect.left) + 'px'); target.style.setProperty('--v1-y', (event.clientY - rect.top) + 'px'); target.style.setProperty('--v1-dx', ((event.clientX - rect.left) / rect.width - .5) * 5 + 'px'); target.style.setProperty('--v1-dy', ((event.clientY - rect.top) / rect.height - .5) * 5 + 'px'); });
    }, {passive:true});
    decorate(); window.HVV1Experience = {refresh:decorate, motionAllowed};
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

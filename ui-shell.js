/* Herald Voyages — application shell, routing and presentation logic.
   Core travel calculations and persistence remain in app-core/account modules. */
(() => {
  'use strict';

  const BRAND = 'Herald Voyages';
  const LOGO = new URL('assets/wib-logo-mark.png', document.currentScript.src).href;
  const ROUTE_TO_VIEW = {dashboard:'dashboard',map:'map',trips:'stays',countries:'countries',calendar:'calendar',stats:'stats',schengen:'schengen',planner:'planner',visa:'rules',lived:'lived',profile:'profiles'};
  const VIEW_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_VIEW).map(([route, view]) => [view, route]));
  const PAGE_META = {
    dashboard:['YOUR TRAVEL ATLAS','Dashboard','A living record of the world you’ve explored.'],
    map:['THE ATLAS','Map','Explore your travels across place and time.'],
    stays:['JOURNEYS','Trips','Every journey, planned and remembered.'],
    countries:['WORLD COVERAGE','Countries','The places that make up your personal world.'],
    calendar:['TRAVEL CALENDAR','Calendar','See your travel history in time.'],
    stats:['YOUR TRAVEL PATTERNS','Statistics','The numbers behind where you’ve been.'],
    schengen:['90 / 180','Schengen','A clear view of your rolling short-stay allowance.'],
    planner:['BEFORE YOU BOOK','Trip planner','Test a journey against the travel history you already have.'],
    rules:['ENTRY REQUIREMENTS','Visa tools','A planning check before you verify the live rule.'],
    lived:['HOME, OVER TIME','Lived in','Tell the tracker where home was so travel days stay accurate.'],
    profiles:['TRAVELLERS + DATA','Profiles','Traveller identities, passports and account access.']
  };

  const ICONS = {
    compass:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/></svg>',
    map:'<svg viewBox="0 0 24 24"><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2z"/><path d="M8 4v13M16 7v13"/></svg>',
    route:'<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></svg>',
    globe:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    chart:'<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V4M19 20v-7"/></svg>',
    timer:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 13V8M9 3h6"/></svg>',
    spark:'<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></svg>',
    passport:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M8.5 12h7M12 8.5a7 7 0 0 1 0 7M12 8.5a7 7 0 0 0 0 7"/></svg>',
    home:'<svg viewBox="0 0 24 24"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    moon:'<svg viewBox="0 0 24 24"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
    sun:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    footsteps:'<svg viewBox="0 0 24 24"><path d="M8.8 4.5c1.6.8 1.8 3.4.8 5.5-.8 1.7-2.2 2.5-3.5 1.8-1.5-.8-1.7-3.5-.7-5.5.8-1.7 2.1-2.5 3.4-1.8ZM15.7 12.4c1.3-.7 2.7.2 3.5 1.8 1 2.1.8 4.8-.7 5.5-1.3.7-2.7-.1-3.5-1.8-1-2.1-.8-4.7.7-5.5Z"/></svg>',
    alert:'<svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17.5h.01"/></svg>',
    expand:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  const CONTINENTS = {
    Africa:new Set('DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'.split(' ')),
    Europe:new Set('AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA XK'.split(' ')),
    Asia:new Set('AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE'.split(' ')),
    'North America':new Set('AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC US'.split(' ')),
    'South America':new Set('AR BO BR CL CO EC GY PY PE SR UY VE'.split(' ')),
    Oceania:new Set('AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU'.split(' ')),
    Antarctica:new Set(['AQ'])
  };

  function byId(id){ return document.getElementById(id); }
  function setIcon(el, name){ if (el && ICONS[name]) el.innerHTML = ICONS[name]; }
  function installIcons(root=document){ root.querySelectorAll('[data-icon]').forEach(el => setIcon(el, el.dataset.icon)); }

  function applyTheme(theme){
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem('whereIveBeen.theme.v1', dark ? 'dark' : 'light');
    const button = byId('themeToggleBtn');
    if (button) {
      button.dataset.theme = dark ? 'dark' : 'light';
      button.setAttribute('aria-label', dark ? 'Use light appearance' : 'Use dark appearance');
      setIcon(button.querySelector('[data-icon]') || button, dark ? 'sun' : 'moon');
    }
    let meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#151216' : '#2d1b21';
  }

  function installBrand(){
    document.title = `${BRAND} — Your world, remembered`;
    document.querySelectorAll('.brand-mark').forEach(mark => {
      mark.innerHTML = `<img class="brand-logo-mark" src="${LOGO}" alt="">`;
    });
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) { favicon=document.createElement('link'); favicon.rel='icon'; document.head.appendChild(favicon); }
    favicon.href=LOGO; favicon.type='image/png';
    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) { apple=document.createElement('link'); apple.rel='apple-touch-icon'; document.head.appendChild(apple); }
    apple.href=LOGO;
  }

  function visitedCountryCodes(today = isoDate(new Date())){
    const raw = new Set(state.stays.filter(s => s.status !== 'planned' && s.start <= today && s.countryCode && s.countryCode !== 'SEA').map(s => s.countryCode));
    const model = window.WIBCountryCount;
    return new Set([...raw].filter(code => model?.isCounted ? model.isCounted(code) : code !== 'BOU'));
  }

  function daysByCountry(today=isoDate(new Date())){
    const map = new Map();
    state.stays.forEach(stay => {
      if (stay.status === 'planned' || stay.start > today || !stay.countryCode || stay.countryCode === 'SEA') return;
      if (!map.has(stay.countryCode)) map.set(stay.countryCode, new Set());
      datesForStay(stay).filter(d => d <= today).forEach(d => map.get(stay.countryCode).add(d));
    });
    return [...map].map(([code, days]) => ({code, name:countryByCode(code)?.name || code, days:days.size})).sort((a,b)=>b.days-a.days || a.name.localeCompare(b.name));
  }

  function continentCount(codes){
    return Object.values(CONTINENTS).filter(set => [...codes].some(code => set.has(code))).length;
  }

  function countriesThisYear(today=isoDate(new Date())){
    const year = today.slice(0,4);
    return new Set(state.stays.filter(s => s.status !== 'planned' && s.countryCode !== 'SEA' && s.start.slice(0,4) === year && s.start <= today).map(s => s.countryCode)).size;
  }

  function actualStays(today=isoDate(new Date())){
    return state.stays.filter(s => s.status !== 'planned' && s.start <= today).sort((a,b)=>b.start.localeCompare(a.start));
  }

  function renderRanking(rows, limit=5){
    if (!rows.length) return '<div class="empty-state">No travel history yet.</div>';
    const max = Math.max(...rows.slice(0,limit).map(r => r.days),1);
    return rows.slice(0,limit).map((row, index) => `<div class="ranking-row"><span class="ranking-position">${String(index+1).padStart(2,'0')}</span><span class="ranking-name">${esc(row.name)}</span><span class="ranking-bar"><i style="width:${Math.max(8,row.days/max*100)}%"></i></span><span class="ranking-days">${row.days}d</span></div>`).join('');
  }

  function milestoneData(today=isoDate(new Date())){
    const stays = actualStays(today).slice().sort((a,b)=>a.start.localeCompare(b.start));
    if (!stays.length) return [{title:'Start logging',text:'Your milestones will build automatically from your travel history.'}];
    const first = stays[0];
    const longest = stays.slice().sort((a,b)=>daysInclusive(b.start,b.end)-daysInclusive(a.start,a.end))[0];
    const codes = visitedCountryCodes(today);
    const thresholds = [10,25,50,75,100,150].filter(n => codes.size >= n);
    const data = [
      {title:`First recorded journey`,text:`${first.countryName} · ${fmt(first.start,{day:'numeric',month:'short',year:'numeric'})}`},
      {title:'Longest recorded stay',text:`${longest.countryName} · ${daysInclusive(longest.start,longest.end)} days`}
    ];
    if (thresholds.length) data.push({title:`${thresholds.at(-1)}-country milestone`,text:`Your atlas has passed ${thresholds.at(-1)} counted countries.`});
    else data.push({title:'Next country milestone',text:`${10-codes.size > 0 ? 10-codes.size : 1} more counted ${10-codes.size===1?'country':'countries'} to reach 10.`});
    return data;
  }

  function renderMilestones(target, data){
    if (!target) return;
    target.innerHTML = data.map(item => `<div><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></div>`).join('');
  }

  function journeyLabel(stay){
    if (!stay) return '';
    const dates = stay.start === stay.end ? fmt(stay.start,{day:'numeric',month:'short',year:'numeric'}) : `${fmt(stay.start,{day:'numeric',month:'short'})} – ${fmt(stay.end,{day:'numeric',month:'short',year:'numeric'})}`;
    return {name:stay.countryName, dates, notes:stay.notes || `${daysInclusive(stay.start,stay.end)} ${daysInclusive(stay.start,stay.end)===1?'day':'days'}`};
  }

  function renderJourneyFeature(today=isoDate(new Date())){
    const current = state.stays.filter(s => s.status !== 'planned' && s.start <= today && s.end >= today).sort((a,b)=>b.start.localeCompare(a.start))[0];
    const recent = actualStays(today)[0];
    const primary = current || recent;
    const host = byId('currentJourneyCard');
    if (host) {
      if (primary) {
        const info=journeyLabel(primary);
        host.innerHTML=`<span class="journey-marker"></span><div><small>${current?'Current journey':'Most recent journey'}</small><strong>${esc(info.name)}</strong><span>${esc(info.dates)}${info.notes?` · ${esc(info.notes)}`:''}</span></div>`;
      } else host.innerHTML='<span class="journey-marker"></span><div><small>Most recent journey</small><strong>Nothing recorded yet</strong><span>Add your first trip to begin your atlas.</span></div>';
    }
    const upcoming = state.stays.filter(s => s.start > today || s.status === 'planned' && s.end >= today).sort((a,b)=>a.start.localeCompare(b.start))[0];
    const up=byId('upcomingJourneyCard');
    if (up) {
      up.hidden=!upcoming;
      if (upcoming) { const info=journeyLabel(upcoming); up.innerHTML=`<span class="journey-marker"></span><div><small>Next up</small><strong>${esc(info.name)}</strong><span>${esc(info.dates)}</span></div>`; }
    }
  }

  function renderDerivedDashboard(){
    if (typeof state === 'undefined') return;
    const today=isoDate(new Date());
    const visited=visitedCountryCodes(today), percent=Math.min(100,visited.size/195*100), continents=continentCount(visited), yearCount=countriesThisYear(today);
    const ids = {
      worldVisitedPercent:`${percent.toFixed(percent < 10 ? 1 : 0)}%`,continentsVisited:String(continents),countriesThisYear:String(yearCount),mapVisitedCount:String(visited.size),
      countriesSummaryCount:String(visited.size),countriesSummaryPercent:`${percent.toFixed(1)}%`,statsCountries:String(visited.size),statsWorldPercent:`${percent.toFixed(1)}% of the world`,statsContinents:String(continents),statsThisYear:String(yearCount)
    };
    Object.entries(ids).forEach(([id,value]) => { const el=byId(id); if(el) el.textContent=value; });
    const bar=byId('worldVisitedProgress'); if(bar) bar.style.width=`${percent}%`;
    const statsDays=byId('statsDays'); if(statsDays) statsDays.textContent=travelDaySet().size;
    const rolling = isSchengenExemptProfile() ? null : rollingStatus(today);
    const sh=byId('schengenHeroRemaining'); if(sh) sh.textContent=rolling ? Math.max(0,rolling.remaining) : '—';
    const rows=daysByCountry(today);
    const top=renderRanking(rows);
    if(byId('topCountries')) byId('topCountries').innerHTML=top;
    if(byId('statsTopCountries')) byId('statsTopCountries').innerHTML=top;
    const milestones=milestoneData(today);
    renderMilestones(byId('travelMilestones'),milestones); renderMilestones(byId('statsMilestones'),milestones);
    renderJourneyFeature(today);
    const actual=actualStays(today).slice().sort((a,b)=>a.start.localeCompare(b.start));
    const span=byId('loggedDateSpan');
    if(span) span.textContent=actual.length?`${fmt(actual[0].start,{month:'short',year:'numeric'})} → ${fmt(actual.at(-1).end,{month:'short',year:'numeric'})}`:'Build your timeline by adding stays.';
    const cap=byId('dashboardMapCaption'); if(cap) cap.textContent=visited.size?`${visited.size} counted ${visited.size===1?'country':'countries'} visited so far.`:'Your visited countries will appear here.';
  }

  function syncDashboardMap(){
    const source=byId('worldMap'), target=byId('dashboardWorldMap');
    if (!source || !target || !source.querySelector('path')) return;
    target.innerHTML=source.innerHTML;
    target.querySelectorAll('path').forEach(path => { path.removeAttribute('style'); path.removeAttribute('tabindex'); });
  }

  function annotateCountryRows(){
    const container=byId('countryTotals'); if(!container) return;
    container.querySelectorAll('.country-row').forEach(row => {
      const code=row.querySelector('[data-country]')?.dataset.country;
      if (!code) return;
      row.dataset.code=code;
      const latest=state.stays.filter(s=>s.countryCode===code && s.status!=='planned').sort((a,b)=>b.end.localeCompare(a.end))[0]?.end || '';
      row.dataset.latest=latest;
      row.dataset.name=(countryByCode(code)?.name||code).toLowerCase();
    });
    applyCountryFilters();
  }

  function applyCountryFilters(){
    const container=byId('countryTotals'); if(!container) return;
    const query=(byId('countrySearch')?.value||'').trim().toLowerCase();
    const active=document.querySelector('[data-country-filter].active')?.dataset.countryFilter || 'all';
    const rows=[...container.querySelectorAll('.country-row')];
    rows.forEach(row => { row.hidden=!!query && !row.dataset.name?.includes(query) && !row.textContent.toLowerCase().includes(query); });
    if(active==='recent') rows.sort((a,b)=>(b.dataset.latest||'').localeCompare(a.dataset.latest||'')).forEach(row=>container.appendChild(row));
    if(active==='most') rows.sort((a,b)=>Number(b.querySelector('.country-count strong')?.textContent||0)-Number(a.querySelector('.country-count strong')?.textContent||0)).forEach(row=>container.appendChild(row));
  }

  function openCountryDrawer(code){
    if (!code || code==='SEA') return;
    const drawer=byId('mapCountryDrawer'); if(!drawer) return;
    const today=isoDate(new Date());
    const visits=state.stays.filter(s=>s.countryCode===code && s.status!=='planned' && s.start<=today).sort((a,b)=>a.start.localeCompare(b.start));
    const all=state.stays.filter(s=>s.countryCode===code).sort((a,b)=>a.start.localeCompare(b.start));
    const days=new Set(); visits.forEach(s=>datesForStay(s).filter(d=>d<=today).forEach(d=>days.add(d)));
    const name=countryByCode(code)?.name||code;
    drawer.innerHTML=`<div class="map-drawer-head"><div>${flagHtml(code,'flag-img flag-lg')}<h3>${esc(name)}</h3></div><button type="button" class="map-drawer-close" aria-label="Close">×</button></div><div class="map-drawer-stats"><div><span>Trips</span><strong>${visits.length}</strong></div><div><span>Days</span><strong>${days.size}</strong></div><div><span>First visit</span><strong>${visits.length?fmt(visits[0].start,{month:'short',year:'numeric'}):'—'}</strong></div></div><div class="map-drawer-visits">${all.length?all.slice(-4).reverse().map(s=>`${s.status==='planned'?'Planned':'Visited'} · ${fmt(s.start,{day:'numeric',month:'short',year:'numeric'})}${s.start!==s.end?` – ${fmt(s.end,{day:'numeric',month:'short',year:'numeric'})}`:''}`).join('<br>'):'No trip record yet.'}</div>`;
    drawer.hidden=false;
    drawer.querySelector('.map-drawer-close').onclick=()=>{drawer.hidden=true;};
  }

  function setPageMeta(view){
    const meta=PAGE_META[view]||PAGE_META.dashboard;
    if(byId('pageEyebrow')) byId('pageEyebrow').textContent=meta[0];
    if(byId('pageTitle')) byId('pageTitle').textContent=meta[1];
    if(byId('pageSubtitle')) byId('pageSubtitle').textContent=meta[2];
    document.title=`${meta[1]} — ${BRAND}`;
  }

  function currentRoute(){ return location.hash.replace(/^#\/?/,'').split(/[/?]/)[0] || 'dashboard'; }

  const coreSwitchView = typeof switchView === 'function' ? switchView : null;
  if (coreSwitchView) {
    switchView = function(view, options={}){
      const exists=byId(`${view}View`);
      if (!exists) view='dashboard';
      coreSwitchView(view);
      setPageMeta(view);
      document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===view));
      const route=VIEW_TO_ROUTE[view]||'dashboard';
      document.querySelectorAll('[data-mobile-route]').forEach(item=>item.classList.toggle('active',item.dataset.mobileRoute===route));
      if(!options.fromRoute){
        const hash=`#/${route}`;
        if(location.hash!==hash) history.pushState({route},'',hash);
      }
      if(view==='stats') renderDerivedDashboard();
      if(view==='lived') moveResidencePanel();
    };
  }

  function goRoute(route, replace=false){
    const clean=ROUTE_TO_VIEW[route]?route:'dashboard', view=ROUTE_TO_VIEW[clean];
    if(replace) history.replaceState({route:clean},'',`#/${clean}`);
    switchView(view,{fromRoute:true});
  }

  function moveResidencePanel(){
    const panel=byId('residencePanel'), mount=byId('residencePageMount');
    if(panel&&mount&&panel.parentElement!==mount) mount.appendChild(panel);
  }

  function installMobileNav(){
    document.querySelectorAll('[data-mobile-route]').forEach(btn=>btn.addEventListener('click',()=>goRoute(btn.dataset.mobileRoute)));
    const sheet=byId('mobileMoreSheet'), backdrop=byId('mobileMoreBackdrop'), host=byId('mobileMoreLinks');
    const entries=[['countries','globe','Countries'],['stats','chart','Statistics'],['schengen','timer','Schengen'],['planner','spark','Trip planner'],['visa','passport','Visa tools'],['lived','home','Lived in']];
    if(host) { host.innerHTML=entries.map(([route,icon,label])=>`<button type="button" data-more-route="${route}"><span data-icon="${icon}"></span><span>${label}</span></button>`).join(''); installIcons(host); }
    const close=()=>{sheet?.classList.remove('open');backdrop?.classList.remove('open');if(sheet)sheet.setAttribute('aria-hidden','true');if(backdrop)backdrop.hidden=true;};
    const open=()=>{if(backdrop)backdrop.hidden=false;requestAnimationFrame(()=>{sheet?.classList.add('open');backdrop?.classList.add('open');if(sheet)sheet.setAttribute('aria-hidden','false');});};
    document.querySelector('[data-mobile-more]')?.addEventListener('click',open); byId('closeMobileMore')?.addEventListener('click',close); backdrop?.addEventListener('click',close);
    host?.addEventListener('click',e=>{const b=e.target.closest('[data-more-route]');if(!b)return;close();goRoute(b.dataset.moreRoute);});
  }

  function installWidgetMotion(){
    document.addEventListener('click',e=>{
      const widget=e.target.closest('[data-expand-widget]'); if(!widget || e.target.closest('button,a,input,select')) return;
      const open=widget.getAttribute('aria-expanded')==='true'; widget.setAttribute('aria-expanded',String(!open));
    });
    document.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-expand-widget][role="button"]')){e.preventDefault();e.target.click();}
    });
    const score=document.querySelector('.world-score');
    score?.addEventListener('click',()=>{
      let detail=score.querySelector('.world-score-detail');
      if(!detail){detail=document.createElement('span');detail.className='world-score-detail';score.appendChild(detail);}
      const visited=[...visitedCountryCodes()].map(code=>countryByCode(code)?.name||code).slice(-5).reverse();
      detail.textContent=visited.length?`Recently counted: ${visited.join(' · ')}`:'Add a journey to begin your country count.';
      score.classList.toggle('expanded');score.setAttribute('aria-expanded',String(score.classList.contains('expanded')));
    });
  }

  function installMapInteractions(){
    const map=byId('worldMap');
    map?.addEventListener('click',e=>{const path=e.target.closest('path[data-code]');if(path?.dataset.code)openCountryDrawer(path.dataset.code);});
    const full=byId('mapFullscreenBtn');
    full?.addEventListener('click',()=>{const host=document.querySelector('.map-experience');host?.classList.toggle('map-fullscreen');full.innerHTML=host?.classList.contains('map-fullscreen')?'<span aria-hidden="true">×</span> Exit full screen':`${ICONS.expand} Full screen`;});
    if(map){new MutationObserver(()=>syncDashboardMap()).observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
  }

  function installCountryControls(){
    byId('countrySearch')?.addEventListener('input',applyCountryFilters);
    byId('countryFilter')?.addEventListener('click',e=>{const b=e.target.closest('[data-country-filter]');if(!b)return;byId('countryFilter').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));applyCountryFilters();});
  }

  function protectAccountLinkMarkup(){
    const anchor=byId('accountLink');
    if(anchor?.tagName==='A'){
      const strong=anchor.querySelector('strong');
      if(strong){anchor.removeAttribute('id');strong.id='accountLink';}
    }
  }

  // Wrap final renderers after the calculation/enhancement modules have installed theirs.
  if(typeof renderDashboard==='function'){
    const core=renderDashboard;
    renderDashboard=function(){core();renderDerivedDashboard();};
  }
  if(typeof renderCountries==='function'){
    const core=renderCountries;
    renderCountries=function(){core();annotateCountryRows();renderDerivedDashboard();};
  }
  if(typeof renderMapTimeline==='function'){
    const core=renderMapTimeline;
    renderMapTimeline=function(){const result=core();renderDerivedDashboard();setTimeout(syncDashboardMap,0);return result;};
  }
  if(typeof renderProfiles==='function'){
    const core=renderProfiles;
    renderProfiles=function(){core();setTimeout(moveResidencePanel,0);};
  }

  document.addEventListener('DOMContentLoaded',()=>{
    installBrand(); installIcons(); protectAccountLinkMarkup();
    applyTheme(localStorage.getItem('whereIveBeen.theme.v1')==='dark'?'dark':'light');
    byId('themeToggleBtn')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    installMobileNav(); installWidgetMotion(); installMapInteractions(); installCountryControls(); moveResidencePanel();
    renderDerivedDashboard(); syncDashboardMap(); annotateCountryRows();
    const route=currentRoute(); goRoute(route,true);
    window.addEventListener('hashchange',()=>goRoute(currentRoute(),false));
    window.addEventListener('popstate',()=>goRoute(currentRoute(),false));
    window.addEventListener('travel-libs-ready',()=>setTimeout(syncDashboardMap,80));
  });
})();

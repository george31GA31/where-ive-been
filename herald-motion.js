/* A kinetic personal atlas. Presentation reads the existing records; editors own all writes. */
(() => {
  'use strict';
  document.documentElement.dataset.heraldMotion='atlas';
  const get = id => document.getElementById(id) || window.HVPages?.get(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover:hover) and (pointer:fine)');
  let activeHero, globe, pendingFrame = 0;
  const allowed = () => !reduced.matches && document.documentElement.dataset.experienceMotion !== 'off';
  function scope(rows) { return HVJourney.scoped(rows || [],state.activeProfileId); }
  function mapOptions() {
    const day = isoDate(new Date()), summary = HVJourney.summary(state,day);
    const cancelled = new Set((state.trips || []).filter(t=>t.status==='cancelled').map(t=>t.id));
    const current = new Set(scope(state.stays).filter(r=>r.status!=='cancelled'&&!cancelled.has(r.tripId)&&r.start<=day&&(!r.end||r.end>=day)).map(r=>r.countryCode));
    return {countries:summary.countries,current,focusCode:[...current][0],label:'Your personal travel globe',onCountry:code=>{
      const navigate=()=>{switchView('map');HVJourneys.openCountry(code);const heading=get('mapCountrySummary')?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}};
      if(allowed()&&document.startViewTransition)document.startViewTransition(navigate);else navigate();
    }};
  }
  function quickActions(hero) {
    const host=hero.querySelector('.motion-today-items');if(!host)return;
    const nodes=[...get('todayAgenda')?.querySelectorAll('.daily-entry')||[]].slice(0,2);
    const types=[['agendaHotel','accommodation'],['transportEdit','transport'],['calendarEditStay','country'],['dayNoteEdit','note'],['agendaPlace','location']];
    const signature=state.activeProfileId+':'+nodes.map(n=>{const type=types.find(([attr])=>n.dataset[attr]);return (type?type[1]+':'+n.dataset[type[0]]:'')+':'+n.textContent;}).join('|');
    if(host.dataset.signature===signature)return;host.dataset.signature=signature;
    host.replaceChildren();
    for(const source of nodes){
      const record=types.find(([attr])=>source.dataset[attr]);if(!record)continue;
      const button=document.createElement('button');button.type='button';button.className='motion-dock-record';button.dataset.v1Read=record[1];button.dataset.recordId=source.dataset[record[0]];
      button.innerHTML=`<span class="motion-dock-kind">${record[1]==='accommodation'?'Stay':record[1]==='country'?'Country':record[1]}</span><strong>${E(source.querySelector('strong')?.textContent||'Travel record')}</strong><small>${E(source.querySelector('small')?.textContent||'Open details')}</small><span class="motion-arrow" aria-hidden="true">↗</span>`;
      host.append(button);
    }
    if(!host.children.length)host.innerHTML='<button type="button" class="motion-dock-record" data-motion-calendar><span class="motion-dock-kind">Room for a new chapter</span><strong>No travel recorded today</strong><small>Open Calendar to explore your dates</small><span class="motion-arrow" aria-hidden="true">↗</span></button>';
  }
  function journal() {
    const host=get('dashboardView'),day=isoDate(new Date());if(!host)return;
    const trips=scope(state.trips).filter(t=>t.status!=='cancelled').sort((a,b)=>String(b.start||'').localeCompare(String(a.start||''))).slice(0,3);
    let section=host.querySelector('.motion-journal');
    if(!trips.length){section?.remove();return;}
    const signature=HVData.token(state,['trips','stays','profiles'],state.activeProfileId+'|'+day);
    if(section?.dataset.signature===signature)return;
    if(!section){section=document.createElement('section');section.className='motion-journal';get('travelMemoryPanel')?.before(section);if(!section.isConnected)host.append(section);}
    section.dataset.signature=signature;
    section.innerHTML=`<header><p class="eyebrow">THE JOURNAL</p><h2>Every journey.<br><em>A different story.</em></h2><a href="#/trips" class="motion-text-link">Explore all journeys <span aria-hidden="true">↗</span></a></header><div class="motion-journal-cards">${trips.map((trip,i)=>{
      const countries=[...new Set(scope(state.stays).filter(r=>r.tripId===trip.id&&r.status!=='cancelled').map(r=>r.countryCode))];
      const photos=Array.isArray(trip.photos)?trip.photos:[],photo=photos.find(p=>p.id===trip.coverPhotoId)||photos[0],safePhoto=photo&&/^data:image\/(?:png|jpe?g|webp);base64,/i.test(photo.src||'');
      const phase=trip.start>day?'Upcoming':trip.end&&trip.end<day?'From the archive':'In your atlas';
      return `<a class="motion-postcard postcard-${i}" href="#/trips?trip=${encodeURIComponent(trip.id)}" style="--card-index:${i}"><div class="motion-postcard-art">${safePhoto?`<img loading="lazy" src="${E(photo.src)}" alt="${E(photo.name||trip.name)}">`:`<span class="motion-postcard-no" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="motion-postcard-flags">${countries.slice(0,3).map(code=>flagHtml(code,'flag-img flag-sm')).join('')}</span><span class="motion-postcard-stamp" aria-hidden="true">HERALD<br>FIELD JOURNAL<br>✧</span>`}</div><div class="motion-postcard-copy"><span>${E(phase)} · ${E(trip.start?.slice(0,4)||'Dates to add')}</span><h3>${E(trip.name||'Your journey')}</h3><p>${E(trip.start||'Dates to add')}${trip.end?' — '+E(trip.end):''}</p><span class="motion-postcard-open">Open the story <span aria-hidden="true">↗</span></span></div></a>`;
    }).join('')}</div>`;
  }
  function scrollScene() {
    if(pendingFrame)return;
    pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(!activeHero?.isConnected||document.body.dataset.currentView!=='dashboard')return;
      const box=activeHero.getBoundingClientRect(),progress=Math.max(0,Math.min(1,(80-box.top)/Math.max(1,box.height)));
      activeHero.dataset.scrollProgress=progress.toFixed(3);document.documentElement.style.setProperty('--motion-scroll',allowed()?progress.toFixed(3):'0');
    });
  }
  function home() {
    const host=get('dashboardView'),hero=host?.querySelector('.home-hero');if(!hero)return;
    document.documentElement.dataset.heraldMotion='atlas';
    if(activeHero!==hero){globe?.destroy();globe=null;activeHero=hero;}
    if(!hero.classList.contains('motion-home')){
      const info=hero.firstElementChild,actions=hero.querySelector('.home-hero-actions');
      const name=info?.querySelector('h2');if(name){const heading=document.createElement('h3');heading.innerHTML=name.innerHTML;name.replaceWith(heading);}
      hero.classList.add('motion-home','motion-scene');hero.dataset.scrollProgress='0';
      hero.innerHTML='<div class="motion-contours" aria-hidden="true"><svg viewBox="0 0 1400 700" preserveAspectRatio="none"><path d="M-100 480C100 40 450 700 700 200S1250-100 1500 310M-100 520C90 80 480 740 740 240S1280-60 1500 350M-100 560C80 120 510 780 780 280S1310-20 1500 390M-100 600C70 160 540 820 820 320S1340 20 1500 430M-100 640C60 200 570 860 860 360S1370 60 1500 470"/></svg></div><div class="motion-hero-copy"><p class="motion-overline">HERALD VOYAGES <span>YOUR PERSONAL ATLAS</span></p><h2 class="motion-title"><span>A life</span><em>in motion.</em></h2><p class="motion-hero-intro">Follow the places.<br>Keep the feeling.</p><div class="motion-featured"></div></div><div class="v1-geography motion-globe-stage"><svg viewBox="0 0 600 600" role="img" aria-label="Your recorded countries on an interactive globe"></svg></div><div class="motion-globe-note"><span class="motion-small-cross" aria-hidden="true">✧</span><span>YOUR WORLD IS STILL UNFOLDING</span><a href="#/map">Explore Atlas ↗</a></div><div class="motion-today-dock"><div class="motion-dock-heading"><span class="motion-live-dot" aria-hidden="true"></span><strong>Today, in your world.</strong><button type="button" data-motion-agenda>Full daily view ↓</button></div><div class="motion-today-items"></div></div><span class="motion-corner-mark" aria-hidden="true">HV — 01 / EXPLORER</span>';
      const featured=hero.querySelector('.motion-featured');if(info)featured.append(info);if(actions)featured.append(actions);
      hero.addEventListener('pointermove',event=>{if(!allowed()||!fine.matches)return;const box=hero.getBoundingClientRect();hero.style.setProperty('--scene-x',((event.clientX-box.left)/box.width-.5).toFixed(3));hero.style.setProperty('--scene-y',((event.clientY-box.top)/box.height-.5).toFixed(3));});
      hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--scene-x','0');hero.style.setProperty('--scene-y','0');});
    }
    if(window.HVMotionGlobe){if(!globe)globe=HVMotionGlobe.mount(hero.querySelector('.motion-globe-stage'),mapOptions());else globe.update(mapOptions());}
    const atmosphere=get('v1Atmosphere')?.value||'none';
    let atmosphereLabel=hero.querySelector('.v1-atmosphere-label');
    if(atmosphere!=='none'){if(!atmosphereLabel){atmosphereLabel=document.createElement('span');atmosphereLabel.className='v1-atmosphere-label';hero.append(atmosphereLabel);}atmosphereLabel.textContent='Decorative '+(atmosphere==='sun'?'golden light':atmosphere);}else atmosphereLabel?.remove();
    quickActions(hero);
    let nav=host.querySelector('.v1-explore');
    if(!nav){nav=document.createElement('nav');nav.className='v1-explore';nav.setAttribute('aria-label','Explore your travel');get('atlasOverview').after(nav);}
    if(!nav.dataset.motionPortals){nav.dataset.motionPortals='true';nav.innerHTML=[['calendar','The dates.','Your days, connected.'],['map','The places.','A world that is yours.'],['trips','Journeys','Read every chapter'],['places','Saved places','Find your way back'],['stats','Your history','See the bigger picture']].map(([route,label,copy],i)=>`<a href="#/${route}"><span class="v1-index">0${i+1}</span><span><strong>${E(label)}</strong><small>${E(copy)}</small></span><span aria-hidden="true">↗</span></a>`).join('');}
    journal();scrollScene();
  }
  function boot(){
    document.addEventListener('click',event=>{if(event.target.closest('[data-motion-agenda]'))get('todayAgenda')?.scrollIntoView({block:'start',behavior:allowed()?'smooth':'instant'});if(event.target.closest('[data-motion-calendar]'))switchView('calendar');});
    window.addEventListener('scroll',scrollScene,{passive:true});window.addEventListener('resize',scrollScene,{passive:true});
    window.addEventListener('hv-route',()=>{if(document.body.dataset.currentView!=='dashboard'){globe?.destroy();globe=null;activeHero=null;}});
    window.addEventListener('travel-libs-ready',()=>{if(document.body.dataset.currentView==='dashboard')home();});
    reduced.addEventListener('change',scrollScene);
  }
  window.HVMotionExperience={home};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

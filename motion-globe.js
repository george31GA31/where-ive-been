/* A real projected globe, with finite pointer easing and explicit rotation controls.
   Presentation only: no travel records, routes or preferences are written here. */
(() => {
  'use strict';
  const root = new URL('./', document.currentScript?.src || location.href);
  const mounted = new WeakMap(), live = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const precise = matchMedia('(hover: hover) and (pointer: fine)');
  const NS = 'http://www.w3.org/2000/svg';
  let featurePromise, detachObserver, serial = 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;
  const element = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const codeFor = feature => {
    const code = typeof NUMERIC_TO_ALPHA2 !== 'undefined' ? NUMERIC_TO_ALPHA2[String(feature.id).padStart(3, '0')] : '';
    return code || (/^kosovo$/i.test(feature.properties?.name || '') ? 'XK' : '');
  };
  const nameFor = feature => {
    const code = codeFor(feature);
    return (typeof countryByCode === 'function' && countryByCode(code)?.name) || feature.properties?.name || code || 'Country';
  };
  function angularRadius(feature, center) {
    let radius = 0;
    window.d3.geoStream(feature, {
      point(longitude, latitude) { radius = Math.max(radius, window.d3.geoDistance(center,[longitude,latitude])); },
      lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() { radius = Math.PI; }
    });
    // A conservative margin keeps coastline edges visible during horizon crossings.
    return Math.min(Math.PI, radius + Math.PI / 90);
  }
  function loadFeatures() {
    if (!featurePromise) featurePromise = fetch(new URL('data/countries-110m.json', root), {cache:'force-cache'})
      .then(response => { if (!response.ok) throw Error('Globe geometry unavailable'); return response.json(); })
      .then(data => window.topojson.feature(data, data.objects.countries).features)
      .catch(error => { featurePromise = null; throw error; });
    return featurePromise;
  }
  function watchDetach() {
    if (detachObserver) return;
    detachObserver = new MutationObserver(() => {
      for (const item of live) if (!item.host.isConnected) item.destroy();
    });
    detachObserver.observe(document.body, {childList:true, subtree:true});
  }

  function mount(host, initialOptions = {}) {
    if (!(host instanceof Element)) throw new TypeError('A globe host element is required.');
    if (mounted.has(host)) { const existing = mounted.get(host); existing.update(initialOptions); return existing; }
    let options = {...initialOptions}, countries = new Set(options.countries || []), current = new Set(options.current || []);
    let destroyed = false, visible = true, ready = false, loading = false, frame = 0, lastFrameAt = 0, drag = null, lastDragAt = -Infinity;
    let features = [], paths = [], projection, path, graticule, sphere, shade, selectedCode = '';
    let actual = {longitude:-12, latitude:-18}, base = {...actual}, target = {...actual}, initial = {...actual};
    let resolveReady;
    const firstReady = new Promise(resolve => { resolveReady = resolve; });
    const svg = host.querySelector('svg') || element('svg');
    const createdSvg = !svg.parentElement;
    if (createdSvg) host.append(svg);
    svg.classList.add('motion-globe-svg'); svg.setAttribute('viewBox', '0 0 600 600');
    svg.setAttribute('role', 'group'); svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-label', options.label || 'Interactive globe. Drag or use arrow keys to turn. Select a highlighted country to read its history.');
    svg.style.touchAction = 'pan-y';
    const caption = document.createElement('p'); caption.className = 'motion-globe-caption';
    caption.setAttribute('role', 'status'); caption.setAttribute('aria-live', 'polite'); caption.setAttribute('aria-atomic', 'true');
    const controls = document.createElement('div'); controls.className = 'motion-globe-controls';
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Turn the globe');
    for (const [action, label, text] of [['left','Turn globe left','←'],['right','Turn globe right','→'],['up','Turn globe upward','↑'],['down','Turn globe downward','↓'],['reset','Reset globe orientation','↺']]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.globeRotate = action;
      button.setAttribute('aria-label', label); button.textContent = text; controls.append(button);
    }
    const status = document.createElement('p'); status.className = 'motion-globe-status'; status.setAttribute('role', 'status');
    host.append(caption, controls, status);
    host.dataset.globeReady = 'false'; host.dataset.motionState = 'loading';
    const canMove = () => !reduced.matches && precise.matches && document.documentElement.dataset.experienceMotion !== 'off';
    const canRender = () => !destroyed && visible && !document.hidden && host.isConnected;
    const defaultCaption = () => countries.size ? 'Your recorded places · turn to explore' : 'A world still unfolding · turn to explore';
    const say = text => { if (caption.textContent !== text) caption.textContent = text; };
    const stop = state => { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrameAt = 0; if (!destroyed) host.dataset.motionState = state || 'resting'; };

    function render() {
      if (!ready || destroyed) return;
      projection.rotate([actual.longitude, actual.latitude, 0]);
      if (!sphere.hasAttribute('d')) { const outline = path({type:'Sphere'}); sphere.setAttribute('d', outline); shade.setAttribute('d', outline); }
      graticule.setAttribute('d', path(window.d3.geoGraticule10()) || '');
      const center = [-actual.longitude, -actual.latitude];
      for (const item of paths) {
        const distance = window.d3.geoDistance(item.centroid, center);
        const d = item.radius < Math.PI / 2 && distance > Math.PI / 2 + item.radius ? '' : path(item.feature) || '';
        if (item.lastPath !== d) { item.node.setAttribute('d', d); item.lastPath = d; }
        const front = distance < Math.PI / 2;
        const marked = countries.has(item.code) || current.has(item.code);
        if (item.lastFront !== front || item.lastMarked !== marked) {
          item.node.setAttribute('tabindex', front && marked ? '0' : '-1');
          item.node.setAttribute('aria-hidden', front ? 'false' : 'true');
          item.lastFront = front; item.lastMarked = marked;
        }
      }
      host.dataset.longitude = actual.longitude.toFixed(3); host.dataset.latitude = actual.latitude.toFixed(3);
    }
    function animate(timestamp) {
      frame = 0;
      if (!canRender()) { stop('paused'); return; }
      const dx = wrap(target.longitude - actual.longitude), dy = target.latitude - actual.latitude;
      if (!canMove() || drag?.moved) { actual = {...target}; render(); stop(drag?.moved ? 'dragging' : 'resting'); return; }
      if (Math.abs(dx) < .025 && Math.abs(dy) < .025) { actual = {...target}; render(); stop('resting'); return; }
      // Time-based easing keeps the same response on a 30Hz laptop and a 120Hz display.
      const elapsed = lastFrameAt ? clamp(timestamp - lastFrameAt, 8, 48) : 1000 / 60;
      lastFrameAt = timestamp;
      const follow = 1 - Math.exp(-elapsed / 110);
      actual.longitude = wrap(actual.longitude + dx * follow); actual.latitude += dy * follow;
      render(); host.dataset.motionState = 'moving'; frame = requestAnimationFrame(animate);
    }
    function requestRender() {
      if (!ready || destroyed) return;
      if (!canRender()) { stop('paused'); return; }
      if (!frame) frame = requestAnimationFrame(animate);
    }
    function moveTo(longitude, latitude, immediate = false) {
      target = {longitude:wrap(longitude), latitude:clamp(latitude, -68, 68)};
      if (immediate || !canMove()) { stop(); actual = {...target}; render(); }
      else requestRender();
    }
    function rotate(longitude = 0, latitude = 0) {
      if (destroyed) return;
      base = {longitude:wrap(base.longitude + Number(longitude || 0)), latitude:clamp(base.latitude + Number(latitude || 0), -68, 68)};
      moveTo(base.longitude, base.latitude);
    }
    function center(code) {
      const feature = features.find(item => codeFor(item) === code); if (!feature) return false;
      const point = window.d3.geoCentroid(feature);
      base = {longitude:wrap(-point[0]), latitude:clamp(-point[1], -68, 68)};
      moveTo(base.longitude, base.latitude); return true;
    }
    function describe(item) {
      selectedCode = item.code; say(`${item.name}${current.has(item.code) ? ' · current recorded visit' : countries.has(item.code) ? ' · recorded country' : ''}`);
      host.dataset.hoverCountry = item.code;
    }
    function select(item, event) {
      if (performance.now() - lastDragAt < 300 || !item.code) return;
      describe(item); options.onCountry?.(item.code, {source:'globe', originalEvent:event});
    }
    function build() {
      svg.replaceChildren(); paths = [];
      const id = `herald-motion-globe-${++serial}`;
      const defs = element('defs'), ocean = element('radialGradient', {id:id+'-ocean',cx:'.34',cy:'.27',r:'.8'});
      ocean.append(element('stop',{offset:'0%','stop-color':'var(--motion-ocean-light, #275c72)'}),element('stop',{offset:'100%','stop-color':'var(--motion-ocean-dark, #0c2838)'}));
      const light = element('radialGradient',{id:id+'-shade',cx:'.35',cy:'.3',r:'.72'});
      light.append(element('stop',{offset:'55%','stop-color':'#051622','stop-opacity':'0'}),element('stop',{offset:'100%','stop-color':'#051622','stop-opacity':'.58'}));
      defs.append(ocean,light); svg.append(defs);
      const orbit = element('ellipse',{cx:300,cy:300,rx:291,ry:104,transform:'rotate(-24 300 300)',fill:'none',stroke:'var(--motion-orbit, #658898)','stroke-opacity':'.45','stroke-width':'.8','aria-hidden':'true'});
      svg.append(orbit);
      projection = window.d3.geoOrthographic().translate([300,300]).scale(242).clipAngle(90).precision(.9);
      path = window.d3.geoPath(projection).digits(1);
      sphere = element('path',{class:'motion-globe-ocean',fill:`url(#${id}-ocean)`,'aria-hidden':'true'}); svg.append(sphere);
      graticule = element('path',{class:'motion-globe-graticule',fill:'none',stroke:'var(--motion-graticule, #b1ced6)','stroke-opacity':'.19','stroke-width':'.55','aria-hidden':'true'}); svg.append(graticule);
      const lands = element('g',{class:'motion-globe-countries'}); svg.append(lands);
      for (const feature of features) {
        const code = codeFor(feature), name = nameFor(feature), node = element('path',{class:'motion-globe-land','data-country-code':code,role:'button','aria-label':`${name}${countries.has(code) ? ', recorded country' : ''}. Open country history.`,stroke:'var(--motion-country-border, #173b4c)','stroke-width':'.65','vector-effect':'non-scaling-stroke'});
        const centroid=window.d3.geoCentroid(feature);
        const item = {node,feature,code,name,centroid,radius:angularRadius(feature,centroid),lastPath:null,lastFront:null,lastMarked:null};
        node.addEventListener('pointerenter',()=>describe(item)); node.addEventListener('focus',()=>describe(item));
        node.addEventListener('click',event=>select(item,event));
        node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();select(item,event);}});
        paths.push(item); lands.append(node);
      }
      shade = element('path',{class:'motion-globe-shade',fill:`url(#${id}-shade)`,'pointer-events':'none','aria-hidden':'true'}); svg.append(shade);
      updateColors(); ready = true; host.dataset.globeReady = 'true'; host.dataset.motionState = 'resting';
      const focusCode = [options.focusCode,...current,...countries].find(code => code && features.some(feature => codeFor(feature) === code));
      if (focusCode) { const feature = features.find(item => codeFor(item) === focusCode); if (feature) { const point = window.d3.geoCentroid(feature); actual = {longitude:wrap(-point[0]),latitude:clamp(-point[1],-68,68)}; } }
      base = {...actual}; target = {...actual}; initial = {...actual}; render(); say(defaultCaption());
      status.hidden = true; controls.querySelectorAll('button').forEach(button=>button.disabled=false); resolveReady(true);
    }
    function updateColors() {
      for (const item of paths) {
        item.node.classList.toggle('is-visited',countries.has(item.code)); item.node.classList.toggle('is-current',current.has(item.code));
        item.node.setAttribute('fill',current.has(item.code) ? 'var(--motion-globe-current, #ed624d)' : countries.has(item.code) ? 'var(--motion-globe-visited, #9bd3e5)' : 'var(--motion-globe-land, #48798e)');
        item.node.setAttribute('aria-label',`${item.name}${current.has(item.code) ? ', current recorded visit' : countries.has(item.code) ? ', recorded country' : ''}. Open country history.`);
      }
    }
    async function initialize() {
      if (destroyed || ready || loading) return;
      status.hidden = false; status.textContent = 'Opening your world…'; host.dataset.motionState = 'loading';
      controls.querySelectorAll('button').forEach(button=>button.disabled=true);
      if (!window.d3 || !window.topojson) return;
      loading = true;
      try { features = await loadFeatures(); if (!destroyed) build(); }
      catch (_) {
        if (!destroyed) { host.dataset.motionState = 'error'; status.textContent = 'The globe is unavailable. Your travel records and Atlas list are still accessible. '; const retry=document.createElement('button'); retry.type='button'; retry.className='text-btn'; retry.dataset.globeRetry=''; retry.textContent='Try the globe again'; retry.onclick=initialize; status.append(retry); resolveReady(false); }
      } finally { loading = false; }
    }
    function update(next = {}) {
      options = {...options,...next};
      if ('countries' in next) countries = new Set(next.countries || []);
      if ('current' in next) current = new Set(next.current || []);
      if (ready) { selectedCode=''; delete host.dataset.hoverCountry; updateColors(); render(); say(defaultCaption()); if (next.focusCode) center(next.focusCode); }
      else initialize();
    }
    function pointerDown(event) {
      if (event.button !== 0 || !ready) return;
      drag = {id:event.pointerId,x:event.clientX,y:event.clientY,longitude:actual.longitude,latitude:actual.latitude,moved:false,touch:event.pointerType==='touch'};
    }
    function pointerMove(event) {
      if (!ready || !canRender()) return;
      if (drag?.id === event.pointerId) {
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        if (!drag.moved && (Math.hypot(dx,dy)<6 || drag.touch && Math.abs(dy)>Math.abs(dx))) return;
        if (!drag.moved) { drag.moved=true; try { svg.setPointerCapture(event.pointerId); } catch (_) {} }
        if (event.cancelable) event.preventDefault();
        stop('dragging'); base={longitude:wrap(drag.longitude+dx*.23),latitude:clamp(drag.latitude-dy*.16,-68,68)};
        moveTo(base.longitude,base.latitude,true); host.dataset.motionState='dragging'; return;
      }
      if (!canMove() || event.pointerType === 'touch') return;
      const rect=svg.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      const x=clamp((event.clientX-rect.left)/rect.width-.5,-.5,.5),y=clamp((event.clientY-rect.top)/rect.height-.5,-.5,.5);
      moveTo(base.longitude+x*34,base.latitude-y*15);
    }
    function pointerUp(event) {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) { lastDragAt=performance.now(); try { svg.releasePointerCapture(event.pointerId); } catch (_) {} }
      drag=null; moveTo(base.longitude,base.latitude); host.dataset.motionState='resting';
    }
    function pointerLeave() { if (!drag) moveTo(base.longitude,base.latitude); selectedCode=''; delete host.dataset.hoverCountry; say(defaultCaption()); }
    function keydown(event) {
      const directions={ArrowLeft:[-25,0],ArrowRight:[25,0],ArrowUp:[0,12],ArrowDown:[0,-12]};
      if (directions[event.key]) { event.preventDefault(); rotate(...directions[event.key]); }
      else if (event.key==='Home') { event.preventDefault(); base={...initial}; moveTo(base.longitude,base.latitude); }
    }
    function clickControl(event) {
      const button=event.target.closest('[data-globe-rotate]'); if (!button) return;
      const directions={left:[-25,0],right:[25,0],up:[0,12],down:[0,-12]};
      if (button.dataset.globeRotate==='reset') { base={...initial}; moveTo(base.longitude,base.latitude); }
      else rotate(...directions[button.dataset.globeRotate]);
    }
    function preferenceChanged() { if (!canMove()) { stop(); target={...base}; actual={...base}; render(); } }
    function visibilityChanged() { if (!canRender()) stop('paused'); else requestRender(); }
    const intersection = 'IntersectionObserver' in window ? new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);visibilityChanged();},{rootMargin:'80px'}) : null;
    intersection?.observe(host);
    const preferences = new MutationObserver(preferenceChanged); preferences.observe(document.documentElement,{attributes:true,attributeFilter:['data-experience-motion']});
    svg.addEventListener('pointerdown',pointerDown); svg.addEventListener('pointermove',pointerMove); svg.addEventListener('pointerleave',pointerLeave);
    svg.addEventListener('keydown',keydown); controls.addEventListener('click',clickControl);
    window.addEventListener('pointerup',pointerUp); window.addEventListener('pointercancel',pointerUp);
    window.addEventListener('travel-libs-ready',initialize); window.addEventListener('online',initialize);
    document.addEventListener('visibilitychange',visibilityChanged); reduced.addEventListener('change',preferenceChanged); precise.addEventListener('change',preferenceChanged);
    function destroy() {
      if (destroyed) return;
      stop(); destroyed=true; host.dataset.motionState='destroyed';
      intersection?.disconnect(); preferences.disconnect();
      svg.removeEventListener('pointerdown',pointerDown);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerleave',pointerLeave);svg.removeEventListener('keydown',keydown);controls.removeEventListener('click',clickControl);
      window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);window.removeEventListener('travel-libs-ready',initialize);window.removeEventListener('online',initialize);
      document.removeEventListener('visibilitychange',visibilityChanged);reduced.removeEventListener('change',preferenceChanged);precise.removeEventListener('change',preferenceChanged);
      caption.remove();controls.remove();status.remove(); if(createdSvg)svg.remove();else svg.replaceChildren();
      live.delete(api);mounted.delete(host);resolveReady(false);
      if(!live.size){detachObserver?.disconnect();detachObserver=null;}
    }
    const api={host,ready:firstReady,update,rotate,center,destroy}; mounted.set(host,api); live.add(api); watchDetach(); initialize(); return api;
  }
  window.HVMotionGlobe={mount};
})();

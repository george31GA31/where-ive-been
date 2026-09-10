/* Where I've Been — interactive map zoom/hover + simplified timeline. */
(() => {
  'use strict';

  let mapZoomBehavior = null;
  let mapZoomTransform = null;
  let mapTooltip = null;
  let mapTooltipHideTimer = null;

  function installMapEnhancementStyles() {
    if (document.getElementById('wibMapEnhancementStyles')) return;

    const style = document.createElement('style');
    style.id = 'wibMapEnhancementStyles';
    style.textContent = `
      .map-wrap{position:relative;touch-action:none}
      .map-wrap svg{cursor:grab;user-select:none;-webkit-user-select:none}
      .map-wrap svg:active{cursor:grabbing}
      .map-country{vector-effect:non-scaling-stroke;cursor:pointer}
      .map-country:hover{opacity:1;stroke:var(--panel);stroke-width:1.35}

      .map-zoom-controls{
        position:absolute;
        top:12px;
        right:12px;
        z-index:8;
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .map-zoom-btn{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border:1px solid var(--line);
        border-radius:10px;
        background:var(--panel);
        color:var(--text);
        box-shadow:0 7px 20px rgba(15,23,42,.10);
        font-size:18px;
        line-height:1;
        font-weight:850;
        padding:0;
      }
      .map-zoom-btn:hover{transform:translateY(-1px);box-shadow:0 9px 24px rgba(15,23,42,.14)}
      .map-zoom-btn.map-reset{font-size:14px}

      .map-hover-card{
        position:absolute;
        z-index:10;
        left:0;
        top:0;
        display:flex;
        align-items:center;
        gap:8px;
        max-width:min(260px,calc(100% - 20px));
        padding:8px 11px;
        border:1px solid var(--line);
        border-radius:10px;
        background:var(--panel);
        color:var(--text);
        box-shadow:0 10px 28px rgba(15,23,42,.16);
        font-size:12px;
        font-weight:800;
        line-height:1;
        pointer-events:none;
        opacity:0;
        transform:translateY(4px);
        transition:opacity .12s ease,transform .12s ease;
        white-space:nowrap;
      }
      .map-hover-card.visible{opacity:1;transform:translateY(0)}
      .map-hover-card .flag-img{
        display:block!important;
        width:24px!important;
        height:16px!important;
        min-width:24px!important;
        max-width:24px!important;
        flex:0 0 24px!important;
        object-fit:cover!important;
        border-radius:2px!important;
      }

      /* Keep the useful draggable time slider, remove the dense mini bars/labels. */
      .timeline-date-card,
      .timeline-bars,
      .timeline-axis,
      .timeline-schengen{display:none!important}
      .timeline-chart-wrap{min-height:36px;padding:8px 0 22px!important}
      .timeline-slider{position:absolute!important;left:0!important;right:0!important;bottom:7px!important;width:100%!important}
      .timeline-panel{padding-bottom:16px}

      @media(max-width:760px){
        .map-zoom-controls{top:8px;right:8px;gap:5px}
        .map-zoom-btn{width:34px;height:34px;border-radius:9px}
        .map-hover-card{padding:7px 9px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMapOverlayUI() {
    const wrap = els?.worldMap?.closest('.map-wrap');
    if (!wrap) return null;

    let controls = wrap.querySelector('.map-zoom-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'map-zoom-controls';
      controls.innerHTML = `
        <button type="button" class="map-zoom-btn" data-map-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" class="map-zoom-btn" data-map-zoom="out" aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" class="map-zoom-btn map-reset" data-map-zoom="reset" aria-label="Reset map zoom" title="Reset zoom">↺</button>
      `;
      wrap.appendChild(controls);

      controls.querySelector('[data-map-zoom="in"]').addEventListener('click', () => zoomMapBy(1.7));
      controls.querySelector('[data-map-zoom="out"]').addEventListener('click', () => zoomMapBy(1 / 1.7));
      controls.querySelector('[data-map-zoom="reset"]').addEventListener('click', resetMapZoom);
    }

    mapTooltip = wrap.querySelector('.map-hover-card');
    if (!mapTooltip) {
      mapTooltip = document.createElement('div');
      mapTooltip.className = 'map-hover-card';
      mapTooltip.setAttribute('role', 'status');
      mapTooltip.setAttribute('aria-live', 'polite');
      wrap.appendChild(mapTooltip);
    }

    return wrap;
  }

  function zoomMapBy(factor) {
    if (!window.d3 || !mapZoomBehavior || !els?.worldMap) return;
    const svg = d3.select(els.worldMap);
    svg.transition().duration(180).call(mapZoomBehavior.scaleBy, factor);
  }

  function resetMapZoom() {
    if (!window.d3 || !mapZoomBehavior || !els?.worldMap) return;
    const svg = d3.select(els.worldMap);
    mapZoomTransform = d3.zoomIdentity;
    svg.transition().duration(220).call(mapZoomBehavior.transform, d3.zoomIdentity);
  }

  function setTooltipContents(code) {
    if (!mapTooltip || !code) return;
    const country = countryByCode(code);
    const name = country?.name || code;
    mapTooltip.innerHTML = `${flagHtml(code, 'flag-img flag-sm')}<span>${esc(name)}</span>`;
  }

  function moveTooltip(event) {
    if (!mapTooltip) return;
    const wrap = mapTooltip.parentElement;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const tipRect = mapTooltip.getBoundingClientRect();
    const gap = 12;
    let x = event.clientX - rect.left + gap;
    let y = event.clientY - rect.top + gap;

    if (x + tipRect.width > rect.width - 8) x = event.clientX - rect.left - tipRect.width - gap;
    if (y + tipRect.height > rect.height - 8) y = event.clientY - rect.top - tipRect.height - gap;

    x = Math.max(8, Math.min(x, rect.width - tipRect.width - 8));
    y = Math.max(8, Math.min(y, rect.height - tipRect.height - 8));

    mapTooltip.style.left = `${x}px`;
    mapTooltip.style.top = `${y}px`;
  }

  function showMapTooltip(event, code) {
    if (!code) return;
    clearTimeout(mapTooltipHideTimer);
    ensureMapOverlayUI();
    setTooltipContents(code);
    moveTooltip(event);
    requestAnimationFrame(() => mapTooltip?.classList.add('visible'));
  }

  function hideMapTooltip(delay = 0) {
    clearTimeout(mapTooltipHideTimer);
    mapTooltipHideTimer = setTimeout(() => mapTooltip?.classList.remove('visible'), delay);
  }

  // The same timeline logic is retained for date calculations and map colouring,
  // but the dense strip of individual trip bars is deliberately removed.
  renderMapTimeline = function () {
    const list = state.stays;

    if (!list.length) {
      els.timelineEmpty.classList.remove('hidden');
      els.timelineContent.classList.add('hidden');
      renderWorldMap();
      return;
    }

    els.timelineEmpty.classList.add('hidden');
    els.timelineContent.classList.remove('hidden');

    let min = list.reduce((a, stay) => stay.start < a ? stay.start : a, list[0].start);
    let max = list.reduce((a, stay) => stay.end > a ? stay.end : a, list[0].end);
    const today = isoDate(new Date());

    if (today < min) min = today;
    if (today > max) max = today;

    const total = Math.max(1, diffDays(min, max));
    els.timelineSlider.max = total;
    timelineDate = timelineDate && timelineDate >= min && timelineDate <= max
      ? timelineDate
      : (today >= min && today <= max ? today : max);
    els.timelineSlider.value = diffDays(min, timelineDate);
    els.timelineSlider.dataset.start = min;

    // These are kept updated for accessibility/backwards compatibility even
    // though their visual blocks are hidden by the simplified timeline design.
    els.timelineStartLabel.textContent = fmt(min, { month: 'short', year: 'numeric' });
    els.timelineEndLabel.textContent = fmt(max, { month: 'short', year: 'numeric' });
    els.timelineBars.innerHTML = '';

    updateTimelineLabels();
    renderWorldMap();
  };

  renderWorldMap = async function () {
    installMapEnhancementStyles();
    const wrap = ensureMapOverlayUI();

    if (!window.d3 || !window.topojson) {
      els.mapFallback.classList.remove('hidden');
      return;
    }

    if (!worldFeatures && !worldLoading) {
      worldLoading = true;
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        if (!response.ok) throw new Error('map');
        const world = await response.json();
        worldFeatures = topojson.feature(world, world.objects.countries).features;
      } catch {
        els.mapFallback.classList.remove('hidden');
      } finally {
        worldLoading = false;
      }
    }

    if (!worldFeatures) return;

    els.mapFallback.classList.add('hidden');
    const svg = d3.select(els.worldMap);
    svg.selectAll('*').remove();
    svg.attr('aria-label', 'Interactive world map. Scroll or pinch to zoom and drag to pan. Hover a country to see its name.');

    const collection = { type: 'FeatureCollection', features: worldFeatures };
    const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [992, 492]], collection);
    const path = d3.geoPath(projection);
    const viewport = svg.append('g').attr('class', 'map-viewport');

    viewport
      .selectAll('path')
      .data(worldFeatures)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('data-code', feature => NUMERIC_TO_ALPHA2[String(feature.id).padStart(3, '0')] || '')
      .attr('class', 'map-country')
      .on('mouseenter', function (event) {
        const code = this.dataset.code;
        if (code) showMapTooltip(event, code);
      })
      .on('mousemove', function (event) {
        if (mapTooltip?.classList.contains('visible')) moveTooltip(event);
      })
      .on('mouseleave', () => hideMapTooltip())
      .on('click', function (event) {
        if (event.defaultPrevented) return;
        const code = this.dataset.code;
        if (!code) return;
        showMapTooltip(event, code);
        hideMapTooltip(1800);
      });

    mapZoomBehavior = d3.zoom()
      .scaleExtent([1, 9])
      .extent([[0, 0], [1000, 500]])
      .translateExtent([[-120, -80], [1120, 580]])
      .filter(event => {
        // Keep ordinary left-button dragging, wheel zoom, double-click and touch/pinch.
        if (event.type === 'mousedown') return event.button === 0;
        return !event.ctrlKey || event.type === 'wheel';
      })
      .on('start', () => hideMapTooltip())
      .on('zoom', event => {
        mapZoomTransform = event.transform;
        viewport.attr('transform', event.transform);
      });

    svg.call(mapZoomBehavior);
    svg.on('dblclick.zoom', null); // visible +/- controls are less surprising than double-click zoom.

    if (!mapZoomTransform) mapZoomTransform = d3.zoomIdentity;
    svg.call(mapZoomBehavior.transform, mapZoomTransform);

    if (wrap) {
      wrap.addEventListener('mouseleave', () => hideMapTooltip(), { passive: true });
    }

    updateMapColors();
  };

  installMapEnhancementStyles();

  document.addEventListener('DOMContentLoaded', () => {
    installMapEnhancementStyles();
    ensureMapOverlayUI();
  });
})();

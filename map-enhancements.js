/* Where I've Been — interactive map zoom/hover + dated timeline. */
(() => {
  'use strict';

  let mapZoomBehavior = null;
  let mapZoomTransform = null;
  let mapTooltip = null;
  let mapTooltipHideTimer = null;

  function featureCode(feature) {
    const numeric = feature?.id == null ? '' : String(feature.id).padStart(3, '0');
    const byId = numeric ? NUMERIC_TO_ALPHA2[numeric] : '';
    if (byId) return byId;

    const name = String(feature?.properties?.name || '').trim().toLowerCase();
    if (name === 'kosovo') return 'XK';
    return '';
  }

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
        position:absolute;top:12px;right:12px;z-index:8;
        display:flex;flex-direction:column;gap:6px
      }
      .map-zoom-btn{
        width:36px;height:36px;display:grid;place-items:center;
        border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);
        box-shadow:0 7px 20px rgba(15,23,42,.10);font-size:18px;line-height:1;font-weight:850;padding:0;
        transition:transform .14s ease,box-shadow .14s ease
      }
      .map-zoom-btn:hover{transform:translateY(-1px);box-shadow:0 9px 24px rgba(15,23,42,.14)}
      .map-zoom-btn.map-reset{font-size:14px}

      .map-hover-card{
        position:absolute;z-index:10;left:0;top:0;display:flex;align-items:center;gap:8px;
        max-width:min(280px,calc(100% - 20px));padding:8px 11px;border:1px solid var(--line);
        border-radius:10px;background:var(--panel);color:var(--text);box-shadow:0 10px 28px rgba(15,23,42,.16);
        font-size:12px;font-weight:800;line-height:1;pointer-events:none;opacity:0;
        transform:translateY(4px);transition:opacity .12s ease,transform .12s ease;white-space:nowrap
      }
      .map-hover-card.visible{opacity:1;transform:translateY(0)}
      .map-hover-card .flag-img{
        display:block!important;width:24px!important;height:16px!important;min-width:24px!important;max-width:24px!important;
        flex:0 0 24px!important;object-fit:cover!important;border-radius:2px!important
      }

      /* Keep only the slider from the old dense timeline, but make its dates useful. */
      .timeline-date-card,.timeline-bars,.timeline-schengen{display:none!important}
      .timeline-panel{padding-bottom:17px}
      .timeline-chart-wrap{position:relative!important;min-height:58px;padding:28px 0 18px!important;overflow:visible!important}
      .timeline-slider{position:absolute!important;left:0!important;right:0!important;bottom:7px!important;width:100%!important}
      .timeline-axis{display:flex!important;justify-content:space-between!important;align-items:center!important;margin-top:5px!important;font-size:10px!important;color:var(--muted)!important}
      .timeline-current-date{
        position:absolute;top:0;left:0;transform:translateX(-50%);z-index:4;
        padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);
        box-shadow:0 6px 16px rgba(15,23,42,.08);font-size:10px;font-weight:800;white-space:nowrap;
        pointer-events:none;transition:left .08s linear
      }
      .timeline-current-date::after{
        content:"";position:absolute;left:50%;bottom:-5px;width:8px;height:8px;background:var(--panel);
        border-right:1px solid var(--line);border-bottom:1px solid var(--line);transform:translateX(-50%) rotate(45deg)
      }

      @media(max-width:760px){
        .map-zoom-controls{top:8px;right:8px;gap:5px}
        .map-zoom-btn{width:34px;height:34px;border-radius:9px}
        .map-hover-card{padding:7px 9px;font-size:11px}
        .timeline-current-date{font-size:9px;padding:4px 6px}
        .timeline-axis{font-size:9px!important}
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

  function ensureTimelineDateBubble() {
    const chart = els?.timelineSlider?.closest('.timeline-chart-wrap');
    if (!chart) return null;
    let bubble = chart.querySelector('.timeline-current-date');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'timeline-current-date';
      chart.appendChild(bubble);
    }
    return bubble;
  }

  function updateTimelineDateBubble() {
    const slider = els?.timelineSlider;
    const bubble = ensureTimelineDateBubble();
    if (!slider || !bubble || !timelineDate) return;

    const max = Math.max(1, Number(slider.max) || 1);
    const value = Math.max(0, Math.min(max, Number(slider.value) || 0));
    const percentage = (value / max) * 100;

    bubble.textContent = fmt(timelineDate, { day: 'numeric', month: 'short', year: 'numeric' });
    bubble.style.left = `${Math.max(3, Math.min(97, percentage))}%`;
  }

  function zoomMapBy(factor) {
    if (!window.d3 || !mapZoomBehavior || !els?.worldMap) return;
    d3.select(els.worldMap).transition().duration(180).call(mapZoomBehavior.scaleBy, factor);
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

  // Map colour is intentionally independent of the Countries-page "Remove from totals" setting.
  // A place can be hidden from rankings/personal count and still remain visible on the travel map.
  updateMapColors = function () {
    if (!worldFeatures || !els?.worldMap || !window.d3) return;

    const asOf = timelineDate || isoDate(new Date());
    const actual = new Set();
    const planned = new Set();
    const current = new Set();

    state.stays.forEach(stay => {
      if (!stay.countryCode || stay.countryCode === 'SEA' || stay.countryCode === 'BOU') return;

      if (stay.start <= asOf) {
        (stay.status === 'planned' ? planned : actual).add(stay.countryCode);
      }
      if (stay.start <= asOf && stay.end >= asOf) current.add(stay.countryCode);
    });

    d3.select(els.worldMap).selectAll('.map-country').attr('class', function () {
      const code = this.dataset.code;
      return `map-country${actual.has(code) ? ' visited' : planned.has(code) ? ' planned' : ''}${current.has(code) ? ' current' : ''}`;
    });
  };

  const coreUpdateTimelineLabels = updateTimelineLabels;
  updateTimelineLabels = function () {
    coreUpdateTimelineLabels();
    updateTimelineDateBubble();
  };

  // Keep slider/date calculations, remove the old trip-bar strip, and show date endpoints.
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

    els.timelineStartLabel.textContent = fmt(min, { day: 'numeric', month: 'short', year: 'numeric' });
    els.timelineEndLabel.textContent = fmt(max, { day: 'numeric', month: 'short', year: 'numeric' });
    els.timelineBars.innerHTML = '';

    updateTimelineLabels();
    updateTimelineDateBubble();
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
        // 50m provides a distinct Kosovo geometry; Natural Earth's Kosovo feature has no ISO numeric id,
        // so featureCode() explicitly maps its name to the app's XK code.
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
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
    window.HVMapProjection=projection;
    const viewport = svg.append('g').attr('class', 'map-viewport');

    viewport
      .selectAll('path')
      .data(worldFeatures)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('data-code', featureCode)
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
        hideMapTooltip();
        window.HVJourneys?.openCountry(code);
      });

    mapZoomBehavior = d3.zoom()
      .scaleExtent([1, 14])
      .extent([[0, 0], [1000, 500]])
      .translateExtent([[-180, -110], [1180, 610]])
      .filter(event => {
        if (event.type === 'mousedown') return event.button === 0;
        return !event.ctrlKey || event.type === 'wheel';
      })
      .on('start', () => hideMapTooltip())
      .on('zoom', event => {
        mapZoomTransform = event.transform;
        viewport.attr('transform', event.transform);
      });

    window.HVJourneys?.renderMap();
    svg.call(mapZoomBehavior);
    svg.on('dblclick.zoom', null);

    if (!mapZoomTransform) mapZoomTransform = d3.zoomIdentity;
    svg.call(mapZoomBehavior.transform, mapZoomTransform);

    if (wrap && !wrap.dataset.wibTooltipLeaveBound) {
      wrap.dataset.wibTooltipLeaveBound = '1';
      wrap.addEventListener('mouseleave', () => hideMapTooltip(), { passive: true });
    }

    updateMapColors();
  };

  installMapEnhancementStyles();

  document.addEventListener('DOMContentLoaded', () => {
    installMapEnhancementStyles();
    ensureMapOverlayUI();
    ensureTimelineDateBubble();
  });
})();

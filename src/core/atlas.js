function renderMapTimeline() {
  let list = state.stays;
  if (!list.length) {
    els.timelineEmpty.classList.remove('hidden');
    els.timelineContent.classList.add('hidden');
    renderWorldMap();
    return;
  }
  els.timelineEmpty.classList.add('hidden');
  els.timelineContent.classList.remove('hidden');
  let min = list.reduce((a, s) => (s.start < a ? s.start : a), list[0].start),
    max = list.reduce((a, s) => (s.end > a ? s.end : a), list[0].end),
    today = isoDate(new Date());
  if (today < min) min = today;
  if (today > max) max = today;
  let total = Math.max(1, diffDays(min, max));
  els.timelineSlider.max = total;
  timelineDate =
    timelineDate && timelineDate >= min && timelineDate <= max
      ? timelineDate
      : today >= min && today <= max
        ? today
        : max;
  els.timelineSlider.value = diffDays(min, timelineDate);
  els.timelineSlider.dataset.start = min;
  els.timelineStartLabel.textContent = fmt(min, { month: 'short', year: 'numeric' });
  els.timelineEndLabel.textContent = fmt(max, { month: 'short', year: 'numeric' });
  els.timelineBars.innerHTML = list
    .map((s, i) => {
      let l = (diffDays(min, s.start) / total) * 100,
        w = Math.max(0.35, (daysInclusive(s.start, s.end) / (total + 1)) * 100),
        top = (i % 3) * 21 + 7;
      return `<div class="timeline-bar ${s.status === 'planned' ? 'planned' : ''}" style="left:${l}%;width:${w}%;top:${top}px" title="${esc(s.countryName)}: ${fmt(s.start)} – ${fmt(s.end)}"></div>`;
    })
    .join('');
  updateTimelineLabels();
  renderWorldMap();
}
function setTimelineFromSlider() {
  let start = els.timelineSlider.dataset.start;
  timelineDate = dayKey(addDays(parseDate(start), Number(els.timelineSlider.value)));
  updateTimelineLabels();
  updateMapColors();
}
function setTimelineDate(k) {
  if (!state.stays.length) return;
  let start = els.timelineSlider.dataset.start,
    max = Number(els.timelineSlider.max),
    v = Math.max(0, Math.min(max, diffDays(start, k)));
  els.timelineSlider.value = v;
  setTimelineFromSlider();
}
function updateTimelineLabels() {
  if (!timelineDate) return;
  let on = staysForProfile().filter(
    (s) => countsForPlanning(s) && s.start <= timelineDate && s.end >= timelineDate,
  );
  els.timelineDateLabel.textContent = fmt(timelineDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  els.timelineLocationLabel.textContent = on.length
    ? on.map((s) => `${s.countryName}${s.status === 'planned' ? ' (planned)' : ''}`).join(' · ')
    : 'No country recorded on this date';
  let r = rollingStatus(timelineDate);
  els.timelineSchengenLabel.textContent = isSchengenExemptProfile()
    ? 'Not applied'
    : `${r.used} / 90`;
  els.mapSelectionSummary.textContent = on.length
    ? `On ${fmt(timelineDate)}, you have ${on.map((s) => s.countryName).join(' / ')} recorded.`
    : `No stay is recorded on ${fmt(timelineDate)}.`;
}
async function renderWorldMap() {
  if (!window.d3 || !window.topojson) {
    els.mapFallback.classList.remove('hidden');
    return;
  }
  if (!worldFeatures && !worldLoading) {
    worldLoading = true;
    try {
      let res = await (window.HVNetwork ? HVNetwork.request : fetch)('data/countries-110m.json');
      if (!res.ok) throw Error('map');
      let world = await res.json();
      worldFeatures = topojson.feature(world, world.objects.countries).features;
    } catch {
      els.mapFallback.classList.remove('hidden');
    } finally {
      worldLoading = false;
    }
  }
  if (!worldFeatures) return;
  els.mapFallback.classList.add('hidden');
  let svg = d3.select(els.worldMap);
  svg.selectAll('*').remove();
  let fc = { type: 'FeatureCollection', features: worldFeatures },
    proj = d3.geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [992, 492],
      ],
      fc,
    ),
    path = d3.geoPath(proj);
  svg
    .selectAll('path')
    .data(worldFeatures)
    .enter()
    .append('path')
    .attr('d', path)
    .attr('data-code', (d) => NUMERIC_TO_ALPHA2[String(d.id).padStart(3, '0')] || '')
    .attr('class', 'map-country')
    .append('title')
    .text((d) => countryByCode(NUMERIC_TO_ALPHA2[String(d.id).padStart(3, '0')])?.name || '');
  updateMapColors();
}
function updateMapColors() {
  if (!worldFeatures) return;
  let asOf = timelineDate || isoDate(new Date()),
    actual = new Set(),
    planned = new Set(),
    current = new Set(),
    excluded = new Set(state.excludedCountryCodes || []);
  state.stays.forEach((s) => {
    if (s.countryCode === 'SEA' || s.countryCode === 'BOU') return;
    if (excluded.has(s.countryCode)) return;
    if (s.start <= asOf) {
      (s.status === 'planned' ? planned : actual).add(s.countryCode);
    }
    if (s.start <= asOf && s.end >= asOf) current.add(s.countryCode);
  });
  d3.select(els.worldMap)
    .selectAll('.map-country')
    .attr('class', function () {
      let c = this.dataset.code;
      return `map-country${actual.has(c) ? ' visited' : planned.has(c) ? ' planned' : ''}${current.has(c) ? ' current' : ''}`;
    });
}

// SLAPS_FLAG_NAME_ALIASES is supplied by the shared JSON catalogue in src/browser-bundles.json.
function isoDate(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
function parseDate(s) {
  let [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(d, n) {
  let x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function addMonths(d, n) {
  let x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}
function startOfMonth(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}
function dayKey(d) {
  return d.toISOString().slice(0, 10);
}
function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
function daysInclusive(a, b) {
  return diffDays(a, b) + 1;
}
function fmt(s, o = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return parseDate(s).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
}
function fmtObj(d, o = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
}
function flag(c) {
  return c
    ? [...c.toUpperCase()].map((x) => String.fromCodePoint(127397 + x.charCodeAt())).join('')
    : '';
}
function legacyFlagUrl(c, w = 80) {
  if (!c || c === 'SEA') return '';
  if (c === 'BOU')
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag_of_Bougainville.svg?width=${w * 2}`;
  return `https://flagcdn.com/w${w}/${String(c).toLowerCase()}.png`;
}
function normalizedFlagName(v = '') {
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
function slapsFlagEntry(c) {
  let code = String(c || '').toUpperCase(),
    country = countryByCode(code);
  if (!country) return null;
  let wanted = SLAPS_FLAG_NAME_ALIASES[code] || country.name,
    key = normalizedFlagName(wanted),
    list = Array.isArray(window.ISFCountries) ? window.ISFCountries : [];
  return list.find((x) => normalizedFlagName(x?.name) === key) || null;
}
function slapsFlagUrl(c) {
  const path =
    window.HVFlagThumbnails?.[String(c || '').toUpperCase()] ||
    window.HVFlagAssets?.[String(c || '').toUpperCase()];
  return path ? path.split('/').map(encodeURIComponent).join('/') : '';
}
function flagUrl(c, w = 80) {
  return slapsFlagUrl(c) || legacyFlagUrl(c, w);
}
function flagHtml(c, cls = 'flag-img') {
  if (!c) return '';
  const code = String(c).toUpperCase();
  if (code === 'SEA')
    return `<span class="${esc(cls)} special-location-icon" title="At Sea" aria-label="At Sea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 9q3-4 6 0t6 0t8 0M2 16q3-4 6 0t6 0t8 0"/></svg></span>`;
  // Preserve the final markup formerly composed by app-fixes and
  // security-runtime. Domestic destination flags still belong to map-enhancements.
  const name = countryByCode(code)?.name || code;
  return `<img class="${esc(cls)}" src="${flagUrl(code)}" alt="${esc(name)} flag" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}
function countryByName(n = '') {
  return [...COUNTRIES, ...HVJourney.domesticDestinations].find(
    (c) => c.name.toLowerCase() === n.trim().toLowerCase(),
  );
}
function countryByCode(c) {
  return COUNTRIES.find((x) => x.code === c);
}
function esc(v = '') {
  return String(v).replace(
    /[&<>'"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch],
  );
}
function plural(n, w) {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

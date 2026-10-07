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
const SLAPS_FLAG_NAME_ALIASES = {
  CV: 'Cape Verde',
  CC: 'Cocos Islands',
  CD: 'Democratic Republic of the Congo',
  CI: 'Ivory Coast',
  FK: 'Falkland Islands',
  VA: 'Vatican City',
  FM: 'Micronesia',
  MO: 'Macau',
  PN: 'Pitcairn Islands',
  ST: 'São Tomé and Príncipe',
  MF: 'Saint Martin',
  SX: 'Sint Maarten',
  US: 'United States of America',
  VG: 'British Virgin Islands',
  VI: 'U.S. Virgin Islands',
};
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
  let code = String(c).toUpperCase();
  if (code === 'SEA')
    return `<span class="${esc(cls)}" style="display:inline-flex;align-items:center;justify-content:center;background:#eaf4f8;border-radius:6px;font-size:18px" title="At Sea">🌊</span>`;
  if (code.startsWith('GB-'))
    return `<img class="${esc(cls)}" src="assets/domestic/${code.toLowerCase()}.svg" alt="${esc(HVJourney.domesticDestinations.find((d) => d.domesticDestination === code)?.name || code)} flag">`;
  let src = slapsFlagUrl(code),
    fallback = legacyFlagUrl(code);
  if (!src) src = fallback;
  return `<img class="${esc(cls)}" src="${src}" data-fallback="${fallback}" alt="${esc(countryByCode(code)?.name || code)} flag" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;this.dataset.fallback='';this.src=f}else{this.style.display='none'}">`;
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

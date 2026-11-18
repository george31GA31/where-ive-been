/* DOM-only smoke of the simplified shell and shared editors using fictional data. */
'use strict';
const {JSDOM, VirtualConsole} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const dom = new JSDOM(html, {
  url:'https://herald.test/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole
});
const window = dom.window;
const context = dom.getInternalVMContext();
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia = () => ({matches:false, addEventListener() {}, removeEventListener() {}});
window.CSS = {escape:value => String(value)};
window.confirm = () => true;
window.crypto.randomUUID = randomUUID;
window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
window.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new window.Event('close')); };
window.fetch = async value => {
  const url = new URL(String(value), window.location.href);
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (url.origin === window.location.origin && file.startsWith(root + path.sep) && fs.existsSync(file)) {
    return {ok:true, json:async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
  }
  throw Error('External network is disabled for this DOM fixture');
};
const seed = {
  version:2, activeProfileId:'p',
  profiles:[{id:'p',name:'Test traveller',citizenships:[],enabledRules:[],homeCountryCodes:[]}],
  trips:[{id:'legacy-trip',profileId:'p',name:'Keep historical grouping',custom:{retain:true}}],
  stays:[{id:'stay',profileId:'p',tripId:'legacy-trip',countryCode:'FR',countryName:'France',start:'2026-01-01',end:'2026-01-04',status:'actual'}],
  accommodations:[{id:'hotel',profileId:'p',tripId:'legacy-trip',propertyName:'Original hotel',location:'Paris',checkIn:'2026-01-01',checkOut:'2026-01-04',notes:'Preserve the booking'}],
  transports:[{id:'train',profileId:'p',type:'train',startLocal:'2026-01-01T09:00',endLocal:'2026-01-01T10:00',start:{name:'Original station',lat:48,lon:2},end:{name:'Next station',lat:49,lon:3},custom:{retain:true}}],
  roadTrips:[{id:'old-road',profileId:'p',name:'Original road journey',stops:[{name:'Paris',lat:48,lon:2},{name:'Lyon',lat:46,lon:5}],custom:{retain:true}}],
  notes:[], residences:[]
};
window.localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(seed));
const bootstrap = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const scripts = ['account-model.js', 'account-sync.js', ...[...bootstrap.matchAll(/src="([^"?]+)(?:\?[^" ]*)?"/g)].map(match => match[1])];
for (const file of scripts) {
  Object.defineProperty(window.document, 'currentScript', {configurable:true,value:{src:new URL(file, window.location.href).href}});
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
}
const run = code => vm.runInContext(code, context);
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

(async () => {
  await settle();
  assert.deepEqual(errors, [], errors.map(error => error.stack).join('\n'));
  assert.equal(window.document.body.dataset.currentView, 'calendar');
  assert.equal(window.location.hash, '#/calendar');
  assert.equal(window.document.querySelectorAll('main > .view').length, 1);
  assert.deepEqual([...window.document.querySelectorAll('#heraldPrimaryNav a')].map(link => link.textContent), ['Calendar', 'Trip Planner', 'Currency Converter']);
  assert.equal(window.document.querySelector('#dashboardView'), null);
  assert.equal(window.document.querySelector('.header-nav-group'), null);
  assert.ok(window.document.querySelector('#accountLink'));
  assert.ok(window.document.querySelector('#transportDialog'));
  assert.deepEqual(JSON.parse(run('JSON.stringify(state.trips)')), seed.trips);
  assert.equal(run("state.roadTrips[0].custom.retain"), true);
  const before = run('JSON.stringify({stays:state.stays,transports:state.transports,accommodations:state.accommodations,trips:state.trips,roadTrips:state.roadTrips})');
  const stored = window.localStorage.getItem('whereIveBeen.data.v2');

  run("HVJourneys.openTransport('train')");
  const transport = window.document.querySelector('#transportDialog');
  assert.equal(transport.open, true);
  window.document.querySelector('#transportForm').elements.bookingReference.value = 'Unsaved draft';
  transport.querySelector('[data-close-transport]').click();
  assert.equal(transport.open, false);
  run("HVPlaces.open({accommodationId:'hotel'})");
  const accommodation = window.document.querySelector('.place-search-dialog[open]');
  assert.ok(accommodation);
  accommodation.querySelector('[name=placeName]').value = 'Unsaved replacement';
  accommodation.querySelector('[data-place-close]').click();
  assert.equal(run('JSON.stringify({stays:state.stays,transports:state.transports,accommodations:state.accommodations,trips:state.trips,roadTrips:state.roadTrips})'), before);
  assert.equal(window.localStorage.getItem('whereIveBeen.data.v2'), stored);

  window.location.hash = '#/settings';
  await settle();
  assert.equal(window.document.body.dataset.currentView, 'settings');
  assert.ok(window.document.querySelector('#addProfileBtn'));
  assert.ok(window.document.querySelector('#simpleExportData'));
  assert.equal(window.document.querySelector('#accountLink').getAttribute('href'), 'login/');
  window.document.querySelector('#addProfileBtn').click();
  assert.equal(window.document.querySelector('#profileDialog').open, true);
  window.document.querySelector('#cancelProfileDialog').click();

  window.document.querySelector('[data-nav-view=currency]').click();
  assert.equal(window.location.hash, '#/currency');
  assert.ok(window.document.querySelector('.currency-select'));
  window.location.hash = '#/countries';
  await settle();
  assert.equal(window.location.hash, '#/calendar');
  assert.equal(window.document.querySelectorAll('main > .view').length, 1);
  assert.equal(window.HVPages.get('mapView').id, 'mapView');
  run("HVSimpleCalendar.showDate('2026-01-02', 'day')");
  assert.equal(window.document.querySelectorAll('#simpleCalendarDates > section').length, 1);
  assert.match(window.document.querySelector('#simpleCalendarDates').textContent, /Original hotel/);
  window.document.querySelector('[data-simple-calendar-view=month]').click();
  assert.equal(window.document.querySelector('#calendar').hidden, false);
  assert.deepEqual(errors, [], errors.map(error => error.stack).join('\n'));
  process.stdout.write('DOM smoke passed for Calendar-first navigation, Settings, retained records and canceled transport/accommodation edits.\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; }).finally(() => window.close());

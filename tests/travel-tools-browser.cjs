/* Fictional guest data: route relocation, persistence and responsive service copy. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright'), binary = require('@sparticuz/chromium');
binary.setGraphicsMode = false;
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results/travel-tools');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (!path.extname(file)) file = path.join(file, 'index.html');
  try {
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
const seed = {
  version: 2, activeProfileId: 'p',
  profiles: [{ id: 'p', name: 'Test traveller', citizenships: ['GB'], homeCountryCodes: ['GB'], enabledRules: ['schengen'] }],
  trips: [{ id: 'existing', profileId: 'p', name: 'Existing trip', notes: 'Keep original itinerary' }],
  stays: [{ id: 'history', profileId: 'p', tripId: 'existing', countryCode: 'ES', countryName: 'Spain', start: '2026-09-01', end: '2026-09-30', status: 'actual', notes: 'Original planner record', entryContext: { customNote: 'Keep entry context' } }],
  transports: [{ id: 'transport', profileId: 'p', tripId: 'existing', type: 'flight', start: { name: 'London', iata: 'LHR' }, end: { name: 'Madrid', iata: 'MAD' }, startLocal: '2026-09-01T08:00', endLocal: '2026-09-01T11:00', status: 'actual', bookingReference: 'KEEP' }],
  accommodations: [{ id: 'hotel', profileId: 'p', tripId: 'existing', propertyName: 'Existing hotel', checkIn: '2026-09-01', checkOut: '2026-09-30', notes: 'Keep hotel notes' }],
  residences: [], placeVisits: [{ id: 'place', profileId: 'p', placeId: 'capitals:Madrid', status: 'visited', category: 'capitals' }],
  savedPlaces: [{ id: 'saved', profileId: 'p', place: { name: 'Saved hotel', lat: 40.4, lon: -3.7 } }],
  visaAcknowledgements: [{ id: 'ack', fingerprint: 'Keep acknowledgement' }],
  excludedCountryCodes: ['AQ'], visualLayers: { calendar: { countries: true, transport: true, accommodation: true } }
};
const snapshot = () => JSON.stringify(state);
const storage = () => Object.fromEntries(['whereIveBeen.data.v2', 'whereIveBeen.guest.v1', 'whereIveBeen.stays.v1'].map(k => [k, localStorage.getItem(k)]));
let browser;
(async () => {
  let origin = process.env.HV_TOOLS_ORIGIN?.replace(/\/$/, '');
  if (!origin) { await new Promise(r => server.listen(0, '127.0.0.1', r)); origin = 'http://127.0.0.1:' + server.address().port; }
  browser = await chromium.launch({ executablePath: process.env.HV_CHROMIUM_PATH || await binary.executablePath(), args: binary.args.filter(a => a !== '--single-process'), headless: true });
  for (const width of (process.env.HV_TOOLS_WIDTHS || '360,390,768,1440').split(',').map(Number)) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width <= 390, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.clock.setFixedTime(new Date('2026-10-03T12:00:00Z'));
    await page.route('**/*', r => {
      const url = r.request().url();
      if (url.startsWith(origin + '/')) return r.continue();
      if (url.includes('/d3@')) return r.fulfill({ path: path.join(root, 'node_modules/d3/dist/d3.min.js'), contentType: 'text/javascript' });
      if (url.includes('/topojson-client@')) return r.fulfill({ path: path.join(root, 'node_modules/topojson-client/dist/topojson-client.min.js'), contentType: 'text/javascript' });
      if (url.includes('/world-atlas@')) return r.fulfill({ path: path.join(root, 'node_modules/world-atlas/countries-50m.json'), contentType: 'application/json' });
      // No remote account, booking or research calls in this guest fixture.
      return r.fulfill({ status: 200, contentType: r.request().resourceType() === 'script' ? 'text/javascript' : 'application/json', body: r.request().resourceType() === 'script' ? '' : '{}' });
    });
    await page.addInitScript(({ seed, theme }) => {
      if (!localStorage.getItem('whereIveBeen.data.v2')) {
        localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(seed));
        localStorage.setItem('whereIveBeen.guest.v1', JSON.stringify({ ...seed, notes: 'Keep separate guest backup' }));
        localStorage.setItem('whereIveBeen.stays.v1', JSON.stringify(seed.stays));
      }
      localStorage.setItem('whereIveBeen.theme.v1', theme);
    }, { seed, theme });
    await page.goto(origin + '/#/plan-a-trip');
    await page.waitForFunction(() => window.HVPages && window.HVCalendar?.ready && document.body.dataset.currentView === 'planner');
    const before = await page.evaluate(snapshot), stored = await page.evaluate(storage);
    const nav = view => page.locator(width <= 760 ? `[data-mobile-view="${view}"]` : `.workspace-nav[data-view="${view}"]`);
    const fits = async () => {
      assert.equal(await page.locator('main > .view').count(), 1, 'Only the current page is mounted');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
    };
    assert.equal(await page.locator('#pageTitle').innerText(), 'Plan a Trip');
    assert.equal(await page.locator('.workspace-nav.active').innerText(), 'Plan a Trip');
    assert.equal(await page.locator('#plannerView .workspace-tabs').count(), 0, 'Utilities no longer sit under the service');
    assert.equal(await page.locator('#addStayBtn').isVisible(), false, 'The holding page does not present a trip-recording action as a service request');
    assert.equal(await page.locator('#plannerView form, #plannerView input, #plannerView select, #plannerView button').count(), 0, 'No intake, checkout or generation interface');
    assert.deepEqual(await page.locator('.personal-planning-service h3').allTextContents(), ['Basic Plan', 'Full Itinerary', 'Full Trip Booking']);
    assert.deepEqual(await page.locator('.personal-planning-level').allTextContents(), ['Free', '£100', 'Coming later']);
    assert.match(await page.locator('.personal-planning-status').innerText(), /currently being developed/);
    assert.match(await page.locator('.personal-planning-service').last().innerText(), /details and fee are still to be confirmed/);
    await fits();
    await page.screenshot({ path: path.join(out, `plan-${width}-${theme}.png`), fullPage: true });
    await nav('tools').click();
    assert.ok(page.url().endsWith('#/travel-tools'));
    assert.equal(await page.locator('#toolsView .travel-tool-link').count(), 5);
    assert.equal(await page.locator('#toolsView .workspace-tabs').count(), 0, 'The overview keeps a single restrained list of tools');
    assert.equal(await page.locator('[data-coming-tool]').count(), 2);
    await fits();
    await page.screenshot({ path: path.join(out, `tools-${width}-${theme}.png`), fullPage: true });
    for (const title of ['Road Trip Planner', 'Currency Converter']) {
      await page.getByRole('button', { name: title + ' Coming Soon', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      assert.match(await dialog.innerText(), /This travel tool is on its way/);
      await dialog.getByRole('button', { name: 'Close' }).click();
      assert.equal(await page.getByRole('dialog').count(), 0);
    }
    await page.locator('.travel-tool-link[href="#/travel-tools/notes"]').click();
    assert.equal(await page.locator('#pageTitle').innerText(), 'Notes & Checklist');
    assert.equal(await page.locator('#notesView .workspace-tabs button').count(), 6);
    assert.ok(await page.locator('#newNoteBtn').isVisible());
    assert.ok(await page.locator('#newChecklistBtn').isVisible());
    await fits();
    await page.screenshot({ path: path.join(out, `notes-${width}-${theme}.png`), fullPage: true });
    await page.locator('[data-workspace-view="budget"]').click();
    assert.equal(await page.locator('#pageTitle').innerText(), 'Budget Planner');
    assert.ok(await page.locator('#budgetTripSelect').isVisible());
    await fits();
    await page.screenshot({ path: path.join(out, `budget-${width}-${theme}.png`), fullPage: true });
    await page.locator('[data-workspace-view="stayPlanner"]').click();
    assert.equal(await page.locator('.workspace-nav.active').innerText(), 'Travel Tools');
    assert.equal(await page.locator('#stayPlannerView .workspace-tabs button').count(), 6, 'Each travel tool provides access to the overview and the other tools');
    await page.locator('#plannerCountry').fill('France');
    await page.locator('#plannerEntry').fill('2026-10-10');
    await page.locator('#plannerExit').fill('2026-10-14');
    await page.locator('#runPlannerBtn').click();
    assert.match(await page.locator('#plannerResultBody').innerText(), /60 days/);
    assert.match(await page.locator('#plannerResultBody').innerText(), /5-day trip stays within/);
    assert.ok(await page.locator('#addPlannedTripBtn').isVisible());
    await fits();
    await page.locator('[data-workspace-view="rules"]').click();
    await page.locator('#visaPassport').fill('United Kingdom');
    await page.locator('#visaDestination').fill('Ireland');
    await page.locator('#runVisaCheckBtn').click();
    await page.waitForFunction(() => !document.getElementById('runVisaCheckBtn').disabled);
    assert.equal(await page.locator('[data-entry-status]').getAttribute('data-entry-status'), 'conditional-exemption', 'British travellers retain the Common Travel Area answer for Ireland');
    await page.locator('#visaDestination').fill('India');
    await page.locator('#runVisaCheckBtn').click();
    await page.waitForFunction(() => !document.getElementById('runVisaCheckBtn').disabled);
    assert.ok(await page.locator('.entry-health [data-health-vaccine="Rabies"]').count(), 'Health remains in Entry Requirements');
    await page.locator('.entry-health [data-health-vaccine="Rabies"] summary').click();
    assert.equal(await page.locator('.entry-health [data-health-vaccine="Rabies"]').getAttribute('open'), '');
    await page.locator('[data-workspace-view="schengen"]').click();
    await page.locator('#checkDate').fill('2026-10-03');
    await page.locator('#checkDate').dispatchEvent('change');
    assert.equal(await page.locator('#calcUsed').innerText(), '30 days', 'Moved utilities use existing saved history');
    assert.equal(await page.locator('.workspace-nav.active').innerText(), 'Travel Tools');
    await fits();
    await nav('planner').click();
    assert.ok(page.url().endsWith('#/plan-a-trip'), 'Plan navigation opens the service rather than the old tool');
    await page.locator('#plannerView a[href="#/travel-tools"]').click();
    assert.equal(await page.evaluate(snapshot), before, 'Navigation and calculations preserve the complete loaded state');
    assert.deepEqual(await page.evaluate(storage), stored, 'Browsing never rewrites guest, legacy or current records');

    for (const [old, canonical, view] of [['planner', 'travel-tools/stay-planner', 'stayPlanner'], ['visa', 'travel-tools/entry-requirements', 'rules'], ['rules', 'travel-tools/entry-requirements', 'rules'], ['schengen', 'travel-tools/schengen', 'schengen']]) {
      await page.goto(origin + '/#/' + old + '?preserve=bookmark');
      await page.waitForFunction(v => window.HVPages && document.body.dataset.currentView === v, view);
      assert.ok(page.url().endsWith('#/' + canonical + '?preserve=bookmark'), 'Old tool bookmarks keep their purpose and suffix');
      assert.equal(await page.locator('.workspace-nav.active').innerText(), 'Travel Tools');
      const historyLength = await page.evaluate(() => history.length);
      await nav('planner').click();
      await page.goBack();
      await page.waitForFunction(v => document.body.dataset.currentView === v, view);
      assert.equal(await page.evaluate(() => history.length), historyLength + 1, 'Back navigation never adds redirect history');
      assert.ok(page.url().endsWith('#/' + canonical + '?preserve=bookmark'));
      await page.goForward();
      await page.waitForFunction(() => document.body.dataset.currentView === 'planner');
    }
    assert.deepEqual(await page.evaluate(storage), stored, 'Deep links also leave saved data intact');

    // A deliberate save still uses the original planner and collection, once.
    await page.goto(origin + '/#/travel-tools/stay-planner');
    await page.waitForSelector('#runPlannerBtn');
    const originalState = JSON.parse(await page.evaluate(snapshot));
    await page.locator('#plannerCountry').fill('France');
    await page.locator('#plannerEntry').fill('2026-10-10');
    await page.locator('#plannerExit').fill('2026-10-14');
    await page.locator('#runPlannerBtn').click();
    await page.locator('#addPlannedTripBtn').click();
    await page.waitForFunction(() => state.stays.length === 2);
    const saved = await page.evaluate(() => JSON.parse(JSON.stringify(state)));
    const added = saved.stays.find(s => s.id !== 'history');
    assert.equal(added.countryCode, 'FR'); assert.equal(added.start, '2026-10-10'); assert.equal(added.end, '2026-10-14'); assert.equal(added.status, 'planned');
    saved.stays = saved.stays.filter(s => s.id === 'history');
    assert.deepEqual(saved, originalState, 'The intended save adds one stay and preserves every existing record and setting');
    const after = await page.evaluate(storage);
    assert.equal(after['whereIveBeen.guest.v1'], stored['whereIveBeen.guest.v1']);
    assert.equal(after['whereIveBeen.stays.v1'], stored['whereIveBeen.stays.v1']);
    await page.reload(); await page.waitForSelector('#runPlannerBtn');
    assert.equal(await page.evaluate(() => state.stays.length), 2, 'New and old planner data survive reload');
    await page.goto(origin + '/#/calendar'); await page.waitForFunction(() => window.HVCalendar?.ready);
    await page.evaluate(() => { calendarCursor = new Date(Date.UTC(2026, 9, 1)); renderCalendar(); });
    assert.equal(await page.locator('[data-calendar-edit-country="' + added.id + '"]').count(), 5, 'Saved tool plan remains available on every intended Calendar day');
    assert.deepEqual(errors, [], 'No console or runtime errors');
    await page.close(); console.log(`Travel Tools, personal planning, old links and saved data verified at ${width}px in ${theme} theme.`);
  }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server.listening) server.close(); });

/* Browser handler and two-frame timings for the retained workspaces on realistic histories. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const binary = require('@sparticuz/chromium');
const {largeAccount} = require('./fixtures/large-account.cjs');
const model = require('../trip-planner-model.js');
binary.setGraphicsMode = false;
const root = path.resolve(__dirname, '..');
const origin = 'https://herald-performance.test';
const contentTypes = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp'};
const reports = [];
let browser;

function fixture(count, stopCount) {
  const data = largeAccount(count, 8);
  const sharedArtwork = data.savedPlaces[0].accommodationLogo;
  for (const place of data.savedPlaces) place.accommodationLogo = sharedArtwork;
  data.roadTrips = [model.reconcile({
    id:'performance-plan', plannerVersion:2, profileId:'p', name:'Many-stop journey', status:'idea',
    stops:Array.from({length:stopCount}, (_, index) => ({
      id:'performance-stop-' + index, name:'Destination ' + (index + 1),
      lat:10.47 + index * .004, lon:-84.64 + index * .004
    })), segments:[]
  })];
  return data;
}

async function measure(page, name, operation) {
  return page.evaluate(async ({name, operation}) => {
    const started = performance.now();
    if (operation === 'planner') HVTripPlanner.open('performance-plan');
    else if (operation === 'next-month') document.getElementById('nextMonth').click();
    else if (operation === 'previous-month') document.getElementById('prevMonth').click();
    else if (operation === 'week') HVSimpleCalendar.showDate('2018-01-03', 'week');
    else if (operation === 'day') HVSimpleCalendar.showDate('2018-01-03', 'day');
    else if (operation === 'month') HVSimpleCalendar.showDate('2018-01-03', 'month');
    else switchView(operation);
    const handlerMs = performance.now() - started;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {name, handlerMs:Math.round(handlerMs * 10) / 10, twoFrameMs:Math.round((performance.now() - started) * 10) / 10};
  }, {name, operation});
}

(async () => {
  browser = await chromium.launch({
    executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(),
    args:binary.args.filter(argument => argument !== '--single-process'), headless:true
  });
  for (const [count, stopCount] of [[8,4], [160,40], [800,160]]) {
    const data = fixture(count, stopCount);
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) && file !== root) return route.fulfill({status:403,body:''});
      if (!path.extname(file)) file = path.join(file, 'index.html');
      return fs.existsSync(file) ? route.fulfill({path:file,contentType:contentTypes[path.extname(file)]}) : route.fulfill({status:404,body:''});
    });
    await page.addInitScript(data => localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(data)), data);
    const started = Date.now();
    await page.goto(origin + '/');
    await page.waitForFunction(() => window.HVCalendar?.ready && window.HVTripPlanner && window.HVSimpleCalendar && !document.querySelector('.app-shell').inert);
    const readyMs = Date.now() - started;
    const before = await page.evaluate(() => JSON.stringify(state));
    const metrics = [];
    metrics.push(await measure(page, 'month-populated', 'month'));
    metrics.push(await measure(page, 'many-stop-planner-open', 'planner'));
    assert.equal(await page.locator('[data-stop-id]').count(), stopCount);
    await page.locator('#tripPlannerMap.leaflet-container').waitFor();
    for (let pass = 1; pass <= 5; pass++) {
      for (const view of ['calendar', 'roadTrip', 'currency']) {
        metrics.push(await measure(page, `${view}-navigation-${pass}`, view));
      }
    }
    metrics.push(await measure(page, 'calendar-return', 'calendar'));
    for (const action of ['week', 'day', 'month', 'next-month', 'previous-month']) {
      metrics.push(await measure(page, action, action));
    }
    assert.equal(await page.evaluate(() => JSON.stringify(state)), before, 'Browsing retains the complete synthetic account payload');
    assert.deepEqual(errors, [], 'No runtime errors while navigating the heavy account');
    const warmed = metrics.filter(metric => /-navigation-[2-5]$/.test(metric.name));
    for (const view of ['calendar', 'roadTrip', 'currency']) {
      const values = warmed.filter(metric => metric.name.startsWith(view + '-')).map(metric => metric.handlerMs).sort((a,b) => a-b);
      const median = (values[1] + values[2]) / 2;
      assert.ok(median < 150, `${view} median warm handler blocks longer than the established 150ms budget: ${median}ms`);
    }
    for (const metric of metrics.filter(metric => !/-navigation-[2-5]$/.test(metric.name))) {
      assert.ok(metric.handlerMs < 750, `${metric.name} exceeds the established 750ms cold-handler budget: ${metric.handlerMs}ms`);
    }
    reports.push({recordsPerCollection:count,plannerStops:stopCount,payloadBytes:Buffer.byteLength(JSON.stringify(data)),readyMs,metrics});
    await page.close();
    process.stdout.write(`Responsive workspace handlers passed with ${count} legacy records per collection and ${stopCount} planner stops.\n`);
  }
  const reportPath = path.join(root, 'test-results/simplified-performance.json');
  fs.mkdirSync(path.dirname(reportPath), {recursive:true});
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });

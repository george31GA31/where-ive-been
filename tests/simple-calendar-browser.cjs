/* Fictional records exercise all calendar views without account or external writes. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const binary = require('@sparticuz/chromium');
binary.setGraphicsMode = false;
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results/simple-calendar');
fs.mkdirSync(output, {recursive:true});
const origin = 'https://herald.test';
const mime = {'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp'};
const seed = {
  version:2,
  activeProfileId:'p',
  profiles:[{id:'p', name:'Test traveller', citizenships:['GB'], homeCountryCodes:[], enabledRules:[]}],
  trips:[], stays:[], transports:[], residences:[],
  accommodations:[{id:'hotel', profileId:'p', propertyName:'Test hotel', location:'San José', checkIn:'2026-12-01', checkOut:'2026-12-03', checkInTime:'15:00', checkOutTime:'10:00'}],
  notes:[{id:'note', profileId:'p', title:'Meet the guide', body:'Station entrance', date:'2026-12-01', category:'Activity'}],
  roadTrips:[{
    id:'plan', plannerVersion:2, profileId:'p', name:'Costa Rica connection', status:'planned',
    stops:[{id:'fortuna', name:'La Fortuna', lat:10.47, lon:-84.64}, {id:'monteverde', name:'Monteverde', lat:10.31, lon:-84.81}],
    segments:[{id:'bus-leg', fromStopId:'fortuna', toStopId:'monteverde', mode:'bus', departureLocal:'2026-12-01T09:00', arrivalLocal:'2026-12-01T12:00'}]
  }]
};
let browser;

async function openPage(width) {
  const page = await browser.newPage({viewport:{width,height:900}, serviceWorkers:'block', reducedMotion:'reduce', hasTouch:width===390});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.fulfill({body:'{}',contentType:'application/json'});
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) return route.fulfill({status:403,body:''});
    if (!path.extname(file)) file = path.join(file, 'index.html');
    return fs.existsSync(file) ? route.fulfill({path:file,contentType:mime[path.extname(file)]}) : route.fulfill({status:404,body:''});
  });
  await page.addInitScript(data => localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(data)), seed);
  await page.goto(origin + '/#/calendar');
  await page.waitForFunction(() => window.HVCalendar?.ready && window.HVSimpleCalendar && window.HVTripPlanner);
  return {page, errors};
}

(async () => {
  browser = await chromium.launch({
    executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(),
    args:binary.args.filter(argument => argument !== '--single-process'),
    headless:true
  });
  for (const width of [1280,390]) {
    const {page,errors} = await openPage(width);
    const before = await page.evaluate(() => JSON.stringify({accommodations:state.accommodations,notes:state.notes,roadTrips:state.roadTrips}));
    await page.evaluate(() => HVSimpleCalendar.showDate('2026-12-01', 'week'));
    const dates = page.locator('#simpleCalendarDates');
    await dates.waitFor();
    assert.equal(await dates.locator(':scope > section').count(), 7);
    assert.equal(await dates.locator('[data-simple-entry-id=hotel]').count(), 3, 'Check-in, occupied dates and checkout stay visible');
    assert.match(await page.locator('#calendarTitle').innerText(), /30 Nov.*6 Dec 2026/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Calendar controls fit the viewport');
    await page.screenshot({path:path.join(output, 'week-' + width + '.png')});
    await page.locator('#nextMonth').click();
    assert.equal(await page.evaluate(() => HVSimpleCalendar.date), '2026-12-08');
    await page.locator('#simpleCalendarJump').fill('2027-01-01');
    await page.locator('#simpleCalendarJump').dispatchEvent('change');
    assert.match(await page.locator('#calendarTitle').innerText(), /28 Dec.*3 Jan 2027/);

    await page.evaluate(() => HVSimpleCalendar.showDate('2026-12-01', 'day'));
    assert.equal(await dates.locator(':scope > section').count(), 1);
    await dates.locator('[data-simple-entry-id=hotel]').click();
    await page.locator('#calendarJourneyDetail').waitFor();
    assert.match(await page.locator('#calendarJourneyDetail').innerText(), /Test hotel/);
    await page.evaluate(() => HVCalendar.clearSelection(false));
    await dates.locator('[data-simple-add]').click();
    await page.locator('[data-simple-add-kind=activity]').click();
    await page.locator('.travel-note-form').waitFor();
    assert.equal(await page.locator('.travel-note-form [name=category]').inputValue(), 'Activity');
    await page.locator('.travel-note-form [data-close]').first().click();

    await dates.locator('[data-simple-entry-id="planner:plan:segment:bus-leg"]').click();
    await page.waitForFunction(() => document.body.dataset.currentView === 'roadTrip');
    assert.equal(await page.locator('#plannerName').inputValue(), 'Costa Rica connection');
    assert.equal(await page.locator('.planner-segment.is-selected').getAttribute('data-segment-id'), 'bus-leg');
    assert.ok(await page.locator('#plannerDetails').isVisible(), 'A projected event opens its canonical journey segment');

    await page.evaluate(() => HVSimpleCalendar.showDate('2026-12-01', 'month'));
    assert.equal(await page.locator('#calendar').isVisible(), true);
    assert.equal(await dates.isVisible(), false);
    await page.locator('#nextMonth').click();
    assert.match(await page.locator('#calendarTitle').innerText(), /January 2027/);
    await page.locator('#prevMonth').click();
    assert.match(await page.locator('#calendarTitle').innerText(), /December 2026/);
    await page.locator('[data-calendar-date-select="2026-12-05"]').click();
    await page.locator('[data-calendar-date-select="2026-12-08"]').click();
    const explorer = page.locator('#calendarJourneyDetail');
    assert.equal(await explorer.locator('[data-create-range-trip]').count(), 0, 'The Calendar exposes one planner workflow');
    assert.equal(await explorer.locator('.calendar-explicit-plan button').count(), 1);
    await explorer.getByRole('button', {name:'Plan journey →',exact:true}).click();
    await page.waitForFunction(() => document.body.dataset.currentView === 'roadTrip');
    assert.equal(await page.locator('.trip-experience-dialog[open],#tripPlannerDialog[open]').count(), 0, 'Planning opens the current workspace');
    assert.equal(await page.locator('[data-trip-tool]').count(), 0, 'Removed Budget and Notes tools stay out of the planning flow');
    await page.locator('[data-select-stop]').first().click();
    assert.equal(await page.locator('[name="departureDate"]').inputValue(), '2026-12-05');
    await page.locator('[data-detail-done]').click();
    await page.locator('[data-select-stop]').last().click();
    assert.equal(await page.locator('[name="arrivalDate"]').inputValue(), '2026-12-08');
    await page.locator('[data-detail-done]').click();
    const after = await page.evaluate(() => JSON.stringify({accommodations:state.accommodations,notes:state.notes,roadTrips:state.roadTrips}));
    assert.equal(after, before, 'Browsing and cancelled creation preserve saved travel data');
    assert.deepEqual(errors, []);
    await page.close();
    console.log('Month, week and day navigation, existing entries, Activity and planner links passed at ' + width + 'px.');
  }
})().catch(error => {console.error(error);process.exitCode=1;}).finally(async () => {await browser?.close();});

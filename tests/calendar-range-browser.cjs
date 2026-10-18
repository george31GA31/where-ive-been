/* Date-range actions and hover preferences, using isolated fictional records only. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('playwright'), binary = require('@sparticuz/chromium');
const {calendarHistory} = require('./fixtures/calendar-chronology.cjs');
binary.setGraphicsMode = false;
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results/calendar-range');
fs.mkdirSync(out, {recursive:true});
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403);return res.end();}
  if (!path.extname(file)) file = path.join(file, 'index.html');
  try {res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');res.end(fs.readFileSync(file));}
  catch {res.writeHead(404);res.end();}
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(),args:binary.args.filter(arg => arg !== '--single-process'),headless:true});
  for (const width of (process.env.HV_RANGE_WIDTHS || '1440,1024,768,390,360').split(',').map(Number)) for (const theme of ['light','dark']) {
    const context = await browser.newContext({viewport:{width,height:1000},hasTouch:width <= 390,reducedMotion:'reduce',serviceWorkers:'block'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const seed=calendarHistory();
    seed.accommodations.push({id:'legacy-invalid-date',profileId:'p',propertyName:'Legacy incomplete stay',checkIn:'2026-13-99',checkOut:'',notes:'Keep the original imported dates'});
    await page.addInitScript(({seed,theme}) => {
      if (!localStorage.getItem('whereIveBeen.data.v2')) localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(seed));
      localStorage.setItem('whereIveBeen.theme.v1', theme);
    }, {seed,theme});
    await page.goto(origin + '/#/calendar');
    await page.waitForFunction(() => window.HVCalendarDetails && window.HVCalendar?.ready && !document.querySelector('.app-shell').inert);
    await page.clock.runFor(500);
    await page.evaluate(() => {calendarCursor=new Date(Date.UTC(2026,7,1));renderCalendar();window.rangeTestGrid=document.querySelector('#calendar .calendar-day');});
    const snapshot = await page.evaluate(() => JSON.stringify(state));
    const stored = await page.evaluate(() => localStorage.getItem('whereIveBeen.data.v2'));
    const day = (date) => page.locator(`[data-calendar-date-select="2026-08-${date}"]`);
    const drawer = page.locator('#calendarJourneyDetail'), mode = page.locator('[data-calendar-select-range]');
    const close = async () => {await drawer.locator('[data-calendar-close-date]').click();await page.mouse.move(0,0);};
    const unchangedGrid = async () => assert.equal(await page.evaluate(() => window.rangeTestGrid === document.querySelector('#calendar .calendar-day')), true, 'Selection and dismissal retain the original month DOM');

    assert.equal(await mode.getAttribute('aria-pressed'), 'true', 'Two-click range selection is the default');
    await day('08').click();
    assert.equal(await page.locator('#calendar .selection-start').count(), 1);
    assert.ok(await drawer.isHidden(), 'The first selection leaves all end dates available');
    await unchangedGrid();
    await day('14').click();
    assert.equal(await page.locator('#calendar .selection-range').count(), 7);
    assert.ok(await drawer.isVisible());
    assert.equal(await drawer.locator('.calendar-add-menu').getAttribute('open'), '');
    for (const kind of ['country','accommodation','transport','note','location']) assert.ok(await drawer.locator(`[data-calendar-date-action=${kind}]`).isVisible());
    assert.equal(await page.locator('.journey-planner-dialog,dialog[open]').count(), 0, 'Selecting dates does not open any planner or editor');
    await unchangedGrid();
    await drawer.locator('[data-calendar-date-action=country]').click();
    assert.equal(await page.locator('#calendarQuickCountry [name=start]').inputValue(), '2026-08-08');
    assert.equal(await page.locator('#calendarQuickCountry [name=end]').inputValue(), '2026-08-14');
    await page.locator('#calendarQuickCountry [name=country]').fill('Spain');
    await page.screenshot({path:path.join(out,`spain-form-${width}-${theme}.png`)});
    assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);
    assert.equal(await page.evaluate(() => localStorage.getItem('whereIveBeen.data.v2')), stored);
    await page.locator('#calendarQuickCountry [type=submit]').click();
    await page.waitForFunction(() => state.stays.some(row => row.countryCode==='ES' && row.start==='2026-08-08' && row.end==='2026-08-14'));
    const newId = await page.evaluate(() => state.stays.find(row => row.countryCode==='ES' && row.start==='2026-08-08').id);
    assert.equal(await page.locator(`#calendar [data-calendar-entry-id="${newId}"]`).count(), 7, 'Spain appears on every inclusive date');
    assert.equal(await page.evaluate(id => JSON.stringify({...state,stays:state.stays.filter(row => row.id!==id)}), newId), snapshot, 'Adding Spain preserves all existing records and references');
    await close();
    await page.evaluate(() => {window.rangeTestGrid=document.querySelector('#calendar .calendar-day');});

    await day('21').click();await day('17').click();
    assert.equal(await page.locator('#calendar .selection-range').count(), 5);
    await drawer.locator('[data-calendar-date-action=country]').click();
    assert.equal(await page.locator('#calendarQuickCountry [name=start]').inputValue(), '2026-08-17');
    assert.equal(await page.locator('#calendarQuickCountry [name=end]').inputValue(), '2026-08-21');
    await drawer.locator('[data-calendar-cancel-range]').click();await unchangedGrid();
    // Empty cell space used to bubble into the legacy journey-planner handler.
    for(const date of ['22','23'])await page.locator(`.calendar-day[data-calendar-date="2026-08-${date}"]`).click({position:{x:8,y:70}});
    await page.clock.runFor(50);
    assert.equal(await page.locator('#calendar .selection-range').count(),2);
    assert.equal(await page.locator('dialog[open]').count(),0,'Background date clicks do not reach the old planner');
    await close();
    await day('24').click();await day('24').click();assert.equal(await page.locator('#calendar .selection-range').count(),1,'The same date twice selects one day');await close();
    await day('08').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#calendar .selection-range').count(),0);
    await day('09').click();await page.locator('#pageTitle').click();assert.equal(await page.locator('#calendar .selection-range').count(),0);
    await day('10').click();await page.locator('#calendarSelectionInfo [data-calendar-cancel-range]').click();assert.equal(await page.locator('#calendar .selection-range').count(),0);
    await day('11').click();await page.locator('[data-calendar-explore-selected]').click();assert.ok(await drawer.isVisible());await close();
    await mode.click();assert.equal(await mode.getAttribute('aria-pressed'),'false');
    await day('12').click();assert.ok(await drawer.isVisible(),'One-click day exploration remains available with range mode off');await close();
    await unchangedGrid();
    await mode.click();await day('18').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#calendar .selection-range').count(),2,'Keyboard selects an inclusive range');await close();
    await mode.click();await day('31').click();await drawer.locator('[data-calendar-day-nav="2026-09-01"]').click();
    assert.equal(await page.locator('#calendarMonthJump').inputValue(),'8','Day navigation across months updates the month grid');await close();

    const hover = page.locator('[data-calendar-hover-previews]');
    assert.ok(await hover.isChecked(),'Hover previews default on');
    await hover.uncheck();
    const expected = await page.evaluate(() => JSON.stringify(state));
    assert.equal(await page.evaluate(() => state.visualLayers.calendar.hoverPreviews),false);
    await page.reload();await page.waitForFunction(() => window.HVCalendarDetails && window.HVCalendar?.ready);
    assert.equal(await hover.isChecked(),false,'The preference survives reload');
    await page.evaluate(() => {calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
    const entry = kind => page.locator(`#calendar [data-calendar-entry=${kind}]`).first();
    if(width>=768) {
      for (const kind of ['country','accommodation','transport','note']) {
        await entry(kind).hover();await page.clock.runFor(350);
        assert.equal(await page.locator('#calendarFloatingDetail').count(),0,'Hover off suppresses the '+kind+' preview');
        assert.equal(await page.locator('#calendar .calendar-linked-date,#calendar .calendar-linked-entry').count(),0);
      }
      await page.locator('#calendarMonthJump').focus();await entry('country').focus();
      assert.ok(await page.locator('#calendarFloatingDetail').isVisible(),'Keyboard focus still opens a preview');
      await page.keyboard.press('Escape');
    }
    for (const kind of ['country','accommodation','transport','note']) {
      if(width<=390)await entry(kind).tap();else await entry(kind).click();
      assert.ok(await drawer.isVisible(),'Details remain accessible with hover off');await close();
    }
    await page.locator('[data-calendar-day-detail="2026-10-15"]').click();assert.match(await drawer.innerText(),/DAY EXPLORER/);await close();
    assert.equal(await page.evaluate(() => JSON.stringify(state)),expected,'All data stays intact while exploring with hover off');
    await hover.check();
    assert.equal(await page.evaluate(() => JSON.stringify({...state,visualLayers:{...state.visualLayers,calendar:{...state.visualLayers.calendar,hoverPreviews:false}}})),expected,'Only the hover preference changes');
    if(width>=768){await entry('accommodation').hover();await page.clock.runFor(160);assert.ok(await page.locator('#calendarFloatingDetail').isVisible(),'Hover can be restored');await hover.uncheck();assert.equal(await page.locator('#calendarFloatingDetail').count(),0);}
    await page.screenshot({path:path.join(out,`calendar-${width}-${theme}.png`)});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),'No page overflow');
    assert.deepEqual(errors,[]);
    await context.close();console.log(`${width}px ${theme}: range country creation, reverse dates, cancellation, keyboard, hover preference, touch and preservation passed.`);
  }
})().catch(error => {console.error(error);process.exitCode=1;}).finally(async () => {await browser?.close();server.close();});

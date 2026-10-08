'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright'), binary = require('@sparticuz/chromium');
const {largeAccount} = require('./fixtures/large-account.cjs');
binary.setGraphicsMode = false;
const root = path.resolve(process.env.HV_NAV_ROOT || path.join(__dirname, '..'));
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403); return res.end();}
  try {res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));}
  catch {res.writeHead(404); res.end();}
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(), args:binary.args.filter(arg => arg !== '--single-process'), headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce'}), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const data = largeAccount(240, 80);
  await page.addInitScript(data => localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(data)), data);
  await page.goto(origin);
  await page.waitForFunction(() => window.HVJourneyLibrary && window.HVCalendar && !document.querySelector('.app-shell').inert);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.navMetrics = {calendars:0,maps:0};
    const month=HVCalendar.renderMonth;HVCalendar.renderMonth=function(...args){navMetrics.calendars++;return month.apply(this,args);};
    const mount = HVJourneyMap.mountGlobal;
    HVJourneyMap.mountGlobal = function(...args) {navMetrics.maps++; return mount.apply(this,args);};
  });
  const reports = [];
  for (const pass of [1, 2]) for (const view of ['tools', 'calendar', 'journeys', 'map', 'stats',...(!process.env.HV_NAV_BASELINE?['transport']:[])]) {
    const report = await page.evaluate(async ({view, pass}) => {
      const before = {...navMetrics}, start = performance.now();
      switchView(view);
      const handler = performance.now() - start;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {view,pass,handlerMs:Math.round(handler),paintMs:Math.round(performance.now()-start),calendars:navMetrics.calendars-before.calendars,maps:navMetrics.maps-before.maps};
    }, {view,pass});
    reports.push(report);
  }
  if (!process.env.HV_NAV_BASELINE) {
    assert.deepEqual(errors, []);
    assert.equal(reports.filter(r => r.view === 'journeys').reduce((n,r) => n+r.maps,0), 1, 'The global map is mounted once across repeat visits');
    for (const report of reports.filter(r => r.pass === 2)) assert.ok(report.handlerMs < 150, 'Cached '+report.view+' navigation must not block on history');
    assert.equal(reports.find(r => r.view === 'calendar' && r.pass === 1).calendars, 1, 'Calendar renders once on entry');
    assert.equal(reports.find(r => r.view === 'calendar' && r.pass === 2).calendars, 0, 'An unchanged calendar is reused');
    await page.evaluate(()=>{state.transports.findLast(t=>t.type==='flight').flightNumber='Navigation saved edit';persist();switchView('tools');switchView('transport');});
    assert.match(await page.locator('[data-transport-list]').innerText(),/Navigation saved edit/,'A saved edit invalidates cached pages');
    assert.deepEqual(await page.evaluate(() => state.transports.map(t => t.resolvedRoutes)), data.transports.map(t => t.resolvedRoutes));
    const many={...data,trips:[],stays:[],accommodations:[],savedPlaces:[],transports:Array.from({length:1200},(_,i)=>{const record=structuredClone(data.transports[0]),date=new Date(Date.UTC(2020,0,1+i%365)).toISOString().slice(0,10);return {...record,id:'many-'+i,tripId:null,flightNumber:'HV '+i,startLocal:date+'T08:00',endLocal:date+'T09:00',start:{...record.start,timezone:'Europe/Paris'},end:{...record.end,timezone:'Europe/Paris'}};})};
    const large=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await large.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await large.addInitScript(many=>{localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(many));window.visibleRoutes=[];let api;Object.defineProperty(window,'HVJourneyMap',{configurable:true,get:()=>api,set:value=>{api=value;const mount=value.mountGlobal;value.mountGlobal=function(host,rows,...args){visibleRoutes.push(rows.length);return mount.call(this,host,rows,...args);};}});},many);
    await large.goto(origin+'/#/my-flights');await large.waitForFunction(()=>window.HVTransportDashboard?.surface()&&!document.querySelector('.app-shell').inert);
    assert.equal(await large.locator('[data-transport-select]').count(),40,'Large histories render one page of rows');assert.ok(await large.evaluate(()=>visibleRoutes.length&&visibleRoutes.every(count=>count===40)),'Initial maps only mount the visible routes');
    await large.locator('[data-transport-page="1"]').click();assert.equal(await large.locator('[data-transport-select]').count(),40);assert.match(await large.locator('[data-transport-pagination]').innerText(),/41–80 of 1200/);assert.ok(await large.evaluate(()=>visibleRoutes.length>=2&&visibleRoutes.every(count=>count===40)));
    assert.deepEqual(await large.evaluate(()=>state.transports.map(record=>record.resolvedRoutes)),many.transports.map(record=>record.resolvedRoutes));await large.close();
  }
  console.log(JSON.stringify({root,reports,errors},null,2));
})().catch(error => {console.error(error); process.exitCode=1;}).finally(async () => {await browser?.close(); server.close();});

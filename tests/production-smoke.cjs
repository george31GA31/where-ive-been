/* Read-only checks against the deployed static release; fictional guest state only. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const binary = require('@sparticuz/chromium');
binary.setGraphicsMode = false;
const root = path.resolve(__dirname, '..');
const origin = 'https://george31ga31.github.io/where-ive-been/';
const out = path.join(root, 'test-results/production');
fs.mkdirSync(out, {recursive:true});
const seed = {
  version:2, activeProfileId:'test',
  profiles:[{id:'test',name:'Verification traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],
  trips:[{id:'sample',profileId:'test',name:'Verification itinerary',notes:'Original fictional notes'}],
  stays:[{id:'stay',profileId:'test',tripId:'sample',countryCode:'AT',countryName:'Austria',start:'2026-09-10',end:'2026-09-22',status:'actual'}],
  accommodations:[],transports:[],residences:[],placeVisits:[],savedPlaces:[],
  manualCountryVisits:[{id:'manual',profileId:'test',countryCode:'FR',visited:true,year:2025}],
  tccVisits:[],notes:[],checklists:[],budgets:[],expenses:[],roadTrips:[]
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshot = () => ({
  trips:JSON.parse(JSON.stringify(state.trips)),
  stays:JSON.parse(JSON.stringify(state.stays)),
  manualCountryVisits:JSON.parse(JSON.stringify(state.manualCountryVisits))
});
let browser;
const results = [];
(async () => {
  const files = [
    ...fs.readdirSync(root).filter(file => /\.(js|css)$/.test(file)),
    'index.html','login/index.html','register/index.html','profile/index.html',
    'reset-password/index.html','data/country-catalog.json','data/flag-name-aliases.json'
  ].sort();
  const hashes = [];
  for (let offset=0;offset<files.length;offset+=6) {
    const batch = await Promise.all(files.slice(offset,offset+6).map(async file => {
      const response = await fetch(origin+file+'?verify='+Date.now(), {signal:AbortSignal.timeout(25000),cache:'no-store'});
      assert.equal(response.status,200,'Production file failed: '+file);
      const actual = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(actual),hash(fs.readFileSync(path.join(root,file))),'Production file differs: '+file);
      return {path:file,matched:true};
    }));
    hashes.push(...batch);
  }
  fs.writeFileSync(path.join(out,'assets.json'),JSON.stringify(hashes,null,2));
  console.log('Production asset hashes: '+hashes.length+'/'+hashes.length+' matched the checked-out release.');
  browser = await chromium.launch({
    executablePath:await binary.executablePath(),
    args:binary.args.filter(arg=>arg!=='--single-process'),headless:true
  });
  for (const width of [390,768,1440]) for (const theme of ['light','dark']) {
    const context = await browser.newContext({
      viewport:{width,height:960},reducedMotion:'reduce',serviceWorkers:'block'
    });
    const page = await context.newPage(), errors = [], failedAssets = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('response',response=>{
      if(response.url().startsWith(origin)&&response.status()>=400)
        failedAssets.push({path:new URL(response.url()).pathname,status:response.status()});
    });
    await page.clock.setFixedTime(new Date('2026-09-21T12:00:00Z'));
    // Load actual deployed static assets. Suppress all third-party/account
    // operations so a guest fixture cannot contact or modify production records.
    await page.route('**/*',route=>route.request().url().startsWith(origin)
      ?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.addInitScript(({seed,theme})=>{
      localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));
      localStorage.setItem('whereIveBeen.theme.v1',theme);
    },{seed,theme});
    await page.goto(origin+'?verify='+Date.now()+'#/dashboard');
    await page.waitForFunction(()=>window.HVPages&&window.HVCalendar?.ready
      &&document.body.dataset.currentView==='dashboard');
    const initial = await page.evaluate(snapshot);
    for (const route of [
      'dashboard','trips','calendar','journey-map','map','countries','stats',
      'travel-tools','travel-tools/stay-planner','travel-tools/notes',
      'travel-tools/budget','travel-tools/currency','travel-tools/road-trip'
    ]) {
      await page.evaluate(route=>location.hash='#/'+route,route);
      await page.waitForFunction(()=>document.querySelectorAll('main>.view').length===1
        &&document.querySelector('main>.view.active'));
      await page.waitForTimeout(200);
      if(route==='map')await page.waitForSelector('.map-country');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
        route+' horizontal overflow');
      if(['dashboard','calendar','map','stats'].includes(route))
        await page.screenshot({
          path:path.join(out,route+'-'+width+'-'+theme+'.png'),
          fullPage:true,animations:'disabled'
        });
    }
    assert.deepEqual(await page.evaluate(snapshot),initial,'Production browsing changed fictional records');
    assert.deepEqual(errors,[],'Unexpected production console/runtime errors');
    assert.deepEqual(failedAssets,[],'Production asset request failed');
    results.push({width,theme,pages:13,errors:0,failedAssets:0});
    fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(results,null,2));
    console.log('Production pages, rendered Atlas, guest history and console: '+width+' '+theme+' passed');
    await context.close();
  }
  const context = await browser.newContext({serviceWorkers:'block'});
  const page = await context.newPage(), errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)
    ?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  for(const route of ['login/','register/','profile/','reset-password/']) {
    await page.goto(origin+route);
    await page.waitForFunction(()=>typeof window.WIBAuth==='object');
    assert.ok(await page.locator('body').innerText());
  }
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Production verification passed: 78 page/theme/viewport checks and four account-page loads.');
})().catch(error=>{
  console.error(error.stack||error);
  process.exitCode=1;
}).finally(async()=>{
  if(browser)await browser.close();
});

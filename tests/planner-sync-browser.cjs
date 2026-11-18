/* Actual account adapter, Supabase SDK and planner UI against fictional intercepted APIs. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const binary = require('@sparticuz/chromium');
const Planner = require('../trip-planner-model.js');
const root = path.resolve(__dirname, '..'), origin = 'https://herald.test';
const contentTypes = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp'};
const userId = '019a1234-6b7c-4d8e-9001-202611180088';
const user = {id:userId, aud:'authenticated', role:'authenticated', email:'planner-fixture@example.test', app_metadata:{provider:'email'}, user_metadata:{}};
const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expiry = Math.floor(Date.now()/1000) + 86400;
const auth = {access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:userId,exp:expiry,aud:'authenticated',role:'authenticated'})+'.fictional', token_type:'bearer', expires_at:expiry, expires_in:86400, refresh_token:'fictional-refresh', user};
const media = [{id:'cloud-photo', src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=', name:'Cloud hotel photo', width:1, height:1}];
const journey = Planner.reconcile({id:'cloud-journey', plannerVersion:2, profileId:'p', name:'Account lake transfer', status:'planned', updatedAt:'2026-11-01T00:00:00Z', notes:'Cloud journey note', customProvider:{keep:true}, stops:[{id:'origin',name:'La Fortuna',lat:10.47,lon:-84.64,media},{id:'landing',name:'Lake landing',lat:10.46,lon:-84.74},{id:'destination',name:'Monteverde',lat:10.3,lon:-84.82}], segments:[]});
journey.segments[0].mode = 'bus';
journey.segments[0].departureLocal = '2026-12-01T09:00';
journey.segments[0].arrivalLocal = '2026-12-01T10:00';
journey.segments[1].mode = 'boat';
const country = {id:'original-country',profileId:'p',countryCode:'CR',countryName:'Costa Rica',start:'2025-01-01',end:'2025-01-03',status:'actual',notes:'Original history stays intact'};
let cloud = {version:2,activeProfileId:'p',profiles:[{id:'p',name:'Fixture traveller',citizenships:['GB'],enabledRules:[],homeCountryCodes:[]}],roadTrips:[journey],stays:[country],trips:[],transports:[],accommodations:[],notes:[],placeVisits:[],savedPlaces:[],residences:[],excludedCountryCodes:[]};
let revision = 1, saves = 0, logouts = 0, passwordLogins = 0, reads = 0;
let browser;
async function signedInPage() {
  const context = await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) {
      let file = path.resolve(root, '.'+decodeURIComponent(url.pathname));
      if (!file.startsWith(root+path.sep) && file !== root) return route.fulfill({status:403,body:''});
      if (!path.extname(file)) file = path.join(file, 'index.html');
      return fs.existsSync(file) ? route.fulfill({path:file,contentType:contentTypes[path.extname(file)]}) : route.fulfill({status:404,body:''});
    }
    if (url.hostname.endsWith('.supabase.co')) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({json:user});
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'password') passwordLogins++;
        return route.fulfill({json:auth});
      }
      if (url.pathname === '/auth/v1/logout') { logouts++; return route.fulfill({status:204,body:''}); }
      if (url.pathname === '/rest/v1/travel_tracker_data') {
        reads++;
        return route.fulfill({json:[{payload:cloud,revision}]});
      }
      if (url.pathname === '/rest/v1/rpc/save_travel_account') {
        const body = request.postDataJSON();
        if (body.p_revision !== revision) return route.fulfill({status:409,json:{code:'40001',message:'Fixture revision conflict'}});
        cloud = structuredClone(body.p_payload);
        saves++;
        return route.fulfill({json:[{revision:++revision}]});
      }
      return route.fulfill({json:{}});
    }
    return route.abort();
  });
  await context.addInitScript(({auth,userId}) => {
    if (!localStorage.getItem('fixture.account.initialized')) {
      localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));
      localStorage.setItem('whereIveBeen.localOwner.v1',userId);
      localStorage.setItem('whereIveBeen.importNoticed.'+userId,'yes');
      localStorage.setItem('fixture.account.initialized','yes');
    }
  }, {auth,userId});
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.goto(origin);
  await ready(page);
  return {page,context};
}
async function ready(page) {
  await page.waitForFunction(id => window.HVCalendar?.ready && window.HVAccountState?.userId === id && window.HVAccountState?.ready && !window.HVAccountState?.loading && !document.querySelector('.app-shell')?.inert && state.roadTrips?.some(road => road.id === 'cloud-journey'), userId);
}
async function verify(page) {
  const record = await page.evaluate(() => state.roadTrips.find(road => road.id === 'cloud-journey'));
  assert.equal(record.segments[0].departureLocal, '2026-12-02T09:00');
  assert.equal(record.segments[0].notes, 'Booking checked on the first device');
  assert.deepEqual(record.stops.map(stop => stop.id), ['origin','landing','destination']);
  assert.deepEqual(record.segments.map(segment => segment.id), journey.segments.map(segment => segment.id));
  assert.deepEqual(record.stops[0].media, media);
  assert.deepEqual(record.customProvider, {keep:true});
  assert.deepEqual(await page.evaluate(() => state.stays.find(stay => stay.id === 'original-country')), country);
  await page.locator('[data-nav-view="roadTrip"]').click();
  await page.locator('#plannerSaved').selectOption('cloud-journey');
  assert.equal(await page.locator('#plannerStop0').inputValue(),'La Fortuna');
  assert.equal(await page.locator('.planner-stop-select .planner-thumbnail').count(),1);
}
(async () => {
  browser = await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(),args:binary.args.filter(arg => arg !== '--single-process'),headless:true});
  try {
    const first = await signedInPage();
    assert.deepEqual(await first.page.evaluate(() => state.roadTrips[0].stops[0].media),media);
    await first.page.locator('[data-nav-view="roadTrip"]').click();
    await first.page.locator('#plannerSaved').selectOption('cloud-journey');
    await first.page.locator('[data-select-segment]').first().click();
    await first.page.locator('[name="departureDate"]').fill('2026-12-02');
    await first.page.locator('[name="arrivalDate"]').fill('2026-12-02');
    await first.page.locator('#plannerDetailForm [name="notes"]').fill('Booking checked on the first device');
    await first.page.locator('[data-detail-done]').click();
    const saved = first.page.waitForResponse(response => response.url().includes('/rpc/save_travel_account') && response.status() === 200);
    await first.page.locator('#plannerSave').click();
    await saved;
    await first.page.waitForFunction(() => [...document.querySelectorAll('[data-sync-status]')].some(element => element.textContent === 'Saved to account'));
    assert.ok(saves >= 1,'The planner uses the actual account save RPC');
    assert.equal(cloud.roadTrips[0].segments[0].departureLocal,'2026-12-02T09:00');
    assert.deepEqual(cloud.roadTrips[0].stops[0].media,media);
    assert.deepEqual(cloud.stays,[country]);
    assert.equal(cloud.transports.length,0,'Calendar projections create no independently saved transport');
    const second = await signedInPage();
    await verify(second.page);
    await second.context.close();
    await first.page.goto(origin+'/profile/');
    await first.page.locator('#logoutBtn').click();
    await first.page.locator('#signedOutPanel').waitFor();
    await first.page.goto(origin);
    await first.page.waitForFunction(() => window.HVCalendar?.ready && window.HVAccountState);
    await first.page.waitForFunction(() => !window.HVAccountState?.userId && !document.querySelector('.app-shell')?.inert);
    assert.ok(logouts >= 1,'The normal sign-out action reaches the intercepted Auth API');
    assert.equal(await first.page.evaluate(() => state.roadTrips.some(road => road.id === 'cloud-journey')),false,'Account journeys are removed from the signed-out view');
    await first.page.goto(origin+'/login/');
    await first.page.locator('#loginForm #email').fill(user.email);
    await first.page.locator('#loginForm #password').fill('fictional-fixture-password');
    await first.page.locator('#loginForm button').click();
    await first.page.waitForURL(origin+'/');
    await ready(first.page);
    assert.equal(passwordLogins,1,'Returning user signs in through the normal password form');
    await verify(first.page);
    assert.ok(reads >= 3,'Both devices and the returning session hydrate account data');
    assert.deepEqual(first.page.errors,[]);
    assert.deepEqual(second.page.errors,[]);
    await first.context.close();
    console.log('Planner account browser regression passed: cloud graph/media hydrate, UI edit uses real account persistence, a second isolated device receives the edit, and normal sign-out/password sign-in preserve IDs, media and original history. All account requests use fictional intercepted responses.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});

/* Fictional journeys exercise the actual planner, storage and Calendar UI. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const binary = require('@sparticuz/chromium');
const {PNG} = require('pngjs');
const root = path.resolve(__dirname, '..');
const origin = 'https://herald.test';
const out = path.join(root, 'test-results/simplification');
fs.mkdirSync(out, {recursive:true});
const blankTile = PNG.sync.write(new PNG({width:256,height:256,fill:true}));
const contentTypes = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const places = [
  {name:'La Fortuna', lat:10.4712, lon:-84.6454},
  {name:'Arenal boarding point', lat:10.467, lon:-84.725},
  {name:'Lake transfer', lat:10.425, lon:-84.8},
  {name:'Monteverde', lat:10.31, lon:-84.823}
];
const seed = {
  version:2, activeProfileId:'p',
  profiles:[{id:'p',name:'Test traveller',citizenships:['GB'],enabledRules:[],homeCountryCodes:[]}],
  stays:[{id:'old-country',profileId:'p',countryCode:'CR',countryName:'Costa Rica',start:'2025-01-01',end:'2025-01-04',status:'actual',notes:'Keep original country notes'}],
  trips:[{id:'old-trip',profileId:'p',name:'Earlier Costa Rica'}],
  transports:[{id:'old-bus',tripId:'old-trip',profileId:'p',type:'bus',status:'actual',startLocal:'2025-01-01T09:00',endLocal:'2025-01-01T10:00',start:places[0],end:places[1],bookingReference:'ORIGINAL-BOOKING',unknown:{keep:true}}],
  accommodations:[{id:'old-hotel',tripId:'old-trip',profileId:'p',propertyName:'Earlier lodge',location:'La Fortuna',lat:10.47,lon:-84.64,checkIn:'2025-01-01',checkOut:'2025-01-03',notes:'Original hotel notes'}],
  notes:[], placeVisits:[], savedPlaces:[],
  roadTrips:[{id:'legacy-road',profileId:'p',name:'Saved old road route',status:'idea',stops:[{name:'Existing start',lat:5,lon:6},{name:'Existing end',lat:6,lon:7}],unknownField:{keep:true}}]
};
let browser;
async function pageAt(width) {
  const context = await browser.newContext({viewport:{width,height:950},hasTouch:width<=390,serviceWorkers:'block',reducedMotion:'reduce'});
  const page = await context.newPage(), errors = [], queries = [];
  page.on('dialog', dialog=>dialog.accept());
  page.on('pageerror', error => {errors.push(error.message); console.error(error.message);});
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      let file = path.resolve(root, '.'+decodeURIComponent(url.pathname));
      if (!file.startsWith(root+path.sep) && file!==root) return route.fulfill({status:403,body:''});
      if (!path.extname(file)) file = path.join(file,'index.html');
      return fs.existsSync(file) ? route.fulfill({path:file,contentType:contentTypes[path.extname(file)]}) : route.fulfill({status:404,body:''});
    }
    if (url.hostname === 'photon.komoot.io') {
      queries.push([...url.searchParams.entries()]);
      const q = url.searchParams.get('q') || '';
      const point = places.find(place => q.includes(place.name)) || places[0];
      return route.fulfill({json:{features:[{geometry:{coordinates:[point.lon,point.lat]},properties:{osm_type:'N',osm_id:point.name,name:point.name,osm_key:'place',osm_value:'town',country:'Costa Rica',countrycode:'cr'}}]}});
    }
    if (url.hostname === 'tile.openstreetmap.org') return route.fulfill({contentType:'image/png',body:blankTile});
    return route.abort();
  });
  await page.addInitScript(seed => {
    if (!localStorage.getItem('whereIveBeen.data.v2')) localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));
  }, seed);
  await page.goto(origin);
  await page.waitForFunction(() => window.HVCalendar?.ready && window.HVSimpleCalendar && !document.querySelector('.app-shell').inert);
  return {page,context,errors,queries};
}
async function searchStop(page, index, name) {
  const field = page.locator('#plannerStop'+index);
  await field.fill(name);
  await field.press('Enter');
  await page.locator('[data-planner-results="'+index+'"] [data-travel-result]').first().click();
  assert.equal(await page.locator('#plannerStop'+index).inputValue(), name);
}
async function details(page,index) {
  await page.locator('[data-select-segment]').nth(index).click();
  await page.locator('#plannerDetailForm').waitFor();
}
(async () => {
  browser = await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH || await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  for (const width of [1440,390]) {
    const {page,context,errors,queries} = await pageAt(width);
    assert.equal(await page.evaluate(()=>document.body.dataset.currentView),'calendar');
    const nav = page.locator('#heraldPrimaryNav [data-nav-view]');
    assert.deepEqual(await nav.allTextContents(), ['Calendar','Trip Planner','Currency Converter']);
    await page.locator('[data-nav-view="roadTrip"]').click();
    await page.locator('#tripPlannerMap .leaflet-tile-loaded').first().waitFor({state:'attached'});
    await searchStop(page,0,places[0].name);
    await page.locator('#plannerSearchFilter').selectOption('bus');
    await searchStop(page,1,places[1].name);
    assert.ok(queries.some(params=>params.some(([key,value])=>key==='osm_tag'&&value==='amenity:bus_station')));
    await page.locator('#plannerAddStop').click();
    await searchStop(page,2,places[2].name);
    await page.locator('#plannerAddStop').click();
    await searchStop(page,3,places[3].name);
    for (const [index,mode] of ['bus','boat','ferry'].entries()) await page.locator('[data-segment-mode]').nth(index).selectOption(mode);
    await page.locator('#plannerName').fill('Costa Rica transfers');
    await details(page,0);
    await page.locator('[name="departureDate"]').fill('2026-12-01');
    await page.locator('[name="departureTime"]').fill('09:00');
    await page.locator('[name="arrivalDate"]').fill('2026-12-01');
    await page.locator('[name="notes"]').fill('User-entered bus notes');
    await page.locator('[data-detail-done]').click();
    await page.locator('#plannerSave').click();
    await page.getByText('Saved',{exact:true}).waitFor({timeout:5000}).catch(async error => {
      console.error('Save status',await page.locator('#plannerSaveStatus').innerText());
      console.error(await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.startsWith('herald.tripPlanner')).map(([,value])=>JSON.parse(value).draft)));
      throw error;
    });
    let saved = await page.evaluate(()=>state.roadTrips.find(row=>row.name==='Costa Rica transfers'));
    const journeyId = saved.id;
    assert.equal(saved.stops.length,4);
    assert.deepEqual(saved.segments.map(row=>row.mode),['bus','boat','ferry']);
    assert.equal(await page.evaluate(()=>state.transports.length),1,'Planner does not persist duplicate calendar transports');
    assert.equal(await page.evaluate(()=>state.roadTrips.find(row=>row.id==='legacy-road').unknownField.keep),true);
    await details(page,1);
    await page.locator('[data-route-draw]').click();
    const mapBox = await page.locator('#tripPlannerMap').boundingBox();
    await page.mouse.click(mapBox.x+mapBox.width*.55,mapBox.y+mapBox.height*.4);
    await page.locator('#plannerFinishDraw').click();
    if (width===390) await page.locator('#plannerMobileToggle').click();
    await page.locator('[data-detail-done]').click();
    await page.locator('.planner-stop-select').nth(3).click();
    await page.locator('[name="arrivalDate"]').fill('2026-12-01');
    await page.locator('#plannerDetailForm summary').filter({hasText:'Accommodation'}).click();
    await page.locator('[name="stayName"]').fill('Sample Monteverde lodge');
    await page.locator('[name="checkIn"]').fill('2026-12-01');
    await page.locator('[name="checkOut"]').fill('2026-12-03');
    const pixels = new PNG({width:20,height:20});pixels.data.fill(180);
    await page.locator('[data-planner-upload]').setInputFiles({name:'sample-logo.png',mimeType:'image/png',buffer:PNG.sync.write(pixels)});
    await page.locator('.planner-media-editor .planner-thumbnail').waitFor();
    await page.locator('[data-remove-media]').click();
    assert.equal(await page.locator('.planner-media-editor .planner-thumbnail').count(),0);
    await page.locator('[data-planner-upload]').setInputFiles({name:'replacement-logo.png',mimeType:'image/png',buffer:PNG.sync.write(pixels)});
    await page.locator('.planner-media-editor .planner-thumbnail').waitFor();
    await page.locator('[data-detail-done]').click();
    await page.locator('#plannerSave').click();
    saved = await page.evaluate(id=>state.roadTrips.find(row=>row.id===id),journeyId);
    assert.equal(saved.segments[1].route.kind,'manual');
    assert.ok(saved.segments[1].route.coordinates.length>=3);
    assert.match(saved.stops[3].media[0].src,/^data:image\/webp;base64,/);
    assert.equal(saved.stops[3].accommodation.checkIn,'2026-12-01');
    if(width===1440) await page.screenshot({path:path.join(out,'planner-desktop.png')});
    await page.reload();
    await page.locator('#plannerStop3').waitFor();
    assert.equal(await page.locator('#plannerStop3').inputValue(),'Monteverde');
    assert.deepEqual(await page.evaluate(id=>state.roadTrips.find(row=>row.id===id),journeyId),saved);
    await details(page,0);
    await page.locator('[data-entry-calendar]').click();
    await page.locator('.simple-calendar-view-day').waitFor();
    const busId = await page.evaluate(id => HVTripPlannerModel.calendarEntries(state).transports.find(row=>row.plannerId===id && row.mode==='bus').id,journeyId);
    const busSelector = '[data-simple-entry-id="'+busId+'"]';
    const entry = page.locator(busSelector);
    assert.equal(await entry.count(),1);
    await entry.click();
    await page.locator('#plannerDetailForm [name="departureDate"]').waitFor();
    assert.equal(await page.locator('[name="departureDate"]').inputValue(),'2026-12-01');
    await page.locator('[name="departureDate"]').fill('2026-12-02');
    await page.locator('[name="arrivalDate"]').fill('2026-12-02');
    await page.locator('[data-detail-done]').click();
    await page.locator('#plannerSave').click();
    await page.evaluate(()=>HVSimpleCalendar.showDate('2026-12-01','day'));
    assert.equal(await page.locator(busSelector).count(),0);
    await page.evaluate(()=>HVSimpleCalendar.showDate('2026-12-02','day'));
    assert.equal(await page.locator(busSelector).count(),1);
    assert.equal(await page.locator('[data-simple-entry-kind="accommodation"]').count(),1);
    if(width===1440) await page.screenshot({path:path.join(out,'calendar-desktop.png')});
    await page.locator(busSelector).click();
    await page.locator('[name="departureDate"]').fill('');
    await page.locator('[name="arrivalDate"]').fill('');
    await page.locator('[data-detail-done]').click();
    await page.locator('#plannerSave').click();
    await page.evaluate(()=>HVSimpleCalendar.showDate('2026-12-02','day'));
    assert.equal(await page.locator(busSelector).count(),0,'Clearing planner dates removes its derived event');
    await page.locator('[data-nav-view="roadTrip"]').click();
    const beforeCount = await page.locator('[data-stop-id]').count();
    await page.locator('[data-move-stop="2"][data-direction="-1"]').click();
    assert.equal(await page.locator('#plannerStop1').inputValue(),places[2].name);
    await page.locator('[data-remove-stop]').last().click();
    assert.equal(await page.locator('[data-stop-id]').count(),beforeCount-1);
    const history = page.locator('#plannerPreviousConnections');
    await history.locator(':scope > summary').click();
    await history.locator('.planner-previous-item').first().locator(':scope > summary').click();
    await history.locator('[data-copy-previous]').first().click();
    assert.equal(await page.locator('[name="notes"]').inputValue(),'User-entered bus notes','Displaced details can be copied from the visible recovery controls');
    await page.locator('[data-detail-done]').click();
    await page.locator('#plannerSave').click();
    const retained = await page.evaluate(id=>state.roadTrips.find(row=>row.id===id).previousSegments,journeyId);
    assert.ok(retained.some(segment=>segment.notes==='User-entered bus notes'));
    await page.reload();
    await page.locator('#plannerStop2').waitFor();
    assert.deepEqual(await page.evaluate(id=>state.roadTrips.find(row=>row.id===id).previousSegments,journeyId),retained,'Previous connections survive a saved-session reload');
    assert.equal(await page.evaluate(()=>state.stays[0].notes),'Keep original country notes');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal page overflow');
    assert.deepEqual(errors,[]);
    if(width===390) await page.screenshot({path:path.join(out,'planner-mobile.png')});
    await page.evaluate(id=>{
      state.roadTrips=state.roadTrips.filter(row=>row.id!==id);
      window.dispatchEvent(new CustomEvent('hv-data-changed'));
    },journeyId);
    await page.locator('#plannerSave').click();
    assert.equal(await page.evaluate(id=>state.roadTrips.some(row=>row.id===id),journeyId),false,'Saving an old editor cannot resurrect a journey deleted elsewhere');
    assert.ok(await page.locator('#plannerCopy').isVisible());
    const oldRecords = await page.evaluate(()=>JSON.stringify([state.trips,state.transports,state.accommodations]));
    await page.locator('#plannerSaved').selectOption('calendar-trip:old-trip');
    await page.locator('#plannerName').waitFor();
    assert.equal(await page.locator('#plannerName').inputValue(),'Earlier Costa Rica');
    await page.locator('#plannerSave').click();
    assert.equal(await page.evaluate(()=>JSON.stringify([state.trips,state.transports,state.accommodations])),oldRecords);
    const projected = await page.evaluate(()=>{
      const day=HVCalendarData.window(state,'2025-01-01',1).get('2025-01-01');
      return {transports:day.transports.map(row=>({id:row.id,plannerId:row.plannerId})),hotels:day.accommodations.map(row=>({id:row.id,plannerId:row.plannerId}))};
    });
    assert.equal(projected.transports.length,1);
    assert.equal(projected.hotels.length,1);
    assert.ok(projected.transports[0].plannerId);
    assert.ok(projected.hotels[0].plannerId);
    const oldStopCount = await page.locator('[data-stop-id]').count();
    if(width===390) await page.locator('#plannerMobileToggle').click();
    const editMap = await page.locator('#tripPlannerMap').boundingBox();
    await page.mouse.click(editMap.x+editMap.width*.35,editMap.y+editMap.height*.5);
    assert.equal(await page.locator('[data-stop-id]').count(),oldStopCount+1,'A map click adds a waypoint directly');
    assert.equal(await page.evaluate(()=>JSON.stringify([state.trips,state.transports,state.accommodations])),oldRecords);
    await page.locator('[data-nav-view="currency"]').click();
    await page.locator('#currencyAmount').fill('100');
    await page.locator('#currencyRate').fill('1.2');
    assert.match(await page.locator('#currencyResult').innerText(),/120[.,]00/);
    await page.locator('#currencySaveRate').click();
    const rateDialog = page.getByRole('dialog',{name:'Save custom exchange rate'});
    await rateDialog.locator('[name="label"]').fill('Fictional hotel desk');
    await rateDialog.getByRole('button',{name:'Save rate',exact:true}).click();
    assert.equal(await page.evaluate(()=>state.currencyRates.at(-1).rate),1.2);
    await context.close();
    console.log('Multimodal planning, manual route, photos, canonical Calendar edits and persistence passed at '+width+'px.');
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});

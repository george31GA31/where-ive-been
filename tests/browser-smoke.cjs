/* Real Chromium layout/keyboard checks with fictional data and deterministic service failures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HV_PLAYWRIGHT_MODULE||'playwright');
const binary=require('@sparticuz/chromium');
binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HV_SCREENSHOTS||path.join(root,'test-results/browser'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
 if(!path.extname(file))file=path.join(file,'index.html');
 const type={'.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.html':'text/html'};
 try{res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
const seed={version:2,activeProfileId:'a',profiles:[{id:'a',name:'Alex',citizenships:['GB'],enabledRules:['schengen'],homeCountryCodes:['GB']},{id:'b',name:'Sam',citizenships:['US'],enabledRules:['schengen']}],trips:[{id:'alps',profileId:'a',name:'Eastern Alps 2026',notes:'Test itinerary'}],stays:[{id:'home',profileId:'a',countryCode:'GB',countryName:'United Kingdom',start:'2026-01-01',end:'2026-01-10',status:'actual'},{id:'slovenia',profileId:'a',tripId:'alps',countryCode:'SI',countryName:'Slovenia',start:'2026-09-10',end:'2026-09-13',status:'planned'},{id:'austria',profileId:'a',tripId:'alps',countryCode:'AT',countryName:'Austria',start:'2026-09-14',end:'2026-09-22',status:'actual'},{id:'memory-fr',profileId:'a',countryCode:'FR',countryName:'France',start:'2025-09-21',end:'2025-09-21',status:'actual'},{id:'memory-nl',profileId:'a',countryCode:'NL',countryName:'Netherlands',start:'2025-09-21',end:'2025-09-21',status:'actual'},{id:'future',profileId:'a',countryCode:'FR',countryName:'France',start:'2026-12-01',end:'2026-12-04',status:'planned'}],transports:[{id:'flight',profileId:'a',tripId:'alps',type:'flight',status:'planned',startLocal:'2026-09-10T10:00',endLocal:'2026-09-10T12:00',start:{name:'London'},end:{name:'Ljubljana'}}],accommodations:[{id:'hotel-one',profileId:'a',tripId:'alps',propertyName:'Hotel One',location:'Ljubljana',checkIn:'2026-09-10',checkOut:'2026-09-14'},{id:'hotel-two',profileId:'a',tripId:'alps',propertyName:'Hotel Two',location:'Innsbruck',checkIn:'2026-09-14',checkOut:'2026-09-18'}],residences:[{id:'residence-memory',profileId:'a',countryCode:'ES',countryName:'Spain',start:'2024-01-01',end:'2024-12-31'}],placeVisits:[],visualLayers:{calendar:{countries:true,transport:true,accommodation:true}}};
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
 let scenes=0;
 const widths=process.env.HV_BROWSER_WIDTH?[Number(process.env.HV_BROWSER_WIDTH)]:[390,768,1440];
 const themes=process.env.HV_BROWSER_THEME?[process.env.HV_BROWSER_THEME]:['light','dark'];
 for(const width of widths)for(const theme of themes){
  const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'}),errors=[];
  await page.clock.install({time:new Date('2026-09-21T12:00:00Z')});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=route.request().url();if(url.startsWith(origin))return route.continue();
    if(url.includes('/d3@'))return route.fulfill({path:path.join(root,'node_modules/d3/dist/d3.min.js'),contentType:'text/javascript'});
    if(url.includes('/topojson-client@'))return route.fulfill({path:path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),contentType:'text/javascript'});
    if(url.includes('/world-atlas@'))return route.fulfill({path:path.join(root,'node_modules/world-atlas/countries-50m.json'),contentType:'application/json'});
    return route.abort();
  });
  await page.addInitScript(({seed,theme})=>{localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('whereIveBeen.theme.v1',theme);},{seed,theme});
  for(const route of ['dashboard','calendar','map','trips','countries','country/GB','stats','places','people']){
   await page.goto(origin+'/#/'+route);await page.waitForFunction(()=>window.HVPages&&document.querySelector('main>.view.active'));await page.waitForTimeout(250);
   const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,views:document.querySelectorAll('main>.view').length}));
   assert.equal(geometry.views,1,route+' mounts one page');assert.ok(geometry.scroll<=geometry.width+2,`${route}/${width}/${theme} overflows: ${geometry.scroll}`);
   if(route==='dashboard'){assert.deepEqual(await page.evaluate(()=>({stay:state.stays.find(s=>s.id==='slovenia').status,transport:state.transports.find(t=>t.id==='flight').status})),{stay:'actual',transport:'actual'},'Past planned travel completes automatically');assert.match(await page.locator('#dashboardGaps').innerText(),/Trips update automatically/);assert.equal(await page.locator('[data-action="confirm-stay"], [data-action="keep-planned"]').count(),0,'No manual confirmation queue remains');assert.match(await page.locator('#travelMemoryPanel').innerText(),/This day 1 year ago, you were in France and Netherlands/,'Travel memory groups places on the same date');assert.match(await page.locator('#travelMemoryPanel').innerText(),/This day 2 years ago, you were in Spain/,'Travel memory includes lived-in history');}
   if(route==='map'){await page.waitForSelector('.map-country');const previous=page.url();await page.locator('#mapCountrySelect').selectOption('GB');assert.equal(page.url(),previous);assert.equal(await page.locator('#mapCountrySummary').isVisible(),true);}
   if(route==='calendar'){
    assert.equal(await page.locator('[role="button"] button').count(),0,'No nested date buttons');
    if(width===1440)assert.ok((await page.locator('.calendar-layout').boundingBox()).y<550,'The journey calendar begins above the fold');
    assert.equal(await page.locator('button[data-calendar-view="agenda"]').count(),0,'Agenda has been removed');
    assert.equal(await page.locator('#calendarAgenda').count(),0,'Agenda host has been removed');
    assert.equal(await page.locator('#calendarView .calendar-filters').count(),0,'The shifting pop-up filter control is gone');assert.equal(await page.locator('[data-calendar-layer="accommodation"]').innerText(),'Accommodation','Calendar layers use clear, compact labels');
    const turnover=page.locator('[data-calendar-date="2026-09-14"] .calendar-lodging-row');assert.equal(await turnover.count(),1,'Check-out and check-in share one quiet accommodation row');assert.match(await turnover.getAttribute('aria-label'),/Hotel One, Ljubljana; Hotel Two, Innsbruck/,'Turnover day names both accommodations');assert.ok(await turnover.locator('.lodging-end').count(),'Check-out occupies the first half of the date');assert.ok(await turnover.locator('.lodging-start').count(),'Check-in occupies the second half of the date');assert.equal(await page.evaluate(()=>{const g=window.HVCalendar._groups.find(x=>x.key==='trip:alps');return `${g.start}/${g.end}`;}),'2026-09-10/2026-09-22','Accommodation dates do not redefine the trip dates');assert.ok(await page.locator('[data-calendar-date="2026-09-14"] .calendar-chip-flag').count(),'Country flags appear with trip chips');const accommodationToggle=page.locator('[data-calendar-layer="accommodation"]'),filterBefore=await accommodationToggle.boundingBox();await accommodationToggle.click();assert.equal(await page.locator('.calendar-lodging-row').count(),0,'Accommodation layer can be hidden');assert.deepEqual(await accommodationToggle.boundingBox(),filterBefore,'Layer controls stay fixed when opened');await accommodationToggle.click();assert.ok(await page.locator('.calendar-lodging-row').count(),'Accommodation layer can be restored');
    await page.locator('[data-calendar-journey="trip:alps"]').first().click();
    assert.ok(await page.locator('#stayDialog[open]').count(),'Existing country entry opens directly for editing');assert.equal(await page.locator('#stayTripSelect').isVisible(),false);await page.evaluate(()=>document.querySelector('#stayDialog').close());
    assert.equal(await page.locator('.calendar-day').first().evaluate(el=>getComputedStyle(el).borderBottomWidth),'1px','Normal cell borders remain');
    assert.equal(await page.locator('.calendar-schengen').first().innerText(),'','Schengen is a small labelled dot');
    const dateButton=page.locator('[data-calendar-date-select="2026-09-01"]');await dateButton.focus();await page.keyboard.press('Enter');await dateButton.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#tripPlannerDialog[open]').count(),0,'Selecting a range keeps the editor on the Calendar');assert.ok(await page.locator('.selection-start').count(),'Date range remains highlighted');assert.ok(await page.locator('[data-calendar-date-action="country"]').count(),'Date panel offers a country action');
   }
   await page.screenshot({path:path.join(out,`${route.replace('/','-')}-${width}-${theme}.png`),fullPage:true});scenes++;
  }
  assert.deepEqual(errors,[],'No uncaught browser errors');await page.close();
 }
 const edit=await browser.newPage({viewport:{width:1440,height:960}});
 await edit.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(origin))return route.continue();
  if(url.includes('photon.komoot.io/api/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({features:[{geometry:{coordinates:[-3.70,40.42]},properties:{osm_type:'N',osm_id:123,name:'Hotel XYZ',osm_value:'hotel',street:'Calle Mayor',city:'Madrid',country:'España',countrycode:'ES'}}]})});
  return route.abort();
 });
 await edit.addInitScript(seed=>localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed)),seed);
 await edit.goto(origin+'/#/calendar');await edit.waitForFunction(()=>window.HVCalendar?.ready);
 await edit.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
 await edit.locator('[data-calendar-date-select="2026-10-05"]').click();await edit.locator('[data-calendar-date-select="2026-10-12"]').click();
 assert.equal(await edit.locator('.selection-range').count(),8,'Eight inclusive dates remain visibly selected');
 await edit.locator('[data-calendar-date-action="country"]').click();await edit.locator('#calendarQuickCountry [name="country"]').fill('Spain');await edit.locator('#calendarQuickCountry button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.stays.filter(s=>s.countryCode==='ES'&&s.start==='2026-10-05'&&s.end==='2026-10-12').length),1,'Range creates one linked stay, not daily duplicates');
 assert.equal(await edit.locator('#calendarQuickCountry [name="tripId"]').count(),0,'No trip choice in date entry');
 assert.equal(await edit.evaluate(()=>state.stays.find(s=>s.countryCode==='ES'&&s.start==='2026-10-05').tripId),null,'Unassociated country dates remain standalone');
 await edit.locator('[data-calendar-date-action="accommodation"]').click();
 await edit.locator('.place-search-dialog [name="query"]').fill('Hotel XYZ Madrid');await edit.locator('[data-place-result="0"]').click();
 assert.match(await edit.locator('.place-selected').innerText(),/Calle Mayor/);
 await edit.locator('.place-search-dialog button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.accommodations.filter(a=>a.propertyName==='Hotel XYZ'&&a.checkIn==='2026-10-05'&&a.checkOut==='2026-10-12'&&!a.tripId).length),1,'Range creates one standalone accommodation record');
 assert.ok(await edit.locator('[data-calendar-date="2026-10-05"] .lodging-start').count());
 await edit.locator('[data-calendar-date-action="transport"]').click();
 for(const query of ['alic','ALC','LEAL']){await edit.locator('[name="startname"]').fill(query);assert.match(await edit.locator('[data-airport-results="start"]').innerText(),/ALC · LEAL/);}
 await edit.locator('[data-airport-results="start"] button').first().click();await edit.locator('[name="endname"]').fill('LHR');await edit.locator('[data-airport-results="end"] button').first().click();
 assert.equal(await edit.locator('#transportForm input[type="number"]:visible').count(),0);
 await edit.locator('#transportForm button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.transports.at(-1).start.icao),'LEAL');assert.equal(await edit.evaluate(()=>state.stays.length),seed.stays.length+1,'Transport and accommodation never add country stays');
 await edit.goto(origin+'/#/map');await edit.getByRole('button',{name:'+ Add a place'}).click();await edit.locator('.place-search-dialog [name="query"]').fill('Hotel XYZ Madrid');await edit.locator('[data-place-result="0"]').click();
 await edit.locator('[data-place-plot]').click();await edit.locator('.place-pin-map').click({position:{x:160,y:130}});
 await edit.locator('[name="placeName"]').fill('Quiet campsite');await edit.locator('[name="placeType"]').selectOption('Campsite');
 const pin=edit.locator('.herald-map-pin');await pin.focus();await edit.keyboard.press('ArrowRight');
 assert.match(await edit.locator('[data-pin-status]').innerText(),/Pin placed/);assert.equal(await edit.locator('.place-search-dialog input[type="number"]').count(),0);
 await edit.locator('.place-search-dialog').screenshot({path:path.join(out,'place-pin-desktop.png')});
 await edit.locator('.place-search-dialog button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.placeVisits.filter(v=>v.category==='locations'&&v.place?.name==='Quiet campsite'&&Number.isFinite(v.place.lat)).length),1,'Map selection saves a dated location');
 await edit.close();
 { // Touch range selection and direct pin placement must work without coordinate fields.
 const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 await touch.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await touch.addInitScript(seed=>localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed)),seed);
 await touch.goto(origin+'/#/calendar');await touch.waitForFunction(()=>window.HVCalendar?.ready);
 await touch.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
 await touch.locator('[data-calendar-date-select="2026-10-05"]').tap();
 await touch.locator('[data-calendar-date-select="2026-10-12"]').scrollIntoViewIfNeeded();await touch.locator('[data-calendar-date-select="2026-10-12"]').tap();
 assert.equal(await touch.locator('.selection-range').count(),8,'Touch selects the full inclusive range');
 await touch.locator('[data-range-end]').fill('2026-10-13');await touch.locator('[data-range-end]').dispatchEvent('change');assert.equal(await touch.locator('.selection-range').count(),9,'Range endpoint is editable');
 await touch.locator('[data-calendar-date-action="location"]').tap();await touch.locator('[data-place-plot]').tap();
 await touch.locator('.place-pin-map').tap({position:{x:160,y:120}});await touch.locator('[name="placeName"]').fill('Unlisted cabin');await touch.locator('[name="country"]').fill('Spain');
 const pin=touch.locator('.herald-map-pin');await pin.scrollIntoViewIfNeeded();const box=await pin.boundingBox(),cdp=await touch.context().newCDPSession(touch);
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterPin=await pin.boundingBox();assert.ok(Math.abs(afterPin.x-box.x)>10,'Pin responds to touch dragging');
 await touch.locator('.place-search-dialog').screenshot({path:path.join(out,'place-pin-mobile.png')});await touch.locator('.place-search-dialog button[type="submit"]').tap();
 assert.equal(await touch.evaluate(()=>state.placeVisits.at(-1).place.name),'Unlisted cabin');
 assert.equal(await touch.evaluate(()=>state.placeVisits.at(-1).endDate),'2026-10-13');
 await touch.close();
 }
 const empty=await browser.newPage({viewport:{width:390,height:844}});await empty.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await empty.goto(origin+'/#/dashboard');await empty.waitForSelector('[data-add-first-trip]');assert.match(await empty.locator('#travelMemoryPanel').innerText(),/No travel outside your home country is recorded/,'Dashboard memory has a clear no-history state');await empty.locator('[data-add-first-trip]').click();await empty.waitForSelector('#tripPlannerDialog[open]');const emptyPlanner=empty.locator('#tripPlannerDialog');await emptyPlanner.locator('[name="start"]').fill('2026-09-01');await emptyPlanner.locator('[name="end"]').fill('2026-09-03');await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[name="tripName"]').fill('First trip');await emptyPlanner.locator('[data-planner-stop] [name="countryName"]').fill('France');await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[data-planner-next]').click();await empty.context().setOffline(true);await emptyPlanner.locator('button[type="submit"]').click();await empty.waitForFunction(()=>state.stays.length===1);const saved=await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));assert.ok(JSON.parse(saved).stays.length===1,'Guest edits persist when the connection drops');let offlineReloadFailed=false;try{await empty.reload({timeout:5000});}catch{offlineReloadFailed=true;}assert.ok(offlineReloadFailed,'No full offline reload support is claimed');await empty.context().setOffline(false);await empty.goto(origin+'/#/dashboard');assert.equal(await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),saved,'Offline reload failure does not delete guest data');await empty.screenshot({path:path.join(out,'empty-mobile.png'),fullPage:true});await empty.close();
 const account=await browser.newPage({viewport:{width:390,height:844}});await account.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());for(const route of ['profile','login','register','reset-password']){await account.goto(origin+'/'+route+'/');await account.waitForTimeout(200);assert.ok(await account.locator('#accountMessage').innerText(),'Account library failure is visible');await account.screenshot({path:path.join(out,route+'-mobile-error.png'),fullPage:true});}await account.close();
 console.log(`Browser checks passed: ${scenes} populated scenes (${widths.join(', ')}px; ${themes.join(', ')}), empty CTA, keyboard date selection, service failure and layout checks.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

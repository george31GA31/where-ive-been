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
const seed={version:2,activeProfileId:'a',profiles:[{id:'a',name:'Alex',citizenships:['GB'],enabledRules:['schengen'],homeCountryCodes:[]},{id:'b',name:'Sam',citizenships:['US'],enabledRules:['schengen']}],trips:[{id:'alps',profileId:'a',name:'Eastern Alps 2026',notes:'Test itinerary'}],stays:[{id:'home',profileId:'a',countryCode:'GB',countryName:'United Kingdom',start:'2026-01-01',end:'2026-01-10',status:'actual'},{id:'slovenia',profileId:'a',tripId:'alps',countryCode:'SI',countryName:'Slovenia',start:'2026-09-10',end:'2026-09-13',status:'planned'},{id:'austria',profileId:'a',tripId:'alps',countryCode:'AT',countryName:'Austria',start:'2026-09-14',end:'2026-09-22',status:'actual'},{id:'memory-fr',profileId:'a',countryCode:'FR',countryName:'France',start:'2025-09-21',end:'2025-09-21',status:'actual'},{id:'memory-nl',profileId:'a',countryCode:'NL',countryName:'Netherlands',start:'2025-09-21',end:'2025-09-21',status:'actual'},{id:'future',profileId:'a',countryCode:'FR',countryName:'France',start:'2026-12-01',end:'2026-12-04',status:'planned'}],transports:[{id:'flight',profileId:'a',tripId:'alps',type:'flight',status:'planned',startLocal:'2026-09-10T10:00',endLocal:'2026-09-10T12:00',start:{name:'London'},end:{name:'Ljubljana'}}],accommodations:[{id:'hotel-one',profileId:'a',tripId:'alps',propertyName:'Hotel One',place:{name:'Hotel One',lat:46.05,lon:14.50,countryCode:'SI'},location:'Ljubljana',checkIn:'2026-09-10',checkOut:'2026-09-14'},{id:'hotel-two',profileId:'a',tripId:'alps',propertyName:'Hotel Two',location:'Innsbruck',checkIn:'2026-09-14',checkOut:'2026-09-18'}],residences:[{id:'legacy-home',profileId:'a',countryCode:'GB',countryName:'United Kingdom',start:'1990-01-01',end:null},{id:'residence-memory',profileId:'a',countryCode:'ES',countryName:'Spain',start:'2024-01-01',end:'2024-12-31'}],placeVisits:[],visualLayers:{calendar:{countries:true,transport:true,accommodation:true}}};
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
 let scenes=0;
 const widths=process.env.HV_BROWSER_WIDTH?[Number(process.env.HV_BROWSER_WIDTH)]:[390,768,1440];
 const themes=process.env.HV_BROWSER_THEME?[process.env.HV_BROWSER_THEME]:['light','dark'];
 if(!process.env.HV_GLOBAL_ONLY){
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
  for(const route of ['dashboard','calendar','journey-map','map','trips','countries','country/GB','stats','places','people']){
   await page.goto(origin+'/#/'+route);await page.waitForFunction(()=>window.HVPages&&document.querySelector('main>.view.active'));await page.waitForTimeout(250);
   const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,views:document.querySelectorAll('main>.view').length}));
   assert.equal(geometry.views,1,route+' mounts one page');assert.ok(geometry.scroll<=geometry.width+2,`${route}/${width}/${theme} overflows: ${geometry.scroll}`);
   if(route==='dashboard'){assert.doesNotMatch(await page.locator('#travelMemoryPanel').innerText(),/United Kingdom/,'Legacy home residence cannot appear in memories');assert.deepEqual(await page.evaluate(()=>({stay:state.stays.find(s=>s.id==='slovenia').status,transport:state.transports.find(t=>t.id==='flight').status})),{stay:'actual',transport:'actual'},'Past planned travel completes automatically');assert.match(await page.locator('#dashboardGaps').innerText(),/Trips update automatically/);assert.equal(await page.locator('[data-action="confirm-stay"], [data-action="keep-planned"]').count(),0,'No manual confirmation queue remains');assert.match(await page.locator('#travelMemoryPanel').innerText(),/This day 1 year ago, you were in France and Netherlands/,'Travel memory groups places on the same date');assert.match(await page.locator('#travelMemoryPanel').innerText(),/This day 2 years ago, you were in Spain/,'Travel memory includes lived-in history');}
   if(route==='map'){await page.waitForSelector('.map-country');assert.equal(await page.locator('.saved-place-pin').count(),0,'Accommodation is never added to Atlas');assert.ok(await page.locator('.map-country[data-code="GB"].visited').count(),'Home remains highlighted on the map');assert.equal(await page.locator('.map-country[data-code="GB"].current').count(),0,'Home is not current while abroad');const previous=page.url();await page.locator('#mapCountrySelect').selectOption('GB');assert.equal(page.url(),previous);assert.equal(await page.locator('#mapCountrySummary').isVisible(),true);}
   if(route==='journey-map'){assert.match(await page.locator('#journeyLibraryRecords').innerText(),/Hotel One/);await page.locator('[data-journey-layer=flights]').click();await page.locator('[data-journey-layer=transport]').click();assert.equal(await page.locator('#journeyLibraryRecords [data-transport-edit]').count(),0);await page.locator('[data-journey-period=past]').click();assert.match(await page.locator('#journeyLibraryRecords').innerText(),/Hotel One/);await page.locator('[data-journey-period=upcoming]').click();assert.doesNotMatch(await page.locator('#journeyLibraryRecords').innerText(),/Hotel One/);}
   if(route==='calendar'){
    await page.evaluate(()=>HVJourneyMap.open('trip:alps'));assert.equal(await page.locator('.marker-accommodation').count(),1,'Plotted accommodation is on the separate Journey Map');await page.locator('[data-map-close]').click();
    assert.equal(await page.locator('[role="button"] button').count(),0,'No nested date buttons');
    if(width===1440)assert.ok((await page.locator('.calendar-layout').boundingBox()).y<550,'The journey calendar begins above the fold');
    assert.equal(await page.locator('button[data-calendar-view="agenda"]').count(),0,'Agenda has been removed');
    assert.equal(await page.locator('#calendarAgenda').count(),0,'Agenda host has been removed');
    assert.equal(await page.locator('#calendarView .calendar-filters').count(),0,'The shifting pop-up filter control is gone');assert.equal(await page.locator('[data-calendar-layer="accommodation"]').innerText(),'Accommodation','Calendar layers use clear, compact labels');
    const turnover=page.locator('[data-calendar-date="2026-09-14"] .calendar-lodging-row');assert.equal(await turnover.count(),1,'Check-out and check-in share one quiet accommodation row');assert.match(await turnover.getAttribute('aria-label'),/Hotel One, Ljubljana; Hotel Two, Innsbruck/,'Turnover day names both accommodations');assert.ok(await turnover.locator('.lodging-end').count(),'Check-out occupies the first half of the date');assert.ok(await turnover.locator('.lodging-start').count(),'Check-in occupies the second half of the date');assert.equal(await page.evaluate(()=>{const g=window.HVCalendar._groups.find(x=>x.key==='trip:alps');return `${g.start}/${g.end}`;}),'2026-09-10/2026-09-22','Accommodation dates do not redefine the trip dates');assert.ok(await page.locator('[data-calendar-date="2026-09-14"] .calendar-chip-flag').count(),'Country flags appear with trip chips');const accommodationToggle=page.locator('[data-calendar-layer="accommodation"]'),filterBefore=await accommodationToggle.boundingBox();await accommodationToggle.click();assert.equal(await page.locator('.calendar-lodging-row').count(),0,'Accommodation layer can be hidden');assert.deepEqual(await accommodationToggle.boundingBox(),filterBefore,'Layer controls stay fixed when opened');await accommodationToggle.click();assert.ok(await page.locator('.calendar-lodging-row').count(),'Accommodation layer can be restored');
    await page.locator('[data-calendar-journey="trip:alps"]').first().click();
    assert.ok(await page.locator('#stayDialog[open]').count(),'Existing country entry opens directly for editing');assert.equal(await page.locator('#stayTripSelect').isVisible(),false);await page.evaluate(()=>document.querySelector('#stayDialog').close());
    assert.equal(await page.locator('.calendar-day').first().evaluate(el=>getComputedStyle(el).borderBottomWidth),'1px','Normal cell borders remain');
    assert.equal(await page.locator('.calendar-schengen').first().innerText(),'S','An unsplit Schengen country has the labelled blue marker');
    const dateButton=page.locator('[data-calendar-date-select="2026-09-01"]');await dateButton.focus();await page.keyboard.press('Enter');await dateButton.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#tripPlannerDialog[open]').count(),0,'Selecting a range keeps the editor on the Calendar');assert.ok(await page.locator('.selection-start').count(),'Date range remains highlighted');assert.ok(await page.locator('[data-calendar-date-action="country"]').count(),'Date panel offers a country action');
   }
   await page.screenshot({path:path.join(out,`${route.replace('/','-')}-${width}-${theme}.png`),fullPage:true});scenes++;
  }
  assert.deepEqual(errors,[],'No uncaught browser errors');await page.close();
 }
 const edit=await browser.newPage({viewport:{width:1440,height:960}}),editErrors=[];edit.on('pageerror',e=>editErrors.push(e.message));
 await edit.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(origin))return route.continue();
  if(url.includes('routing.openstreetmap.de/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({code:'Ok',waypoints:[{distance:0},{distance:0}],routes:[{geometry:{coordinates:[[-90.5069,14.6349],[-90.1,15.2],[-89.7,16.2],[-89.1523,17.068]]}}]})});
  if(url.includes('photon.komoot.io/api/')&&new URL(url).searchParams.get('q').includes('Long Hotel'))return route.fulfill({contentType:'application/json',body:JSON.stringify({features:Array.from({length:35},(_,i)=>({geometry:{coordinates:[3.05,36.77]},properties:{osm_type:'N',osm_id:500+i,name:'Long Hotel '+i+' — A recognised property with a deliberately long descriptive name',osm_value:'hotel',street:'A very long street address with multiple building names and full postal details',city:'Algiers',country:'Algeria',countrycode:'DZ'}}))})});
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
 const first=edit.locator('[data-leg="0"]');
 for(const query of ['Ljubljana','LJU','LJLJ']){await first.locator('[data-leg-field="start"]').fill(query);assert.match(await first.locator('[data-results="start"]').innerText(),/LJU · LJLJ/);}
 await first.locator('[data-results="start"] button').first().click();await first.locator('[data-leg-field="end"]').fill('ZRH');await first.locator('[data-results="end"] button').first().click();
 await first.locator('[data-leg-field="startLocal"]').fill('2026-10-05T10:00');await first.locator('[data-leg-field="endLocal"]').fill('2026-10-05T11:00');
 await first.locator('[data-leg-field="airline"]').fill('Swiss');await first.locator('[data-results="airline"] button').first().click();await first.locator('[data-leg-field="flightNumber"]').fill('LX2279');
 await edit.locator('[data-leg-add]').click();const second=edit.locator('[data-leg="1"]');await second.locator('[data-leg-field="end"]').fill('ALC');await second.locator('[data-results="end"] button').first().click();
 await second.locator('[data-leg-field="startLocal"]').fill('2026-10-05T13:00');await second.locator('[data-leg-field="endLocal"]').fill('2026-10-05T15:00');await second.locator('[data-leg-field="airline"]').fill('Edelweiss');await second.locator('[data-results="airline"] button').first().click();await second.locator('[data-leg-field="flightNumber"]').fill('WK185');
 await edit.locator('[data-leg-up="1"]').click();assert.equal(await first.locator('[data-leg-field="flightNumber"]').inputValue(),'WK185');await edit.locator('[data-leg-down="0"]').click();
 await edit.locator('#transportDialog').evaluate(el=>el.scrollTop=0);await edit.locator('#transportDialog').screenshot({path:path.join(out,'flight-legs-desktop.png')});
 assert.equal(await edit.locator('#transportForm input[type="number"]:visible').count(),0);
 await edit.locator('#transportForm button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>HVJourneys.transportLabel(state.transports.at(-1))),'LJU → ZRH → ALC');
 assert.deepEqual(await edit.evaluate(()=>state.transports.at(-1).legs.map(l=>l.flightNumber)),['LX2279','WK185']);assert.notEqual(await edit.evaluate(()=>state.transports.at(-1).legs[0].airline.name),await edit.evaluate(()=>state.transports.at(-1).legs[1].airline.name));
 await edit.evaluate(()=>HVJourneys.openTransport(state.transports.at(-1).id));assert.equal(await edit.locator('.flight-leg').count(),2);await edit.locator('#transportForm button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.transports.at(-1).start.icao),'LJLJ');assert.equal(await edit.evaluate(()=>state.stays.length),seed.stays.length+1,'Transport and accommodation never add country stays');
 await edit.evaluate(()=>HVJourneyMap.open('transport:'+state.transports.at(-1).id));assert.equal(await edit.locator('.journey-map-stops li').count(),2);assert.equal(await edit.locator('.journey-map-canvas .leaflet-overlay-pane path').count(),2,'Two separate curved flight legs');await edit.locator('.journey-map-dialog').screenshot({path:path.join(out,'journey-map-desktop.png')});await edit.locator('[data-map-close]').click();
 await edit.goto(origin+'/#/map');await edit.getByRole('button',{name:'+ Add a place'}).click();await edit.locator('.place-search-dialog [name="query"]').fill('Hotel XYZ Madrid');await edit.locator('[data-place-result="0"]').click();
 await edit.locator('[data-place-plot]').click();await edit.locator('.place-pin-map').click({position:{x:160,y:130}});
 await edit.locator('[data-pin-confirm]').click();await edit.locator('[name="placeName"]').fill('Quiet campsite');await edit.locator('[name="placeType"]').selectOption('Campsite');
 const pin=edit.locator('.herald-map-pin');await pin.focus();await edit.keyboard.press('ArrowRight');
 assert.match(await edit.locator('[data-pin-status]').innerText(),/Pin placed/);assert.equal(await edit.locator('.place-search-dialog input[type="number"]').count(),0);
 await edit.locator('.place-search-dialog').screenshot({path:path.join(out,'place-pin-desktop.png')});
 await edit.locator('.place-search-dialog button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.placeVisits.filter(v=>v.category==='locations'&&v.place?.name==='Quiet campsite'&&Number.isFinite(v.place.lat)).length),1,'Map selection saves a dated location');
 // Dated domestic holidays are explicit, retain GB, and survive the Calendar save path.
 await edit.goto(origin+'/#/calendar');await edit.waitForFunction(()=>HVCalendar?.ready);
 await edit.evaluate(()=>{calendarCursor=new Date(Date.UTC(2025,8,1));renderCalendar();});
 await edit.locator('[data-calendar-date-select="2025-09-21"]').click();await edit.locator('[data-calendar-date-action="country"]').click();await edit.locator('#calendarQuickCountry [name="country"]').fill('Scotland');await edit.locator('#calendarQuickCountry button[type="submit"]').click();await edit.locator('dialog[aria-label="Home or trip"] select').selectOption('trip');await edit.locator('dialog[aria-label="Home or trip"] button[type=submit]').click();
 await edit.waitForFunction(()=>state.stays.at(-1)?.domesticDestination==='GB-SCT');assert.deepEqual(await edit.evaluate(()=>{const s=state.stays.at(-1);return {code:s.countryCode,destination:s.domesticDestination,holiday:s.domesticHoliday};}),{code:'GB',destination:'GB-SCT',holiday:true});assert.ok(await edit.locator('.calendar-chip-flag[src*="gb-sct"]').count());
 assert.ok(await edit.evaluate(()=>HVJourney.memories(state,'2026-09-21').some(m=>m.places.some(p=>p.name==='Scotland'))));assert.equal(await edit.evaluate(()=>HVJourney.summary(state,'2026-09-21').countries.has('GB')),true);
 assert.equal(await edit.locator('#prevMonth').evaluate(el=>getComputedStyle(el).borderRadius),'4px');
 // Accommodation search shows more than eight matches, with one scroll container and bounded text.
 await edit.evaluate(()=>HVPlaces.open({accommodation:true,date:'2026-10-05',end:'2026-10-12'}));await edit.locator('[name="query"]').fill('Long Hotel');await edit.locator('[data-place-result="9"]').waitFor();assert.equal(await edit.locator('[data-place-result]').count(),10);await edit.locator('[data-place-more]').click();assert.equal(await edit.locator('[data-place-result]').count(),20);
 for(const width of [390,768,1440]){
  await edit.setViewportSize({width,height:960});assert.ok(await edit.locator('.place-search-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.equal(await edit.locator('.place-search-results').evaluate(el=>getComputedStyle(el).maxHeight),'none');
  assert.ok(await edit.locator('.place-result-copy').evaluateAll(nodes=>nodes.every(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&el.scrollWidth<=el.clientWidth+1;})));
  await edit.locator('.place-search-dialog').evaluate(el=>el.scrollTop=0);await edit.locator('.place-search-dialog').screenshot({path:path.join(out,`hotel-results-${width}.png`)});
 }
 await edit.locator('[data-place-close]').click();
 await edit.evaluate(()=>{state.transports.push({id:'road-map',tripId:'road-trip',profileId:'a',type:'bus',status:'actual',start:{name:'Guatemala City bus station',lat:14.6349,lon:-90.5069},end:{name:'Melchor de Mencos',lat:17.068,lon:-89.1523},startLocal:'2026-09-22T10:00',endLocal:'2026-09-22T18:00'});HVJourneyMap.open('trip:road-trip');});
 await edit.getByText('Calculated road route',{exact:true}).waitFor();assert.equal(await edit.locator('.journey-map-canvas .leaflet-overlay-pane path.leaflet-interactive').count(),1);assert.equal(await edit.locator('.journey-map-canvas .leaflet-overlay-pane path.leaflet-interactive').getAttribute('stroke'),'#29556b');
 for(const width of [390,768,1440]){await edit.setViewportSize({width,height:960});await edit.locator('.journey-map-dialog').evaluate(el=>el.scrollTop=0);assert.ok(await edit.locator('.journey-map-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await edit.locator('.journey-map-dialog').screenshot({path:path.join(out,`road-journey-${width}.png`)});}
 await edit.locator('[data-map-close]').click();
 // Unknown airports can retain private codes and a plotted position without adding countries.
 await edit.evaluate(()=>HVJourneys.openTransport(null,{startLocal:'2026-11-05T12:00',endLocal:'2026-11-05T14:00'}));
 await edit.locator('[data-manual-airport="start"]').click();const manual=edit.locator('.manual-airport-dialog');await manual.locator('[name=airportName]').fill('Unlisted test airfield');await manual.locator('[name=iata]').fill('qxy');await manual.locator('[name=icao]').fill('qqxy');await manual.locator('[name=city]').fill('Test region');await manual.locator('[name=country]').fill('Guyana');await manual.locator('[data-airport-pin]').click();
 const picker=edit.locator('.place-search-dialog:not(.manual-airport-dialog)');await picker.locator('[data-place-plot]').click();await picker.locator('.place-pin-map').click({position:{x:140,y:100}});await picker.locator('[data-pin-confirm]').click();await picker.locator('[name=placeName]').fill('Unlisted test airfield');await picker.locator('[name=country]').fill('Guyana');await picker.locator('button[type=submit]').click();await manual.locator('button[type=submit]').click();
 await edit.locator('[data-leg="0"] [data-leg-field=end]').fill('ALC');await edit.locator('[data-leg="0"] [data-results=end] button').first().click();const countryCount=await edit.evaluate(()=>state.stays.length);await edit.locator('#transportForm button[type=submit]').click();
 assert.equal(await edit.evaluate(()=>state.transports.at(-1).start.iata),'QXY');assert.equal(await edit.evaluate(()=>state.transports.at(-1).start.icao),'QQXY');assert.equal(await edit.evaluate(()=>Number.isFinite(state.transports.at(-1).start.lat)),true);assert.equal(await edit.evaluate(()=>state.stays.length),countryCount);
 await edit.evaluate(()=>HVJourneys.openTransport(state.transports.at(-1).id));await edit.locator('[data-manual-airport=start]').click();assert.equal(await manual.locator('[name=iata]').inputValue(),'QXY');await manual.locator('[data-airport-cancel]').click();await edit.locator('#transportDialog [data-close-transport]').first().click();
 await edit.evaluate(()=>HVJourneys.openTransport());await edit.locator('[data-leg="0"] [data-leg-field=start]').fill('QXY');assert.match(await edit.locator('[data-leg="0"] [data-results=start]').innerText(),/Unlisted test airfield/);await edit.locator('#transportDialog [data-close-transport]').first().click();
 await edit.goto(origin+'/#/journey-map');await edit.waitForSelector('#journeyLibraryRecords [data-journey-map]');await edit.locator('[name=journeySearch]').fill('QXY');await edit.waitForFunction(()=>document.querySelectorAll('#journeyLibraryRecords [data-journey-map]').length===1);assert.match(await edit.locator('#journeyLibraryRecords').innerText(),/QXY/);await edit.locator('#journeyLibraryRecords [data-journey-map]').click();assert.ok(await edit.locator('.journey-map-marker').count());await edit.locator('[data-map-close]').click();
 await edit.goto(origin+'/#/calendar');await edit.waitForFunction(()=>HVCalendar?.ready);await edit.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,10,1));renderCalendar();});await edit.locator('.day-number[data-calendar-date-select="2026-11-05"]').click();assert.match(await edit.locator('#calendarJourneyDetail').innerText(),/QXY/);assert.doesNotMatch(await edit.locator('#calendarJourneyDetail').innerText(),/At sea/);
 const countsBefore=await edit.evaluate(()=>({trips:state.trips.length,transports:state.transports.length,accommodations:state.accommodations.length}));
 await edit.evaluate(()=>HVCalendar.openTripPlanner({start:'2026-10-05',end:'2026-10-12',countryName:'Spain',tripName:'Wizard journey'}));
 const wizard=edit.locator('#tripPlannerDialog');await wizard.locator('[data-planner-next]').click();await wizard.locator('[data-planner-next]').click();await wizard.locator('[data-planner-add-transport]').click();await wizard.locator('[data-planner-flight]').click();
 await edit.evaluate(()=>{const form=document.getElementById('transportForm');form._legs=structuredClone(state.transports.find(t=>t.legs?.length===2).legs);form.querySelectorAll('[data-leg="0"] [data-leg-field]').forEach(input=>{const value=form._legs[0][input.dataset.legField];input.value=typeof value==='object'?value?.name||'':value||'';});});await edit.locator('#transportForm button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.transports.length),countsBefore.transports,'Draft flight does not create a detached transport');
 await wizard.locator('[data-planner-next]').click();await wizard.locator('[data-planner-add-accommodation]').click();await wizard.locator('[data-planner-place]').click();await edit.locator('.place-search-dialog [name="query"]').fill('Hotel XYZ');await edit.locator('[data-place-result="0"]').click();await edit.locator('.place-search-dialog button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.accommodations.length),countsBefore.accommodations,'Draft property does not create detached accommodation');
 await wizard.locator('[data-planner-next]').click();await wizard.locator('button[type="submit"]').click();
 assert.equal(await edit.evaluate(()=>state.trips.length),countsBefore.trips+1);assert.equal(await edit.evaluate(()=>state.transports.at(-1).legs.length),2);assert.equal(await edit.evaluate(()=>state.transports.at(-1).tripId===state.trips.at(-1).id),true);assert.equal(await edit.evaluate(()=>state.accommodations.at(-1).place.name),'Hotel XYZ');assert.equal(await edit.evaluate(()=>state.accommodations.at(-1).tripId===state.trips.at(-1).id),true);
 assert.deepEqual(editErrors,[],'No errors in flight, domestic, search and route workflows');
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
 await touch.locator('.place-pin-map').tap({position:{x:160,y:120}});await touch.locator('[data-place-details]>summary').tap();await touch.locator('[name="placeName"]').fill('Unlisted cabin');await touch.locator('[name="country"]').fill('Spain');
 const pin=touch.locator('.herald-map-pin');await pin.scrollIntoViewIfNeeded();const box=await pin.boundingBox(),cdp=await touch.context().newCDPSession(touch);
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterPin=await pin.boundingBox();assert.ok(Math.abs(afterPin.x-box.x)>10,'Pin responds to touch dragging');
 await touch.locator('.place-search-dialog').screenshot({path:path.join(out,'place-pin-mobile.png')});await touch.locator('.place-search-dialog button[type="submit"]').tap();
 assert.equal(await touch.evaluate(()=>state.placeVisits.at(-1).place.name),'Unlisted cabin');
 assert.equal(await touch.evaluate(()=>state.placeVisits.at(-1).endDate),'2026-10-13');
 await touch.close();
 }
 }
 { // The main map is global, leg-aware, scoped and remembers explicit layer preferences.
 const global=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),globalErrors=[];
 global.on('pageerror',e=>globalErrors.push(e.message));
 await global.clock.install({time:new Date('2026-09-21T12:00:00Z')});
 await global.route('**/*',r=>{const url=r.request().url();if(url.startsWith(origin))return r.continue();if(url.includes('routing.openstreetmap.de'))return r.fulfill({json:{code:'Ok',routes:[{geometry:{coordinates:[[14.50,46.05],[14.51,46.06],[14.52,46.07]]}}],waypoints:[{distance:0},{distance:0}]}});return r.abort();});
 const fixture=structuredClone(seed);delete fixture.visualLayers;
 fixture.transports=[{id:'connections',profileId:'a',tripId:'alps',type:'flight',status:'actual',start:{name:'Ljubljana',iata:'LJU',lat:46.22,lon:14.45},end:{name:'Alicante',iata:'ALC',lat:38.28,lon:-.56},startLocal:'2025-09-01T10:00',endLocal:'2025-09-01T16:00',legs:[{start:{name:'Ljubljana',iata:'LJU',lat:46.22,lon:14.45},end:{name:'Zurich',iata:'ZRH',lat:47.45,lon:8.56},startLocal:'2025-09-01T10:00',endLocal:'2025-09-01T12:00',airline:{name:'One'},flightNumber:'ONE1'},{start:{name:'Zurich',iata:'ZRH',lat:47.45,lon:8.56},end:{name:'Alicante',iata:'ALC',lat:38.28,lon:-.56},startLocal:'2025-09-01T14:00',endLocal:'2025-09-01T16:00',airline:{name:'Two'},flightNumber:'TWO2'}]},{id:'road-future',profileId:'a',type:'car',start:{name:'Start',lat:46.05,lon:14.5},end:{name:'End',lat:46.07,lon:14.52},startLocal:'2027-01-01T10:00',endLocal:'2027-01-01T11:00'}];
 fixture.placeVisits=[{id:'manual',profileId:'a',category:'locations',status:'visited',date:'2025-09-01',place:{name:'My cabin',lat:46.05,lon:14.50}}];
 await global.addInitScript(data=>{if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},fixture);
 await global.goto(origin+'/#/journey-map');await global.waitForSelector('#globalJourneyMap .leaflet-container, #globalJourneyMap.leaflet-container');
 await global.waitForFunction(()=>document.querySelectorAll('#globalJourneyMap path.leaflet-interactive').length===3);
 assert.equal(await global.locator('[data-journey-period=all]').getAttribute('aria-pressed'),'true');for(const layer of ['flights','transport','accommodation','locations'])assert.equal(await global.locator(`[data-journey-layer=${layer}]`).getAttribute('aria-pressed'),'true');
 assert.match(await global.locator('#journeyLibraryRecords').innerText(),/LJU → ZRH/);assert.match(await global.locator('#journeyLibraryRecords').innerText(),/ZRH → ALC/);assert.match(await global.locator('#journeyLibraryRecords').innerText(),/My cabin/);assert.equal(await global.locator('#globalJourneyMap .journey-cluster').count(),0);
 const before=await global.evaluate(()=>JSON.stringify([state.transports,state.accommodations,state.placeVisits,state.stays]));
 await global.screenshot({path:path.join(out,'global-journeys-all.png'),fullPage:true});
 await global.locator('[data-journey-period=upcoming]').click();assert.doesNotMatch(await global.locator('#journeyLibraryRecords').innerText(),/LJU/);assert.match(await global.locator('#journeyLibraryRecords').innerText(),/Start → End/);
 await global.locator('[data-journey-period=past]').click();assert.match(await global.locator('#journeyLibraryRecords').innerText(),/LJU/);assert.doesNotMatch(await global.locator('#journeyLibraryRecords').innerText(),/Start → End/);
 await global.locator('[data-journey-layer=flights]').click();assert.equal(await global.locator('#globalJourneyMap path.leaflet-interactive').count(),0);assert.match(await global.locator('#journeyLibraryRecords').innerText(),/Hotel One/);
 await global.reload();await global.waitForSelector('[data-journey-layer=flights]');assert.equal(await global.locator('[data-journey-layer=flights]').getAttribute('aria-pressed'),'false');assert.equal(await global.locator('[data-journey-layer=transport]').getAttribute('aria-pressed'),'true');
 await global.evaluate(()=>{state.activeProfileId='b';renderAll();});assert.match(await global.locator('#journeyLibraryRecords').innerText(),/No matching entries/);await global.evaluate(()=>{state.activeProfileId='a';renderAll();});
 await global.goto(origin+'/#/calendar');await global.waitForSelector('[data-calendar-layer=transport]');assert.equal(await global.locator('[data-calendar-layer=transport]').getAttribute('aria-pressed'),'true');await global.locator('[data-calendar-layer=transport]').click();await global.reload();await global.waitForSelector('[data-calendar-layer=transport]');assert.equal(await global.locator('[data-calendar-layer=transport]').getAttribute('aria-pressed'),'false');
 await global.goto(origin+'/#/journey-map');await global.waitForSelector('#globalJourneyMap.leaflet-container');assert.equal(await global.locator('[data-journey-layer=flights]').getAttribute('aria-pressed'),'false');assert.equal(await global.evaluate(()=>JSON.stringify([state.transports,state.accommodations,state.placeVisits,state.stays])),before,'Map interactions never rewrite travel data');assert.deepEqual(globalErrors,[]);await global.close();
 }

 const empty=await browser.newPage({viewport:{width:390,height:844}});await empty.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await empty.goto(origin+'/#/dashboard');await empty.waitForSelector('[data-add-first-trip]');assert.match(await empty.locator('#travelMemoryPanel').innerText(),/No travel outside your home country is recorded/,'Dashboard memory has a clear no-history state');await empty.locator('[data-add-first-trip]').click();await empty.waitForSelector('#tripPlannerDialog[open]');const emptyPlanner=empty.locator('#tripPlannerDialog');await emptyPlanner.locator('[name="start"]').fill('2026-09-01');await emptyPlanner.locator('[name="end"]').fill('2026-09-03');await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[name="tripName"]').fill('First trip');await emptyPlanner.locator('[data-planner-stop] [name="countryName"]').fill('France');await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[data-planner-next]').click();await emptyPlanner.locator('[data-planner-next]').click();await empty.context().setOffline(true);await emptyPlanner.locator('button[type="submit"]').click();await empty.waitForFunction(()=>state.stays.length===1);const saved=await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));assert.ok(JSON.parse(saved).stays.length===1,'Guest edits persist when the connection drops');let offlineReloadFailed=false;try{await empty.reload({timeout:5000});}catch{offlineReloadFailed=true;}assert.ok(offlineReloadFailed,'No full offline reload support is claimed');await empty.context().setOffline(false);await empty.goto(origin+'/#/dashboard');assert.equal(await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),saved,'Offline reload failure does not delete guest data');await empty.screenshot({path:path.join(out,'empty-mobile.png'),fullPage:true});await empty.close();
 const account=await browser.newPage({viewport:{width:390,height:844}});await account.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());for(const route of ['profile','login','register','reset-password']){await account.goto(origin+'/'+route+'/');await account.waitForTimeout(200);assert.ok(await account.locator('#accountMessage').innerText(),'Account library failure is visible');await account.screenshot({path:path.join(out,route+'-mobile-error.png'),fullPage:true});}await account.close();
 console.log(`Browser checks passed: ${scenes} populated scenes (${widths.join(', ')}px; ${themes.join(', ')}), empty CTA, keyboard date selection, service failure and layout checks.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

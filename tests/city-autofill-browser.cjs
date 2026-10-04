/* Fictional guest records and local geocoder fixtures; no travel data leaves the browser. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/map-city');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(!path.extname(file))file=path.join(file,'index.html');
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
const hostel={geometry:{coordinates:[54.56,24.42]},properties:{osm_type:'N',osm_id:1,name:'Example hostel',osm_key:'tourism',osm_value:'hostel',street:'Test Street',city:'Khalifa City',district:'Khalifa City',county:'Abu Dhabi',state:'Abu Dhabi',country:'United Arab Emirates',countrycode:'ae'}};
const city={geometry:{coordinates:[54.4,24.45]},properties:{osm_type:'N',osm_id:2,name:'Abu Dhabi',osm_key:'place',osm_value:'city',countrycode:'ae',country:'United Arab Emirates'}};
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Test traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],trips:[],stays:[],transports:[],accommodations:[{id:'old',profileId:'p',propertyName:'Existing hotel',location:'My saved district',checkIn:'2026-09-01',checkOut:'2026-09-03',notes:'Keep original notes',price:{amount:50,currency:'GBP'},place:{id:'provider:old',name:'Existing hotel',type:'Hotel',area:'My saved district',city:'Abu Dhabi',countryCode:'AE',countryName:'United Arab Emirates',address:'Original address, My saved district',lat:24.42,lon:54.56}}],placeVisits:[],residences:[],savedPlaces:[{id:'saved',profileId:'p',place:{id:'personal:one',name:'Personal hostel',type:'Hostel',area:'My chosen area',city:'Abu Dhabi',state:'Abu Dhabi',countryCode:'AE',countryName:'United Arab Emirates',address:'Personal address',lat:24.43,lon:54.55}}],visaAcknowledgements:[{id:'keep'}],excludedCountryCodes:['AQ']};
const snapshot=()=>JSON.stringify(state);
const storage=()=>Object.fromEntries(['whereIveBeen.data.v2','whereIveBeen.guest.v1','whereIveBeen.stays.v1'].map(k=>[k,localStorage.getItem(k)]));
let browser;
(async()=>{
  let origin=process.env.HV_CITY_ORIGIN?.replace(/\/$/,'');
  if(!origin){await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;}
  const rawProxy=process.env.HV_CITY_ORIGIN&&(process.env.HTTPS_PROXY||process.env.HTTP_PROXY),proxy=rawProxy?new URL(rawProxy):null;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true,...(proxy?{proxy:{server:proxy.origin,username:decodeURIComponent(proxy.username),password:decodeURIComponent(proxy.password)}}:{})});
  for(const width of (process.env.HV_CITY_WIDTHS||'390,768,1440').split(',').map(Number))for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport:{width,height:960},hasTouch:width===390,reducedMotion:'reduce',ignoreHTTPSErrors:!!proxy}),errors=[];
    let cityRequests=0;
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
    await page.route('**/*',r=>{
      const url=r.request().url();if(url.startsWith(origin+'/'))return r.continue();
      if(url.includes('/d3@'))return r.fulfill({path:path.join(root,'node_modules/d3/dist/d3.min.js'),contentType:'text/javascript'});
      if(url.includes('/topojson-client@'))return r.fulfill({path:path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),contentType:'text/javascript'});
      if(url.includes('/world-atlas@'))return r.fulfill({path:path.join(root,'node_modules/world-atlas/countries-50m.json'),contentType:'application/json'});
      if(url.includes('photon.komoot.io/')){
        const u=new URL(url),cityLookup=u.searchParams.getAll('osm_tag').includes('place:city');
        if(cityLookup){cityRequests++;return r.fulfill({json:{features:[{...city,properties:{...city.properties,name:'Khalifa City',osm_value:'suburb'}},city]}});}
        return r.fulfill({json:{features:(u.searchParams.get('q')||'').includes('Wider')?[]:[hostel]}});
      }
      if(url.includes('overpass-api.de/'))return r.fulfill({json:{elements:[{type:'node',id:3,lat:24.42,lon:54.56,tags:{name:'Wider hostel',tourism:'hostel','addr:street':'Test Street','addr:city':'Khalifa City','addr:state':'Abu Dhabi','addr:country':'AE'}}]}});
      if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=','base64')});
      return r.fulfill({status:200,contentType:r.request().resourceType()==='script'?'text/javascript':'application/json',body:r.request().resourceType()==='script'?'':'{}'});
    });
    await page.addInitScript(({seed,theme})=>{
      if(!localStorage.getItem('whereIveBeen.data.v2')){localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('whereIveBeen.guest.v1',JSON.stringify({...seed,notes:'Keep separate guest backup'}));localStorage.setItem('whereIveBeen.stays.v1','[]');}
      localStorage.setItem('whereIveBeen.theme.v1',theme);
    },{seed,theme});
    await page.goto(origin+'/#/journey-map');await page.waitForSelector('#globalJourneyMap .marker-accommodation');
    const before=await page.evaluate(snapshot),stored=await page.evaluate(storage);
    const mapHeight=await page.locator('#globalJourneyMap').evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(mapHeight>(width<=600?960*.52:960*.60),'Journey Map is taller than the old layout');
    assert.ok(mapHeight<=850&&mapHeight>=(width<=600?400:440));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    await page.locator('#journeysView').screenshot({path:path.join(out,`journey-map-${width}-${theme}.png`)});
    await page.locator('[data-global-fit]').click();assert.equal(await page.locator('#globalJourneyMap .marker-accommodation').count(),1,'Fit still shows the existing accommodation');

    const editor=page.locator('.place-search-dialog[open]'),area=editor.locator('[name=area]');
    const open=()=>page.evaluate(()=>HVPlaces.open({accommodation:true,date:'2026-10-10',end:'2026-10-12'}));
    const select=async term=>{await editor.locator('[name=query]').fill(term);await editor.locator('[name=query]').press('Enter');await editor.locator('[data-place-result]').first().click();};
    const close=()=>editor.locator('[data-place-close]').click();
    await page.evaluate(()=>HVPlaces.open({accommodationId:'old'}));
    assert.equal(await area.inputValue(),'My saved district');await close();assert.equal(cityRequests,0,'Opening saved data performs no city lookup');
    await open();await select('Personal hostel');assert.equal(await area.inputValue(),'My chosen area');await close();assert.equal(cityRequests,0,'Personal saved area stays intact');

    await open();await select('Example hostel');await page.waitForFunction(()=>document.querySelector('.place-search-dialog [name=area]').value==='Abu Dhabi');
    assert.match(await editor.locator('[name=address]').inputValue(),/Khalifa City, Abu Dhabi/);
    await area.scrollIntoViewIfNeeded();await editor.screenshot({path:path.join(out,`city-autofill-${width}-${theme}.png`)});await close();
    await open();await editor.locator('[name=query]').fill('Wider hostel');await editor.locator('[name=query]').press('Enter');await page.waitForFunction(()=>document.getElementById('placeSearchStatus').textContent.startsWith('No matching'));
    await editor.locator('[data-place-wider]').click();await editor.locator('[data-place-result]').first().click();await page.waitForFunction(()=>document.querySelector('.place-search-dialog [name=area]').value==='Abu Dhabi');
    assert.match(await editor.locator('[name=address]').inputValue(),/Khalifa City, Abu Dhabi/);await close();
    await open();await editor.locator('[data-place-plot]').click();await editor.locator('[data-pin-centre]').click();await page.waitForFunction(()=>document.querySelector('.place-search-dialog [name=area]').value==='Abu Dhabi');
    assert.match(await editor.locator('[name=address]').inputValue(),/Khalifa City, Abu Dhabi/);await close();

    // Resolve late even after cancellation, to prove edits and newer selections win.
    await page.evaluate(()=>{window.realCityResolver=HVTravelSearch.resolveCity;window.pendingCities=[];HVTravelSearch.resolveCity=()=>new Promise(resolve=>pendingCities.push(resolve));});
    await open();await select('Example hostel');await area.fill('My manual choice');
    await page.evaluate(async()=>{pendingCities.shift()('Abu Dhabi');await Promise.resolve();});assert.equal(await area.inputValue(),'My manual choice');await close();
    await open();await select('Example hostel');await select('Example hostel');
    await page.evaluate(async()=>{pendingCities.shift()('Stale city');await Promise.resolve();});assert.equal(await area.inputValue(),'Khalifa City');
    await page.evaluate(async()=>{pendingCities.shift()('Abu Dhabi');await Promise.resolve();});assert.equal(await area.inputValue(),'Abu Dhabi');await close();
    await open();await select('Example hostel');await close();await page.evaluate(()=>HVPlaces.open({accommodationId:'old'}));
    await page.evaluate(async()=>{pendingCities.shift()('Stale city');await Promise.resolve();HVTravelSearch.resolveCity=realCityResolver;});assert.equal(await area.inputValue(),'My saved district');await close();
    assert.equal(await page.evaluate(snapshot),before,'Searching, city lookup, pinning and cancelling preserve all records and settings');
    assert.deepEqual(await page.evaluate(storage),stored,'No guest, legacy or current data was rewritten');

    await open();await select('Example hostel');await page.waitForFunction(()=>document.querySelector('.place-search-dialog [name=area]').value==='Abu Dhabi');
    await editor.locator('[name=placeType]').selectOption('Hostel');await editor.locator('[type=submit]').click();await page.waitForFunction(()=>state.accommodations.length===2);
    const after=JSON.parse(await page.evaluate(snapshot)),added=after.accommodations.find(a=>a.id!=='old');
    assert.equal(added.location,'Abu Dhabi');assert.equal(added.place.city,'Abu Dhabi');assert.equal(added.place.area,'Abu Dhabi');assert.match(added.place.originalAddress,/Khalifa City/);assert.match(added.place.address,/Khalifa City/);
    after.accommodations=after.accommodations.filter(a=>a.id==='old');assert.deepEqual(after,JSON.parse(before),'The intended save adds one accommodation and preserves every existing record');
    await page.reload();await page.waitForSelector('#globalJourneyMap .marker-accommodation');
    assert.equal(await page.evaluate(()=>state.accommodations.find(a=>a.id!=='old').place.area),'Abu Dhabi','City and full address survive reload');
    const finalStorage=await page.evaluate(storage);assert.equal(finalStorage['whereIveBeen.guest.v1'],stored['whereIveBeen.guest.v1']);assert.equal(finalStorage['whereIveBeen.stays.v1'],stored['whereIveBeen.stays.v1']);
    assert.deepEqual(errors,[],'No new console or runtime errors');await page.close();
    console.log(`Taller map, city-first search/wider search/pins, manual edits, cancellation and persistence passed at ${width}px in ${theme} theme.`);
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server.listening)server.close();});

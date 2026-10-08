/* Fictional accounts and real browser/canvas interactions; no production writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium'),{PNG}=require('pngjs');
const Routes=require('../route-persistence.js');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/transport-dashboard');fs.mkdirSync(out,{recursive:true});
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
function load(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','tests','scripts','test-results','docs','reviews','src'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())load(file);else assets.set('/'+path.relative(root,file).split(path.sep).join('/'),{body:fs.readFileSync(file),type:types[path.extname(file)]||'application/octet-stream'});}}
load(root);
const server=http.createServer((req,res)=>{const key=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'),file=assets.get(key);if(!file){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.type);res.end(file.body);});
const id='019a1234-6b7c-4d8e-9001-202610080001',user={id,aud:'authenticated',role:'authenticated',email:'transport@example.test',app_metadata:{provider:'email'},user_metadata:{}};
function session(){const exp=Math.floor(Date.now()/1000)+3600,part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return {access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp,aud:'authenticated',role:'authenticated'})+'.fixture',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'fictional-refresh',user};}
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Alex',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],trips:[],stays:[],residences:[],transports:[],accommodations:[],placeVisits:[],savedPlaces:[],notes:[{id:'note',title:'Keep this',body:'Existing notes',profileId:'p'}],checklists:[],budgets:[],expenses:[]};
for(const [type,name]of [['flight','Air Algérie'],['train','Eurostar'],['boat','DFDS'],['bus','FlixBus'],['car','Hertz']])for(const period of ['upcoming','previous']){
  const date=period==='upcoming'?'2030-10-09':'2025-10-01',start={name:'Algiers airport',city:'Algiers',iata:'ALG',timezone:'Africa/Algiers',countryCode:'DZ',lat:36.69,lon:3.2},end={name:'Ghardaia airport',city:'Ghardaia',iata:'GHA',timezone:'Africa/Algiers',countryCode:'DZ',lat:32.38,lon:3.79};
  const record={id:type+'-'+period,profileId:'p',type,status:period==='upcoming'?'planned':'actual',start,end,startLocal:date+'T18:30',endLocal:date+'T20:00',...(type==='flight'?{airline:{name},flightNumber:'AH 6200'}:{operator:name,serviceNumber:type+'123'})};
  Routes.set(record,0,type,start,end,{coordinates:[[start.lat,start.lon],[(start.lat+end.lat)/2,3.7],[end.lat,end.lon]],label:'Saved test route',illustrative:type!=='flight'});seed.transports.push(record);
}
seed.accommodations.push({id:'hotel',profileId:'p',propertyName:'Fictional Hotel',location:'Algiers',place:{name:'Fictional Hotel',lat:36.75,lon:3.06,countryCode:'DZ'},checkIn:'2025-10-01',checkOut:'2025-10-02'});
function logo(red=80){const png=new PNG({width:240,height:40});for(let i=0;i<png.data.length;i+=4){png.data[i]=red;png.data[i+1]=110;png.data[i+2]=180;png.data[i+3]=255;}return {name:'logo.png',mimeType:'image/png',buffer:PNG.sync.write(png)};}
let browser,cloud=structuredClone(seed),revision=1,writes=0,routeRequests=0;
const errors=[];
async function fixture(origin,width,height,theme,signed=false){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{
    const url=route.request().url();if(url.startsWith(origin))return route.continue();
    if(url.includes('.supabase.co/')){
      if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
      if(url.includes('/auth/v1/token'))return route.fulfill({json:session()});
      if(url.includes('/rest/v1/travel_tracker_data'))return route.fulfill({json:[new URL(url).searchParams.get('select')==='revision'?{revision}:{payload:cloud,revision}]});
      if(url.includes('/rpc/save_travel_account')){const request=route.request().postDataJSON();if(request.p_revision!==revision)return route.fulfill({status:409,json:{code:'40001'}});cloud=request.p_payload;revision++;writes++;return route.fulfill({json:[{revision}]});}
      return route.fulfill({json:{}});
    }
    if(/overpass|routed-|\/api\/0.6\//.test(url))routeRequests++;
    return route.abort();
  });
  await page.addInitScript(({seed,theme,signed,auth,id})=>{localStorage.setItem('whereIveBeen.theme.v1',theme);if(signed){localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));localStorage.setItem('whereIveBeen.localOwner.v1',id);localStorage.setItem('whereIveBeen.importNoticed.'+id,'yes');}else if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));},{seed,theme,signed,auth:session(),id});
  await page.goto(origin+'/#/my-flights');
  await page.waitForFunction(()=>window.HVTransportDashboard&&HVTransportDashboard.surface()&&!document.querySelector('.app-shell').inert);
  if(signed)await saved(page);
  return {page,context};
}
async function saved(page){await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(el=>el.textContent==='Saved to account'),null,{timeout:10000});}
async function switchMode(page,mode){await page.locator('[data-mode-toggle]').click();await page.locator(`[data-transport-mode=${mode}]`).click();}
async function upload(page,type){
  await page.evaluate(type=>HVJourneys.openTransport(type+'-upcoming'),type);
  const selector=type==='flight'?'.flight-legs .operator-logo-editor input[type=file]':'[data-ground-operator-logo] input[type=file]';
  await page.locator(selector).setInputFiles(logo());
  await page.waitForFunction(()=>!document.querySelector('.operator-logo-editor[aria-busy=true]')&&document.querySelector('#transportForm')._operatorLogos.size>0);
  await page.locator('#transportForm [type=submit]').click();
  await page.waitForFunction(()=>!document.getElementById('transportDialog').open);
}
async function createWithLogo(page,type){
  const original=seed.transports.find(row=>row.id===type+'-upcoming');
  await page.evaluate(original=>{const draft=structuredClone(original);delete draft.id;delete draft.resolvedRoutes;draft.flightNumber='AH 6201';HVJourneys.openTransport(null,draft);},original);
  const selector=type==='flight'?'.flight-legs .operator-logo-editor input[type=file]':'[data-ground-operator-logo] input[type=file]';
  if(type==='car')await page.locator('.transport-more').evaluate(el=>el.open=true);
  assert.equal(await page.locator(selector).locator('..').locator('..').locator('img.operator-logo').isVisible(),true,'New '+type+' records reuse the saved operator logo before upload');
  await page.locator(selector).setInputFiles(logo(200));
  await page.waitForFunction(()=>!document.querySelector('.operator-logo-editor[aria-busy=true]')&&document.querySelector('#transportForm')._operatorLogos.size>0);
  await page.locator('#transportForm [type=submit]').click();await page.waitForFunction(()=>!document.getElementById('transportDialog').open);await saved(page);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  let scenes=0;
  for(const [width,height]of (process.env.HV_TRANSPORT_SIGNED_ONLY?[]:[[320,700],[390,844],[844,390],[768,1024],[1024,768],[1440,1000]]))for(const theme of ['light','dark']){
    const {page,context}=await fixture(origin,width,height,theme);
    for(const [type,title]of [['flight','My Flights'],['train','My Trains'],['boat','My Ferries'],['bus','My Buses'],['car','My Cars']]){
      if(type!=='flight')await switchMode(page,type);
      assert.equal(await page.locator('[data-mode-title]').innerText(),title);
      assert.equal(await page.locator('[data-transport-select]').count(),1);
      await page.locator('[data-transport-period=previous]').click();assert.equal(await page.locator('[data-transport-select]').count(),1);assert.match(await page.locator('[data-transport-list]').innerText(),/2025|Oct/);
      await page.locator('[data-transport-period=upcoming]').click();
      const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offscreen:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1).slice(0,12)}));
      if(overflow.scroll>width+1)await page.screenshot({path:path.join(out,'overflow.png'),fullPage:true});
      assert.ok(overflow.scroll<=width+1,`${title}/${width}/${theme} overflows: ${JSON.stringify(overflow)}`);
    }
    await switchMode(page,'flight');await upload(page,'flight');assert.equal(await page.locator('[data-transport-list] .operator-logo').count(),1);
    if(width===390&&theme==='light'){const src=await page.locator('[data-transport-list] .operator-logo').getAttribute('src');await page.reload();await page.waitForFunction(()=>window.HVTransportDashboard?.surface());assert.equal(await page.locator('[data-transport-list] .operator-logo').getAttribute('src'),src,'Guest artwork survives refresh');}
    await page.locator('[data-transport-select]').click();assert.equal(await page.locator('.transport-detail-dialog').isVisible(),true);assert.equal(await page.locator('.transport-detail-dialog .operator-logo').count(),1);
    assert.ok(await page.evaluate(()=>[...HVTransportDashboard.surface().map._layers?Object.values(HVTransportDashboard.surface().map._layers):[]].some(layer=>layer.getLatLngs&&layer.options.opacity===1)),'Selecting a row highlights its route');
    await page.locator('[data-close-transport-details]').click();
    await page.locator('[data-filter-toggle]').click();await page.locator('[data-transport-filter=year]').selectOption('2030');await page.locator('[data-filter-toggle]').click();
    await page.screenshot({path:path.join(out,`transport-${width}-${height}-${theme}.png`),fullPage:true});
    await page.evaluate(()=>switchView('journeys'));await page.waitForFunction(()=>HVJourneyLibrary.surface());
    await page.evaluate(()=>{const s=HVJourneyLibrary.surface();s.map.setView([35,3.5],7,{animate:false});s.map.openPopup('Selected journey',[35,3.5]);window.beforeFullscreen={surface:s,center:s.map.getCenter(),zoom:s.map.getZoom(),data:JSON.stringify(state),filters:JSON.stringify(HVJourneyLibrary.filters())};});
    await page.locator('[data-journey-fullscreen]').click();await page.waitForTimeout(100);
    assert.ok(await page.evaluate(()=>HVJourneyLibrary.surface()===beforeFullscreen.surface));
    const camera=await page.evaluate(()=>{const map=HVJourneyLibrary.surface().map;return {before:beforeFullscreen.center,after:map.getCenter(),distance:map.getCenter().distanceTo(beforeFullscreen.center),beforeZoom:beforeFullscreen.zoom,zoom:map.getZoom()};});
    assert.ok(camera.distance<.01&&camera.zoom===camera.beforeZoom,JSON.stringify(camera));
    assert.equal(await page.locator('.leaflet-popup-content').innerText(),'Selected journey');
    assert.ok(await page.locator('[data-journey-layer=accommodation]').isVisible());
    const bounds=await page.locator('[data-journey-fullscreen]').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
    await page.screenshot({path:path.join(out,`fullscreen-${width}-${height}-${theme}.png`)});
    await page.locator('[data-journey-fullscreen]').click();await page.waitForTimeout(100);
    assert.ok(await page.evaluate(()=>JSON.stringify(state)===beforeFullscreen.data&&JSON.stringify(HVJourneyLibrary.filters())===beforeFullscreen.filters));
    assert.ok(await page.evaluate(()=>HVJourneyLibrary.surface().map.getCenter().distanceTo(beforeFullscreen.center)<.01));
    assert.equal(await page.locator('.leaflet-popup-content').innerText(),'Selected journey');
    await page.locator('[data-journey-fullscreen]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.journey-fullscreen').count(),0);
    await context.close();scenes++;
  }
  const phone=await fixture(origin,390,844,'dark',true);
  for(const type of ['flight','train','boat','bus','car']){await upload(phone.page,type);await saved(phone.page);}
  assert.equal(cloud.transportOperators.length,5);assert.equal(JSON.stringify(cloud.transports).includes('data:image'),false);assert.deepEqual(cloud.notes,seed.notes);
  const oldLogos=cloud.transportOperators.map(row=>row.operatorLogo.src);
  for(const type of ['flight','train','boat','bus','car'])await createWithLogo(phone.page,type);
  assert.equal(cloud.transportOperators.length,5,'Replacing artwork keeps each operator identity');
  assert.equal(cloud.transports.length,15);assert.ok(cloud.transportOperators.every((row,index)=>row.operatorLogo.src!==oldLogos[index]));
  const png=PNG.sync.read(Buffer.from(cloud.transportOperators[0].operatorLogo.src.split(',')[1],'base64'));assert.equal(png.width,128);assert.equal(png.height,128);assert.equal(png.data[3],0,'Wide artwork has transparent space in the square logo canvas');
  await phone.page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
  await phone.context.setOffline(true);await upload(phone.page,'bus');await phone.page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(el=>el.textContent.includes('changes waiting to sync')));
  const offlineLogo=await phone.page.evaluate(()=>HVOperators.logo(state,'bus','FlixBus'));await phone.page.reload();await phone.page.waitForFunction(()=>window.HVTransportDashboard?.surface()&&!document.querySelector('.app-shell').inert);assert.equal(await phone.page.evaluate(()=>HVOperators.logo(state,'bus','FlixBus')),offlineLogo,'Offline artwork survives restart');
  await phone.context.setOffline(false);await saved(phone.page);assert.equal(cloud.transportOperators.find(row=>row.mode==='bus').operatorLogo.src,offlineLogo);
  const computer=await fixture(origin,1440,1000,'light',true);
  assert.equal(await computer.page.locator('[data-transport-list] .operator-logo').count(),2);
  await computer.page.evaluate(()=>HVJourneys.openTransport(null,{type:'flight'}));
  await computer.page.locator('[data-leg-field=airline]').fill('Air Algerie');
  await computer.page.locator('[data-results=airline] [data-choice]').first().click();
  assert.equal(await computer.page.locator('.flight-legs .operator-logo-editor img').isVisible(),true);
  await computer.page.locator('[data-close-transport]').first().click();
  await computer.page.evaluate(()=>HVJourneys.openTransport('flight-previous'));
  assert.equal(await computer.page.locator('.flight-legs .operator-logo-editor img').getAttribute('src'),cloud.transportOperators.find(row=>row.mode==='flight').operatorLogo.src,'Historical records use the replacement');
  await computer.page.locator('.flight-legs [data-operator-logo-remove]').click();await computer.page.locator('#transportForm [type=submit]').click();await saved(computer.page);
  assert.equal(cloud.transportOperators.find(row=>row.mode==='flight').operatorLogo.src,null);
  await phone.page.evaluate(()=>WIBAuth.client());await phone.page.reload();await saved(phone.page);assert.equal(await phone.page.locator('[data-transport-list] .operator-logo').count(),0);
  await computer.page.evaluate(()=>switchView('profiles'));
  for(const width of [390,768,1024,1440]){await computer.page.setViewportSize({width,height:1000});const alignment=await computer.page.locator('.herald-account-access').evaluate(el=>[...el.querySelectorAll('[data-account-user],[data-account-logout]')].map(button=>{const box=button.getBoundingClientRect();return box.y+box.height/2;}));assert.ok(Math.abs(alignment[0]-alignment[1])<1,'Account and Sign out share a vertical centre at '+width+'px');}
  assert.equal(routeRequests,0,'The transport dashboard never calculates routes');
  assert.deepEqual(errors,[]);assert.deepEqual(seed.transports.map(original=>cloud.transports.find(row=>row.id===original.id).resolvedRoutes),seed.transports.map(t=>t.resolvedRoutes));
  await phone.context.close();await computer.context.close();
  console.log(`Transport browser checks passed: ${scenes} responsive/theme scenes, all five modes, creation, aspect-preserved uploads, historical reuse, two-device sync, replacement, removal and fullscreen state; ${writes} fictional saves.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

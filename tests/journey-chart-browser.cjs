/* Exercise both Journey Map surfaces and the local cartography with fictional data. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),origin='https://herald.test';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Test traveller'}],trips:[{id:'trip',profileId:'p',name:'Caucasus journey'}],stays:[{id:'visit',tripId:'trip',profileId:'p',countryCode:'GE',countryName:'Georgia',start:'2026-09-18',end:'2026-09-21',status:'actual'}],transports:[{id:'flight',tripId:'trip',profileId:'p',type:'flight',status:'actual',startLocal:'2026-09-18T10:00',endLocal:'2026-09-18T13:00',start:{name:'Istanbul Airport',iata:'IST',lat:41.275,lon:28.752},end:{name:'Tbilisi International Airport',iata:'TBS',lat:41.669,lon:44.954}}],accommodations:[{id:'hotel',tripId:'trip',profileId:'p',propertyName:'Sample guesthouse',location:'Tbilisi',lat:41.716,lon:44.783,checkIn:'2026-09-18',checkOut:'2026-09-21'}],savedPlaces:[],placeVisits:[]};
const blankPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=','base64');
let browser;
async function open(width,{fail=false,theme='light'}={}){
  const page=await browser.newPage({viewport:{width,height:960},hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce'});
  const errors=[],streetTileRequests=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.route('**/*',r=>{
    const url=new URL(r.request().url());
    if(url.origin===origin){
      if(fail&&/\/data\/countries-(110|50)m\.json/.test(url.pathname))return r.abort();
      let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)&&file!==root)return r.fulfill({status:403,body:''});
      if(!path.extname(file))file=path.join(file,'index.html');
      return fs.existsSync(file)?r.fulfill({path:file,contentType:types[path.extname(file)]}):r.fulfill({status:404,body:''});
    }
    if(url.hostname==='tile.openstreetmap.org')streetTileRequests.push(url.href);
    if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:blankPNG});
    return r.fulfill({json:{}});
  });
  await page.addInitScript(({seed,theme})=>{
    localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));
    localStorage.setItem('whereIveBeen.theme.v1',theme);
  },{seed,theme});
  await page.goto(origin+'/#/journey-map');
  await page.locator('#globalJourneyMap .journey-chart-switch').waitFor();
  return {page,errors,streetTileRequests};
}
const firstTile=host=>host.locator('canvas.leaflet-tile-loaded').first();
(async()=>{
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process')});
  for(const width of [1440,390]){
    const {page,errors,streetTileRequests}=await open(width,{theme:width===390?'dark':'light'}),host=page.locator('#globalJourneyMap');
    const zoom=width===390?3:4;
    await page.evaluate(zoom=>{HVJourneyUI.activeMap().setView([40,37],zoom,{animate:false});},zoom);
    await firstTile(host).waitFor();
    assert.equal(streetTileRequests.length,0,'The chart needs no remote tiles');
    assert.ok(await host.locator('.journey-chart-compass').isVisible());
    const coords=await page.evaluate(()=>[[38.5,34],[43,35]].map(p=>HVJourneyUI.activeMap().latLngToContainerPoint(p)));
    const screenshot=await host.screenshot();
    const image=PNG.sync.read(screenshot);
    const colour=({x,y})=>image.data.subarray((x+y*image.width)*4,(x+y*image.width)*4+3);
    const land=colour(coords[0]),water=colour(coords[1]);
    assert.ok(land[0]>land[2]+30,'Anatolia is rendered as warm parchment');
    assert.ok(water[2]>water[0]+12,'The Black Sea is rendered as blue water');
    if(width===1440&&process.env.HV_CHART_PREVIEW)fs.writeFileSync(process.env.HV_CHART_PREVIEW,screenshot);
    const street=host.getByRole('button',{name:'Street map'});await street.focus();await page.keyboard.press('Enter');
    await host.locator('img.leaflet-tile').first().waitFor();
    assert.equal(await host.locator('.journey-chart-compass').count(),0);
    await host.getByRole('button',{name:'Atlas chart'}).click();await firstTile(host).waitFor();
    const mark=host.locator('.marker-accommodation').first();width===390?await mark.tap():await mark.click();
    await host.locator('.herald-map-popup').getByText('Sample guesthouse',{exact:true}).waitFor();
    await page.evaluate(()=>HVJourneyMap.open('trip:trip'));
    const focused=page.locator('.journey-map-dialog[open]');
    await firstTile(focused).waitFor();await focused.getByRole('button',{name:'Close ×'}).click();
    await page.evaluate(()=>{HVJourneyUI.activeMap().setView([48,179],4,{animate:false});});
    await firstTile(host).waitFor();
    assert.deepEqual(errors,[]);
    await page.close();
    console.log('Chart geography, accessible basemap switch, and focused trip passed at '+width+'px.');
  }
  const {page,errors}=await open(700,{fail:true}),host=page.locator('#globalJourneyMap');
  await host.getByRole('status').getByText('Atlas chart unavailable. Try Street map.').waitFor();
  assert.ok(await host.locator('.marker-accommodation').isVisible(),'Saved stops remain visible when the chart is unavailable');
  await host.getByRole('button',{name:'Street map'}).click();await host.locator('img.leaflet-tile').first().waitFor();
  assert.deepEqual(errors,[]);
  console.log('Missing geography preserves saved stops and allows Street map.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});

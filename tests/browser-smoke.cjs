/* Real Chromium layout/keyboard checks with fictional data and deterministic service failures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HV_PLAYWRIGHT_MODULE||'playwright');
const binary=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HV_SCREENSHOTS||path.join(root,'test-results/browser'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
 if(!path.extname(file))file=path.join(file,'index.html');
 const type={'.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.html':'text/html'};
 try{res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
const seed={version:2,activeProfileId:'a',profiles:[{id:'a',name:'Alex',citizenships:['GB'],enabledRules:['schengen'],homeCountryCodes:['GB']},{id:'b',name:'Sam',citizenships:['US'],enabledRules:['schengen']}],trips:[{id:'alps',profileId:'a',name:'Eastern Alps 2026',notes:'Test itinerary'}],stays:[{id:'home',profileId:'a',countryCode:'GB',countryName:'United Kingdom',start:'2026-01-01',end:'2026-01-10',status:'actual'},{id:'slovenia',profileId:'a',tripId:'alps',countryCode:'SI',countryName:'Slovenia',start:'2026-09-10',end:'2026-09-13',status:'actual'},{id:'austria',profileId:'a',tripId:'alps',countryCode:'AT',countryName:'Austria',start:'2026-09-14',end:'2026-09-22',status:'actual'},{id:'future',profileId:'a',countryCode:'FR',countryName:'France',start:'2026-12-01',end:'2026-12-04',status:'planned'}],transports:[{id:'flight',profileId:'a',tripId:'alps',type:'flight',status:'actual',startLocal:'2026-09-10T10:00',endLocal:'2026-09-10T12:00',start:{name:'London'},end:{name:'Ljubljana'}}],residences:[],placeVisits:[],visualLayers:{calendar:{countries:true,transport:true}}};
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
 let scenes=0;
 for(const width of [390,768,1440])for(const theme of ['light','dark']){
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
   if(route==='map'){await page.waitForSelector('.map-country');const previous=page.url();await page.locator('#mapCountrySelect').selectOption('GB');assert.equal(page.url(),previous);assert.equal(await page.locator('#mapCountrySummary').isVisible(),true);}
   if(route==='calendar'){
    assert.equal(await page.locator('[role="button"] button').count(),0,'No nested date buttons');
    if(width===1440)assert.ok((await page.locator('#calendar').boundingBox()).y<500,'Calendar dates must be above the fold');
    await page.locator('button[data-calendar-view="agenda"]').click();assert.ok((await page.locator('#calendarAgenda').innerText()).includes('London'),'Agenda includes transport');
    await page.locator('button[data-calendar-view="month"]').click();await page.locator('[data-select-date="2026-09-01"]').focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.waitForSelector('#stayDialog[open]');await page.keyboard.press('Escape');assert.ok(await page.locator('.selection-start').count(),'Cancel preserves selection');
   }
   await page.screenshot({path:path.join(out,`${route.replace('/','-')}-${width}-${theme}.png`),fullPage:true});scenes++;
  }
  assert.deepEqual(errors,[],'No uncaught browser errors');await page.close();
 }
 const empty=await browser.newPage({viewport:{width:390,height:844}});await empty.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await empty.goto(origin+'/#/dashboard');await empty.waitForSelector('[data-add-first-trip]');await empty.locator('[data-add-first-trip]').click();await empty.waitForSelector('#stayDialog[open]');await empty.locator('#countryInput').fill('France');await empty.context().setOffline(true);await empty.locator('#stayForm button[type="submit"]').click();const saved=await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));assert.ok(JSON.parse(saved).stays.length===1,'Guest edits persist when the connection drops');let offlineReloadFailed=false;try{await empty.reload({timeout:5000});}catch{offlineReloadFailed=true;}assert.ok(offlineReloadFailed,'No full offline reload support is claimed');await empty.context().setOffline(false);await empty.goto(origin+'/#/dashboard');assert.equal(await empty.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),saved,'Offline reload failure does not delete guest data');await empty.screenshot({path:path.join(out,'empty-mobile.png'),fullPage:true});await empty.close();
 const account=await browser.newPage({viewport:{width:390,height:844}});await account.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());for(const route of ['profile','login','register','reset-password']){await account.goto(origin+'/'+route+'/');await account.waitForTimeout(200);assert.ok(await account.locator('#accountMessage').innerText(),'Account library failure is visible');await account.screenshot({path:path.join(out,route+'-mobile-error.png'),fullPage:true});}await account.close();
 console.log(`Browser checks passed: ${scenes} populated scenes, both themes, empty CTA, keyboard date selection, service failure and layout checks.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

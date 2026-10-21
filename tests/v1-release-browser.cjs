/* Isolated release journeys and viewport evidence. No production requests or records. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(process.env.HV_ROOT||path.join(__dirname,'..')),baseline=!!process.env.HV_V1_BASELINE;
const out=process.env.HV_V1_OUTPUT||path.join(__dirname,'../test-results/v1-release');fs.mkdirSync(out,{recursive:true});
const contrast=(a,b)=>{const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const {largeAccount}=require('./fixtures/large-account.cjs');
const data=largeAccount(160,8);
// A fictional, intentionally dense month. These are not the owner's travel records.
for(const [i,code,name,start,end]of [[0,'DZ','Algeria','2026-10-01','2026-10-15'],[1,'TN','Tunisia','2026-10-15','2026-10-23'],[2,'MT','Malta','2026-10-23','2026-10-28']]){
 data.stays.push({id:'busy-'+i,profileId:'p',countryCode:code,countryName:name,start,end,status:'planned'});
 data.accommodations.push({id:'busy-hotel-'+i,profileId:'p',propertyName:['The Long Named Courtyard Hotel and Gardens','Palace of the Olive Groves Hotel','Harbour House Boutique Hotel'][i],location:['Algiers','Tunis','Valletta'][i],checkIn:start,checkOut:end,place:{id:'busy-place-'+i,name:'Fictional property '+i,countryCode:code,lat:[36.7,36.8,35.9][i],lon:[3.1,10.2,14.5][i]}});
}
data.stays.push({id:'open-country',profileId:'p',countryCode:'DZ',countryName:'Algeria',start:'2026-10-14',end:null,status:'planned'});
data.notes.push({id:'day-note',profileId:'p',title:'Prepare documents',body:'Download the tickets before travelling.',date:'2026-10-15'});
data.stays.push({id:'memory',profileId:'p',countryCode:'MA',countryName:'Morocco',start:'2025-10-15',end:'2025-10-15',status:'actual'});
data.transports.push({id:'busy-flight',profileId:'p',type:'flight',status:'planned',start:{name:'Algiers',iata:'ALG',lat:36.7,lon:3.1,countryCode:'DZ'},end:{name:'Tunis',iata:'TUN',lat:36.8,lon:10.2,countryCode:'TN'},startLocal:'2026-10-15T08:30',endLocal:'2026-10-15T10:20'});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!path.extname(file))file=path.join(file,'index.html');try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;const coverage=[],metrics=[],allErrors=[];
const views=['dashboard','calendar','stays','transport','journeys','map','planner','countries','places','stats','tools','profiles','notes','budget','currency','roadTrip','stayPlanner','rules','schengen','homes','settings'];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const [width,height]of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[360,800]])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.stack);});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.addInitScript(({theme,data})=>{localStorage.setItem('herald.calendar.view.v1','month');localStorage.setItem('whereIveBeen.theme.v1',theme);if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},{theme,data});
  await page.goto(origin);await page.waitForFunction(()=>window.HVPages&&window.HVCalendar&&!document.querySelector('.app-shell').inert);
  for(const view of views){await page.evaluate(view=>switchView(view),view);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,header:document.querySelector('.sidebar').getBoundingClientRect().height,mapTop:document.querySelector('#journeysView .global-journey-map')?.getBoundingClientRect().top}));
   coverage.push({width,height,theme,view,...geometry});
   if(!baseline){assert.ok(geometry.overflow<=1,`${width}/${theme}/${view} overflow ${geometry.overflow}`);assert.ok(geometry.header<=72,`${width} header ${geometry.header}`);}
   if(['dashboard','calendar','map','planner','journeys','tools','stayPlanner','profiles'].includes(view)&&(width===1440||width===390)){
    if(view==='map')await page.evaluate(()=>HVJourneys.openCountry('DZ'));
    if(view==='stayPlanner'){await page.locator('#plannerCountry').fill('France');await page.locator('#plannerEntry').fill('2026-10-15');await page.locator('#runPlannerBtn').click();if(!baseline){const pairs=await page.locator('.result-stat').evaluateAll(ns=>ns.map(n=>({bg:getComputedStyle(n).backgroundColor,fg:getComputedStyle(n.querySelector('strong')).color})));for(const pair of pairs)assert.ok(contrast(pair.bg,pair.fg)>=4.5,'Result contrast');fs.writeFileSync(path.join(out,'contrast-'+theme+'.json'),JSON.stringify(pairs.map(pair=>({...pair,ratio:contrast(pair.bg,pair.fg)})),null,2));}}
    await page.screenshot({path:path.join(out,`${view}-${width}-${theme}.png`),fullPage:view==='planner'});if(view==='calendar')await page.locator('#calendar').screenshot({path:path.join(out,`calendar-grid-${width}-${theme}.png`)});
   }
  }
  if(!baseline&&width===1440&&theme==='light'){
   const unchanged=await page.evaluate(()=>JSON.stringify({stays:state.stays,accommodations:state.accommodations,transports:state.transports,manual:state.manualCountryVisits,tcc:state.tccVisits}));
   await page.evaluate(()=>switchView('calendar'));assert.equal(await page.locator('.workspace-tabs').count(),0);
   await page.locator('.header-nav-group').filter({has:page.locator('[data-workspace="trips"]')}).locator('summary').click();await page.locator('.header-nav-menu a[data-nav-view="stays"]').click();assert.equal(await page.locator('#pageTitle').innerText(),'Trips');await page.locator('#tripStatusFilter').selectOption('upcoming');assert.match(await page.locator('#allStays').innerText(),/Malta/);await page.locator('#tripStatusFilter').selectOption('all');await page.locator('#tripSearch').fill('no-such-fictional-trip');assert.match(await page.locator('#allStays').innerText(),/No trips match your filters/);await page.locator('#tripSearch').fill('');
   await page.evaluate(()=>switchView('calendar'));await page.getByRole('button',{name:'Year overview',exact:true}).click();let year=await page.locator('#calendarYearJump').inputValue();await page.getByRole('button',{name:'Next year',exact:true}).click();assert.equal(await page.locator('#calendarYearJump').inputValue(),String(Number(year)+1));await page.getByRole('button',{name:'Month',exact:true}).click();await page.getByRole('button',{name:'Today',exact:true}).click();
   await page.locator('[data-calendar-day-detail="2026-10-15"]').click();assert.match(await page.locator('#calendarJourneyDetail').innerText(),/Courtyard|Olive Groves/);
   await page.evaluate(()=>HVSavedPlaces.manage());await page.locator('dialog[open] [data-add]').click();const editor=page.locator('dialog[open] [name=query]');await editor.fill('Draft reusable location');assert.equal(await editor.inputValue(),'Draft reusable location');await page.locator('dialog[open] [data-place-cancel]').click();await page.locator('dialog[open] [data-add]').waitFor();assert.ok(await page.locator('dialog[open] input[type=search]').isVisible());await page.locator('dialog[open] [data-close]').click();
   await page.evaluate(()=>HVCalendar.clearSelection());if(await page.locator('[data-calendar-select-range]').getAttribute('aria-pressed')!=='true')await page.locator('[data-calendar-select-range]').click();await page.locator('[data-calendar-date-select="2026-10-10"]').click();await page.locator('[data-calendar-date-select="2026-10-12"]').click();assert.equal(await page.locator('.calendar-add-menu').getAttribute('open'),'');await page.locator('[data-calendar-date-action=note]').click();assert.match(await page.locator('dialog[open]').innerText(),/This note is for 10 Oct 2026 only/);assert.equal(await page.locator('dialog[open] [name=date]').inputValue(),'2026-10-10');await page.locator('dialog[open] [data-close]').last().click();await page.evaluate(()=>HVCalendar.clearSelection());
   for(let step=1;step<=5;step++){
    await page.evaluate(()=>HVCalendar.openTripPlanner({fresh:true,start:'2027-01-01',end:'2027-01-03'}));
    for(let n=1;n<step;n++){
     if(n===2){await page.locator('#tripPlannerDialog [name=tripName]').fill('Fictional release trip');await page.locator('#tripPlannerDialog [name=countryName]').fill('France');}
     await page.locator('#tripPlannerDialog [data-planner-next]').click();
    }
    await page.locator('#tripPlannerDialog .planner-dialog-actions [data-planner-cancel]').click();assert.equal(await page.locator('#tripPlannerDialog').evaluate(d=>d.open),false);
   }
   await page.evaluate(()=>switchView('transport'));await page.getByRole('tab',{name:'Upcoming',exact:true}).click();await page.locator('[data-dashboard-add]').first().click();assert.equal(await page.locator('#transportForm [name=status]').inputValue(),'planned');await page.locator('#transportForm [name=addReturn]').check();assert.equal(await page.locator('#transportForm [type=submit]').innerText(),'Continue to return journey');await page.locator('[data-close-transport]').first().click();
   await page.evaluate(()=>switchView('notes'));await page.locator('#newChecklistBtn').click();assert.equal(await page.locator('dialog[open] [name=title]').inputValue(),'Before booking');await page.locator('dialog[open] button[data-close]').last().click();
   await page.evaluate(()=>switchView('planner'));const f=page.locator('#itineraryRequestForm');await f.locator('[name=name]').fill('Fictional Traveller');await f.locator('[name=email]').fill('fixture@example.test');await f.locator('[name=destinations]').fill('Undecided: coast and history');await f.locator('[type=submit]').click();assert.match(await page.locator('#enquiryDeliveryStatus').innerText(),/not been sent/);assert.equal(await page.locator('#enquiryEmailLink').isVisible(),false);await page.reload();await page.waitForSelector('#itineraryRequestForm');assert.equal(await page.locator('#itineraryRequestForm [name=destinations]').inputValue(),'Undecided: coast and history');
   await page.evaluate(()=>{window.HV_PLANNING_CONFIG={enquiryEmail:'planning@example.test'};});await page.locator('#itineraryRequestForm [type=submit]').click();const handoff=await page.locator('#enquiryEmailLink').getAttribute('href');assert.ok(handoff.startsWith('mailto:planning@example.test?'));assert.match(decodeURIComponent(handoff),/Undecided: coast and history/);assert.match(await page.locator('#enquiryDeliveryStatus').innerText(),/Nothing has been submitted/);
   await page.evaluate(()=>switchView('countries'));await page.locator('#atlasCountrySearch').fill('Pakistan');await page.waitForFunction(()=>document.querySelector('img[alt="Pakistan flag"]')?.naturalWidth>0);assert.ok(await page.locator('img[alt="Pakistan flag"]').isVisible());
   await page.evaluate(()=>switchView('map'));await page.locator('#mapCountrySelect').selectOption('DZ');await page.waitForSelector('.map-country.selected');assert.equal(await page.locator('.map-country.selected').first().evaluate(el=>getComputedStyle(el).fill),'rgb(99, 159, 198)');
   const after=await page.evaluate(()=>({stays:state.stays,accommodations:state.accommodations,transports:state.transports,manual:state.manualCountryVisits,tcc:state.tccVisits}));fs.writeFileSync(path.join(out,'preservation-before.json'),unchanged);fs.writeFileSync(path.join(out,'preservation-after.json'),JSON.stringify(after));assert.deepEqual(after,JSON.parse(unchanged),'Read-only navigation, previews, drafts and selection preserve existing records');
  }
  if(!baseline&&width===390&&theme==='dark'){
   await page.locator('.header-menu-toggle').click();await page.locator('summary[data-workspace=trips]').click();await page.locator('.header-nav-menu [data-nav-view=stays]').click();assert.equal(await page.locator('#pageTitle').innerText(),'Trips');assert.equal(await page.locator('.header-menu-toggle').getAttribute('aria-expanded'),'false');
  }
  if(!baseline)for(const route of ['login/','register/','reset-password/','profile/']){
   await page.goto(origin+'/'+route);await page.waitForSelector('.account-page');
   if(route==='profile/'){await page.waitForSelector('#heraldGuestTransferPanel');assert.equal(await page.locator('#heraldGuestTransferPanel').count(),1);assert.ok(await page.locator('.account-page').evaluate(el=>[...el.children].indexOf(el.querySelector('#heraldGuestTransferPanel'))<[...el.children].indexOf(el.querySelector('.herald-site-footer'))),'One transfer panel is before the footer');}
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1,route+' auth layout overflow');coverage.push({width,height,theme,view:route,overflow});
  }
  allErrors.push(...errors);if(!baseline)assert.deepEqual(errors,[],`${width}/${theme} browser errors`);await context.close();
 }
 if(!baseline){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();await page.goto(origin+'/#/travel-tools/budget');await page.locator('[data-budget-create]').click();await page.locator('#tripPlannerDialog [data-planner-next]').click();await page.locator('#tripPlannerDialog [name=tripName]').fill('Fictional budget prerequisite');await page.locator('#tripPlannerDialog [name=countryName]').fill('France');for(let i=0;i<3;i++)await page.locator('#tripPlannerDialog [data-planner-next]').click();await page.locator('#tripPlannerDialog [type=submit]').click();await page.waitForFunction(()=>document.body.dataset.currentView==='budget'&&state.trips.length===1);assert.equal(await page.locator('#budgetTripSelect').inputValue(),await page.evaluate(()=>state.trips[0].id));await context.close();
 }
 fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify({coverage,errors:allErrors},null,2));
 console.log(`${baseline?'Baseline':'Release'}: ${coverage.length} viewport/theme/page states inspected; ${allErrors.length} page errors.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'coverage-progress.json'),JSON.stringify({coverage,errors:allErrors},null,2));await browser?.close();server.close();});

/* Calendar geometry, accessibility and data-preservation regressions. Fictional records only. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(process.env.HV_COMPARE_ROOT||path.join(__dirname,'..'));
const out=path.resolve(process.env.HV_SCREENSHOTS||path.join(__dirname,'../test-results/calendar-cell'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);return res.end();}
 if(!path.extname(p))p=path.join(p,'index.html');
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}
 catch{res.writeHead(404);res.end();}
});
const point=(name,iata,countryCode)=>({name,iata,countryCode});
const stay=(id,code,name,start,end=start,tripOrder=0)=>({id,profileId:'p',countryCode:code,countryName:name,start,end,tripOrder,status:'planned',travelKind:'trip',notes:'Keep '+id});
const hotel=(id,name,checkIn,checkOut,extra={})=>({id,profileId:'p',propertyName:name,location:'Original address',checkIn,checkOut,notes:'Keep hotel notes',bookingReference:'KEEP-'+id,...extra});
const flight=(id,date,start,end,extra={})=>({id,profileId:'p',type:'flight',status:'planned',start,end,startLocal:date+'T08:00',endLocal:date+'T12:00',bookingReference:'KEEP-FLIGHT',...extra});
const LJU=point('Ljubljana','LJU','SI'),ZRH=point('Zurich','ZRH','CH'),ALC=point('Alicante','ALC','ES'),ALG=point('Algiers','ALG','DZ');
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Calendar traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],trips:[],
 stays:[stay('single','IE','Ireland','2026-10-04'),stay('long','FM','Micronesia','2026-10-05'),stay('arrive','ES','Spain','2026-10-06','2026-10-06',0),stay('depart','SI','Slovenia','2026-10-05','2026-10-06',1),stay('ireland','IE','Ireland','2026-10-07','2026-10-07',0),stay('uk','GB','United Kingdom','2026-10-07','2026-10-07',1),stay('connection-country','ES','Spain','2026-10-08'),stay('warning','DZ','Algeria','2026-10-14','2026-10-14',1),stay('schengen','FR','France','2026-10-14','2026-10-14',0),stay('long-one','CF','Central African Republic','2026-10-19'),stay('long-two-a','BA','Bosnia and Herzegovina','2026-10-20','2026-10-20',0),stay('long-two-b','FM','Micronesia','2026-10-20','2026-10-20',1)],
 transports:[flight('chronology','2026-10-06',LJU,ALC),flight('reference-flight','2026-10-07',ALC,ALG),{id:'bus',profileId:'p',type:'bus',status:'planned',start:{name:'Peterborough'},end:{name:'Market Deeping'},startLocal:'2026-10-07T15:00',endLocal:'2026-10-07T16:00',serviceNumber:'48'},flight('connection','2026-10-08',LJU,ALC,{legs:[{start:LJU,end:ZRH,startLocal:'2026-10-08T08:00',endLocal:'2026-10-08T10:00'},{start:ZRH,end:ALC,startLocal:'2026-10-08T11:00',endLocal:'2026-10-08T12:00'}]}),{id:'long-ground',profileId:'p',type:'train',status:'planned',start:{name:'London Kings Cross'},end:{name:'Edinburgh Waverley'},startLocal:'2026-10-15T08:00',endLocal:'2026-10-15T14:00'}],
 accommodations:[hotel('grand','Grand Canal Hotel','2026-10-06','2026-10-07'),hotel('iveagh','Iveagh Garden Hotel','2026-10-07','2026-10-08'),hotel('solo','The Riverside Hotel','2026-10-10','2026-10-12'),hotel('old','Old Town Hotel','2026-10-13','2026-10-14',{checkOutTime:'06:00',timeZone:'Europe/London'}),hotel('new','Grand Metropolitan Riverside Hotel and Apartments','2026-10-14','2026-10-16',{checkInTime:'06:00',timeZone:'Europe/London'}),hotel('parallel-a','First hotel','2026-10-21','2026-10-23'),hotel('parallel-b','Second hotel','2026-10-21','2026-10-23')],
 residences:[{id:'home',profileId:'p',countryCode:'GB',countryName:'United Kingdom',start:'2000-01-01',end:null}],placeVisits:[],savedPlaces:[{id:'private',profileId:'p',place:{name:'Saved place',lat:1,lon:2}}],visaAcknowledgements:[{id:'old-ack',fingerprint:'preserve'}],excludedCountryCodes:['GB'],visualLayers:{calendar:{countries:true,transport:true,accommodation:true}}};
const flagCountries=['DE','LI','AT','CH','NO','FM','MH','TV','JP'];
for(let count=3;count<=9;count++)for(let i=0;i<count;i++){const code=flagCountries[i],date='2026-10-'+(count+20);seed.stays.push(stay('flags-'+count+'-'+i,code,new Intl.DisplayNames(['en'],{type:'region'}).of(code),date,date,i));}
for(const [i,code]of ['AU','ES','NZ'].entries())seed.stays.push(stay('triple-visa-'+i,code,new Intl.DisplayNames(['en'],{type:'region'}).of(code),'2026-10-30','2026-10-30',i));
const snapshot=()=>JSON.stringify({trips:state.trips,stays:state.stays,transports:state.transports,accommodations:state.accommodations,residences:state.residences,profiles:state.profiles,savedPlaces:state.savedPlaces,placeVisits:state.placeVisits,visaAcknowledgements:state.visaAcknowledgements,visualLayers:state.visualLayers});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const width of (process.env.HV_CALENDAR_WIDTHS||'360,390,768,1024,1440').split(',').map(Number))for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<=390,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.addInitScript(({data,theme})=>{localStorage.setItem('herald.calendar.view.v1','month');localStorage.setItem('whereIveBeen.theme.v1',theme);if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},{data:seed,theme});
  await page.goto(origin+'/#/calendar');await page.waitForFunction(()=>window.HVCalendar?.ready&&window.HVCalendarDetails);
  await page.locator('[data-calendar-select-range]').click();await page.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
  await page.waitForFunction(()=>[...document.querySelectorAll('#calendar img')].every(i=>!i.getClientRects().length||i.getBoundingClientRect().top>=innerHeight||i.complete));
  const initial=await page.evaluate(snapshot),stored=await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));
  const day=date=>page.locator('.calendar-day[data-calendar-date="2026-10-'+date+'"]');
  const geometry=await page.locator('#calendar').evaluate(el=>({calendar:el.getBoundingClientRect().toJSON(),days:[...el.querySelectorAll('.calendar-day')].map(n=>({date:n.dataset.calendarDate,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,border:getComputedStyle(n).border,padding:getComputedStyle(n).padding})),single:[...el.querySelector('[data-calendar-date="2026-10-04"]').querySelectorAll('.calendar-journey-chip,.country-name-full,.calendar-chip-flag')].map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:getComputedStyle(n).font,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor}))}));
  fs.writeFileSync(path.join(out,`geometry-${width}-${theme}.json`),JSON.stringify(geometry,null,2));
  await page.locator('#calendar').screenshot({path:path.join(out,`month-${width}-${theme}.png`)});
  await day('07').screenshot({path:path.join(out,`busy-${width}-${theme}.png`)});
  await day('10').screenshot({path:path.join(out,`check-in-${width}-${theme}.png`)});
  if(process.env.HV_CALENDAR_BASELINE){await page.close();continue;}
  if(process.env.HV_BASELINE_SCREENSHOTS){const baseline=JSON.parse(fs.readFileSync(path.join(process.env.HV_BASELINE_SCREENSHOTS,`geometry-${width}-${theme}.json`)));assert.deepEqual(geometry.days.map(({date,width,height,border})=>({date,width,height,border})),baseline.days.map(({date,width,height,border})=>({date,width,height,border})),'Every cell dimension and border is unchanged');assert.deepEqual(geometry.single,baseline.single,'Single-country presentation is unchanged');assert.equal(geometry.calendar.width,baseline.calendar.width);assert.equal(geometry.calendar.height,baseline.calendar.height);}
  const two=day('06').locator('.calendar-country-section');
  assert.deepEqual(await two.locator('[data-calendar-edit-country]').evaluateAll(ns=>ns.map(n=>n.dataset.calendarEditCountry)),['depart','arrive'],'Country chronology follows transport');
  assert.deepEqual(await two.locator('button').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label'))),['Slovenia · Schengen Area','Spain · Schengen Area']);
  assert.ok(await day('07').locator('[data-calendar-day-detail]').count(),'Dense days advertise access to every entry');
  for(let count=3;count<=9;count++){
   const cell=day(String(count+20));assert.equal(await cell.locator('[data-calendar-edit-country]').count(),Math.min(2,count));
   await cell.locator('[data-calendar-day-detail]').click();
   const text=await page.locator('#calendarJourneyDetail').innerText();
   for(const record of seed.stays.filter(s=>s.id.startsWith('flags-'+count+'-')))assert.ok(text.includes(record.countryName),'Day details retain '+record.countryName);
   await page.locator('[data-calendar-close-date]').click();
  }
  const button=day('06').locator('[data-calendar-edit-country=arrive]');
  width<=390?await button.tap():await button.click();await page.locator('#calendarJourneyDetail [data-calendar-edit-stay=arrive]').click();await page.locator('#stayDialog[open]').waitFor();assert.equal(await page.locator('#countryInput').inputValue(),'Spain');await page.locator('#closeDialog').click();await page.locator('[data-calendar-close-date]').click();
  assert.deepEqual(await day('20').locator('[data-calendar-edit-country]').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label'))),['Bosnia and Herzegovina','Micronesia'],'Full country names remain accessible');
  const showDay=async date=>{await day(date).locator('.day-number').click();};
  for(const [date,ids]of [['07',['grand','iveagh']],['10',['solo']],['12',['solo']],['14',['old','new']]]){
    await showDay(date);const detail=await page.locator('#calendarJourneyDetail').innerText();
    for(const id of ids)assert.ok(detail.includes(seed.accommodations.find(a=>a.id===id).propertyName),'All boundary-day hotels remain in details');
    await page.locator('[data-calendar-close-date]').click();
  }
  await day('07').locator('[data-calendar-day-detail]').click();await page.locator('#calendarJourneyDetail [data-calendar-edit-accommodation=iveagh]').click();
  await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('dialog[open] [name=propertyName]').inputValue(),'Iveagh Garden Hotel');await page.locator('dialog[open] [data-accommodation-close]').first().click();
  if(await page.locator('[data-calendar-close-date]').count())await page.locator('[data-calendar-close-date]').click();
  assert.equal(await day('07').locator('.calendar-day-transport').count(),2);assert.match(await day('07').locator('[data-calendar-edit-transport=reference-flight]').getAttribute('aria-label'),/ALC.*ALG/);
  await day('07').locator('[data-calendar-edit-transport=reference-flight]').click();await page.locator('#calendarJourneyDetail [data-calendar-edit-transport=reference-flight]').click();await page.locator('#transportForm').waitFor();assert.equal(await page.locator('#transportForm [name=bookingReference]').inputValue(),'KEEP-FLIGHT');await page.locator('[data-close-transport]').first().click();await page.locator('[data-calendar-close-date]').click();
  await page.locator('[data-calendar-select-range]').click();await day('10').locator('.day-number').click();await day('12').locator('.day-number').click();assert.equal(await page.locator('.selection-range').count(),3);await page.locator('[data-calendar-close-date]').click();
  await page.locator('[data-calendar-select-range]').click();await day('07').locator('.day-number').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#calendarJourneyDetail').innerText(),/Ireland/);assert.match(await page.locator('#calendarJourneyDetail').innerText(),/United Kingdom/);await page.locator('[data-calendar-close-date]').click();
  assert.equal(await page.evaluate(snapshot),initial,'Rendering, focus, selection and cancelled edits preserve records');assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),stored,'No stored payload was rewritten');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Calendar adds no horizontal scrolling');assert.deepEqual(errors,[]);
  await page.close();console.log(`Calendar cells verified at ${width}px in ${theme} theme.`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

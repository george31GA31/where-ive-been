/* Signed-in synthetic histories and two-frame navigation timings, not INP. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(process.env.HV_ROOT||path.join(__dirname,'..')),{largeAccount}=require(path.join(root,'tests/fixtures/large-account.cjs'));
const id='019a1234-6b7c-4d8e-9001-202610140001',user={id,aud:'authenticated',role:'authenticated',email:'performance@example.test',app_metadata:{provider:'email'},user_metadata:{}};
const exp=Math.floor(Date.now()/1000)+3600,part=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),auth={access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp,aud:'authenticated',role:'authenticated'})+'.fixture',refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;const reports=[];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
 for(const [count,linked]of [[8,true],[160,true],[800,false]]){
  const data=largeAccount(count,8),artwork=data.savedPlaces.slice(0,8).map(place=>place.accommodationLogo.src);data.savedPlaces.forEach((place,i)=>place.accommodationLogo.src=artwork[i%8]);if(!linked){data.trips=[];for(const key of ['stays','accommodations','transports'])data[key].forEach(record=>record.tripId=null);}
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];let reads=0,checks=0,writes=0,delay=40,cloud=structuredClone(data),revision=1;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=route.request().url();if(url.startsWith(origin))return route.continue();if(url.includes('/auth/v1/user'))return route.fulfill({json:user});if(url.includes('/auth/v1/token'))return route.fulfill({json:auth});
   if(url.includes('/rest/v1/travel_tracker_data')){if(new URL(url).searchParams.get('select')==='revision'){checks++;return route.fulfill({json:[{revision}]});}reads++;await new Promise(resolve=>setTimeout(resolve,delay));try{return await route.fulfill({json:[{payload:cloud,revision}]});}catch{return;}}
   if(url.includes('/rpc/save_travel_account')){const request=route.request().postDataJSON();if(request.p_revision!==revision)return route.fulfill({status:409,json:{code:'40001'}});cloud=request.p_payload;revision++;writes++;return route.fulfill({json:[{revision}]});}return route.abort();
  });
  await page.addInitScript(({auth,id})=>{localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));localStorage.setItem('whereIveBeen.localOwner.v1',id);localStorage.setItem('whereIveBeen.importNoticed.'+id,'yes');window.priorityTasks=[];new PerformanceObserver(list=>priorityTasks.push(...list.getEntries().map(entry=>entry.duration))).observe({type:'longtask',buffered:true});},{auth,id});
  const settled=()=>page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(element=>element.textContent==='Saved to account'),null,{timeout:60000});
  const start=Date.now();await page.goto(origin);await page.waitForFunction(()=>state.stays.length>0&&!document.querySelector('.app-shell').inert,null,{timeout:60000});await settled();const ready=Date.now()-start,metrics=[];
  // Inspect a populated month while retaining the entire established history.
  await page.evaluate(()=>{calendarCursor=new Date(Date.UTC(2018,0,1));});
  const cdp=await context.newCDPSession(page),heapAtReady=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  for(const pass of [1,2])for(const view of ['calendar','stats','dashboard','countries'])metrics.push(await page.evaluate(async({view,pass})=>{const start=performance.now();switchView(view);const handler=performance.now()-start;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {view,pass,handlerMs:Math.round(handler),paintMs:Math.round(performance.now()-start)};},{view,pass}));
  for(const pass of [1,2])metrics.push(await page.evaluate(async pass=>{const start=performance.now();HVCountryTracker.open('tcc');const handler=performance.now()-start;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const result={view:'tcc',pass,handlerMs:Math.round(handler),paintMs:Math.round(performance.now()-start)};document.querySelector('.country-tracker-dialog').close();return result;},pass));
  await page.evaluate(()=>{switchView('calendar');calendarCursor=new Date(Date.UTC(2018,0,1));renderCalendar();});
  for(const action of ['day-details','next-month','choose-year','year-overview','next-year','tcc-search'])metrics.push(await page.evaluate(async action=>{
   const start=performance.now();
   if(action==='day-details')document.querySelector('[data-calendar-date-select="2018-01-01"]').click();
   if(action==='next-month')document.getElementById('nextMonth').click();
   if(action==='choose-year'){const input=document.getElementById('calendarYearJump');input.value='2019';input.dispatchEvent(new Event('change',{bubbles:true}));}
   if(action==='year-overview')document.querySelector('[data-calendar-view="year"]').click();
   if(action==='next-year')document.getElementById('nextMonth').click();
   if(action==='tcc-search'){HVCountryTracker.open('tcc');const input=document.querySelector('.country-tracker-dialog [data-search]');input.value='Pakistan';input.dispatchEvent(new Event('input',{bubbles:true}));}
   const handler=performance.now()-start;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   if(action==='tcc-search')document.querySelector('.country-tracker-dialog').close();
   return {view:action,handlerMs:Math.round(handler),paintMs:Math.round(performance.now()-start)};
  },action));
  const saveStart=Date.now(),noteEditMs=await page.evaluate(()=>{const start=performance.now();state.notes[0].body='Unrelated note edit';persist();return Math.round(performance.now()-start);});metrics.push(await page.evaluate(async()=>{const start=performance.now();switchView('calendar');const handler=performance.now()-start;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {view:'calendar-after-note',handlerMs:Math.round(handler),paintMs:Math.round(performance.now()-start)};}));await settled();const saveFeedbackMs=Date.now()-saveStart;
  const heapAfterNavigation=(await cdp.send('Runtime.getHeapUsage')).usedSize;await cdp.detach();delay=3000;const reloadStart=Date.now();await page.reload();await page.waitForFunction(()=>state.stays.length>0&&!document.querySelector('.app-shell').inert,null,{timeout:60000});const cachedReady=Date.now()-reloadStart;
  const maxReloadTaskMs=await page.evaluate(()=>Math.max(0,...priorityTasks)),accountPageMs=[];for(const pass of [1,2]){const start=Date.now();if(pass===1)await page.goto(origin+'/profile/');else await page.reload();await page.waitForFunction(()=>document.getElementById('profileSummary')?.textContent.includes('performance@example.test'));accountPageMs.push(Date.now()-start);}
  reports.push({count,linked,calendarMonth:'2018-01',payloadBytes:Buffer.byteLength(JSON.stringify(data)),postgresBytes:require('../account-size').measure(data).bytes,readyMs:ready,cachedSlowNetworkReadyMs:cachedReady,reads,checks,writes,noteEditMs,saveFeedbackMs,accountPageMs,metrics,heapAtReady,heapAfterNavigation,maxReloadTaskMs,errors});await context.close();
 }
 const output=process.env.HV_BENCH_OUTPUT||path.join(__dirname,'../test-results/priority-performance.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(reports,null,2));
 if(process.env.HV_PERF_ASSERT)for(const report of reports){assert.deepEqual(report.errors,[]);assert.ok(report.cachedSlowNetworkReadyMs<2000,'Owned cache must be usable before the three-second remote read');for(const metric of report.metrics)assert.ok(metric.handlerMs<(metric.pass===2||metric.view==='calendar-after-note'?150:750),'Priority tab blocks too long: '+JSON.stringify(metric));}
 console.log(JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

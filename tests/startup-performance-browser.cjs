/* Real Chromium, SDK, storage and traces; all travel and backend responses are fictional. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium'),{largeAccount}=require('./fixtures/large-account.cjs');
binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results'),id='019a1234-6b7c-4d8e-9001-202610070001';
fs.mkdirSync(out,{recursive:true});
const user={id,aud:'authenticated',role:'authenticated',email:'performance@example.test',app_metadata:{provider:'email'},user_metadata:{}};
function session(){const exp=Math.floor(Date.now()/1000)+3600,part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return{access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp,aud:'authenticated',role:'authenticated'})+'.fixture',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'fictional-refresh',user};}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
let browser;
const reports=[];
const controls=[];
async function fixture(origin,data,width=1440,theme='light',failure=false){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  const control={context,page,cloud:structuredClone(data),revision:1,mode:failure?'server':'online',reads:0,checks:0,auth:0,writes:0,errors:[]};
  controls.push(control);
  page.on('pageerror',error=>control.errors.push(error.message));
  await context.route('**/*',async route=>{
    const url=route.request().url();if(url.startsWith(origin))return route.continue();
    if(url.includes('.supabase.co/')){
      if(url.includes('/auth/v1/user')){control.auth++;await new Promise(resolve=>setTimeout(resolve,40));return route.fulfill({json:user});}
      if(url.includes('/auth/v1/token'))return route.fulfill({json:session()});
      if(url.includes('/auth/v1/logout'))return route.fulfill({status:204,body:''});
      if(url.includes('/rest/v1/travel_tracker_data')){
        const revisionOnly=new URL(url).searchParams.get('select')==='revision';revisionOnly?control.checks++:control.reads++;
        if(control.mode==='server')return route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE',message:'Fictional service outage'}});
        if(control.mode==='offline')return route.abort('internetdisconnected');
        if(control.mode==='hold'){control.release=()=>route.abort('internetdisconnected');return;}
        return route.fulfill({json:[revisionOnly?{revision:control.revision}:{payload:control.cloud,revision:control.revision}]});
      }
      if(url.includes('/rpc/save_travel_account')){
        const request=route.request().postDataJSON();if(request.p_revision!==control.revision)return route.fulfill({status:409,json:{code:'40001'}});
        control.cloud=request.p_payload;control.revision++;control.writes++;return route.fulfill({json:[{revision:control.revision}]});
      }
      return route.fulfill({json:{}});
    }
    return route.abort();
  });
  await page.addInitScript(({auth,id,theme})=>{
    localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));localStorage.setItem('whereIveBeen.localOwner.v1',id);localStorage.setItem('whereIveBeen.importNoticed.'+id,'yes');localStorage.setItem('whereIveBeen.theme.v1',theme);
    window.startupMetrics={longTasks:[],routeReads:0,logoElements:0};
    new PerformanceObserver(list=>startupMetrics.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
    let store;Object.defineProperty(window,'HVRouteStore',{configurable:true,get:()=>store,set:value=>{store=value;const previous=value.get;value.get=function(...args){startupMetrics.routeReads++;return previous.apply(this,args);};}});
  },{auth:session(),id,theme});
  return control;
}
const settled=page=>page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(el=>el.textContent==='Saved to account')&&!document.querySelector('.app-shell').inert,null,{timeout:60000});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  for(const [count,points,width,theme]of [[160,350,390,'dark'],[450,700,768,'light'],[700,1100,1440,'dark']]){
    const data=largeAccount(count,points),control=await fixture(origin,data,width,theme),{page,context}=control;
    if(count===700)await browser.startTracing(page,{path:path.join(out,'large-account-startup.trace.json'),screenshots:false,categories:['devtools.timeline','v8.execute','blink.user_timing']});
    const started=Date.now();await page.goto(origin+'/');await settled(page);
    const elapsed=Date.now()-started;
    assert.equal(control.reads,1);assert.equal(control.writes,0,'Hydration is not a save');
    const cdp=await context.newCDPSession(page),heapAtReady=await cdp.send('Runtime.getHeapUsage');
    assert.equal(await page.evaluate(()=>state.stays.length),count);assert.equal(await page.evaluate(()=>state.accommodations.length),count);
    const metrics=await page.evaluate(()=>({...startupMetrics,logoElements:document.querySelectorAll('img.herald-hotel-logo').length,bytes:Object.keys(localStorage).filter(k=>k.startsWith('whereIveBeen.outbox.v1.')).reduce((n,k)=>n+localStorage.getItem(k).length,0)}));
    assert.equal(metrics.routeReads,0,'Home never decodes saved routes');assert.equal(metrics.logoElements,0);assert.equal(metrics.bytes,0);
    const cache=await page.evaluate(async id=>{const rows=await new WIBAccountCache.AccountCache().entries('whereIveBeen.outbox.v1.'+id+'.');return {records:rows.length,assets:rows[0].value.assets.length,token:rows[0].token,stays:WIBAccountCache.unpack(rows[0].value).base.stays.length,serializedBytes:JSON.stringify(rows[0].value).length};},id);
    assert.equal(cache.stays,count);assert.ok(cache.assets<count,'Repeated exact logo assets are stored once');
    const fullReads=control.reads;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(100);
    assert.equal(control.reads,fullReads);assert.equal(control.checks,1);assert.equal(control.writes,0);
    assert.equal(await page.evaluate(async id=>(await new WIBAccountCache.AccountCache().entries('whereIveBeen.outbox.v1.'+id+'.'))[0].token,id),cache.token,'Idle checks do not rewrite the checkpoint');
    const heapAfterIdle=await cdp.send('Runtime.getHeapUsage');await cdp.detach();
    const maxTask=Math.max(0,...metrics.longTasks.map(task=>task.duration));assert.ok(maxTask<2000,'No multi-second main-thread freeze: '+maxTask);
    reports.push({count,points,width,theme,payloadBytes:JSON.stringify(data).length,readyMs:elapsed,maxTaskMs:maxTask,logoAssets:cache.assets,cacheBytes:cache.serializedBytes,usedJSHeapBytes:heapAtReady.usedSize,idleJSHeapBytes:heapAfterIdle.usedSize});
    fs.writeFileSync(path.join(out,'startup-performance.json'),JSON.stringify(reports,null,2));
    if(count===700)await browser.stopTracing();
    await page.evaluate(()=>switchView('stats'));assert.equal(await page.locator('.personal-travel-stat').count(),6);await page.evaluate(()=>switchView('calendar'));assert.equal(await page.locator('.calendar-day').count(),42);
    assert.deepEqual(await page.evaluate(()=>state.transports[0].resolvedRoutes),data.transports[0].resolvedRoutes);
    await context.close();console.log('Large account, exact logo pooling, preserved routes, quiet idle and lazy Home passed: '+count+' records');
  }
  const guestData=largeAccount(160,350),guest=await fixture(origin,guestData,390,'light');
  await guest.page.addInitScript(data=>{localStorage.removeItem('whereIveBeen.auth.v1');localStorage.removeItem('whereIveBeen.localOwner.v1');localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},guestData);
  await guest.page.goto(origin+'/');await guest.page.waitForFunction(()=>state.stays.length===160&&!document.querySelector('.app-shell').inert);
  assert.equal(guest.reads,0);assert.equal(await guest.page.locator('img.herald-hotel-logo').count(),0);assert.equal(await guest.page.evaluate(()=>startupMetrics.routeReads),0);
  assert.deepEqual(await guest.page.evaluate(()=>JSON.parse(localStorage.getItem('whereIveBeen.data.v2'))),guestData,'Guest startup preserves its original storage');assert.deepEqual(guest.errors,[]);await guest.context.close();
  console.log('Large guest history also starts with lazy Home and unchanged storage');
  // Real local cache survives an offline startup; reconnect merges with a fresh peer.
  const data=largeAccount(8,20),a=await fixture(origin,data),b=await fixture(origin,data);
  await a.page.goto(origin+'/');await settled(a.page);await b.page.goto(origin+'/');await settled(b.page);
  await a.page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:120000});
  await a.context.setOffline(true);await a.page.evaluate(()=>{state.notes[0].body='Offline change';persist();});
  await a.page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(el=>el.textContent.includes('changes waiting to sync')));await a.page.reload();await a.page.waitForFunction(()=>state.notes[0]?.body==='Offline change'&&!document.querySelector('.app-shell').inert);
  await b.page.evaluate(()=>{state.accommodations[0].notes='Another device';persist();});await settled(b.page);
  a.cloud=b.cloud;a.revision=b.revision;await a.context.setOffline(false);await a.page.locator('#retrySaveBtn').click();await settled(a.page);
  assert.equal(a.cloud.notes[0].body,'Offline change');assert.equal(a.cloud.accommodations[0].notes,'Another device');assert.equal(a.cloud.accommodations.length,8);
  b.cloud=a.cloud;b.revision=a.revision;await b.page.reload();await settled(b.page);assert.equal(await b.page.evaluate(()=>state.notes[0].body),'Offline change');
  await a.context.close();await b.context.close();
  // A server outage is distinct from no Wi-Fi; repeated Retry clicks share one flight.
  const failed=await fixture(origin,data,390,'dark',true);await failed.page.goto(origin+'/');await failed.page.locator('#accountLoadError').waitFor();assert.equal(await failed.page.evaluate(()=>navigator.onLine),true);
  failed.mode='online';const reads=failed.reads,auth=failed.auth;
  await failed.page.evaluate(()=>{for(let i=0;i<10;i++)document.getElementById('retryAccountLoadBtn').click();});
  assert.equal(await failed.page.locator('#retryAccountLoadBtn').innerText(),'Retrying…');assert.equal(await failed.page.locator('#retryAccountLoadBtn').isDisabled(),true);
  await settled(failed.page);assert.equal(failed.reads-reads,1);assert.equal(failed.auth-auth,1);assert.equal(failed.writes,0);assert.equal(await failed.page.locator('#accountLoadError').isVisible(),false);
  await failed.context.close();
  // Connection disappears after the account request has started, then manual Retry recovers.
  const interrupted=await fixture(origin,data);interrupted.mode='hold';await interrupted.page.goto(origin+'/');
  while(!interrupted.release)await interrupted.page.waitForTimeout(10);
  await interrupted.context.setOffline(true);await interrupted.release();await interrupted.page.locator('#accountLoadError').waitFor();
  interrupted.mode='online';await interrupted.context.setOffline(false);await interrupted.page.locator('#retryAccountLoadBtn').click();await settled(interrupted.page);assert.equal(interrupted.writes,0);await interrupted.context.close();
  for(const control of [a,b,failed,interrupted])assert.deepEqual(control.errors,[]);
  fs.writeFileSync(path.join(out,'startup-performance.json'),JSON.stringify(reports,null,2));
  console.log('Offline reload, two-session concurrent merge, backend outage, interrupted startup and repeated Retry passed');
})().catch(async error=>{console.error(error);for(const control of controls){if(!control.page.isClosed())console.error(JSON.stringify({reads:control.reads,auth:control.auth,writes:control.writes,errors:control.errors,ui:await control.page.evaluate(()=>({online:navigator.onLine,status:[...document.querySelectorAll('[data-sync-status]')].map(el=>el.textContent),conflicts:[...document.querySelectorAll('.account-conflicts legend')].map(el=>el.textContent),diagnostics:window.HVAccountDiagnostics?.events}))}));}process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

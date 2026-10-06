/* Real browser quota and SDK, fictional large account, no external writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),id='019a1234-6b7c-4d8e-9001-202610060001';
const user={id,aud:'authenticated',role:'authenticated',email:'quota-fixture@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Fictional traveller'}};
function session(){const exp=Math.floor(Date.now()/1000)+3600,part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return{access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp,aud:'authenticated',role:'authenticated'})+'.fixture',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'quota-fixture-refresh',user};}
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Fictional traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],stays:[{id:'stay',profileId:'p',countryCode:'FR',countryName:'France',start:'2026-03-10',end:'2026-03-12',status:'actual'}],residences:[],trips:[],notes:[],savedPlaces:[],placeVisits:[],accommodations:[],transports:[]};
for(let i=0;i<214;i++)seed.accommodations.push({id:'hotel-'+i,profileId:'p',propertyName:'Fictional hotel '+i,location:'Paris',checkIn:'2026-03-10',checkOut:'2026-03-12',travelKind:'trip',notes:'Keep hotel '+i,bookingReference:'KEEP-'+i,place:{id:'fixture:'+i,name:'Fictional hotel '+i,city:'Paris',countryCode:'FR',countryName:'France',lat:48.8+i*.001,lon:2.3}});
for(let i=0;i<32;i++)seed.transports.push({id:'rail-'+i,profileId:'p',type:'train',status:'actual',start:{name:'Departure',lat:51,lon:0,countryCode:'GB'},end:{name:'Arrival',lat:48,lon:2,countryCode:'FR'},startLocal:'2026-03-10T08:00',endLocal:'2026-03-10T12:00',notes:'Keep railway data '+i});
seed.fixtureArtwork='x'.repeat(1670000-JSON.stringify(seed).length);
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const [width,theme]of [[390,'dark'],[1440,'light']])for(const fill of [2000000,4000000]){
  let cloud=structuredClone(seed),revision=511,offline=false,writes=0;const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===390,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{
   const url=r.request().url();if(url.startsWith(origin))return r.continue();
   if(url.includes('.supabase.co/')){
    if(url.includes('/auth/v1/user'))return r.fulfill({json:user});if(url.includes('/auth/v1/token'))return r.fulfill({json:session()});if(url.includes('/auth/v1/logout'))return r.fulfill({status:204,body:''});
    if(offline)return r.abort('internetdisconnected');
    if(url.includes('/rest/v1/travel_tracker_data'))return r.fulfill({json:[{payload:cloud,revision}]});
    if(url.includes('/rest/v1/rpc/save_travel_account')){const data=r.request().postDataJSON();if(data.p_revision!==revision)return r.fulfill({status:409,json:{code:'40001'}});cloud=data.p_payload;revision++;writes++;return r.fulfill({json:[{payload:cloud,revision}]});}
    return r.fulfill({json:{}});
   }
   if(url.includes('/d3@'))return r.fulfill({path:path.join(root,'node_modules/d3/dist/d3.min.js'),contentType:'text/javascript'});
   if(url.includes('/topojson-client@'))return r.fulfill({path:path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),contentType:'text/javascript'});
   if(url.includes('/world-atlas@'))return r.fulfill({path:path.join(root,'node_modules/world-atlas/countries-50m.json'),contentType:'application/json'});
   return r.abort();
  });
  await page.addInitScript(({auth,theme,fill,id})=>{if(!localStorage.getItem('whereIveBeen.beforeAccounts.v1')){localStorage.setItem('whereIveBeen.beforeAccounts.v1',JSON.stringify({recovery:'r'.repeat(fill)}));localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));localStorage.setItem('whereIveBeen.localOwner.v1',id);}localStorage.setItem('whereIveBeen.theme.v1',theme);},{auth:session(),theme,fill,id});
  await page.goto(origin+'/');await page.waitForFunction(()=>state.accommodations.length===214&&!document.querySelector('.app-shell').inert);
  assert.equal(await page.locator('#accountLoadError').isVisible(),false,'A successful cloud read is visible even when its backup cannot fit');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('whereIveBeen.beforeAccounts.v1')).recovery.length),fill);assert.equal(await page.evaluate(()=>state.fixtureArtwork.length),seed.fixtureArtwork.length);assert.deepEqual(await page.evaluate(()=>state.transports),seed.transports);
  if(fill===2000000){
   const bytes=await page.evaluate(id=>Object.keys(localStorage).filter(k=>k.startsWith('whereIveBeen.outbox.v1.'+id+'.')).reduce((n,k)=>n+localStorage.getItem(k).length,0),id);assert.ok(bytes>1600000&&bytes<1800000,'A large clean account needs only one data copy');
   offline=true;await page.evaluate(()=>{state.accommodations[0].notes='Offline change retained';persist();});await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent.includes('waiting for account sync')));
   await page.reload();await page.waitForFunction(()=>state.accommodations[0]?.notes==='Offline change retained'&&!document.querySelector('.app-shell').inert);assert.equal(await page.locator('#accountLoadError').isVisible(),false);
   offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent==='Saved to account'));assert.equal(cloud.accommodations[0].notes,'Offline change retained');
  }else{
   assert.ok(await page.evaluate(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent.includes('Device storage is full'))));
   await page.evaluate(()=>{state.accommodations[0].notes='Online save with a full device';persist();});await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent==='Saved to account. Offline copy unavailable on this device.'));assert.equal(cloud.accommodations[0].notes,'Online save with a full device');assert.equal(await page.locator('#retrySaveBtn').isVisible(),false);
   offline=true;await page.evaluate(()=>{state.accommodations[0].notes='Keep this tab open';persist();});await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent.includes('waiting for account sync')));
   assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true,'Uncached pending edits protect against closing the page');
   assert.equal(cloud.accommodations[0].notes,'Online save with a full device');offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent==='Saved to account. Offline copy unavailable on this device.'));assert.equal(cloud.accommodations[0].notes,'Keep this tab open');assert.equal(await page.locator('#retrySaveBtn').isVisible(),false);
  }
  assert.ok(writes>0);assert.equal(cloud.accommodations.length,214);assert.equal(cloud.transports.length,32);assert.equal(cloud.fixtureArtwork,seed.fixtureArtwork);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('whereIveBeen.beforeAccounts.v1')).recovery.length),fill);assert.deepEqual(errors,[]);
  await page.evaluate(async()=>{await WIBAuth.client().auth.signOut({scope:'local'});});await page.waitForFunction(()=>state.accommodations.length===0);assert.equal(await page.evaluate(()=>state.fixtureArtwork),undefined,'Account data is not shown after sign-out');await page.close();console.log('Large account, real quota, backup preservation and sync: '+width+' '+theme+' '+fill+' passed');
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

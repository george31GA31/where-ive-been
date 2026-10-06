/* Real browser quota and SDK, fictional large account, no external writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),id='019a1234-6b7c-4d8e-9001-202610060001';
const user={id,aud:'authenticated',role:'authenticated',email:'quota-fixture@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Fictional traveller'}};
function session(){const exp=Math.floor(Date.now()/1000)+3600,part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return{access_token:part({alg:'HS256',typ:'JWT'})+'.'+part({sub:id,exp,aud:'authenticated',role:'authenticated'})+'.fixture',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'quota-fixture-refresh',user};}
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Fictional traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],stays:[{id:'stay',profileId:'p',countryCode:'FR',countryName:'France',start:'2026-03-10',end:'2026-03-12',status:'actual'}],residences:[],trips:[],notes:[],savedPlaces:[],placeVisits:[],accommodations:[],transports:[]};
const routeStore=require('../route-persistence.js');
seed.transports=[{id:'saved-train',profileId:'p',type:'train',startLocal:'2026-03-10T10:00',endLocal:'2026-03-10T12:00',start:{name:'Paris',lat:48.85,lon:2.35},end:{name:'Lyon',lat:45.76,lon:4.84}}];
routeStore.set(seed.transports[0],0,'train',seed.transports[0].start,seed.transports[0].end,{coordinates:[[48.85,2.35],[47.5,3.8],[45.76,4.84]],label:'Saved mapped railway'});
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});

let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const [width,theme] of [[390,'dark'],[1440,'light']]){
 let cloud=structuredClone(seed),revision=1,writes=0,reads=0;const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.log('Fixture page error: '+e.message);});
 await context.route('**/*',r=>{const url=r.request().url();if(url.startsWith(origin))return r.continue();if(url.includes('.supabase.co/')){
 if(url.includes('/auth/v1/user'))return r.fulfill({json:user});if(url.includes('/auth/v1/token'))return r.fulfill({json:session()});if(url.includes('/auth/v1/logout'))return r.fulfill({status:204,body:''});
 if(url.includes('/rest/v1/travel_tracker_data')){reads++;return r.fulfill({json:[{payload:cloud,revision}]});}
 if(url.includes('/rpc/save_travel_account')){cloud=r.request().postDataJSON().p_payload;revision++;writes++;return r.fulfill({json:[{revision}]});}
 }return r.abort();});
 await page.addInitScript(({auth,theme})=>{if(!localStorage.getItem('whereIveBeen.auth.v1'))localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));localStorage.setItem('whereIveBeen.theme.v1',theme);},{auth:session(),theme});
 console.log('Loading offline fixture '+width);await page.goto(origin+'/');await page.waitForFunction(()=>state.stays.length===1&&!document.querySelector('.app-shell').inert);
 console.log('Account loaded; waiting for offline shell');await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:120000});
 await page.evaluate(()=>switchView('calendar'));const before=await page.evaluate(()=>JSON.stringify(state.stays));
 console.log('Shell ready; disconnecting');await context.setOffline(true);await page.waitForFunction(()=>HVNetwork.state==='offline');
 await page.evaluate(()=>{state.notes.push({id:'offline-note',profileId:'p',title:'Offline note',body:'Keep this'});state.expenses.push({id:'offline-expense',profileId:'p',amount:15,currency:'GBP'});state.checklists.push({id:'offline-list',profileId:'p',items:[{id:'item',label:'Passport',done:true}]});if(!persist())throw Error('Offline persistence refused');});
 await page.evaluate(()=>{const auth=JSON.parse(localStorage.getItem('whereIveBeen.auth.v1'));auth.expires_at=1;localStorage.setItem('whereIveBeen.auth.v1',JSON.stringify(auth));});console.log('Reloading disconnected with expired session');await page.reload();await page.waitForFunction(()=>state.notes.some(n=>n.id==='offline-note')&&!document.querySelector('.app-shell').inert);
 assert.equal(await page.evaluate(()=>JSON.stringify(state.stays)),before);assert.equal(await page.evaluate(()=>state.expenses[0].amount),15);assert.equal(await page.evaluate(()=>state.checklists[0].items[0].done),true);
 const routesBefore=JSON.stringify(seed.transports[0].resolvedRoutes);await page.evaluate(()=>switchView('journeys'));await page.waitForSelector('#globalJourneyMap.leaflet-container');assert.equal(await page.evaluate(()=>JSON.stringify(state.transports[0].resolvedRoutes)),routesBefore);await page.evaluate(()=>switchView('roadTrip'));await page.locator('#roadTripForm [name=name]').fill('Offline road draft');await page.locator('#roadStop0').fill('Paris');await page.locator('#roadStop1').fill('Lyon');await page.locator('#roadCalculate').click();assert.match(await page.locator('#roadTripMessage').innerText(),/internet connection/);await page.reload();await page.waitForFunction(()=>state.notes.length===1);await page.evaluate(()=>switchView('roadTrip'));assert.equal(await page.locator('#roadTripForm [name=name]').inputValue(),'Offline road draft');assert.equal(await page.locator('#roadStop0').inputValue(),'Paris');await page.evaluate(()=>switchView('calendar'));assert.equal(await page.locator('.herald-connection').isVisible(),true);
 const failedReads=reads;await page.waitForTimeout(1500);assert.equal(reads,failedReads,'Offline state sends no account request storm');
 await context.setOffline(false);await page.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(e=>e.textContent==='Saved to account'),null,{timeout:45000});
 assert.equal(cloud.expenses.length,1);assert.equal(cloud.notes.length,1);assert.equal(writes,1);assert.deepEqual(errors,[]);
 const peer=await context.newPage();await peer.goto(origin+'/');await peer.waitForFunction(()=>state.notes.some(n=>n.id==='offline-note'));assert.equal(await peer.evaluate(()=>state.expenses.length),1);
 // Individual provider outages do not clear account data or declare the whole app offline.
 await context.route('**/photon.komoot.io/**',r=>r.fulfill({status:503,json:{}}));
 assert.equal(await page.evaluate(async()=>{try{await HVTravelSearch.search('Provider outage fixture');}catch{}return state.expenses.length;}),1);
 assert.notEqual(await page.evaluate(()=>HVNetwork.state),'offline');
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:500,downloadThroughput:200000,uploadThroughput:100000});
 assert.equal(await page.evaluate(async()=>{const r=await HVNetwork.request('data/capitals.json',{}, {timeout:10000});return r.ok;}),true);
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await context.route('**/slow-fixture',async r=>{await new Promise(resolve=>setTimeout(resolve,400));try{await r.fulfill({json:{ok:true}});}catch{}});
 assert.equal(await page.evaluate(async()=>{try{await HVNetwork.request('slow-fixture',{}, {timeout:40});return false;}catch(e){return e.name==='TimeoutError'&&state.notes.length===1;}}),true);
 await page.evaluate(async()=>WIBAuth.client().auth.signOut({scope:'local'}));await page.waitForFunction(()=>state.notes.length===0);assert.equal(await page.evaluate(()=>state.expenses.length),0);
 await context.close();console.log('Genuine offline reload, durable edits, reconnect, peer sync and sign-out: '+width+' '+theme+' passed');
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

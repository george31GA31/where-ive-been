/* Real previous-release -> candidate worker upgrade, with private fixture storage. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const candidate=path.resolve(__dirname,'..'),previous=process.env.HV_PREVIOUS_ROOT;
if(!previous)throw new Error('Set HV_PREVIOUS_ROOT to an unchanged checkout of the previous release.');
const {largeAccount}=require('./fixtures/large-account.cjs'),data=largeAccount(8,8);let current=path.resolve(previous);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const file=path.resolve(current,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));if(!file.startsWith(current+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 const context=await browser.newContext(),page=await context.newPage();await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await context.addInitScript(data=>{if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},data);
 await page.goto(origin);await page.waitForFunction(()=>window.HVPages&&!document.querySelector('.app-shell').inert);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000});
 const before=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>{localStorage.setItem('whereIveBeen.outbox.v1.fixture-owner.fixture-tab','fictional pending edits and deletion tombstone');});
 current=candidate;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:90000});
 assert.equal(await page.locator('.header-nav-group').count(),0,'The existing page remains on its coherent old shell');
 const expected=fs.readFileSync(path.join(candidate,'sw.js'),'utf8').match(/herald-shell-[a-f0-9]+/)[0];let worker;for(const item of context.serviceWorkers()){try{if(await item.evaluate(()=>CACHE)===expected)worker=item;}catch{}}assert.ok(worker,'Candidate worker is installed');await page.goto('about:blank');await page.close();const started=Date.now();while(!await worker.evaluate(()=>self.serviceWorker?.state==='activated')){if(Date.now()-started>10000)throw new Error('Candidate worker did not activate after closing old tabs');await new Promise(r=>setTimeout(r,100));}
 const next=await context.newPage();next.on('pageerror',e=>console.error(e.stack));await next.goto(origin);await next.waitForFunction(()=>window.HVPages&&!document.querySelector('.app-shell').inert);await next.reload();try{await next.waitForFunction(()=>!!document.querySelector('.header-nav-group'),null,{timeout:3000});}catch(e){console.error(await next.evaluate(async()=>({title:document.title,nav:document.querySelector('.sidebar .nav')?.innerText,caches:await caches.keys(),modernScript:(await(await fetch('voyages.js')).text()).includes('header-nav-group'),networkModern:(await(await fetch('voyages.js?code=public-fixture')).text()).includes('header-nav-group'),controllerVersion:await new Promise(resolve=>{navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='offline-shell-status')resolve(e.data.version);},{once:true});navigator.serviceWorker.controller.postMessage({type:'offline-shell-status'});})})));throw e;}
 assert.deepEqual(await next.evaluate(()=>JSON.parse(JSON.stringify(state))),JSON.parse(before),'IDs, fields, associations, logos and stored routes survive the actual application update');
 assert.equal(await next.evaluate(()=>localStorage.getItem('whereIveBeen.outbox.v1.fixture-owner.fixture-tab')),'fictional pending edits and deletion tombstone');
 await next.evaluate(()=>switchView('countries'));await next.locator('#atlasCountrySearch').fill('Pakistan');await next.waitForFunction(()=>document.querySelector('img[alt="Pakistan flag"]')?.naturalWidth>0);
 await context.setOffline(true);await next.reload();await next.waitForFunction(()=>!!document.querySelector('.header-nav-group'));assert.deepEqual(await next.evaluate(()=>JSON.parse(JSON.stringify(state))),JSON.parse(before));
 await context.close();console.log('Actual previous-to-candidate application/worker upgrade passed: saved travel, stable identities, references, routes, logos, pending/deletion sentinel, Pakistan flag and offline reload.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.closeAllConnections();server.close();});

/* Run with NODE_PATH pointing at a jsdom installation. No real account/network calls. */
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),errors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://george31ga31.github.io/where-ive-been/#/dashboard',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,c=dom.getInternalVMContext();w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.CSS={escape:s=>s};w.confirm=()=>true;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.fetch=async url=>{const name=String(url).split('/').at(-1).split('?')[0];if(fs.existsSync(path.join(root,'data',name)))return{ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'))};throw Error('Offline test');};
const seed={version:2,profiles:[{id:'p',name:'Me',citizenships:[],enabledRules:['schengen']}],activeProfileId:'p',stays:[{id:'s',countryCode:'GB',countryName:'United Kingdom',start:'2026-01-01',end:'2026-01-04',status:'actual',profileId:'p'}],residences:[]};w.localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));
const scripts=['account-model.js','account-sync.js',...Array.from(fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/src="([^"?]+)(?:\?[^" ]*)?"/g),m=>m[1])];
for(const file of scripts){Object.defineProperty(w.document,'currentScript',{configurable:true,value:{src:new URL(file,w.location.href).href}});vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});}
const tick=()=>new Promise(r=>setTimeout(r,30));const run=s=>vm.runInContext(s,c);
(async()=>{
 await tick();assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
 assert.equal(w.document.querySelectorAll('main>.view').length,1);assert.equal(w.document.body.dataset.currentView,'dashboard');
 w.location.hash='/country/GB';await tick();assert.equal(w.document.body.dataset.currentView,'country');assert.match(w.document.querySelector('#countryDetails').textContent,/Ben Nevis/);assert.equal(w.document.querySelectorAll('main>.view').length,1);
 w.document.querySelector('[data-place-id]').click();assert.equal(run('state.placeVisits.length'),1);assert.equal(run('state.stays.length'),1);
 w.location.hash='/countries';await tick();assert.equal(w.document.querySelectorAll('#countriesView>.journey-accordion').length,2);assert.ok(w.document.querySelector('a[href="#/country/GB"]'));
 w.location.hash='/lived-in';await tick();const home=w.document.querySelector('[data-home-country="GB"]');home.click();assert.equal(run('travelDaySet().size'),0);assert.equal(run('state.stays[0].start'),'2026-01-01');
 w.location.hash='/calendar';await tick();run("calendarCursor=new Date(Date.UTC(2026,0,1));renderCalendar()");w.document.querySelector('#calendarYearToggle').click();assert.ok(w.document.querySelector('.atlas-month-dots .home'));
 w.document.querySelector('#addTransportBtn').click();const f=w.document.querySelector('#transportForm');f.elements.startname.value='London';f.elements.endname.value='New York';f.elements.flightNumber.value='TEST1';f.elements.startLocal.value='2026-01-02T09:00';f.elements.endLocal.value='2026-01-02T07:00';f.elements.startlat.value='51.47';f.elements.startlon.value='-0.45';f.elements.endlat.value='40.64';f.elements.endlon.value='-73.78';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(run('state.transports.length'),1);assert.equal(run('state.stays.length'),1);assert.equal(run('state.transports[0].endLocal'),'2026-01-02T07:00');
 w.document.querySelector('[data-layer-view="calendar"][data-layer="transport"]').click();assert.ok(w.document.querySelector('.calendar-transport'));w.document.querySelector('.calendar-transport').click();assert.equal(w.document.querySelector('#transportDialog').open,true);assert.equal(run('calendarSelectionStart'),null);
 f.elements.bookingReference.value='private-test';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(run('state.transports[0].bookingReference'),'private-test');
 w.location.hash='/map';await tick();w.document.querySelector('[data-layer="transport"]').click();assert.notEqual(w.getComputedStyle(w.document.querySelector('#timelineBars')).display,'none');const date=w.document.querySelector('#timelineManualDate');date.value='2026-01-02';date.dispatchEvent(new w.Event('change'));assert.equal(run('timelineDate'),'2026-01-02');
 w.document.querySelector('#timelineSlider').value=0;w.document.querySelector('#timelineSlider').dispatchEvent(new w.Event('input'));assert.equal(date.value,'2026-01-01');
 w.d3=await import(process.env.HV_D3_MODULE||'/tmp/herald-qa/node_modules/d3/src/index.js');
 w.topojson={};global.navigator=w.navigator;await run('worldFeatures=[{type:"Feature",id:826,properties:{name:"United Kingdom"},geometry:{type:"Polygon",coordinates:[[[-8,50],[-8,59],[2,59],[2,50],[-8,50]]]}}];worldLoading=false;renderWorldMap()');
 w.setTimelineDate('2026-01-02');assert.ok(w.document.querySelector('.transport-routes path[stroke="#66DCE3"]'));
 const pathEl=w.document.querySelector('.map-country');assert.ok(pathEl);pathEl.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();assert.match(w.location.hash,/country\/GB/);assert.equal(w.document.querySelector('#voyagesCountryDrawer'),null);
 w.location.hash='/stats';await tick();assert.ok(w.document.querySelector('#placeAchievements'));assert.match(w.document.querySelector('#placeAchievements').textContent,/251/);
 w.location.hash='/calendar';await tick();w.document.querySelector('[data-transport-edit]').click();w.document.querySelector('#transportDelete').click();assert.equal(run('state.transports.length'),0);assert.equal(run('state.stays.length'),1);assert.equal(JSON.parse(w.localStorage.getItem('whereIveBeen.data.v2')).placeVisits.length,1);
 for(const route of ['dashboard','map','countries','calendar','trips','stats','lived-in','settings','schengen','visa','people']){w.location.hash='/'+route;await tick();run('renderAll()');assert.equal(w.document.querySelectorAll('main>.view').length,1);}
 assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));console.log('UI smoke passed: routes, detached pages, imported facts, visits, home days, timeline, transport CRUD and persistence.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});

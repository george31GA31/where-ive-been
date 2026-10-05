/* Captured public OSM geometry, fictional itineraries, and no remote account writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium'),G=require('../journey-routes');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/network-routing');fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'},assets=new Map();
function load(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','tests','test-results','scripts'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())load(file);else if(entry.isFile())assets.set('/'+path.relative(root,file).split(path.sep).join('/'),{body:fs.readFileSync(file),type:mime[path.extname(file)]||'application/octet-stream'});}}load(root);
const server=http.createServer((req,res)=>{let key;try{key=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}if(!path.extname(key))key=key.replace(/\/$/,'')+'/index.html';const a=assets.get(key);if(!a){res.writeHead(404);return res.end();}res.setHeader('Content-Type',a.type);res.end(a.body);});
const cases=[
 ['cebu-ferry','boat',[10.297,123.905],[9.65,123.85]],
 ['portsmouth-ryde','boat',[50.792,-1.105],[50.732,-1.158]],
 ['piraeus-aegina','boat',[37.934,23.634],[37.744,23.429]],
 ['paddington-royal-oak','train',[51.5152,-.1755],[51.524,-.188]],
 ['manchester-ardwick','train',[53.4775,-2.231],[53.4712,-2.213]],
 ['ljubljana-tivoli','train',[46.059,14.512],[46.055,14.493]],
 ['ljubljana-dobova','train',[46.0593,14.5135],[46.0859,15.1705]],
 ['ljubljana-jesenice','train',[46.0592,14.5134],[46.4365,14.0554]],
 ['ljubljana-kocevje','train',[46.0591,14.5133],[45.6466,14.8575]],
 ['kyle-inverness','train',[57.2804,-5.7139],[57.4801,-4.2237]]
].map(([id,type,a,b])=>({id,type,a,b,elements:require('./fixtures/route-networks/'+id+'.json').elements}));
const bus={id:'bus-gap',type:'bus',a:[0,50],b:[0,50.3],elements:[{type:'way',id:1,tags:{highway:'primary'},geometry:[{lat:0,lon:50},{lat:.01,lon:50.1},{lat:0,lon:50.3}]}]};cases.push(bus);
const partialRail={id:'partial-rail',type:'train',a:[40,1],b:[40,1.2],elements:[{type:'relation',tags:{route:'train'},members:[{type:'way',ref:400,geometry:[[40,1],[40.01,1.05],[40,1.1],null,[40,1.101],[40.01,1.15],[40,1.2]].map(p=>p?{lat:p[0],lon:p[1]}:null)}]}]};cases.push(partialRail);
const railDeparture=require('./fixtures/route-networks/ljubljana-station.json'),railArrival=require('./fixtures/route-networks/jesenice-station.json');
const fullRailWays=require('./fixtures/route-networks/ljubljana-jesenice.json').elements,fullRailNodes=new Map();
for(const way of fullRailWays)way.nodes.forEach((id,i)=>fullRailNodes.set(id,{type:'node',id,...way.geometry[i]}));
const railRaw={elements:[...fullRailNodes.values(),...fullRailWays.map(({geometry,...way})=>way),railDeparture.elements.find(e=>e.type==='relation'&&e.id===1973077)]};
const railElements=data=>{const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,{lat:e.lat,lon:e.lon}]));return data.elements.filter(e=>e.type==='way').map(e=>({...e,geometry:e.nodes.map(id=>nodes.get(id))})).concat(data.elements.filter(e=>e.type==='relation'));};
cases.find(c=>c.id==='ljubljana-jesenice').elements=[...railElements(railDeparture),...railElements(railArrival),...railElements(railRaw)];
const exactBoat=[[10,-77.5],[10.2,-77.7],[11,-78]],exactRail=[[51,0],[51.03,.1],[51.04,.2]],exactRoad=[[51.2,1],[51.27,1.15],[51.3,1.3]];
const pt=(p,name)=>({lat:p[0],lon:p[1],name}),transport=(id,type,a,b,i)=>({id,profileId:'p',tripId:'routes',type,start:pt(a,id+' departure'),end:pt(b,id+' arrival'),startLocal:`2026-11-${String(i+1).padStart(2,'0')}T08:00`,endLocal:`2026-11-${String(i+1).padStart(2,'0')}T10:00`,status:'planned',bookingReference:'KEEP-'+id});
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Route traveller',homeCountryCodes:[],citizenships:['GB'],enabledRules:['schengen']}],trips:[{id:'routes',profileId:'p',name:'Network checks',notes:'Keep trip'}],transports:cases.map((c,i)=>transport(c.id,c.type,c.a,c.b,i)),stays:[],accommodations:[{id:'hotel',profileId:'p',tripId:'routes',propertyName:'Keep hotel',checkIn:'2026-11-01',checkOut:'2026-11-02',place:{name:'Keep hotel',lat:10.3,lon:123.9},notes:'Keep accommodation'}],placeVisits:[],savedPlaces:[{id:'saved',profileId:'p',place:{name:'Keep manual place',lat:10,lon:20}}],residences:[],visaAcknowledgements:[],excludedCountryCodes:[],custom:{retain:'all'}};
seed.transports.push(transport('exact-ferry','ferry',exactBoat[0],exactBoat.at(-1),cases.length),transport('exact-train','train',exactRail[0],exactRail.at(-1),cases.length+1),transport('exact-road','car',exactRoad[0],exactRoad.at(-1),cases.length+2),transport('inland-boat','boat',[48.85,2.35],[51.5,-.1],cases.length+3));
const entries=seed.transports.length+seed.accommodations.length;
// Match the OSM map API's node references, rather than assuming Overpass geometry.
const harbourNodes=new Map(),harbourWays=cases[0].elements.map(e=>{const nodes=e.nodes.map((id,i)=>{harbourNodes.set(id,{type:'node',id,...e.geometry[i]});return id;});const {geometry,...way}=e;return {...way,nodes};}),harbour={elements:[...harbourNodes.values(),...harbourWays]};
const snapshot=()=>JSON.stringify(state);
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,mask=G.landMask(require('../data/water-land.json'));
 for(const c of cases){c.expected=await G.networkPath(c.elements,pt(c.a),pt(c.b),{type:c.type,mask});assert.ok(c.expected?.length>2,c.id+' has usable reference geometry');}
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const width of (process.env.HV_NETWORK_WIDTHS||'390,1440').split(',').map(Number))for(const theme of (process.env.HV_NETWORK_THEMES||'light,dark').split(',')){
  const page=await browser.newPage({viewport:{width,height:960},hasTouch:width===390,reducedMotion:'reduce'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  await page.route('**/*',r=>{
   const url=r.request().url();if(url.startsWith(origin))return r.continue();
   if(url.includes('/d3@'))return r.fulfill({path:path.join(root,'node_modules/d3/dist/d3.min.js'),contentType:'text/javascript'});
   if(url.includes('/topojson-client@'))return r.fulfill({path:path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),contentType:'text/javascript'});
   if(url.includes('/world-atlas@'))return r.fulfill({path:path.join(root,'node_modules/world-atlas/countries-50m.json'),contentType:'application/json'});
   if(url.includes('overpass-api.de/')||url.includes('overpass.private.coffee/')){
    const q=new URL(url).searchParams.get('data');requests.push(q);const network=q.includes('out body geom'),expanded=q.includes('->.lines'),c=cases.find(c=>q.includes(c.a.join(',')));
    if(network&&c?.id==='cebu-ferry')return r.fulfill({status:503,body:'Unavailable'});
    if(c?.id==='ljubljana-jesenice')return r.fulfill({status:503,body:'Unavailable'});
    if(expanded)assert.ok(url.includes('overpass.private.coffee/'),'Expanded railway lookup uses the compatible backup instance');
    let elements=network?c?.elements||[]:[];
    if(c?.id==='ljubljana-dobova'&&network&&!expanded)elements=elements.filter(w=>w.geometry.every(p=>p.lon<14.7));
    if(c?.id==='partial-rail'&&!network)elements=c.elements;
    const exact=q.includes('10,-77.5')?exactBoat:q.includes('51,0')?exactRail:null;
    if(!network&&exact)elements=[{type:'relation',members:[{type:'way',geometry:exact.map(([lat,lon])=>({lat,lon}))}]}];
    return r.fulfill({json:{elements}});
   }
   if(url.includes('api.openstreetmap.org/api/0.6/map.json')){
    const bbox=new URL(url).searchParams.get('bbox').split(',').map(Number),lat=(bbox[1]+bbox[3])/2,lon=(bbox[0]+bbox[2])/2;
    if(Math.abs(lat-46.0592)<.01&&Math.abs(lon-14.5134)<.02){requests.push('rail-departure');return r.fulfill({json:railDeparture});}
    if(Math.abs(lat-46.4365)<.01&&Math.abs(lon-14.0554)<.02){requests.push('rail-arrival');return r.fulfill({json:railArrival});}
    requests.push('harbour');return r.fulfill({json:harbour});
   }
   if(url.includes('api.openstreetmap.org/api/0.6/relation/1973077/full.json')){requests.push('rail-infrastructure');return r.fulfill({json:railRaw});}
   if(url.includes('routing.openstreetmap.de/')){requests.push('road');return r.fulfill({json:url.includes('1,51.2;1.3,51.3')?{code:'Ok',waypoints:[{distance:0},{distance:0}],routes:[{geometry:{coordinates:exactRoad.map(p=>[p[1],p[0]])}}]}:{code:'NoRoute'}});}
   if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=','base64')});
   return r.abort();
  });
  await page.addInitScript(({seed,theme})=>{if(!localStorage.getItem('network-seeded')){localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('whereIveBeen.guest.v1',JSON.stringify(seed));localStorage.setItem('network-seeded','yes');}localStorage.setItem('whereIveBeen.theme.v1',theme);document.addEventListener('DOMContentLoaded',()=>{window.testRouteLayers=[];const original=L.polyline;L.polyline=function(coords,options){const line=original(coords,options);testRouteLayers.push(line);return line;};});},{seed,theme});
  await page.goto(origin+'/#/journey-map');await page.waitForFunction(n=>window.HVJourneyMap&&state.transports.length===n,seed.transports.length);
  const before=await page.evaluate(snapshot),stored=await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));
  try{await page.waitForFunction(n=>document.getElementById('globalJourneyStatus')?.textContent.includes(n+' entries')&&!document.getElementById('globalJourneyStatus').textContent.includes('Loading'),entries,{timeout:50000});}catch(error){console.error(await page.evaluate(()=>({status:document.getElementById('globalJourneyStatus')?.textContent,layers:window.testRouteLayers?.length,transports:state.transports.length})),requests,errors);throw error;}
  const layers=()=>page.evaluate(()=>testRouteLayers.filter(l=>l._map).map(l=>({coords:l.getLatLngs().map(p=>[p.lat,p.lng]),colour:l.options.color,weight:l.options.weight,dash:l.options.dashArray})));
  const verify=(drawn,weight)=>{
   for(const c of cases){const colour=c.type==='boat'?'#31848a':c.type==='train'?'#7c6187':'#29556b',line=drawn.find(l=>l.colour===colour&&JSON.stringify(l.coords)===JSON.stringify(c.expected));assert.ok(line,c.id+' keeps mapped geometry and connectors');assert.equal(line.weight,weight);assert.equal(line.colour,c.type==='boat'?'#31848a':c.type==='train'?'#7c6187':'#29556b');if(c.type==='boat')assert.equal(line.dash,'3 6');if(c.type==='train')assert.equal(line.dash,'10 3');}
   for(const [name,coords]of [['ferry',exactBoat],['train',exactRail],['road',exactRoad]])assert.ok(drawn.some(l=>JSON.stringify(l.coords)===JSON.stringify(coords)),'Existing '+name+' route is byte-for-byte unchanged');
   assert.ok(!drawn.some(l=>l.coords.length===2&&l.coords[0][0]===48.85),'No unverified boat line across land');
  };
  verify(await layers(),1.6);assert.equal(requests.filter(q=>q==='harbour').length,1);assert.ok(!requests.some(q=>q.includes?.('out body geom')&&(q.includes('10,-77.5')||q.includes('51,0')||q.includes('51.2,1'))),'Successful exact routes do not request network fallbacks');
  assert.ok(requests.some(q=>q.includes('->.lines')&&q.includes(cases.find(c=>c.id==='ljubljana-dobova').a.join(','))),'An incomplete first network response expands its search');
  assert.ok(requests.includes('rail-departure')&&requests.includes('rail-arrival')&&requests.filter(q=>q==='rail-infrastructure').length===1,'Unavailable Overpass lookups recover through tiny OSM station extracts and one shared infrastructure relation');
  assert.ok(!requests.some(q=>q.includes('out body geom')&&q.includes('40,1,40,1.2')),'A partial train relation is reused before fetching more data');
  assert.ok(requests.filter(q=>q.includes('->.lines')).every(q=>q.includes('[railway~')),'Expanded lookups are railway-only');
  await page.evaluate(()=>HVJourneyUI.activeMap().fitBounds([[45.6,14],[46.5,15.25]],{animate:false}));await page.locator('#globalJourneyMap').screenshot({path:path.join(out,`rail-regional-${width}-${theme}.png`)});
  await page.evaluate(()=>{HVJourneyUI.activeMap().fitBounds([[9.6,123.7],[10.35,124]],{animate:false});});await page.locator('#globalJourneyMap').screenshot({path:path.join(out,`cebu-${width}-${theme}.png`)});
  assert.equal(await page.evaluate(async()=>{const host=document.createElement('div'),status=document.createElement('p');host.style.cssText='width:300px;height:300px';document.body.append(host);const n=testRouteLayers.length,r={key:'closed',type:'train',record:{id:'closed',type:'train'},leg:{start:{lat:40,lon:1},end:{lat:40,lon:1.3}}};const surface=HVJourneyMap.mountGlobal(host,[r],'2026-10-05',status);surface.remove();host.remove();await new Promise(resolve=>setTimeout(resolve,50));return testRouteLayers.slice(n).every(l=>!l._map);}),true,'Closing a map cancels pending routing and removes its lines');
  const count=requests.length;await page.evaluate(()=>HVJourneyMap.open('trip:routes'));await page.waitForFunction(()=>[...document.querySelectorAll('.journey-map-dialog [data-route-status]')].every(n=>!n.textContent.includes('Checking')));verify((await layers()).filter(l=>l.weight===1.5),1.5);assert.ok(requests.slice(count).every(q=>q.includes('48.85,2.35')),'Both maps reuse resolved geometry; only unavailable routes retry');
  const dialog=page.locator('.journey-map-dialog');width===390?await dialog.locator('[data-map-stop]').first().tap():await dialog.locator('[data-map-stop]').first().click();assert.equal(await dialog.locator('[data-map-stop]').count(),entries);await dialog.screenshot({path:path.join(out,`focused-${width}-${theme}.png`)});await dialog.locator('[data-map-close]').click();
  assert.equal(await page.evaluate(snapshot),before);assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),stored);
  await page.reload();await page.waitForFunction(n=>document.getElementById('globalJourneyStatus')?.textContent.includes(n+' entries')&&!document.getElementById('globalJourneyStatus').textContent.includes('Loading'),entries,{timeout:50000});verify(await layers(),1.6);assert.equal(await page.evaluate(snapshot),before);assert.deepEqual(errors,[]);await page.close();console.log(`Network routing ${width}px ${theme} passed`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

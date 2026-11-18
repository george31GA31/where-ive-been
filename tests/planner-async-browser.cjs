/* Controlled image decoding exercises the real planner across draft/profile lifecycles. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require('playwright'), binary = require('@sparticuz/chromium');
const {PNG} = require('pngjs');
const M = require('../trip-planner-model.js');
const root = path.resolve(__dirname,'..'), origin = 'https://herald.test';
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const journey = M.normalize({id:'saved-p',plannerVersion:2,name:'Traveller P route',profileId:'p',status:'planned',updatedAt:'2026-11-01T00:00:00Z',stops:[{id:'a',name:'Origin',lat:10,lon:20},{id:'b',name:'Transfer',lat:11,lon:21},{id:'c',name:'Destination',lat:12,lon:22}],segments:[]});
const seed = {version:2,activeProfileId:'p',profiles:[{id:'p',name:'P',citizenships:[],enabledRules:[]},{id:'q',name:'Q',citizenships:[],enabledRules:[]}],roadTrips:[journey],trips:[],transports:[],accommodations:[],stays:[],notes:[],savedPlaces:[],placeVisits:[],residences:[]};
const pixels = new PNG({width:4,height:4});pixels.data.fill(160);
const photo = name => ({name,mimeType:'image/png',buffer:PNG.sync.write(pixels)});
let browser;
async function draft(page, scope = 'guest.p') {
  return page.evaluate(scope=>JSON.parse(sessionStorage.getItem('herald.tripPlanner.draft.v2.'+scope))?.draft,scope);
}
async function upload(page,name,index) {
  await page.locator('[data-planner-upload]').setInputFiles(photo(name));
  await page.waitForFunction(index=>window.pendingPlannerDecodes.length>index,index);
}
async function release(page,index) {
  await page.evaluate(async index=>{
    pendingPlannerDecodes[index]();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },index);
}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:950},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)&&file!==root)return route.fulfill({status:403,body:''});
    if(!path.extname(file))file=path.join(file,'index.html');
    return fs.existsSync(file)?route.fulfill({path:file,contentType:types[path.extname(file)]}):route.fulfill({status:404,body:''});
  });
  await page.addInitScript(seed=>localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed)),seed);
  await page.goto(origin);
  await page.waitForFunction(()=>window.HVCalendar?.ready&&window.HVTripPlanner&&!document.querySelector('.app-shell').inert);
  await page.evaluate(()=>{
    window.pendingPlannerDecodes=[];
    const decode=Image.prototype.decode;
    Image.prototype.decode=async function(){await decode.call(this);await new Promise(resolve=>pendingPlannerDecodes.push(resolve));};
    HVTripPlanner.open('saved-p',{stopId:'a'});
  });
  await upload(page,'older.png',0);
  await upload(page,'newer.png',1);
  await release(page,1);
  assert.equal((await draft(page)).stops[0].media[0].name,'newer.png');
  await release(page,0);
  assert.equal((await draft(page)).stops[0].media[0].name,'newer.png','An older decode cannot replace a newer image');
  await upload(page,'removed.png',2);
  await page.locator('[data-remove-media]').click();
  await release(page,2);
  assert.equal((await draft(page)).stops[0].media,undefined,'Removing an image invalidates a pending replacement');
  await upload(page,'current.png',3);
  await page.locator('#plannerDetailForm [name=notes]').fill('Text typed while the photo loads');
  await release(page,3);
  assert.equal(await page.locator('#plannerDetailForm [name=notes]').inputValue(),'Text typed while the photo loads');
  assert.equal((await draft(page)).stops[0].notes,'Text typed while the photo loads');
  await upload(page,'reordered-stop.png',4);
  await page.locator('[data-move-stop="0"][data-direction="1"]').click();
  await release(page,4);
  assert.equal((await draft(page)).stops.find(stop=>stop.id==='a').media[0].name,'reordered-stop.png','A valid upload follows its stable destination through reordering');
  await page.locator('[data-move-stop="1"][data-direction="-1"]').click();
  await page.locator('#plannerSave').click();
  await upload(page,'stale-reopen.png',5);
  await page.locator('#plannerSaved').selectOption('saved-p');
  await release(page,5);
  assert.equal((await draft(page)).stops[0].media[0].name,'reordered-stop.png','Reopening the same saved journey invalidates its prior decode');
  await page.locator('[data-select-segment]').first().click();
  await page.locator('#plannerDetailForm [name=notes]').fill('Retain this section before reordering');
  await page.locator('[data-move-stop="0"][data-direction="1"]').click();
  assert.equal(await page.locator('#plannerDetails').isVisible(),false,'A displaced section cannot keep an editable stale form');
  assert.ok((await draft(page)).previousSegments.some(segment=>segment.notes==='Retain this section before reordering'));
  await page.locator('#plannerSaved').selectOption('saved-p');
  await page.locator('[data-select-stop="a"]').first().click();
  await upload(page,'stale-profile.png',6);
  await page.locator('#plannerDetailForm [name=notes]').fill('Unblurred draft belongs to P');
  await page.evaluate(()=>{state.activeProfileId='q';window.dispatchEvent(new Event('hv-data-changed'));});
  assert.equal((await draft(page)).stops.find(stop=>stop.id==='a').notes,'Unblurred draft belongs to P');
  assert.equal(await page.locator('#plannerStop0').inputValue(),'');
  await page.locator('#plannerName').fill('Q unsaved draft');
  assert.equal((await draft(page,'guest.q')).profileId,'q');
  await page.evaluate(()=>{state.activeProfileId='p';window.dispatchEvent(new Event('hv-data-changed'));});
  await release(page,6);
  assert.equal((await draft(page)).stops.find(stop=>stop.id==='a').media[0].name,'reordered-stop.png','A decode cannot cross a profile switch and return');
  await page.locator('[data-select-stop="a"]').first().click();
  await page.locator('#plannerDetailForm [name=notes]').fill('Unblurred draft belongs to this guest');
  await page.evaluate(()=>{
    Object.defineProperty(HVAccountState,'userId',{value:'fictional-account',configurable:true});
    window.dispatchEvent(new Event('hv-data-changed'));
  });
  assert.equal((await draft(page)).stops.find(stop=>stop.id==='a').notes,'Unblurred draft belongs to this guest');
  assert.equal(await page.locator('#plannerStop0').inputValue(),'');
  await page.locator('#plannerName').fill('Account unsaved draft');
  const accountDraft=await draft(page,'fictional-account.p');
  assert.notEqual(accountDraft.id,'saved-p','The prior scope draft is never stored under the new account key');
  await page.evaluate(()=>{
    Object.defineProperty(HVAccountState,'userId',{value:null,configurable:true});
    window.dispatchEvent(new Event('hv-data-changed'));
  });
  assert.equal((await draft(page)).stops.find(stop=>stop.id==='a').notes,'Unblurred draft belongs to this guest');
  assert.deepEqual(errors,[]);
  console.log('Planner async regression passed: latest upload wins, removal/reopening/scope changes cancel stale decoding, in-progress notes survive async redraw/profile/account changes, and reordered sections close stale editors.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});

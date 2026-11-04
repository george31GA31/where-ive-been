'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/candidate-browser.cjs'),{candidateHistory}=require('./fixtures/v1-candidate.cjs');
const out=path.resolve(__dirname,'../test-results/motion-workspaces');fs.mkdirSync(out,{recursive:true});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGQAAAABJRU5ErkJggg==';
(async()=>{const h=await harness();try{
 for(const width of [1440,768,390,360])for(const theme of ['light','dark']){
  const data=candidateHistory(),trip=data.trips.find(t=>t.id==='south');
  trip.photos=[{id:'first',name:'Not automatically selected',src:png},{id:'chosen',name:'Explicit fictional cover',src:png}];trip.coverPhotoId='chosen';
  data.savedPlaces.push({id:'motion-place',profileId:'p',place:{id:'motion-source',name:'Fictional riverside library',countryCode:'FR',countryName:'France',address:'1 Fictional River Road'}});
  const p=await h.page(data,{width,height:900,theme,touch:width<500,route:'trips'});
  await p.waitForFunction(()=>!!window.HVMotionWorkspaces);await p.waitForSelector('.motion-workspace-caption');
  const baseline=await p.evaluate(()=>JSON.stringify(state));
  assert.equal(await p.locator('.motion-workspace-caption').count(),1);
  assert.ok(await p.locator('.motion-trip-number').count()>0);
  assert.equal(await p.locator('.motion-trip-cover[alt="Explicit fictional cover"]').count(),1);
  assert.equal(await p.locator('.motion-trip-cover[alt="Not automatically selected"]').count(),0);
  assert.ok(await p.locator('.trip-group h3').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=27));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Journey index reflows');
  await p.screenshot({path:path.join(out,`journeys-${width}-${theme}.png`)});
  await p.evaluate(()=>switchView('places'));await p.waitForSelector('#personalPlaces .motion-row');
  await p.locator('[data-place-search]').fill('riverside library');await p.waitForSelector('[data-saved-place-id="motion-place"]');
  await p.locator('[data-saved-place-id="motion-place"] [data-v1-read]').click();await p.waitForSelector('.hv-v1-reader[open]');
  assert.match(await p.locator('.hv-v1-reader').innerText(),/1 Fictional River Road/);
  assert.ok(await p.locator('.hv-v1-reader').evaluate(el=>el.getBoundingClientRect().width<=innerWidth-20),'Reader fits viewport');
  await p.keyboard.press('Escape');await p.waitForSelector('.hv-v1-reader',{state:'detached'});
  await p.evaluate(()=>switchView('stats'));await p.waitForSelector('.personal-travel-stat.motion-row');
  assert.equal(await p.locator('.personal-travel-stat').count(),6);
  await p.locator('[data-year-scope]').selectOption('2026');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Statistics reflows');
  await p.evaluate(()=>switchView('transport'));await p.waitForSelector('.transport-dashboard');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Transport reflows');
  if(width<821)assert.equal(await p.locator('.transport-map-pane').isVisible(),false,'Phone/tablet list remains useful before map');
  await p.evaluate(()=>location.hash='#/country/FR');await p.waitForSelector('.motion-workspace-caption');await p.waitForSelector('#countryDetails .country-heading');
  assert.equal(await p.locator('#countryView .motion-workspace-caption').count(),1);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Country page reflows');
  await p.evaluate(()=>switchView('stays'));await p.locator('.trip-group [data-trip-open="south"]').click();await p.waitForSelector('.trip-experience-dialog[open]');
  assert.ok(await p.locator('.trip-experience-dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth-20));
  await p.locator('.trip-experience-dialog [data-close]').click();
  assert.equal(await p.evaluate(()=>JSON.stringify(state)),baseline,'Workspace presentation and cancelled read tasks preserve every record');
  // Some original route features maintain preferences/route metadata on entry.
  // Check those real screens, then isolate this presentation module's own contract.
  for(const view of ['tools','notes','budget','currency','roadTrip','schengen','stayPlanner','rules','profiles','homes','settings','countries','journeys','planner']){
    await p.evaluate(view=>switchView(view),view);
    await p.waitForFunction(view=>document.body.dataset.currentView===view&&document.querySelector('.view.active')?.dataset.motionWorkspace===view,view);
    assert.equal(await p.locator('.view.active>.motion-workspace-caption').count(),1,view+' has one workspace introduction');
    assert.ok(await p.locator('.view.active :is(input,button,select,a,textarea)').count()>0,view+' retains useful controls');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' reflows without page overflow at '+width);
    assert.ok(await p.evaluate(()=>{const before=JSON.stringify(state);HVMotionWorkspaces.refresh();return before===JSON.stringify(state);}),view+' presentation does not change any source record');
    if(width===1440&&theme==='light'||width===390&&theme==='dark')await p.screenshot({path:path.join(out,`route-${view}-${width}-${theme}.png`)});
  }
  assert.deepEqual(p.errors,[]);await p.context().close();console.log(width+'px '+theme+': chapter index, explicit cover, place reader, statistics, transport, country and data preservation passed.');
 }
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

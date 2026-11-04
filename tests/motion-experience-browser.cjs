/* Fictional end-to-end checks for the kinetic personal atlas, without account writes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/candidate-browser.cjs');
const {candidateHistory}=require('./fixtures/v1-candidate.cjs');
const out=path.resolve(__dirname,'../test-results/motion-experience');fs.mkdirSync(out,{recursive:true});
const rotation=host=>host.evaluate(el=>({longitude:Number(el.dataset.longitude),latitude:Number(el.dataset.latitude),state:el.dataset.motionState}));
const geometry=host=>host.locator('.motion-globe-land').evaluateAll(nodes=>{let hash=2166136261;for(const node of nodes)for(const char of node.getAttribute('d')||''){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;});
const finiteRotation=value=>Number.isFinite(value.longitude)&&Number.isFinite(value.latitude);
async function tick(page,ms=700){await page.clock.runFor(ms);}
async function assertRecords(page,before,label){assert.equal(await page.evaluate(()=>JSON.stringify(state)),before.state,label);assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),before.stored,label+' (stored payload)');}

(async()=>{const h=await harness();try{
  for(const width of [1440,390])for(const theme of ['light','dark']){
    const page=await h.page(candidateHistory(),{width,height:width===390?844:900,theme,touch:width===390,route:'dashboard',time:'2026-11-17T12:00:00Z'});
    const host=page.locator('.v1-geography');
    await page.waitForSelector('.v1-geography[data-globe-ready="true"]');
    const before=await page.evaluate(()=>({state:JSON.stringify(state),stored:localStorage.getItem('whereIveBeen.data.v2')}));
    const initial=await rotation(host);assert.ok(finiteRotation(initial));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.experienceMotion),'off','System reduced motion takes precedence');
    const controls=host.locator('[data-globe-rotate]');assert.equal(await controls.count(),5,'Globe has explicit rotate/reset alternatives');
    const right=host.locator('[data-globe-rotate=right]');
    if(width===390)await right.tap();else await right.click();
    await tick(page,150);const stepped=await rotation(host);
    assert.notEqual(stepped.longitude,initial.longitude,'Explicit rotation remains usable with reduced motion');
    await host.locator('[data-globe-rotate=reset]').click();await tick(page,150);
    assert.ok(Math.abs((await rotation(host)).longitude-initial.longitude)<.1,'Reset returns the original orientation');
    await host.locator('[data-globe-rotate=left]').focus();await page.keyboard.press('Enter');await tick(page,150);
    assert.notEqual((await rotation(host)).longitude,initial.longitude,'Rotate controls work with a keyboard');
    if(width===1440){
      const svg=host.locator('svg').first(),box=await svg.boundingBox(),still=await rotation(host);
      await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2);await tick(page,300);
      assert.deepEqual(await rotation(host),still,'Reduced motion disables ambient pointer rotation');
      await page.mouse.move(0,0);
    }
    await assertRecords(page,before,'Globe controls never change travel records');

    const reader=page.locator('.home-hero [data-v1-read][data-record-id]').first();
    assert.ok(await reader.isVisible(),'Immediate travel detail is accessible from the scene');
    const action=await reader.evaluate(el=>({kind:el.dataset.v1Read,id:el.dataset.recordId}));
    await reader.click();await page.waitForSelector('.hv-v1-reader[open]');
    assert.equal(await page.locator('dialog[open] form').count(),0,'Scene action opens a reader before editing');
    assert.ok(page.url().includes('recordKind='+action.kind));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hv-v1-reader'));
    await tick(page,100);
    assert.equal(await page.evaluate(({kind,id})=>document.activeElement?.dataset.v1Read===kind&&document.activeElement?.dataset.recordId===id,action),true,'Closing returns focus to the scene action');
    await assertRecords(page,before,'Scene reading/Back preserves all records');

    if(width===1440){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForFunction(()=>document.documentElement.dataset.experienceMotion==='on');await tick(page,100);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.experienceMotion),'on');
      const bounds=await host.locator('svg').first().boundingBox();assert.ok(bounds&&bounds.width>0&&bounds.height>0);
      const start=await rotation(host),pathBefore=await geometry(host);
      await page.mouse.move(bounds.x+bounds.width*.35,bounds.y+bounds.height*.35);await tick(page,700);
      const tilted=await rotation(host);
      assert.ok(Math.abs(tilted.longitude-start.longitude)>1||Math.abs(tilted.latitude-start.latitude)>1,'Mouse position visibly changes globe orientation');
      assert.notEqual(await geometry(host),pathBefore,'Pointer motion updates rendered geography, not just a diagnostic attribute');
      await page.mouse.move(0,0);await tick(page,3000);
      assert.equal((await rotation(host)).state,'resting','Ambient pointer movement settles instead of rendering continuously');
      const svg=host.locator('svg').first(),box=await svg.boundingBox();
      assert.ok(box);
      await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await tick(page,200);
      const beforeDrag=await rotation(host);
      await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55,{steps:8});await page.mouse.up();await tick(page,1000);
      assert.ok(Math.abs((await rotation(host)).longitude-beforeDrag.longitude)>5,'Dragging rotates the globe without navigating or changing data');
      assert.equal(await page.evaluate(()=>document.body.dataset.currentView),'dashboard');
      await assertRecords(page,before,'Pointer movement and drag preserve source and stored records');
      const progressBefore=await page.locator('.motion-scene').evaluate(el=>Number(el.dataset.scrollProgress||0));
      // The no-preference theme enables CSS smooth scrolling. Native scroll and
      // IntersectionObserver delivery are not advanced by the synthetic clock.
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.waitForFunction(()=>document.querySelector('.v1-geography')?.getBoundingClientRect().bottom < -80);
      await page.waitForFunction(()=>document.querySelector('.v1-geography')?.dataset.motionState==='paused');
      assert.equal((await rotation(host)).state,'paused','Offscreen globe pauses');
      await page.waitForFunction(before=>Number(document.querySelector('.motion-scene')?.dataset.scrollProgress||0)>before,progressBefore);
      assert.ok(await page.locator('.motion-scene').evaluate(el=>Number(el.dataset.scrollProgress||0))>progressBefore,'Scrolling advances the scene composition');
      const paused=await rotation(host);await tick(page,500);assert.deepEqual(await rotation(host),paused,'An offscreen globe does not keep rotating');
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.waitForFunction(()=>{const globe=document.querySelector('.v1-geography'),box=globe?.getBoundingClientRect();return box&&box.bottom>0&&box.top<innerHeight&&globe.dataset.motionState!=='paused';});
      await page.evaluate(()=>switchView('settings'));await page.locator('#v1Motion').click();
      await page.evaluate(()=>switchView('dashboard'));await tick(page,200);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.experienceMotion),'off');
      const postcard=page.locator('.motion-postcard').first(),cardTransform=await postcard.evaluate(el=>getComputedStyle(el).transform);
      await postcard.hover();await tick(page,400);
      assert.equal(await postcard.evaluate(el=>getComputedStyle(el).transform),cardTransform,'Motion off prevents hover lift/rotation');
      const portal=page.locator('.v1-explore>a').first(),title=portal.locator('strong'),titleTransform=await title.evaluate(el=>getComputedStyle(el).transform);
      await portal.hover();await tick(page,400);
      assert.equal(await title.evaluate(el=>getComputedStyle(el).transform),titleTransform,'Motion off prevents portal movement');
      await page.waitForSelector('.v1-geography[data-globe-ready="true"]');
      const country=host.locator('.motion-globe-land.is-visited[tabindex="0"]').first(),code=await country.getAttribute('data-country-code');
      await country.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(code=>document.body.dataset.currentView==='map'&&document.getElementById('worldMap')?.dataset.selectedCountry===code,code);
      await assertRecords(page,before,'Globe country exploration is read-only');
      await page.goBack();await page.waitForFunction(()=>document.body.dataset.currentView==='dashboard');await tick(page,200);
    }
    await page.screenshot({path:path.join(out,`home-${width}-${theme}.png`)});
    assert.deepEqual(page.errors,[]);await page.context().close();
    console.log(`${width}px ${theme}: kinetic scene, explicit rotation, read/Back/focus, reduced motion and record preservation passed.`);
  }
  const empty=await h.page({version:2,activeProfileId:'empty',profiles:[{id:'empty',name:'New traveller'}],stays:[],trips:[],transports:[],accommodations:[]},{width:360,height:780,touch:true,route:'dashboard'});
  await empty.waitForSelector('.home-hero [data-plan-trip]');
  assert.ok(await empty.locator('.home-hero [data-plan-trip]').isVisible(),'No-history scene has a clear working start action');
  await empty.locator('.home-hero [data-plan-trip]').click();await empty.waitForSelector('#tripPlannerDialog[open]');
  assert.equal(await empty.evaluate(()=>state.trips.length),0,'Opening the planner creates no travel records');assert.deepEqual(empty.errors,[]);await empty.context().close();
  const replaced=await h.page(candidateHistory(),{route:'dashboard',time:'2026-11-17T12:00:00Z'});
  await replaced.waitForSelector('.motion-today-dock [data-record-id="guianas-flight"]');
  const stored=await replaced.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));
  await replaced.evaluate(()=>{const original=state.transports.find(r=>r.id==='guianas-flight');state.transports=state.transports.filter(r=>r.id!=='guianas-flight');state.transports.push({...original,id:'replacement-flight'});renderAll();});
  await replaced.waitForSelector('.motion-today-dock [data-record-id="replacement-flight"]');
  assert.equal(await replaced.locator('.motion-today-dock [data-record-id="guianas-flight"]').count(),0,'Same-looking records retain their actual stable identity in the dock');
  assert.equal(await replaced.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),stored,'Projection refresh does not save a changed fixture');
  assert.deepEqual(replaced.errors,[]);await replaced.context().close();
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

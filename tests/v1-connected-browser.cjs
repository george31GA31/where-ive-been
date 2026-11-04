'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./helpers/candidate-browser.cjs');
const {candidateHistory}=require('./fixtures/v1-candidate.cjs');
function history(){
  const data=candidateHistory();
  for(let i=0;i<160;i++)data.savedPlaces.push({id:'catalog-'+i,profileId:'p',place:{id:'source-'+i,name:'Fictional place '+i,address:i+' Field Lane',countryCode:i%2?'FR':'DK',countryName:i%2?'France':'Denmark'}});
  data.accommodations.find(r=>r.id==='next-month').place={id:'source-159',savedPlaceId:'catalog-159',name:'Fictional place 159',address:'159 Field Lane',countryCode:'FR'};
  data.accommodations.push({id:'different-identity',profileId:'p',propertyName:'Similar name, different ID',checkIn:'2026-10-20',checkOut:'2026-10-22',place:{id:'different-source',name:'Fictional place 159',countryCode:'FR'}});
  data.savedPlaces.push({id:'secret',profileId:'p2',place:{id:'secret-source',name:'Other traveller private place',countryCode:'FR'}});
  data.stays.push({id:'year-visit',profileId:'p',countryCode:'FR',countryName:'France',start:'2025-06-01',end:'2025-06-03',status:'actual'});
  data.accommodations.push({id:'year-hotel',profileId:'p',propertyName:'Fictional 2025 hotel',checkIn:'2025-06-01',checkOut:'2025-06-03',place:{id:'year-source',countryCode:'FR'}});
  data.manualCountryVisits.push({id:'manual-year',profileId:'p',countryCode:'NZ',year:2024,visited:true});
  return data;
}
(async()=>{const h=await harness();try{
 for(const width of [1440,390])for(const theme of ['light','dark']){
  const page=await h.page(history(),{width,height:900,theme,touch:width<500,route:'dashboard'});
  await page.waitForFunction(()=>!!window.HVV1Readers);
  const initial=await page.evaluate(()=>JSON.stringify(state));
  await page.locator('#todayAgenda [data-agenda-hotel="next-month"]').click();
  await page.waitForSelector('.hv-v1-reader[open]');
  assert.match(await page.locator('.hv-v1-reader').innerText(),/Olive Grove Apartments/);
  assert.equal(await page.locator('dialog[open] form').count(),0,'Reading never opens an edit form');
  assert.match(page.url(),/recordKind=accommodation/);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hv-v1-reader'));
  await page.waitForFunction(()=>document.activeElement.dataset.agendaHotel==='next-month');
  await page.locator('#todayAgenda [data-agenda-hotel="next-month"]').click();
  await page.goBack();await page.waitForFunction(()=>!document.querySelector('.hv-v1-reader'));
  assert.equal(await page.evaluate(()=>document.body.dataset.currentView),'dashboard');
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),initial,'Reader open/Back leaves all records unchanged');
  for(const [kind,id,title] of [['transport','alg-tun','Transport'],['note','important-date','Apply for visa'],['country','tunisia','Tunisia']]){
   await page.evaluate(({kind,id})=>HVV1Readers.open(kind,id),{kind,id});assert.match(await page.locator('.hv-v1-reader').innerText(),new RegExp(title,'i'));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!location.hash.includes('recordKind='));
  }
  await page.evaluate(()=>HVV1Readers.open('accommodation','next-month'));await page.locator('[data-v1-edit=accommodation]').click();
  const editor=page.locator('dialog[open].place-search-dialog[aria-label="Accommodation"]');
  await editor.waitFor({state:'visible'});assert.equal(await editor.locator('.place-search-heading h3').innerText(),'Edit stay','Explicit Edit opens the existing accommodation editor');
  assert.equal(await editor.locator('[name=date]').inputValue(),'2026-10-19');assert.equal(await editor.locator('[name=endDate]').inputValue(),'2026-11-03');
  assert.equal(await page.locator('.hv-v1-reader').count(),0);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),initial,'Cancelling the explicit editor preserves every field');

  await page.evaluate(()=>switchView('places'));
  assert.ok(await page.locator('[data-saved-place-id]').count()<=40);
  await page.locator('[data-place-search]').fill('159 Field Lane');
  assert.equal(await page.locator('[data-saved-place-id]').count(),1);
  await page.locator('[data-v1-read=saved]').click();
  assert.match(await page.locator('.hv-v1-reader').innerText(),/Olive Grove Apartments/);
  assert.doesNotMatch(await page.locator('.hv-v1-reader').innerText(),/Similar name, different ID|Other traveller/);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hv-v1-reader'));
  assert.equal(await page.locator('[data-place-search]').inputValue(),'159 Field Lane');
  await page.locator('[data-place-search]').fill('France');assert.equal(await page.locator('[data-saved-place-id]').count(),40);
  await page.locator('[data-place-results-page="1"]').click();assert.equal(await page.locator('[data-saved-place-id]').count(),40);
  await page.locator('[data-place-search]').fill('not a recorded address');assert.equal(await page.locator('[data-saved-place-id]').count(),0);
  await page.locator('[data-clear-place-search]').click();assert.ok(await page.locator('[data-saved-place-id]').count()<=40);

  await page.evaluate(()=>switchView('stats'));await page.locator('[data-year-scope]').selectOption('2025');
  assert.match(await page.locator('.hv-year-table').innerText(),/France/);
  await page.locator('[data-history-country=FR]').click();
  assert.match(await page.locator('.hv-year-records').innerText(),/Fictional 2025 hotel/);
  await page.locator('.hv-year-records [data-v1-read=accommodation]').click();await page.goBack();
  assert.equal(await page.locator('[data-year-scope]').inputValue(),'2025');
  await page.locator('[data-year-scope]').selectOption('2024');await page.locator('[data-history-country=NZ]').click();
  assert.match(await page.locator('.hv-year-records').innerText(),/Manual visit · 2024 · exact dates not recorded/);

  await page.evaluate(()=>{location.hash='#/trips?trip=south';});await page.waitForSelector('dialog[open][data-trip-id=south]');
  await page.locator('#tripOverviewTab').focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#tripItineraryTab').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#tripOverviewTab').getAttribute('tabindex'),'-1');
  await page.locator('[data-trip-day="0"] summary').click();await page.waitForSelector('[data-trip-day="0"] [data-v1-read=accommodation]');
  await page.locator('[data-trip-day="0"] [data-v1-read=accommodation]').click();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.hv-v1-reader'));
  assert.ok(await page.locator('dialog[open][data-trip-id=south]').isVisible());
  await page.keyboard.press('Escape');

  await page.evaluate(()=>switchView('transport'));await page.waitForSelector('[data-transport-select]');
  if(width<500){assert.equal(await page.locator('.transport-map-pane').isVisible(),false);assert.ok(await page.locator('.transport-panel').isVisible());await page.locator('[data-transport-map-toggle]').click();assert.ok(await page.locator('.transport-map-pane').isVisible());assert.ok(await page.locator('.transport-map-pane').evaluate(n=>n.getBoundingClientRect().top)>await page.locator('.transport-panel').evaluate(n=>n.getBoundingClientRect().top));}
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),initial,'All retrieval and navigation remains read-only');
  assert.deepEqual(page.errors,[]);await page.context().close();
 }
 const direct=await h.page(history(),{route:'places?recordKind=saved&recordId=catalog-159'});await direct.waitForSelector('.hv-v1-reader[open]');assert.match(await direct.locator('.hv-v1-reader').innerText(),/159 Field Lane/);await direct.keyboard.press('Escape');await direct.waitForFunction(()=>!location.hash.includes('recordKind='));assert.match(direct.url(),/#\/places$/);
 await direct.evaluate(()=>{HVV1Readers.open('saved','catalog-159');state.activeProfileId='p2';renderAll();});assert.equal(await direct.locator('.hv-v1-reader').count(),0,'Traveller switch closes retained private context');assert.equal(await direct.evaluate(()=>HVV1Readers.open('saved','catalog-159')),false,'Another traveller cannot reopen a private record by ID');assert.deepEqual(direct.errors,[]);await direct.context().close();
 console.log('Connected reading: 1440/390 light/dark, read-before-edit/cancel, native Back/focus, direct deep links, exact place links, 160-place bounded search, year/manual precision, trip tabs/nested reader and phone map disclosure passed.');
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

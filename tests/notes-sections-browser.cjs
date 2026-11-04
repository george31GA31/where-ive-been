'use strict';
const assert=require('node:assert/strict'),{harness}=require('./helpers/candidate-browser.cjs'),{calendarHistory}=require('./fixtures/calendar-chronology.cjs');
(async()=>{const h=await harness();try{
 for(const width of [1440,390])for(const theme of ['light','dark']){
  const seed=calendarHistory();
  seed.trips.push({id:'note-range-trip',profileId:'p',name:'Field note journey',start:'2026-11-29',end:'2026-12-07'});
  seed.notes.push({id:'ranged-note',profileId:'p',tripId:'note-range-trip',title:'Existing field note',date:'2026-11-29',endDate:'2026-12-07',body:'Original body',category:'Custom category',custom:{preserve:true}});
  seed.checklists.push({id:'section-list',profileId:'p',title:'Travel preparation',sections:[{id:'papers',name:'Papers',custom:{preserve:true}},{id:'bag',name:'Bag'},{id:'later',name:'Later'}],items:[{id:'passport',sectionId:'papers',text:'Passport',done:true,completedAt:'2026-10-01T12:00:00Z',order:0,custom:{preserve:true}},{id:'ticket',sectionId:'papers',text:'Ticket',done:false,order:1},{id:'coat',sectionId:'bag',text:'Coat',done:false,order:0}],custom:{preserve:true}});
  const page=await h.page(seed,{width,theme,touch:width===390,route:'travel-tools/notes',timezoneId:'America/Los_Angeles'});
  const form=()=>page.locator('dialog[open] .travel-note-form');
  const beforeNote=await page.evaluate(()=>structuredClone(state.notes.find(n=>n.id==='ranged-note')));
  await page.evaluate(()=>HVTravelTools.openNote(state.notes.find(n=>n.id==='ranged-note')));
  assert.equal(await form().locator('[name=date]').inputValue(),'2026-11-29');assert.equal(await form().locator('[name=endDate]').inputValue(),'2026-12-07');
  assert.equal(await form().locator('[name=category]').inputValue(),'Custom category');
  await form().locator('[name=body]').fill('Updated field note');await form().locator('button.primary').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const afterNote=await page.evaluate(()=>structuredClone(state.notes.find(n=>n.id==='ranged-note')));delete afterNote.updatedAt;afterNote.body=beforeNote.body;assert.deepEqual(afterNote,beforeNote,'Body edit preserves date range, identity, custom category and unknown fields');
  assert.deepEqual(await page.evaluate(()=>HVCalendar.projectDays('2026-11-29',10,'note-range-trip').map(day=>day.notes.some(note=>note.id==='ranged-note'))),[true,true,true,true,true,true,true,true,true,false],'Itinerary and Calendar share inclusive note projection');
  await page.evaluate(()=>{switchView('dashboard');HVDailyAgenda.render('2026-12-01');});
  assert.match(await page.locator('#todayAgenda').innerText(),/Existing field note/);assert.match(await page.locator('#tomorrowAgenda').innerText(),/Existing field note/);
  await page.evaluate(()=>HVTrips.show('note-range-trip'));const trip=page.locator('dialog[open][data-trip-id="note-range-trip"]');
  await trip.locator('[data-trip-tab=itinerary]').click();await trip.locator('[data-trip-day="2"]>summary').click();await trip.locator('[data-trip-day="2"] .trip-day-record').first().waitFor();assert.match(await trip.locator('[data-trip-day="2"]').innerText(),/Existing field note/);await trip.locator('[data-close]').click();
  await page.evaluate(()=>switchView('notes'));
  const beforeInvalid=await page.evaluate(()=>JSON.stringify(state));
  await page.evaluate(()=>HVTravelActions.add('note',{start:'2026-11-29',end:'2026-12-07'}));
  assert.equal(await form().locator('[name=date]').inputValue(),'2026-11-29');assert.equal(await form().locator('[name=endDate]').inputValue(),'2026-12-07','Calendar selected range reaches the existing note editor');
  await form().locator('[name=title]').fill('Travel-day reminder');await form().locator('[name=endDate]').fill('2026-11-28');await form().locator('button.primary').click();
  assert.match(await form().locator('[role=alert]').innerText(),/end date on or after/);assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeInvalid);
  await form().locator('[name=endDate]').fill('');await form().locator('button.primary').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(()=>state.notes.at(-1).date),'2026-11-29');assert.equal(await page.evaluate(()=>state.notes.at(-1).endDate),null,'Clearing end chooses a single day');

  const card=page.locator('[data-checklist="section-list"]');
  const originalList=await page.evaluate(()=>structuredClone(state.checklists.find(c=>c.id==='section-list')));
  await card.locator('[data-section-manage=papers]').click();
  let editor=page.locator('dialog[open][aria-label="Edit checklist section"]');
  await editor.locator('[name=name]').fill('Departure papers');await editor.locator('[name=position]').selectOption('1');await editor.locator('[type=submit]').click();
  let current=await page.evaluate(()=>structuredClone(state.checklists.find(c=>c.id==='section-list')));
  assert.deepEqual(current.sections.map(s=>s.id),['bag','papers','later']);assert.equal(current.sections[1].name,'Departure papers');assert.deepEqual(current.items,originalList.items,'Section rename/reorder leaves every item exactly intact');assert.deepEqual(current.sections[1].custom,originalList.sections[0].custom);
  await card.locator('[data-section-manage=papers]').click();editor=page.locator('dialog[open][aria-label="Edit checklist section"]');
  const beforeRemove=await page.evaluate(()=>JSON.stringify(state));await editor.locator('details>summary').click();await editor.locator('[data-remove-section]').click();assert.match(await editor.locator('[role=alert]').innerText(),/Choose another section/);assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeRemove,'No destination means no deletion');
  await editor.locator('[name=destination]').selectOption('bag');await editor.locator('[data-remove-section]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  current=await page.evaluate(()=>structuredClone(state.checklists.find(c=>c.id==='section-list')));assert.deepEqual(current.sections.map(s=>s.id),['bag','later']);assert.deepEqual(current.items.map(i=>i.id),originalList.items.map(i=>i.id));
  for(const item of current.items){const expected=originalList.items.find(i=>i.id===item.id);if(expected.sectionId==='papers'){assert.equal(item.sectionId,'bag');assert.ok(item.order>0);const compare={...item,sectionId:expected.sectionId,order:expected.order};assert.deepEqual(compare,expected);}else assert.deepEqual(item,expected);}
  await card.locator('[data-section-manage=bag]').click();editor=page.locator('dialog[open][aria-label="Edit checklist section"]');
  const beforeFailedSave=await page.evaluate(()=>JSON.stringify(state));await editor.locator('[name=name]').fill('Unsaved draft name');await page.evaluate(()=>{window.sectionTestPersist=persist;persist=()=>false;});await editor.locator('[type=submit]').click();assert.match(await editor.locator('[role=alert]').innerText(),/could not be saved/);assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeFailedSave,'Failed persistence rolls back section state');assert.equal(await editor.locator('[name=name]').inputValue(),'Unsaved draft name');await page.evaluate(()=>{persist=window.sectionTestPersist;delete window.sectionTestPersist;});await editor.locator('[data-close]').last().click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(page.errors,[]);await page.context().close();console.log(`${width}px ${theme}: ranged notes, one-day override, section rename/order, explicit item reassignment and failed-save preservation passed.`);
 }
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

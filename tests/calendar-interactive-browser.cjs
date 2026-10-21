/* Interaction, layout and preservation checks use isolated fictional travel history. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const {calendarHistory}=require('./fixtures/calendar-chronology.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/calendar-interactive');fs.mkdirSync(out,{recursive:true});
const seed=calendarHistory();
seed.stays.push({id:'old-tunisia',profileId:'p',countryCode:'TN',countryName:'Tunisia',start:'2021-05-01',end:'2021-05-03',status:'actual'});
seed.stays.push({id:'pakistan',profileId:'p',countryCode:'PK',countryName:'Pakistan',start:'2026-10-30',end:'2026-10-31',status:'planned'});
seed.notes.push({id:'vaccination',profileId:'p',title:'Get yellow fever vaccination',body:'Bring the passport and keep the certificate.',date:'2026-10-15',relatedType:'country',relatedId:'tunisia',tripId:'africa'});
seed.accommodations.find(a=>a.id==='house').checkInTime='15:00';seed.accommodations.find(a=>a.id==='house').checkOutTime='10:00';
seed.transports.find(t=>t.id==='alg-tun').start.timeZone='Africa/Algiers';seed.transports.find(t=>t.id==='alg-tun').end.timeZone='Africa/Tunis';
seed.transports.push({id:'date-line',profileId:'p',type:'flight',start:{iata:'AKL',name:'Auckland',timeZone:'Pacific/Auckland'},end:{iata:'PPT',name:'Papeete',timeZone:'Pacific/Tahiti'},startLocal:'2026-10-20T19:00',endLocal:'2026-10-20T01:00',status:'planned'}, {id:'overnight',profileId:'p',type:'train',start:{name:'Rome',timeZone:'Europe/Rome'},end:{name:'Milan',timeZone:'Europe/Rome'},startLocal:'2026-10-26T23:30',endLocal:'2026-10-27T07:00',status:'planned'}, {id:'partial-time',profileId:'p',type:'train',start:{name:'Rome',timeZone:'Europe/Rome'},end:{name:'Milan',timeZone:'Europe/Rome'},startLocal:'2026-10-24T12:00',endLocal:'',status:'planned'});
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!path.extname(file))file=path.join(file,'index.html');try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;const timings=[];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 for(const width of (process.env.HV_INTERACTIVE_WIDTHS||'1440,1024,768,390,360').split(',').map(Number))for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=390,reducedMotion:'reduce',serviceWorkers:'block',timezoneId:width<=390?'Australia/Sydney':'Europe/London'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.addInitScript(({seed,theme})=>{localStorage.setItem('herald.calendar.view.v1','month');if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('herald.calendar.view.v1','month');localStorage.setItem('whereIveBeen.theme.v1',theme);},{seed,theme});
  await page.goto(origin+'/#/calendar');await page.waitForFunction(()=>window.HVCalendarDetails&&window.HVCalendar?.ready&&!document.querySelector('.app-shell').inert);
  await page.locator('[data-calendar-select-range]').click();await page.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();scrollTo(0,0);});
  const initial=await page.evaluate(()=>JSON.stringify(state)),stored=await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));
  const cell=date=>page.locator(`.calendar-day[data-calendar-date="2026-10-${date}"]`),drawer=page.locator('#calendarJourneyDetail');
  const close=async()=>{await drawer.locator('[data-calendar-close-date]').click();await page.mouse.move(0,0);await page.evaluate(()=>HVCalendarDetails.hide());};
  assert.deepEqual(await page.locator('[data-calendar-layer]').allTextContents(),['▏Countries','⌂Accommodation','Transport','✎Notes','◎Locations']);
  const geometry=await page.evaluate(()=>{
   const days=[...document.querySelectorAll('#calendar .calendar-day')];
   return {overflow:document.documentElement.scrollWidth-innerWidth,top:document.getElementById('calendar').getBoundingClientRect().top,lanes:days.map(day=>{
    const box=day.getBoundingClientRect();return ['.calendar-countries','.calendar-lodging,.calendar-lodging-space','.calendar-transports'].map(selector=>day.querySelector(selector).getBoundingClientRect().top-box.top);
   })};
  });
  assert.ok(geometry.overflow<=1,'No horizontal page overflow');
  assert.ok(geometry.top<(width>=1024?390:430),'Calendar starts near the top');
  for(const lanes of geometry.lanes){assert.ok(lanes[0]<=lanes[1]&&lanes[1]<=lanes[2],'Country, accommodation, transport hierarchy');}
  const accentWidths=await page.locator('#calendar .calendar-journey-chip').evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).borderLeftWidth))]);assert.equal(accentWidths.length,1,'Country accent width stays consistent for single and multiple countries');
  const split=await cell('14').locator('.calendar-country-section').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));assert.equal(split.length,2);assert.ok(Math.abs(split[0].width-split[1].width)<1);assert.ok(Math.abs(split[0].height-split[1].height)<1);
  const hotels=await cell('10').locator('.calendar-lodging-half').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.calendarEditAccommodation,...n.getBoundingClientRect().toJSON()})));assert.deepEqual(hotels.map(h=>h.id),['first','second']);assert.ok(Math.abs(hotels[0].width-hotels[1].width)<1);
  const accent=await cell('15').locator('.calendar-journey-chip.is-schengen').first().evaluate(n=>({shadow:getComputedStyle(n).boxShadow,border:getComputedStyle(n).borderLeftColor,blue:getComputedStyle(document.getElementById('calendarView')).getPropertyValue('--calendar-schengen-blue').trim()}));assert.equal(accent.shadow,'none');assert.ok(accent.border!=='rgb(132, 153, 158)');
  assert.match(await cell('12').locator('.calendar-note-chip').innerText(),/Apply for visa/);assert.match(await cell('15').locator('.calendar-note-chip').innerText(),/Get yellow fever vaccination/);
  await page.screenshot({path:path.join(out,`month-${width}-${theme}.png`)});
  await cell('15').locator('[data-calendar-day-detail]').scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await cell('15').locator('[data-calendar-day-detail]').click();assert.ok(await drawer.isVisible());assert.equal(await page.evaluate(()=>scrollY),scroll,'Explorer does not scroll the month');
  const text=await drawer.innerText();assert.doesNotMatch(text,/Other traveller accommodation|Cancelled accommodation/);for(const wanted of ['Tunisia','France','Switzerland','Slovenia','Spain','Germany','House sit in Tunis','TUN → MLA','Tunis → Sfax','Sfax → El Jem','Get yellow fever vaccination','Roman theatre'])assert.ok(text.includes(wanted),'Day Explorer includes '+wanted);
  const headings=await drawer.locator('.calendar-explorer-section>h3').allTextContents();assert.match(headings[0],/Countries/);assert.match(headings[1],/Accommodation/);assert.match(headings[2],/Transport/);assert.match(headings[3],/Notes/);assert.match(headings[4],/Locations/);
  await page.screenshot({path:path.join(out,`day-${width}-${theme}.png`)});
  await drawer.locator('[data-calendar-entry=accommodation]').click();assert.equal(await drawer.evaluate(el=>el.scrollTop),0,'Entry details start at the heading after scrolling a busy day');assert.match(await drawer.innerText(),/5 nights/);assert.match(await drawer.innerText(),/15:00 local/);await drawer.locator('[data-calendar-back-day]').click();assert.match(await drawer.innerText(),/Roman theatre/);await close();
  await cell('17').locator('[data-calendar-entry=country]').click();assert.match(await drawer.innerText(),/14 Oct 2026/);assert.doesNotMatch(await drawer.innerText(),/1 May 2021/);await page.screenshot({path:path.join(out,`country-${width}-${theme}.png`)});await close();
  await cell('14').locator('[data-calendar-entry=transport]').click();assert.match(await drawer.innerText(),/ALG.*TUN/s);assert.match(await drawer.innerText(),/2h 0m/);await drawer.locator('[data-calendar-edit-transport=alg-tun]').click();await page.locator('#transportForm').waitFor();assert.equal(await page.locator('#transportForm [name=bookingReference]').inputValue(),'KEEP-FLIGHT');await page.locator('[data-close-transport]').first().click();await close();
  await cell('30').locator('[data-calendar-edit-country=pakistan] img').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-calendar-edit-country=pakistan] img').complete);assert.ok(await cell('30').locator('[data-calendar-edit-country=pakistan] img').evaluate(n=>n.naturalWidth>0),'Pakistan flag loads');
  if(width>=768){
   const entry=cell('10').locator('[data-calendar-entry-id=second]');await entry.scrollIntoViewIfNeeded();await entry.hover();await page.clock.runFor(160);
   const preview=page.locator('#calendarFloatingDetail');await preview.waitFor();assert.match(await preview.innerText(),/4 nights/);assert.ok(await page.locator('#calendar .calendar-linked-entry').count()>=4);
   await preview.screenshot({path:path.join(out,`preview-${width}-${theme}.png`)});const bounds=await preview.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=1001,'Preview is inside the viewport');
   await preview.hover();await page.clock.runFor(250);assert.ok(await preview.isVisible(),'Preview stays open when pointer enters it');await preview.locator('[data-calendar-entry]').click();assert.ok(await drawer.isVisible());await close();
   await page.locator('#calendarMonthJump').focus();await entry.focus();await preview.waitFor();await page.keyboard.press('Escape');assert.ok(await preview.isHidden());assert.ok(await drawer.isHidden());
  }
  if(!await page.locator('[data-calendar-layer=countries]').isVisible())await page.locator('.calendar-filter-menu>summary').click();await page.locator('[data-calendar-layer=transport]').click();assert.equal(await page.locator('#calendar .calendar-day-transport').count(),0);await page.locator('[data-calendar-show-all]').click();assert.ok(await page.locator('#calendar .calendar-day-transport').count()>0);
  if(!await page.locator('[data-calendar-layer=countries]').isVisible())await page.locator('.calendar-filter-menu>summary').click();await page.locator('[data-calendar-layer=notes]').click({modifiers:['Shift']});assert.equal(await page.locator('#calendar .calendar-lodging').count(),0);assert.ok(await page.locator('#calendar .calendar-note-chip').count()>0);await page.locator('[data-calendar-show-all]').click();
  await page.locator('[data-calendar-select-range]').click();await cell('10').locator('.day-number').click();await cell('12').locator('.day-number').click();assert.equal(await page.locator('.selection-range').count(),3);assert.match(await drawer.innerText(),/DATE RANGE/);await close();await page.locator('[data-calendar-select-range]').click();
  await page.locator('[data-calendar-search-toggle]').click();await page.locator('#calendarSearchInput').fill('old impossible match');assert.match(await page.locator('#calendarSearchResults').innerText(),/0 matches/);await page.locator('#calendarSearchInput').fill('Tunisia');await page.locator('[data-calendar-search-result-date="2021-05-01"]').click();assert.equal(await page.locator('#calendarYearJump').inputValue(),'2021');assert.match(await drawer.innerText(),/1 May 2021/);await close();await page.locator('[data-calendar-search-toggle]').click();
  await page.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),initial,'Exploration, search, filters and cancelled edits preserve all state');assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),stored,'Presentation writes no account payload');
  if((width===1440&&theme==='light')||(width===390&&theme==='dark')){
   await cell('18').locator('.day-number').click();await drawer.locator('.calendar-add-menu>summary').click();await drawer.locator('[data-calendar-date-action=note]').click();
   let form=page.locator('.travel-note-form');assert.equal(await form.locator('[name=date]').inputValue(),'2026-10-18');await form.locator('[name=title]').fill('Apply for Suriname visa');await form.locator('[name=body]').fill('Use the saved passport details.');await form.locator('button.primary').click();await form.waitFor({state:'hidden'});
   const id=await page.evaluate(()=>state.notes.find(n=>n.title==='Apply for Suriname visa').id);assert.match(await cell('18').locator('.calendar-note-chip').innerText(),/Apply for Suriname visa/);await close();
   await cell('18').locator('.calendar-note-chip').click();await drawer.locator('[data-day-note-edit]').click();form=page.locator('.travel-note-form');await form.locator('[name=date]').fill('2026-10-19');await form.locator('[name=title]').fill('Submit Suriname visa');await form.locator('button.primary').click();await form.waitFor({state:'hidden'});assert.equal(await cell('18').locator('.calendar-note-chip').count(),0);assert.match(await cell('19').locator('.calendar-note-chip').innerText(),/Submit Suriname visa/);await close();
   await page.evaluate(()=>switchView('notes'));assert.match(await page.locator('#travelNotesList').innerText(),/Submit Suriname visa/);await page.reload();await page.waitForFunction(()=>window.HVCalendarDetails&&window.HVCalendar?.ready);assert.equal(await page.evaluate(id=>state.notes.find(n=>n.id===id).date,id),'2026-10-19');await page.evaluate(()=>{switchView('calendar');calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();});
   await cell('19').locator('.calendar-note-chip').click();await drawer.locator('[data-day-note-edit]').click();await page.locator('.travel-note-form [data-delete]').click();await page.locator('.travel-note-form').waitFor({state:'hidden'});assert.equal(await page.evaluate(id=>state.notes.filter(n=>n.id===id).length,id),0);assert.equal(await cell('19').locator('.calendar-note-chip').count(),0);await page.evaluate(()=>HVCalendar.clearSelection());
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),initial,'Note creation, movement and deletion leave every pre-existing record unchanged');
  }
  if(width===1440&&theme==='light'){
   await cell('20').locator('[data-calendar-entry-id=date-line]').click();assert.match(await drawer.innerText(),/5h 0m/);await close();
   await cell('27').locator('[data-calendar-entry-id=overnight]').click();assert.match(await drawer.innerText(),/7h 30m/);assert.match(await drawer.innerText(),/26 Oct 2026/);assert.match(await drawer.innerText(),/27 Oct 2026/);await close();
   await cell('24').locator('[data-calendar-entry-id=partial-time]').click();assert.doesNotMatch(await drawer.innerText(),/0h 0m/);await close();
   const before=await page.evaluate(()=>({others:JSON.stringify(state.accommodations.filter(a=>a.id!=='second')),hotel:structuredClone(state.accommodations.find(a=>a.id==='second')),routes:JSON.stringify(state.transports)}));
   await cell('10').locator('[data-calendar-entry-id=second]').click();await drawer.locator('[data-calendar-edit-accommodation=second]').click();await page.locator('dialog[open] [name=checkOut]').fill('2026-10-15');await page.locator('dialog[open] button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('.accommodation-dialog-card'));
   const after=await page.evaluate(()=>({others:JSON.stringify(state.accommodations.filter(a=>a.id!=='second')),hotel:structuredClone(state.accommodations.find(a=>a.id==='second')),routes:JSON.stringify(state.transports)}));
   assert.equal(after.hotel.id,before.hotel.id);assert.equal(after.hotel.checkOut,'2026-10-15');assert.equal(after.hotel.bookingReference,before.hotel.bookingReference);assert.equal(after.hotel.notes,before.hotel.notes);assert.equal(after.others,before.others);assert.equal(after.routes,before.routes);await close();
   await cell('15').locator('[data-calendar-day-detail]').click();assert.match(await drawer.innerText(),/Hôtel Belvédère Fourati/);await close();
   await page.reload();await page.waitForFunction(()=>window.HVCalendarDetails);assert.equal(await page.evaluate(()=>state.accommodations.find(a=>a.id==='second').checkOut),'2026-10-15');
  }
  const measures=await page.evaluate(async()=>{const rows=[];for(const key of ['nextMonth','prevMonth']){const start=performance.now();document.getElementById(key).click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));rows.push({action:key,ms:Math.round(performance.now()-start)});}return rows;});timings.push({width,theme,measures});assert.deepEqual(errors,[]);await context.close();console.log(`${width}px ${theme}: hierarchy, previews, explorer, filters, ranges, search and preservation passed.`);
 }
 fs.writeFileSync(path.join(out,'timings.json'),JSON.stringify(timings,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

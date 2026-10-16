/* Layout and chronology use isolated, fictional history. No production account access. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const {calendarHistory}=require('./fixtures/calendar-chronology.cjs');
const root=path.resolve(process.env.HV_ROOT||path.join(__dirname,'..')),baseline=!!process.env.HV_TIMELINE_BASELINE,layoutOnly=!!process.env.HV_TIMELINE_LAYOUT;
const out=path.resolve(process.env.HV_TIMELINE_OUTPUT||path.join(__dirname,'../test-results/calendar-chronology'));fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!path.extname(file))file=path.join(file,'index.html');try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser;const reports=[];
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  for(const width of (process.env.HV_TIMELINE_WIDTHS||'1920,1440,1280,1024,768,390,360').split(',').map(Number))for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=390,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
    await context.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();return route.abort();});
    await page.addInitScript(({data,theme})=>{localStorage.setItem('whereIveBeen.theme.v1',theme);localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(data));},{data:calendarHistory(),theme});
    await page.goto(origin+'/#/calendar');await page.waitForFunction(()=>window.HVCalendar?.ready&&window.HVCalendarDetails&&!document.querySelector('.app-shell').inert);
    await page.evaluate(()=>{calendarCursor=new Date(Date.UTC(2026,9,1));renderCalendar();window.scrollTo(0,0);});
    const unchanged=await page.evaluate(()=>JSON.stringify(state)),stored=await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2'));
    const cell=date=>page.locator('.calendar-day[data-calendar-date="'+date+'"]');
    const geometry=await page.evaluate(()=>({top:document.getElementById('calendar').getBoundingClientRect().top,width:document.getElementById('calendar').getBoundingClientRect().width,panel:document.querySelector('.calendar-layout').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth,cellWidth:document.querySelector('.calendar-day').getBoundingClientRect().width,drawerHidden:document.getElementById('calendarJourneyDetail').hidden}));
    reports.push({viewport:width,theme,...geometry});await page.screenshot({path:path.join(out,`calendar-${width}-${theme}.png`)});await page.locator('#calendar').screenshot({path:path.join(out,`grid-${width}-${theme}.png`)});
    if(!baseline){
      assert.ok(geometry.overflow<=1,'No horizontal overflow');assert.ok(geometry.panel-geometry.width<=2,'Month occupies the complete layout width');assert.ok(geometry.drawerHidden,'No default sidebar');assert.ok(geometry.top<(width>=1024?330:width>=650?390:430),'Calendar begins near the top');
      assert.equal(await page.locator('#calendarView').getByText('YOUR MONTH',{exact:true}).count(),0);
      await cell('2026-10-10').locator('.day-number').click();await cell('2026-10-12').locator('.day-number').click();assert.equal(await page.locator('.selection-range').count(),3);assert.ok(await page.locator('#calendarJourneyDetail').isVisible());await page.locator('[data-calendar-close-date]').click();assert.ok(await page.locator('#calendarJourneyDetail').isHidden());
      await page.getByRole('button',{name:'Year overview',exact:true}).click();assert.equal(await page.locator('.atlas-month').count(),12);assert.ok(await page.locator('#calendar').isHidden(),'Year overview replaces the month grid');assert.ok(await page.locator('#calendarJourneyDetail').isHidden());await page.getByRole('button',{name:'Next year',exact:true}).click();assert.equal(await page.locator('#calendarYearJump').inputValue(),'2027');await page.getByRole('button',{name:'Month',exact:true}).click();await page.getByRole('button',{name:'Today',exact:true}).click();
    }
    if(!baseline&&!layoutOnly){
      const halves=cell('2026-10-10').locator('.calendar-lodging-half');assert.equal(await halves.count(),2);
      const split=await halves.evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.calendarEditAccommodation,...n.getBoundingClientRect().toJSON()})));assert.deepEqual(split.map(n=>n.id),['first','second']);assert.ok(Math.abs(split[0].y-split[1].y)<1);assert.ok(Math.abs(split[0].width-split[1].width)<1);assert.ok(split[0].right<=split[1].left+1);
      const aligned=await page.locator('.calendar-day').evaluateAll(nodes=>nodes.map(n=>({cell:n.getBoundingClientRect(),lane:n.querySelector('.calendar-lodging')?.getBoundingClientRect()})).filter(n=>n.lane));const weekOffsets=new Map();for(const row of aligned){const key=row.cell.top,offset=row.lane.top-row.cell.top;if(weekOffsets.has(key))assert.ok(Math.abs(weekOffsets.get(key)-offset)<1,'Accommodation lanes align despite different countries and transport');weekOffsets.set(key,offset);}
      for(const date of ['2026-10-11','2026-10-12','2026-10-13'])assert.ok(await cell(date).locator('[data-calendar-edit-accommodation=second]').isVisible(),'Stays cross week boundaries');
      await cell('2026-10-23').locator('[data-calendar-day-detail]').click();for(const name of ['Olive Grove Apartments','Parallel hostel','Parallel guesthouse'])assert.match(await page.locator('#calendarJourneyDetail').innerText(),new RegExp(name));await page.locator('[data-calendar-close-date]').click();
      await cell('2026-10-10').locator('[data-calendar-edit-accommodation=second]').click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('dialog[open] [name=propertyName]').inputValue(),'Hôtel Belvédère Fourati');await page.locator('[data-accommodation-close]').first().click();
      await cell('2026-10-14').locator('[data-calendar-edit-transport=alg-tun]').click();await page.locator('#transportForm').waitFor();assert.equal(await page.locator('#transportForm [name=bookingReference]').inputValue(),'KEEP-FLIGHT');await page.locator('[data-close-transport]').first().click();
      await cell('2026-10-12').locator('.day-number').focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#calendarJourneyDetail').isVisible());await page.keyboard.press('Escape');assert.ok(await page.locator('#calendarJourneyDetail').isHidden());
      await page.locator('#nextMonth').click();assert.ok(await cell('2026-11-02').locator('[data-calendar-edit-accommodation=next-month]').isVisible());await page.locator('#prevMonth').click();
      await page.locator('#nextMonth').click();await page.evaluate(()=>switchView('dashboard'));await page.locator('#homeMonthSummary').waitFor();assert.match(await page.locator('#homeMonthSummary').innerText(),/October 2026/);assert.match(await page.locator('#homeMonthSummary').innerText(),/2 journeys/);assert.ok(await page.locator('#recentStays .edit-btn').count()>0,'Existing stay editing remains');await page.locator('#homeUpcomingTravel summary').click();assert.match(await page.locator('#homeUpcomingTravel').innerText(),/Malta in November/);assert.match(await page.locator('#homeUpcomingTravel').innerText(),/ALG.*TUN/);assert.match(await page.locator('#homeUpcomingTravel').innerText(),/Apply for visa/);assert.doesNotMatch(await page.locator('#homeUpcomingTravel').innerText(),/Cancelled journey|Other traveller/);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`home-${width}-${theme}.png`),fullPage:true});
      await page.locator('#homeMonthSummary [data-home-calendar-month]').click();assert.equal(await page.locator('#calendarMonthJump').inputValue(),'9');await page.evaluate(()=>switchView('dashboard'));await page.locator('[data-home-journey]').first().click();assert.equal(await page.locator('#calendarMonthJump').inputValue(),'10');assert.match(await page.locator('#calendarJourneyDetail').innerText(),/Malta in November/);await page.locator('[data-calendar-close-date]').click();
    }
    if(!baseline){assert.equal(await page.evaluate(()=>JSON.stringify(state)),unchanged,'Selection and cancelled edits preserve every state field');assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.data.v2')),stored,'Presentation does not rewrite stored data');assert.deepEqual(errors,[]);}
    if(!baseline&&!layoutOnly){await page.locator('[data-calendar-layer=accommodation]').click();assert.equal(await page.locator('#calendar .calendar-lodging').count(),0);await page.locator('[data-calendar-layer=accommodation]').click();}
    await context.close();console.log(`${width}px ${theme}: calendar top ${Math.round(geometry.top)}px, cell ${Math.round(geometry.cellWidth)}px.`);
  }
  if(!baseline&&!layoutOnly)for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});
    await page.goto(origin+'/#/calendar');await page.waitForFunction(()=>window.HVCalendar?.ready&&!document.querySelector('.app-shell').inert);
    assert.equal(await page.locator('.calendar-day').count(),42);assert.equal(await page.locator('#calendar .calendar-lodging').count(),0);assert.ok(await page.locator('#calendarJourneyDetail').isHidden());
    await page.evaluate(()=>switchView('dashboard'));assert.match(await page.locator('#homeMonthSummary').innerText(),/0 journeys/);assert.ok(await page.locator('#homeUpcomingTravel').isHidden());
    await context.close();
  }
  fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

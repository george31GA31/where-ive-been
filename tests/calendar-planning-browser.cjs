/* Real pointer/touch interactions against isolated fictional account data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');
binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/calendar-planning');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(!path.extname(file))file=path.join(file,'index.html');
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(arg=>arg!=='--single-process'),headless:true});
  for(const width of(process.env.HV_PLAN_WIDTHS||'1440,768,390,360').split(',').map(Number))for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=768,serviceWorkers:'block',reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Me',citizenships:['GB'],enabledRules:['schengen']}],trips:[],stays:[{id:'existing',countryCode:'TN',countryName:'Tunisia',start:'2026-10-01',end:'2026-10-03',status:'actual',profileId:'p',notes:'Keep me'}],transports:[],accommodations:[],notes:[],placeVisits:[],residences:[],savedPlaces:[]};
    await page.addInitScript(({seed,theme})=>{localStorage.setItem('herald.calendar.view.v1','month');if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('herald.calendar.view.v1','month');localStorage.setItem('whereIveBeen.theme.v1',theme);},{seed,theme});
    await page.goto(origin+'/#/calendar');await page.waitForFunction(()=>window.HVCalendarPlanning&&window.HVCalendarDetails&&window.HVCalendar?.ready&&!document.querySelector('.app-shell').inert);
    await page.evaluate(()=>{calendarCursor=new Date('2026-12-01T00:00:00Z');renderCalendar();});
    await page.evaluate(()=>HVJourneys.loadAirports());
    const preserved=await page.evaluate(()=>JSON.stringify({stays:state.stays,transports:state.transports,accommodations:state.accommodations,notes:state.notes,placeVisits:state.placeVisits,profiles:state.profiles}));
    if(!await page.locator('.calendar-toolbar-actions [data-add-tentative]').isVisible())await page.locator('.calendar-add-toolbar>summary').click();await page.locator('.calendar-toolbar-actions [data-add-tentative]').click();
    const form=page.locator('#calendarPlanForm');await form.locator('[name=country]').fill('Costa Rica');await form.locator('[name=start]').fill('2026-11-29');await form.locator('[name=end]').fill('2026-12-07');await form.locator('[name=notes]').fill('Flexible dates');await form.locator('[type=submit]').click();
    const id=await page.evaluate(()=>state.calendarPlans[0].id),recordId=await page.evaluate(()=>state.calendarPlans[0].record.id);
    const chip=date=>page.locator(`#calendar [data-calendar-date="${date}"] [data-calendar-plan-id="${id}"]`);
    assert.equal(await chip('2026-12-07').count(),1);assert.equal(await page.evaluate(()=>state.stays.length),1);
    const dates=()=>page.evaluate(()=>HVCalendarPlanningModel.range(state.calendarPlans[0].kind,state.calendarPlans[0].record));
    const drag=async(source,date,{touch=false,escape=false}={})=>{
      await source.scrollIntoViewIfNeeded();const target=page.locator(`#calendar [data-calendar-date="${date}"]`);await target.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();
      const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+20};
      if(touch){
        const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});await page.waitForTimeout(350);await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});await page.waitForTimeout(70);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
      }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});if(escape){await page.keyboard.press('Escape');await page.waitForTimeout(10);}await page.mouse.up();}
      await page.waitForTimeout(60);
    };
    // Both resize edges and whole-event movement cross the visible week boundary.
    await drag(chip('2026-12-07').locator('.plan-end'),'2026-12-10');assert.deepEqual(await dates(),['2026-11-29','2026-12-10']);
    await page.locator('#calendarPlanNotice [data-plan-undo]').click();assert.deepEqual(await dates(),['2026-11-29','2026-12-07']);
    await page.evaluate(()=>{calendarCursor=new Date('2026-11-01T00:00:00Z');renderCalendar();});
    await drag(chip('2026-11-29').locator('.plan-start'),'2026-11-30');assert.deepEqual(await dates(),['2026-11-30','2026-12-07']);
    await page.locator('#calendarPlanNotice [data-plan-undo]').click();
    await page.evaluate(()=>{calendarCursor=new Date('2026-12-01T00:00:00Z');renderCalendar();});
    await drag(chip('2026-12-01'),'2026-12-07');assert.deepEqual(await dates(),['2026-12-05','2026-12-13']);
    await drag(chip('2026-12-06'),'2026-12-09',{escape:true});assert.deepEqual(await dates(),['2026-12-05','2026-12-13']);
    if(width<=768){await drag(chip('2026-12-06'),'2026-12-07',{touch:true});assert.deepEqual(await dates(),['2026-12-06','2026-12-14']);await page.locator('#calendarPlanNotice [data-plan-undo]').click();}
    await page.locator('[data-show-tentative]').uncheck();assert.equal(await page.locator('#calendar [data-calendar-plan-id]').count(),0);await page.locator('[data-show-tentative]').check();
    await chip('2026-12-06').click();assert.ok(await page.locator('#calendarPlanDialog').isVisible());await page.locator('#calendarPlanDialog [data-plan-edit]').click();
    await form.locator('[name=end]').fill('2026-12-15');await form.locator('[type=submit]').click();assert.deepEqual(await dates(),['2026-12-05','2026-12-15']);
    await page.reload();await page.waitForFunction(()=>window.HVCalendarPlanning&&window.HVCalendarDetails&&window.HVCalendar?.ready&&!document.querySelector('.app-shell').inert);assert.deepEqual(await dates(),['2026-12-05','2026-12-15']);
    await page.evaluate(()=>{calendarCursor=new Date('2026-12-01T00:00:00Z');renderCalendar();});
    await page.evaluate(()=>HVJourneys.loadAirports());
    await chip('2026-12-06').click();await page.locator('[data-plan-duplicate]').click();assert.equal(await page.evaluate(()=>state.calendarPlans.length),2);await page.locator('[data-plan-delete]').click();assert.equal(await page.evaluate(()=>state.calendarPlans.length),1);
    const confirmedSnapshot=await page.evaluate(()=>JSON.stringify({stays:state.stays,transports:state.transports,accommodations:state.accommodations,notes:state.notes,placeVisits:state.placeVisits,profiles:state.profiles}));assert.equal(confirmedSnapshot,preserved,'Experiments preserve all confirmed records');
    assert.equal(await page.evaluate(()=>HVJourney.summary(state,'2027-01-01').countries.has('CR')),false);
    await page.screenshot({path:path.join(out,`tentative-${width}-${theme}.png`),fullPage:true});
    await chip('2026-12-06').click();await page.locator('[data-plan-confirm]').click();assert.equal(await page.evaluate(()=>state.calendarPlans.length),0);
    const saved=await page.evaluate(id=>state.stays.find(row=>row.id===id),recordId);assert.equal(saved.notes,'Flexible dates');assert.equal(saved.start,'2026-12-05');assert.equal(saved.end,'2026-12-15');
    assert.equal(await page.locator(`#calendar [data-calendar-entry-id="${recordId}"]`).count(),11);
    await page.locator(`#calendar [data-calendar-entry-id="${recordId}"]`).first().click();await page.locator('#calendarJourneyDetail [data-make-tentative]').click();assert.equal(await page.evaluate(id=>state.stays.some(row=>row.id===id),recordId),false);assert.equal(await page.evaluate(()=>state.calendarPlans.length),1);
    await page.locator('[data-plan-close]').click();
    if(theme==='light'&&[1440,390].includes(width)){
      for(const spec of [{kind:'accommodation'},{kind:'transport',type:'flight'},{kind:'transport',type:'bus'},{kind:'transport',type:'train'},{kind:'transport',type:'boat'},{kind:'note'},{kind:'location'}]){
        if(!await page.locator('.calendar-toolbar-actions [data-add-tentative]').isVisible())await page.locator('.calendar-add-toolbar>summary').click();await page.locator('.calendar-toolbar-actions [data-add-tentative]').click();await form.locator('[name=kind]').selectOption(spec.kind);
        if(spec.kind==='accommodation'){await form.locator('[name=propertyName]').fill('Flexible lodge');await form.locator('[name=location]').fill('San José');}
        if(spec.kind==='transport'){await form.locator('[name=type]').selectOption(spec.type);await form.locator('[name=from]').fill('San José');await form.locator('[name=to]').fill('Panama City');}
        if(spec.kind==='note')await form.locator('[name=title]').fill('Book a tour');
        if(spec.kind==='location')await form.locator('[name=name]').fill('Local market');
        await form.locator('[name=start]').fill('2026-12-17');await form.locator('[name=end]').fill('2026-12-19');await form.locator('[type=submit]').click();
        const plan=await page.evaluate(()=>state.calendarPlans.at(-1)),entry=date=>page.locator(`#calendar [data-calendar-date="${date}"] [data-calendar-plan-id="${plan.id}"]`);
        await drag(entry('2026-12-18'),'2026-12-19');await drag(entry('2026-12-20').locator('.plan-end'),'2026-12-21');
        assert.deepEqual(await page.evaluate(id=>{const p=state.calendarPlans.find(p=>p.id===id);return HVCalendarPlanningModel.range(p.kind,p.record);},plan.id),['2026-12-18','2026-12-21']);
        await entry('2026-12-19').click();await page.locator('[data-plan-confirm]').click();
        const key={accommodation:'accommodations',transport:'transports',note:'notes',location:'placeVisits'}[spec.kind];assert.equal(await page.evaluate(({key,id})=>state[key].some(r=>r.id===id),{key,id:plan.record.id}),true);
        await page.locator(`#calendar [data-calendar-entry-id="${plan.record.id}"]`).first().click();await page.locator('#calendarJourneyDetail [data-make-tentative]').click();await page.locator('[data-plan-delete]').click();
      }
      // Stay at the month edge long enough to navigate without releasing the pointer.
      const original=await page.evaluate(()=>JSON.stringify(state.calendarPlans[0]));
      await page.evaluate(()=>{calendarCursor=new Date('2026-12-01T00:00:00Z');renderCalendar();});
      const dragChip=page.locator('#calendar [data-calendar-plan-id]').first();await dragChip.scrollIntoViewIfNeeded();const b=await dragChip.boundingBox(),grid=await page.locator('#calendar').boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(grid.x+grid.width-3,b.y+b.height/2,{steps:5});
      await page.waitForFunction(()=>calendarCursor.getUTCMonth()===0,{},{timeout:5000});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.evaluate(()=>JSON.stringify(state.calendarPlans[0])),original,'Month navigation and cancelling do not save a partial drag');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');assert.deepEqual(errors,[]);
    await context.close();console.log(`${width}px ${theme}: creation, both resize edges, cross-week/month movement, escape, undo, touch/editor alternatives, autosave/reload, duplication, deletion, confirmation and reversion passed.`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

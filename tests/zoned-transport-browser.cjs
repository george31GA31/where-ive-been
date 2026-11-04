'use strict';
const assert=require('node:assert/strict'),{harness}=require('./helpers/candidate-browser.cjs'),{calendarHistory}=require('./fixtures/calendar-chronology.cjs');
(async()=>{const h=await harness();try{
  for(const width of [1440,390])for(const theme of ['light','dark']){
    const page=await h.page(calendarHistory(),{width,theme,touch:width===390});
    const before=await page.evaluate(()=>JSON.stringify(state));
    await page.evaluate(()=>HVJourneys.openTransport(null,{type:'flight',start:{name:'London departure',timeZone:'Europe/London'},end:{name:'London arrival',timeZone:'Europe/London'},startLocal:'2026-03-29T01:30',endLocal:'2026-03-29T04:00',status:'planned'}));
    const form=page.locator('#transportForm'),leg=form.locator('[data-leg="0"]');
    await form.locator('[type=submit]').click();
    assert.match(await page.locator('#transportError').innerText(),/does not exist/);
    assert.equal(await page.evaluate(()=>JSON.stringify(state)),before,'Rejected gap leaves records intact');
    await leg.locator('[data-leg-field=startLocal]').fill('2026-10-25T01:30');
    await leg.locator('[data-leg-field=endLocal]').fill('2026-10-25T04:00');
    await form.locator('[type=submit]').click();
    assert.match(await page.locator('#transportError').innerText(),/Choose the earlier or later/);
    await leg.locator('.endpoint-time-details').first().locator('summary').click();
    await leg.locator('[data-leg-field=startDisambiguation]').selectOption('earlier');
    await form.locator('[type=submit]').click();
    await page.waitForFunction(()=>!document.querySelector('#transportDialog').open);
    const saved=await page.evaluate(()=>state.transports.at(-1));
    assert.equal(saved.legs[0].startLocal,'2026-10-25T01:30');assert.equal(saved.legs[0].startDisambiguation,'earlier');
    assert.equal(await page.evaluate(()=>JSON.stringify({...state,transports:state.transports.slice(0,-1)})),before,'Only explicitly saved flight added');
    await page.evaluate(id=>HVJourneys.openTransport(id),saved.id);
    assert.equal(await leg.locator('[data-leg-field=startDisambiguation]').inputValue(),'earlier','Choice survives reopening');
    await page.keyboard.press('Escape');

    // The shared ground editor exposes the same resolver and choices.
    await page.evaluate(()=>HVJourneys.openTransport(null,{type:'train',start:{name:'Departure station',timeZone:'Europe/London'},end:{name:'Arrival station',timeZone:'Europe/London'},startLocal:'2026-12-01T10:00',endLocal:'2026-12-01T09:00',status:'planned'}));
    await form.locator('[type=submit]').click();assert.match(await page.locator('#transportError').innerText(),/Arrival must be after/);
    await form.locator('[name=startLocal]').fill('2026-10-25T01:30');await form.locator('[name=endLocal]').fill('2026-10-25T04:00');
    await form.locator('[type=submit]').click();assert.match(await page.locator('#transportError').innerText(),/Choose the earlier or later/);
    await form.locator('[data-endpoint-time=start]>summary').click();
    await form.locator('[name=startDisambiguation]').selectOption('later');
    await form.locator('[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#transportDialog').open);
    assert.equal(await page.evaluate(()=>state.transports.at(-1).startDisambiguation),'later');
    assert.deepEqual(page.errors,[]);await page.context().close();
    console.log(`${width}px ${theme}: flight/ground gap rejection, explicit repeated-hour choices, chronology and preservation passed.`);
  }
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

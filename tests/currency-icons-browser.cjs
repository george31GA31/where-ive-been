'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./helpers/candidate-browser.cjs'),{candidateHistory}=require('./fixtures/v1-candidate.cjs');
(async()=>{const h=await harness();try{
 for(const width of [1440,390])for(const theme of ['light','dark']){
  const remoteFlags=[];
  const p=await h.page(candidateHistory(),{width,height:900,theme,route:'travel-tools/currency',setup:async context=>context.route('**/flagcdn.com/**',route=>{remoteFlags.push(route.request().url());return route.abort();})});
  const before=await p.evaluate(()=>JSON.stringify(state));
  await p.locator('[data-pick=to]').scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>{const image=document.querySelector('[data-pick=to] .currency-flag');return image?.complete&&image.naturalWidth>0;});
  const image=await p.locator('[data-pick=to] .currency-flag').evaluate(el=>({src:el.currentSrc,hidden:el.getAttribute('aria-hidden'),alt:el.alt}));
  assert.ok(image.src.startsWith(h.origin+'/assets/currency-eur.svg'),'EUR comes from the local application origin');
  assert.equal(image.hidden,'true');assert.equal(image.alt,'');
  assert.match(await p.locator('[data-pick=to]').innerText(),/EUR/);
  assert.deepEqual(remoteFlags,[],'Opening EUR never requests a remote flag');
  assert.equal(await p.evaluate(()=>COUNTRIES.some(country=>country.code==='EU')),false,'The currency symbol does not add a country');
  await p.locator('[data-pick=to]').click();await p.locator('.currency-picker input').fill('EUR');
  await p.waitForFunction(()=>{const image=document.querySelector('[data-currency=EUR] .currency-flag');return image?.complete&&image.naturalWidth>0;});
  assert.match(await p.locator('[data-currency=EUR]').innerText(),/EUR.*Euro/s);
  await p.locator('.currency-picker [data-close]').click();
  assert.equal(await p.evaluate(()=>JSON.stringify(state)),before,'Inspecting currency icons never changes travel/currency data');
  assert.deepEqual(p.errors,[]);await p.context().close();
 }
 const missing=await h.page(candidateHistory(),{route:'travel-tools/currency',setup:async context=>context.route('**/*',route=>{
  const url=route.request().url();return url.includes('/assets/flags-display/')||url.endsWith('/assets/currency-eur.svg')?route.abort():route.fallback();
 })});
 await missing.locator('[data-pick=to]').scrollIntoViewIfNeeded();
 await missing.waitForFunction(()=>[...document.querySelectorAll('.currency-pair .currency-flag')].length===2&&[...document.querySelectorAll('.currency-pair .currency-flag')].every(image=>getComputedStyle(image).display==='none'));
 assert.match(await missing.locator('[data-pick=from]').innerText(),/GBP/);assert.match(await missing.locator('[data-pick=to]').innerText(),/EUR/);
 await missing.locator('[data-pick=to]').click();
 assert.equal(await missing.locator('.currency-picker img.currency-flag:not(.flag-img)').count(),0,'Every currency icon shares the fail-closed handler');
 assert.ok(await missing.locator('.currency-picker [data-currency]').count()>100,'Text-labelled currency choices remain available without icons');
 await missing.context().close();console.log('Currency icons: local offline EUR, picker label, no invented EU country, unchanged data, and all-icon failure fallback passed.');
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

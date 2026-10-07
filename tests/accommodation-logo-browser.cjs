/* Real upload, canvas and map paths with fictional data and no external account writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');binary.setGraphicsMode=false;
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/accommodation-logos');fs.mkdirSync(out,{recursive:true});
const contentTypes={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
// Requests only select already loaded public assets; a URL never becomes a filesystem path.
const assets=new Map();
function loadAssets(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||['node_modules','test-results','tests','scripts'].includes(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())loadAssets(file);
    else if(entry.isFile())assets.set('/'+path.relative(root,file).split(path.sep).join('/'),{body:fs.readFileSync(file),type:contentTypes[path.extname(file)]||'application/octet-stream'});
  }
}
loadAssets(root);
const server=http.createServer((req,res)=>{
  let key;try{key=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
  if(!path.extname(key))key=key.replace(/\/$/,'')+'/index.html';
  const asset=assets.get(key);if(!asset){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',asset.type);res.end(asset.body);
});
const hotel={id:'osm:N:sur',name:'Best Western Sur',type:'Hotel',city:'Sur',area:'Sur',countryCode:'OM',countryName:'Oman',address:'Sur Meandering Road, 411, Sur, Oman',lat:22.57,lon:59.52,custom:{keep:'place'}};
const stay=(id,tripId,start,end,place=hotel)=>({id,tripId,profileId:'p',propertyName:place.name,location:'Sur',checkIn:start,checkOut:end,place:{...place},notes:'Keep '+id,bookingReference:'KEEP-'+id,price:{amount:100,currency:'GBP'},custom:{keep:true}});
const seed={version:2,activeProfileId:'p',profiles:[{id:'p',name:'Test traveller',citizenships:['GB'],homeCountryCodes:[],enabledRules:['schengen']}],trips:[{id:'winter',profileId:'p',name:'Oman winter'},{id:'autumn',profileId:'p',name:'Oman autumn'}],stays:[],accommodations:[stay('first','winter','2026-02-21','2026-02-22'),stay('repeat','autumn','2026-11-10','2026-11-12'),stay('other',null,'2026-01-10','2026-01-11',{...hotel,id:'osm:N:other',lat:22.58})],transports:[],placeVisits:[],savedPlaces:[],residences:[],visaAcknowledgements:[],excludedCountryCodes:[],custom:{keep:'state'}};
const snapshot=()=>JSON.stringify(state);
let browser;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
  for(const width of (process.env.HV_LOGO_WIDTHS||'390,1440').split(',').map(Number))for(const theme of ['light','dark']){
    const owned=width===1440,page=await browser.newPage({viewport:{width,height:960},hasTouch:width===390,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
    await page.route('**/*',r=>{const url=r.request().url();if(url.startsWith(origin))return r.continue();
      if(url.includes('/d3@'))return r.fulfill({path:path.join(root,'node_modules/d3/dist/d3.min.js'),contentType:'text/javascript'});
      if(url.includes('/topojson-client@'))return r.fulfill({path:path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),contentType:'text/javascript'});
      if(url.includes('/world-atlas@'))return r.fulfill({path:path.join(root,'node_modules/world-atlas/countries-50m.json'),contentType:'application/json'});
      if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=','base64')});
      return r.fulfill({contentType:r.request().resourceType()==='script'?'text/javascript':'application/json',body:r.request().resourceType()==='script'?'':'{}'});
    });
    await page.addInitScript(({seed,theme,owned})=>{
      if(!localStorage.getItem('logo-test-seeded')){
        localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('whereIveBeen.guest.v1',JSON.stringify(seed));localStorage.setItem('whereIveBeen.stays.v1','[]');localStorage.setItem('logo-test-seeded','yes');
        if(owned)localStorage.setItem('whereIveBeen.localOwner.v1','another-account');
      }
      localStorage.setItem('whereIveBeen.theme.v1',theme);
    },{seed,theme,owned});
    async function openHotel(){
      await page.waitForSelector('#globalJourneyMap .marker-accommodation');await page.evaluate(()=>HVJourneyUI.activeMap().setView([22.57,59.52],14,{animate:false}));
      const marker=page.locator('#globalJourneyMap .marker-accommodation[title*="separate stays"]');await marker.scrollIntoViewIfNeeded();width===390?await marker.tap():await marker.click();
      await page.locator('#globalJourneyMap [data-hotel-logo=first]').waitFor();
    }
    await page.goto(origin+'/#/journey-map');await openHotel();
    const popup=page.locator('#globalJourneyMap .herald-map-popup'),button=popup.locator('[data-hotel-logo=first]');
    const before=JSON.parse(await page.evaluate(snapshot)),protectedKeys=owned?['whereIveBeen.data.v2','whereIveBeen.stays.v1']:['whereIveBeen.guest.v1','whereIveBeen.stays.v1'];
    const protectedStorage=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),protectedKeys);
    const layout=()=>{const card=document.querySelector('#globalJourneyMap .herald-popup-card'),base=card.getBoundingClientRect();return [card,...card.querySelectorAll('h3,.herald-popup-head p,.herald-popup-date,.herald-popup-address,.herald-popup-actions')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x-base.x,y:r.y-base.y,w:r.width,h:r.height};});};
    const geometry=await page.evaluate(layout),text=await popup.innerText();assert.equal(await button.locator('.herald-stay-icon').count(),1);assert.equal((await button.boundingBox()).width,18);
    // Native cancellation must not create artwork or a saved place.
    const cancelEvent=page.waitForEvent('filechooser');width===390?await button.tap():await button.click();const cancelled=await cancelEvent;await cancelled.setFiles([]);
    assert.equal(await page.evaluate(snapshot),JSON.stringify(before));
    for(const [kind,w,h]of [['square',80,80],['wide',200,50],['tall',50,200],['transparent',80,80]]){
      const source=await page.evaluate(({w,h,kind})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#d02040';ctx.fillRect(0,0,w,h);if(kind==='transparent')ctx.clearRect(w/4,h/4,w/2,h/2);return c.toDataURL('image/png');},{w,h,kind});
      if(kind!=='square'){
        width===390?await button.tap():await button.click();await popup.locator('[data-hotel-logo-replace]').waitFor();
        const menu=await popup.locator('[role=menu]').boundingBox(),control=await button.boundingBox();
        assert.equal(menu.y,control.y+control.height+6,'Logo actions sit below the larger logo');
      }
      const chooserEvent=page.waitForEvent('filechooser');
      const trigger=kind==='square'?button:popup.locator('[data-hotel-logo-replace]');width===390?await trigger.tap():await trigger.click();
      const chooser=await chooserEvent;await chooser.setFiles({name:kind+'.png',mimeType:'image/png',buffer:Buffer.from(source.split(',')[1],'base64')});
      await page.waitForFunction(()=>!!document.querySelector('#globalJourneyMap .herald-hotel-logo')&&!document.querySelector('#globalJourneyMap [data-hotel-logo]').disabled);
      const larger=await page.evaluate(layout),bodyShift=larger[3].y-geometry[3].y;
      assert.deepEqual(larger[0],{...geometry[0],h:geometry[0].h+bodyShift},'Popup width and padding stay unchanged; height only accommodates the larger header');
      for(let i=3;i<larger.length;i++)assert.deepEqual(larger[i],{...geometry[i],y:geometry[i].y+bodyShift},'Stay details retain their original size and spacing below the header');
      assert.equal(larger[1].x,geometry[1].x+42);assert.equal(larger[2].x,geometry[2].x+42);
      const logoBox=await button.boundingBox(),headingBox=await popup.locator('.herald-popup-head>div').boundingBox(),dateBox=await popup.locator('.herald-popup-date').first().boundingBox();
      assert.equal(headingBox.x,logoBox.x+logoBox.width+10,'Hotel name keeps its existing gap beside the logo');
      assert.ok(headingBox.x+headingBox.width<=logoBox.x+geometry[0].w-40,'Hotel name wraps within the existing popup width');
      assert.ok(dateBox.y>=Math.max(logoBox.y+logoBox.height,headingBox.y+headingBox.height),'Logo and hotel heading do not overlap stay details');
      assert.equal(await popup.innerText(),text);
      const measured=await button.locator('img').evaluate(async img=>{
        await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
        let minX=128,minY=128,maxX=-1,maxY=-1;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;if(pixels[i+3]&&pixels[i+1]<240){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
        return {width:img.naturalWidth,height:img.naturalHeight,bounds:[minX,minY,maxX-minX+1,maxY-minY+1],corner:[...pixels.slice(0,4)],centerAlpha:pixels[(64*128+64)*4+3],fit:getComputedStyle(img).objectFit,background:getComputedStyle(img).backgroundColor,box:[img.width,img.height]};
      });
      assert.deepEqual([measured.width,measured.height],[128,128]);assert.deepEqual(measured.bounds,['square','transparent'].includes(kind)?[8,8,112,112]:kind==='wide'?[8,50,112,28]:[50,8,28,112]);assert.deepEqual(measured.corner,[0,0,0,0]);assert.equal(measured.centerAlpha,kind==='transparent'?0:255);assert.deepEqual(measured.box,[60,60]);assert.equal(measured.fit,'contain');assert.equal(measured.background,'rgb(255, 255, 255)');
      const saved=JSON.parse(await page.evaluate(snapshot));assert.deepEqual({...saved,savedPlaces:before.savedPlaces},before,'Only the shared location artwork is added');assert.equal(saved.savedPlaces.length,1);
      assert.equal(await page.evaluate(()=>HVAccommodationLogos.logo(state,'repeat')===HVAccommodationLogos.logo(state,'first')),true);assert.equal(await page.evaluate(()=>HVAccommodationLogos.logo(state,'other')),null);
      await popup.screenshot({path:path.join(out,`${kind}-${width}-${theme}.png`)});
    }
    const storedLogo=await button.locator('img').getAttribute('src');await page.reload();await openHotel();assert.equal(await button.locator('img').getAttribute('src'),storedLogo,'Reload restores the logo');
    // Each focused trip, containing a different stay, uses the same location artwork.
    await page.evaluate(()=>HVJourneyMap.open('trip:autumn'));const focused=page.locator('.journey-map-dialog[open]');await focused.locator('.marker-accommodation').click();assert.equal(await focused.locator('[data-hotel-logo=repeat] img').getAttribute('src'),storedLogo);await focused.locator('[data-map-close]').click();
    const stable=await page.evaluate(snapshot);
    // Wrong formats and corrupt/oversized files preserve the old image and data.
    for(const bad of [{name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('no image')},{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')},{name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)}]){
      await button.click();const next=page.waitForEvent('filechooser');await popup.locator('[data-hotel-logo-replace]').click();await (await next).setFiles(bad);await popup.locator('[role=alert]').waitFor();assert.equal(await page.evaluate(snapshot),stable);assert.equal(await button.locator('img').getAttribute('src'),storedLogo);
    }
    // The existing persistence boundary reports a full device without overwriting travel data.
    await page.evaluate(()=>{window.logoTestSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='whereIveBeen.data.v2'||key==='whereIveBeen.guest.v1')throw new DOMException('Full','QuotaExceededError');return window.logoTestSetItem.call(this,key,value);};});
    await button.click();await popup.locator('[data-hotel-logo-remove]').click();await popup.locator('[role=alert]').waitFor();assert.match(await popup.locator('[role=alert]').innerText(),/could not be saved/);assert.equal(await page.evaluate(snapshot),stable);assert.equal(await button.locator('img').getAttribute('src'),storedLogo);
    await page.evaluate(()=>{Storage.prototype.setItem=window.logoTestSetItem;delete window.logoTestSetItem;});
    // Keyboard access and removal return to the exact generic icon; Escape keeps the popup open.
    await button.focus();await page.keyboard.press('Enter');await popup.locator('[data-hotel-logo-replace]').waitFor();await page.keyboard.press('ArrowDown');assert.equal(await popup.locator('[data-hotel-logo-remove]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await popup.locator('[role=menu]').count(),0);assert.equal(await popup.isVisible(),true);
    await page.keyboard.press('Enter');await popup.locator('[data-hotel-logo-remove]').click();assert.equal(await button.locator('img').count(),0);assert.equal(await button.locator('.herald-stay-icon').count(),1);assert.deepEqual(await page.evaluate(layout),geometry);
    await page.reload();await openHotel();assert.equal(await button.locator('.herald-stay-icon').count(),1);assert.equal(await page.evaluate(()=>HVAccommodationLogos.logo(state,'repeat')),null);
    assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),protectedKeys),protectedStorage);
    // A resize frame that was already queued must be harmless after its editor closes.
    const stableAfterRemoval=await page.evaluate(snapshot);
    await page.evaluate(async()=>{
      const frames=[],raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
      window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};window.cancelAnimationFrame=()=>{};
      try{
        HVPlaces.open({accommodation:true});const editor=document.querySelector('.place-search-dialog[open]');
        editor.querySelector('[data-place-plot]').click();const closed=new Promise(resolve=>editor.addEventListener('close',resolve,{once:true}));editor.close();await closed;
        if(!frames.length)throw new Error('Expected a queued map resize');for(const frame of frames)frame(performance.now());
      }finally{window.requestAnimationFrame=raf;window.cancelAnimationFrame=cancel;}
    });
    assert.equal(await page.evaluate(snapshot),stableAfterRemoval);assert.deepEqual(errors,[]);
    await page.close();console.log(`Hotel upload/replace/remove, square/wide/tall pixels, fixed popup layout, sharing, reload and storage failure passed at ${width}px in ${theme} (${owned?'isolated guest':'local guest'}).`);
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});

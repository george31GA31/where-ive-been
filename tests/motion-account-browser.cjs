/* Account presentation uses the real form handlers against a synthetic in-page Auth client. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/candidate-browser.cjs');
const out=path.resolve(__dirname,'../test-results/motion-account');fs.mkdirSync(out,{recursive:true});
function clientStub(signedIn){return `(()=>{const base=new URL('./',document.currentScript.src);const user=${signedIn?JSON.stringify({id:'fictional-account',email:'example@example.test',user_metadata:{display_name:'Example traveller'}}):'null'};window.accountFixtureCalls=[];const session=user?{user,access_token:'fictional-test-token'}:null;const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>{accountFixtureCalls.push('signIn');return{data:{},error:{message:'Fixture: sign-in rejected'}}},signUp:async()=>{accountFixtureCalls.push('signUp');return{data:{},error:{message:'Fixture: no account created'}}},resetPasswordForEmail:async()=>{accountFixtureCalls.push('reset');return{data:{},error:{message:'Fixture: no email sent'}}},updateUser:async()=>{accountFixtureCalls.push('update');return{data:{},error:{message:'Fixture: no user changed'}}},signOut:async()=>{accountFixtureCalls.push('signOut');return{error:null}}};window.WIBAuth={base,url:path=>new URL(path,base).href,cachedSession:()=>session,client:()=>({auth})};})();`;}
(async()=>{const h=await harness();try{
 for(const width of [1440,390])for(const theme of ['light','dark'])for(const route of ['login','register','reset-password','profile']){
  const context=await h.browser.newContext({viewport:{width,height:width===390?844:1000},hasTouch:width===390,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>{localStorage.setItem('whereIveBeen.theme.v1',theme);localStorage.setItem('whereIveBeen.data.v2',JSON.stringify({version:2,fixture:'keep original guest payload'}));},theme);
  await context.route('**/*',request=>{const url=request.request().url();if(url.startsWith(h.origin+'/')){if(new URL(url).pathname==='/account-client.js')return request.fulfill({contentType:'text/javascript',body:clientStub(route==='profile')});return request.continue();}external.push(url);return request.abort();});
  await page.goto(h.origin+'/'+route+'/');await page.waitForSelector('.motion-account-layout');
  await page.waitForFunction(()=>!!window.WIBAuth&&document.querySelector('.account-page')?.dataset.motionAccountReady==='true');
  assert.equal(await page.locator('.motion-account-header .brand').count(),1);
  assert.equal(await page.locator('h1').count(),1,'Original page identity remains semantic');
  assert.equal(await page.locator('.motion-account-scene').getAttribute('data-motion'),'off','System reduced motion governs account artwork');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No account horizontal overflow');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
  if(route==='login'){
   assert.equal(await page.locator('#email').getAttribute('autocomplete'),'username');assert.equal(await page.locator('#password').getAttribute('autocomplete'),'current-password');
   await page.getByLabel('Email',{exact:true}).fill('example@example.test');await page.getByLabel('Password',{exact:true}).fill('Fictional-password-2026');
   await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForFunction(()=>document.getElementById('accountMessage').textContent.includes('Fixture: sign-in rejected'));
   assert.equal(await page.getByRole('button',{name:'Log in',exact:true}).isEnabled(),true);assert.equal(await page.locator('#password').inputValue(),'Fictional-password-2026','Rejected sign-in retains the typed password');
  }else if(route==='register'){
   await page.getByLabel('Your name',{exact:true}).fill('Example traveller');await page.getByLabel('Email',{exact:true}).fill('example@example.test');await page.getByLabel('New password',{exact:true}).fill('Fictional-password-2026');await page.getByLabel('Confirm new password',{exact:true}).fill('Different-password-2026');
   await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForFunction(()=>document.getElementById('accountMessage').textContent.includes('do not match'));assert.deepEqual(await page.evaluate(()=>accountFixtureCalls),[],'Password mismatch is validated before any Auth call');
  }else if(route==='reset-password'){
   assert.ok(await page.locator('#resetForm').isVisible());assert.equal(await page.locator('#recoveryForm').isVisible(),false);
   await page.getByLabel('Email',{exact:true}).fill('example@example.test');await page.getByRole('button',{name:'Send reset link',exact:true}).click();await page.waitForFunction(()=>document.getElementById('accountMessage').textContent.includes('Fixture: no email sent'));
   assert.deepEqual(await page.evaluate(()=>accountFixtureCalls),['reset']);
  }else{
   await page.waitForSelector('#signedInPanel:not([hidden])');assert.equal(await page.locator('#displayName').inputValue(),'Example traveller');assert.equal(await page.locator('#email').inputValue(),'example@example.test');
   assert.ok(await page.locator('#detailsForm').isVisible());assert.ok(await page.locator('#passwordForm').isVisible());assert.equal(await page.locator('#signedOutPanel').isVisible(),false);assert.deepEqual(await page.evaluate(()=>accountFixtureCalls),[],'Reading profile issues no mutation');
  }
  await page.locator('.motion-account-theme').click();const next=theme==='light'?'dark':'light';assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),next);assert.equal(await page.evaluate(()=>localStorage.getItem('whereIveBeen.theme.v1')),next);
  await page.locator('#backToTracker').focus();assert.equal(await page.evaluate(()=>document.activeElement?.id),'backToTracker');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('whereIveBeen.data.v2')).fixture),'keep original guest payload');
  await page.screenshot({path:path.join(out,`${route}-${width}-${theme}.png`),fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(external,[],'No external auth or email request can escape this fixture');await context.close();
  console.log(`${route} ${width}px ${theme}: matching account composition, native fields/errors, theme, keyboard and guest-data preservation passed.`);
 }
 const signedOut=await h.browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await signedOut.newPage();await signedOut.route('**/*',route=>route.request().url().startsWith(h.origin+'/')?(new URL(route.request().url()).pathname==='/account-client.js'?route.fulfill({contentType:'text/javascript',body:clientStub(false)}):route.continue()):route.abort());await page.goto(h.origin+'/profile/');await page.waitForSelector('#signedOutPanel:not([hidden])');await page.waitForSelector('#heraldGuestTransferPanel');assert.equal(await page.locator('.motion-account-content #heraldGuestTransferPanel').count(),1,'Late guest transfer panel is retained in the content column');assert.equal(await page.locator('#signedInPanel').isVisible(),false);await signedOut.close();
}finally{await h.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

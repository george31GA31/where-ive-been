'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),binary=require('@sparticuz/chromium');
binary.setGraphicsMode=false;
async function harness(){
 const root=path.resolve(process.env.HV_ROOT||path.join(__dirname,'../..'));
 const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!path.extname(file))file=path.join(file,'index.html');try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.HV_CHROMIUM_PATH||await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
 return {browser,origin,async page(seed,{width=1440,height=900,theme='light',timezoneId='UTC',touch=false,setup,route='calendar',time='2026-10-21T12:00:00Z'}={}){
  const context=await browser.newContext({viewport:{width,height},timezoneId,hasTouch:touch,serviceWorkers:'block',reducedMotion:'reduce'});
  // Installed before any navigation: no live account, provider or telemetry request can escape.
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  if(setup)await setup(context,origin);
  const page=await context.newPage();page.errors=[];page.on('pageerror',e=>{page.errors.push(e.message);console.error('PAGE ERROR',e.stack);});
  await page.clock.install({time:new Date(time)});
  await page.addInitScript(({seed,theme})=>{if(!localStorage.getItem('whereIveBeen.data.v2'))localStorage.setItem('whereIveBeen.data.v2',JSON.stringify(seed));localStorage.setItem('whereIveBeen.theme.v1',theme);},{seed,theme});
  await page.goto(origin+'/#/'+route);await page.waitForFunction(()=>window.HVCalendar?.ready&&!document.querySelector('.app-shell').inert).catch(async error=>{console.error((await page.locator('body').innerText()).slice(0,1500));throw error;});await page.clock.runFor(300);
  return page;
 },async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
module.exports={harness};

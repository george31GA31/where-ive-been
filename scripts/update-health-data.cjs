/* One paced request at a time. Public country pages only; no credentials or user data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const Parser=require('./travelhealthpro-parser.cjs'),curl=promisify(execFile),origin='https://travelhealthpro.org.uk',agent='HeraldVoyagesHealthUpdater/1.0 (+https://github.com/george31GA31/where-ive-been)';
const output=path.resolve(__dirname,'../data/entry-requirements/travelhealthpro.js'),reportFile=path.resolve(__dirname,'../data/entry-requirements/health-refresh.json');
function cachedPage(file,retrieved,url){
 let descriptor;
 try{
  // Stat and read the same opened file, even if its path is replaced concurrently.
  descriptor=fs.openSync(file,'r');if(fs.fstatSync(descriptor).mtime.toISOString().slice(0,10)!==retrieved)return null;
  const html=fs.readFileSync(descriptor,'utf8');let metadata={};try{metadata=JSON.parse(fs.readFileSync(file+'.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  return {status:200,html,url:metadata.url||url};
 }catch(error){if(error.code==='ENOENT')return null;throw error;}finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
}
async function update(){
 const retrieved=new Date().toISOString().slice(0,10),temp=fs.mkdtempSync(path.join(os.tmpdir(),'hv-health-'));let policy,last=0;
 async function get(url,redirects=0){
  const u=new URL(url);if(u.origin!==origin||!['/robots.txt','/about','/countries'].includes(u.pathname)&&!Parser.sourceUrl(url))throw Error('Source URL refused');
  if(policy&&!policy.allows(u.pathname))throw Error('Source disallows '+u.pathname);
  const cacheDir=process.env.HV_HEALTH_CACHE,cacheFile=cacheDir&&path.join(cacheDir,(u.pathname.split('/').pop()||'root')+'.html');
  const cached=cacheFile&&cachedPage(cacheFile,retrieved,url);if(cached)return cached;
  const delay=Math.max(0,last+(policy?.delay||1.5)*1000-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
  const file=path.join(temp,'response'),{stdout}=await curl('curl',['--silent','--show-error','--max-time','30','--max-filesize','2500000','--user-agent',agent,'--header','Accept: text/html, text/plain;q=0.9','--output',file,'--write-out','%{http_code}\n%{redirect_url}',url],{timeout:35000,maxBuffer:10000});
  const [code,redirect]=stdout.trim().split('\n'),status=Number(code),html=fs.readFileSync(file,'utf8');if([401,403,406,429].includes(status)){const error=Error('Source declined requests (HTTP '+status+'); no alternate access attempted');error.blocked=true;throw error;}
  if([301,302,303,307,308].includes(status)){if(redirects>=5||!Parser.sourceUrl(redirect))throw Error('Source redirect refused');const response=await get(redirect,redirects+1);if(cacheFile&&response.status===200){fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(cacheFile,response.html);fs.writeFileSync(cacheFile+'.json',JSON.stringify({url:response.url}));}return response;}
  if(cacheFile&&status===200){fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(cacheFile,html);fs.writeFileSync(cacheFile+'.json',JSON.stringify({url}));}return {status,html,url};
 }
 try{
  const robots=await get(origin+'/robots.txt');if(robots.status!==200&&robots.status!==404)throw Error('Cannot establish robots policy');policy=Parser.robotsPolicy(robots.status===200?robots.html:'');
  const licence=await get(origin+'/about');if(licence.status!==200||!/(?:Open Government Licen[sc]e|open-government-licence\/version\/3)/i.test(licence.html))throw Error('Cannot confirm source reuse licence');
  const listing=await get(origin+'/countries');if(listing.status!==200)throw Error('Country directory unavailable');const directory=Parser.directory(listing.html);
  const previous=fs.existsSync(output)?require(output):{destinations:[]},old=new Map(previous.destinations.map(r=>[r.id,r])),destinations=[],failures=[];
  const only=process.env.HV_HEALTH_DESTINATIONS?.split(',').filter(Boolean);if(only)throw Error('Partial production refreshes are not permitted');
  for(const [i,destination] of directory.entries()){
   try{const page=await get(destination.url);if(page.status!==200)throw Error('HTTP '+page.status);destinations.push(Parser.parse(page.html,{...destination,canonical:page.url,canonicalAliases:directory.find(d=>d.url===page.url)?.aliases||[]},retrieved));}
   catch(error){if(error.blocked)throw error;console.log(destination.id+': '+error.message);failures.push({id:destination.id,reason:error.message});const lastGood=old.get(destination.id);destinations.push(lastGood?{...lastGood,sourceStatus:'retained',lastAttempt:retrieved}:{...destination,sourceStatus:'unavailable',lastAttempt:retrieved});}
   if((i+1)%20===0)console.log((i+1)+' / '+directory.length+' destinations checked ('+failures.length+' retained or unavailable)');
   // Let DOM lifecycle tasks finish even when every development source is cached.
   await new Promise(resolve=>setImmediate(resolve));
  }
  const available=destinations.filter(d=>d.sourceStatus==='available').length;
  if(available<directory.length*.95)throw Error('Incomplete refresh; bundled data retained ('+available+'/'+directory.length+')');
  const aliases=require('../data/entry-requirements/health-destination-aliases.json'),countries=require('../data/country-catalog.json'),countryMap={},byName=new Map();
  for(const d of destinations)for(const name of [d.name,...d.aliases]){const k=Parser.key(name);if(byName.has(k)&&byName.get(k)!==d.id)throw Error('Ambiguous destination alias: '+name);byName.set(k,d.id);}
  for(const c of countries){const names=[c.name,...(aliases.countries[c.code]||[])],ids=[...new Set(names.map(n=>byName.get(Parser.key(n))).filter(Boolean))];if(ids.length>1)throw Error('Ambiguous country mapping: '+c.code);if(ids[0])countryMap[c.code]=ids[0];}
  const regions=aliases.regions.flatMap(r=>{const id=byName.get(Parser.key(r.source));return id?[{parents:r.parents,names:r.names,id}]:[];});
  const data={schema:1,source:{name:'TravelHealthPro (NaTHNaC)',url:origin+'/countries',licence:'Open Government Licence v3.0',licenceUrl:'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',retrieved,refreshDays:7,staleDays:30},countryMap,regions,destinations};
  const report={retrieved,destinations:directory.length,canonicalSources:new Set(destinations.filter(d=>d.certificates).map(d=>d.url)).size,mappedCountries:Object.keys(countryMap).length,available,retained:destinations.filter(d=>d.sourceStatus==='retained').length,unavailable:destinations.filter(d=>d.sourceStatus==='unavailable').length,failures};
  // Only replace the provider snapshot after coverage and parser validation succeeds.
  fs.writeFileSync(output+'.tmp','/* TravelHealthPro / NaTHNaC factual extracts, Crown copyright, OGL v3.0. Generated by scripts/update-health-data.cjs. */\n(function(root){const data='+JSON.stringify(data)+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.HVHealthDataset=data;})(typeof window!=="undefined"?window:globalThis);\n');fs.renameSync(output+'.tmp',output);
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module)update().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={update,cachedPage};

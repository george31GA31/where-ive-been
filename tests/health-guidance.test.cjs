'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Parser=require('../scripts/travelhealthpro-parser.cjs'),Data=require('../data/entry-requirements/travelhealthpro.js'),Health=require('../entry-health.js'),Rules=require('../entry-rules.js');
const today=Data.source.retrieved;
test('Development source cache only reuses fresh pages and preserves permitted redirect metadata',()=>{
 const os=require('node:os'),path=require('node:path'),{cachedPage}=require('../scripts/update-health-data.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'hv-health-test-')),file=path.join(dir,'source.html'),url='https://travelhealthpro.org.uk/countries/india';
 try{assert.equal(cachedPage(file,today,url),null);fs.writeFileSync(file,'source facts');const date=new Date(today+'T12:00:00Z');fs.utimesSync(file,date,date);assert.equal(cachedPage(file,today,url).html,'source facts');fs.writeFileSync(file+'.json',JSON.stringify({url:'https://travelhealthpro.org.uk/countries/indonesia'}));assert.equal(cachedPage(file,today,url).url,'https://travelhealthpro.org.uk/countries/indonesia');assert.equal(cachedPage(file,'2099-01-01',url),null);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Public source parsing keeps certificate conditions, real vaccine categories and regional malaria',()=>{
 const html=fs.readFileSync('tests/fixtures/travelhealthpro-india.html','utf8'),record=Parser.parse(html,{id:'india',name:'India',aliases:['India'],url:'https://travelhealthpro.org.uk/countries/india'},'2026-10-03');
 assert.match(record.certificates.entries[1],/9 months.*6 days/);assert.deepEqual(record.most.map(v=>v.name),['Hepatitis A','Tetanus','Typhoid']);assert.deepEqual(record.some.map(v=>v.name),['Chikungunya','Rabies']);assert.ok(record.some[1].considerations.some(t=>/long-stay/i.test(t)));assert.equal(record.malaria.classification,'regional');assert.equal(record.malaria.areas.length,3);assert.match(record.malaria.areas[0],/Mizoram.*Odisha.*Tripura/);assert.match(record.malaria.areas[2],/no risk/);assert.equal(record.yellowFever.recommendation,null,'Certificate does not fabricate a vaccination recommendation');assert.equal(record.sourceUpdated,null,'Retrieval is not a provider update date');
 assert.throws(()=>Parser.parse(html.replace('Certificate requirements','Changed heading'),{id:'india',name:'India',aliases:['India'],url:record.url},today),/Certificate section missing/);
 assert.throws(()=>Parser.parse(html,{id:'france',name:'France',aliases:['France'],url:'https://travelhealthpro.org.uk/countries/france'},today),/redirect/);
});
test('Source crawler honours specific robots groups, exceptions and blocked paths',()=>{
 const p=Parser.robotsPolicy('User-agent: *\nDisallow: /news/\nAllow: /news/$\nDisallow: /pdfs/generate/\nAllow: /\nCrawl-delay: 3');assert.equal(p.allows('/countries/india'),true);assert.equal(p.allows('/news/secret'),false);assert.equal(p.allows('/news/'),true);assert.equal(p.allows('/pdfs/generate/india'),false);assert.equal(p.delay,3);
 const own=Parser.robotsPolicy('User-agent: *\nAllow: /\nUser-agent: HeraldVoyagesHealthUpdater\nDisallow: /countries/');assert.equal(own.allows('/countries/india'),false);
 assert.equal(Parser.sourceUrl('https://evil.test/countries/india'),null);assert.equal(Parser.sourceUrl('https://travelhealthpro.org.uk/search'),null);
});
test('Destination aliases and regions never silently use a different country',()=>{
 for(const code of ['US','GB','CI','CZ','TR','SZ','CV','TL','PS','MK','MM','HK','GF','GL'])assert.ok(Health.lookup(code,{today}).certificates,code);
 assert.equal(Health.lookup('GF',{today}).sourceName,'French Guiana');assert.notEqual(Health.lookup('GF',{today}).url,Health.lookup('FR',{today}).url);
 const hongKong=Health.lookup('CN',{today,healthLocation:'Hong Kong harbour'});assert.equal(hongKong.url,Health.lookup('HK',{today}).url);
 assert.notEqual(Health.lookup('EC',{today,healthLocation:'Galápagos Islands'}).id,Health.lookup('EC',{today}).id);
 assert.equal(Health.lookup('FR',{today,healthLocation:'A hotel named Bali'}).id,Health.lookup('FR',{today}).id,'Region aliases are scoped to their sovereign destination');
 assert.equal(Health.lookup('XX',{today}).status,'unavailable');assert.equal(Health.lookup('VA',{today}).status,'unavailable','Absent Vatican advice is not assumed to be Italy');
 assert.equal(Health.lookup('IN',{today,healthDestination:'not-a-source'}).status,'unavailable');
});
test('Bundled coverage and freshness are truthful, with no fake successful records',()=>{
 const successful=Data.destinations.filter(d=>d.certificates);assert.ok(successful.length>=Data.destinations.length*.95);
 for(const d of successful){assert.ok(Health.safeUrl(d.url));assert.ok(d.retrieved);assert.ok(d.certificates.entries.length);assert.ok(['none','listed'].includes(d.certificates.status));assert.ok([...d.most,...d.some].every(v=>v.name&&Health.safeUrl(v.url)));}
 assert.equal(Health.lookup('IN',{today:'2099-01-01'}).status,'stale');assert.ok(Health.lookup('IN',{today:'2099-01-01'}).certificates);assert.equal(Health.lookup('IN',{today:'2099-01-01'}).notices.length,0);
 const before=JSON.stringify(Data);Health.lookup('IN',{today}).most[0].name='Changed copy';assert.equal(JSON.stringify(Data),before,'Reading health data does not mutate provider records');
});
test('Health failures and destination selection cannot change visa classifications or acknowledgement fingerprints',()=>{
 const baseline=Rules.lookup('GB','IN',{today}),regional=Rules.lookup('GB','IN',{today,healthDestination:Health.lookup('GF',{today}).id}),missing=Rules.lookup('GB','IN',{today,healthDestination:'missing'});
 assert.equal(regional.status,baseline.status);assert.equal(missing.status,baseline.status);assert.equal(missing.health.travelHealthPro.status,'unavailable');assert.equal(regional.fingerprint,baseline.fingerprint,'Advisory vaccine disclosure does not invalidate existing visa acknowledgements');
 const state={activeProfileId:'p',profiles:[{id:'p',citizenships:['GB']}],trips:[],stays:[{id:'s',profileId:'p',countryCode:'FR',location:'French Guiana',start:'2026-11-01',end:'2026-11-03'}],transports:[]},before=JSON.stringify(state),context=Rules.forStay(state,state.stays[0]);assert.equal(Health.lookup('FR',{today,...context.options}).sourceName,'French Guiana');assert.equal(JSON.stringify(state),before);
 const broken={module:{exports:{}},require,URL,Date};vm.runInNewContext(fs.readFileSync('entry-health.js','utf8'),{...broken,require(){throw Error('Unavailable snapshot');}});assert.equal(broken.module.exports.lookup('IN',{today}).status,'unavailable');
});
test('Source HTML, unsafe links and malicious text are never injected into entry results',()=>{
 const dom=new JSDOM('<!doctype html><body>'),w=dom.window;w.HVEntryHealth=Health;w.countryByCode=code=>({name:code});w.fmt=d=>d;vm.runInNewContext(fs.readFileSync('entry-checker.js','utf8'),{window:w,document:w.document,countryByCode:w.countryByCode,fmt:w.fmt});
 const h=Rules.lookup('GB','IN',{today}).health;h.travelHealthPro.most[0].name='<img src=x onerror=alert(1)>';h.travelHealthPro.most[0].summary='<script>alert(1)</script>';h.travelHealthPro.most[0].url='javascript:alert(1)';
 const host=w.document.createElement('div');host.innerHTML=w.HVEntryChecker.healthHtml(h);assert.equal(host.querySelector('img,script,iframe'),null);assert.equal(host.querySelector('a[href^="javascript:"]'),null);assert.match(host.textContent,/<img/);dom.window.close();
});
test('An explicit health destination never inherits another destination certificate assessment',()=>{
 const dom=new JSDOM('<!doctype html><body>'),w=dom.window;w.HVEntryHealth=Health;w.countryByCode=code=>({name:code});w.fmt=d=>d;vm.runInNewContext(fs.readFileSync('entry-checker.js','utf8'),{window:w,document:w.document,countryByCode:w.countryByCode,fmt:w.fmt});
 const baseline=Rules.lookup('GB','GY',{today,arrivingFrom:'BR',age:30}),override=Rules.lookup('GB','GY',{today,arrivingFrom:'BR',age:30,healthDestination:Health.lookup('IS',{today}).id});
 assert.equal(baseline.health.assessment,'required');assert.match(w.HVEntryChecker.healthHtml(baseline.health,'GY'),/Certificate required for the reported route/);
 const html=w.HVEntryChecker.healthHtml(override.health,'GY');assert.match(html,/no certificate requirements/i);assert.doesNotMatch(html,/Certificate required for the reported route|reported route or recent travel/);assert.equal(override.fingerprint,baseline.fingerprint);assert.equal(override.status,baseline.status);dom.window.close();
});

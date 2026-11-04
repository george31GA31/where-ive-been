'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const Journey=require('../journey-model.js'),History=require('../travel-history-model.js'),Visits=require('../country-visit-model.js'),Data=require('../view-data.js'),UI=require('../journey-presentation.js');
const source=fs.readFileSync(path.join(__dirname,'../travel-stats.js'),'utf8');
function fixture(query,label='France'){
 const data={activeProfileId:'p',profiles:[{id:'p',name:'Example',homeCountryCodes:['GB']}],trips:[],stays:[{id:'france',profileId:'p',countryCode:'FR',countryName:label,start:'2026-01-01',end:'2026-01-03',status:'actual'}],accommodations:[],transports:[],placeVisits:[],residences:[],manualCountryVisits:[],tccVisits:[]};
 const dom=new JSDOM('<!doctype html><body data-current-view="stats"></body>',{url:'https://herald.test/#/stats?year='+encodeURIComponent(query),runScripts:'outside-only'});
 Object.assign(dom.window,{HVJourney:Journey,HVTravelHistory:History,HVCountryVisits:Visits,HVData:Data,HVJourneyUI:UI,HVJourneys:{transportLabel:Journey.transportLabel},WIBCountryCount:{isCounted:code=>code==='FR'},countryByCode:code=>({code,name:label})});
 dom.window.eval(source);dom.window.document.body.innerHTML=dom.window.HVTravelStats.cards(data,'2026-10-21');return{dom,data,document:dom.window.document};
}
test('statistics canonicalize only known numeric query years and preserve authoritative counts',()=>{
 for(const query of ['2026','2.026e3','0x7ea',' 2026 ']){
  const {dom,data,document}=fixture(query),before=JSON.stringify(data);
  assert.equal(document.querySelector('[data-year-scope]').value,'2026',query);
  assert.match(document.querySelector('.hv-year-table caption').textContent,/^2026 ·/);
  assert.match(document.querySelector('[data-year-explorer]>p[role=status]').textContent,/3 unique days away in 2026/);
  assert.equal(document.querySelector('.hv-year-table tbody td').textContent,'3');
  assert.equal(JSON.stringify(data),before);dom.window.close();
 }
});
test('malicious or unknown year text cannot create markup, options or an arbitrary date scope',()=>{
 for(const query of ['2026"><img data-injected src=x onerror="globalThis.injected=1">','2026</caption><svg data-injected onload="globalThis.injected=1">','2099','Infinity','__proto__','']){
  const {dom,document}=fixture(query);
  assert.equal(document.querySelector('[data-year-scope]').value,'',query);
  assert.match(document.querySelector('.hv-year-table caption').textContent,/^All recorded years ·/);
  assert.equal(document.querySelector('[data-injected],img,svg,script'),null);
  assert.deepEqual([...document.querySelectorAll('[data-year-scope] option')].map(option=>option.value),['','2026']);
  assert.equal(dom.window.injected,undefined);dom.window.close();
 }
});
test('country labels remain literal text across lifetime insights and year tables',()=>{
 const label='France <img data-injected src=x onerror="globalThis.injected=1"> & "quoted"', {dom,document}=fixture('2026',label);
 assert.equal(document.querySelector('.hv-year-table tbody th').textContent,label);
 assert.match(document.querySelector('[data-travel-stat="countries-year"]').textContent,/France <img data-injected/);
 assert.equal(document.querySelector('[data-injected],img,svg,script'),null);assert.equal(dom.window.injected,undefined);dom.window.close();
});

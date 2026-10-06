'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../account-model'),V=require('../country-visit-model'),Logos=require('../accommodation-logos');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=';
function mergeService(){
 const window={WIBModel:M,addEventListener(){}},context={window,WIBModel:M,document:{readyState:'loading',currentScript:null,addEventListener(){}}};
 const source=fs.readFileSync(require.resolve('../herald.js'),'utf8').replace("window.addEventListener('hv-clear-account-pending'","window.testGuestMerge=merge;window.addEventListener('hv-clear-account-pending'");vm.runInNewContext(source,context);return window.testGuestMerge;
}
const seed=name=>({version:2,activeProfileId:'p',profiles:[{id:'p',name,citizenships:[],enabledRules:['schengen']}],trips:[],stays:[],residences:[],transports:[],accommodations:[],savedPlaces:[],manualCountryVisits:[],tccVisits:[]});
test('guest transfer keeps visit ownership and raw hotel bindings when profile and accommodation IDs collide',()=>{
 const account=seed('Account traveller'),guest=seed('Guest traveller');
 account.accommodations=[{id:'hotel',profileId:'p',propertyName:'Account lodge',location:'Oxford',checkIn:'2025-01-01',checkOut:'2025-01-02'}];
 guest.accommodations=[{id:'hotel',profileId:'p',propertyName:'Guest lodge',location:'Paris',checkIn:'2024-01-01',checkOut:'2024-01-02'}];
 V.setManual(account,'JP',true,{},'2026-10-06');V.setTcc(account,'tcc-scotland',true,{},'2026-10-06');V.setManual(guest,'KI',true,{year:2018},'2026-10-06');V.setTcc(guest,'tcc-sicily',true,{},'2026-10-06');Logos.set(guest,'hotel',image);
 const before=M.copy(account),merge=mergeService(),result=M.copy(merge(account,guest)),profile=result.profiles.find(p=>p.name==='Guest traveller'),hotel=result.accommodations.find(a=>a.propertyName==='Guest lodge');
 assert.notEqual(profile.id,'p');assert.notEqual(hotel.id,'hotel');assert.equal(hotel.profileId,profile.id);assert.equal(Logos.logo(result,hotel.id),image);assert.equal(Logos.logo(result,'hotel'),null);
 assert.equal(result.manualCountryVisits.find(v=>v.countryCode==='KI').profileId,profile.id);assert.equal(result.tccVisits.find(v=>v.destinationId==='tcc-sicily').profileId,profile.id);
 assert.deepEqual(result.manualCountryVisits.find(v=>v.countryCode==='JP'),before.manualCountryVisits[0]);assert.deepEqual(result.tccVisits.find(v=>v.destinationId==='tcc-scotland'),before.tccVisits[0]);assert.deepEqual(account,before);
 assert.deepEqual(M.copy(merge(result,guest)),result,'Importing the same guest history again does not duplicate it');
});

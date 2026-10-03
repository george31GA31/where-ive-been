const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Rules=require('../entry-rules.js'),D=require('../data/entry-requirements/passport-index.js'),G=require('../data/entry-requirements/guidance.js');
const today='2026-10-03';
const check=(p,d,options={})=>Rules.lookup(p,d,{today,...options});

test('Every usable provider route returns a visa answer without a travel date',()=>{
 let usable=0,datasetAnswers=0;const statuses=new Set();
 for(const p of D.codes)for(const d of D.codes){
  if(p===d)continue;const record=Rules.datasetRecord(p,d);if(!record)continue;
  usable++;const r=check(p,d);assert.notEqual(r.status,'unknown',p+' → '+d);assert.equal(r.context.travelDate,null);
  if(r.confidence==='dataset'){datasetAnswers++;statuses.add(r.status);assert.equal(r.status,record.status);assert.equal(r.days,record.days);assert.equal(r.verified,false);assert.equal(r.checked,null);assert.ok(r.sources.some(s=>s.kind==='dataset'));assert.doesNotMatch(r.text,/could not be reliably confirmed|check official/i);}
 }
 assert.equal(usable,39402);assert.ok(datasetAnswers>37000);for(const s of ['visa-free','visa-required','evisa','visa-on-arrival','eta','restricted'])assert.ok(statuses.has(s),s);
});
test('Unusual and ordinary routes keep provider answers and durations',()=>{
 for(const [p,d]of [['GY','LB'],['BR','KZ'],['NG','MN'],['GB','GH'],['GB','AZ'],['GY','TN']]){const record=Rules.datasetRecord(p,d),r=check(p,d);assert.equal(r.status,record.status);assert.equal(r.days,record.days);assert.equal(r.confidence,'dataset');}
 for(const [p,d]of [['TD','GY'],['TL','UA']])assert.notEqual(check(p,d).status,'unknown');
});
test('CTA is reciprocal and remains a citizenship correction after review expiry',()=>{
 for(const [p,d]of [['GB','IE'],['IE','GB']])for(const opts of [{},{today:'2027-01-01'},{days:365},{purpose:'work'},{residency:'residence card'}]){const r=check(p,d,opts);assert.equal(r.status,'conditional-exemption');assert.match(r.title,/Common Travel Area/);assert.match(r.text,/do not need a tourist visa/);assert.equal(r.tone,'good');}
 assert.equal(check('GB','IE',{today:'2027-01-01'}).confidence,'reviewed');assert.equal(check('GB','IE',{today:'2027-01-01'}).verified,false);
});
test('Citizens never receive a tourist visa requirement for their own country',()=>{
 for(const p of ['GB','FR','JP'])for(const opts of [{},{purpose:'study',days:365},{residency:'permit'}]){const r=check(p,p,opts);assert.equal(r.status,'citizen');assert.equal(r.requirement,'citizen');assert.equal(r.days,null);assert.match(r.title,/No tourist visa/);}
});
test('Free movement includes EEA and Switzerland, while Ireland and Cyprus remain outside Schengen',()=>{
 for(const [p,d]of [['FR','IE'],['IE','CH'],['CH','FR'],['NO','CY'],['IS','LI']]){const r=check(p,d);assert.equal(r.id,'europe-free-movement');assert.equal(r.status,'conditional-exemption');assert.equal(r.tone,'good');assert.equal(r.days,null);}
 assert.equal(Rules.schengen.has('IE'),false);assert.equal(Rules.schengen.has('CY'),false);assert.notEqual(check('GB','FR').id,'europe-free-movement');
});
test('Explicit official corrections beat conflicting provider answers, including after a refresh deadline',()=>{
 assert.equal(Rules.datasetRecord('TD','GY').status,'evisa');assert.equal(check('TD','GY').status,'visa-required');
 assert.equal(check('TD','GY',{today:'2027-02-01'}).status,'visa-required');assert.equal(check('TD','GY',{today:'2027-02-01'}).verified,false);
 const index=D.codes.indexOf('IE'),old=D.matrix.GB[index];try{D.matrix.GB[index]=2;Rules.clearCache();assert.equal(check('GB','IE').status,'conditional-exemption');}finally{D.matrix.GB[index]=old;Rules.clearCache();}
});
test('Date is optional; explicit effective dates still control official overrides',()=>{
 assert.equal(check('GB','AZ').status,'evisa');assert.equal(check('GB','AZ',{travelDate:'2026-11-08'}).status,'evisa');
 assert.equal(check('ZA','TH',{travelDate:'2026-09-14'}).days,60);assert.equal(check('ZA','TH',{travelDate:'2026-09-15'}).days,30);
 assert.equal(check('GB','AZ',{travelDate:'2026-02-30'}).status,'unknown');assert.match(check('GB','AZ',{travelDate:'2020-01-01'}).contextNotes.join(' '),/historical/);
});
test('Optional health context affects certificates independently of the visa answer',()=>{
 const simple=check('GB','GY'),risk=check('GB','GY',{arrivingFrom:'BR',age:30}),missing=check('GB','GH'),stale=check('GB','GY',{travelDate:'2027-11-01'});
 assert.equal(simple.status,'visa-free');assert.equal(simple.health.assessment,'conditional');assert.match(simple.health.routeText,/Add those details/);
 assert.equal(risk.status,simple.status);assert.equal(risk.health.assessment,'required');assert.notEqual(simple.fingerprint,risk.fingerprint);
 assert.equal(missing.status,'visa-required');assert.equal(missing.health.assessment,'conditional');assert.equal(stale.status,'visa-free');assert.equal(stale.health.assessment,'unknown');
 assert.match(simple.health.recommendations.join(' '),/recommended/);assert.equal(check('GB','AZ').passport.validity,undefined);
});
test('Long stays, residence permits and special purposes add scope notes without inventing exemptions',()=>{
 const baseline=check('GB','FR');
 for(const opts of [{days:120},{residency:'French residence permit'},{purpose:'work'},{purpose:'transit'}]){const r=check('GB','FR',opts);assert.notEqual(r.status,'unknown');assert.ok(r.contextNotes.length);assert.notEqual(r.fingerprint,baseline.fingerprint);}
 assert.match(check('GB','FR',{days:120}).contextNotes.join(' '),/exceeds/);assert.equal(check('GB','FR',{days:120}).tone,'warn');assert.equal(check('XX','FR').status,'unknown');assert.equal(check('GB','EH').status,'unknown');
});
test('Stay integration uses explicit citizenship, connection context and saved overrides without mutations',()=>{
 const state={activeProfileId:'p',profiles:[{id:'p',citizenships:['TD'],homeCountryCodes:['GB']}],trips:[{id:'t',visaPassportCode:'GB'}],stays:[{id:'s',profileId:'p',tripId:'t',countryCode:'GY',start:'2026-11-08',end:'2026-11-10'}],transports:[{id:'f',profileId:'p',tripId:'t',type:'flight',legs:[{start:{countryCode:'GB'},end:{countryCode:'BR'},startLocal:'2026-11-07T23:00',endLocal:'2026-11-08T08:00Z'},{start:{countryCode:'BR'},end:{countryCode:'GY'},startLocal:'2026-11-08T14:00Z',endLocal:'2026-11-08T16:00'}]}]};
 const before=JSON.stringify(state),r=Rules.forStay(state,state.stays[0]);assert.equal(r.passport,'GB');assert.equal(r.options.travelDate,'2026-11-08');assert.equal(r.options.days,3);assert.equal(r.options.arrivingFrom,'BR');assert.deepEqual(r.options.transit,[{country:'BR',hours:6}]);assert.equal(JSON.stringify(state),before);
 state.stays[0].entryContext={travelDate:'',travelDateOverride:true,transit:[],arrivingFrom:'GB',arrivingFromOverride:true,days:10,daysOverride:true};const edited=Rules.forStay(state,state.stays[0]);assert.equal(edited.options.travelDate,'');assert.deepEqual(edited.options.transit,[]);assert.equal(edited.options.days,10);assert.equal(edited.options.arrivingFrom,'GB');
 state.profiles[0].citizenships=[];delete state.trips[0].visaPassportCode;assert.equal(Rules.forStay(state,state.stays[0]).passport,'','Home country is never a passport');
});
function isolatedRules(){const code=fs.readFileSync(path.join(__dirname,'../entry-rules.js'),'utf8'),sandbox={module:{exports:{}},require:p=>p.endsWith('guidance.js')?G:D,AbortController,setTimeout,clearTimeout};vm.runInNewContext(code,sandbox);return sandbox.module.exports;}
test('Failed and incomplete provider refreshes retain usable bundled answers',async()=>{
 for(const fetcher of [async()=>{throw Error('Offline');},async()=>({ok:true,json:async()=>Object.fromEntries(D.codes.map(p=>[p,{}]))})]){const rules=isolatedRules(),before=rules.lookup('GB','AZ',{today});assert.equal(await rules.refresh(fetcher),false);assert.equal(rules.lookup('GB','AZ',{today}).status,before.status);assert.equal(rules.lookup('GB','IE',{today}).status,'conditional-exemption');}
});

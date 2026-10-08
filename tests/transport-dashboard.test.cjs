'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../transport-dashboard-model.js'),O=require('../transport-operators.js');
const M=require('../account-model.js'),Cache=require('../account-cache.js'),Routes=require('../route-persistence.js');
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=';
const now=Date.parse('2026-10-08T12:00:00Z');
function journey(type='flight',date='2026-10-09',id='journey') {return {id,profileId:'p',type,start:{name:'London',city:'London',iata:'LHR',timezone:'Europe/London',countryCode:'GB',lat:51.47,lon:-.45},end:{name:'New York',city:'New York',iata:'JFK',timezone:'America/New_York',countryCode:'US',lat:40.64,lon:-73.78},startLocal:date+'T18:30',endLocal:date+'T21:00',status:'planned',operator:'Example transport',airline:{name:'Air Algérie'},flightNumber:'AH 6200'};}
const data=records=>({activeProfileId:'p',profiles:[{id:'p'}],trips:[],transports:records});

test('all five modes project existing journeys and individual flight legs without writing data',()=>{
  const record=journey();record.legs=[{...record,id:'one'},{...record,id:'two',flightNumber:'AH 6201',startLocal:'2026-10-10T10:00',endLocal:'2026-10-10T11:00'}];
  const original=data([record,...['train','boat','bus','car'].map(type=>journey(type,'2026-10-09',type)),{...journey(),id:'other-profile',profileId:'q'}]),before=structuredClone(original);
  const rows=D.rows(original);assert.equal(rows.length,6);
  assert.deepEqual(new Set(rows.map(row=>row.type)),new Set(Object.keys(D.modes)));
  assert.deepEqual(original,before);assert.equal(D.mode('ferry'),'boat');assert.equal(D.mode('coach'),'bus');
});
test('timezones determine upcoming/previous and chronology independently of browser timezone',()=>{
  assert.equal(D.instant('2026-10-09T01:00','Asia/Tokyo'),Date.parse('2026-10-08T16:00:00Z'));
  assert.equal(D.instant('2026-07-01T10:00','Europe/London'),Date.parse('2026-07-01T09:00:00Z'));
  assert.equal(D.instant('2026-01-01T10:00','Europe/London'),Date.parse('2026-01-01T10:00:00Z'));
  const record=journey();record.start.timezone=record.end.timezone='Asia/Tokyo';record.startLocal='2026-10-09T01:00';record.endLocal='2026-10-09T03:00';
  const row=D.rows(data([record]))[0];assert.equal(D.period(row,Date.parse('2026-10-08T19:00Z')),'previous');
  assert.equal(D.period(row,now),'upcoming');
});
test('date-only journeys, missing times, overnight and historical journeys have truthful labels',()=>{
  const record=journey('car');record.startLocal='2026-10-09';record.endLocal='2026-10-10';record.dateOnly=true;
  const row=D.rows(data([record]))[0];assert.deepEqual(D.countdown(row,now),{value:1,unit:'day'});
  assert.equal(D.overnight(row),1);
  const dateOnly=D.rows(data([{...record,startLocal:'2026-10-08T12:00',endLocal:'2026-10-08T12:00'}]))[0];assert.equal(D.period(dateOnly,Date.parse('2026-10-08T22:00Z')),'upcoming');assert.deepEqual(D.countdown(dateOnly,now),{value:'',unit:'Today'});
  row.leg.startLocal='2026-10-08T22:30';row.leg.endLocal='2026-10-09T01:15';assert.equal(D.overnight(row),1);
  row.leg.startLocal='2026-10-07T09:00';row.leg.endLocal='2026-10-07T11:00';assert.equal(D.countdown(row,now).unit,'Previous');
  row.leg.startLocal='';row.leg.endLocal='';row.record.startLocal='';row.record.endLocal='';row.start='';assert.equal(D.countdown(row,now).unit,'Date to add');
});
test('mode search, operator, country, year and chronological ordering use existing fields',()=>{
  const rows=D.rows(data([journey('flight','2026-10-11','later'),journey('flight','2026-10-09','first'),journey('train','2026-10-09','rail'),journey('flight','2025-01-01','old')]));
  const filtered=D.filter(rows,{mode:'flight',period:'upcoming',search:'algerie',year:'2026',country:'US'},now);
  assert.deepEqual(filtered.map(row=>row.record.id),['first','later']);
  assert.equal(D.filter(rows,{mode:'train',search:'6200'},now).length,1);
  assert.deepEqual(D.filter(rows,{mode:'flight',period:'previous'},now).map(row=>row.record.id),['old']);
});
test('today countdowns use minutes and hours with correct singular units and no invented status',()=>{
  for(const [local,value,unit]of [['2026-10-08T13:01',1,'minute'],['2026-10-08T13:40',40,'minutes'],['2026-10-08T14:00',1,'hour'],['2026-10-08T15:00',2,'hours']]){const record=journey();record.startLocal=local;record.endLocal='2026-10-08T22:00';const row=D.rows(data([record]))[0];assert.deepEqual(D.countdown(row,now),{value,unit});}
});
test('ordinary flight edits preserve legacy legs exactly when no artwork was chosen',()=>{
  const original=data([]),record=journey();record.legs=[{start:{...record.start},end:{...record.end},airline:{name:'Swiss'},startLocal:record.startLocal,endLocal:record.endLocal,flightNumber:'LX 123'}];const legs=structuredClone(record.legs);O.commit(original,[record]);assert.deepEqual(record.legs,legs);
});
test('operator names normalise accents, case and whitespace conservatively without merging unrelated modes',()=>{
  const original=data([journey()]),before=structuredClone(original.transports);
  const operator=O.set(original,'flight',{name:'Air Algérie',id:'airline-2'},pixel);
  assert.equal(O.logo(original,'flight',{name:'  AIR ALGERIE  '}),pixel);
  assert.equal(O.logo(original,'train','Air Algerie'),null);
  assert.equal(O.logo(original,'flight',{name:'Air Algeria'}),null);
  O.set(original,'flight',{name:'Air Algerie'},null);assert.equal(original.transportOperators.length,1);assert.equal(O.logo(original,'flight',{name:'Air Algérie'}),null);
  assert.equal(original.transportOperators[0].id,operator.id);assert.deepEqual(original.transports,before);
  assert.throws(()=>O.set(original,'flight','',pixel));assert.throws(()=>O.set(original,'flight','Example','https://example.test/logo.png'));
});
test('new, historical and return journeys reuse a single logo and no images are copied into flight records',()=>{
  const original=data([]),first=journey();first.legs=[{...first,airline:{name:'Air Algérie'}}];
  O.commit(original,[first],[{type:'flight',provider:{name:'Air Algérie'},src:pixel}]);original.transports.push(first);
  const second=journey('flight','2026-10-10','second');second.legs=[{...second,airline:O.choice(original.transportOperators[0])}];O.commit(original,[second]);
  assert.equal(second.legs[0].operatorId,first.legs[0].operatorId);assert.equal(original.transportOperators.length,1);
  assert.equal(JSON.stringify(second).includes('data:image'),false);
  const replacement=pixel.replace('AAAC0','AAAB0');O.set(original,'flight','Air Algerie',replacement);
  assert.equal(O.logo(original,'flight',first.legs[0].airline),replacement);
  O.set(original,'flight','Air Algerie',null);assert.equal(O.logo(original,'flight',second.legs[0].airline),null);
});
test('all operator logos merge, import and round-trip through the existing offline account cache',()=>{
  const base={...data([]),transportOperators:[]},phone=structuredClone(base),computer=structuredClone(base);
  O.set(phone,'flight','Air Algérie',pixel);O.set(computer,'train','Eurostar',pixel);
  const result=M.merge(base,phone,computer);assert.equal(result.conflicts.length,0);assert.equal(result.data.transportOperators.length,2);
  const imported=M.importData(base,result.data);assert.equal(imported.conflicts.length,0);assert.equal(imported.data.transportOperators.length,2);M.validateImport(imported.data);
  const snapshot={base:result.data,changes:{transportOperators:{kind:'records',values:[result.data.transportOperators[0]],deleted:[]}}};
  const packed=Cache.pack(snapshot);assert.equal(packed.assets.length,1);assert.deepEqual(Cache.unpack(packed),snapshot);
  const removal=structuredClone(result.data);O.set(removal,'flight','Air Algerie',null);
  const merged=M.merge(result.data,removal,result.data);assert.equal(O.logo(merged.data,'flight','Air Algerie'),null);
});
test('viewing a saved route leaves geometry, signature, provenance and refresh tokens intact',()=>{
  const record=journey();Routes.set(record,0,'flight',record.start,record.end,{coordinates:[[51.47,-.45],[40.64,-73.78]],label:'Saved connection'});
  const original=data([record]),before=structuredClone(original);D.filter(D.rows(original),{mode:'flight'},now);assert.deepEqual(original,before);
});

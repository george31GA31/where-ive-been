'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../travel-tools-model');

function state(){
  return {
    trips:[{id:'trip',name:'Example',start:'2026-10-05',end:'2026-10-09'}],
    stays:[{id:'stay',tripId:'trip',countryCode:'FR',start:'2026-10-05',end:'2026-10-09'}],
    transports:[
      {id:'flight',tripId:'trip',type:'flight',start:{name:'London'},end:{name:'Paris'},startLocal:'2026-10-05T08:00',endLocal:'2026-10-05T10:00',price:{amount:186,currency:'GBP'}},
      {id:'train',tripId:'trip',type:'train',start:{name:'Paris'},end:{name:'Lyon'},startLocal:'2026-10-07T09:00',endLocal:'2026-10-07T11:00',price:{amount:46,currency:'EUR'}}
    ],
    accommodations:[{id:'hotel',tripId:'trip',propertyName:'Herald Hotel',checkIn:'2026-10-05',checkOut:'2026-10-09',price:{amount:420,currency:'EUR'}}],
    placeVisits:[],notes:[],checklists:[],checklistItems:[],budgets:[],budgetItems:[]
  };
}

test('travel tool state is backward compatible and smart checklists use known trip facts',()=>{
  const old={trips:[],stays:[]};M.ensure(old);
  for(const key of ['notes','checklists','checklistItems','budgets','budgetItems'])assert.deepEqual(old[key],[]);
  const items=M.smartItems(state(),'trip').map(x=>x[1]);
  assert.ok(items.includes('Check in for flight when check-in opens'));
  assert.ok(items.includes('Confirm train tickets and seat reservations'));
  assert.ok(items.includes('Confirm accommodation booking and check-in details'));
  assert.ok(items.includes('Review entry requirements for each destination'));
  assert.ok(!items.some(x=>/visa required/i.test(x)),'smart suggestions never invent a legal requirement');
});

test('existing Herald prices feed the right budget categories without changing original currencies',()=>{
  const costs=M.existingCosts(state(),'trip');
  assert.equal(costs.length,3);
  assert.deepEqual(costs.find(x=>x.sourceId==='flight').planned,{amount:186,currency:'GBP'});
  assert.equal(costs.find(x=>x.sourceId==='train').category,'Trains');
  assert.deepEqual(costs.find(x=>x.sourceId==='hotel').planned,{amount:420,currency:'EUR'});
});

test('budget summary counts only reliable base-currency values and keeps foreign amounts visible for conversion',()=>{
  const s=state();const budget={id:'b',tripId:'trip',baseCurrency:'GBP',totalBudget:1000,travellers:2};s.budgets=[budget];
  s.budgetItems=[
    {id:'one',budgetId:'b',include:true,planned:{amount:186,currency:'GBP'},actual:{amount:200,currency:'GBP'},paymentStatus:'Paid'},
    {id:'two',budgetId:'b',include:true,planned:{amount:120,currency:'EUR',baseAmount:104},actual:{amount:110,currency:'EUR',baseAmount:95},paid:{amount:50,currency:'EUR',baseAmount:43},paymentStatus:'Part paid'},
    {id:'three',budgetId:'b',include:true,planned:{amount:40,currency:'JPY'},paymentStatus:'Booked'},
    {id:'hidden',budgetId:'b',include:false,planned:{amount:999,currency:'GBP'},paymentStatus:'Paid'}
  ];
  const result=M.budgetSummary(s,budget);
  assert.equal(result.planned,290);assert.equal(result.actual,295);assert.equal(result.remaining,705);
  assert.equal(result.paid,243);assert.equal(result.outstanding,52);assert.equal(result.missingConversions,1);
  assert.equal(result.days,5);assert.equal(result.costPerDay,59);assert.equal(result.costPerTraveller,147.5);
});

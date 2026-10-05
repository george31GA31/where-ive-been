'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../account-model');
test('notes checklists budgets and expenses merge as independent synced collections',()=>{
  const base={profiles:[],trips:[],stays:[],residences:[],transports:[{id:'t',type:'train',resolvedRoutes:{0:{version:1,signature:'sig',coordinates:[[1,2],[3,4]]}}}],accommodations:[],notes:[],checklists:[],budgets:[],expenses:[],placeVisits:[],savedPlaces:[],visaAcknowledgements:[]};
  const local=JSON.parse(JSON.stringify(base)),remote=JSON.parse(JSON.stringify(base));
  local.notes.push({id:'n',title:'Entry notes',body:'Keep certificate'});
  local.checklists.push({id:'c',title:'Documents',items:[{id:'i',text:'Passport',done:true}]});
  remote.budgets.push({id:'b',tripId:'trip',baseCurrency:'GBP'});
  remote.expenses.push({id:'e',budgetId:'b',tripId:'trip',label:'Hotel',planned:500,currency:'GBP'});
  const merged=M.merge(base,local,remote).data;
  assert.deepEqual(merged.notes,local.notes);assert.deepEqual(merged.checklists,local.checklists);assert.deepEqual(merged.budgets,remote.budgets);assert.deepEqual(merged.expenses,remote.expenses);
  assert.deepEqual(merged.transports[0].resolvedRoutes,base.transports[0].resolvedRoutes);
});
test('device import preserves new travel-tool records',()=>{
  const remote={profiles:[],trips:[],stays:[],residences:[],transports:[],accommodations:[],notes:[],checklists:[],budgets:[],expenses:[],placeVisits:[],savedPlaces:[],visaAcknowledgements:[]};
  const source={...JSON.parse(JSON.stringify(remote)),notes:[{id:'n1',title:'Food'}],checklists:[{id:'c1',title:'Packing'}],budgets:[{id:'b1',tripId:'t1'}],expenses:[{id:'e1',budgetId:'b1',tripId:'t1',actual:20}]};
  const result=M.importData(remote,source).data;
  assert.equal(result.notes.length,1);assert.equal(result.checklists.length,1);assert.equal(result.budgets.length,1);assert.equal(result.expenses.length,1);
});
test('two devices ticking different checklist items combine their completions without a conflict',()=>{
 const base={checklists:[{id:'c',items:[{id:'passport',done:false},{id:'maps',done:false}],sections:[{id:'s',name:'Departure'}]}]},local=M.copy(base),remote=M.copy(base);local.checklists[0].items[0].done=true;remote.checklists[0].items[1].done=true;
 const result=M.merge(base,local,remote);assert.equal(result.conflicts.length,0);assert.ok(result.data.checklists[0].items.every(i=>i.done));
});
test('guest import keeps note and expense references when equivalent source records have different IDs',()=>{
 const remote={profiles:[],trips:[{id:'trip-cloud',name:'Europe'}],transports:[{id:'train-cloud',tripId:'trip-cloud',name:'Train'}],accommodations:[],placeVisits:[{id:'place-cloud',tripId:'trip-cloud',name:'Museum'}],budgets:[{id:'budget-cloud',tripId:'trip-cloud',baseCurrency:'GBP'}]},source={profiles:[],trips:[{id:'trip-device',name:'Europe'}],transports:[{id:'train-device',tripId:'trip-device',name:'Train'}],placeVisits:[{id:'place-device',tripId:'trip-device',name:'Museum'}],budgets:[{id:'budget-device',tripId:'trip-device',baseCurrency:'GBP'}],notes:[{id:'n',tripId:'trip-device',relatedType:'location',relatedId:'place-device'}],expenses:[{id:'e',tripId:'trip-device',budgetId:'budget-device',sourceType:'transport',sourceId:'train-device'}]};
 const result=M.importData(remote,source).data;assert.equal(result.notes[0].relatedId,'place-cloud');assert.equal(result.expenses[0].budgetId,'budget-cloud');assert.equal(result.expenses[0].sourceId,'train-cloud');assert.equal(result.trips.length,1);
});

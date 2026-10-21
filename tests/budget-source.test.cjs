'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('../budget-model');
const expense=()=>({id:'expense',profileId:'p',tripId:'trip',sourceId:'hotel',sourceType:'accommodation',planned:100,actual:90,currency:'GBP',paidAmount:20,paymentStatus:'Part paid',rate:1,rateCurrency:'GBP',unknown:{keep:true}});
const data=()=>({activeProfileId:'p',trips:[{id:'trip'}],accommodations:[{id:'hotel',profileId:'p',tripId:'trip',price:{amount:100,currency:'GBP'}}]});
test('booking snapshots disclose changed prices and keep/update preserve spending and identity',()=>{
 const d=data(),e=expense(),before=structuredClone(d);assert.equal(B.sourceState(d,e).status,'current');assert.deepEqual(d,before);
 d.accommodations[0].price.amount=125;const source=B.sourceState(d,e);assert.equal(source.status,'changed');const kept={...e,sourceReview:{decision:'keep',fingerprint:source.fingerprint}};assert.equal(B.sourceState(d,kept).kept,true);assert.equal(kept.planned,100);
 const updated=B.updateEstimate(e,source);assert.equal(updated.planned,125);assert.deepEqual({...updated,planned:100,sourceSnapshot:undefined,plannedCurrency:undefined},{...e,sourceSnapshot:undefined,plannedCurrency:undefined});assert.equal(B.sourceState(d,updated).status,'current');
 d.accommodations[0].price.amount=150;assert.equal(B.sourceState(d,kept).kept,false);
});
test('a changed source currency only changes the estimate; payment currencies and rates keep their meaning',()=>{
 const d=data(),e=expense();d.accommodations[0].price={amount:175,currency:'USD'};const updated=B.updateEstimate(e,B.sourceState(d,e));assert.equal(updated.currency,'GBP');assert.equal(updated.actual,90);assert.equal(updated.paidAmount,20);assert.equal(updated.plannedCurrency,'USD');
 assert.equal(B.converted(updated,'planned',{baseCurrency:'GBP'}),null);assert.equal(B.converted(updated,'actual',{baseCurrency:'GBP'}),90);
 const total=B.summary([updated],{baseCurrency:'GBP'});assert.equal(total.actual,90);assert.equal(total.paid,20);assert.deepEqual(total.missing,['expense']);
 updated.plannedRate=.8;updated.plannedRateCurrency='GBP';assert.equal(B.converted(updated,'planned',{baseCurrency:'GBP'}),140);
});
test('removed, cancelled, relocated, unpriced and other-traveller sources never overwrite financial history',()=>{
 for(const [expected,mutate] of [['missing',d=>d.accommodations=[]],['cancelled',d=>d.accommodations[0].status='cancelled'],['cancelled',d=>d.trips[0].status='cancelled'],['moved',d=>d.accommodations[0].tripId='elsewhere'],['unpriced',d=>delete d.accommodations[0].price],['missing',d=>d.accommodations[0].profileId='other']]){const d=data(),e=expense(),before=structuredClone(e);mutate(d);const source=B.sourceState(d,e);assert.equal(source.status,expected);assert.deepEqual(B.updateEstimate(e,source),before);}
});

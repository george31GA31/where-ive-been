const test=require('node:test'),assert=require('node:assert/strict'),B=require('../budget-model');
const budget={baseCurrency:'GBP',targetAmount:null};
test('blank actuals and targets stay unknown; the planned total supplies a default budget',()=>{
 const items=[{id:'hotel',currency:'GBP',planned:420,actual:null,paymentStatus:'Booked'}];
 assert.equal(B.converted(items[0],'actual',budget),null);
 assert.deepEqual(B.summary(items,budget),{planned:420,actual:0,paid:0,outstanding:420,target:420,remaining:420,missing:[]});
 assert.equal(B.amount(false),null);assert.equal(B.amount(-1),null);assert.equal(B.amount(0),0);
});
test('deposits, actual zero, refunds and daily spend produce useful paid and outstanding totals',()=>{
 const items=[{id:'hotel',currency:'GBP',planned:500,actual:475,paidAmount:100,paymentStatus:'Deposit paid'},{id:'flight',currency:'GBP',planned:250,actual:263,paymentStatus:'Paid'},{id:'lunch',currency:'GBP',planned:null,actual:18,paymentStatus:'Paid'},{id:'refund',currency:'GBP',planned:50,actual:50,paymentStatus:'Refunded'},{id:'free',currency:'GBP',planned:90,actual:0,paymentStatus:'Paid'},{id:'excluded',currency:'GBP',actual:1000,included:false}];
 const s=B.summary(items,{...budget,targetAmount:1850});
 assert.equal(s.actual,756);assert.equal(s.paid,381);assert.equal(s.outstanding,375);assert.equal(s.remaining,1094);
});
test('foreign money keeps its original value and outdated rates cannot convert a different base currency',()=>{
 const item={id:'train',currency:'EUR',planned:46,actual:46,rate:.86,rateCurrency:'GBP',paymentStatus:'Paid'};
 assert.equal(B.converted(item,'actual',budget),39.56);
 const changed={baseCurrency:'USD',targetAmount:null};assert.equal(B.converted(item,'actual',changed),null);assert.deepEqual(B.summary([item],changed).missing,['train']);assert.equal(item.actual,46);
 assert.equal(B.summary([item],{baseCurrency:'EUR'}).actual,46);
});

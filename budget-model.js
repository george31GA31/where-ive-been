/* Trip budget arithmetic. Blank amounts and unknown rates are never treated as money. */
(function(root){
  'use strict';
  function amount(value){if(value==null||value===''||typeof value==='boolean')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
  function rate(item,budget){
    if(item.currency===budget.baseCurrency)return 1;
    if(item.rateCurrency&&item.rateCurrency!==budget.baseCurrency)return null;
    const r=amount(item.rate);return r>0?r:null;
  }
  function fieldRate(item,field,budget){
    if(field!=='planned'||!item.plannedCurrency||item.plannedCurrency===item.currency)return rate(item,budget);
    return rate({currency:item.plannedCurrency,rate:item.plannedRate,rateCurrency:item.plannedRateCurrency},budget);
  }
  function converted(item,field,budget){const value=amount(item[field]),r=fieldRate(item,field,budget);return value==null||r==null?null:value*r;}
  function summary(items,budget){
    let planned=0,actual=0,paid=0,outstanding=0;const missing=new Set();
    for(const item of items.filter(i=>i.included!==false)){
      const r=rate(item,budget),p=amount(item.planned),a=amount(item.actual),part=amount(item.paidAmount);
      const pr=fieldRate(item,'planned',budget);
      if(pr==null&&p!=null)missing.add(item.id);else planned+=(p??0)*(pr??0);
      if(r==null){if(a!=null||part!=null)missing.add(item.id);continue;}
      const status=item.paymentStatus||'Not booked',sameCurrency=!item.plannedCurrency||item.plannedCurrency===item.currency,cost=a??(sameCurrency?p:0)??0;
      if(!sameCurrency&&a==null&&status!=='Not booked')missing.add(item.id);
      if(status==='Refunded')continue;
      actual+=(a??0)*r;
      const paidOriginal=['Paid','Refund pending'].includes(status)?cost:['Deposit paid','Part paid'].includes(status)?Math.min(cost,part??0):0;
      paid+=paidOriginal*r;
      if(status!=='Not booked')outstanding+=Math.max(0,cost-paidOriginal)*r;
    }
    const target=amount(budget.targetAmount)??planned;
    return{planned,actual,paid,outstanding,target,remaining:target-actual,missing:[...missing]};
  }
  // Resolve pointers read-only. Legacy imports compare with their stored estimate;
  // new imports retain the original source price independently of later edits.
  function sourceState(data,item){
    const collection={accommodation:'accommodations',transport:'transports'}[item.sourceType];
    if(!collection)return null;
    const owner=item.profileId||data.activeProfileId;
    const record=(data[collection]||[]).find(r=>r.id===item.sourceId&&(!r.profileId||owner==='all'||r.profileId===owner));
    const price=record?.price,valid=price&&Number.isFinite(price.amount)&&amount(price.amount)!==null&&/^[A-Z]{3}$/.test(price.currency||'');
    const snapshot=item.sourceSnapshot||{amount:item.planned,currency:item.plannedCurrency||item.currency};
    const status=!record?'missing':record.status==='cancelled'||(data.trips||[]).some(t=>t.id===record.tripId&&t.status==='cancelled')?'cancelled':record.tripId!==item.tripId?'moved':!valid?'unpriced':amount(snapshot.amount)!==amount(price.amount)||snapshot.currency!==price.currency?'changed':'current';
    const fingerprint=JSON.stringify([status,valid?amount(price.amount):null,valid?price.currency:null,record?.tripId||null]);
    return {status,price:valid?{amount:amount(price.amount),currency:price.currency}:null,fingerprint,kept:item.sourceReview?.decision==='keep'&&item.sourceReview.fingerprint===fingerprint};
  }
  function updateEstimate(item,source){
    if(!source?.price||source.status!=='changed')return item;
    const next={...item,planned:source.price.amount,sourceSnapshot:{...source.price}};
    // Spending, payment amounts, their currency and rate keep their original meaning.
    next.plannedCurrency=source.price.currency;
    if((item.plannedCurrency||item.currency)!==source.price.currency){delete next.plannedRate;delete next.plannedRateCurrency;}
    delete next.sourceReview;
    return next;
  }
  const api={amount,rate,fieldRate,converted,summary,sourceState,updateEstimate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVBudget=api;
})(typeof window!=='undefined'?window:globalThis);

/* Trip budget arithmetic. Blank amounts and unknown rates are never treated as money. */
(function(root){
  'use strict';
  function amount(value){if(value==null||value===''||typeof value==='boolean')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
  function rate(item,budget){
    if(item.currency===budget.baseCurrency)return 1;
    if(item.rateCurrency&&item.rateCurrency!==budget.baseCurrency)return null;
    const r=amount(item.rate);return r>0?r:null;
  }
  function converted(item,field,budget){const value=amount(item[field]),r=rate(item,budget);return value==null||r==null?null:value*r;}
  function summary(items,budget){
    let planned=0,actual=0,paid=0,outstanding=0;const missing=new Set();
    for(const item of items.filter(i=>i.included!==false)){
      const r=rate(item,budget),p=amount(item.planned),a=amount(item.actual),part=amount(item.paidAmount);
      if(r==null){if(p!=null||a!=null||part!=null)missing.add(item.id);continue;}
      planned+=(p??0)*r;
      const status=item.paymentStatus||'Not booked',cost=a??p??0;
      if(status==='Refunded')continue;
      actual+=(a??0)*r;
      const paidOriginal=['Paid','Refund pending'].includes(status)?cost:['Deposit paid','Part paid'].includes(status)?Math.min(cost,part??0):0;
      paid+=paidOriginal*r;
      if(status!=='Not booked')outstanding+=Math.max(0,cost-paidOriginal)*r;
    }
    const target=amount(budget.targetAmount)??planned;
    return{planned,actual,paid,outstanding,target,remaining:target-actual,missing:[...missing]};
  }
  const api={amount,rate,converted,summary};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVBudget=api;
})(typeof window!=='undefined'?window:globalThis);

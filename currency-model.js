/* Currency arithmetic and dated reference lookups. Custom rates never enter the reference cache. */
(function(root){
  'use strict';
  const thresholds={good:98,okay:95},cache=new Map(),pending=new Map();
  const amount=value=>value!==''&&value!=null&&typeof value!=='boolean'&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
  const positive=value=>amount(value)>0?Number(value):null;
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  function convert(value,rate){const n=amount(value),r=positive(rate);return n==null||r==null||!Number.isFinite(n*r)?null:n*r;}
  function assess({gave,received,fee=0,feeIncluded=false,reference}){
    const g=positive(gave),r=positive(received),f=amount(fee===''?0:fee),ref=positive(reference);
    if(g==null||r==null||f==null||ref==null||(feeIncluded&&f>=g))return null;
    const paid=g+(feeIncluded?0:f),effective=r/paid,expected=paid*ref,percentage=r/expected*100;
    if(![paid,effective,expected,percentage].every(Number.isFinite))return null;
    return{paid,effective,expected,received:r,percentage,difference:percentage-100,lost:paid-r/ref,destinationDifference:r-expected,verdict:percentage>=thresholds.good?'Good':percentage>=thresholds.okay?'Okay':'Poor'};
  }
  function money(value,code){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:code}).format(value);}catch{return Number(value).toFixed(2)+' '+code;}}
  const rateText=value=>new Intl.NumberFormat('en-GB',{minimumFractionDigits:2,maximumFractionDigits:6}).format(value);
  async function reference(from,to,date='',{fetcher=root.HVNetwork?.request||root.fetch?.bind(root),today=new Date().toISOString().slice(0,10)}={}){
    if(!/^[A-Z]{3}$/.test(from)||!/^[A-Z]{3}$/.test(to)||date&&(!validDate(date)||date>today))throw Error('Choose a valid currency pair and a date up to today.');
    if(from===to)return{base:from,quote:to,rate:1,date:date||today,source:'Same currency'};
    const key=[from,to,date||'latest-'+today].join(':'),saved=cache.get(key);
    if(saved&&Date.now()-saved.fetchedAt<21600000)return saved;
    if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try{
        // Cap the latest lookup at the traveller's date, including publishers
        // whose next-day observation is already visible in a different time zone.
        const url='https://api.frankfurter.dev/v2/rate/'+from.toLowerCase()+'/'+to.toLowerCase()+'?'+new URLSearchParams({date:date||today});
        const response=await fetcher(url,{signal:controller.signal});if(!response.ok)throw Error('No reference rate is available for this pair'+(date?' on that date':'')+'.');
        const row=await response.json(),age=(Date.parse(date||today)-Date.parse(row.date))/86400000;
        if(row.base!==from||row.quote!==to||!positive(row.rate)||!validDate(row.date)||age<0||age>7)throw Error('A suitably dated reference rate is unavailable.');
        const result={base:from,quote:to,rate:Number(row.rate),date:row.date,source:'Frankfurter',fetchedAt:Date.now()};cache.set(key,result);if(cache.size>100)cache.delete(cache.keys().next().value);return result;
      }finally{clearTimeout(timer);}
    })();pending.set(key,task);
    try{return await task;}finally{pending.delete(key);}
  }
  const api={thresholds,amount,positive,validDate,convert,assess,money,rateText,reference};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVCurrency=api;
})(typeof window!=='undefined'?window:globalThis);

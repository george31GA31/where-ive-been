/* Read-only view revisions and bounded derived caches. No account authority or storage. */
(function(root){
  'use strict';
  const states=new WeakMap(),heavy=new Set(['resolvedRoutes','geometry','coordinates','polyline','src','artwork','logoDraft']);
  const collections=['trips','stays','profiles','residences','transports','transportOperators','accommodations','savedPlaces','placeVisits','notes','checklists','budgets','expenses','roadTrips','currencyRates','currencyPreferences','manualCountryVisits','tccVisits','visaAcknowledgements','calendarNotes','calendarPlans','visualLayers','excludedCountryCodes','countryCountExcludedCodes','countryCountIncludedExtraCodes'];
  function entry(data){let saved=states.get(data);if(!saved){saved={fields:new Map(),memo:new Map(),evaluating:0};states.set(data,saved);}return saved;}
  const fingerprint=value=>JSON.stringify(value,(key,item)=>heavy.has(key)?undefined:item);
  function observe(data,keys=collections){
    const saved=entry(data),changed=new Set();
    for(const key of keys){
      const signature=key==='calendarNotes'?fingerprint((Array.isArray(data.notes)?data.notes:[]).filter(r=>typeof r?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date))):key==='routeData'?JSON.stringify((data.transports||[]).map(r=>[r.id,r.resolvedRoutes])):key==='logoData'?JSON.stringify([(data.savedPlaces||[]).map(r=>[r.id,r.accommodationLogo]),(data.transportOperators||[]).map(r=>[r.id,r.operatorLogo])]):fingerprint(data[key]);
      const old=saved.fields.get(key);if(!old||old.signature!==signature){saved.fields.set(key,{signature,version:(old?.version||0)+1});changed.add(key);}
    }
    return changed;
  }
  const managed=typeof module==='undefined'||!module.exports;
  function token(data,keys,extra=''){
    const saved=entry(data);
    if(!managed&&!saved.evaluating)observe(data,keys);else if(keys.some(key=>!saved.fields.has(key)))observe(data,keys);
    return keys.map(key=>saved.fields.get(key).version).join(':')+'|'+extra;
  }
  function memo(data,name,keys,extra,calculate){
    const saved=entry(data),stamp=token(data,keys,extra),old=saved.memo.get(name);if(old?.stamp===stamp)return old.value;
    let value;saved.evaluating++;try{value=calculate();}finally{saved.evaluating--;}
    saved.memo.set(name,{stamp,value});if(saved.memo.size>24)saved.memo.delete(saved.memo.keys().next().value);return value;
  }
  class Intervals{
    constructor(rows,start=row=>row.start,end=row=>row.end){
      const values=rows.map(row=>({row,start:start(row),end:end(row)})).filter(v=>typeof v.start==='string'&&typeof v.end==='string'&&v.end>=v.start).sort((a,b)=>a.start.localeCompare(b.start));
      const build=(lo,hi)=>{if(lo>=hi)return null;const mid=(lo+hi)>>1,node={...values[mid],left:build(lo,mid),right:build(mid+1,hi)};node.maxEnd=[node.end,node.left?.maxEnd,node.right?.maxEnd].filter(Boolean).sort().at(-1);return node;};this.root=build(0,values.length);
    }
    overlap(start,end=start){const rows=[];const visit=node=>{if(!node||node.maxEnd<start)return;visit(node.left);if(node.start<=end&&node.end>=start)rows.push(node.row);if(node.start<=end)visit(node.right);};visit(this.root);return rows;}
    containing(start,end=start){return this.overlap(start,end).filter(row=>row.start<=start&&row.end>=end);}
  }
  const api={observe,token,memo,Intervals,collections};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVData=api;
})(typeof window!=='undefined'?window:globalThis);

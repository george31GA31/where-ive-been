/* Read-only destination guidance; visa classifications and saved records are independent. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 let data;try{data=node?require('./data/entry-requirements/travelhealthpro.js'):root.HVHealthDataset;}catch{data=null;}
 const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const safeUrl=value=>{try{const u=new URL(value);return !u.username&&!u.password&&!u.search&&u.origin==='https://travelhealthpro.org.uk'&&/^\/countries(?:\/[a-z0-9-]+)?$/.test(u.pathname)?u.href:'';}catch{return '';}};
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function resolve(country,input={}){
  if(data?.schema!==1||!Array.isArray(data.destinations))return null;
  const records=data.destinations,explicit=input.healthDestination;
  if(explicit)return records.find(d=>d.id===explicit)||null;
  const place=' '+key(input.healthLocation)+' ',matches=(data.regions||[]).filter(r=>r.parents.includes(country)&&r.names.some(name=>place.includes(' '+key(name)+' ')));
  const ids=[...new Set(matches.map(r=>r.id))];
  // A mixed itinerary is not silently assigned one region's advice.
  const id=ids.length===1?ids[0]:data.countryMap?.[country];return records.find(d=>d.id===id)||null;
 }
 function lookup(country,input={}){
  try{const record=resolve(country,input),today=input.today||new Date().toISOString().slice(0,10);if(!record?.certificates||!Array.isArray(record.certificates.entries)||!Array.isArray(record.most)||!Array.isArray(record.some)||!safeUrl(record.url))return {status:'unavailable',url:safeUrl(record?.url)||'https://travelhealthpro.org.uk/countries',name:record?.name||'',retrieved:record?.retrieved||null};
   const age=(Date.parse(today)-Date.parse(record.retrieved))/86400000,stale=!Number.isFinite(age)||age<0||age>(data.source.staleDays||30),notices=(record.notices||[]).filter(n=>Date.parse(today)>=Date.parse(n.date)&&Date.parse(today)-Date.parse(n.date)<=90*86400000);
   return copy({...record,status:stale?'stale':record.sourceStatus==='retained'?'retained':'available',notices,url:safeUrl(record.url),refreshDays:data.source.refreshDays,licence:data.source.licence});
  }catch{return {status:'unavailable',url:'https://travelhealthpro.org.uk/countries',name:'',retrieved:null};}
 }
 function choices(){return (data?.destinations||[]).map(d=>({id:d.id,name:d.name})).sort((a,b)=>a.name.localeCompare(b.name));}
 const api={lookup,resolve:(country,input)=>copy(resolve(country,input)),choices,safeUrl};if(node)module.exports=api;else root.HVEntryHealth=api;
})(typeof window!=='undefined'?window:globalThis);

/* Provider-neutral entry lookup. No account or travel records are changed here. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 let dataset=node?require('./data/entry-requirements/passport-index.js'):root.HVEntryDataset;
 const guidance=node?require('./data/entry-requirements/guidance.js'):root.HVEntryGuidance;
 const checked=guidance.checked,schengen=new Set('AT BE BG HR CZ DK EE FI FR DE GR HU IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH'.split(' '));
 const requirements={'visa-free':'visa free','visa-required':'visa',evisa:'e-visa','visa-on-arrival':'visa on arrival',eta:'eta','entry-permit':'entry permit','transit-visa':'transit visa','conditional-exemption':'special arrangement',citizen:'citizen',restricted:'restricted',unknown:'unknown'};
 const titles={'visa-free':'Visa-free','visa-required':'Visa required before travel',evisa:'eVisa','visa-on-arrival':'Visa on arrival',eta:'ETA / electronic authorisation','entry-permit':'Entry permit / entry-fee voucher','transit-visa':'Transit visa','conditional-exemption':'Conditional exemption',citizen:'Citizenship destination',restricted:'Entry may be restricted',unknown:'Check official requirements'};
 const datasetStatuses={'visa free':'visa-free','visa required':'visa-required','e-visa':'evisa','visa on arrival':'visa-on-arrival',eta:'eta','no admission':'restricted'};
 const day=86400000,cache=new Map();let refreshPromise,nextRefresh=0;
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 const fresh=(date,today,days)=>validDate(date)&&validDate(today)&&Date.parse(today)-Date.parse(date)<=days*day;
 function context(input={}){
   const today=validDate(input.today)?input.today:new Date().toISOString().slice(0,10);
   return {today,travelDate:input.travelDate||today,purpose:input.purpose||'tourism',days:input.days==null?null:Number(input.days),residency:input.residency||'',arrivingFrom:input.arrivingFrom||'',recentCountries:[...new Set(input.recentCountries||[])].sort(),transit:(input.transit||[]).map(t=>({country:t.country||'',hours:t.hours==null||t.hours===''?null:Number(t.hours)})),age:input.age==null||input.age===''?null:Number(input.age)};
 }
 function datasetRecord(passport,destination){
   const i=dataset.codes.indexOf(destination),encoded=dataset.matrix[passport]?.[i];
   if(!encoded)return null;return {status:datasetStatuses[dataset.statuses[encoded%10]]||'unknown',days:Math.floor(encoded/10)||null};
 }
 function health(destination,c){
   const h=guidance.health[destination];
   if(!h||!fresh(h.checked,c.today,h.refreshDays)||!validDate(c.travelDate)||c.travelDate<h.checked||Date.parse(c.travelDate)-Date.parse(h.checked)>90*day)return {verified:false,text:'Health entry requirements have not been reliably verified for this destination and travel date. Check official health guidance, including recent travel and transit.',assessment:'unknown',sources:[]};
   const risk=new Set(guidance.yellowFeverRisk),originRisk=risk.has(c.arrivingFrom),recentRisk=c.recentCountries.some(code=>risk.has(code)),transitRisk=c.transit.some(t=>risk.has(t.country)&&t.hours!=null&&t.hours>h.transitHours),unknownTransit=c.transit.some(t=>risk.has(t.country)&&t.hours==null);
   const ageKnown=c.age!=null&&c.age>=0,eligible=!ageKnown|| (h.exclusiveAge?c.age>h.minAge:c.age>=h.minAge),routeRisk=h.universal||originRisk||recentRisk||transitRisk;
   let assessment=!eligible?'below-age-threshold':routeRisk&&ageKnown?'required':'conditional';
   const routeText=!eligible?'The reported age is below this certificate threshold.':routeRisk?'Your reported route or recent travel falls within this rule'+(ageKnown?'.':' if the traveller meets its age threshold.'):unknownTransit?'Transit duration is needed to assess the reported risk-country connection.':h.universal?'This rule applies regardless of route.':'The certificate rule is conditional. Check all recent travel and transit; passport nationality alone does not trigger it.';
   return {...h,verified:true,assessment,routeText,sources:[...h.sources,guidance.riskSource]};
 }
 function fingerprint(r){return JSON.stringify([r.passportCode,r.destinationCode,r.status,r.indicative?.status||'',r.days||null,r.stay||'',r.passport||{},r.text,r.health?.text||'',r.health?.assessment||'',r.health?.routeText||'',r.other||[]]);}
 function lookup(passport,destination,input={}){
   passport=String(passport||'').toUpperCase();destination=String(destination||'').toUpperCase();const c=context(input),key=JSON.stringify([passport,destination,c]);
   const cached=cache.get(key);if(cached&&cached.expires>Date.now())return structuredCopy(cached.value);
   const indicative=datasetRecord(passport,destination),sources=indicative?[dataset.source]:[];
   let r={passportCode:passport,destinationCode:destination,context:c,status:'unknown',verified:false,title:titles.unknown,tone:'neutral',requirement:'unknown',checked:null,retrieved:dataset.source.retrieved,sources,indicative,stay:'Not reliably verified',passport:{},other:[],text:indicative?'The open dataset suggests '+titles[indicative.status].toLowerCase()+'. Current official requirements could not be reliably confirmed for these details.':'Current requirements could not be reliably confirmed for this passport and destination.',uncertainty:'Official confirmation recommended'};
   const invalid=!dataset.codes.includes(passport)||!destination||!validDate(c.travelDate)||c.days!=null&&(!Number.isInteger(c.days)||c.days<1)||!['tourism','business'].includes(c.purpose)||!!c.residency;
   if(!invalid&&passport===destination){r={...r,status:'citizen',verified:true,title:titles.citizen,text:'Check the passport or identity document required for entry as a citizen.',stay:'Citizenship rules apply',sources:[],checked:null,uncertainty:''};}
   else if(!invalid){
     const found=guidance.rules.find(rule=>(rule.passports.includes(passport)||rule.passports.includes('*'))&&(!rule.datasetStatuses||rule.datasetStatuses.includes(indicative?.status))&&rule.destinations.includes(destination)&&rule.purposes.includes(c.purpose)&&(!rule.validFrom||c.travelDate>=rule.validFrom)&&(!rule.validTo||c.travelDate<=rule.validTo)&&fresh(rule.checked,c.today,rule.refreshDays)&&(rule.validFrom||c.travelDate>=rule.checked)&&Date.parse(c.travelDate)-Date.parse(rule.checked)<=90*day);
     if(found&&!(c.days&&found.days&&c.days>found.days))r={...r,...structuredCopy(found),passportCode:passport,destinationCode:destination,context:c,verified:true,indicative:null,uncertainty:'',stay:found.stay||(found.days?'Up to '+found.days+' days':'Depends on the visa or permission issued')};
     else if(c.days&&found?.days&&c.days>found.days)r.text='The requested stay exceeds the reviewed short-visit allowance. Check the permission needed for this duration.';
   }
   if(invalid){r.indicative=null;r.text=!validDate(c.travelDate)?'Choose a valid travel date.':'No verified rule covers these details. Special purpose, residence, passport category or transit exemptions require official confirmation.';}
   r.requirement=requirements[r.status]||'unknown';r.title=r.title===titles.unknown&&r.verified?titles[r.status]:r.title;r.tone=['visa-free','citizen'].includes(r.status)||r.status==='conditional-exemption'&&r.id?.startsWith('cta')?'good':['visa-required','restricted','transit-visa'].includes(r.status)?'bad':r.status==='unknown'?'neutral':'warn';
   r.health=health(destination,c);r.sources=[...r.sources,...r.health.sources].filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i);r.source=r.sources.find(s=>s.kind==='official')?.url||r.sources[0]?.url||'';r.fingerprint=fingerprint(r);
   if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{value:structuredCopy(r),expires:Date.now()+10*60000});return r;
 }
 const structuredCopy=value=>JSON.parse(JSON.stringify(value));
 async function refresh(fetcher=root.fetch?.bind(root)){
   if(!fetcher||Date.now()<nextRefresh)return false;if(refreshPromise)return refreshPromise;
   if(fresh(dataset.source.updated,new Date().toISOString().slice(0,10),30))return false;
   refreshPromise=(async()=>{
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
     try{
       const url='https://raw.githubusercontent.com/imorte/passport-index-data/main/passport-index.json';
       const res=await fetcher(url,{signal:controller.signal,cache:'no-cache'});if(!res.ok)throw new Error('Dataset unavailable');const raw=await res.json();
       const codes=Object.keys(raw).sort(),matrix={};if(codes.length<190||codes.some(c=>!/^\w{2}$/.test(c)))throw new Error('Invalid provider snapshot');
       for(const p of codes){matrix[p]=codes.map(d=>{const item=raw[p][d],status=dataset.statuses.indexOf(item?.status);if(!item)return 0;if(status<0||item.days!=null&&(!Number.isInteger(item.days)||item.days<0||item.days>1000))throw new Error('Invalid provider value');return (item.days||0)*10+status;});}
       // A refreshed, unversioned response remains provisional; do not invent a checked date.
       dataset={codes,matrix,statuses:dataset.statuses,source:{...dataset.source,updated:null,retrieved:new Date().toISOString().slice(0,10)}};cache.clear();nextRefresh=Date.now()+day;return true;
     }catch{nextRefresh=Date.now()+60*60000;return false;}finally{clearTimeout(timer);refreshPromise=null;}
   })();return refreshPromise;
 }
 function forStay(state,stay){
   const profile=(state.profiles||[]).find(p=>p.id===(stay.profileId||state.activeProfileId)),trip=(state.trips||[]).find(t=>t.id===stay.tripId),passport=trip?.visaPassportCode||stay.visaPassportCode||(profile?.citizenships?.length===1?profile.citizenships[0]:'');
   const transport=(state.transports||[]).filter(t=>t.status!=='cancelled'&&(!t.profileId||t.profileId===profile?.id)&&(!stay.tripId||t.tripId===stay.tripId));
   const arrivals=transport.flatMap(t=>t.type==='flight'&&t.legs?.length?t.legs:[t]).filter(l=>l.end?.countryCode===stay.countryCode&&String(l.endLocal||'').slice(0,10)===stay.start&&l.start?.countryCode&&l.start.countryCode!==stay.countryCode);
   let arrivingFrom=arrivals.length===1?arrivals[0].start.countryCode:'';
   if(!arrivingFrom&&stay.tripId){const preceding=(state.stays||[]).filter(s=>s.id!==stay.id&&s.tripId===stay.tripId&&s.status!=='cancelled'&&s.countryCode!==stay.countryCode&&s.end<=stay.start).sort((a,b)=>b.end.localeCompare(a.end));if(preceding[0]&&preceding[0].end>=new Date(Date.parse(stay.start)-day).toISOString().slice(0,10)&&(!preceding[1]||preceding[1].end!==preceding[0].end))arrivingFrom=preceding[0].countryCode;}
   const days=validDate(stay.start)&&validDate(stay.end)?Math.round((Date.parse(stay.end)-Date.parse(stay.start))/day)+1:null;
   return {profile,trip,passport,options:{...(stay.entryContext||{}),days:stay.entryContext?.daysOverride?stay.entryContext.days:days,arrivingFrom:stay.entryContext?.arrivingFromOverride?stay.entryContext.arrivingFrom:arrivingFrom,travelDate:stay.entryContext?.travelDateOverride?stay.entryContext.travelDate:stay.start}};
 }
 const api={lookup,refresh,context,forStay,fingerprint,checked,schengen,datasetRecord,coverage:()=>({passports:dataset.codes.length,routes:dataset.codes.length*(dataset.codes.length-1),updated:dataset.source.updated,retrieved:dataset.source.retrieved}),clearCache:()=>cache.clear()};
 if(node)module.exports=api;else root.HVEntryRules=api;
})(typeof window!=='undefined'?window:globalThis);

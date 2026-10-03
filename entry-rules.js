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
 const fresh=(date,today,days)=>validDate(date)&&validDate(today)&&today>=date&&Date.parse(today)-Date.parse(date)<=days*day;
 function context(input={}){
   const today=validDate(input.today)?input.today:new Date().toISOString().slice(0,10);
   return {today,travelDate:input.travelDate||null,purpose:input.purpose||'tourism',days:input.days==null||input.days===''?null:Number(input.days),residency:input.residency||'',arrivingFrom:input.arrivingFrom||'',recentCountries:[...new Set(input.recentCountries||[])].sort(),transit:(input.transit||[]).map(t=>({country:t.country||'',hours:t.hours==null||t.hours===''?null:Number(t.hours)})),age:input.age==null||input.age===''?null:Number(input.age)};
 }
 function datasetRecord(passport,destination){
   const i=dataset.codes.indexOf(destination),encoded=dataset.matrix[passport]?.[i];
   const status=datasetStatuses[dataset.statuses[encoded%10]];
   if(!Number.isInteger(encoded)||encoded<=0||!status)return null;
   return {status,days:Math.floor(encoded/10)||null};
 }
 function health(destination,c){
   const h=guidance.health[destination],date=c.travelDate||c.today;
   if(!h)return {verified:false,text:'Health entry rules are not included for this destination. Consult destination health guidance for certificate requirements.',assessment:'unknown',sources:[]};
   if(!fresh(h.checked,c.today,h.refreshDays)||!validDate(date)||date<h.checked||Date.parse(date)-Date.parse(h.checked)>90*day)return {...h,verified:false,assessment:'unknown',routeText:'This health rule has not been confirmed for your travel date. Confirm certificate requirements before travel.',sources:[...h.sources,guidance.riskSource]};
   const risk=new Set(guidance.yellowFeverRisk),originRisk=risk.has(c.arrivingFrom),recentRisk=c.recentCountries.some(code=>risk.has(code)),transitRisk=c.transit.some(t=>risk.has(t.country)&&t.hours!=null&&t.hours>h.transitHours),unknownTransit=c.transit.some(t=>risk.has(t.country)&&t.hours==null);
   const ageKnown=c.age!=null&&c.age>=0,eligible=!ageKnown|| (h.exclusiveAge?c.age>h.minAge:c.age>=h.minAge),routeRisk=h.universal||originRisk||recentRisk||transitRisk;
   let assessment=!eligible?'below-age-threshold':routeRisk&&ageKnown?'required':'conditional';
   const routeText=!eligible?'The reported age is below this certificate threshold.':routeRisk?'Your reported route or recent travel falls within this rule'+(ageKnown?'.':' if the traveller meets its age threshold. Add the traveller age to assess it.'):unknownTransit?'Add the transit duration to assess the reported risk-country connection.':'Requirements depend on where you arrive from, recent travel and transit. Add those details and the traveller age for a more precise assessment.';
   return {...h,verified:true,assessment,routeText,sources:[...h.sources,guidance.riskSource]};
 }
 function fingerprint(r){const parts=[r.passportCode,r.destinationCode,r.status,r.indicative?.status||'',r.days||null,r.stay||'',r.passport||{},r.text,r.health?.text||'',r.health?.assessment||'',r.health?.routeText||'',r.other||[]];if(r.contextNotes?.length)parts.push(r.contextNotes);return JSON.stringify(parts);}
 function lookup(passport,destination,input={}){
   passport=String(passport||'').toUpperCase();destination=String(destination||'').toUpperCase();const c=context(input),key=JSON.stringify([passport,destination,c]);
   const cached=cache.get(key);if(cached&&cached.expires>Date.now())return structuredCopy(cached.value);
   const record=datasetRecord(passport,destination),date=c.travelDate||c.today;
   let r={passportCode:passport,destinationCode:destination,context:c,status:record?.status||'unknown',verified:false,confidence:record?'dataset':'unknown',title:titles[record?.status||'unknown'],tone:'neutral',requirement:'unknown',checked:null,retrieved:dataset.source.retrieved,sources:record?[dataset.source]:[],indicative:null,days:record?.days||null,stay:record?.days?'Up to '+record.days+' days':record?'The dataset does not specify a maximum stay. Follow the permission granted.':'Not available for this route',passport:{},other:[],contextNotes:[],text:record?({ 'visa-free':'A tourist visa is not required for an ordinary-passport short visit.', 'visa-required':'Arrange a visa before travel.', evisa:'Apply for an eVisa before travel.', 'visa-on-arrival':'A visa on arrival is listed for this passport and destination.', eta:'Electronic travel authorisation is listed for this passport and destination.', restricted:'The dataset lists no admission for this passport and destination.' })[record.status]:'No usable visa rule is available for this passport and destination.',uncertainty:''};
   const invalid=!dataset.codes.includes(passport)||!destination||!validDate(date)||c.days!=null&&(!Number.isInteger(c.days)||c.days<1);
   if(!invalid&&passport===destination){r={...r,status:'citizen',confidence:'citizenship',verified:true,title:'No tourist visa required as a citizen',text:'You are travelling to your country of citizenship. Carry the passport or identity document required for entry as a citizen.',stay:'Citizenship rules apply',sources:[],days:null,checked:null};}
   else if(!invalid){
     // A review deadline affects confidence, not whether a known correction survives.
     // Explicit effective periods always control date-specific overrides.
     const applicable=guidance.rules.filter(rule=>(rule.passports.includes(passport)||rule.passports.includes('*'))&&(!rule.datasetStatuses||rule.datasetStatuses.includes(record?.status))&&rule.destinations.includes(destination)&&rule.purposes.includes(c.purpose)&&(!rule.validFrom||date>=rule.validFrom)&&(!rule.validTo||date<=rule.validTo)&&(rule.validFrom||!c.travelDate||date>=rule.checked));
     const found=applicable.find(rule=>!rule.passports.includes('*'))||applicable[0];
     if(found){const verified=fresh(found.checked,c.today,found.refreshDays)&&Date.parse(date)-Date.parse(found.checked)<=90*day;r={...r,...structuredCopy(found),passportCode:passport,destinationCode:destination,context:c,title:found.title||titles[found.status],verified,confidence:verified?'official':'reviewed',indicative:null,days:found.days||null,stay:found.stay||(found.days?'Up to '+found.days+' days':'Depends on the visa or permission issued')};}
   }
   if(invalid)r={...r,status:'unknown',confidence:'unknown',title:titles.unknown,days:null,text:!validDate(date)?'Choose a valid travel date.':c.days!=null&&(!Number.isInteger(c.days)||c.days<1)?'Choose a valid stay length.':'Choose a supported passport nationality and destination.',stay:'Not available for these details'};
   if(!invalid&&r.status!=='citizen'){
     if(!['tourism','business'].includes(c.purpose)&&!r.id?.startsWith('cta'))r.contextNotes.push('The visa status above is for ordinary-passport short visits. '+(c.purpose==='transit'?'Airport transit conditions need a separate check; this is not a transit clearance.':'Work, study and other purposes may require separate permission.'));
     if(c.residency)r.contextNotes.push('The visa status above is based on passport nationality. A residence permit or special status may change eligibility; no exemption has been assumed.');
     if(c.days&&r.days&&c.days>r.days)r.contextNotes.push('Your '+c.days+'-day stay exceeds the '+r.days+'-day short-visit allowance. Arrange the permission required for a longer stay.');
     if(c.travelDate&&c.travelDate<c.today&&r.confidence==='dataset')r.contextNotes.push('This is the latest available dataset result, not a verified historical rule for the selected date.');
   }
   r.requirement=requirements[r.status]||'unknown';r.tone=['visa-free','citizen'].includes(r.status)||r.status==='conditional-exemption'&&(/^(cta|europe-free-movement)/.test(r.id||''))?'good':['visa-required','restricted','transit-visa'].includes(r.status)?'bad':r.status==='unknown'?'neutral':'warn';
   if(c.days&&r.days&&c.days>r.days)r.tone='warn';
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
       const usable=codes.reduce((n,p)=>n+matrix[p].filter((value,i)=>codes[i]!==p&&datasetStatuses[dataset.statuses[value%10]]).length,0);
       if(usable<codes.length*(codes.length-1)*.95)throw new Error('Incomplete provider snapshot');
       // A refreshed, unversioned response remains provisional; do not invent a checked date.
       dataset={codes,matrix,statuses:dataset.statuses,source:{...dataset.source,updated:null,retrieved:new Date().toISOString().slice(0,10)}};cache.clear();nextRefresh=Date.now()+day;return true;
     }catch{nextRefresh=Date.now()+60*60000;return false;}finally{clearTimeout(timer);refreshPromise=null;}
   })();return refreshPromise;
 }
 function forStay(state,stay){
   const profile=(state.profiles||[]).find(p=>p.id===(stay.profileId||state.activeProfileId)),trip=(state.trips||[]).find(t=>t.id===stay.tripId),passport=trip?.visaPassportCode||stay.visaPassportCode||(profile?.citizenships?.length===1?profile.citizenships[0]:'');
   const transport=(state.transports||[]).filter(t=>t.status!=='cancelled'&&(!t.profileId||t.profileId===profile?.id)&&(!stay.tripId||t.tripId===stay.tripId));
   const arrivals=transport.flatMap(t=>(t.type==='flight'&&t.legs?.length?t.legs:[t]).map((leg,index)=>({leg,index,transport:t}))).filter(({leg:l})=>l.end?.countryCode===stay.countryCode&&String(l.endLocal||'').slice(0,10)===stay.start&&l.start?.countryCode&&l.start.countryCode!==stay.countryCode);
   let arrivingFrom=arrivals.length===1?arrivals[0].leg.start.countryCode:'';
   if(!arrivingFrom&&stay.tripId){const preceding=(state.stays||[]).filter(s=>s.id!==stay.id&&s.tripId===stay.tripId&&s.status!=='cancelled'&&s.countryCode!==stay.countryCode&&s.end<=stay.start).sort((a,b)=>b.end.localeCompare(a.end));if(preceding[0]&&preceding[0].end>=new Date(Date.parse(stay.start)-day).toISOString().slice(0,10)&&(!preceding[1]||preceding[1].end!==preceding[0].end))arrivingFrom=preceding[0].countryCode;}
   const days=validDate(stay.start)&&validDate(stay.end)?Math.round((Date.parse(stay.end)-Date.parse(stay.start))/day)+1:null;
   const transit=[];
   if(arrivals.length===1){const arrival=arrivals[0],legs=arrival.transport.type==='flight'?arrival.transport.legs||[]:[];for(let i=0;i<arrival.index;i++){const country=legs[i].end?.countryCode;if(country&&country!==stay.countryCode){const end=legs[i].endLocal||'',start=legs[i+1]?.startLocal||'',explicit=/[Zz]|[+-]\d{2}:\d{2}$/.test(end)&&/[Zz]|[+-]\d{2}:\d{2}$/.test(start),hours=explicit?(Date.parse(start)-Date.parse(end))/3600000:null;transit.push({country,hours:Number.isFinite(hours)&&hours>=0?hours:null});}}}
   return {profile,trip,passport,options:{transit,...(stay.entryContext||{}),days:stay.entryContext?.daysOverride?stay.entryContext.days:days,arrivingFrom:stay.entryContext?.arrivingFromOverride?stay.entryContext.arrivingFrom:arrivingFrom,travelDate:stay.entryContext?.travelDateOverride?stay.entryContext.travelDate:stay.start}};
 }
 const api={lookup,refresh,context,forStay,fingerprint,checked,schengen,datasetRecord,coverage:()=>({passports:dataset.codes.length,routes:dataset.codes.length*(dataset.codes.length-1),updated:dataset.source.updated,retrieved:dataset.source.retrieved}),clearCache:()=>cache.clear()};
 if(node)module.exports=api;else root.HVEntryRules=api;
})(typeof window!=='undefined'?window:globalThis);

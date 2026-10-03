/* Shared compact inputs and result presentation for the page, trips and Calendar. */
(() => {
 'use strict';
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=code=>countryByCode(code)?.name||code;
 function optionsHtml(options={},prefix='entry'){
   return `<details class="entry-visit-options"><summary>Add trip details (optional)</summary><div class="entry-core-options">
     <label class="field"><span>Travel date (optional)</span><input id="${prefix}TravelDate" name="travelDate" type="date" value="${E(options.travelDate||'')}"></label>
     <label class="field"><span>Length of stay (days)</span><input id="${prefix}Length" name="days" type="number" min="1" step="1" value="${E(options.days||'')}"></label>
     <label class="field"><span>Purpose</span><select id="${prefix}Purpose" name="purpose">${[['tourism','Tourism'],['business','Business meetings'],['work','Work'],['study','Study'],['transit','Transit']].map(([value,text])=>`<option value="${value}" ${value===(options.purpose||'tourism')?'selected':''}>${text}</option>`).join('')}</select></label>
     <label class="field"><span>Arriving from</span><input id="${prefix}ArrivingFrom" name="arrivingFrom" list="countryList" placeholder="Country of departure" value="${E(label(options.arrivingFrom||''))}" autocomplete="off"></label>
     <label class="field"><span>Recently visited countries</span><input name="recentCountries" placeholder="Countries separated by commas" value="${E((options.recentCountries||[]).map(label).join(', '))}"></label>
     <label class="field"><span>Transit countries and hours</span><input name="transit" placeholder="e.g. Ghana: 5, Brazil: 13" value="${E((options.transit||[]).map(t=>label(t.country)+': '+(t.hours??'')).join(', '))}"></label>
     <label class="field"><span>Traveller age (years)</span><input name="age" type="number" min="0" max="120" step="0.01" value="${E(options.age??'')}"></label>
     <label class="field"><span>Residence permit or special status</span><input id="${prefix}Residency" name="residency" value="${E(options.residency||'')}" placeholder="If applicable"></label>
     <label class="field"><span>Health destination (optional)</span><select name="healthDestination"><option value="">Automatic from destination or trip location</option>${(window.HVEntryHealth?.choices()||[]).map(d=>'<option value="'+E(d.id)+'" '+(d.id===options.healthDestination?'selected':'')+'>'+E(d.name)+'</option>').join('')}</select></label>
   </div><p class="helper">These details refine your result. Recent travel, transit and age can affect health certificate requirements.</p></details>`;
 }
 function read(host){
   const value=name=>host.querySelector(`[name="${name}"]`)?.value.trim()||'',code=text=>countryByName(text)?.code||countryByCode(text.toUpperCase())?.code;
   const options={travelDate:value('travelDate'),purpose:value('purpose')||'tourism',days:value('days')?Number(value('days')):null,residency:value('residency'),arrivingFrom:'',recentCountries:[],transit:[],age:value('age')?Number(value('age')):null,healthDestination:value('healthDestination')};
   if(options.healthDestination&&!window.HVEntryHealth?.choices().some(d=>d.id===options.healthDestination))return {error:'Choose a supported health destination.'};
   if(options.travelDate&&!HVJourney.validDate(options.travelDate))return {error:'Choose a valid travel date or leave it blank.'};
   for(const name of ['arrivingFrom','recentCountries']){const terms=value(name).split(',').map(s=>s.trim()).filter(Boolean),codes=terms.map(code);if(codes.some(c=>!c||c==='SEA'))return {error:'Choose valid countries for departure and recent travel.'};if(name==='arrivingFrom'){if(codes.length>1)return {error:'Choose one country of departure.'};options.arrivingFrom=codes[0]||'';}else options.recentCountries=codes;}
   for(const term of value('transit').split(',').map(s=>s.trim()).filter(Boolean)){const [place,hours,...extra]=term.split(':').map(s=>s.trim()),country=code(place);if(!country||country==='SEA'||extra.length||hours&&(!Number.isFinite(Number(hours))||Number(hours)<0))return {error:'Use a valid transit country and duration, such as Ghana: 5.'};options.transit.push({country,hours:hours?Number(hours):null});}
   if(options.days!=null&&(!Number.isInteger(options.days)||options.days<1)||options.age!=null&&(!Number.isFinite(options.age)||options.age<0||options.age>120))return {error:'Check the stay length and traveller age.'};
   return {options};
 }
 function healthHtml(health,destination){
   const h=health.travelHealthPro||{status:'unavailable'},url=window.HVEntryHealth?.safeUrl(h.url)||'https://travelhealthpro.org.uk/countries';
   const link=(text,target=url)=>'<a href="'+E(window.HVEntryHealth?.safeUrl(target)||url)+'" target="_blank" rel="noopener noreferrer">'+E(text)+' ↗</a>';
   // An explicitly chosen territory can have different certificates from the visa destination.
   const sameSource=!destination||url===window.HVEntryHealth?.lookup(destination).url;
   const route=sameSource&&health.routeText?'<p class="helper">'+E(health.routeText)+'</p>':'';
   const assessment=sameSource&&health.assessment==='required'?'<p class="entry-uncertainty">Certificate required for the reported route and age.</p>':'';
   const legacy=sameSource&&health.vaccine?'<h4>Certificate requirements</h4><strong>'+E(health.vaccine)+'</strong><p>'+E(health.text)+'</p>'+route+assessment:'';
   if(!h.certificates)return '<section class="entry-health"><h3>Health</h3>'+legacy+'<p>Detailed health information is not currently available in Herald for this destination.</p><p>'+link('View TravelHealthPro health guidance')+'</p></section>';
   const vaccine=v=>'<details class="entry-vaccine" data-health-vaccine="'+E(v.name)+'"><summary>'+E(v.name)+'</summary>'+(v.risk||[]).map(t=>'<p class="helper">'+E(t)+'</p>').join('')+(v.summary?'<p>'+E(v.summary)+'</p>':'')+(v.considerations?.length?'<ul>'+v.considerations.map(t=>'<li>'+E(t)+'</li>').join('')+'</ul>':'')+'<p class="helper">'+link('Full guidance and qualifications',v.url)+'</p></details>';
   const group=(title,list)=>list?.length?'<div class="entry-health-group"><h4>'+title+'</h4>'+list.map(vaccine).join('')+'</div>':'';
   const entries=h.certificates.entries||[],yf=entries.some(t=>/yellow fever/i.test(t));
   const certificate='<h4>Certificate requirements</h4>'+(yf?'<h5>Yellow fever entry requirement</h5>':'')+entries.slice(0,2).map(t=>'<p>'+E(t)+'</p>').join('')+(entries.length>2?'<details class="entry-health-conditions"><summary>View certificate conditions</summary><ul>'+entries.slice(2).map(t=>'<li>'+E(t)+'</li>').join('')+'</ul></details>':'')+(health.vaccine?route+assessment:'');
   const malaria=h.malaria?'<div class="entry-health-group"><h4>Malaria</h4><ul>'+h.malaria.areas.map(t=>'<li>'+E(t)+'</li>').join('')+'</ul><p class="helper">'+link('Full malaria guidance',h.malaria.url)+'</p></div>':'';
   const yfRecommendation=h.yellowFever?.recommendation?'<div class="entry-health-group"><h4>Yellow fever vaccination recommendation</h4><p class="helper">Listed for '+(h.most.some(v=>v.name==='Yellow fever')?'most':'some')+' travellers, separately from entry certificates. Expand the Yellow fever row above for the source guidance.</p></div>':h.yellowFever?.entry.some(t=>/no risk of yellow fever/i.test(t))?'<div class="entry-health-group"><h4>Yellow fever vaccination recommendation</h4><p>The source reports no yellow fever transmission risk in this destination. Certificate conditions can still apply.</p></div>':'';
   const notices=h.notices?.length?'<div class="entry-health-group"><h4>Current health notices</h4>'+h.notices.map(n=>'<details class="entry-health-notice"><summary>'+E(n.title)+' · '+E(fmt(n.date))+'</summary>'+(n.summary?'<p>'+E(n.summary)+'</p>':'')+(n.status?'<p class="helper">'+E(n.status)+'</p>':'')+'<p>'+link('View source notice',n.url)+'</p></details>').join('')+'</div>':'';
   return '<section class="entry-health" data-health-source-status="'+E(h.status)+'"><h3>Health</h3><p class="helper">'+E(h.name)+(h.sourceName&&h.sourceName!==h.name?' · source guidance covers '+E(h.sourceName):'')+'</p>'+certificate+group('Recommended for most travellers',h.most)+group('Recommended for some travellers',h.some)+yfRecommendation+malaria+notices+'<p class="helper entry-health-advice">Recommendations depend on age, medical history, itinerary and activities. Discuss suitability with a travel-health professional.</p><p class="helper">Health information: '+link('TravelHealthPro (NaTHNaC)')+' · retrieved '+E(fmt(h.retrieved))+'.</p>'+(h.status!=='available'?'<p class="helper">Saved source guidance; it may have changed since retrieval.</p>':'')+'<p class="helper">Health guidance can change. Check the source before travelling.</p></section>';
 }
 function resultHtml(rule){
   const c=rule.context,health=rule.health,passport=Object.entries(rule.passport||{}).filter(([,v])=>v),safeSources=(rule.sources||[]).filter(s=>/^https:\/\//.test(s.url||'')),source=(rule.sources||[]).find(s=>s.kind==='dataset');
   const confidence=rule.confidence==='official'?'Verified against official guidance · checked '+fmt(rule.checked):rule.confidence==='reviewed'?'Based on reviewed official guidance · last checked '+fmt(rule.checked):rule.confidence==='citizenship'?'Citizenship rules apply.':'Based on the latest available Herald Voyages entry-requirements dataset.';
   return `<div class="entry-result" data-entry-status="${E(rule.status)}" data-entry-confidence="${E(rule.confidence)}">
     <p class="entry-context">${E(label(rule.passportCode))} passport · ${E(c.purpose==='tourism'?'Tourism':c.purpose)} · ${c.travelDate?E(fmt(c.travelDate)):'Current / general requirements'}${c.arrivingFrom?' · Arriving from '+E(label(c.arrivingFrom)):''}</p>
     <section class="entry-visa ${E(rule.tone)}"><h3>Visa</h3><strong>${E(rule.title)}</strong><p>${E(rule.text)}</p>${(rule.contextNotes||[]).map(note=>'<p class="entry-uncertainty">'+E(note)+'</p>').join('')}</section>
     <section><h3>Permitted stay</h3><p>${E(rule.stay)}</p></section>
     <section><h3>Passport</h3>${passport.length?passport.map(([key,text])=>`<p>${E(({validity:'Validity',blankPages:'Blank pages',condition:'Condition',documents:'Documents'})[key]||key)}: ${E(text)}</p>`).join(''):'<p class="helper">Additional passport validity and blank-page details are not included for this route.</p>'}</section>
     ${healthHtml(health,rule.destinationCode)}
     ${rule.other?.length||!health.travelHealthPro?.certificates&&health.recommendations?.length?`<details class="entry-more"><summary>Other requirements and travel health</summary>${rule.other?.length?'<h3>Other entry requirements</h3><ul>'+rule.other.map(text=>'<li>'+E(text)+'</li>').join('')+'</ul>':''}${!health.travelHealthPro?.certificates&&health.recommendations?.length?'<h3>Recommended for travel</h3><ul>'+health.recommendations.map(text=>'<li>'+E(text)+'</li>').join('')+'</ul>':''}</details>`:''}
     <footer class="entry-source-note"><p>${E(rule.status==='unknown'?'No visa rule available for these details.':confidence)}${health.verified?' · Health guidance checked '+E(fmt(health.checked)):''}</p>${source&&rule.confidence==='dataset'?'<p class="helper">Passport Index planning data · provider updated '+E(source.updated?fmt(source.updated):'date unavailable')+'.</p>':''}${safeSources.length?'<details><summary>View sources</summary><ul>'+safeSources.map(s=>'<li><a href="'+E(s.url)+'" target="_blank" rel="noopener noreferrer">'+E(s.name)+(s.kind==='dataset'?' (planning dataset)':'')+' ↗</a></li>').join('')+'</ul></details>':''}<p class="helper">Requirements can change, so confirm before travel. Ordinary passports; admission depends on the permission granted.</p></footer>
   </div>`;
 }
 function init(){const host=document.getElementById('visaOptions')||window.HVPages?.get('rulesView')?.querySelector('#visaOptions');if(host&&!host.children.length)host.innerHTML=optionsHtml({},'visa');}
 window.HVEntryChecker={optionsHtml,read,resultHtml,healthHtml,init};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();

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
   </div><p class="helper">These details refine your result. Recent travel, transit and age can affect health certificate requirements.</p></details>`;
 }
 function read(host){
   const value=name=>host.querySelector(`[name="${name}"]`)?.value.trim()||'',code=text=>countryByName(text)?.code||countryByCode(text.toUpperCase())?.code;
   const options={travelDate:value('travelDate'),purpose:value('purpose')||'tourism',days:value('days')?Number(value('days')):null,residency:value('residency'),arrivingFrom:'',recentCountries:[],transit:[],age:value('age')?Number(value('age')):null};
   if(options.travelDate&&!HVJourney.validDate(options.travelDate))return {error:'Choose a valid travel date or leave it blank.'};
   for(const name of ['arrivingFrom','recentCountries']){const terms=value(name).split(',').map(s=>s.trim()).filter(Boolean),codes=terms.map(code);if(codes.some(c=>!c||c==='SEA'))return {error:'Choose valid countries for departure and recent travel.'};if(name==='arrivingFrom'){if(codes.length>1)return {error:'Choose one country of departure.'};options.arrivingFrom=codes[0]||'';}else options.recentCountries=codes;}
   for(const term of value('transit').split(',').map(s=>s.trim()).filter(Boolean)){const [place,hours,...extra]=term.split(':').map(s=>s.trim()),country=code(place);if(!country||country==='SEA'||extra.length||hours&&(!Number.isFinite(Number(hours))||Number(hours)<0))return {error:'Use a valid transit country and duration, such as Ghana: 5.'};options.transit.push({country,hours:hours?Number(hours):null});}
   if(options.days!=null&&(!Number.isInteger(options.days)||options.days<1)||options.age!=null&&(!Number.isFinite(options.age)||options.age<0||options.age>120))return {error:'Check the stay length and traveller age.'};
   return {options};
 }
 function resultHtml(rule){
   const c=rule.context,health=rule.health,passport=Object.entries(rule.passport||{}).filter(([,v])=>v),safeSources=(rule.sources||[]).filter(s=>/^https:\/\//.test(s.url||'')),source=(rule.sources||[]).find(s=>s.kind==='dataset');
   const confidence=rule.confidence==='official'?'Verified against official guidance · checked '+fmt(rule.checked):rule.confidence==='reviewed'?'Based on reviewed official guidance · last checked '+fmt(rule.checked):rule.confidence==='citizenship'?'Citizenship rules apply.':'Based on the latest available Herald Voyages entry-requirements dataset.';
   return `<div class="entry-result" data-entry-status="${E(rule.status)}" data-entry-confidence="${E(rule.confidence)}">
     <p class="entry-context">${E(label(rule.passportCode))} passport · ${E(c.purpose==='tourism'?'Tourism':c.purpose)} · ${c.travelDate?E(fmt(c.travelDate)):'Current / general requirements'}${c.arrivingFrom?' · Arriving from '+E(label(c.arrivingFrom)):''}</p>
     <section class="entry-visa ${E(rule.tone)}"><h3>Visa</h3><strong>${E(rule.title)}</strong><p>${E(rule.text)}</p>${(rule.contextNotes||[]).map(note=>'<p class="entry-uncertainty">'+E(note)+'</p>').join('')}</section>
     <section><h3>Permitted stay</h3><p>${E(rule.stay)}</p></section>
     <section><h3>Passport</h3>${passport.length?passport.map(([key,text])=>`<p>${E(({validity:'Validity',blankPages:'Blank pages',condition:'Condition',documents:'Documents'})[key]||key)}: ${E(text)}</p>`).join(''):'<p class="helper">Additional passport validity and blank-page details are not included for this route.</p>'}</section>
     <section class="entry-health"><h3>Health entry requirements</h3>${health.vaccine?'<h4>Required for entry'+(health.assessment==='required'?'':' (conditional or date dependent)')+'</h4><strong>'+E(health.vaccine)+'</strong>':''}<p>${E(health.text)}</p>${health.routeText?'<p class="helper">'+E(health.routeText)+'</p>':''}${health.assessment==='required'?'<p class="entry-uncertainty">Certificate required for the reported route and age.</p>':''}</section>
     ${rule.other?.length||health.recommendations?.length?`<details class="entry-more"><summary>Other requirements and travel health</summary>${rule.other?.length?'<h3>Other entry requirements</h3><ul>'+rule.other.map(text=>'<li>'+E(text)+'</li>').join('')+'</ul>':''}${health.recommendations?.length?'<h3>Recommended for travel</h3><p class="helper">Travel-health advice, separate from certificates required at the border.</p><ul>'+health.recommendations.map(text=>'<li>'+E(text)+'</li>').join('')+'</ul>':''}</details>`:''}
     <footer class="entry-source-note"><p>${E(rule.status==='unknown'?'No visa rule available for these details.':confidence)}${health.verified?' · Health guidance checked '+E(fmt(health.checked)):''}</p>${source&&rule.confidence==='dataset'?'<p class="helper">Passport Index planning data · provider updated '+E(source.updated?fmt(source.updated):'date unavailable')+'.</p>':''}${safeSources.length?'<details><summary>View sources</summary><ul>'+safeSources.map(s=>'<li><a href="'+E(s.url)+'" target="_blank" rel="noopener noreferrer">'+E(s.name)+(s.kind==='dataset'?' (planning dataset)':'')+' ↗</a></li>').join('')+'</ul></details>':''}<p class="helper">Requirements can change, so confirm before travel. Ordinary passports; admission depends on the permission granted.</p></footer>
   </div>`;
 }
 function init(){const host=document.getElementById('visaOptions')||window.HVPages?.get('rulesView')?.querySelector('#visaOptions');if(host&&!host.children.length)host.innerHTML=optionsHtml({},'visa');}
 window.HVEntryChecker={optionsHtml,read,resultHtml,init};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();

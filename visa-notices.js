/* Entry reminders retain acknowledgements and never infer nationality from home or residence. */
(() => {
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function info(stay){
   const {profile,trip,passport,options}=HVEntryRules.forStay(state,stay),codes=profile?.citizenships||[],rule=passport?HVEntryRules.lookup(passport,stay.countryCode,options):null,detail=rule||{title:'Check official requirements',tone:'neutral'},own=passport===stay.countryCode;
   const fingerprint=rule?.fingerprint||JSON.stringify(['unconfirmed',stay.countryCode]);
   const id=[profile?.id||'shared',passport||'unconfirmed',stay.countryCode,stay.tripId||stay.id].join(':');
   const acknowledged=(state.visaAcknowledgements||[]).some(a=>(a.id===id||((a.profileId||null)===(profile?.id||null)&&a.passport===passport&&a.destination===stay.countryCode&&(stay.tripId?a.tripId===stay.tripId:a.stayId===stay.id)))&&a.fingerprint===fingerprint);
   return {profile,trip,codes,passport,options,rule,detail,own,id,fingerprint,acknowledged,needs:!own&&(!passport||!rule||['warn','bad','neutral'].includes(detail.tone)||rule.health?.assessment==='required')};
 }
 function indicator(s){const i=info(s);return i.needs&&!i.acknowledged?`<button type="button" class="calendar-visa-notice" data-visa-notice="${E(s.id)}" aria-label="${i.passport&&i.rule?'Review visa information':'Check passport and entry requirements'}" title="Entry requirements">!</button>`:'';}
 const detailLink=s=>`<button type="button" class="text-btn" data-visa-notice="${E(s.id)}">Entry requirements</button>`;
 function open(id){
   const s=state.stays.find(r=>r.id===id);if(!s)return;const d=document.createElement('dialog');d.className='dialog entry-dialog';d.setAttribute('aria-label','Entry requirements');document.body.append(d);
   function render(){
     const i=info(s);
     d.innerHTML=`<div class="dialog-card"><div class="dialog-head"><h2>${flagHtml(s.countryCode)} ${E(s.countryName||countryByCode(s.countryCode)?.name)} entry requirements</h2><button class="text-btn" type="button" data-close>Close ×</button></div><label class="field"><span>Passport used for this journey</span><input list="countryList" name="passport" placeholder="Passport country" value="${E(countryByCode(i.passport)?.name||i.passport)}"></label>${HVEntryChecker.optionsHtml(i.options,'tripEntry')}<button class="secondary" type="button" data-passport>Check requirements</button><p data-passport-error role="alert"></p>${i.rule?HVEntryChecker.resultHtml(i.rule):'<p>Confirm your passport nationality first. It may differ from your home country.</p>'}${i.passport?'<button class="primary" type="button" data-ack>I have read this information</button>':''}</div>`;
     d.querySelector('[data-close]').onclick=()=>d.close();
     d.oninput=()=>{const ack=d.querySelector('[data-ack]');if(ack)ack.disabled=true;};
     d.querySelector('[data-passport]').onclick=async()=>{
       const country=countryByName(d.querySelector('[name=passport]').value),input=HVEntryChecker.read(d),error=d.querySelector('[data-passport-error]');
       if(!country||country.code==='SEA'||input.error){error.textContent=input.error||'Choose your passport nationality.';return;}
       (i.trip||s).visaPassportCode=country.code;const defaults=HVEntryRules.forStay(state,{...s,entryContext:undefined}).options;s.entryContext={...input.options,travelDateOverride:input.options.travelDate!==s.start,daysOverride:input.options.days!==defaults.days,arrivingFromOverride:input.options.arrivingFrom!==defaults.arrivingFrom};persist();render();HVCalendar.renderMonth();
       if(await HVEntryRules.refresh()){if(d.open)render();HVCalendar.renderMonth();}
     };
     d.querySelector('[data-ack]')?.addEventListener('click',()=>{
       const current=info(s);state.visaAcknowledgements||=[];
       const row={id:current.id,profileId:current.profile?.id||null,tripId:s.tripId||null,stayId:s.id,passport:current.passport,destination:s.countryCode,travelDate:current.options.travelDate,fingerprint:current.fingerprint,checked:current.rule?.checked||null,acknowledgedAt:new Date().toISOString()};
       const old=state.visaAcknowledgements.find(a=>a.id===current.id);if(old)Object.assign(old,row);else state.visaAcknowledgements.push(row);persist();d.close();HVCalendar.renderMonth();
     });
   }
   d.onclose=()=>d.remove();render();d.showModal();
 }
 window.HVVisaNotices={indicator,detailLink,info,open};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-visa-notice]');if(b){e.preventDefault();e.stopPropagation();open(b.dataset.visaNotice);}});
 document.addEventListener('DOMContentLoaded',()=>window.HVCalendar?.renderMonth());
})();

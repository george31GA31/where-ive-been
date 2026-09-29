/* Explicit choices are saved on the existing record, without reclassifying history. */
(() => {
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function choose(country,date,profileId,record={}){
  if(!HVJourney.isHome(state,country.code,date,profileId))return 'foreign';
  return new Promise(resolve=>{
   const d=document.createElement('dialog');d.className='dialog';d.setAttribute('aria-label','Home or trip');
   const existing=HVJourney.homeKind(state,{...record,countryCode:country.code,start:date},date,profileId);
   d.innerHTML=`<form class="dialog-card"><h2>Was this a trip or were you at home?</h2><p>${E(country.name)} · ${E(date)}</p><label class="field"><span>For these dates</span><select name="travelKind" required><option value="">Choose an option</option><option value="trip">Trip or holiday</option><option value="home">At home</option></select></label><div class="dialog-actions"><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary" type="submit">Continue</button></div></form>`;
   d.querySelector('select').value=['trip','home'].includes(existing)?existing:'';let answer='cancel';
   d.querySelector('form').onsubmit=e=>{e.preventDefault();answer=d.querySelector('select').value;d.close();};d.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>{d.remove();resolve(answer);};document.body.append(d);d.showModal();
  });
 }
 window.HVHome={choose};
})();

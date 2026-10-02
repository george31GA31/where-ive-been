/* Tools remain explicitly Coming Soon; this creates no planner or currency service. */
(()=>{
 const names=['Road Trip Planner','Budget Planner','Currency Converter'];
 const E=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function boot(){if(document.body.dataset.accountPage)return;const bar=document.getElementById('toolsView')||window.HVPages?.get('toolsView');if(!bar)return;bar.innerHTML='<article class="panel"><p class="eyebrow">TRAVEL TOOLS</p><h2>Useful tools for your next journey</h2><div class="travel-tools-list">'+names.map((n,i)=>'<button class="text-btn" type="button" data-coming-tool="'+i+'">'+E(n)+' <small>Coming Soon</small></button>').join('')+'</div></article>';
  bar.onclick=e=>{const b=e.target.closest('[data-coming-tool]');if(!b)return;const d=document.createElement('dialog');d.className='dialog small-dialog';d.setAttribute('aria-label',names[b.dataset.comingTool]);d.innerHTML='<div class="dialog-card"><p class="eyebrow">COMING SOON</p><h2>'+E(names[b.dataset.comingTool])+'</h2><p>This travel tool is on its way.</p><button class="secondary" type="button">Close</button></div>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>{d.remove();b.focus();};d.showModal();};
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

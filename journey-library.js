/* A read-only catalogue of the existing dated records. No duplicate storage. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id)||window.HVPages?.get(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let period='all',kind='all',query='';
  function render(){
    const host=$('journeyLibraryRecords');if(!host||!window.HVCalendar?.journeyGroups)return;
    const today=isoDate(new Date()),term=query.trim().toLowerCase();let count=0;
    const groups=HVCalendar.journeyGroups().map(group=>{
      const rows=[...group.transports.map(t=>({kind:'transport',id:t.id,title:HVJourneys.transportLabel(t),searchText:(t.type==='flight'?HVJourney.flightLegs(t):[t]).flatMap(l=>[l.start,l.end]).map(p=>[p?.name,p?.iata,p?.icao,p?.city,p?.countryName].filter(Boolean).join(' ')).join(' '),detail:[HVJourney.types[t.type],...(t.legs||[]).map(l=>[l.airline?.name,l.flightNumber].filter(Boolean).join(' ')),t.flightNumber].filter(Boolean).join(' · '),start:HVJourney.transportDates(t).sort()[0]||'',end:HVJourney.transportDates(t).sort().at(-1)||'',cancelled:t.status==='cancelled'||group.trip?.status==='cancelled'})),...group.accommodations.map(a=>({kind:'accommodation',id:a.id,title:a.propertyName,detail:a.location||a.place?.address||'',start:a.checkIn,end:a.checkOut,cancelled:group.trip?.status==='cancelled'}))].filter(r=>(kind==='all'||kind===r.kind)&&(period==='all'||period==='cancelled'&&r.cancelled||!r.cancelled&&(period==='upcoming'?r.end>=today:period==='previous'?r.end<today:false))&&[r.title,r.detail,r.searchText,group.title,r.start,r.end].join(' ').toLowerCase().includes(term)).sort((a,b)=>a.start.localeCompare(b.start));
      count+=rows.length;return {group,rows};
    }).filter(g=>g.rows.length).sort((a,b)=>period==='all'?(Number(b.rows.some(r=>!r.cancelled&&r.end>=today))-Number(a.rows.some(r=>!r.cancelled&&r.end>=today))||(a.rows.some(r=>!r.cancelled&&r.end>=today)?a.rows[0].start.localeCompare(b.rows[0].start):b.rows.at(-1).end.localeCompare(a.rows.at(-1).end))):period==='previous'?b.rows.at(-1).end.localeCompare(a.rows.at(-1).end):a.rows[0].start.localeCompare(b.rows[0].start));
    $('journeyLibraryCount').textContent=`${count} ${count===1?'entry':'entries'} · ${groups.length} ${groups.length===1?'journey':'journeys'}`;
    host.innerHTML=groups.map(({group,rows})=>`<article class="journey-library-card"><header><div><p class="eyebrow">${E(group.phase)}</p><h2>${E(group.title)}</h2></div><button type="button" class="secondary" data-journey-map="${E(group.key)}">Open Journey Map →</button></header><ul>${rows.map(r=>`<li><span class="journey-library-symbol" aria-hidden="true">${r.kind==='accommodation'?'⌂':'→'}</span><div><strong>${E(r.title)}</strong><p>${E(r.detail)}</p><small>${E(r.start)}${r.end!==r.start?' – '+E(r.end):''} · ${r.cancelled?'Cancelled':r.end<today?'Previous':r.start>today?'Upcoming':'Current'}</small></div><button type="button" class="text-btn" ${r.kind==='transport'?`data-transport-edit="${E(r.id)}"`:`data-library-accommodation="${E(r.id)}"`} aria-label="Edit ${E(r.title)}">Edit</button></li>`).join('')}</ul></article>`).join('')||'<div class="empty-state"><h2>No matching entries</h2><p>Try another period or add transport or accommodation. Your existing records stay in the Calendar and their trips.</p></div>';
  }
  function boot(){
    const page=$('journeysView');if(!page)return;const oldLibrary=$('calendarTransportLibrary');if(oldLibrary){oldLibrary.hidden=true;oldLibrary.style.display='none';}
    page.querySelector('[name=journeyPeriod]').onchange=e=>{period=e.target.value;render();};page.querySelector('[name=journeyKind]').onchange=e=>{kind=e.target.value;render();};page.querySelector('[name=journeySearch]').oninput=e=>{query=e.target.value;render();};
    page.querySelector('[data-library-transport]').onclick=()=>HVJourneys.openTransport();page.querySelector('[data-library-stay]').onclick=()=>HVPlaces.open({accommodation:true});
    page.addEventListener('click',e=>{const button=e.target.closest('[data-library-accommodation]');if(button){const record=state.accommodations.find(a=>a.id===button.dataset.libraryAccommodation);if(record)HVCalendar.openAccommodationDialog(record.tripId,record.id);}});
    const previous=window.renderAll;window.renderAll=function(...args){const result=previous.apply(this,args);render();return result;};
    window.addEventListener('hv-route',render);render();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

/* Home daily plans reuse the same scoped date window as Calendar. */
(() => {
  'use strict';
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=value=>value?.includes('T')?value.slice(11,16):'';
  function transport(day){
    return day.transports.flatMap(record=>(record.type==='flight'?HVJourney.flightLegs(record):HVJourney.groundLegs(record)).flatMap((leg,index)=>{
      const start=leg.startLocal?.slice(0,10)||record.startLocal?.slice(0,10),end=leg.endLocal?.slice(0,10)||record.endLocal?.slice(0,10),dates=[start,end].filter(HVJourney.validDate).sort();
      if(!dates.length||day.date<dates[0]||day.date>dates.at(-1))return [];
      const label=HVJourney.transportLabel({...leg,type:record.type},HVJourneys.airportFor),timing=[start===day.date?'Departure '+(time(leg.startLocal)||'time not recorded'):'',end===day.date?'Arrival '+(time(leg.endLocal)||'time not recorded'):''].filter(Boolean).join(' · ')||'Travelling';
      return [{key:record.id+':'+index,title:label,detail:[HVJourney.types[record.type],timing,leg.airline?.name,leg.flightNumber||record.serviceNumber].filter(Boolean).join(' · '),action:`data-transport-edit="${E(record.id)}"`}];
    }));
  }
  function hotels(day){return day.accommodations.map(record=>({title:record.propertyName||'Accommodation',detail:[record.checkIn===day.date?'Check-in '+(record.checkInTime||''):null,record.checkOut===day.date?'Check-out '+(record.checkOutTime||''):null,record.checkIn<day.date&&record.checkOut>day.date?'Staying':null,record.location].filter(Boolean).join(' · '),action:`data-agenda-hotel="${E(record.id)}"`}));}
  function countries(day){
    const unique=new Map();for(const record of [...day.stays,...day.homes]){if(record.countryCode==='SEA')continue;const code=record.domesticDestination||record.countryCode;if(!unique.has(code))unique.set(code,{title:record.countryName||countryByCode(record.countryCode)?.name||record.countryCode,detail:record.location||'',flag:code,action:`data-calendar-edit-stay="${E(record.id)}"`});}return [...unique.values()];
  }
  function other(day){return [...day.notes.map(note=>({title:note.title||'Note',body:note.body||'',action:`data-day-note-edit="${E(note.id)}"`})),...day.places.map(record=>({title:record.place?.name||'Saved location',detail:record.place?.city||record.location||'',action:`data-agenda-place="${E(record.id)}"`})),...day.sea.map(record=>({title:'At sea',detail:record.location||'',action:`data-calendar-edit-stay="${E(record.id)}"`}))];}
  function row(item){return `<li><button type="button" class="text-btn daily-entry" ${item.action}>${item.flag?flagHtml(item.flag,'flag-img flag-sm'):''}<span><strong>${E(item.title)}</strong>${item.detail?`<small>${E(item.detail)}</small>`:''}</span><span aria-hidden="true">→</span></button>${item.body?`<div class="daily-note-body">${HVTravelTools.noteBody(String(item.body))}</div>`:''}</li>`;}
  function section(title,items){if(!items.length)return '';return `<section class="daily-category" data-agenda-category="${title.toLowerCase()}"><h3>${title}</h3><ul>${items.slice(0,3).map(row).join('')}</ul>${items.length>3?`<details><summary>Show ${items.length-3} more</summary><ul>${items.slice(3).map(row).join('')}</ul></details>`:''}</section>`;}
  function render(today=isoDate(new Date())){
    if(document.body.dataset.currentView!=='dashboard')return;
    const days=HVCalendarData.window(state,today,2);
    for(const [id,title,date]of [['todayAgenda','Today',today],['tomorrowAgenda','Tomorrow',HVCalendarData.next(today)]]){
      const host=document.getElementById(id);if(!host)continue;const day=days.get(date),content=section('Transport',transport(day))+section('Hotels',hotels(day))+section('Countries',countries(day))+section('Other',other(day));
      host.innerHTML=`<header class="daily-panel-head"><p class="eyebrow">${title.toUpperCase()}</p><h2>${E(new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}))}</h2></header>${content||'<p class="helper daily-empty">Nothing recorded for this day.</p>'}<button type="button" class="text-btn daily-add-note" data-agenda-add-note="${date}">+ Add note</button>`;
    }
  }
  document.addEventListener('click',event=>{
    const hotel=event.target.closest('[data-agenda-hotel]'),place=event.target.closest('[data-agenda-place]'),note=event.target.closest('[data-agenda-add-note]');
    if(hotel)HVPlaces.open({accommodationId:hotel.dataset.agendaHotel});
    if(place)HVPlaces.open({recordId:place.dataset.agendaPlace});
    if(note)HVTravelTools.openNote(null,{date:note.dataset.agendaAddNote,tripId:null});
  });
  let day=isoDate(new Date()),timer;
  function checkDate(){
    clearTimeout(timer);const current=isoDate(new Date());
    if(current!==day){day=current;window.HVPages?.invalidateViews?.(['dashboard','calendar','stats','countries','country','map','journeys','transport']);if(!document.querySelector('.app-shell')?.inert)renderAll();}
    const next=Date.parse(HVCalendarData.next(current)),delay=Math.max(100,next-Date.now()+25);timer=setTimeout(checkDate,Math.min(delay,2147483647));
  }
  window.addEventListener('focus',checkDate);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDate();});checkDate();
  window.HVDailyAgenda={render};
})();

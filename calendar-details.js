/* Floating detail uses a fixed overlay: hover and keyboard focus never resize Calendar cells. */
(()=>{
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function legs(t){return t.type==='flight'?HVJourney.flightLegs(t):HVJourney.groundLegs(t);}
 function transport(t){return `<strong>${HVTransportIcons.html(t.type)} ${E(HVJourneys.transportLabel(t))}</strong><div class="journey-leg-details">${legs(t).map(l=>`<div><strong>${E(HVJourney.transportLabel({...l,type:t.type}))}</strong>${t.type==='flight'?`<small>${E(HVJourney.airportDetails(l.start,HVJourneys.airportFor))} → ${E(HVJourney.airportDetails(l.end,HVJourneys.airportFor))}</small>`:''}<small>${E([l.airline?.name,l.flightNumber,l.operator||t.operator,l.serviceNumber||t.serviceNumber].filter(Boolean).join(' · '))}</small><small>${E(l.startLocal?.replace('T',' ')||'Time not recorded')} → ${E(l.endLocal?.replace('T',' ')||'Time not recorded')}</small></div>`).join('')}</div>${t.bookingReference?'<p>Booking: '+E(t.bookingReference)+'</p>':''}${t.notes?'<p class="trip-notes">'+E(t.notes)+'</p>':''}${HVPrices.detail(t)}`;}
 let tip,active;
 function hide(){tip?.remove();tip=null;if(active){active.removeAttribute('aria-describedby');active=null;}}
 function show(b){if(!b||b===active)return;hide();let content='';if(b.matches('.calendar-day-transport')){const t=state.transports.find(t=>t.id===b.dataset.calendarEditTransport);if(t)content=transport(t);}else if(b.matches('.calendar-lodging-half')){const a=state.accommodations.find(a=>a.id===b.dataset.calendarEditAccommodation);if(a)content=`<strong>${E(a.propertyName)}</strong><p>${E(a.checkIn)} ${E(a.checkInTime)} → ${E(a.checkOut)} ${E(a.checkOutTime)}</p><p>${E(a.place?.address||a.location)}</p>${HVPrices.detail(a)}${a.notes?'<p class="trip-notes">'+E(a.notes)+'</p>':''}`;}if(!content)return;active=b;tip=document.createElement('div');tip.id='calendarFloatingDetail';tip.className='calendar-floating-detail';tip.setAttribute('role','tooltip');tip.innerHTML=content;document.body.append(tip);b.setAttribute('aria-describedby',tip.id);const box=b.getBoundingClientRect(),rect=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,box.left))+'px';tip.style.top=(box.bottom+rect.height+8<innerHeight?box.bottom+6:Math.max(8,box.top-rect.height-6))+'px';}
 const selector='.calendar-day-transport,.calendar-lodging-half';
 document.addEventListener('mouseover',e=>{const b=e.target.closest(selector);if(b)requestAnimationFrame(()=>{if(b.isConnected&&b.matches(':hover'))show(b);});});
 document.addEventListener('pointermove',e=>show(e.target.closest(selector)));
 document.addEventListener('mouseout',e=>{if(e.target.closest(selector)&&!e.relatedTarget?.closest(selector))hide();});
 document.addEventListener('focusin',e=>show(e.target.closest(selector)));document.addEventListener('focusout',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);window.addEventListener('hv-calendar-rendered',hide);
 window.HVCalendarDetails={transport};
})();

/* Trips reference existing records. Photos and notes belong to the trip, without replacing travel data. */
(()=>{
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const scoped=rows=>HVJourney.scoped(rows,state.activeProfileId);
 const categories=['stays','transports','accommodations','placeVisits'];
 function dates(r,key){return key==='stays'?[r.start,r.end]:key==='transports'?[HVJourney.transportDates(r)[0],HVJourney.transportDates(r).at(-1)]:key==='accommodations'?[r.checkIn,r.checkOut]:[r.date,r.endDate||r.date];}
 function label(r,key){return key==='transports'?HVJourneys.transportLabel(r):r.propertyName||r.place?.name||r.location||r.countryName||'Recorded place';}
 function candidates(start,end,id,includeLinked=false){return categories.flatMap(key=>scoped(state[key]||[]).filter(r=>{const [a,b]=dates(r,key);return (includeLinked&&id&&r.tripId===id)||(a&&b&&a<=end&&b>=start);}).map(r=>({key,record:r})));}
 function dialog(title){const d=document.createElement('dialog'),before=document.activeElement;d.className='dialog trip-experience-dialog';d.setAttribute('aria-label',title);document.body.append(d);d.onclose=()=>{d.remove();before?.focus?.();};return d;}
 function refresh(){persist();renderAll();HVCalendar.renderMonth();HVJourneys.render();render();}
 function edit(start,end,id){
  const existing=state.trips.find(t=>t.id===id),d=dialog(existing?'Edit trip':'Create trip'),trip=existing||{},rows=candidates(start,end,id,!!existing);
  d.innerHTML=`<form class="dialog-card"><div class="dialog-head"><h2>${existing?'Edit':'Create'} trip</h2><button type="button" class="text-btn" data-close>Close ×</button></div><label class="field"><span>Trip name</span><input name="name" required maxlength="80" value="${E(trip.name)}" placeholder="e.g. Eastern Alps 2026"></label><div class="form-grid"><label class="field"><span>Start</span><input name="start" type="date" required value="${E(trip.start||start)}"></label><label class="field"><span>End</span><input name="end" type="date" required value="${E(trip.end||end)}"></label></div>${!existing?`<label class="field"><span>Save to</span><select name="existing"><option value="">Create a new trip</option>${scoped(state.trips).map(t=>`<option value="${E(t.id)}">${E(t.name)}</option>`).join('')}</select></label>`:''}<label class="field"><span>Notes (optional)</span><textarea name="notes" rows="3" maxlength="4000">${E(trip.notes)}</textarea></label><fieldset><legend>Related records</legend><p class="helper">Selected records are linked, not copied. Records belonging to another trip are shown but stay with that trip.</p><div data-trip-candidates></div></fieldset><p role="alert" data-error></p><button type="submit" class="primary">Save trip</button></form>`;
  const form=d.querySelector('form'),host=form.querySelector('[data-trip-candidates]');let current=rows;
  const draw=()=>{const target=id||form.elements.existing?.value;current=candidates(form.elements.start.value,form.elements.end.value,target,!!existing);host.innerHTML=current.map(({key,record:r},i)=>{const other=r.tripId&&r.tripId!==target,excluded=(state.trips.find(t=>t.id===target)?.excludedRecordIds?.[key]||[]).includes(r.id);return `<label class="trip-member"><input type="checkbox" data-member="${i}" data-record-id="${E(r.id)}" ${other?'disabled':excluded?'':'checked'}><span>${E(label(r,key))} · ${E(dates(r,key).join(' to '))}${other?' · Already linked to '+E(state.trips.find(t=>t.id===r.tripId)?.name||'another trip'):''}</span></label>`;}).join('')||'<p>No existing records in this range. You can add them later.</p>';};draw();
  for(const name of ['start','end'])form.elements[name]?.addEventListener('change',draw);
  let newTripDraft=null;
  form.elements.existing?.addEventListener('change',()=>{const target=state.trips.find(t=>t.id===form.elements.existing.value);if(target&&!newTripDraft)newTripDraft={name:form.elements.name.value,notes:form.elements.notes.value};for(const key of ['name','notes']){form.elements[key].disabled=!!target;form.elements[key].value=target?.[key]||(!target?newTripDraft?.[key]:'')||'';}if(!target)newTripDraft=null;form.querySelector('[type=submit]').textContent=target?'Add records to trip':'Save trip';draw();});
  form.querySelector('[data-close]').onclick=()=>d.close();
  form.onsubmit=e=>{e.preventDefault();const a=form.elements.start.value,b=form.elements.end.value;if(!HVJourney.validDate(a)||!HVJourney.validDate(b)||b<a){form.querySelector('[data-error]').textContent='Choose a valid date range.';return;}
   const adding=!existing&&state.trips.find(t=>t.id===form.elements.existing?.value),target=existing||adding||{id:uid(),profileId:state.activeProfileId};
   if(!state.trips.includes(target))state.trips.push(target);
   if(adding){const span=[a,b,target.start,target.end,...members(target.id).flatMap(({key,record})=>dates(record,key))].filter(HVJourney.validDate).sort();target.start=span[0];target.end=span.at(-1);}else Object.assign(target,{name:form.elements.name.value.trim(),start:a,end:b,notes:form.elements.notes.value.trim()});
   for(const input of host.querySelectorAll('[data-member]')){const {record:r,key}=current[Number(input.dataset.member)];if(input.disabled)continue;target.excludedRecordIds||={};const excluded=new Set(target.excludedRecordIds[key]||[]);if(input.checked){r.tripId=target.id;excluded.delete(r.id);}else{if(r.tripId===target.id)r.tripId=null;excluded.add(r.id);}target.excludedRecordIds[key]=[...excluded];}
   target.profileIds=[...new Set([target.profileId,...(target.profileIds||[]),...categories.flatMap(key=>(state[key]||[]).filter(r=>r.tripId===target.id).map(r=>r.profileId))].filter(Boolean))];refresh();d.close();show(target.id);
  };d.showModal();
 }
 function members(id){return categories.flatMap(key=>scoped(state[key]||[]).filter(r=>r.tripId===id).map(record=>({key,record})));}
 function show(id,{fromRoute=false}={}){
  const trip=scoped(state.trips).find(t=>t.id===id);if(!trip)return;
  const current=document.querySelector('dialog[open][data-trip-id]');if(current?.dataset.tripId===id)return;current?.close();
  const d=dialog('Trip details');d.dataset.tripId=id;d.dataset.fromRoute=String(fromRoute);d.dataset.openHash=location.hash;let tab='overview';
  d.addEventListener('close',()=>{const params=new URLSearchParams(location.hash.split('?')[1]||'');if(fromRoute&&params.get('trip')===id)history.replaceState(history.state,'',location.pathname+location.search+'#/trips');});
  const openRecord=(kind,rid)=>{d.close();if(kind==='transports')HVJourneys.openTransport(rid);else if(kind==='accommodations')HVPlaces.open({accommodationId:rid});else if(kind==='stays')openStayDialog(rid);else if(kind==='notes')HVTravelTools.openNote(state.notes.find(n=>n.id===rid));else HVPlaces.open({recordId:rid});};
  const draw=()=>{
   const photosOpen=d.querySelector('.trip-photos')?.open||false,costsOpen=d.querySelector('.trip-costs')?.open||false;
   const rows=members(id),allDates=rows.flatMap(({key,record})=>dates(record,key)).filter(HVJourney.validDate).sort(),start=trip.start||allDates[0]||'',end=trip.end||allDates.at(-1)||'',photos=Array.isArray(trip.photos)?trip.photos:[],cover=photos.find(p=>p.id===trip.coverPhotoId)||photos[0];
   const transport=rows.filter(r=>r.key==='transports'&&r.record.status!=='cancelled').map(r=>r.record),hotels=rows.filter(r=>r.key==='accommodations').map(r=>r.record);
   const countries=[...new Set(rows.filter(r=>r.key==='stays').map(r=>r.record.countryCode))];
   const count=HVJourney.validDate(start)&&HVJourney.validDate(end)&&end>=start?Math.min(370,daysInclusive(start,end)):0;
   const days=count?HVCalendar.projectDays(start,count,id):[];
   const dayKinds=[['stays','Country'],['accommodations','Accommodation'],['transports','Transport'],['notes','Note'],['places','Location']];
   d.innerHTML=`<article class="dialog-card"><div class="dialog-head"><h2>${E(trip.name)}</h2><button type="button" class="text-btn" data-close>Close ×</button></div><p>${E(start||'Dates to add')} ${end?'to '+E(end):''}${count?' · '+plural(daysInclusive(start,end),'day'):''}</p>
    <div class="trip-view-tabs" role="tablist" aria-label="Trip view"><button type="button" role="tab" id="tripOverviewTab" aria-controls="tripOverviewPanel" aria-selected="${tab==='overview'}" data-trip-tab="overview">Overview</button><button type="button" role="tab" id="tripItineraryTab" aria-controls="tripItineraryPanel" aria-selected="${tab==='itinerary'}" data-trip-tab="itinerary">Daily itinerary</button></div>
    <div class="trip-actions"><button class="secondary compact" data-trip-edit>Edit trip</button><button class="secondary compact" data-journey-map="trip:${E(id)}">Journey Map</button><button class="secondary compact" data-trip-tool="notes">Notes &amp; Checklist</button><button class="secondary compact" data-trip-tool="budget">Budget Planner</button><button class="secondary compact" data-trip-add>Add travel</button></div>
    <section id="tripOverviewPanel" role="tabpanel" aria-labelledby="tripOverviewTab" ${tab!=='overview'?'hidden':''}>
     ${cover&&photoSafe(cover)?`<img class="trip-cover" src="${E(cover.src)}" alt="${E(cover.name||'Trip cover')}">`:''}
     <div class="chips">${countries.map(code=>`<span>${flagHtml(code)} ${E(countryByCode(code)?.name||code)}${rows.filter(x=>x.key==='stays'&&x.record.countryCode===code).slice(0,1).map(x=>HVVisaNotices.detailLink(x.record)).join('')}</span>`).join('')}</div>
     ${trip.notes?`<p class="trip-notes">${E(trip.notes)}</p>`:''}
     <p class="helper">A trip groups existing records. Your country visits, accommodation and transport keep their own dates and identities.</p>
     <details class="trip-records"><summary>Travel records · ${rows.length}</summary>${rows.sort((a,b)=>String(dates(a.record,a.key)[0]).localeCompare(String(dates(b.record,b.key)[0]))).map(({key,record:r})=>`<details class="trip-itinerary-row" data-trip-record-expand="${E(r.id)}" data-record-kind="${key}"><summary><strong class="${key==='transports'?'transport-route-heading':''}">${E(HVAddress.text(label(r,key)))}</strong><small>${E(dates(r,key).join(' to '))}</small></summary><div data-trip-record-details></div><button type="button" class="text-btn" data-trip-record="${E(r.id)}" data-kind="${key}">Edit</button></details>`).join('')||'<p>No records linked yet.</p>'}</details>
     <details class="trip-costs" ${costsOpen?'open':''}><summary>Recorded costs</summary><p>Transport: ${E(HVPrices.summary(transport))}</p><p>Accommodation: ${E(HVPrices.summary(hotels))}</p><strong>Total: ${E(HVPrices.summary([...transport,...hotels]))}</strong><p class="helper">Original currencies remain separate. Each record is counted once.</p></details>
    </section>
    <section id="tripItineraryPanel" role="tabpanel" aria-labelledby="tripItineraryTab" ${tab!=='itinerary'?'hidden':''}>
     <p class="helper">Countries first, then where you sleep, travel and dated notes. Open a day for the details. Undated checklists remain in Notes &amp; Checklist.</p>
     ${days.map((day,index)=>`<details class="trip-itinerary-day" data-trip-day="${index}"><summary><strong>${E(new Date(day.date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}))}</strong><span>${E(day.stays.map(r=>r.countryName).join(' / '))}</span><small>${E(day.accommodations.filter(a=>a.checkOut!==day.date||a.checkIn===day.date).map(a=>a.propertyName).join(' / ')||'Accommodation not recorded')}</small></summary><div data-trip-day-body></div></details>`).join('')||'<p>Add valid trip dates to see each day.</p>'}
     ${count===370&&daysInclusive(start,end)>370?'<p class="helper">Showing the first 370 days. The full record list and Calendar retain every date.</p>':''}
    </section>
    <details class="trip-photos" ${photosOpen?'open':''}><summary>Photos · ${photos.length}</summary><label class="field"><span>Add photos</span><input type="file" data-trip-photos multiple accept="image/jpeg,image/png,image/webp"></label><p class="helper">Up to 12 photos per trip.</p><p role="alert" data-photo-error></p><div class="trip-gallery">${photos.filter(photoSafe).map((p,i)=>`<figure><img loading="lazy" src="${E(p.src)}" alt="${E(p.name||'Trip photo')}"><figcaption>${E(p.name)}<div><button class="text-btn" data-cover="${E(p.id)}">${cover?.id===p.id?'Cover':'Use as cover'}</button><button class="text-btn" data-photo-move="${i}" ${i===0?'disabled':''}>Move earlier</button><button class="text-btn" data-photo-remove="${E(p.id)}">Remove</button></div></figcaption></figure>`).join('')}</div></details></article>`;
   d.querySelector('[data-close]').onclick=()=>d.close();
   d.querySelector('[data-trip-edit]').onclick=()=>{d.close();edit(start,end,id);};
   d.querySelector('[data-trip-add]').onclick=()=>{d.close();HVTravelActions.open({tripId:id,start,end});};
   d.querySelectorAll('[data-trip-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tripTab;for(const button of d.querySelectorAll('[data-trip-tab]'))button.setAttribute('aria-selected',String(button===b));d.querySelector('#tripOverviewPanel').hidden=tab!=='overview';d.querySelector('#tripItineraryPanel').hidden=tab!=='itinerary';});
   d.querySelectorAll('[data-trip-record-expand]').forEach(section=>section.ontoggle=()=>{
    const body=section.querySelector('[data-trip-record-details]');if(!section.open||body.childElementCount)return;
    const item=rows.find(({key,record})=>key===section.dataset.recordKind&&record.id===section.dataset.tripRecordExpand);if(!item)return;
    if(item.key==='transports'){body.innerHTML=HVCalendarDetails.transport(item.record);body.querySelector('.transport-route-heading')?.remove();}
    else body.innerHTML=`${item.record.location||item.record.place?.address?`<p>${E(HVAddress.address(item.record.place)||HVAddress.text(item.record.location))}</p>`:''}${item.record.notes?`<p class="trip-notes">${E(item.record.notes)}</p>`:''}${HVPrices.detail(item.record)}`;
   });
   d.querySelectorAll('[data-trip-day]').forEach(section=>section.ontoggle=()=>{
    const body=section.querySelector('[data-trip-day-body]');if(!section.open||body.childElementCount)return;const day=days[Number(section.dataset.tripDay)];
    body.innerHTML=dayKinds.map(([key,kind])=>day[key].map(r=>{
     const collection=key==='places'?'placeVisits':key,title=key==='notes'?r.title||'Note':label(r,collection);
     const phase=key==='accommodations'?(r.checkOut===day.date&&r.checkIn!==day.date?'Checking out':r.checkIn===day.date?'Checking in':'Staying tonight'):'';
     const local=key==='transports'?`${r.startLocal?.replace('T',' ')||'Time to add'} → ${r.endLocal?.replace('T',' ')||'Time to add'} (local)` : key==='notes'?r.body||'':'';
     return `<div class="trip-day-record"><span>${E(kind)}${phase?' · '+phase:''}</span><strong>${E(title)}</strong>${local?`<small>${E(local)}</small>`:''}<button type="button" class="text-btn" data-trip-record="${E(r.id)}" data-kind="${collection}">Edit ${E(kind.toLowerCase())}</button></div>`;
    }).join('')).join('')||'<p class="helper">No linked travel recorded for this day.</p>';
   });
   d.querySelectorAll('[data-trip-tool]').forEach(b=>b.onclick=()=>{d.close();HVTravelTools.openTrip(id,b.dataset.tripTool);});
   d.querySelector('[data-journey-map]').addEventListener('click',()=>d.close());
   d.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{trip.coverPhotoId=b.dataset.cover;refresh();draw();});
   d.querySelectorAll('[data-photo-remove]').forEach(b=>b.onclick=()=>{trip.photos=photos.filter(p=>p.id!==b.dataset.photoRemove);if(trip.coverPhotoId===b.dataset.photoRemove)delete trip.coverPhotoId;refresh();draw();});
   d.querySelectorAll('[data-photo-move]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.photoMove);[photos[i-1],photos[i]]=[photos[i],photos[i-1]];refresh();draw();});
   d.querySelector('[data-trip-photos]').onchange=async event=>{const files=[...event.target.files],error=d.querySelector('[data-photo-error]');if(files.length+photos.length>12){error.textContent='Keep up to 12 photos per trip.';return;}event.target.disabled=true;try{const added=[];for(const file of files)added.push(await photo(file));trip.photos=[...photos,...added];refresh();draw();}catch(err){error.textContent=err.message;event.target.disabled=false;}};
  };d.addEventListener('click',event=>{const b=event.target.closest('[data-trip-record]');if(b)openRecord(b.dataset.kind,b.dataset.tripRecord);});draw();d.showModal();
 }
 function photoSafe(p){return p&&typeof p.src==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src);}
 async function photo(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000)throw Error('Choose JPEG, PNG or WebP photos below 20 MB.');const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas'),scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(bitmap,0,0,canvas.width,canvas.height);return{id:uid(),name:file.name,src:canvas.toDataURL('image/jpeg',.72)};}finally{bitmap.close();}}
 function render(){const page=document.getElementById('staysView');if(!page)return;let host=page.querySelector('[data-trip-library]');if(!host){host=document.createElement('section');host.dataset.tripLibrary='';host.className='panel';page.querySelector('.panel')?.after(host);}host.innerHTML='<div class="panel-head"><h2>Group existing travel</h2><button class="secondary compact" data-new-trip>Group records into a trip</button></div><p>Link country stays, transport and accommodation under one trip name. To build a new itinerary, use Plan a trip.</p>';}

 document.addEventListener('click',e=>{const b=e.target.closest('[data-create-range-trip],[data-new-trip],[data-trip-open]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.dataset.tripOpen)show(b.dataset.tripOpen);else edit(b.dataset.start||isoDate(new Date()),b.dataset.end||isoDate(new Date()));},true);
 function openRouteTrip(){const params=new URLSearchParams(location.hash.split('?')[1]||''),active=document.querySelector('dialog[open][data-trip-id]');if(active&&location.hash!==active.dataset.openHash&&!(location.hash.startsWith('#/trips')&&params.get('trip')===active.dataset.tripId))active.close();if(location.hash.startsWith('#/trips')&&params.has('trip'))show(params.get('trip'),{fromRoute:true});if(location.hash.startsWith('#/calendar')&&params.get('kind')&&params.get('id'))window.HVCalendar?.openEntry(params.get('kind'),params.get('id'));}
 window.addEventListener('hashchange',()=>queueMicrotask(openRouteTrip));window.addEventListener('hv-route',()=>queueMicrotask(openRouteTrip));
 window.addEventListener('hv-calendar-rendered',render);window.addEventListener('hv-route',render);
 window.HVTrips={edit,show,render};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',render):render();
})();

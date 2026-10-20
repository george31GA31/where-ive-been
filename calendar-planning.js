/* Calendar-only tentative controls. Confirmed consumers never receive this projection. */
(() => {
  'use strict';
  const P=HVCalendarPlanningModel;
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  const labels={country:'Country',accommodation:'Accommodation',transport:'Transport',note:'Note',location:'Location'};
  const dateText=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const rangeText=plan=>P.range(plan.kind,plan.record).map(dateText).join(' to ');
  const title=plan=>{const r=plan.record;return r.countryName||r.propertyName||(plan.kind==='transport'?HVJourneys.transportLabel(r):r.title||r.place?.name)||labels[plan.kind];};
  const plans=()=>HVData.memo(state,'calendar-tentative-index',['calendarPlans'],state.activeProfileId,()=>{const rows=P.visible(state);return {rows,ids:new Map(rows.map(plan=>[plan.id,plan])),records:new Map(rows.map(plan=>[plan.kind+':'+plan.record.id,plan]))};});
  const find=id=>plans().ids.get(id);
  const planFor=(kind,id)=>plans().records.get(kind+':'+id);
  const shown=()=>state.visualLayers?.calendar?.tentative!==false;
  let dialog,bindings=[],undoStack=[],drag=null,preview=null,animation=0,saveOwner=null,suppressClick=false;
  const owner=()=>`${window.HVAccountState?.userId||'guest'}:${state.activeProfileId}`;

  function refresh() {
    window.HVPages?.invalidateViews(['calendar']);
    renderAll();
    window.dispatchEvent(new CustomEvent('hv-calendar-plans-changed'));
  }
  function notice(message,error=false) {
    let host=get('calendarPlanNotice');
    if(!host){host=document.createElement('div');host.id='calendarPlanNotice';host.className='calendar-plan-notice';host.setAttribute('role','status');host.setAttribute('aria-live','polite');document.body.append(host);}
    host.classList.toggle('is-error',error);
    host.innerHTML=`<span>${E(message)}</span>${undoStack.length?'<button type="button" class="text-btn" data-plan-undo>Undo</button>':''}<button type="button" class="text-btn" data-plan-dismiss aria-label="Dismiss notification">×</button>`;
    host.hidden=false;
  }
  // Snapshot only affected collections, and refuse undo after another writer edits them.
  function change(action,message,{undo=true,keys=['calendarPlans']}={}) {
    if(saveOwner!==owner()){undoStack=[];saveOwner=owner();}
    const before=Object.fromEntries(keys.map(key=>[key,P.copy(state[key]||[])]));
    try {
      const result=action();
      const changed=keys.filter(key=>JSON.stringify(before[key])!==JSON.stringify(state[key]||[]));
      if(persist()===false)throw Error('This change could not be saved. Please try again.');
      if(undo){undoStack.push({before:Object.fromEntries(changed.map(key=>[key,before[key]])),after:Object.fromEntries(changed.map(key=>[key,P.copy(state[key]||[])])),owner:owner()});if(undoStack.length>20)undoStack.shift();}
      refresh();notice(message);return {ok:true,result};
    } catch(error) {
      for(const key of keys)state[key]=before[key];
      HVData.observe(state);
      notice(error.message,true);return {ok:false};
    }
  }
  function undo() {
    const saved=undoStack.at(-1);if(!saved)return;
    if(saved.owner!==owner()||Object.keys(saved.after).some(key=>JSON.stringify(state[key]||[])!==JSON.stringify(saved.after[key]))){undoStack=[];notice('This entry has changed since that action. Open it to adjust its dates.',true);return;}
    const result=change(()=>{for(const [key,rows]of Object.entries(saved.before))state[key]=P.copy(rows);},'Change undone.',{undo:false,keys:Object.keys(saved.before)});
    if(result.ok){undoStack.pop();notice('Change undone.');}
  }
  function attributes(kind,id,date) {
    const plan=planFor(kind,id);if(!plan)return '';
    return `data-calendar-plan-id="${E(plan.id)}" aria-description="Tentative plan. Open for confirmation and exact date editing." title="Tentative: ${E(title(plan))}. Drag to move; use the end handles to resize. On touch, hold to drag or tap to edit dates."`;
  }
  function handles(kind,row,date) {
    const plan=planFor(kind,row.id);if(!plan)return '';
    const [start,end]=P.range(kind,row);
    return `${date===start?'<span class="calendar-plan-handle plan-start" data-plan-handle="start" aria-hidden="true"></span>':''}<span class="calendar-plan-mark" aria-hidden="true">○</span>${date===end?'<span class="calendar-plan-handle plan-end" data-plan-handle="end" aria-hidden="true"></span>':''}`;
  }
  function windowFor(start,count) {
    const data=preview?{...state,calendarPlans:(state.calendarPlans||[]).map(plan=>plan.id===preview.id?preview:plan)}:state;
    return P.projectWindow(data,HVCalendarData.window(state,start,count),shown());
  }
  function rangePlans(start,end) {return shown()?plans().rows.filter(plan=>{const[a,b]=P.range(plan.kind,plan.record);return a<=end&&b>=start;}):[];}
  function cleanupBindings(){for(const binding of bindings)binding.cancel();bindings=[];}
  function close(){dialog?.close();cleanupBindings();}
  function ensureDialog() {
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='calendarPlanDialog';dialog.className='dialog calendar-plan-dialog';dialog.setAttribute('aria-labelledby','calendarPlanHeading');document.body.append(dialog);
    dialog.addEventListener('close',cleanupBindings);
    dialog.addEventListener('cancel',cleanupBindings);
    return dialog;
  }
  function open(id) {
    const plan=find(id);if(!plan)return;
    window.HVCalendarDetails?.hide();
    const r=plan.record,[start,end]=P.range(plan.kind,r),host=ensureDialog();cleanupBindings();
    host.dataset.planId=id;
    host.innerHTML=`<article class="dialog-card"><header class="calendar-plan-head"><div><p class="eyebrow">TENTATIVE ${E(labels[plan.kind].toUpperCase())}</p><h2 id="calendarPlanHeading">${E(title(plan))}</h2><p>${E(rangeText(plan))}</p></div><button type="button" class="icon-btn" data-plan-close aria-label="Close plan">×</button></header><p class="helper">Only on your calendar until you confirm it.</p><dl class="calendar-profile-facts">${r.location?'<div><dt>Location</dt><dd>'+E(r.location)+'</dd></div>':''}${plan.kind==='transport'?'<div><dt>Local times</dt><dd>'+E(r.startLocal.replace('T',' '))+' → '+E(r.endLocal.replace('T',' '))+'</dd></div>':''}${r.bookingReference?'<div><dt>Booking reference</dt><dd>'+E(r.bookingReference)+'</dd></div>':''}${r.tripId?'<div><dt>Linked trip</dt><dd>'+E((state.trips||[]).find(t=>t.id===r.tripId)?.name||'Saved trip')+'</dd></div>':''}</dl>${r.notes||r.body?'<p class="calendar-plan-notes">'+E(r.notes||r.body)+'</p>':''}<div class="calendar-plan-actions"><button type="button" class="primary" data-plan-confirm="${E(id)}">Confirm plan</button><button type="button" class="secondary" data-plan-edit="${E(id)}">Edit details & dates</button><button type="button" class="secondary" data-plan-duplicate="${E(id)}">Duplicate plan</button><button type="button" class="text-btn" data-plan-delete="${E(id)}">Delete plan</button></div><div class="calendar-plan-move"><span>Move the whole plan</span><button type="button" class="secondary compact" data-plan-shift="-1" aria-label="Move one day earlier">← 1 day</button><button type="button" class="secondary compact" data-plan-shift="1" aria-label="Move one day later">1 day →</button><button type="button" class="secondary compact" data-plan-shift="-7" aria-label="Move one week earlier">← 1 week</button><button type="button" class="secondary compact" data-plan-shift="7" aria-label="Move one week later">1 week →</button></div><p class="helper">Tap Edit details & dates to set any date range. Moving keeps the same duration.</p></article>`;
    if(!host.open)host.showModal();
  }
  function field(label,name,value='',type='text',extra='') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${E(value)}" ${extra}></label>`;
  }
  function edit(id=null,{kind='country',start=calendarSelectionStart||isoDate(new Date()),end=calendarSelectionEnd||start}={}) {
    const existing=id?find(id):null;if(id&&!existing)return;
    kind=existing?.kind||kind;
    let r=P.copy(existing?.record||{}),chosen={};
    if(existing)[start,end]=P.range(kind,r);
    const host=ensureDialog();cleanupBindings();host.dataset.planId=id||'';
    const chooser=!existing?`<label class="field"><span>Plan type</span><select name="kind">${Object.entries(labels).map(([key,label])=>`<option value="${key}"${key===kind?' selected':''}>${label}</option>`).join('')}</select></label>`:'';
    let details='';
    if(kind==='country') details=field('Country','country',r.countryName,'text','list="countryList" required autocomplete="off"')+field('City or area (optional)','location',r.location);
    if(kind==='accommodation') details=field('Property name','propertyName',r.propertyName,'text','required')+field('Location or address','location',r.location,'text','required autocomplete="off"')+'<div data-plan-results="location" class="travel-search-results"></div>'+field('Booking reference (optional)','bookingReference',r.bookingReference);
    if(kind==='transport') details=`<label class="field"><span>Transport</span><select name="type">${Object.entries(HVJourney.types).map(([key,label])=>`<option value="${key}"${key===(r.type||'flight')?' selected':''}>${E(label)}</option>`).join('')}</select></label>`+field('From','from',r.start?.name,'text','required autocomplete="off"')+'<div data-plan-results="from" class="travel-search-results"></div>'+field('To','to',r.end?.name,'text','required autocomplete="off"')+'<div data-plan-results="to" class="travel-search-results"></div><div class="form-grid">'+field('Departure time (local)','departure',r.startLocal?.slice(11,16)||'12:00','time','required')+field('Arrival time (local)','arrival',r.endLocal?.slice(11,16)||'12:00','time','required')+'</div>'+field('Booking reference (optional)','bookingReference',r.bookingReference)+(r.legs?.length>1?'<p class="helper">All connecting legs, airports and route information are retained. Moving the plan moves every leg by the same number of days.</p>':'');
    if(kind==='note')details=field('Title','title',r.title,'text','required');
    if(kind==='location')details=field('Location name','name',r.place?.name,'text','required autocomplete="off"')+'<div data-plan-results="name" class="travel-search-results"></div>';
    host.innerHTML=`<form id="calendarPlanForm" class="dialog-card"><header class="calendar-plan-head"><div><p class="eyebrow">TENTATIVE PLAN</p><h2 id="calendarPlanHeading">${existing?'Edit plan':'Add tentative plan'}</h2></div><button type="button" class="icon-btn" data-plan-close aria-label="Close plan">×</button></header>${chooser}${details}<div class="form-grid">${field(kind==='accommodation'?'Check-in date':'Start date','start',start,'date','required')}${field(kind==='accommodation'?'Check-out date':'End date','end',end,'date','required')}</div><label class="field"><span>${kind==='note'?'Note':'Notes (optional)'}</span><textarea name="notes" rows="3">${E(kind==='note'?r.body:r.notes)}</textarea></label><p class="helper">Saved automatically after you save this plan. Confirm it when you are ready to add it to your travel records.</p><p class="form-error" role="alert"></p><div class="calendar-plan-actions"><button class="primary" type="submit">Save tentative plan</button><button type="button" class="secondary" data-plan-close>Cancel</button></div></form>`;
    const form=host.querySelector('form');
    form.elements.kind?.addEventListener('change',()=>edit(null,{kind:form.elements.kind.value,start:form.elements.start.value,end:form.elements.end.value}));
    const bind=(name,context,old)=>{
      const input=form.elements[name],results=host.querySelector(`[data-plan-results="${name}"]`);
      if(!window.HVTravelSearch||!input||!results)return;
      chosen[name]=old;
      bindings.push(HVTravelSearch.bind(input,results,{context:()=>context,onType:()=>{chosen[name]=null;},onSelect:place=>{chosen[name]=place;}}));
    };
    if(kind==='transport'){bind('from','transport',r.start);bind('to','transport',r.end);}
    if(kind==='location')bind('name','other',r.place);
    if(kind==='accommodation')bind('location','accommodation',r.place);
    form.addEventListener('submit',event=>{
      event.preventDefault();const f=form.elements,alert=form.querySelector('[role=alert]');
      try {
        const recordId=r.id||uid();let row={...r,id:recordId,profileId:r.profileId??(state.activeProfileId==='all'?null:state.activeProfileId)};
        if(existing)row=P.reschedule(existing,f.start.value,f.end.value).record;
        if(kind==='country'){
          const country=countryByName(f.country.value);if(!country)throw Error('Choose a country from the list.');
          row={...row,countryCode:country.code,countryName:country.name,...HVJourney.domesticFields(country),location:f.location.value.trim(),start:f.start.value,end:f.end.value,schengenExempt:row.schengenExempt||false,status:row.status||(f.end.value<isoDate(new Date())?'actual':'planned')};
        }else if(kind==='accommodation')row={...row,propertyName:f.propertyName.value.trim(),location:f.location.value.trim(),place:chosen.location||((f.location.value===r.location)?r.place:undefined),checkIn:f.start.value,checkOut:f.end.value,bookingReference:f.bookingReference.value.trim()};
        else if(kind==='transport'){
          const point=(name,old)=>chosen[name]||((f[name].value===old?.name)?old:{name:f[name].value.trim()});
          const departure=point('from',r.start),arrival=point('to',r.end),geometryChanged=JSON.stringify([r.type,r.start,r.end])!==JSON.stringify([f.type.value,departure,arrival]);
          row={...row,type:f.type.value,start:departure,end:arrival,startLocal:(existing?row.startLocal.slice(0,10):f.start.value)+'T'+f.departure.value,endLocal:(existing?row.endLocal.slice(0,10):f.end.value)+'T'+f.arrival.value,status:row.status||'planned',bookingReference:f.bookingReference.value.trim()};
          if(row.legs?.length){row.legs[0].start=departure;row.legs[0].startLocal=row.startLocal;row.legs.at(-1).end=arrival;row.legs.at(-1).endLocal=row.endLocal;}
          if(geometryChanged){delete row.resolvedRoutes;if(row.legs)for(const leg of row.legs)delete leg.resolvedRoutes;}
        }else if(kind==='note')row={...row,title:f.title.value.trim(),body:f.notes.value,date:f.start.value,endDate:f.end.value,category:row.category||'General'};
        else row={...row,place:chosen.name||((f.name.value===r.place?.name)?r.place:{name:f.name.value.trim()}),date:f.start.value,endDate:f.end.value,category:'locations',status:'visited',itemId:row.itemId||'manual:'+recordId};
        if(kind!=='note')row.notes=f.notes.value;
        const plan={...existing,id:existing?.id||uid(),kind,profileId:row.profileId,record:row,companions:existing?P.reschedule(existing,f.start.value,f.end.value).companions||[]:[]};
        const error=P.validate(plan);if(error)throw Error(error);
        const result=change(()=>{state.calendarPlans=[...(state.calendarPlans||[]).filter(item=>item.id!==plan.id),plan];},'Tentative plan saved.');
        if(result.ok){close();get('calendar')?.querySelector(`[data-calendar-plan-id="${CSS.escape(plan.id)}"]`)?.focus({preventScroll:true});}
      }catch(error){alert.textContent=error.message;}
    });
    if(!host.open)host.showModal();
  }
  function duplicate(id) {
    const source=find(id);if(!source)return;
    const plan=P.copy(source);plan.id=uid();plan.record.id=uid();
    for(const item of plan.companions||[]){item.record.id=uid();if(item.record.sourceAccommodationId)item.record.sourceAccommodationId=plan.record.id;}
    const result=change(()=>{state.calendarPlans=[...(state.calendarPlans||[]),plan];},'Plan duplicated.');
    if(result.ok)open(plan.id);
  }
  function toolbar() {
    const host=get('calendarView')?.querySelector('.calendar-toolbar-actions');if(!host)return;
    if(!host.querySelector('[data-add-tentative]'))host.insertAdjacentHTML('beforeend','<button type="button" class="secondary compact" data-add-tentative aria-label="Add tentative plan"><span class="plan-control-wide">+ Tentative plan</span><span class="plan-control-short">+ Tentative</span></button><label class="calendar-hover-setting calendar-plan-toggle"><input type="checkbox" data-show-tentative aria-label="Show tentative plans"><span class="plan-control-wide">Tentative plans</span><span class="plan-control-short">Plans</span> <small data-plan-count></small></label>');
    host.querySelector('[data-show-tentative]').checked=shown();
    host.querySelector('[data-plan-count]').textContent=plans().rows.length||'';
  }
  document.addEventListener('click',async event=>{
    const target=event.target;
    if(drag?.active||(suppressClick&&target.closest('#calendar'))){event.preventDefault();event.stopImmediatePropagation();return;}
    const button=target.closest('[data-add-tentative],[data-calendar-plan-id],[data-plan-close],[data-plan-confirm],[data-plan-edit],[data-plan-duplicate],[data-plan-delete],[data-plan-shift],[data-make-tentative],[data-plan-undo],[data-plan-dismiss]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.hasAttribute('data-add-tentative')){edit(null,{kind:button.dataset.addTentative||'country'});return;}
    if(button.hasAttribute('data-calendar-plan-id')){open(button.dataset.calendarPlanId);return;}
    if(button.hasAttribute('data-plan-close')){close();return;}
    if(button.hasAttribute('data-plan-confirm')){
      const plan=find(button.dataset.planConfirm);if(!plan)return;
      const country=plan.kind==='country'?countryByCode(plan.record.countryCode):plan.record.place?.countryCode?countryByCode(plan.record.place.countryCode):null;
      let travelKind=plan.record.travelKind;
      if(country&&!travelKind&&window.HVHome){travelKind=await HVHome.choose(country,P.range(plan.kind,plan.record)[0],plan.profileId||state.activeProfileId,plan.record);if(travelKind==='cancel'||!find(plan.id))return;}
      if(change(()=>{if(travelKind){plan.record={...plan.record,travelKind,...(plan.kind==='country'?{domesticHoliday:travelKind==='trip'||!!plan.record.domesticDestination}:{})};}return P.confirm(state,plan.id);},'Plan confirmed.',{keys:[...new Set(['calendarPlans',P.collections[plan.kind],...(plan.kind==='accommodation'?['stays']:[])])]}).ok){close();window.HVCalendar?.clearSelection();}return;
    }
    if(button.hasAttribute('data-plan-edit')){edit(button.dataset.planEdit);return;}
    if(button.hasAttribute('data-plan-duplicate')){duplicate(button.dataset.planDuplicate);return;}
    if(button.hasAttribute('data-plan-delete')){if(change(()=>{state.calendarPlans=state.calendarPlans.filter(plan=>plan.id!==button.dataset.planDelete);},'Tentative plan deleted.').ok)close();return;}
    if(button.hasAttribute('data-plan-shift')){
      const plan=find(dialog.dataset.planId);if(plan&&change(()=>{state.calendarPlans=state.calendarPlans.map(row=>row.id===plan.id?P.move(plan,Number(button.dataset.planShift)):row);},'Plan moved.').ok)open(plan.id);return;
    }
    if(button.hasAttribute('data-make-tentative')){
      const kind=button.dataset.makeTentative,id=button.dataset.recordId;
      const result=change(()=>P.makeTentative(state,kind,id,uid()),'Entry changed to tentative.',{keys:[...new Set(['calendarPlans',P.collections[kind],...(kind==='accommodation'?['stays']:[])])]});
      if(result.ok){window.HVCalendar?.clearSelection();open(result.result.id);}return;
    }
    if(button.hasAttribute('data-plan-undo')){undo();return;}
    if(button.hasAttribute('data-plan-dismiss'))button.closest('#calendarPlanNotice').hidden=true;
  },true);
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-show-tentative]'))return;
    const previous=state.visualLayers;
    state.visualLayers={...previous,calendar:{...previous?.calendar,tentative:event.target.checked}};
    if(persist()===false){state.visualLayers=previous;event.target.checked=shown();notice('This preference could not be saved.',true);return;}
    refresh();
  });

  function dragDate(x,y) {return document.elementFromPoint(x,y)?.closest('#calendar [data-calendar-date]')?.dataset.calendarDate;}
  function startDrag() {
    if(!drag||drag.active)return;drag.active=true;
    get('calendar')?.setPointerCapture(drag.pointerId);
    window.HVCalendarDetails?.hide();
    drag.tip=document.createElement('div');drag.tip.className='calendar-plan-drag-preview';drag.tip.setAttribute('role','status');document.body.append(drag.tip);
    document.body.classList.add('calendar-plan-dragging');
    drag.tip.textContent=title(drag.plan)+' · '+rangeText(drag.plan);
    updateDrag(drag.x,drag.y);
    animation=requestAnimationFrame(scrollDrag);
  }
  function updateDrag(x,y) {
    if(!drag?.active)return;
    drag.x=x;drag.y=y;drag.tip.style.left=Math.min(innerWidth-260,Math.max(8,x+12))+'px';drag.tip.style.top=Math.max(8,Math.min(innerHeight-70,y+20))+'px';
    const date=dragDate(x,y);if(!date)return;
    const [start,end]=P.range(drag.plan.kind,drag.plan.record);
    try {
      const changed=drag.mode==='move'?P.move(drag.plan,P.offset(drag.anchor,date)):P.reschedule(drag.plan,drag.mode==='start'?date:start,drag.mode==='end'?date:end);
      drag.proposed=changed;preview=changed;
      drag.tip.textContent=title(changed)+' · '+rangeText(changed);
      const [a,b]=P.range(changed.kind,changed.record);
      get('calendar').querySelectorAll('[data-calendar-date]').forEach(day=>day.classList.toggle('calendar-plan-drop-range',day.dataset.calendarDate>=a&&day.dataset.calendarDate<=b));
      drag.tip.classList.remove('is-error');
    }catch(error){drag.proposed=null;drag.tip.textContent=error.message;drag.tip.classList.add('is-error');}
  }
  function scrollDrag(time) {
    if(!drag?.active)return;
    const bounds=get('calendar').getBoundingClientRect(),x=drag.x,y=drag.y;
    if(y>innerHeight-65)window.scrollBy(0,12);else if(y<90)window.scrollBy(0,-12);
    const backwards=(x<bounds.left+20||y<bounds.top+12),forwards=(x>bounds.right-20||y>bounds.bottom-12);
    if((backwards||forwards)&&time-drag.lastMonth>1000){
      if(!drag.edgeSince)drag.edgeSince=time;
      if(time-drag.edgeSince>650){
        calendarCursor=new Date(Date.UTC(calendarCursor.getUTCFullYear(),calendarCursor.getUTCMonth()+(backwards?-1:1),1));
        window.HVCalendar?.renderMonth();drag.lastMonth=time;drag.edgeSince=0;
      }
    }else drag.edgeSince=0;
    updateDrag(x,y);animation=requestAnimationFrame(scrollDrag);
  }
  function finishDrag(commit) {
    if(!drag)return;
    const saved=drag;drag=null;clearTimeout(saved.timer);cancelAnimationFrame(animation);saved.tip?.remove();document.body.classList.remove('calendar-plan-dragging');preview=null;
    if(saved.active){
      if(commit&&dragDate(saved.x,saved.y)&&saved.proposed&&JSON.stringify(saved.plan)!==JSON.stringify(saved.proposed)){
        const current=find(saved.plan.id);
        if(!current||JSON.stringify(current)!==JSON.stringify(saved.plan))notice('This plan changed elsewhere while you were dragging. Please try again.',true);
        else change(()=>{state.calendarPlans=state.calendarPlans.map(plan=>plan.id===saved.proposed.id?saved.proposed:plan);},'Plan dates saved.');
      }
      window.HVCalendar?.renderMonth();
      // Suppress the click generated by releasing a pointer after a drag.
      suppressClick=true;setTimeout(()=>{suppressClick=false;},80);
    }else drag=null;
  }
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    const button=event.target.closest('#calendar [data-calendar-plan-id]');if(!button)return;
    const plan=find(button.dataset.calendarPlanId);if(!plan)return;
    drag={plan:P.copy(plan),mode:event.target.closest('[data-plan-handle]')?.dataset.planHandle||'move',anchor:button.dataset.calendarContextDate,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,pointerId:event.pointerId,lastMonth:0};
    if(event.pointerType==='touch')drag.timer=setTimeout(startDrag,300);
    else event.preventDefault();
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
    if(!drag.active&&distance>5){if(event.pointerType==='touch'){clearTimeout(drag.timer);drag=null;return;}startDrag();}
    if(drag?.active){event.preventDefault();updateDrag(event.clientX,event.clientY);}
  },{passive:false});
  document.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId)finishDrag(true);});
  document.addEventListener('pointercancel',()=>finishDrag(false));
  window.addEventListener('blur',()=>finishDrag(false));
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.target.closest('input,textarea,[contenteditable],dialog')&&document.body.dataset.currentView==='calendar'&&undoStack.length){event.preventDefault();undo();return;}if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();finishDrag(false);}},true);
  window.addEventListener('hv-calendar-rendered',toolbar);
  window.addEventListener('hv-data-changed',()=>{if(drag)finishDrag(false);close();undoStack=[];get('calendarPlanNotice')?.setAttribute('hidden','');toolbar();});
  window.addEventListener('hashchange',()=>{if(drag)finishDrag(false);close();});
  window.HVCalendarPlanning={open,edit,window:windowFor,attributes,handles,rangePlans,planFor,shown,toolbar,undo};
})();

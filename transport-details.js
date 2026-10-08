/* Optional journey details, ground connections and explicitly linked return records. */
(() => {
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function setup(form,record={}){
   form._recalculateRoute=false;
   form._searchBindings?.forEach(b=>b.cancel());form._searchBindings=[];
   form.querySelector('[data-transport-extras]')?.remove();
   const host=document.createElement('section');host.dataset.transportExtras='';host.className='transport-extras';
   host.innerHTML=`<section class="ground-vias" data-ground-vias><h3>Via stops <span class="helper">optional</span></h3><div data-ground-list></div><button type="button" class="text-btn" data-ground-add>+ Add via stop</button></section><section class="journey-section transport-essential" data-operator-essential><h3>Journey details</h3></section><details class="transport-more journey-more"><summary>More details</summary><div class="journey-more-content"><div class="form-grid" data-operator-secondary>${[['operator','Operator / company'],['serviceNumber','Service / train / bus number']].map(([key,label])=>`<label class="field"><span data-essential-label="${key}">${label} <em>optional</em></span><input name="${key}" value="${E(record[key])}" maxlength="200"></label>`).join('')}</div><div class="form-grid"><label class="field"><span>Booking reference <em>optional</em></span><input name="bookingReference" value="${E(record.bookingReference)}" maxlength="200"></label><label class="field"><span>Seat information <em>optional</em></span><input name="seat" value="${E(record.seat)}" maxlength="200"></label></div><label class="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="3" maxlength="4000">${E(record.notes)}</textarea></label>${HVPrices.fields(record)}<div class="route-refresh-control"><button type="button" class="text-btn" data-recalculate-route>Recalculate route</button><small class="helper" data-route-refresh-note>Use this only if you want Herald to try the mapped route again after you save.</small></div></div></details><div class="return-journey"><label class="check-row" data-return-option><input name="addReturn" type="checkbox"><span>Add return journey</span></label><p class="helper" data-return-help>Set the return's own dates and times before saving both journeys.</p></div>`;
   form.querySelector('#transportError').before(host);
   for(const side of ['start','end']){
     const input=form.elements[side+'name'],results=form.querySelector(`[data-airport-results="${side}"]`);
     form._searchBindings.push(HVTravelSearch.bind(input,results,{context:()=>form.elements.type.value,onType(){form.elements[side+'lat'].value='';form.elements[side+'lon'].value='';delete form._airportPrefill[side];form.querySelector(`[data-endpoint-address="${side}"]`).textContent='';if(form.elements[side+'address'])form.elements[side+'address'].value='';},onSelect(p){setPoint(form,side,p);}}));
     let address=form.elements[side+'address'];if(!address){const field=document.createElement('label');field.className='field';field.dataset.addressField=side;field.innerHTML='<span>Address (editable)</span><input name="'+side+'address" maxlength="500">';form.querySelector(`[name="${side}terminal"]`).closest('label').after(field);address=form.elements[side+'address'];}address.value=HVAddress.address(record[side]);
     let label=form.querySelector(`[data-endpoint-address="${side}"]`);if(!label){label=document.createElement('p');label.className='helper';label.dataset.endpointAddress=side;results.after(label);}label.textContent=HVAddress.address(record[side]||form._airportPrefill?.[side]);
   }
   host.querySelector('[data-ground-add]').onclick=()=>{form._via.push({name:'',lat:null,lon:null});renderVias(form);};
   HVOperators.setup(form,record);renderVias(form);update(form);const refresh=host.querySelector('[data-recalculate-route]');refresh.hidden=!record.id;refresh.onclick=()=>{form._recalculateRoute=true;refresh.disabled=true;host.querySelector('[data-route-refresh-note]').textContent='Route refresh requested. Save this journey and Herald will calculate it again the next time it is mapped.';};
 }
 function setPoint(form,side,p){if(form.elements[side+'address'])form.elements[side+'address'].value=p.address||'';form.elements[side+'name'].value=p.name;form.elements[side+'lat'].value=p.lat??'';form.elements[side+'lon'].value=p.lon??'';form._airportPrefill[side]={...p};form.querySelector(`[data-endpoint-address="${side}"]`).textContent=p.address||[p.city,p.countryName].filter(Boolean).join(', ');}
 function update(form){const type=form.elements.type.value,flight=type==='flight',essential=['train','bus','boat'].includes(type);const primary=form.querySelector('[data-operator-essential]'),secondary=form.querySelector('[data-operator-secondary]');for(const key of ['operator','serviceNumber']){const label=form.elements[key].closest('label');(essential?primary:secondary).append(label);}const artwork=form.querySelector('[data-ground-operator-logo]');if(artwork){(essential?primary:secondary).append(artwork);artwork.hidden=flight;}primary.hidden=!essential;secondary.hidden=essential;form.querySelector('[data-essential-label=serviceNumber]').textContent=type==='train'?'Train / service number (optional)':type==='bus'?'Bus / service number (optional)':'Service number (optional)';form.querySelector('[data-ground-vias]').hidden=flight;form.querySelectorAll('[data-ground-vias] input').forEach(n=>n.disabled=flight);form.querySelector('[name=addReturn]').closest('label').hidden=!!form._pendingOutbound;form.querySelector('[data-return-help]').hidden=!!form._pendingOutbound;
   for(const side of ['start','end']){const label=form.querySelector(`[data-endpoint-address="${side}"]`);if(label)label.hidden=flight;const field=form.querySelector(`[data-address-field="${side}"]`);if(field)field.hidden=flight;}
 }
 function renderVias(form){
   const host=form.querySelector('[data-ground-list]');if(!host)return;form._viaBindings?.forEach(b=>b.cancel());form._viaBindings=[];
   host.innerHTML=form._via.map((p,i)=>`<fieldset data-ground-index="${i}" class="ground-via"><legend>Via ${i+1}</legend><div class="flight-leg-actions"><button type="button" data-via-move="${i}" data-delta="-1" ${i===0?'disabled':''} aria-label="Move via ${i+1} earlier">↑</button><button type="button" data-via-move="${i}" data-delta="1" ${i===form._via.length-1?'disabled':''} aria-label="Move via ${i+1} later">↓</button><button type="button" data-via-remove="${i}">Remove</button></div><label class="field"><span>Station, stop, terminal or address</span><input data-via-field="name" value="${E(HVAddress.field(p,'name'))}" autocomplete="off" required></label><div class="airport-search-results" data-via-results></div><p class="helper" data-via-address>${E(HVAddress.address(p))}</p><button type="button" class="text-btn" data-via-plot="${i}">Find or plot on map</button><div class="form-grid">${[['arrivalLocal','Arrival (optional, local)'],['departureLocal','Departure (optional, local)'],['operator','Operator (optional)'],['serviceNumber','Service number (optional)']].map(([key,label])=>`<label class="field"><span>${label}</span><input data-via-field="${key}" type="${key.endsWith('Local')?'datetime-local':'text'}" value="${E(p[key])}"></label>`).join('')}</div></fieldset>`).join('');
   host.querySelectorAll('[data-ground-index]').forEach(row=>{const i=Number(row.dataset.groundIndex),input=row.querySelector('[data-via-field=name]');form._viaBindings.push(HVTravelSearch.bind(input,row.querySelector('[data-via-results]'),{context:()=>form.elements.type.value,onType(){form._via[i]={...form._via[i],name:input.value,lat:null,lon:null,address:'',countryCode:'',countryName:''};},onSelect(p){form._via[i]={...form._via[i],...p};row.querySelector('[data-via-address]').textContent=p.address||'';}}));});
   host.oninput=e=>{const input=e.target,row=input.closest('[data-ground-index]');if(!row||!input.dataset.viaField)return;form._via[Number(row.dataset.groundIndex)][input.dataset.viaField]=input.value;};
   host.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.viaRemove!==undefined){form._via.splice(Number(b.dataset.viaRemove),1);renderVias(form);}if(b.dataset.viaMove!==undefined){const i=Number(b.dataset.viaMove),j=i+Number(b.dataset.delta);if(j<0||j>=form._via.length)return;[form._via[i],form._via[j]]=[form._via[j],form._via[i]];renderVias(form);}if(b.dataset.viaPlot!==undefined){const i=Number(b.dataset.viaPlot);HVPlaces.open({context:form.elements.type.value,place:HVRouteGeometry.point(form._via[i])?form._via[i]:null,onSelect:p=>{form._via[i]={...form._via[i],...p};renderVias(form);}});}};
   update(form);
 }
 function read(form,record){const f=form.elements;if(record.type!=='flight')for(const side of ['start','end']){record[side].originalAddress||=record[side].address;record[side].address=f[side+'address'].value.trim();}for(const key of ['operator','serviceNumber','seat','notes'])record[key]=f[key].value.trim();const price=HVPrices.read(form);record.price=price&&record.price?{...record.price,...price}:price;return HVPrices.valid(record.price);}
 function reversed(record){
   const result={type:record.type,tripId:record.tripId,status:'planned',start:{...record.end},end:{...record.start},startLocal:'',endLocal:'',via:(record.via||[]).slice().reverse().map(p=>{const r={...p};for(const k of ['arrivalLocal','departureLocal','operator','serviceNumber'])delete r[k];return r;}),_returnEditor:true};
   if(record.type==='flight')result.legs=HVJourney.flightLegs(record).slice().reverse().map(l=>({id:uid(),start:{...l.end},end:{...l.start},startLocal:'',endLocal:'',airline:null,flightNumber:''}));
   return result;
 }
 function finish(form,record){
   const error=read(form,record);if(error){document.getElementById('transportError').textContent=error;return;}if(form._recalculateRoute)HVRouteStore.requestRefresh(record);
   let logoChanges;try{logoChanges=HVOperators.drafts(form);}catch(error){document.getElementById('transportError').textContent=error.message;return;}
   const callback=form._saveCallback;
   if(form.elements.addReturn.checked&&!form._pendingOutbound){const pending=record;document.getElementById('transportDialog').close();HVJourneys.openTransport(null,reversed(record));const next=document.getElementById('transportForm');next._pendingOutbound=pending;next._pendingOperatorLogos=logoChanges;next._saveCallback=callback;next.elements.startLocal.value='';next.elements.endLocal.value='';document.getElementById('transportDialogTitle').textContent='Add return journey';next.querySelector('[type=submit]').textContent='Save both journeys';const note=document.createElement('p');note.className='helper return-outbound-summary';note.textContent='Outbound ready: '+HVJourneys.transportLabel(pending)+'. Save this return to save both journeys.';next.querySelector('.transport-basics').after(note);const only=document.createElement('button');only.type='button';only.className='text-btn';only.textContent='Save outbound only';only.dataset.saveOutboundOnly='';note.after(only);only.onclick=()=>storeRecords([pending],callback,logoChanges);update(next);return;}
   const pending=form._pendingOutbound;if(pending){const link=pending.roundTripId||uid();pending.roundTripId=link;record.roundTripId=link;pending.relatedTransportId=record.id;record.relatedTransportId=pending.id;}
   storeRecords(pending?[pending,record]:[record],callback,logoChanges);
 }
 function storeRecords(records,callback,logoChanges=[]){
   const before={transports:state.transports,transportOperators:state.transportOperators};
   state.transportOperators=[...(state.transportOperators||[])];
   try{
     HVOperators.commit(state,records,logoChanges);
     if(!callback){
       const updated=new Map(records.map(record=>[record.id,record]));
       state.transports=(state.transports||[]).map(record=>updated.get(record.id)||record);
       const ids=new Set(state.transports.map(record=>record.id));
       state.transports.push(...records.filter(record=>!ids.has(record.id)));
     }
     if(persist()===false)throw new Error('This journey could not be saved. Keep this page open and try again.');
     if(callback)records.forEach(callback);
     else updatePassedPlannedTrips();
     document.getElementById('transportDialog').close();renderAll();
   }catch(error){Object.assign(state,before);document.getElementById('transportError').textContent=error.message;}
 }
 window.HVTransportDetails={setup,update,setPoint,read,finish,reversed};
})();

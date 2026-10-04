/* Herald's journey presentation is read-only. Editors keep the existing record/save services. */
(function(root){
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count=(n,word,plural=word+'s')=>`${n} ${Number(n)===1?word:plural}`;
  function date(value,options={}){
    const day=String(value||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
    const parsed=new Date(day+'T12:00:00Z');
    if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)return '';
    return parsed.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC',...options}).replace('Sept','Sep');
  }
  function range(start,end){
    const a=date(start),b=date(end);if(!a)return b||'Date not recorded';if(!b||String(start).slice(0,10)===String(end).slice(0,10))return a;
    const sameYear=String(start).slice(0,4)===String(end).slice(0,4);
    return date(start,{...(sameYear?{year:undefined}:{}),...(sameYear&&String(start).slice(0,7)===String(end).slice(0,7)?{month:undefined}:{})})+' - '+b;
  }
  function nights(start,end){return date(start)&&date(end)&&end>=start?Math.round((Date.parse(end.slice(0,10)+'T12:00:00Z')-Date.parse(start.slice(0,10)+'T12:00:00Z'))/86400000):null;}
  const house='<svg class="herald-stay-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m2 7 6-5 6 5M4 6v8h8V6M7 14v-4h2v4"/></svg>';
  const stayIcon=record=>root.HVAccommodationLogos?.icon(record,house)||house;
  function location(place,record={}){
    const A=root.HVAddress,field=(key)=>A?.field(place,key)||place?.[key]||'';
    const city=field('city')||field('area')||A?.text(record.location)||record.location||'';
    const country=field('countryName')||(typeof countryByCode==='function'?countryByCode(place?.countryCode||place?.countryCodes?.[0])?.name:'')||record.countryName||'';
    return [...new Set([city,country].filter(Boolean))].join(', ');
  }
  function header(title,subtitle,icon){return `<header class="herald-popup-head">${icon||'<span class="herald-place-icon" aria-hidden="true">•</span>'}<div><h3>${E(title)}</h3>${subtitle?'<p>'+E(subtitle)+'</p>':''}</div></header>`;}
  function actions(row){
    const record=row.record,type=row.leg?'transport':row.type==='accommodation'?'accommodation':row.destination||row.type==='country'?'country':'location';
    const editLabel=type==='transport'?'Edit journey':type==='accommodation'?'Edit stay':type==='country'?'Edit country stay':'Edit place';
    return `<footer class="herald-popup-actions">${row.leg&&row.group?'<button type="button" data-journey-view="'+E(row.group.key)+'">View journey</button>':''}<button type="button" data-journey-edit="${type}" data-record-id="${E(record.id)}">${editLabel}</button></footer>`;
  }
  function stayBody(row){
    const a=row.record,p=row.place||a.place||{},n=nights(a.checkIn,a.checkOut),address=root.HVAddress?.address(p)||'';
    const times=[a.checkInTime?'Check-in '+a.checkInTime:'',a.checkOutTime?'Check-out '+a.checkOutTime:'',a.timeZone||''].filter(Boolean).join(' · ');
    return `<div class="herald-popup-date">${E(range(a.checkIn,a.checkOut))}${n===null?'':' · '+count(n,'night')}</div>${times?'<p class="herald-popup-meta">'+E(times)+'</p>':''}${address?'<p class="herald-popup-address">'+E(address)+'</p>':''}${a.notes?'<p class="herald-popup-note">'+E(a.notes)+'</p>':''}${actions(row)}`;
  }
  function popup(row){
    const r=row.record,p=row.place||r.place||{};let content;
    if(row.type==='accommodation')content=header(root.HVAddress?.text(r.propertyName||p.name)||r.propertyName||p.name||'Stay',location(p,r),stayIcon(r))+stayBody(row);
    else if(row.leg){
      const J=root.HVJourney,items=r.type==='flight'?J.flightLegs(r):J.groundLegs(r),label=root.HVJourneys?.transportLabel(r)||J.transportLabel(r),leg=row.leg;
      const fullRoute=items.length?items.map((l,i)=>(i===0?[l.start]:[]).concat(l.end)).flat().map(point=>root.HVAddress?.field(point,'city')||root.HVAddress?.field(point,'name')||point?.name).filter(Boolean).join(' → '):'';
      const service=[...new Set(items.flatMap(l=>[l.airline?.name,l.flightNumber,l.operator,l.serviceNumber]).concat(r.operator,r.serviceNumber).filter(Boolean))].join(' · ');
      const times=[leg.startLocal?.slice(11,16),leg.endLocal?.slice(11,16)].filter(Boolean).join(' → ');
      content=header(label,root.HVJourney.types[r.type]||'Journey',root.HVTransportIcons.html(r.type))+`<div class="herald-popup-date">${E(range(r.startLocal,r.endLocal))}</div>${fullRoute?'<p class="herald-popup-address">'+E(fullRoute)+'</p>':''}${service?'<p class="herald-popup-meta">'+E(service)+'</p>':''}${times?'<p class="herald-popup-meta">'+(items.length>1?'Leg '+(Number(row.index||0)+1)+' · ':'')+E(range(leg.startLocal,leg.endLocal))+' · '+E(times)+' (local)</p>':''}${r.notes?'<p class="herald-popup-note">'+E(r.notes)+'</p>':''}${actions(row)}`;
    }else content=header(root.HVAddress?.text(p.name||r.location||r.countryName)||p.name||'Location',location(p,r))+`<div class="herald-popup-date">${E(range(row.start||r.date||r.start,row.end||r.endDate||r.end))}</div>${root.HVAddress?.address(p)?'<p class="herald-popup-address">'+E(root.HVAddress.address(p))+'</p>':''}${r.notes||p.notes?'<p class="herald-popup-note">'+E(r.notes||p.notes)+'</p>':''}${actions(row)}`;
    return '<article class="herald-popup-card">'+content+'</article>';
  }
  function hotelPopup(name,members){
    const rows=[...new Map(members.map(p=>[p.r.record.id,p.r])).values()];
    if(rows.length===1)return popup({...rows[0],record:{...rows[0].record,propertyName:name}});
    return '<article class="herald-popup-card">'+header(name,location(rows[0].place||rows[0].record.place,rows[0].record),stayIcon(rows[0].record))+'<p class="herald-popup-meta">Stayed '+rows.length+' times</p><div class="herald-stay-list">'+rows.map(row=>'<section>'+stayBody(row)+'</section>').join('')+'</div></article>';
  }
  const maps=[];let draft;
  function registerMap(map){
    maps.push(map);
    const fit=e=>{
      const popup=e.popup,element=popup?.getElement();if(!element)return;
      const surface=map.getContainer().getBoundingClientRect();
      popup.options.offset=root.L.point(0,7);element.classList.remove('herald-popup-below');popup.update();
      let box=element.getBoundingClientRect(),y=7;
      // Place the card below an edge pin when there is no room above it. Selection/map coordinates stay fixed.
      if(box.top<surface.top+8){y=box.height+22;element.classList.add('herald-popup-below');}
      let x=box.left<surface.left+8?surface.left+8-box.left:box.right>surface.right-8?surface.right-8-box.right:0;
      popup.options.offset=root.L.point(x,y);popup.update();
      const tip=element.querySelector('.leaflet-popup-tip-container');if(tip)tip.style.left=`calc(50% - ${x}px)`;
    };
    map.on('popupopen',fit);
    return ()=>{map.off('popupopen',fit);const i=maps.indexOf(map);if(i>=0)maps.splice(i,1);};
  }
  function activeMap(){return maps.findLast(map=>map.getContainer().isConnected&&map.getContainer().getBoundingClientRect().width>0);}
  function preview(place){
    clearPreview();const map=activeMap();if(!map||!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return;
    draft=root.L.marker([place.lat,place.lon],{interactive:false,icon:root.L.divIcon({className:'herald-map-pin journey-draft-pin',html:'<span aria-hidden="true"></span>',iconSize:[28,36],iconAnchor:[14,34]})}).addTo(map);
    map.setView([place.lat,place.lon],14,{animate:false});
    const drawer=document.querySelector('.journey-editor-drawer[open]');if(drawer&&innerWidth>760)map.panBy([Math.max(0,map.getContainer().getBoundingClientRect().right-drawer.getBoundingClientRect().left)/2,0],{animate:false});
  }
  function clearPreview(){draft?.remove();draft=null;}
  function showEditor(dialog){
    dialog.classList.add('journey-editor');
    const focused=document.querySelector('.journey-map-dialog[open]'),drawer=!!focused||document.body.dataset.currentView==='journeys'||root.location.hash.startsWith('#/journey-map');
    dialog.classList.toggle('journey-editor-drawer',drawer);
    const parent=dialog.parentNode;
    if(drawer){
      if(focused)focused.append(dialog);
      dialog.setAttribute('aria-modal',innerWidth>760?'false':'true');
      if(innerWidth>760)dialog.show();else dialog.showModal();
    }else{dialog.setAttribute('aria-modal','true');dialog.showModal();}
    const onKey=e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();dialog.close();}};
    const invalid=e=>{for(let node=e.target.parentElement;node&&node!==dialog;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;};
    dialog.addEventListener('keydown',onKey);dialog.addEventListener('invalid',invalid,true);
    dialog.addEventListener('close',()=>{dialog.removeEventListener('keydown',onKey);dialog.removeEventListener('invalid',invalid,true);clearPreview();if(dialog.isConnected&&parent&&dialog.parentNode!==parent)parent.append(dialog);},{once:true});
  }
  if(typeof document!=='undefined')document.addEventListener('click',event=>{
    const button=event.target.closest('[data-journey-edit],[data-journey-view]');if(!button)return;
    event.preventDefault();event.stopPropagation();
    if(button.dataset.journeyView){root.HVJourneyMap.open(button.dataset.journeyView);return;}
    const id=button.dataset.recordId;
    if(button.dataset.journeyEdit==='transport')root.HVJourneys.openTransport(id);
    else if(button.dataset.journeyEdit==='accommodation')root.HVPlaces.open({accommodationId:id});
    else if(button.dataset.journeyEdit==='country')openStayDialog(id);
    else root.HVPlaces.open({recordId:id});
  });
  const api={count,date,range,nights,location,popup,hotelPopup,registerMap,activeMap,preview,clearPreview,showEditor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVJourneyUI=api;
})(typeof window!=='undefined'?window:globalThis);

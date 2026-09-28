/* Separate journey map. Route services are read-only and never infer visited countries. */
(() => {
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const G=HVRouteGeometry,cache=new Map();let dialog,lastRequest=0;
  const styles={flight:{color:'#44758c',dashArray:'6 5'},bus:{color:'#ac7631'},car:{color:'#ac7631'},walk:{color:'#647d52',dashArray:'2 5'},train:{color:'#7c6187',dashArray:'10 3'},boat:{color:'#31848a',dashArray:'3 6'},other:{color:'#777',dashArray:'3 5'}};
  function airport(p){return G.point(p)||p?.manualAirport?p:{...HVJourneys.airportFor(p?.iata||p?.icao||p?.name||''),...p,lat:HVJourneys.airportFor(p?.iata||p?.icao||p?.name||'')?.lat,lon:HVJourneys.airportFor(p?.iata||p?.icao||p?.name||'')?.lon};}
  async function route(type,start,end,signal){
    const key=JSON.stringify([type,start.lat,start.lon,end.lat,end.lon]);if(cache.has(key))return cache.get(key);
    // FOSSGIS public routing limit: at most one request per second, shared across maps.
    const reserved=Math.max(Date.now(),lastRequest+1100),delay=reserved-Date.now();lastRequest=reserved;if(delay)await new Promise(r=>setTimeout(r,delay));if(signal.aborted)throw new DOMException('Closed','AbortError');
    let result;
    if(['car','bus','walk'].includes(type)){
      const service=type==='walk'?'foot':'car',url=`https://routing.openstreetmap.de/routed-${service}/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=false`;
      const response=await fetch(url,{signal});if(!response.ok)throw Error();const data=await response.json();if(data.code!=='Ok'||!data.routes?.[0]?.geometry)throw Error();
      // Reject a route whose provider snapped the points far away from the selected stops.
      if(data.waypoints?.some(p=>p.distance>2500))throw Error();
      result={coordinates:data.routes[0].geometry.coordinates.map(p=>[p[1],p[0]]),label:type==='walk'?'Calculated walking route':'Calculated road route'};
    }else if(['train','boat'].includes(type)){
      const mode=type==='train'?'train|railway':'ferry';
      const query=`[out:json][timeout:15];rel(around:2500,${start.lat},${start.lon})[route~"^(${mode})$"];out geom;`;
      const response=await fetch('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),{signal});if(!response.ok)throw Error();const data=await response.json();
      const coordinates=G.mappedPath(data.elements,start,end);if(!coordinates||coordinates.length<2)throw Error();result={coordinates,label:type==='train'?'Mapped railway route (OSM)':'Mapped ferry route (OSM)'};
    }else throw Error();
    cache.set(key,result);if(cache.size>80)cache.delete(cache.keys().next().value);return result;
  }
  function open(key){
    const group=HVCalendar.journeyGroups().find(g=>g.key===key);if(!group)return;
    dialog?.close();const opener=document.activeElement,controller=new AbortController();
    const own=document.createElement('dialog');dialog=own;own.className='journey-map-dialog';own.setAttribute('aria-labelledby','journeyMapTitle');
    const transports=group.transports.filter(t=>t.status!=='cancelled');
    const rows=transports.flatMap(t=>(t.type==='flight'?HVJourney.flightLegs(t):[t]).map((l,i)=>({record:t,leg:l,index:i,date:l.startLocal||t.startLocal||'',type:t.type}))).concat(group.accommodations.map(a=>({type:'accommodation',record:a,date:a.checkIn,place:a.place||{name:a.propertyName,lat:a.lat,lon:a.lon}})));
    const groups=HVCalendar.journeyGroups();
    const places=HVJourney.scoped(state.placeVisits||[],state.activeProfileId).filter(v=>v.category==='locations'&&HVJourney.validDate(v.date)&&v.status!=='not-recorded'&&(v.tripId?group.trip?.id===v.tripId:group.start<=v.date&&group.end>=(v.endDate||v.date)&&groups.filter(g=>g.start<=v.date&&g.end>=(v.endDate||v.date)).length===1));
    rows.push(...group.stays.filter(s=>s.status!=='cancelled').map(s=>({type:'country',record:s,date:s.start,place:{name:s.location||s.countryName}})));
    rows.push(...places.map(v=>({type:'location',record:v,date:v.date,place:v.place})));
    rows.sort((a,b)=>(a.leg?a.record.startLocal:a.date).localeCompare(b.leg?b.record.startLocal:b.date)||(a.index||0)-(b.index||0));
    own.innerHTML=`<header class="journey-map-head"><div><p class="eyebrow">JOURNEY MAP</p><h2 id="journeyMapTitle">${E(group.title)}</h2><p>${E(group.start)} – ${E(group.end)}</p><p class="helper" data-map-tile-status hidden role="status"></p></div><button type="button" class="secondary" data-map-close>Close ×</button></header><div class="journey-map-layout"><div class="journey-map-canvas" aria-label="Journey routes and places"></div><ol class="journey-map-stops">${rows.map((r,i)=>`<li data-map-row="${i}"><button class="journey-map-stop" type="button" data-map-stop="${i}"><span class="journey-stop-number">${i+1}</span><span><strong>${E(r.leg?HVJourney.transportLabel({...r.leg,type:r.type}):r.place?.name||r.record.propertyName||'Location')}</strong><small>${E(r.date.replace('T',' '))}${r.leg?.endLocal?' → '+E(r.leg.endLocal.replace('T',' ')):''}</small>${r.leg?`<small>${E([r.leg.airline?.name,r.leg.flightNumber].filter(Boolean).join(' · '))}</small>`:''}</span></button><p class="helper" data-route-status="${i}" role="status">${r.leg?'Checking route…':'Saved location'}</p><button type="button" class="text-btn" data-map-edit="${i}">Edit ${r.leg?'transport':r.type==='accommodation'?'accommodation':r.type==='country'?'country stay':'location'}</button></li>`).join('')||'<li class="empty-state">Add transport and plotted places to see this journey on the map.</li>'}</ol></div><footer class="journey-map-footer"><div class="journey-map-key">${[['flight','Flights'],['car','Road'],['walk','Walking'],['train','Rail'],['boat','Boats'],['accommodation','Accommodation'],['location','Locations']].map(([type,label])=>`<span><i class="key-${type}" style="--route-colour:${styles[type]?.color||'#985c4d'}"></i>${label}</span>`).join('')}</div><p>Flight arcs show connections, not actual flight tracks. Calculated routes may differ from the service taken. Stops are shown without a line when route data is unavailable. Times are local to each stop.</p><small>© OpenStreetMap contributors · Routing by <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS / OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Fix the map</a></small></footer>`;
    document.body.append(own);own.showModal();
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const map=L.map(own.querySelector('.journey-map-canvas'),{zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce}).setView([30,0],2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on('tileerror',()=>{const status=own.querySelector('[data-map-tile-status]');status.hidden=false;status.textContent='Map tiles are unavailable. Saved stops and route details are still shown.';}).addTo(map);
    const bounds=[],rowBounds=new Map(),markerLocations=new Set();
    function marker(p,index,label,type){if(!G.point(p))return;const latlng=[p.lat,p.lon];bounds.push(latlng);if(!rowBounds.has(index))rowBounds.set(index,[]);rowBounds.get(index).push(latlng);
      const markerKey=[type,p.lat,p.lon,label].join('|');if(markerLocations.has(markerKey))return;markerLocations.add(markerKey);
      L.marker(latlng,{title:label,icon:L.divIcon({className:`journey-map-marker marker-${type}`,html:`<span>${type==='accommodation'?'⌂':type==='flight'?E(HVJourney.airportLabel(p)):index+1}</span>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map).bindPopup(`<strong>${E(label)}</strong>`);
    }
    rows.forEach((r,i)=>{if(r.leg){r.start=r.type==='flight'?airport(r.leg.start):r.leg.start;r.end=r.type==='flight'?airport(r.leg.end):r.leg.end;marker(r.start,i,r.start?.name||'Departure',r.type);marker(r.end,i,r.end?.name||'Arrival',r.type);}else marker(r.place,i,r.place?.name||r.record.propertyName,r.type);});
    const fit=()=>{if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:14,animate:false});};requestAnimationFrame(()=>{map.invalidateSize();fit();});
    function draw(coords,type,i){L.polyline(coords,{...styles[type],weight:3,opacity:.85}).addTo(map);const mid=Math.floor(coords.length/2),a=coords[Math.max(0,mid-1)],b=coords[mid],angle=Math.atan2(b[0]-a[0],(b[1]-a[1])*Math.cos(b[0]*Math.PI/180))*180/Math.PI;
      L.marker(b,{interactive:false,icon:L.divIcon({className:'journey-direction',html:`<span style="color:${styles[type]?.color||'#777'};transform:rotate(${-angle}deg)">➤</span>`,iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);rowBounds.set(i,coords);
    }
    (async()=>{for(const [i,r] of rows.entries()){
      if(controller.signal.aborted)return;const status=own.querySelector(`[data-route-status="${i}"]`);
      if(r.type==='country'){status.textContent='Country stay · '+r.record.start+' – '+r.record.end;continue;}
      if(!r.leg){if(!G.point(r.place))status.textContent='No map position yet. Edit to search or place a pin.';continue;}
      if(!G.point(r.start)||!G.point(r.end)){status.textContent='Choose both locations in Edit transport to map this leg.';continue;}
      if(r.type==='flight'){draw(G.flightArc(r.start,r.end),'flight',i);status.textContent='Flight connection';continue;}
      status.textContent='Finding a mapped route…';const requestController=new AbortController(),timeout=setTimeout(()=>requestController.abort(),22000);const abort=()=>requestController.abort();controller.signal.addEventListener('abort',abort,{once:true});
      try{const result=await route(r.type,r.start,r.end,requestController.signal);if(!controller.signal.aborted){draw(result.coordinates,r.type,i);status.textContent=result.label;}}
      catch{if(!controller.signal.aborted)status.textContent='Route unavailable. Departure and arrival are shown; no estimated straight line.';}
      finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);}
    }})();
    own.querySelector('[data-map-close]').onclick=()=>own.close();
    own.addEventListener('click',e=>{const stop=e.target.closest('[data-map-stop]');if(stop){const points=rowBounds.get(Number(stop.dataset.mapStop));if(points?.length)map.fitBounds(points,{padding:[35,35],maxZoom:15,animate:false});}const edit=e.target.closest('[data-map-edit]');if(edit){const r=rows[Number(edit.dataset.mapEdit)];own.close();if(r.leg)HVJourneys.openTransport(r.record.id);else if(r.type==='accommodation')HVPlaces.open({accommodationId:r.record.id});else if(r.type==='country')openStayDialog(r.record.id);else HVPlaces.open({recordId:r.record.id});}});
    own.addEventListener('close',()=>{controller.abort();map.remove();own.remove();opener?.focus?.();});
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-journey-map]');if(button){e.preventDefault();open(button.dataset.journeyMap);}});
  // The global surface owns only Leaflet layers, never copies of saved records.
  function mountGlobal(host,rows,today,status){
    const controller=new AbortController(),reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const map=L.map(host,{zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce}).setView([25,0],2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map).on('tileerror',()=>{status.textContent='Map background unavailable. Your saved stops and routes remain available.';});
    const markers=L.layerGroup().addTo(map),points=[],bounds=[],routes=[];let unavailable=0,pending=0;
    const popup=r=>`<strong>${E(r.leg?HVJourney.transportLabel({...r.leg,type:r.type}):r.record.propertyName||r.place?.name||'Location')}</strong><br>${E(r.start||'Date not recorded')}${r.end!==r.start?' – '+E(r.end):''}${r.leg?'<br>'+E([r.leg.airline?.name,r.leg.flightNumber].filter(Boolean).join(' · ')):''}`;
    function addPoint(p,r){if(!G.point(p))return;const position=[Number(p.lat),Number(p.lon)];bounds.push(position);points.push({position,r,label:r.type==='flight'?HVJourney.airportLabel(p):r.type==='accommodation'?'⌂':'•',name:p.name||r.record.propertyName||'Location'});}
    function draw(coords,r,label){const past=r.end&&r.end<today;L.polyline(coords,{...styles[r.type],weight:past?2.5:3.5,opacity:past?.65:.95}).bindPopup(popup(r)+'<br>'+E(label)).addTo(map);
      const mid=Math.floor(coords.length/2),a=coords[Math.max(0,mid-1)],b=coords[mid],angle=Math.atan2(b[0]-a[0],(b[1]-a[1])*Math.cos(b[0]*Math.PI/180))*180/Math.PI;
      L.marker(b,{interactive:false,keyboard:false,icon:L.divIcon({className:'journey-direction',html:`<span style="color:${styles[r.type]?.color||'#777'};transform:rotate(${-angle}deg)">➤</span>`,iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
    }
    rows.forEach(r=>{if(r.leg){const start=r.type==='flight'?airport(r.leg.start):r.leg.start,end=r.type==='flight'?airport(r.leg.end):r.leg.end;addPoint(start,r);addPoint(end,r);if(G.point(start)&&G.point(end)){if(r.type==='flight')draw(G.flightArc(start,end),r,'Flight connection');else routes.push({r,start,end});}else unavailable++;}else{addPoint(r.place,r);if(!G.point(r.place))unavailable++;}});
    // Screen-space clusters update on zoom; coincident stops have a readable popup at maximum zoom.
    function cluster(){markers.clearLayers();const buckets=new Map();for(const p of points){const xy=map.latLngToContainerPoint(p.position),key=`${Math.floor(xy.x/52)}:${Math.floor(xy.y/52)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
      for(const members of buckets.values()){const p=members[0],many=members.length>1,position=many?[members.reduce((n,m)=>n+m.position[0],0)/members.length,members.reduce((n,m)=>n+m.position[1],0)/members.length]:p.position;
        const marker=L.marker(position,{title:many?`${members.length} journey stops. Open for details or zoom in.`:p.name,icon:L.divIcon({className:`journey-map-marker ${many?'journey-cluster':'marker-'+p.r.type}`,html:`<span>${many?members.length:E(p.label)}</span>`,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(markers);
        marker.bindPopup(`<div class="global-map-popup">${many?`<strong>${members.length} stops here</strong><p>Zoom in to separate nearby stops.</p>`:''}${members.map(m=>`<p>${E(m.name)}<br>${popup(m.r)}</p>`).join('')}</div>`,{maxHeight:260,maxWidth:300});
      }
    }
    map.on('zoomend moveend',cluster);
    const fit=()=>{map.invalidateSize();if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:12,animate:false});cluster();};requestAnimationFrame(()=>{if(!controller.signal.aborted)fit();});
    const report=()=>{status.textContent=`${rows.length} entries · ${points.length} mapped stops${pending?' · Loading '+pending+' surface routes…':''}${unavailable?' · '+unavailable+' entries have missing positions or unavailable routes; recorded stops remain visible.':''}${rows.length?'':' · No matching records. Change the filters or add a journey.'}`;};pending=routes.length;report();
    (async()=>{for(const {r,start,end} of routes){if(controller.signal.aborted)return;const request=new AbortController(),abort=()=>request.abort(),timer=setTimeout(abort,22000);controller.signal.addEventListener('abort',abort,{once:true});try{const result=await route(r.type,start,end,request.signal);if(!controller.signal.aborted)draw(result.coordinates,r,result.label);}catch{unavailable++;}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}if(controller.signal.aborted)return;pending--;report();}})();
    return {fit,remove(){controller.abort();map.remove();}};
  }

  window.HVJourneyMap={open,mountGlobal};
})();

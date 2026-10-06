/* Separate journey map. Route services are read-only and never infer visited countries. */
(() => {
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const G=HVRouteGeometry,R=HVRouteStore,cache=new Map(),pendingRoutes=new Map(),waterCache=new Map();let dialog,lastRequest=0,coastline,coastlineRequest,nextCoastlineAttempt=0;
  const FLIGHT_WEIGHT=1.5,styles={flight:{color:'#006768'},bus:{color:'#076800'},car:{color:'#680000'},walk:{color:'#535353',dashArray:'2 5'},train:{color:'#685600',dashArray:'10 3'},boat:{color:'#001B68',dashArray:'3 6'},other:{color:'#5C004C',dashArray:'3 5'}};
  const routeType=(type,record)=>G.isWater(type,record)?'boat':type;
  async function loadCoastline(){
    if(coastline)return coastline;
    if(!coastlineRequest){
      if(Date.now()<nextCoastlineAttempt)throw Error('Coastline unavailable');
      coastlineRequest=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const res=await (window.HVNetwork ? HVNetwork.request : fetch)('data/water-land.json?v=health-water-20261003',{signal:controller.signal});if(!res.ok)throw Error('Coastline unavailable');coastline=G.landMask(await res.json());return coastline;}catch(error){nextCoastlineAttempt=Date.now()+60000;throw error;}finally{clearTimeout(timer);coastlineRequest=null;}})();
    }
    return coastlineRequest;
  }
  async function waterFallback(start,end,signal){
    const key=JSON.stringify([start.lat,start.lon,end.lat,end.lon]);if(waterCache.has(key))return waterCache.get(key);
    try{
      if(signal?.aborted)throw Error('Closed');
      const mask=await loadCoastline(),coordinates=await G.marineWaterPath(start,end,mask,{signal});if(!coordinates||signal?.aborted)throw Error('Water path unavailable');
      const result={coordinates,label:coordinates.length===2?'Direct water connection (illustrative)':'Illustrative water route around the coastline',illustrative:true};waterCache.set(key,result);if(waterCache.size>80)waterCache.delete(waterCache.keys().next().value);return result;
    }catch{return {coordinates:[],label:'Recorded stops remain visible; water-aware route unavailable',illustrative:true,unavailable:true};}
  }
  async function serviceJSON(url,signal,maxMs){
    if(signal?.aborted)throw new DOMException('Closed','AbortError');
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,maxMs);signal?.addEventListener('abort',abort,{once:true});
    try{const response=await (window.HVNetwork ? HVNetwork.request : fetch)(url,{signal:controller.signal});if(!response.ok)throw Error('Route service unavailable');return await response.json();}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  function airport(p){return G.point(p)||p?.manualAirport?p:{...HVJourneys.airportFor(p?.iata||p?.icao||p?.name||''),...p,lat:HVJourneys.airportFor(p?.iata||p?.icao||p?.name||'')?.lat,lon:HVJourneys.airportFor(p?.iata||p?.icao||p?.name||'')?.lon};}
  async function harbourWays(stop,signal){
    // A tiny harbour extract is a backup for ferry ways when Overpass is down.
    // OSM returns complete ways, including their nodes outside this small box.
    const dy=.005,dx=dy/Math.max(.2,Math.cos(stop.lat*Math.PI/180)),bbox=[Math.max(-180,stop.lon-dx),Math.max(-90,stop.lat-dy),Math.min(180,stop.lon+dx),Math.min(90,stop.lat+dy)].join(',');
    const data=await serviceJSON('https://api.openstreetmap.org/api/0.6/map.json?'+new URLSearchParams({bbox}),signal,8000);
    if(data.error||!Array.isArray(data.elements)||data.elements.length>60000)throw Error('Harbour data unavailable');
    const nodes=new Map(data.elements.filter(e=>e.type==='node'&&G.point(e)).map(e=>[e.id,{lat:e.lat,lon:e.lon}]));
    return data.elements.filter(e=>e.type==='way'&&(e.tags?.route==='ferry'||e.tags?.['seamark:type']==='recommended_track'||e.tags?.waterway==='fairway')).map(e=>({...e,geometry:e.nodes?.map(id=>nodes.get(id))||[]}));
  }
  function railApiElements(data){
    if(data.error||!Array.isArray(data.elements)||data.elements.length>60000)throw Error('Railway data unavailable');
    const nodes=new Map(data.elements.filter(e=>e.type==='node'&&G.point(e)).map(e=>[e.id,{lat:e.lat,lon:e.lon}]));
    return data.elements.filter(e=>e.type==='way'&&/^(rail|light_rail|narrow_gauge|subway)$/.test(e.tags?.railway||'')).map(e=>({...e,geometry:e.nodes?.map(id=>nodes.get(id))||[]})).concat(data.elements.filter(e=>e.type==='relation'&&/^(train|railway|tracks|subway|light_rail)$/.test(e.tags?.route||'')));
  }
  async function railApiFallback(start,end,signal){
    // Tiny station extracts expose nearby infrastructure even when Overpass is
    // unavailable. At most two complete rail relations fill the intervening track.
    const extracts=await Promise.allSettled([start,end].map(stop=>{
      const dy=.005,dx=dy/Math.max(.2,Math.cos(stop.lat*Math.PI/180)),bbox=[Math.max(-180,stop.lon-dx),Math.max(-90,stop.lat-dy),Math.min(180,stop.lon+dx),Math.min(90,stop.lat+dy)].join(',');
      return serviceJSON('https://api.openstreetmap.org/api/0.6/map.json?'+new URLSearchParams({bbox}),signal,14000).then(railApiElements);
    }));
    if(signal.aborted)return null;
    const elements=extracts.flatMap(r=>r.status==='fulfilled'?r.value:[]),resolve=()=>G.networkPath(elements,start,end,{type:'train',signal});
    let coordinates=await resolve();if(coordinates)return coordinates;
    const candidates=new Map();for(let i=0;i<extracts.length;i++)if(extracts[i].status==='fulfilled'){
      const local=extracts[i].value,ways=new Set(local.filter(e=>e.type==='way').map(e=>e.id));
      for(const rel of local)if(rel.type==='relation'&&Number.isSafeInteger(rel.id)&&rel.members?.length<=2000&&rel.members.some(m=>m.type==='way'&&ways.has(m.ref))){
        if(!candidates.has(rel.id))candidates.set(rel.id,{rel,ends:new Set()});candidates.get(rel.id).ends.add(i);
      }
    }
    const ranked=[...candidates.values()].sort((a,b)=>b.ends.size-a.ends.size||Number(/^(railway|tracks)$/.test(b.rel.tags.route))-Number(/^(railway|tracks)$/.test(a.rel.tags.route))||a.rel.members.length-b.rel.members.length),selected=[];
    for(const side of [0,1]){const candidate=ranked.find(c=>c.ends.has(side));if(candidate&&!selected.some(c=>c.rel.id===candidate.rel.id))selected.push(candidate);}
    const complete=await Promise.allSettled(selected.map(c=>serviceJSON('https://api.openstreetmap.org/api/0.6/relation/'+c.rel.id+'/full.json',signal,16000).then(railApiElements)));
    for(const result of complete)if(result.status==='fulfilled')elements.push(...result.value);
    if(signal.aborted)return null;coordinates=await resolve();return coordinates;
  }
  async function railFallback(start,end,signal,exactElements,singleSource=false){
    // Reuse partial service geometry before asking for more railway data.
    const elements=[...exactElements],resolve=()=>G.networkPath(elements,start,end,{type:'train',signal});
    let coordinates=await resolve();if(coordinates)return coordinates;
    if(!singleSource){
      const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
      const usable=p=>p.then(coords=>{if(!coords)throw Error('Railway network unavailable');return coords;});
      try{return await Promise.any([usable(railFallback(start,end,controller.signal,exactElements,true)),usable((async()=>{await new Promise(r=>setTimeout(r,3000));if(controller.signal.aborted)return null;return railApiFallback(start,end,controller.signal);})())]);}
      catch{return null;}finally{controller.abort();signal.removeEventListener('abort',abort);}
    }
    for(const expanded of [false,true]){
      if(signal.aborted)throw new DOMException('Closed','AbortError');
      const query=G.networkQuery('train',start,end,{expanded});if(!query)return null;
      // Keep using OSM, with a second compatible instance when the first lookup
      // fails or its corridor cannot connect the stops. All requests are read-only.
      const reserved=Math.max(Date.now(),lastRequest+1100),delay=reserved-Date.now();lastRequest=reserved;if(delay)await new Promise(r=>setTimeout(r,delay));
      if(signal.aborted)throw new DOMException('Closed','AbortError');
      const service=expanded?'https://overpass.private.coffee/api/interpreter':'https://overpass-api.de/api/interpreter';
      try{const data=await serviceJSON(service+'?'+new URLSearchParams({data:query}),signal,expanded?18000:14000);if(Array.isArray(data.elements))elements.push(...data.elements);}catch{if(signal.aborted)throw new DOMException('Closed','AbortError');}
      coordinates=await resolve();if(coordinates)return coordinates;
    }
    return null;
  }
  async function marineRoute(start,end,signal){
    const mask=await loadCoastline(),fallbackRequest=waterFallback(start,end,signal);
    const reserved=Math.max(Date.now(),lastRequest+1100),delay=reserved-Date.now();lastRequest=reserved;if(delay)await new Promise(r=>setTimeout(r,delay));
    if(signal.aborted)throw new DOMException('Closed','AbortError');
    let elements=[];
    try{
      const query=`[out:json][timeout:8];rel(around:2500,${start.lat},${start.lon})[route=ferry];out geom;`;
      const data=await serviceJSON('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),signal,10000);elements=data.elements||[];
      const exact=G.safeMarinePath(G.mappedPath(elements,start,end,{type:'boat'}),mask);
      if(exact)return{coordinates:exact,label:'Mapped ferry route (OSM)'};
    }catch{if(signal.aborted)throw new DOMException('Closed','AbortError');}
    let coordinates=await G.networkPath(elements,start,end,{type:'boat',mask,signal});
    if(coordinates)return{coordinates,label:'Nearby mapped ferry / marine route (approximate)',illustrative:true};
    const query=G.networkQuery('boat',start,end);let unavailable=false;
    if(query)try{const data=await serviceJSON('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),signal,8000);elements.push(...data.elements||[]);}catch{unavailable=true;if(signal.aborted)throw new DOMException('Closed','AbortError');}
    if(unavailable){const harbours=await Promise.allSettled([start,end].map(p=>harbourWays(p,signal)));for(const result of harbours)if(result.status==='fulfilled')elements.push(...result.value);}
    if(signal.aborted)throw new DOMException('Closed','AbortError');
    coordinates=await G.networkPath(elements,start,end,{type:'boat',mask,signal});
    if(coordinates)return{coordinates,label:'Nearby mapped ferry / marine route (approximate)',illustrative:true};
    const fallback=await fallbackRequest;if(signal.aborted)throw new DOMException('Closed','AbortError');
    const partial=await G.marinePath(elements,start,end,mask,{signal,baseline:fallback.coordinates?.length?fallback.coordinates:null});
    if(partial?.coordinates?.length>=2)return{coordinates:partial.coordinates,label:partial.partial?'Mapped marine sections joined by water-aware connections (approximate)':fallback.label,illustrative:true};
    return fallback;
  }
  function route(type,start,end,signal,refreshToken=''){
    if(window.HVNetwork?.state==='offline')return Promise.reject(new Error('Route calculation needs an internet connection. Saved routes are unchanged.'));
    if(signal.aborted)return Promise.reject(new DOMException('Closed','AbortError'));
    const key=JSON.stringify([type,start.lat,start.lon,end.lat,end.lon,refreshToken]);if(cache.has(key))return Promise.resolve(cache.get(key));
    let pending=pendingRoutes.get(key);
    if(!pending){
      pending={controller:new AbortController(),subscribers:new Set()};pendingRoutes.set(key,pending);
      pending.promise=calculateRoute(type,start,end,pending.controller.signal).then(result=>{if(!result.unavailable){cache.set(key,result);if(cache.size>80)cache.delete(cache.keys().next().value);}return result;}).finally(()=>{if(pendingRoutes.get(key)===pending)pendingRoutes.delete(key);});
    }
    const lookup=pending,subscriber={};lookup.subscribers.add(subscriber);
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{lookup.subscribers.delete(subscriber);signal.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();reject(new DOMException('Closed','AbortError'));queueMicrotask(()=>{if(!lookup.subscribers.size&&pendingRoutes.get(key)===lookup)lookup.controller.abort();});};
      signal.addEventListener('abort',abort,{once:true});lookup.promise.then(result=>{cleanup();if(!signal.aborted)resolve(result);},error=>{cleanup();reject(error);});
    });
  }
  async function calculateRoute(type,start,end,signal){
    if(type==='boat')return marineRoute(start,end,signal);
    // FOSSGIS public routing limit: at most one request per second, shared across maps.
    const reserved=Math.max(Date.now(),lastRequest+1100),delay=reserved-Date.now();lastRequest=reserved;if(delay)await new Promise(r=>setTimeout(r,delay));if(signal.aborted)throw new DOMException('Closed','AbortError');
    let result,exactElements=[];
    try{
      if(['car','bus','walk'].includes(type)){
        const service=type==='walk'?'foot':'car',url=`https://routing.openstreetmap.de/routed-${service}/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=false`;
        const data=await serviceJSON(url,signal,22000);if(data.code!=='Ok'||!data.routes?.[0]?.geometry)throw Error();
        if(data.waypoints?.some(p=>p.distance>2500))throw Error();
        result={coordinates:data.routes[0].geometry.coordinates.map(p=>[p[1],p[0]]),label:type==='walk'?'Calculated walking route':'Calculated road route',distance:data.routes[0].distance??null,duration:data.routes[0].duration??null};
      }else if(['train','boat'].includes(type)){
        const mode=type==='train'?'train|railway':'ferry',query=`[out:json][timeout:15];rel(around:2500,${start.lat},${start.lon})[route~"^(${mode})$"];out geom;`;
        const data=await serviceJSON('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),signal,22000);exactElements=data.elements||[];
        const coordinates=G.mappedPath(exactElements,start,end,{type});if(!coordinates||coordinates.length<2)throw Error();result={coordinates,label:type==='train'?'Mapped railway route (OSM)':'Mapped ferry route (OSM)'};
      }else throw Error();
    }catch(error){
      if(signal.aborted)throw error;
      if(type==='train'){
        const coordinates=await railFallback(start,end,signal,exactElements);if(!coordinates||coordinates.length<2||signal.aborted)throw error;
        result={coordinates,label:'Nearby mapped railway route (approximate)',illustrative:true};
      }else{
      const query=G.networkQuery(type,start,end);if(!query)throw error;
      let elements=exactElements,networkUnavailable=false;const maskRequest=type==='boat'?loadCoastline().catch(()=>null):null;
      try{const data=await serviceJSON('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),signal,8000);elements=[...elements,...data.elements||[]];}catch{if(signal.aborted)throw error;networkUnavailable=true;}
      if(type==='boat'&&networkUnavailable)try{elements=[...elements,...await harbourWays(start,signal)];}catch{if(signal.aborted)throw error;}
      const mask=await maskRequest;
      const coordinates=await G.networkPath(elements,start,end,{type,mask,signal});if(!coordinates||coordinates.length<2||signal.aborted)throw error;
      result={coordinates,label:type==='boat'?'Nearby mapped ferry / marine route (approximate)':type==='train'?'Nearby mapped railway route (approximate)':type==='walk'?'Nearby mapped walking network (approximate)':'Nearby mapped road network (approximate)',illustrative:true};
      }
    }
    return result;
  }
  // Reconcile physical hotels without changing any stay or stored place snapshot.
  function pointLayer(map,points){
    const layer=L.layerGroup().addTo(map),hotels=points.filter(p=>p.type==='accommodation');
    const groups=HVAccommodationPlaces.groups(hotels.map(p=>p.r.record)).map(g=>({hotel:g,members:hotels.filter(p=>g.records.includes(p.r.record))}));
    groups.push(...points.filter(p=>p.type!=='accommodation').map(p=>({members:[p]})));
    const historical=HVAccommodationPlaces.groups(HVJourney.scoped(state.accommodations||[],state.activeProfileId));
    for(const {members,hotel} of groups){
      const p=members[0],count=new Set(members.map(x=>x.r?.record?.id||x)).size,flight=p.type==='flight',size=flight?8:hotel?16:10;
      const canonical=hotel&&(historical.find(g=>g.records.includes(p.r.record))||hotel),name=HVAddress.text(canonical?.name||p.name);
      const pin='<svg viewBox="0 0 16 20" aria-hidden="true"><path class="hotel-pin-shape" d="M8 .7a6.8 6.8 0 0 0-6.8 6.8C1.2 12.1 8 19.2 8 19.2s6.8-7.1 6.8-11.7A6.8 6.8 0 0 0 8 .7Z"/><path class="hotel-pin-house" d="m4.1 7.5 3.9-3 3.9 3M5.3 7v4.1h5.4V7M7.2 11.1V8.7h1.6v2.4"/></svg>';
      const m=L.marker(p.position,{title:name+(count>1?' · '+count+' separate stays':''),autoPanOnFocus:false,bubblingMouseEvents:false,icon:L.divIcon({className:`journey-map-marker marker-${routeType(p.type,p.r?.record)}`,html:`${hotel?pin:'<span></span>'}${count>1?'<small>×'+count+'</small>':''}`,iconSize:[size,hotel?20:size],iconAnchor:[size/2,hotel?19:size/2],popupAnchor:[0,hotel?-18:0]})}).addTo(layer);
      m.bindPopup(() => hotel?HVJourneyUI.hotelPopup(name,members):HVJourneyUI.popup(p.r),{className:'herald-map-popup',autoPan:false,closeOnClick:false,maxHeight:350,maxWidth:340,minWidth:Math.min(300,innerWidth-60)});
      m.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);m.openPopup();});
    }
    return {refresh(){}};
  }
  function savedRoute(record,index,type,start,end){const saved=R.get(record,index,type,start,end,window.HVNetwork?.state==='offline');return type==='boat'&&saved?.unavailable?null:saved;}
  function rememberRoute(record,index,type,start,end,result){
    const current=(state.transports||[]).find(t=>t.id===record.id);
    if(!current)return null;
    const leg=(current.type==='flight'?HVJourney.flightLegs(current):HVJourney.groundLegs(current))[index];
    const a=current.type==='flight'?airport(leg?.start):leg?.start,b=current.type==='flight'?airport(leg?.end):leg?.end;
    if(!leg||routeType(current.type,current)!==type||R.signature(type,index,a,b)!==R.signature(type,index,start,end)||(current.routeRefreshToken||'')!==(record.routeRefreshToken||''))return null;
    // Failed ferry lookups are retryable, never permanent empty saved routes.
    const impaired=[...(window.HVNetwork?.failures||[])].some(([host,f])=>/overpass|openstreetmap/.test(host)&&Date.now()-f.at<120000&&['network','timeout','server','rate-limit'].includes(f.kind));
    const previous=R.get(current,index,type,start,end,true);
    if(result.unavailable||window.HVNetwork?.state==='offline')return previous||result;
    if(impaired&&/^(Illustrative water|Direct water)/.test(result.label||'')&&previous?.coordinates?.length>=2&&!previous.unavailable)return previous;
    const saved=R.set(current,index,type,start,end,result);if(saved)persist();return saved||result;
  }
  function primeWaterRoute(record,index,start,end,signal,draw,report=()=>{}){
    waterFallback(start,end,signal).then(result=>{
      const previous=R.get(record,index,'boat',start,end,true);
      if(signal.aborted||result.unavailable||previous?.coordinates?.length>=2&&!previous.unavailable)return;
      const stored=rememberRoute(record,index,'boat',start,end,result);if(stored){draw(stored.coordinates);report(stored.label+' · checking mapped routes…');}
    });
  }
  function drawRoute(map,coords,type,options={},content){
    const road=['car','bus'].includes(type);if(type==='flight')options={...options,weight:FLIGHT_WEIGHT};const base={...styles[routeType(type)]||styles.other,...options,bubblingMouseEvents:false};
    const casing=road?L.polyline(coords,{...base,color:'#fff',weight:(base.weight||1.5)+1.5,opacity:.85,interactive:false}).addTo(map):null;
    const line=L.polyline(coords,base).addTo(map);line._routeCasing=casing;if(content)line.bindPopup(content,{className:'herald-map-popup',autoPan:false,closeOnClick:false,maxHeight:350,maxWidth:340,minWidth:Math.min(300,innerWidth-60)});
    line.on('mouseover',()=>line.setStyle({weight:type==='flight'?FLIGHT_WEIGHT:(base.weight||1.5)+1,opacity:1}));line.on('mouseout',()=>line.setStyle({weight:base.weight||1.5,opacity:base.opacity||.85}));line.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(content)line.openPopup(e.latlng);});return line;
  }

  function open(key,filters={}){
    const group=HVCalendar.journeyGroups().find(g=>g.key===key);if(!group)return;
    dialog?.close();const opener=document.activeElement,controller=new AbortController();
    const own=document.createElement('dialog');dialog=own;own.className='journey-map-dialog';own.setAttribute('aria-labelledby','journeyMapTitle');
    const transports=group.transports.filter(t=>t.status!=='cancelled'&&!HVJourney.hiddenHomeRecord(state,t));
    const rows=transports.flatMap(t=>(t.type==='flight'?HVJourney.flightLegs(t):HVJourney.groundLegs(t)).map((l,i)=>({record:t,leg:l,index:i,date:l.startLocal||t.startLocal||'',type:t.type}))).concat(group.accommodations.filter(a=>!HVJourney.hiddenHomeRecord(state,a)).map(a=>({type:'accommodation',record:a,date:a.checkIn,place:a.place||{name:a.propertyName,lat:a.lat,lon:a.lon}})));
    const groups=HVCalendar.journeyGroups();
    const places=HVJourney.scoped(state.placeVisits||[],state.activeProfileId).filter(v=>!HVJourney.hiddenHomeRecord(state,v)&&v.category==='locations'&&!group.trip?.excludedRecordIds?.placeVisits?.includes(v.id)&&HVJourney.validDate(v.date)&&v.status!=='not-recorded'&&(v.tripId?group.trip?.id===v.tripId:group.start<=v.date&&group.end>=(v.endDate||v.date)&&groups.filter(g=>g.start<=v.date&&g.end>=(v.endDate||v.date)).length===1));
    rows.push(...group.stays.filter(s=>s.status!=='cancelled'&&HVJourney.isTravelStay(state,s)).map(s=>({type:'country',record:s,date:s.start,place:{...s.place,name:s.location||s.countryName,lat:s.place?.lat??s.lat,lon:s.place?.lon??s.lon}})));
    rows.push(...places.map(v=>({type:'location',record:v,date:v.date,place:v.place})));
    for(let i=rows.length-1;i>=0;i--){const r=rows[i],kind=r.type==='flight'?'flights':r.leg?'transport':r.type==='accommodation'?'accommodation':'locations',span={start:String(r.leg?(r.leg.startLocal||r.record.startLocal||''):(r.record.checkIn||r.record.date||r.record.start||'')).slice(0,10),end:String(r.leg?(r.leg.endLocal||r.record.endLocal||r.leg.startLocal||r.record.startLocal||''):(r.record.checkOut||r.record.endDate||r.record.end||r.record.checkIn||r.record.date||r.record.start||'')).slice(0,10)};if(!HVGlobalJourney.intersects(span,filters.range)||filters.prefs&&HVGlobalJourney.filter([{...span,kind}],filters.prefs,isoDate(new Date()),filters.range).length===0)rows.splice(i,1);}
    rows.sort((a,b)=>(a.leg?a.record.startLocal.slice(0,10):a.date).localeCompare(b.leg?b.record.startLocal.slice(0,10):b.date)||(a.record===b.record&&a.leg&&b.leg?a.index-b.index:0)||((a.leg?a.record.startLocal.slice(11):a.record.checkInTime)&&(b.leg?b.record.startLocal.slice(11):b.record.checkInTime)&&(!a.record.timeZone||!b.record.timeZone||a.record.timeZone===b.record.timeZone)?(a.leg?a.record.startLocal.slice(11):a.record.checkInTime).localeCompare(b.leg?b.record.startLocal.slice(11):b.record.checkInTime):0)||(a.record.journeyOrder??a.index??0)-(b.record.journeyOrder??b.index??0));
    own.innerHTML=`<header class="journey-map-head"><div><p class="eyebrow">JOURNEY MAP</p><h2 id="journeyMapTitle">${E(group.title)}</h2><p>${E(HVJourneyUI.range(group.start,group.end))}</p><p class="helper" data-map-tile-status hidden role="status"></p></div><button type="button" class="secondary" data-map-close>Close ×</button></header><div class="journey-map-layout"><div class="journey-map-canvas" aria-label="Journey routes and places"></div><ol class="journey-map-stops">${rows.map((r,i)=>`<li data-map-row="${i}"><button class="journey-map-stop" type="button" data-map-stop="${i}"><span class="journey-stop-number">${i+1}</span><span><strong>${E(r.leg?HVJourney.transportLabel({...r.leg,type:r.type}):HVAddress.text(r.place?.name||r.record.propertyName||'Location'))}</strong><small>${E(HVJourneyUI.date(r.date))}${r.leg?.startLocal?.slice(11)?' · '+E(r.leg.startLocal.slice(11)):''}${r.record.checkInTime?' · '+E(r.record.checkInTime):''}${r.record.checkOutTime?' → '+E(HVJourneyUI.date(r.record.checkOut)+' '+r.record.checkOutTime):''}${r.record.timeZone?' · '+E(r.record.timeZone):''}${r.leg?.endLocal?' → '+E(HVJourneyUI.date(r.leg.endLocal)+' '+r.leg.endLocal.slice(11)):''}</small>${r.leg?`<small>${E([r.leg.airline?.name,r.leg.flightNumber].filter(Boolean).join(' · '))}</small>${r.type==='flight'?`<small>${E(HVJourney.airportDetails(r.leg.start,HVJourneys.airportFor))} → ${E(HVJourney.airportDetails(r.leg.end,HVJourneys.airportFor))}</small>`:''}`:''}</span></button><p class="helper" data-route-status="${i}" role="status">${r.leg?'Checking route…':'Saved location'}</p><button type="button" class="text-btn" data-map-edit="${i}">Edit ${r.leg?'transport':r.type==='accommodation'?'accommodation':r.type==='country'?'country stay':'location'}</button></li>`).join('')||'<li class="empty-state">Add transport and plotted places to see this journey on the map.</li>'}</ol></div><footer class="journey-map-footer"><div class="journey-map-key">${[['flight','Flights'],['bus','Bus / coach'],['car','Road'],['walk','Walking'],['train','Rail'],['boat','Boats'],['other','Other transport'],['accommodation','Accommodation'],['location','Locations']].map(([type,label])=>`<span><i class="key-${type}" style="--route-colour:${styles[type]?.color||'#985c4d'}"></i>${label}</span>`).join('')}</div><p>Flight arcs show connections, not actual flight tracks. Calculated routes may differ from the service taken. Water fallback routes use Natural Earth coastlines and are illustrative, not navigation. Straight connections join recorded stops when no route can be calculated. Times are local to each stop.</p><small>© OpenStreetMap contributors · Routing by <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS / OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Fix the map</a></small></footer>`;
    document.body.append(own);own.showModal();
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const map=L.map(own.querySelector('.journey-map-canvas'),{scrollWheelZoom:true,zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce}).setView([30,0],2);const unregisterMap=HVJourneyUI.registerMap(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on('tileerror',()=>{const status=own.querySelector('[data-map-tile-status]');status.hidden=false;status.textContent='Map tiles are unavailable. Saved stops and route details are still shown.';}).addTo(map);
    const bounds=[],rowBounds=new Map(),markerLocations=new Set(),stopPoints=[];
    function marker(p,index,label,type){if(!G.point(p))return;const latlng=[p.lat,p.lon];bounds.push(latlng);if(!rowBounds.has(index))rowBounds.set(index,[]);rowBounds.get(index).push(latlng);
      const markerKey=[type,p.lat,p.lon,label].join('|');if(type!=='accommodation'&&markerLocations.has(markerKey))return;markerLocations.add(markerKey);
      const row={...rows[index],group,start:rows[index].record.checkIn||rows[index].record.date||rows[index].record.start,end:rows[index].record.checkOut||rows[index].record.endDate||rows[index].record.end};stopPoints.push({position:latlng,name:label,type,label:type==='flight'?HVJourney.airportLabel(p):type==='accommodation'?'⌂':'•',r:row});
    }
    rows.forEach((r,i)=>{if(r.leg){r.start=r.type==='flight'?airport(r.leg.start):r.leg.start;r.end=r.type==='flight'?airport(r.leg.end):r.leg.end;marker(r.start,i,r.start?.name||'Departure',r.type);marker(r.end,i,r.end?.name||'Arrival',r.type);}else marker(r.place,i,r.place?.name||r.record.propertyName,r.type);});
    const pointSurface=pointLayer(map,stopPoints);
    const fit=()=>{if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:14,animate:false});};map.invalidateSize();fit();
    const routeLines=new Map();
    function draw(coords,type,i){const old=routeLines.get(i),selectedAt=old?.isPopupOpen()?old.getPopup().getLatLng():null;old?._routeCasing?.remove();old?.remove();if(coords.length<2){routeLines.delete(i);return;}routeLines.set(i,drawRoute(map,coords,type,{weight:1.5,opacity:.85},HVJourneyUI.popup({...rows[i],group})));if(selectedAt)routeLines.get(i).openPopup(selectedAt);rowBounds.set(i,coords);}
    (async()=>{for(const [i,r] of rows.entries()){
      if(controller.signal.aborted)return;const status=own.querySelector(`[data-route-status="${i}"]`);
      if(r.type==='country'){status.textContent='Country stay · '+r.record.start+' – '+r.record.end;continue;}
      if(!r.leg){if(!G.point(r.place))status.textContent='No map position yet. Edit to search or place a pin.';continue;}
      if(!G.point(r.start)||!G.point(r.end)){status.textContent='Choose both locations in Edit transport to map this leg.';continue;}
      const type=routeType(r.type,r.record),legIndex=Number.isInteger(r.index)?r.index:0,saved=savedRoute(r.record,legIndex,type,r.start,r.end);
      if(saved){draw(saved.coordinates,type,i);status.textContent='Saved route · '+saved.label;continue;}
      if(r.type==='flight'){const stored=rememberRoute(r.record,legIndex,'flight',r.start,r.end,{coordinates:G.flightArc(r.start,r.end),label:'Flight connection'});if(stored){draw(stored.coordinates,'flight',i);status.textContent='Flight connection · saved';}continue;}
      if(type==='boat'&&window.HVNetwork?.state!=='offline')primeWaterRoute(r.record,legIndex,r.start,r.end,controller.signal,coords=>draw(coords,type,i),label=>status.textContent=label);const previous=R.get(r.record,legIndex,type,r.start,r.end,true);if(previous)draw(previous.coordinates,type,i);else if(type!=='boat')draw([[r.start.lat,r.start.lon],[r.end.lat,r.end.lon]],type,i);status.textContent='Checking for a mapped route…';const requestController=new AbortController(),timeout=setTimeout(()=>requestController.abort(),60000);const abort=()=>requestController.abort();controller.signal.addEventListener('abort',abort,{once:true});
      try{const result=await route(type,r.start,r.end,requestController.signal,r.record.routeRefreshToken||'');if(!controller.signal.aborted){const stored=rememberRoute(r.record,legIndex,type,r.start,r.end,result);if(stored){draw(stored.coordinates,type,i);status.textContent=stored.label+' · saved';}}}
      catch{if(!controller.signal.aborted){const result=type==='boat'?await waterFallback(r.start,r.end,controller.signal):{coordinates:[[r.start.lat,r.start.lon],[r.end.lat,r.end.lon]],label:'Recorded stops joined by a straight line; route unavailable.',unavailable:true};if(!controller.signal.aborted){const stored=rememberRoute(r.record,legIndex,type,r.start,r.end,result);if(stored){draw(stored.coordinates,type,i);status.textContent=stored.label+' · saved';}}}}
      finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);}
    }})();
    own.querySelector('[data-map-close]').onclick=()=>own.close();
    own.addEventListener('click',e=>{const stop=e.target.closest('[data-map-stop]');if(stop){const points=rowBounds.get(Number(stop.dataset.mapStop));if(points?.length)map.fitBounds(points,{padding:[35,35],maxZoom:15,animate:false});}const edit=e.target.closest('[data-map-edit]');if(edit){const r=rows[Number(edit.dataset.mapEdit)];if(r.leg)HVJourneys.openTransport(r.record.id);else if(r.type==='accommodation')HVPlaces.open({accommodationId:r.record.id});else if(r.type==='country')openStayDialog(r.record.id);else HVPlaces.open({recordId:r.record.id});}});
    own.addEventListener('close',()=>{for(const editor of own.querySelectorAll('.journey-editor[open]')){editor.close();if(editor.id==='transportDialog')document.body.append(editor);}controller.abort();unregisterMap();map.remove();own.remove();opener?.focus?.();});
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-journey-map]');if(button){e.preventDefault();open(button.dataset.journeyMap,button.closest('#journeysView')?HVJourneyLibrary.filters():{});}});
  // The global surface owns only Leaflet layers, never copies of saved records.
  function mountGlobal(host,rows,today,status){
    const controller=new AbortController(),reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const map=L.map(host,{scrollWheelZoom:true,zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce}).setView([25,0],2);const unregisterMap=HVJourneyUI.registerMap(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map).on('tileerror',()=>{status.textContent='Map background unavailable. Your saved stops and routes remain available.';});
    const points=[],bounds=[],routes=[];let unavailable=0,pending=0;
    function addPoint(p,r){if(!G.point(p))return;const position=[Number(p.lat),Number(p.lon)];bounds.push(position);points.push({position,r,type:r.type,label:r.type==='flight'?HVJourney.airportLabel(p):r.type==='accommodation'?'⌂':'•',name:p.name||r.record.propertyName||'Location'});}
    const routeLines=new Map();
    function draw(coords,r,label){const old=routeLines.get(r.key),selectedAt=old?.isPopupOpen()?old.getPopup().getLatLng():null;old?._routeCasing?.remove();old?.remove();if(coords.length<2){routeLines.delete(r.key);return;}const past=r.end&&r.end<today;routeLines.set(r.key,drawRoute(map,coords,routeType(r.type,r.record),{weight:past?1.2:1.6,opacity:past?.72:.95},HVJourneyUI.popup(r)));if(selectedAt)routeLines.get(r.key).openPopup(selectedAt);}
    rows.forEach(r=>{if(r.leg){const start=r.type==='flight'?airport(r.leg.start):r.leg.start,end=r.type==='flight'?airport(r.leg.end):r.leg.end;addPoint(start,r);addPoint(end,r);if(G.point(start)&&G.point(end)){const type=routeType(r.type,r.record),legIndex=Number.isInteger(r.index)?r.index:0,saved=savedRoute(r.record,legIndex,type,start,end);if(saved){draw(saved.coordinates,r,saved.label);if(saved.unavailable)unavailable++;}else if(r.type==='flight'){const stored=rememberRoute(r.record,legIndex,'flight',start,end,{coordinates:G.flightArc(start,end),label:'Flight connection'});if(stored)draw(stored.coordinates,r,stored.label);}else{if(type==='boat'&&window.HVNetwork?.state!=='offline')primeWaterRoute(r.record,legIndex,start,end,controller.signal,coords=>draw(coords,r));const previous=R.get(r.record,legIndex,type,start,end,true);if(previous)draw(previous.coordinates,r,previous.label);else if(type!=='boat')draw([[start.lat,start.lon],[end.lat,end.lon]],r,'Straight connection between recorded stops; checking mapped route');routes.push({r,start,end,type,legIndex});}}else unavailable++;}else{addPoint(r.place,r);if(!G.point(r.place))unavailable++;}});
    const pointSurface=pointLayer(map,points);
    const fit=()=>{map.invalidateSize();if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:12,animate:false});pointSurface.refresh();};fit();
    const report=()=>{status.textContent=`${rows.length} entries · ${points.length} mapped stops${pending?' · Loading '+pending+' surface routes…':''}${unavailable?' · '+unavailable+' entries have missing positions or unavailable routes; recorded stops remain visible.':''}${rows.length?'':' · No matching records. Change the filters or add a journey.'}`;};pending=routes.length;report();
    (async()=>{for(const {r,start,end,type,legIndex} of routes){if(controller.signal.aborted)return;const request=new AbortController(),abort=()=>request.abort(),timer=setTimeout(abort,60000);controller.signal.addEventListener('abort',abort,{once:true});try{const result=await route(type,start,end,request.signal,r.record.routeRefreshToken||'');if(!controller.signal.aborted){const stored=rememberRoute(r.record,legIndex,type,start,end,result);if(stored)draw(stored.coordinates,r,stored.label);}}catch{if(!controller.signal.aborted){const result=type==='boat'?await waterFallback(start,end,controller.signal):{coordinates:[[start.lat,start.lon],[end.lat,end.lon]],label:'Straight connection between recorded stops; route unavailable',unavailable:true};if(result.unavailable)unavailable++;if(!controller.signal.aborted){const stored=rememberRoute(r.record,legIndex,type,start,end,result);if(stored)draw(stored.coordinates,r,stored.label);}}}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}if(controller.signal.aborted)return;pending--;report();}})();
    return {fit,remove(){controller.abort();unregisterMap();map.remove();}};
  }

  window.HVJourneyMap={open,mountGlobal,waterFallback,route};
})();

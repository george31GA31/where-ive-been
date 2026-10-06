/* Shared travel-focused geocoding. Search results never mutate travel records. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'&&module.exports?require('./address-display.js'):root.HVAddress;
  const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const tags={train:['railway:station','railway:halt'],bus:['amenity:bus_station','highway:bus_stop','public_transport:station'],boat:['amenity:ferry_terminal','harbour','waterway:dock'],flight:['aeroway:aerodrome'],accommodation:['tourism:hotel','tourism:hostel','tourism:guest_house','tourism:apartment','tourism:camp_site','tourism:resort']};
  const preferred={train:/station|halt|railway|rail/,bus:/bus_station|bus_stop|coach|bus station|bus stop|terminal/,boat:/ferry|port|harbour|harbor|dock/,flight:/aerodrome|airport/,accommodation:/hotel|hostel|resort|guest.house|apartment|camp.site|motel|chalet/};
  const cache=new Map();
  function normalise(feature){
    const p=feature.properties||{},[lon,lat]=feature.geometry?.coordinates||[],countryCode=String(p.countrycode||'').toUpperCase(),city=p.city||p.town||p.village||(p.osm_key==='place'&&/^(city|town|village)$/.test(p.osm_value)?p.name:''),district=p.district||p.suburb||'',area=city||district||p.locality||p.county||p.state||'';
    const originalAddress=[p.housenumber,p.street,p.postcode,p.locality,district,area,p.state,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),originalName=p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||area||'Unnamed place';
    const nameEn=p['name:en']||p.name_en||'',areaEn=p['city:en']||p['town:en']||p['village:en']||(/^(city|town|village)$/.test(p.osm_value)&&A.isLatin(nameEn||p.name)?nameEn||p.name:'');
    return A.place({id:`osm:${p.osm_type}:${p.osm_id}`,externalPlaceId:`osm:${p.osm_type}:${p.osm_id}`,name:originalName,nameEn,nameSource:'geocoder',originalName,type:p.osm_value||'place',osmKey:p.osm_key||'',countryCode,countryName:p.country||'',city,cityEn:areaEn,area,areaEn,district,locality:p.locality||'',county:p.county||'',state:p.state||'',address:originalAddress,originalAddress,addressAliases:areaEn&&area?{[area]:areaEn}:{},street:p.street||'',postcode:p.postcode||'',houseNumber:p.housenumber||'',bounds:p.extent||feature.bbox,lat,lon});
  }
  function rank(list,term,context='other'){
    const words=normal(term).split(/[^\p{L}\p{N}]+/u).filter(Boolean),unique=new Map();
    for(const p of list){
      if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
      const name=normal(p.name),hay=normal([p.name,...(p.aliases||[]),p.address,p.area,p.city,p.countryName].join(' '));
      const relevance=words.reduce((n,w)=>n+(name.includes(w)?8:hay.includes(w)?2:0),0);
      if(words.length&&!relevance)continue;
      const score=relevance+(name===normal(term)?15:0)+(preferred[context]?.test(normal([p.type,p.osmKey,p.name].join(' ')))?60:0)+(p.personal?12:0);
      const key=p.externalPlaceId||p.id||[name,p.lat,p.lon].join('|');
      if(!unique.has(key)||unique.get(key).score<score)unique.set(key,{...p,score});
    }
    return [...unique.values()].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  }
  function enrich(p){return {...p,countryName:root.countryByCode?.(p.countryCode)?.name||p.countryName||''};}
  async function search(term,{context='other',area='',centre,signal}={}){
    term=term.trim();if(term.length<2)return [];
    const saved=root.HVSavedPlaces?.search(term)||[],key=normal([term,context,area,centre?.lat,centre?.lng].join('|'));
    if(cache.has(key))return rank([...saved,...cache.get(key)],term,context);
    const params=new URLSearchParams({q:[term,area].filter(Boolean).join(' '),limit:'40',lang:'en'});
    if(centre){params.set('lat',centre.lat);params.set('lon',centre.lng);}
    const variants=[params];
    if(tags[context]){const focused=new URLSearchParams(params);tags[context].forEach(t=>focused.append('osm_tag',t));variants.unshift(focused);}
    const responses=await Promise.allSettled(variants.map(async p=>{
      const res=await (root.HVNetwork ? root.HVNetwork.request : fetch)('https://photon.komoot.io/api/?'+p,{signal,headers:{Accept:'application/json'}});
      if(!res.ok)throw Error('Search unavailable');return ((await res.json()).features||[]).map(normalise).map(enrich);
    }));
    if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
    const matches=responses.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
    if(!responses.some(r=>r.status==='fulfilled')){if(saved.length)return rank(saved,term,context);throw Error('Online search unavailable');}
    cache.set(key,matches);if(cache.size>100)cache.delete(cache.keys().next().value);
    return rank([...saved,...matches],term,context);
  }
  async function reverse(lat,lon,signal){
    const res=await (root.HVNetwork ? root.HVNetwork.request : fetch)('https://photon.komoot.io/reverse?'+new URLSearchParams({lat,lon,limit:'1',lang:'en'}),{signal});
    if(!res.ok)throw Error('Address lookup unavailable');const feature=(await res.json()).features?.[0];return feature?enrich(normalise(feature)):null;
  }
  async function resolveCity(place,signal){
    const p=A.place(place),fallback=p.city||p.area||'';
    if(p.personal||!p.countryCode||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return fallback;
    // A county/state can share its name with a city. Only use it when a nearby
    // settlement confirms the name; never substitute an arbitrary nearest city.
    const subdivision=[p.district,p.locality].some(n=>n&&normal(n).trim()===normal(fallback).trim());
    const hierarchy=(subdivision?[p.county,p.state,p.city,p.area]:[p.city,p.area,p.county,p.state]).filter(Boolean);
    if(!hierarchy.length||!p.county&&!p.state)return fallback;
    const params=new URLSearchParams({lat:p.lat,lon:p.lon,radius:'50',limit:'20',lang:'en'});
    for(const type of ['city','town','village'])params.append('osm_tag','place:'+type);
    try{
      const response=await (root.HVNetwork ? root.HVNetwork.request : fetch)('https://photon.komoot.io/reverse?'+params,{signal,headers:{Accept:'application/json'}});
      if(!response.ok)return fallback;
      const settlements=((await response.json()).features||[]).filter(f=>{
        const v=f.properties||{};
        return v.osm_key==='place'&&/^(city|town|village)$/.test(v.osm_value)&&String(v.countrycode||'').toUpperCase()===p.countryCode;
      }).map(normalise);
      for(const name of hierarchy){
        const match=settlements.find(s=>[s.name,s.originalName,s.nameEn].some(n=>n&&normal(n).trim()===normal(name).trim()));
        if(match)return match.name;
      }
      return fallback;
    }catch(error){if(signal?.aborted)throw error;return fallback;}
  }
  function bind(input,host,{context=()=> 'other',onSelect,onType=()=>{},area=()=>''}={}){
    let request=0,timer,controller,matches=[];
    const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function run(){const term=input.value.trim(),token=++request;controller?.abort();host.replaceChildren();if(term.length<2)return;
      controller=new AbortController();host.innerHTML='<p class="helper" role="status">Searching places…</p>';
      try{matches=await search(term,{context:context(),area:area(),signal:controller.signal});if(token!==request||!input.isConnected)return;
        host.innerHTML=matches.slice(0,12).map((p,i)=>`<button type="button" data-travel-result="${i}"><span><strong>${E(p.name)}</strong><small>${E([p.type,p.area,p.countryName].filter(Boolean).join(' · '))}</small><small>${E(p.address)}</small></span></button>`).join('')||'<p class="helper" role="status">No matches. Try a full address or plot on map.</p>';
      }catch(e){if(token===request&&e.name!=='AbortError')host.innerHTML='<p class="helper" role="status">Search is unavailable. Enter a place or plot on map.</p>';}
    }
    const onInput=()=>{onType();clearTimeout(timer);controller?.abort();request++;host.replaceChildren();timer=setTimeout(run,400);};
    const onKey=e=>{if(e.key==='ArrowDown'&&host.querySelector('button')){e.preventDefault();host.querySelector('button').focus();}if(e.key==='Enter'&&input.value.trim().length>=2){e.preventDefault();clearTimeout(timer);run();}if(e.key==='Escape')host.replaceChildren();};
    const onChoice=e=>{const b=e.target.closest('[data-travel-result]');if(!b)return;e.preventDefault();e.stopPropagation();clearTimeout(timer);controller?.abort();request++;const p=matches[Number(b.dataset.travelResult)];input.value=p.name;host.replaceChildren();onSelect(p);input.focus();};
    const onResultsKey=e=>{const buttons=[...host.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){host.replaceChildren();input.focus();}};
    input.addEventListener('input',onInput);input.addEventListener('keydown',onKey);host.addEventListener('click',onChoice);host.addEventListener('keydown',onResultsKey);
    const clear=()=>{clearTimeout(timer);controller?.abort();request++;matches=[];host.replaceChildren();};
    return {clear,cancel(){clear();input.removeEventListener('input',onInput);input.removeEventListener('keydown',onKey);host.removeEventListener('click',onChoice);host.removeEventListener('keydown',onResultsKey);}};
  }
  const api={normalise,rank,search,reverse,resolveCity,bind,tags};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVTravelSearch=api;
})(typeof window!=='undefined'?window:globalThis);

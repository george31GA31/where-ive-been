/* Conservative, read-only physical-property reconciliation. Stays remain separate. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'&&module.exports?require('./address-display.js'):root.HVAddress;
  const norm=s=>A.text(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const name=s=>norm(s).replace(/\b(hotel|hotels|the|hôtel)\b/g,'').replace(/\s+/g,' ').trim();
  const point=p=>p?.lat!=null&&p?.lon!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const place=r=>({...r.place,name:r.propertyName||r.place?.name||r.name||'',address:r.place?.address||r.address||'',city:r.place?.city||r.city||'',countryCode:r.place?.countryCode||r.countryCode||'',lat:r.place?.lat??r.lat,lon:r.place?.lon??r.lon});
  function distance(a,b){if(!point(a)||!point(b))return null;const rad=Math.PI/180,dlat=(Number(b.lat)-Number(a.lat))*rad,dlon=(Number(b.lon)-Number(a.lon))*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));}
  function identifiers(p){return [p.externalPlaceId,p.osmId&&'osm:'+p.osmId,p.provider&&p.providerPlaceId&&p.provider+':'+p.providerPlaceId,/^osm:/.test(p.id||'')&&p.id].filter(Boolean).map(String);}
  function names(p){return [p.name,...(p.aliases||[])].map(name).filter(Boolean);}
  function similar(a,b){return names(a).some(x=>names(b).some(y=>{if(x===y)return true;const left=x.split(' '),right=y.split(' '),small=left.length<right.length?left:right,large=left.length<right.length?right:left;if(small.length>=2&&small.every(w=>large.includes(w))&&small.join(' ').length>=7)return true;const grams=s=>new Set([...s.replace(/ /g,'')].slice(0,-1).map((_,i)=>s.replace(/ /g,'').slice(i,i+2))),gx=grams(x),gy=grams(y),shared=[...gx].filter(g=>gy.has(g)).length;return Math.min(x.length,y.length)>=8&&2*shared/(gx.size+gy.size)>=.92;}));}
  function same(a,b){
    const metres=distance(a,b);
    if(metres!==null&&metres>90)return false;
    for(const key of ['countryCode','city','postcode'])if(a[key]&&b[key]&&norm(a[key])!==norm(b[key]))return false;
    const aid=identifiers(a),bid=identifiers(b),identity=aid.some(id=>bid.includes(id));
    const streetA=norm(a.street||a.address),streetB=norm(b.street||b.address),address=streetA&&streetB&&streetA===streetB;
    const num=p=>String(p.houseNumber||p.housenumber||p.address||'').match(/^\s*(\d+\w?)\b/)?.[1];
    if(num(a)&&num(b)&&norm(num(a))!==norm(num(b)))return false;
    if(a.street&&b.street&&norm(a.street)!==norm(b.street))return false;
    if(identity)return true;
    if(!similar(a,b))return false;
    // Distinct OSM objects of the same kind often represent neighbouring hotels.
    if(aid.some(x=>bid.some(y=>x.split(':').slice(0,2).join(':')===y.split(':').slice(0,2).join(':')&&x!==y)))return false;
    if(metres===null)return false;
    const exact=names(a).some(x=>names(b).includes(x));
    const phone=a.phone&&b.phone&&String(a.phone).replace(/\D/g,'')===String(b.phone).replace(/\D/g,'');
    return (metres<=60&&address&&(exact||num(a)&&num(b)||metres<=30))||(metres<=25&&exact&&(!streetA||!streetB||address))||(metres<=60&&phone);
  }
  function canonical(records){
    const choices=records.map(r=>({r,p:place(r)}));
    const longest=Math.max(...choices.map(c=>c.p.name.length));
    const quality=({r,p})=>(r.userEnteredName||p.nameSource==='user')&&p.name.length>=longest*.7?3:p.officialName?2:p.nameSource==='geocoder'?1:0;
    choices.sort((a,b)=>quality(b)-quality(a)||b.p.name.length-a.p.name.length);
    const p=choices[0]?.p||{},aliases=[...new Set(records.flatMap(r=>[r.propertyName,r.place?.name,...(r.place?.aliases||[])]).filter(Boolean))];
    return {place:{...p,aliases},name:p.name,aliases,records};
  }
  function groups(records){
    const result=[];
    for(const record of records){const p=place(record),group=result.find(g=>g.records.every(r=>same(place(r),p)));if(group)group.records.push(record);else result.push({records:[record]});}
    return result.map(g=>canonical(g.records));
  }
  const api={norm,name,place,point,distance,same,groups,canonical};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVAccommodationPlaces=api;
})(typeof window!=='undefined'?window:globalThis);

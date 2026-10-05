'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../journey-routes');
const sea={land:()=>false},coast=G.landMask(require('../data/water-land.json'));
const way=(id,coords,tags={railway:'rail'},nodes)=>({type:'way',id,tags,nodes,geometry:coords.map(p=>p?{lat:p[0],lon:p[1]}:null)});
const length=coords=>coords.slice(1).reduce((n,p,i)=>n+G.distance(coords[i],p),0),has=(coords,p)=>coords.some(c=>G.distance(c,p)<.02);
const resolve=(elements,a,b,type='train',extra={})=>G.networkPath(elements,{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]},{type,mask:sea,...extra});
test('Stops project onto the interior of a long track segment with short connectors',async()=>{
 const data=[way(1,[[0,0],[0,.3]])],before=JSON.stringify(data),a=[.004,.05],b=[-.004,.25],coords=await resolve(data,a,b);
 assert.deepEqual(coords[0],a);assert.deepEqual(coords.at(-1),b);assert.equal(coords.length,4);assert.ok(has(coords,[0,.05])&&has(coords,[0,.25]));assert.ok(length(coords)<24000);assert.equal(JSON.stringify(data),before);
 assert.equal(G.mappedPath(data,{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}),null);
});
test('Small missing rail sections are bridged while most of the real tracks are retained',async()=>{
 const coords=await resolve([way(1,[[0,0],[.01,.05],[0,.1]]),way(2,[[0,.101],[0,.15],[0,.2]])],[.003,0],[-.003,.2]);
 assert.ok(coords);for(const p of [[.01,.05],[0,.1],[0,.101],[0,.15]])assert.ok(has(coords,p));
});
test('A nearest isolated track does not hide a slightly more distant connected railway',async()=>{
 const coords=await resolve([way(1,[[0,0],[0,.02]]),way(2,[[.006,0],[.006,.1],[.006,.2]])],[0,0],[.006,.2]);assert.ok(coords);assert.ok(has(coords,[.006,.1]));
});
test('Grade separated crossings and inactive or inappropriate tracks are not fabricated into a railway',async()=>{
 const crossing=[way(1,[[0,0],[0,.1],[0,.2]],{railway:'rail',layer:'0'},[1,2,3]),way(2,[[-.1,.1],[0,.1],[.1,.1]],{railway:'rail',layer:'1'},[4,5,6])];
 assert.equal(await resolve(crossing,[0,0],[.1,.1]),null);
 for(const tags of [{railway:'disused'},{railway:'construction'},{railway:'rail',service:'yard'},{railway:'rail',access:'private'}])assert.equal(await resolve([way(1,[[0,0],[0,.2]],tags)],[0,0],[0,.2]),null);
});
test('Rail gap matching rejects sideways jumps onto parallel disconnected tracks',async()=>{
 assert.equal(await resolve([way(1,[[0,0],[0,.1]]),way(2,[[.002,.1],[.002,.2]])],[0,0],[.002,.2]),null);
});
test('Road fallbacks use roads, honour one way travel, and exclude private access',async()=>{
 const road=way(1,[[0,0],[.01,.1],[0,.2]],{highway:'primary',oneway:'yes'});assert.ok(await resolve([road],[0,0],[0,.2],'bus'));assert.equal(await resolve([road],[0,.2],[0,0],'bus'),null);
 assert.equal(await resolve([way(2,[[0,0],[0,.2]],{highway:'primary',access:'private'})],[0,0],[0,.2],'car'),null);
});
test('Implausible detours, tiny network fragments, far stops and large gaps are rejected',async()=>{
 assert.equal(await resolve([way(1,[[0,0],[.8,.1],[0,.2]])],[0,0],[0,.2]),null);
 assert.equal(await resolve([way(1,[[0,.095],[0,.105]])],[0,0],[0,.2]),null);
 assert.equal(await resolve([way(1,[[0,0],[0,.2]])],[1,0],[1,.2]),null);
 assert.equal(await resolve([way(1,[[0,0],[0,.05]]),way(2,[[0,.15],[0,.2]])],[0,0],[0,.2]),null);
});
test('Ferry fragments and small water gaps produce one continuous route',async()=>{
 const coords=await resolve([way(1,[[0,0],[.02,.06],[0,.12]],{route:'ferry'}),way(2,[[0,.135],[.01,.2],[0,.3]],{route:'ferry'})],[.005,0],[-.005,.3],'boat');
 assert.ok(coords);for(const p of [[.02,.06],[0,.12],[0,.135],[.01,.2]])assert.ok(has(coords,p));assert.deepEqual(coords[0],[.005,0]);assert.deepEqual(coords.at(-1),[-.005,.3]);
});
test('Ferry geometry takes priority over a shorter marine track; marine tracks remain a fallback',async()=>{
 const ferry=way(1,[[0,0],[.03,.1],[0,.2]],{route:'ferry'}),track=way(2,[[0,0],[0,.1],[0,.2]],{'seamark:type':'recommended_track'});
 const preferred=await resolve([track,ferry],[0,0],[0,.2],'boat');assert.ok(has(preferred,[.03,.1]));
 assert.ok(await resolve([track],[0,0],[0,.2],'boat'));
 assert.equal(await resolve([way(3,[[0,0],[0,.2]],{'seamark:type':'separation_lane',area:'yes'})],[0,0],[0,.2],'boat'),null);
});
test('Null geometry does not join distant clipped fragments into a made up route',async()=>{
 assert.equal(await resolve([way(1,[[0,0],[0,.05],null,[0,.15],[0,.2]])],[0,0],[0,.2]),null);
 const partial=await resolve([way(2,[[0,0],[0,.1],null,[0,.101],[0,.2]])],[0,0],[0,.2]);assert.ok(partial&&has(partial,[0,.1])&&has(partial,[0,.101]));
});
test('Boat fallback never crosses known land and cannot run without coastline data',async()=>{
 const island={land:(lat,lon)=>Math.abs(lat)<.025&&lon>.085&&lon<.115};
 assert.equal(await resolve([way(1,[[0,0],[0,.1],[0,.2]],{route:'ferry'})],[0,0],[0,.2],'boat',{mask:island}),null);
 assert.equal(await resolve([way(1,[[0,0],[0,.2]],{route:'ferry'})],[0,0],[0,.2],'boat',{mask:null}),null);
});
test('Closed maps and bounded computation stop safely',async()=>{
 const controller=new AbortController();controller.abort();const e=[way(1,[[0,0],[0,.2]])];assert.equal(await resolve(e,[0,0],[0,.2],'train',{signal:controller.signal}),null);assert.equal(await resolve(e,[0,0],[0,.2],'train',{maxMs:0}),null);
 assert.equal(G.networkQuery('other',{lat:0,lon:0},{lat:0,lon:1}),null);assert.equal(G.networkQuery('boat',{lat:0,lon:179},{lat:0,lon:-179}),null);
 for(const type of ['boat','train','bus']){const q=G.networkQuery(type,{lat:10.297,lon:123.905},{lat:9.65,lon:123.85});assert.match(q,/out body geom/);assert.match(q,/around:\d+,10.297,123.905,9.65,123.85/);}
});
test('Captured OSM Cebu, Solent and Aegean ways resolve without any exact service relation',async()=>{
 for(const [name,a,b]of [['cebu-ferry',[10.297,123.905],[9.65,123.85]],['portsmouth-ryde',[50.792,-1.105],[50.732,-1.158]],['piraeus-aegina',[37.934,23.634],[37.744,23.429]]]){
  const data=require('./fixtures/route-networks/'+name+'.json'),before=JSON.stringify(data),coords=await resolve(data.elements,a,b,'boat',{mask:coast});
  assert.equal(G.mappedPath(data.elements,{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}),null);assert.ok(coords?.length>2,name);assert.ok(length(coords)<G.distance(a,b)*1.7+1500,name+' avoids detours');assert.ok(coords.slice(1).every((p,i)=>G.waterSegment(coords[i],p,coast)),name+' stays on water');assert.equal(JSON.stringify(data),before);
  assert.ok(coords.some(p=>data.elements.some(w=>w.geometry.some(g=>g&&G.distance(p,[g.lat,g.lon])<.02))),name+' keeps real mapped vertices');
  if(name==='cebu-ferry')assert.ok(coords.some(p=>p[0]>9.88&&p[0]<10.15&&p[1]<123.84),'Uses the mapped corridor west of Bohol rather than a diagonal line');
 }
});
test('Real Paddington, Manchester and Ljubljana track extracts connect offset stations without a service relation',async()=>{
 for(const [name,a,b]of [['paddington-royal-oak',[51.5152,-.1755],[51.524,-.188]],['manchester-ardwick',[53.4775,-2.231],[53.4712,-2.213]],['ljubljana-tivoli',[46.059,14.512],[46.055,14.493]]]){
  const data=require('./fixtures/route-networks/'+name+'.json'),coords=await resolve(data.elements,a,b);assert.equal(G.mappedPath(data.elements,{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}),null);assert.ok(coords?.length>10,name);assert.deepEqual(coords[0],a);assert.deepEqual(coords.at(-1),b);assert.ok(length(coords)<G.distance(a,b)*2.4+1500);
 }
});
test('A missing marine section can bridge around a small island and rejoin the mapped ferry',async()=>{
 const island={land:(lat,lon)=>Math.abs(lat)<.005&&lon>.12&&lon<.13},coords=await resolve([way(1,[[0,0],[0,.11]],{route:'ferry'}),way(2,[[0,.14],[.01,.4],[0,.6]],{route:'ferry'})],[0,0],[0,.6],'boat',{mask:island});
 assert.ok(coords);assert.ok(has(coords,[0,.11])&&has(coords,[0,.14])&&has(coords,[.01,.4]));assert.ok(coords.slice(1).every((p,i)=>G.waterSegment(coords[i],p,island)));assert.ok(coords.some(p=>Math.abs(p[0])>.005&&p[1]>.11&&p[1]<.14));
});
test('Water-only rendering retains land-stop coordinates in data and starts the line in water',async()=>{
 const mask={land:(_lat,lon)=>lon<0},start={lat:0,lon:-.01},end={lat:0,lon:.2},before=JSON.stringify({start,end}),coords=await G.waterPath(start,end,mask,{waterOnly:true});assert.ok(coords&&coords.every(p=>!mask.land(...p)));assert.equal(JSON.stringify({start,end}),before);
 assert.equal(await G.waterPath({lat:0,lon:-.01},{lat:0,lon:-.010001},mask,{waterOnly:true}),null);
});

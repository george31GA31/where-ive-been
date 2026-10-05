'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../journey-routes');
const way=(id,coords,tags={railway:'rail'},nodes)=>({type:'way',id,tags,nodes,geometry:coords.map(p=>p?{lat:p[0],lon:p[1]}:null)});
const resolve=(elements,a,b,extra={})=>G.networkPath(elements,{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]},{type:'train',...extra});
const has=(coords,p)=>coords?.some(c=>G.distance(c,p)<.02),length=p=>p.slice(1).reduce((n,c,i)=>n+G.distance(p[i],c),0);
test('Incomplete train relations fall through to track snapping rather than silently joining clipped geometry',async()=>{
 const relation={type:'relation',tags:{route:'train'},members:[way(1,[[0,0],[.01,.08],[0,.1],null,[0,.101],[.01,.15],[0,.2]])]},a={lat:0,lon:0},b={lat:0,lon:.2};
 assert.equal(G.mappedPath([relation],a,b,{type:'train'}),null);
 const coords=await G.networkPath([relation],a,b,{type:'train'});assert.ok(coords);assert.ok(has(coords,[0,.1])&&has(coords,[0,.101]));
 const exact={type:'relation',members:[way(2,[[0,0],[.01,.1],[0,.2]])]};assert.deepEqual(G.mappedPath([exact],a,b,{type:'train'}),G.mappedPath([exact],a,b));
});
test('Relation geometry joins physical ways at the same railway junction, including bridge ends',async()=>{
 for(const layer of ['0','1']){
  const relation={type:'relation',id:100,tags:{route:'train'},members:[{...way(10,[[0,0],[0,.1]]),type:'way',ref:10,id:undefined,tags:undefined}]};
  const data=[relation,way(11,[[0,.1],[.01,.15],[0,.2]],{railway:'rail',layer},[2,3,4])],before=JSON.stringify(data),coords=await resolve(data,[0,0],[0,.2]);
  assert.ok(coords);assert.ok(has(coords,[0,.1])&&has(coords,[.01,.15]));assert.equal(JSON.stringify(data),before);
 }
});
test('Station passing loops stay routable without requiring a matching train service',async()=>{
 const data=[way(1,[[0,0],[0,.1]],{railway:'rail'},[1,2]),way(2,[[0,.1],[.01,.15],[.02,.2]],{railway:'rail',service:'siding'},[2,3,4])];
 const coords=await resolve(data,[0,0],[.02,.2]);assert.ok(coords);assert.ok(has(coords,[.01,.15]));
});
test('Passenger main lines with restricted track access remain plausible; industrial and freight-only tracks do not',async()=>{
 assert.ok(await resolve([way(1,[[0,0],[.01,.1],[0,.2]],{railway:'rail',usage:'main',access:'private','railway:traffic_mode':'passenger'})],[0,0],[0,.2]));
 for(const tags of [{railway:'rail',usage:'industrial'},{railway:'rail','railway:traffic_mode':'freight'},{railway:'rail',service:'spur'},{railway:'rail',service:'yard'},{railway:'rail',passenger:'no'}])assert.equal(await resolve([way(1,[[0,0],[0,.2]],tags)],[0,0],[0,.2]),null);
 const freight=way(1,[[0,0],[0,.2]],{railway:'rail','railway:traffic_mode':'freight'}),relation={type:'relation',tags:{route:'train'},members:[{type:'way',ref:1,geometry:freight.geometry}]};assert.equal(await resolve([freight,relation],[0,0],[0,.2]),null,'Relation membership does not erase richer physical track tags');
});
test('A small missing switch can attach to the interior of compatible track rather than abandoning the journey',async()=>{
 const data=[way(1,[[0,0],[.003,.097],[.001,.1]],{railway:'rail',gauge:'1435'},[1,2,3]),way(2,[[0,.09],[0,.15],[0,.2]],{railway:'rail',gauge:'1435'},[4,5,6])];
 const coords=await resolve(data,[0,0],[0,.2]);assert.ok(coords);assert.ok(has(coords,[.001,.1])&&has(coords,[0,.1015])&&has(coords,[0,.15]));
 const incompatible=data.map(w=>({...w,tags:{...w.tags,gauge:w.id===1?'1435':'1000'}}));assert.equal(await resolve(incompatible,[0,0],[0,.2]),null);
});
test('Unknown relation junctions never merge distinct physical node IDs at a crossing',async()=>{
 const data=[way(1,[[0,0],[0,.1],[0,.2]],{railway:'rail'},[1,2,3]),way(2,[[-.1,.1],[0,.1],[.1,.1]],{railway:'rail'},[4,5,6]),{type:'relation',tags:{route:'train'},members:[{ref:3,type:'way',geometry:[{lat:0,lon:.1},{lat:.15,lon:.1}]}]}];
 assert.equal(await resolve(data,[0,0],[.15,.1]),null);
});
test('A curving connected railway is preferred to a straight line without accepting huge detours',async()=>{
 const p=await resolve([way(1,[[0,0],[.025,.03],[.1,.03],[.1,.08],[0,.1]])],[0,0],[0,.1]);assert.ok(p);assert.ok(has(p,[.1,.08]));assert.ok(length(p)<G.distance([0,0],[0,.1])*3.5+3000);
 assert.equal(await resolve([way(1,[[0,0],[.8,.1],[0,.2]])],[0,0],[0,.2]),null);
});
test('Rail lookups search wider corridors and infrastructure at both stops without changing other transport queries',()=>{
 const a={lat:46.0593,lon:14.5135},b={lat:46.4365,lon:14.0554},compact=G.networkQuery('train',a,b),expanded=G.networkQuery('train',a,b,{expanded:true});
 assert.match(compact,/around:16432,46.0593,14.5135,46.4365,14.0554/);assert.match(expanded,/around:32864,46.0593,14.5135,46.4365,14.0554/);
 assert.match(expanded,/rel\(around:5000,46.0593,14.5135\)/);assert.match(expanded,/rel\(around:5000,46.4365,14.0554\)/);assert.match(expanded,/way\(r.lines\)/);assert.match(expanded,/railway\|tracks/);assert.doesNotMatch(expanded,/highway|ferry/);
 for(const type of ['boat','car','bus','walk'])assert.equal(G.networkQuery(type,a,b,{expanded:true}),G.networkQuery(type,a,b));
});
test('Regional OSM tracks resolve offset stations even with every service relation removed',async()=>{
 for(const [name,b,min,max]of [['ljubljana-dobova',[46.0859,15.1705],60000,70000],['ljubljana-jesenice',[46.4365,14.0554],60000,70000],['ljubljana-kocevje',[45.6466,14.8575],65000,75000]]){
  const a=[46.0593,14.5135],data=require('./fixtures/route-networks/'+name+'.json'),before=JSON.stringify(data),coords=await resolve(data.elements,a,b);
  assert.ok(coords?.length>1000,name);assert.deepEqual(coords[0],a);assert.deepEqual(coords.at(-1),b);assert.ok(length(coords)>min&&length(coords)<max,name+' follows the regional track corridor');assert.equal(JSON.stringify(data),before);
 }
});
test('The widened corridor retains the curving Kyle line which the previous direct corridor missed',async()=>{
 const data=require('./fixtures/route-networks/kyle-inverness.json'),a=[57.2804,-5.7139],b=[57.4801,-4.2237],direct=G.distance(a,b),scale=111320*Math.cos((a[0]+b[0])*Math.PI/360),v=[(b[1]-a[1])*scale,(b[0]-a[0])*111320];
 const offset=p=>{const w=[(p.lon-a[1])*scale,(p.lat-a[0])*111320],t=Math.max(0,Math.min(1,(w[0]*v[0]+w[1]*v[1])/(v[0]*v[0]+v[1]*v[1])));return Math.hypot(w[0]-t*v[0],w[1]-t*v[1]);};
 // Model the old query's narrow coverage with the same genuine OSM ways.
 const narrow=data.elements.filter(w=>w.geometry.some(p=>offset(p)<=Math.min(25000,direct*.2)));
 assert.equal(await resolve(narrow,a,b),null);const coords=await resolve(data.elements,a,b);assert.ok(coords?.length>1500);assert.ok(length(coords)>130000&&length(coords)<135000);assert.ok(coords.some(p=>p[0]>57.59),'The route reaches the real railway via Dingwall');
 const compact=G.networkQuery('train',{lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}),radius=Number(compact.match(/around:(\d+)/)[1]);assert.ok(radius>Math.max(...data.elements.flatMap(w=>w.geometry.map(offset))));
});

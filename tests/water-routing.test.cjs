'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../journey-routes'),data=require('../data/water-land.json'),mask=G.landMask(data);
const length=route=>route.slice(1).reduce((sum,p,i)=>sum+G.distance(route[i],p),0);
test('Water categories include ferry, cruise, taxi, vessels and explicitly classified records',()=>{
 for(const type of ['boat','ferry','cruise','water-taxi','speedboat','passenger vessel','sailboat'])assert.equal(G.isWater(type),true,type);
 assert.equal(G.isWater('other',{transportMode:'water'}),true);assert.equal(G.isWater('other',{waterTransport:true}),true);
 for(const type of ['flight','train','car','bus','walk','other'])assert.equal(G.isWater(type),false,type);
});
test('Open water stays direct and the date line uses the short connection',async()=>{
 const start={lat:10,lon:-77.5},end={lat:11,lon:-78},route=await G.waterPath(start,end,mask);assert.deepEqual(route,[[10,-77.5],[11,-78]]);
 const dateline=await G.waterPath({lat:0,lon:179},{lat:0,lon:-179},mask);assert.equal(dateline.length,2);assert.ok(length(dateline)<230000);
});
test('General fallback avoids mainland, a peninsula and islands, with exact saved endpoints',async()=>{
 const {geoContains}=await import('d3'),world=require('world-atlas/land-50m.json'),land=require('topojson-client').feature(world,world.objects.land);
 for(const [name,start,end]of [
  ['Darien',{lat:9.46,lon:-78.96},{lat:8.639,lon:-77.345}],
  ['Cornwall',{lat:50.13,lon:-5.06},{lat:50.21,lon:-5.49}],
  ['Aegean',{lat:37.93,lon:23.65},{lat:37.4,lon:25.26}]
 ]){
  const before=JSON.stringify({start,end}),route=await G.waterPath(start,end,mask);assert.ok(route?.length>2,name+' uses intermediate waypoints');assert.deepEqual(route[0],[start.lat,start.lon]);assert.deepEqual(route.at(-1),[end.lat,end.lon]);assert.equal(JSON.stringify({start,end}),before);
  assert.ok(length(route)<G.distance(route[0],route.at(-1))*3,name+' avoids excessive detours');
  // Validate against independent spherical containment, including points between every curve vertex.
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.max(1,Math.ceil(G.distance(a,b)/300));for(let j=0;j<=n;j++){const t=j/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(Math.min(G.distance(p,route[0]),G.distance(p,route.at(-1)))<1800)continue;assert.equal(geoContains(land,[p[1],p[0]]),false,name+' must remain over water');}}
  if(name==='Darien')assert.ok(route.some(p=>p[0]>9.3&&p[1]>-78.5),'Route rounds the northern coast instead of crossing the Darien');
 }
});
test('Coastline failures, inland endpoints, closed maps and computation limits return safely',async()=>{
 assert.throws(()=>G.landMask({schema:1,polygons:[[[[NaN,0],[0,0],[0,1],[NaN,0]]]]}));
 assert.equal(await G.waterPath({lat:9,lon:-79},{lat:8,lon:-77},null),null);
 assert.equal(await G.waterPath({lat:48.85,lon:2.35},{lat:51.5,lon:-.1},mask),null);
 const controller=new AbortController();controller.abort();assert.equal(await G.waterPath({lat:9.46,lon:-78.96},{lat:8.639,lon:-77.345},mask,{signal:controller.signal}),null);
 assert.equal(await G.waterPath({lat:9.46,lon:-78.96},{lat:8.639,lon:-77.345},mask,{maxNodes:0}),null);
});
test('Connected exact ferry routes retain their original geometry',()=>{
 const members=[{geometry:[{lat:37.93,lon:23.65},{lat:37.8,lon:23.9},{lat:37.4,lon:25.26}]}];
 assert.deepEqual(G.mappedPath([{members}],{lat:37.93,lon:23.65},{lat:37.4,lon:25.26}),[[37.93,23.65],[37.8,23.9],[37.4,25.26]]);
});

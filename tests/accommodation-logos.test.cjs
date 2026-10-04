'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Logos=require('../accommodation-logos.js'),M=require('../account-model.js');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=';
const place={id:'osm:N:1',externalPlaceId:'sur-hotel',name:'Best Western Sur',type:'Hotel',city:'Sur',countryCode:'OM',countryName:'Oman',address:'Sur Meandering Road, Sur, Oman',lat:22.57,lon:59.52};
const stay=(id,p=place,profileId='p')=>({id,profileId,propertyName:p.name,location:'Sur',checkIn:'2026-02-21',checkOut:'2026-02-22',notes:'Keep '+id,place:M.copy(p)});
const seed=()=>({version:2,activeProfileId:'p',profiles:[{id:'p',name:'Me'}],stays:[],trips:[],residences:[],transports:[],placeVisits:[],accommodations:[stay('first'),stay('repeat',{...place,id:'osm:W:2',name:'Best Western Sur Hotel'}),stay('other',{...place,id:'osm:N:3',externalPlaceId:'different',lat:22.58})],savedPlaces:[],custom:{keep:true}});
test('one location logo covers recognised repeat stays and future stays without changing any travel record',()=>{
  const data=seed(),before=M.copy(data);Logos.set(data,'first',image);
  assert.equal(data.savedPlaces.length,1);assert.equal(Logos.logo(data,'repeat'),image);assert.equal(Logos.logo(data,'other'),null);
  data.accommodations.push(stay('future',{...place,name:'Best Western Sur Hotel'}));assert.equal(Logos.logo(data,'future'),image);
  assert.deepEqual(data.accommodations.slice(0,3),before.accommodations);
  assert.deepEqual({...data,accommodations:before.accommodations,savedPlaces:[]},before);
  assert.equal(data.accommodations.some(a=>JSON.stringify(a).includes('data:image')),false);
  assert.equal(Logos.logo(JSON.parse(JSON.stringify(data)),'repeat'),image,'JSON reload retains the location asset');
  M.validateImport(data);
});
test('logos belong to the hotel across travellers but remain inside their account or guest data',()=>{
  const data=seed();data.accommodations[1].profileId='another-traveller';Logos.set(data,'first',image);
  assert.equal(Logos.logo(data,'repeat'),image);assert.equal(Logos.logo(seed(),'first'),null);
});
test('similar names and distinct nearby properties never share artwork',()=>{
  const data=seed();delete data.accommodations[0].place.externalPlaceId;
  data.accommodations[1].place={...place,id:'osm:N:2',externalPlaceId:undefined,lat:place.lat+.00005};
  Logos.set(data,'first',image);assert.equal(Logos.logo(data,'repeat'),null);assert.equal(Logos.logo(data,'other'),null);
});
test('existing catalogue rows, metadata and soft deletion are preserved',()=>{
  const data=seed(),row={id:'saved:existing',profileId:'p',place:M.copy(place),deleted:true,custom:{keep:'metadata'}};
  data.savedPlaces=[row];Logos.set(data,'repeat',image);assert.equal(data.savedPlaces.length,1);
  assert.deepEqual(row.place,place);assert.equal(row.deleted,true);assert.deepEqual(row.custom,{keep:'metadata'});
  Logos.set(data,'first',null);assert.equal(Logos.logo(data,'repeat'),null);assert.equal(row.accommodationLogo.src,null);
});
test('removal updates matched catalogue copies so an older duplicate cannot resurrect its logo',()=>{
  const data=seed();data.savedPlaces=[{id:'one',place:M.copy(place),accommodationLogo:{src:image,updatedAt:'2026-01-01'}},{id:'two',place:M.copy(place),accommodationLogo:{src:image,updatedAt:'2026-02-01'}}];
  Logos.set(data,'repeat',null,'2026-10-05T00:00:00Z');
  assert.equal(Logos.logo(JSON.parse(JSON.stringify(data)),'first'),null);assert.equal(data.savedPlaces.length,2);
  assert.ok(data.savedPlaces.every(r=>r.accommodationLogo.src===null));
});
test('unknown stays and untrusted image URLs cannot change or render stored artwork',()=>{
  const data=seed(),before=M.copy(data);assert.throws(()=>Logos.set(data,'missing',image));assert.throws(()=>Logos.set(data,'first','https://example.test/logo.png'));assert.deepEqual(data,before);
  data.savedPlaces=[{id:'unsafe',place:M.copy(place),accommodationLogo:{src:'data:image/svg+xml,<svg onload="alert(1)"></svg>',updatedAt:'2026-10-05'}}];assert.equal(Logos.logo(data,'first'),null);
});
test('the logo control accepts data, never arbitrary icon markup from a caller',()=>{
  const html=Logos.icon({id:'first',propertyName:'Hotel "<script>"'},'<img src=x onerror=alert(1)>');
  assert.doesNotMatch(html,/onerror|<script>/i);assert.match(html,/class="herald-stay-icon"/);assert.match(html,/&quot;&lt;script&gt;&quot;/);
});

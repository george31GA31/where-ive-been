'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Search=require('../travel-search.js');
const feature=(name,osm_value='city',countrycode='ae')=>({geometry:{coordinates:[54.4,24.45]},properties:{osm_type:'N',osm_id:name,osm_key:'place',osm_value,name,countrycode}});
const example=()=>Search.normalise({geometry:{coordinates:[54.56,24.42]},properties:{osm_type:'N',osm_id:1,name:'Example hostel',osm_value:'hostel',city:'Khalifa City',district:'Khalifa City',county:'Abu Dhabi',state:'Abu Dhabi',countrycode:'ae',country:'United Arab Emirates',street:'Test Street'}});

test('City-first normalisation retains the district and original full address',()=>{
  const p=Search.normalise({geometry:{coordinates:[1,2]},properties:{name:'Example hotel',city:'London',district:'Westminster',state:'England',country:'United Kingdom',countrycode:'gb',street:'Test Street'}});
  assert.equal(p.city,'London');assert.equal(p.area,'London');assert.equal(p.district,'Westminster');
  assert.equal(p.address,'Test Street, Westminster, London, England, United Kingdom');
  assert.equal(p.originalAddress,p.address);
  assert.equal(Search.normalise(feature('Village','village')).city,'Village');
});

test('A suburb labelled as a city resolves to the corroborated parent city without changing the place snapshot',async t=>{
  const p=example(),before=JSON.stringify(p);
  t.mock.method(globalThis,'fetch',async url=>{
    const u=new URL(url);assert.equal(u.pathname,'/reverse');assert.equal(u.searchParams.get('radius'),'50');
    assert.deepEqual(u.searchParams.getAll('osm_tag'),['place:city','place:town','place:village']);
    const boundary=feature('Khalifa City');boundary.properties.osm_key='boundary';boundary.properties.osm_value='administrative';
    return {ok:true,json:async()=>({features:[boundary,feature('Khalifa City','suburb'),feature('Khalifa City'),feature('Abu Dhabi')]})};
  });
  assert.equal(await Search.resolveCity(p),'Abu Dhabi');assert.equal(JSON.stringify(p),before);
  assert.match(p.address,/Khalifa City, Abu Dhabi/);
});

test('A genuine town or village takes priority over a city sharing the state name',async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({features:[feature('Grand City'),feature('Riverton','town')]})}));
  assert.equal(await Search.resolveCity({...example(),city:'Riverton',area:'Old Quarter',state:'Grand City',county:''}),'Riverton');
});

test('An unrelated nearest city, a county name alone or a city across a border never replaces the area',async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({features:[feature('Nearby city'),feature('Abu Dhabi','city','xx'),feature('Abu Dhabi','county')]})}));
  assert.equal(await Search.resolveCity(example()),'Khalifa City');
});

test('Offline lookups fall back safely, personal places skip lookup and cancellation propagates',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw Error('Offline');});
  assert.equal(await Search.resolveCity(example()),'Khalifa City');
  assert.equal(await Search.resolveCity({...example(),personal:true,area:'My area',city:''}),'My area');
  assert.equal(fetch.mock.callCount(),1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(Search.resolveCity(example(),controller.signal),/Offline/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{JSDOM}=require('jsdom'),topojson=require('topojson-client');
const source=fs.readFileSync(path.join(__dirname,'../motion-globe.js'),'utf8');
const topology=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/countries-110m.json'),'utf8'));
async function fixture({failFirst=false}={}) {
  const d3=await import(pathToFileURL(require.resolve('d3')).href);
  const dom=new JSDOM('<!doctype html><html data-experience-motion="on"><body><div id="globe"><svg></svg></div></body></html>',{url:'http://fixture.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,host=w.document.getElementById('globe');let calls=0,clock=0,serial=0,hidden=false;
  const frames=new Map(),queries=new Map(),intersections=[];
  w.requestAnimationFrame=callback=>{const id=++serial;frames.set(id,callback);return id;};w.cancelAnimationFrame=id=>frames.delete(id);w.performance.now=()=>clock;
  w.matchMedia=query=>{if(!queries.has(query))queries.set(query,{matches:!query.includes('reduced-motion'),listeners:new Set(),addEventListener(_,fn){this.listeners.add(fn);},removeEventListener(_,fn){this.listeners.delete(fn);}});return queries.get(query);};
  w.IntersectionObserver=class{constructor(callback){this.callback=callback;intersections.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  Object.defineProperty(w.document,'hidden',{get:()=>hidden,configurable:true});
  w.fetch=async url=>{assert.equal(new URL(url).pathname,'/data/countries-110m.json');calls++;if(failFirst&&calls===1)throw Error('offline fixture');return{ok:true,json:async()=>topology};};
  w.d3=d3;w.topojson=topojson;w.NUMERIC_TO_ALPHA2={'250':'FR','826':'GB','036':'AU','710':'ZA','554':'NZ','328':'GY'};
  w.countryByCode=code=>({name:{FR:'France',GB:'United Kingdom',AU:'Australia',ZA:'South Africa',NZ:'New Zealand'}[code]||code});
  host.querySelector('svg').getBoundingClientRect=()=>({left:0,top:0,width:600,height:600,right:600,bottom:600});
  const unchanged={ids:['one','two'],localTime:'2026-11-04T13:12',notes:{unknown:'retain'}};w.state=structuredClone(unchanged);w.localStorage.setItem('travel-data',JSON.stringify(unchanged));
  w.eval(source);
  function flush(limit=200){let n=0;while(frames.size&&n++<limit){const callbacks=[...frames.values()];frames.clear();clock+=1000/60;callbacks.forEach(callback=>callback(clock));}return n;}
  function pointer(type,{x=300,y=300,id=1,pointerType='mouse',button=0}={}){const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:pointerType}});return event;}
  return{w,host,frames,queries,intersections,flush,pointer,get calls(){return calls;},setHidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'));},assertUnchanged(){assert.deepEqual(JSON.parse(JSON.stringify(w.state)),unchanged);assert.equal(w.localStorage.getItem('travel-data'),JSON.stringify(unchanged));},close(){w.close();}};
}

test('real orthographic geography is local, interactive, finite and presentation-only',async()=>{
  const f=await fixture();try{
    const picked=[],api=f.w.HVMotionGlobe.mount(f.host,{countries:new Set(['FR','AU']),current:new Set(['FR']),onCountry:code=>picked.push(code)});
    assert.equal(await api.ready,true);assert.equal(f.calls,1);assert.equal(f.host.dataset.globeReady,'true');
    assert.equal(f.host.querySelectorAll('.motion-globe-land').length,topology.objects.countries.geometries.length);
    const france=f.host.querySelector('[data-country-code=FR]');assert.ok(france.classList.contains('is-current'));assert.equal(france.getAttribute('tabindex'),'0');
    const svg=f.host.querySelector('svg'),before=f.host.dataset.longitude,beforeShape=france.getAttribute('d');
    svg.dispatchEvent(f.pointer('pointermove',{x:570,y:100}));f.flush();
    assert.notEqual(f.host.dataset.longitude,before);assert.notEqual(france.getAttribute('d'),beforeShape);assert.equal(f.host.dataset.motionState,'resting');assert.equal(f.frames.size,0,'The animation loop stops when settled');
    svg.dispatchEvent(f.pointer('pointerleave'));f.flush();assert.equal(f.host.dataset.longitude,before);
    france.dispatchEvent(new f.w.Event('focus'));assert.match(f.host.querySelector('.motion-globe-caption').textContent,/France.*current recorded visit/);
    france.dispatchEvent(new f.w.MouseEvent('click',{bubbles:true}));assert.deepEqual(picked,['FR']);
    api.update({current:new Set(['AU'])});assert.equal(france.classList.contains('is-current'),false);assert.equal(f.host.querySelector('[data-country-code=AU]').classList.contains('is-current'),true);
    f.assertUnchanged();api.destroy();assert.equal(f.host.dataset.motionState,'destroyed');assert.equal(f.frames.size,0);
  }finally{f.close();}
});

test('motion preferences stop pointer effects while explicit keyboard, buttons and drag remain usable',async()=>{
  const f=await fixture();try{
    const picked=[],api=f.w.HVMotionGlobe.mount(f.host,{countries:['FR'],onCountry:code=>picked.push(code)});await api.ready;
    const svg=f.host.querySelector('svg');f.w.document.documentElement.dataset.experienceMotion='off';await Promise.resolve();
    const initial=f.host.dataset.longitude;svg.dispatchEvent(f.pointer('pointermove',{x:580,y:20}));f.flush();assert.equal(f.host.dataset.longitude,initial);
    f.host.querySelector('[data-globe-rotate=right]').click();assert.notEqual(f.host.dataset.longitude,initial);assert.equal(f.frames.size,0);
    svg.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));assert.equal(f.host.dataset.longitude,initial);
    svg.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.notEqual(f.host.dataset.longitude,initial);
    svg.dispatchEvent(f.pointer('pointerdown',{x:200,y:200}));svg.dispatchEvent(f.pointer('pointermove',{x:300,y:210}));assert.equal(f.host.dataset.motionState,'dragging');
    f.w.dispatchEvent(f.pointer('pointerup',{x:300,y:210}));f.host.querySelector('[data-country-code=FR]').dispatchEvent(new f.w.MouseEvent('click',{bubbles:true}));assert.deepEqual(picked,[],'Dragging never inadvertently opens a country');
    f.assertUnchanged();api.destroy();
  }finally{f.close();}
});

test('hidden/offscreen/detached globes pause and clean up, and a failed geometry load can retry',async()=>{
  const f=await fixture({failFirst:true});try{
    const api=f.w.HVMotionGlobe.mount(f.host,{countries:['FR']});assert.equal(await api.ready,false);assert.equal(f.host.dataset.motionState,'error');
    f.host.querySelector('[data-globe-retry]').click();for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(f.host.dataset.globeReady,'true');assert.equal(f.calls,2);
    api.rotate(20,0);assert.ok(f.frames.size>0);f.setHidden(true);assert.equal(f.frames.size,0);assert.equal(f.host.dataset.motionState,'paused');
    f.setHidden(false);f.flush();assert.equal(f.host.dataset.motionState,'resting');
    api.rotate(20,0);f.intersections[0].callback([{isIntersecting:false}]);assert.equal(f.frames.size,0);assert.equal(f.host.dataset.motionState,'paused');
    f.intersections[0].callback([{isIntersecting:true}]);f.flush();f.host.remove();await Promise.resolve();
    assert.equal(f.host.dataset.motionState,'destroyed');assert.equal(f.frames.size,0);f.assertUnchanged();
  }finally{f.close();}
});

test('horizon culling never removes visible country geometry at representative orientations',async()=>{
  const f=await fixture();try{
    const api=f.w.HVMotionGlobe.mount(f.host,{countries:['FR']});await api.ready;
    f.w.document.documentElement.dataset.experienceMotion='off';await Promise.resolve();
    const features=topojson.feature(topology,topology.objects.countries).features;
    const projection=f.w.d3.geoOrthographic().translate([300,300]).scale(242).clipAngle(90).precision(.9),fullPath=f.w.d3.geoPath(projection).digits(1);
    for(const [longitude,latitude]of[[-170,-60],[-100,35],[-20,0],[50,-20],[140,65]]){
      api.rotate(longitude-Number(f.host.dataset.longitude),latitude-Number(f.host.dataset.latitude));
      projection.rotate([Number(f.host.dataset.longitude),Number(f.host.dataset.latitude),0]);
      const nodes=[...f.host.querySelectorAll('.motion-globe-land')];
      for(let i=0;i<nodes.length;i++)if(!nodes[i].getAttribute('d'))assert.equal(fullPath(features[i])||'','','Culled country must be wholly behind the horizon: '+features[i].properties.name);
    }
    api.destroy();
  }finally{f.close();}
});

test('initial focus skips territories missing separate bundled geometry and finds the next current country',async()=>{
  const f=await fixture();try{
    const api=f.w.HVMotionGlobe.mount(f.host,{focusCode:'GF',current:['GF','GY'],countries:['FR','GY']});await api.ready;
    const guyana=topojson.feature(topology,topology.objects.countries).features.find(feature=>String(feature.id)==='328');
    const point=f.w.d3.geoCentroid(guyana),longitude=(((-point[0])+180)%360+360)%360-180;
    assert.ok(Math.abs(Number(f.host.dataset.longitude)-longitude)<.001,'Guyana is centered when French Guiana lacks separate geometry');
    assert.ok(Math.abs(Number(f.host.dataset.latitude)-(-point[1]))<.001);
    assert.equal(f.host.querySelector('[data-country-code=GY]').getAttribute('tabindex'),'0');
    f.assertUnchanged();api.destroy();
  }finally{f.close();}
});

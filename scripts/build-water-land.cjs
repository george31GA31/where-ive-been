/* Reproducible local coastline mask. Natural Earth geometry is public domain. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),topo=require('topojson-client'),world=require('world-atlas/land-50m.json');
const features=topo.feature(world,world.objects.land),polygons=(features.features||[features]).flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
const rounded=polygons.map(p=>p.map(r=>r.map(c=>c.map(v=>Number(v.toFixed(5))))));
const data={schema:1,source:{name:'Natural Earth land, 1:50m / world-atlas 2.0.2',url:'https://www.naturalearthdata.com/about/terms-of-use/',licence:'Public domain',purpose:'Illustrative water routes; not navigation'},polygons:rounded};
fs.writeFileSync(path.resolve(__dirname,'../data/water-land.json'),JSON.stringify(data)+'\n');console.log(rounded.length+' land polygons bundled.');

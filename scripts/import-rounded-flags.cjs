'use strict';
// Import only artwork with an explicit destination mapping; never infer visit status.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=process.argv[2];
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/tcc-destinations.js'),'utf8'),context);
const tcc=context.window.HVTccDestinations;
const dirs=['Nations','Add','Other Nations','Other Nations/TCC'];
const files=dirs.flatMap(dir=>fs.readdirSync(path.join(source,dir)).filter(f=>f.endsWith('.png')).map(f=>({name:path.basename(f,'.png'),file:path.join(source,dir,f),relative:dir+'/'+f})));
const aliases={...read('data/flag-name-aliases.json'),AF:'Afghanistan1',CD:'Demorcratic Republic Congo',SL:'Sierre Leone',TL:'East Timor',MS:'Monsterrat',CX:'Christmas Islands',WF:'Wallis and Fortuna',BOU:'Bougainville',BQ:'Bonaire',SJ:'Svalbard',GS:'South Georgia & the South Sandwich Islands'};
const countries=read('data/country-catalog.json').filter(c=>c.code!=='SEA');
const matches={},missing=[];
for(const c of countries){const f=files.find(f=>norm(f.name)===norm(aliases[c.code]||c.name));if(f)matches[c.code]=f;else missing.push(c);}
const tccFiles=[...files.filter(f=>f.relative.startsWith('Other Nations/TCC/')),...files];
const tccAliases=read('data/tcc-flag-aliases.json');
const tccMissing=[];
for(const d of tcc.regions.flatMap(r=>r.destinations)){
 const names=[tccAliases[d.name]||d.name,d.name.replace(/\s*\(.*\)/,'')];
 const f=tccFiles.find(f=>names.some(n=>norm(n)===norm(f.name)));
 if(f)matches[d.id.toUpperCase()]=f;else tccMissing.push(d);
}
fs.writeFileSync(path.join(root,'../flag-mapping.json'),JSON.stringify({matches,missing,tccMissing},null,2));
console.log(JSON.stringify({matched:Object.keys(matches).length,missing,tccMissing},null,2));
if(process.argv.includes('--write')){
 if(tccMissing.length)throw new Error('Unmapped TCC destinations');
 const old={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/flag-manifest.js'),'utf8'),old);
 const manifest={...old.window.HVFlagAssets},sources={};
 for(const [code,f] of Object.entries(matches)){
  // Chagos has no separate artwork in this collection; retain its existing flag.
  if(code==='TCC-BRITISH-INDIAN-OCEAN-TERRITORY-CHAGOS-ARCHIPELAGO-DIEGO-GARCIA'){
   manifest[code]=manifest.IO;sources[code]={retained:manifest.IO};continue;
  }
  const dest='assets/flags/rounded/'+code+'.png';
  fs.mkdirSync(path.dirname(path.join(root,dest)),{recursive:true});
  fs.copyFileSync(f.file,path.join(root,dest));manifest[code]=dest;sources[code]=f.relative;
 }
 fs.writeFileSync(path.join(root,'assets/flag-manifest.js'),'// Verified filenames, keyed by stable tracker country and TCC IDs.\nwindow.HVFlagAssets = '+JSON.stringify(manifest,null,2)+';\n');
 fs.writeFileSync(path.join(root,'assets/rounded-flag-sources.json'),JSON.stringify({collection:'Rounded Corner Flags',sources,retainedCountries:missing},null,2)+'\n');
}

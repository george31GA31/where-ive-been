/* Generate runtime-only public allowlists and integrity hashes before deployment. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sw=path.join(root,'sw.js'),old=fs.readFileSync(sw,'utf8');
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
const runtime=file=>/\.(js|css|json|html|png|svg|webp|jpe?g|gif|avif|ico|woff2?|ttf|otf)$/i.test(file);
const files=[...fs.readdirSync(root).filter(file=>/\.(js|css)$/.test(file)&&file!=='sw.js'),'index.html','login/index.html','register/index.html','profile/index.html','reset-password/index.html',...['assets','vendor','data'].flatMap(walk).filter(runtime)].sort();
// Reference JSON and original flags stage after account startup; thumbnails stay core.
const core=files.filter(file=>!file.startsWith('assets/flags/')&&!(file.startsWith('data/')&&file.endsWith('.json')));
const hashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const implementation=old.replace(/herald-(?:shell|public)-[a-f0-9]+/,'herald-public-VERSION').replace(/const FILES=\[.*?\];/,'const FILES=[];').replace(/const CORE_FILES=\[.*?\];/,'const CORE_FILES=[];').replace(/const HASHES=\{.*?\};/,'const HASHES={};');
const hash=crypto.createHash('sha256').update(implementation);for(const file of files)hash.update(file).update(hashes[file]);
const next=old.replace(/herald-(?:shell|public)-[a-f0-9]+/,'herald-public-'+hash.digest('hex').slice(0,12)).replace(/const FILES=\[.*?\];/,'const FILES='+JSON.stringify(files)+';').replace(/const CORE_FILES=\[.*?\];/,'const CORE_FILES='+JSON.stringify(core)+';').replace(/const HASHES=\{.*?\};/,'const HASHES='+JSON.stringify(hashes)+';');
if(process.argv.includes('--check')){if(next!==old)throw new Error('Run node scripts/build-offline-shell.cjs before deployment.');}else fs.writeFileSync(sw,next);

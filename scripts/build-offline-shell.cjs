/* Refresh the public-asset allowlist and content version before deploying. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sw=path.join(root,'sw.js'),old=fs.readFileSync(sw,'utf8');
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const files=[...fs.readdirSync(root).filter(f=>/\.(js|css)$/.test(f)&&f!=='sw.js'), 'index.html','login/index.html','register/index.html','profile/index.html','reset-password/index.html',...['assets','vendor','data'].flatMap(walk)].sort();
const hash=crypto.createHash('sha256');for(const file of files)hash.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'));
const next=old.replace(/herald-shell-[a-f0-9]+/,'herald-shell-'+hash.digest('hex').slice(0,12)).replace(/FILES=\[.*?\];/, 'FILES='+JSON.stringify(files)+';');
if(process.argv.includes('--check')){if(next!==old)throw new Error('Run node scripts/build-offline-shell.cjs before deployment.');}else fs.writeFileSync(sw,next);

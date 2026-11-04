'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync,spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
test('browser bundles are byte-identical from CRLF and LF authored fragments',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'herald-bundle-'));
  try{fs.mkdirSync(path.join(dir,'scripts'));fs.mkdirSync(path.join(dir,'src'));fs.copyFileSync(path.join(root,'scripts/build-browser.cjs'),path.join(dir,'scripts/build-browser.cjs'));fs.writeFileSync(path.join(dir,'src/browser-bundles.json'),JSON.stringify([{output:'bundle.js',scope:'closure',files:['src/feature.js']}]));
    fs.writeFileSync(path.join(dir,'src/feature.js'),'const value = `one\r\ntwo`;\r\n');execFileSync(process.execPath,['scripts/build-browser.cjs'],{cwd:dir});const windows=fs.readFileSync(path.join(dir,'bundle.js'));
    fs.writeFileSync(path.join(dir,'src/feature.js'),'const value = `one\ntwo`;\n');execFileSync(process.execPath,['scripts/build-browser.cjs','--check'],{cwd:dir});execFileSync(process.execPath,['scripts/build-browser.cjs'],{cwd:dir});assert.deepEqual(fs.readFileSync(path.join(dir,'bundle.js')),windows);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('offline build canonicalizes served text before hashing and check never rewrites bytes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'herald-release-'));
  try{for(const folder of ['scripts','login','register','profile','reset-password','assets','vendor','data'])fs.mkdirSync(path.join(dir,folder));fs.copyFileSync(path.join(root,'scripts/build-offline-shell.cjs'),path.join(dir,'scripts/build-offline-shell.cjs'));const sw="const CACHE='herald-public-aaaaaaaaaaaa';\nconst FILES=[];\nconst CORE_FILES=[];\nconst HASHES={};\n";
    fs.writeFileSync(path.join(dir,'sw.js'),sw.replace(/\n/g,'\r\n'));for(const file of ['index.html','login/index.html','register/index.html','profile/index.html','reset-password/index.html'])fs.writeFileSync(path.join(dir,file),'<!doctype html>\r\n<p>Fictional release</p>\r\n');fs.writeFileSync(path.join(dir,'assets/photo.png'),Buffer.from([137,80,13,10,0,255]));
    execFileSync(process.execPath,['scripts/build-offline-shell.cjs'],{cwd:dir});const first=fs.readFileSync(path.join(dir,'sw.js'),'utf8'),hashes=JSON.parse(first.match(/const HASHES=(\{.*?\});/)[1]);assert.ok(!fs.readFileSync(path.join(dir,'index.html'),'utf8').includes('\r'));assert.equal(hashes['index.html'],crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'index.html'))).digest('hex'));assert.deepEqual(fs.readFileSync(path.join(dir,'assets/photo.png')),Buffer.from([137,80,13,10,0,255]));
    execFileSync(process.execPath,['scripts/build-offline-shell.cjs','--check'],{cwd:dir});assert.equal(fs.readFileSync(path.join(dir,'sw.js'),'utf8'),first);
    const invalid=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/\n/g,'\r\n');fs.writeFileSync(path.join(dir,'index.html'),invalid);const check=spawnSync(process.execPath,['scripts/build-offline-shell.cjs','--check'],{cwd:dir,encoding:'utf8'});assert.notEqual(check.status,0);assert.match(check.stderr,/Noncanonical release bytes/);assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),invalid);
    execFileSync(process.execPath,['scripts/build-offline-shell.cjs'],{cwd:dir});assert.equal(fs.readFileSync(path.join(dir,'sw.js'),'utf8'),first,'LF and CRLF inputs produce the same manifest and release identity');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

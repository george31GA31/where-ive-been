'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..');
for(const library of require('../docs/vendor-inventory.json').libraries){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,library.path))).digest('hex');if(hash!==library.sha256)throw Error('Update and review the vendor inventory for '+library.path);}
console.log('Vendored runtime checksums match the reviewed inventory.');

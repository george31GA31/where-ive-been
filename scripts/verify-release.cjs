/* Read-only exact-byte release check. Optional URL must be the public site base. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
  const base=process.argv[2]?new URL(process.argv[2].replace(/\/?$/,'/')):null;
  if(base&&!['http:','https:'].includes(base.protocol))throw new Error('Use an HTTP(S) public base URL.');
  const read=async file=>{if(!base)return fs.readFileSync(path.join(root,file));const response=await fetch(new URL(file,base),{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());};
  const source=(await read('sw.js')).toString('utf8'),version=source.match(/herald-(?:shell|public)-[a-f0-9]+/)?.[0];
  const files=JSON.parse(source.match(/const FILES=(\[.*?\]);/)?.[1]||'null'),core=JSON.parse(source.match(/const CORE_FILES=(\[.*?\]);/)?.[1]||'null'),hashes=JSON.parse(source.match(/const HASHES=(\{.*?\});/)?.[1]||'null');
  if(!version||!Array.isArray(files)||!Array.isArray(core)||!hashes)throw new Error('Unrecognized public-shell manifest.');
  if(core.some(file=>!files.includes(file)))throw new Error('A core asset is absent from the public allowlist.');
  const failures=[];let count=0,index=0;
  await Promise.all(Array.from({length:8},async()=>{while(index<files.length){const file=files[index++];if(!/^[\p{L}\p{N}_ ./@-]+$/u.test(file)||file.split('/').includes('..')){failures.push(`${file}: unsafe manifest path`);continue;}for(const query of base?['','?shell='+encodeURIComponent(version)]:['']){try{const bytes=await read(file+query);if(digest(bytes)!==hashes[file])throw new Error('SHA-256 mismatch');count++;}catch(error){failures.push(`${file}${query}: ${error.message}`);}}}}));
  if(failures.length)throw new Error(`Release integrity failed (${failures.length}):\n${failures.join('\n')}`);
  console.log(JSON.stringify({version,assets:files.length,core:core.length,verifiedResponses:count,source:base?'public HTTP, bare and worker shell query':'local exact bytes'}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

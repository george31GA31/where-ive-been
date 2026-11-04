/* Read-only exact-byte release check. Optional URL must be the public site base. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function publicBase(input){
  const base=new URL(input);
  if(!['http:','https:'].includes(base.protocol))throw new Error('Use an HTTP(S) public base URL.');
  if(base.username||base.password||base.search||base.hash)throw new Error('Use a public base URL without credentials, query or fragment.');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  return base;
}
function manifestPath(file){
  if(typeof file!=='string'||!file||file.startsWith('/')||file.includes('\\')||!/^[-\p{L}\p{M}\p{N}_ ./@]+$/u.test(file))throw new Error('Unsafe manifest path.');
  const segments=file.split('/');
  // Reject URL/dot traversal and Windows-normalized aliases before either I/O mode.
  if(segments.some(segment=>!segment||segment==='.'||segment==='..'||segment.trim()!==segment||/[. ]$/.test(segment)))throw new Error('Unsafe manifest path.');
  return file;
}
function assetURL(base,file,release=null){
  manifestPath(file);
  const url=new URL(base.href);
  // File data may affect only encoded path segments, never authority or scheme.
  url.pathname=base.pathname+file.split('/').map(segment=>encodeURIComponent(segment)).join('/');
  if(release!==null){if(!/^herald-(?:shell|public)-[a-f0-9]+$/.test(release))throw new Error('Invalid release identity.');url.searchParams.set('shell',release);}
  if(url.origin!==base.origin||url.username||url.password||url.hash||!url.pathname.startsWith(base.pathname))throw new Error('Manifest path escaped the public base.');
  return url;
}
function localAsset(directory,file){
  manifestPath(file);
  const destination=path.resolve(directory,...file.split('/')),relative=path.relative(path.resolve(directory),destination);
  if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error('Manifest path escaped the local root.');
  return destination;
}
async function verifyRelease({baseURL=null,rootDir=root,fetchImpl=fetch}={}){
  const base=baseURL?publicBase(baseURL):null;
  const read=async(file,release=null)=>{
    if(!base)return fs.readFileSync(localAsset(rootDir,file));
    const url=assetURL(base,file,release);
    const response=await fetchImpl(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const source=(await read('sw.js')).toString('utf8'),version=source.match(/herald-(?:shell|public)-[a-f0-9]+/)?.[0];
  const files=JSON.parse(source.match(/const FILES=(\[.*?\]);/)?.[1]||'null'),core=JSON.parse(source.match(/const CORE_FILES=(\[.*?\]);/)?.[1]||'null'),hashes=JSON.parse(source.match(/const HASHES=(\{.*?\});/)?.[1]||'null');
  if(!version||!Array.isArray(files)||!Array.isArray(core)||!hashes||typeof hashes!=='object'||Array.isArray(hashes))throw new Error('Unrecognized public-shell manifest.');
  // Validate every path before concurrent jobs begin; an invalid manifest fetches no assets.
  for(const file of [...files,...core])manifestPath(file);
  if(core.some(file=>!files.includes(file)))throw new Error('A core asset is absent from the public allowlist.');
  for(const file of files)if(!Object.hasOwn(hashes,file)||!(/^[a-f0-9]{64}$/i).test(hashes[file]))throw new Error('Invalid public asset hash.');
  const failures=[];let count=0,index=0;
  await Promise.all(Array.from({length:8},async()=>{while(index<files.length){const file=files[index++];for(const release of base?[null,version]:[null]){try{const bytes=await read(file,release);if(digest(bytes)!==hashes[file])throw new Error('SHA-256 mismatch');count++;}catch(error){failures.push(`${file}${release?'?shell='+release:''}: ${error.message}`);}}}}));
  if(failures.length)throw new Error(`Release integrity failed (${failures.length}):\n${failures.join('\n')}`);
  return{version,assets:files.length,core:core.length,verifiedResponses:count,source:base?'public HTTP, bare and worker shell query':'local exact bytes'};
}
module.exports={publicBase,manifestPath,assetURL,localAsset,verifyRelease};
if(require.main===module)verifyRelease({baseURL:process.argv[2]||null}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});

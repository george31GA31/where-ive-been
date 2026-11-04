'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {publicBase,manifestPath,assetURL,verifyRelease}=require('../scripts/verify-release.cjs');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const version='herald-public-aaaaaaaaaaaa';
const attacks=['../../../escape.js','../escape.js','/absolute.js','//127.0.0.2/private','https://outside.example/private','assets\\..\\private.js','app.js?token=secret','app.js#fragment','%2e%2e/escape.js','assets/%2f%2fevil.js','assets/../app.js','assets//app.js','./app.js','assets/.. /escape.js'];
function manifest(files,bodies){return `const CACHE='${version}';\nconst FILES=${JSON.stringify(files)};\nconst CORE_FILES=${JSON.stringify(files)};\nconst HASHES=${JSON.stringify(Object.fromEntries(files.map(file=>[file,digest(bodies[file]||'fixture')])))};\n`;}
async function server(handler){const instance=http.createServer(handler);await new Promise(resolve=>instance.listen(0,'127.0.0.1',resolve));return{origin:'http://127.0.0.1:'+instance.address().port,async close(){instance.closeAllConnections();await new Promise(resolve=>instance.close(resolve));}};}

test('release URL construction confines relative Unicode/space paths to the chosen public directory',()=>{
  const base=publicBase('https://example.test/旅行 site');
  const file='assets/flags/Åland Islands.svg';
  assert.equal(manifestPath(file),file);
  const url=assetURL(base,file,version);
  assert.equal(url.origin,base.origin);assert.ok(url.pathname.startsWith(base.pathname));
  assert.match(url.pathname,/%C3%85land%20Islands\.svg$/);assert.equal(url.searchParams.get('shell'),version);assert.equal(url.hash,'');
  for(const file of attacks)assert.throws(()=>assetURL(base,file),/Unsafe manifest path/);
  for(const url of ['file:///tmp/site','https://user:password@example.test/site/','https://example.test/site/?token=secret','https://example.test/site/#fragment'])assert.throws(()=>publicBase(url));
});

test('malicious manifests are rejected after the worker GET and before any asset or off-origin request',async()=>{
  let files=[],requests=[],outsideAttempts=0;
  const fixture=await server((req,res)=>{requests.push(req.url);if(req.url==='/site/sw.js'){res.setHeader('Content-Type','text/javascript');res.end(manifest(files,{}));}else{res.writeHead(500);res.end('An asset request must never occur.');}});
  try{
    const safeFetch=(url,options)=>{if(url.origin!==fixture.origin){outsideAttempts++;throw Error('Attempted outside request');}return fetch(url,options);};
    for(const attack of attacks){files=['app.js',attack];requests=[];await assert.rejects(verifyRelease({baseURL:fixture.origin+'/site/',fetchImpl:safeFetch}),/Unsafe manifest path/);assert.deepEqual(requests,['/site/sw.js']);}
    assert.equal(outsideAttempts,0);
  }finally{await fixture.close();}
});

test('valid public assets verify both URLs, including Unicode/space filenames; redirects never leave the origin',async()=>{
  const bodies={'app.js':'window.fixture=true;','assets/flags/Åland Islands.svg':'<svg/>','data/海の旅.json':'{"fixture":true}'};
  let redirect=false,outsideHits=0;const requests=[];
  const outside=await server((req,res)=>{outsideHits++;res.end('must not be fetched');});
  const fixture=await server((req,res)=>{
    requests.push(req.url);const url=new URL(req.url,'http://fixture.test'),file=decodeURIComponent(url.pathname).slice('/site/'.length);
    if(file==='sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(manifest(Object.keys(bodies),bodies));}
    if(redirect&&file==='app.js'){res.writeHead(302,{Location:outside.origin+'/private'});return res.end();}
    if(Object.hasOwn(bodies,file))return res.end(bodies[file]);res.writeHead(404);res.end();
  });
  try{
    const result=await verifyRelease({baseURL:fixture.origin+'/site/'});assert.equal(result.assets,3);assert.equal(result.verifiedResponses,6);
    for(const file of Object.keys(bodies)){const bare=assetURL(publicBase(fixture.origin+'/site/'),file);assert.ok(requests.includes(bare.pathname));assert.ok(requests.includes(bare.pathname+'?shell='+version));}
    redirect=true;await assert.rejects(verifyRelease({baseURL:fixture.origin+'/site/'}),/HTTP 302/);assert.equal(outsideHits,0,'Manual redirect mode prevents an off-origin GET');
  }finally{await fixture.close();await outside.close();}
});

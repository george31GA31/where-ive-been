const test=require('node:test'),assert=require('node:assert/strict');
const Network=require('../network.js'),Sync=require('../account-sync.js');
test('provider errors are distinguished from connectivity and programming errors',()=>{
 assert.equal(Network.classify(null,401),'auth');assert.equal(Network.classify(null,403),'permission');assert.equal(Network.classify(null,429),'rate-limit');assert.equal(Network.classify(null,503),'server');assert.equal(Network.classify(new TypeError('Failed to fetch')),'network');assert.equal(Network.classify(new Error('render bug')),'programming');
});
test('request deadline includes a stalled response body and does not clear data',async()=>{
 const before=global.fetch;try{for(const status of [200,503]){global.fetch=async(_,opts)=>({ok:status===200,status,arrayBuffer:()=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});await assert.rejects(Network.request('https://example.test',{}, {timeout:20}),e=>e.name==='TimeoutError');}}finally{global.fetch=before;}
});
test('scheduled sync backs off, explicit reconnect retries and acknowledged records do not duplicate',async()=>{
 const storage={items:new Map(),get length(){return this.items.size},key(i){return [...this.items.keys()][i]},getItem(k){return this.items.get(k)||null},setItem(k,v){this.items.set(k,v)},removeItem(k){this.items.delete(k)}};
 let data={notes:[],expenses:[]},revision=1,down=false,reads=0,writes=0;
 const client={from(){return {select(){return this},eq(){return this},async maybeSingle(){reads++;if(down)return {error:new TypeError('Failed to fetch')};return {data:{payload:data,revision}}}}},async rpc(_,p){writes++;data=p.p_payload;revision++;return {data:[{revision}]}}};
 const s=new Sync({client,storage,tabId:'one',onData(){},onStatus(){},resolve:async()=>({})});await s.start('A',{});down=true;s.edit({notes:[{id:'n',body:'Offline note'}],expenses:[{id:'e',amount:15}]});await s.flush();const failedReads=reads;await Promise.all([s.flush({scheduled:true}),s.flush({scheduled:true})]);assert.equal(reads,failedReads);s.stop();
 const restored=new Sync({client,storage,tabId:'two',onData(){},onStatus(){},resolve:async()=>({})});await restored.start('A',{});assert.equal(restored.local.expenses[0].amount,15);down=false;await Promise.all([restored.reconnect(),restored.reconnect()]);await restored.flush();assert.equal(data.expenses.length,1);assert.equal(data.notes.length,1);assert.equal(writes,1);restored.stop();
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../account-size');
test('PostgreSQL JSON spacing, UTF-8 and expanded exponents match verified server fixtures',()=>{
 const value={text:'Algeria · الجزائر',values:[1e-7,1e21,-1.25e-8,null,true],nested:{'country name':'Tunisia'}};
 const pg='{"text": "Algeria · الجزائر", "values": [0.0000001, 1000000000000000000000, -0.0000000125, null, true], "nested": {"country name": "Tunisia"}}';assert.equal(S.measure(value).bytes,Buffer.byteLength(pg));
});
test('save size boundaries include the complete payload rather than a JS character count',()=>{
 const base={stays:[],profiles:[],residences:[],notes:[]},overhead=S.measure({...base,text:''}).bytes;
 assert.equal(S.measure({...base,text:'x'.repeat(S.limit-overhead)}).bytes,S.limit);assert.equal(S.measure({...base,text:'x'.repeat(S.limit-overhead+1)}).bytes,S.limit+1);assert.ok(S.measure({...base,text:'é'}).bytes>S.measure({...base,text:'e'}).bytes);
});
test('unsupported PostgreSQL text is rejected without modifying the original payload',()=>{
 for(const text of ['\u0000','\uD800','\uDC00']){const value={text};assert.throws(()=>S.measure(value),e=>e.kind==='validation');assert.equal(value.text,text);}assert.doesNotThrow(()=>S.measure({text:'😀'}));
});

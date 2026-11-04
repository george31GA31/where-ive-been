'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function surface(){
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/#/places?recordKind=constructor&recordId=n',runScripts:'outside-only'}),w=dom.window;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.state={activeProfileId:'p',stays:[],accommodations:[],transports:[],placeVisits:[],savedPlaces:[],trips:[],notes:[{id:'n',profileId:'p',title:'Original note',date:'2026-11-04',body:'Original body',relatedType:'constructor',relatedId:'unknown',unknown:{keep:true}}]};
 w.HVJourney={scoped:rows=>rows,validDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(value)};
 w.HVData={memo:(...args)=>args.at(-1)()};w.HVCalendar={ready:false,groupForEntry:()=>null,journeyGroups:()=>[]};w.HVTravelTools={noteBody:value=>'<p>'+escape(value)+'</p>'};w.renderAll=()=>{};w.isoDate=()=> '2026-11-04';
 w.eval(fs.readFileSync(path.join(root,'calendar-details.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'v1-readers.js'),'utf8'));return dom;
}
test('reader kind boundary rejects inherited names and HTML-shaped values without lookup, markup or mutation',()=>{
 const dom=surface(),w=dom.window,before=JSON.stringify(w.state);
 try{for(const kind of ['constructor','__proto__','toString','hasOwnProperty','note" autofocus onfocus="alert(1)','"><svg onload="alert(1)">']){
  assert.equal(w.HVV1Readers.open(kind,'n'),false);assert.equal(w.HVCalendarDetails.entry(kind,'n','2026-11-04',true),'');assert.equal(w.HVCalendarDetails.record(kind,'n'),null);assert.equal(w.HVV1Readers.recordLink(kind,'n'),'#/places');
 }assert.equal(JSON.stringify(w.state),before);assert.equal(w.document.querySelectorAll('dialog,svg,script').length,0);}finally{w.close();}
});
test('a supported note remains readable with an unsupported legacy relation, preserving the original fields',()=>{
 const dom=surface(),w=dom.window,before=JSON.stringify(w.state);
 try{const html=w.HVCalendarDetails.entry('note','n','2026-11-04',true);assert.match(html,/Original note/);assert.match(html,/Original body/);assert.match(html,/data-day-note-edit="n"/);assert.equal(JSON.stringify(w.state),before);}finally{w.close();}
});
test('the account Auth fixture produces only its literal synthetic identity for either explicit session flag',async()=>{
 const file=fs.readFileSync(path.join(root,'tests/motion-account-browser.cjs'),'utf8'),start=file.indexOf('function clientStub('),end=file.indexOf('\n(async()=>',start);assert.ok(start>=0&&end>start);
 const source=file.slice(start,end);
 for(const signedIn of [false,true]){
  const script=vm.runInNewContext(source+'\nclientStub('+signedIn+');');
  const context={URL,document:{currentScript:{src:'https://example.test/account-client.js'}}};context.window=context;vm.runInNewContext(script,context);
  const result=await context.WIBAuth.client().auth.getSession();assert.equal(result.data.session?.user?.id||null,signedIn?'fictional-account':null);assert.deepEqual(Array.from(context.accountFixtureCalls),[]);
 }
});

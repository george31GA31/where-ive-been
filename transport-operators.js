/* Private reusable operator artwork, carried by the existing account snapshot. */
(function(root) {
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./transport-dashboard-model.js'):root.HVTransportDashboardModel;
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const current=()=>typeof state==='undefined'?null:state;
  const valid=src=>typeof src==='string'&&src.length<=100000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(src);
  const identity=(type,provider)=>D.mode(type)&&D.norm(D.providerName(provider))?'operator:'+D.mode(type)+':'+encodeURIComponent(D.norm(D.providerName(provider))).replace(/\./g,'%2E'):'';
  function find(data,type,provider,operatorId) {
    const rows=(data?.transportOperators||[]).filter(row=>row.mode===D.mode(type));
    const name=D.norm(D.providerName(provider));
    if(!name)return null;
    return rows.find(row=>row.id===operatorId&&(D.norm(row.name)===name||row.aliases?.includes(name))) || rows.find(row=>D.norm(row.name)===name||row.aliases?.includes(name)||provider?.id&&row.directoryId===provider.id) || null;
  }
  function logo(data,type,provider,operatorId) {
    const src=find(data,type,provider,operatorId)?.operatorLogo?.src;
    return valid(src)?src:null;
  }
  function set(data,type,provider,src,updatedAt=new Date().toISOString()) {
    if(src!==undefined&&src!==null&&!valid(src))throw new Error('Choose a valid operator logo.');
    const id=identity(type,provider);if(!id)throw new Error('Enter an operator name first.');
    const previous=find(data,type,provider),name=D.providerName(provider).trim();
    const row={...previous,id:previous?.id||id,mode:D.mode(type),name:previous?.name||name,aliases:[...new Set([...(previous?.aliases||[]),D.norm(name)])]};
    if(provider?.id&&!provider.mode)row.directoryId=provider.id;
    for(const key of ['iata','icao'])if(provider?.[key])row[key]=provider[key];
    if(src!==undefined)row.operatorLogo={src,updatedAt};
    data.transportOperators||=[];
    const index=data.transportOperators.findIndex(r=>r.id===row.id);
    if(index<0)data.transportOperators.push(row);else data.transportOperators[index]=row;
    return row;
  }
  function suggestions(data,type,term='') {
    return (data?.transportOperators||[]).filter(row=>row.mode===D.mode(type)&&D.norm([row.name,row.iata,row.icao].join(' ')).includes(D.norm(term))).slice(0,12);
  }
  function image(data,type,provider,operatorId,classes='') {
    const src=logo(data,type,provider,operatorId);
    return src?`<img class="operator-logo ${E(classes)}" src="${E(src)}" alt="" width="40" height="40" loading="lazy" decoding="async">`:'';
  }
  function editor() {
    return '<div class="operator-logo-editor"><img class="operator-logo" alt="Operator logo preview" width="48" height="48" hidden><label class="operator-logo-upload"><span data-operator-upload-label>Add logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose operator logo"></label><button type="button" class="text-btn" data-operator-logo-replace hidden>Replace logo</button><button type="button" class="text-btn" data-operator-logo-remove hidden>Remove logo</button><p class="helper" data-operator-logo-message role="status"></p></div>';
  }
  function bind(form,host,type,getProvider) {
    const data=current(),profileId=data?.activeProfileId,input=host.querySelector('input[type=file]'),message=host.querySelector('[data-operator-logo-message]');
    let token=0,busy=false;
    form._operatorLogos||=new Map();form._operatorLogoEditors||=[];
    const active=()=>current()===data&&current()?.activeProfileId===profileId&&host.isConnected;
    const mode=()=>typeof type==='function'?type():type;
    const key=()=>identity(mode(),getProvider());
    function refresh() {
      const draft=form._operatorLogos.get(key());
      const src=draft?draft.src:logo(data,mode(),getProvider());
      const img=host.querySelector('img');img.hidden=!valid(src);if(valid(src))img.src=src;else img.removeAttribute('src');
      host.querySelector('[data-operator-logo-replace]').hidden=!valid(src);
      host.querySelector('[data-operator-logo-remove]').hidden=!valid(src);
      host.querySelector('[data-operator-upload-label]').textContent=valid(src)?'Change logo':'Add logo';
      host.setAttribute('aria-busy',String(busy));
    }
    function change(src) {form._operatorLogos.set(key(),{type:mode(),provider:getProvider(),src});refresh();}
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      const provider=getProvider(),id=key(),selectedType=mode(),request=++token;
      if(!id){message.textContent='Enter an operator name first.';input.value='';return;}
      busy=true;message.textContent='Preparing logo…';refresh();
      try {
        const src=await root.HVAccommodationLogos.prepare(file);
        if(request!==token||!active()||id!==key())return;
        form._operatorLogos.set(id,{type:selectedType,provider,src});
        message.textContent='Save this journey to reuse the logo for this operator.';
      } catch(error) {if(request===token&&active())message.textContent=error.message;}
      finally {if(request===token){busy=false;input.value='';refresh();}}
    };
    host.querySelector('[data-operator-logo-replace]').onclick=()=>input.click();
    host.querySelector('[data-operator-logo-remove]').onclick=()=>{token++;busy=false;change(null);message.textContent='Save to remove this operator’s logo from all matching journeys.';};
    const api={refresh,get busy(){return busy&&host.isConnected;},get active(){return active();}};
    form._operatorLogoEditors.push(api);refresh();return api;
  }
  function setup(form,record={}) {
    form._operatorLogos=new Map();form._operatorLogoEditors=[];
    form._operatorData=current();form._operatorProfile=current()?.activeProfileId;
    const field=form.elements.operator.closest('label'),host=document.createElement('div');host.innerHTML=editor();field.after(host);
    host.dataset.groundOperatorLogo='';
    const binding=bind(form,host,()=>form.elements.type.value,()=>form.elements.operator.value);
    const results=document.createElement('div');results.className='operator-suggestions';field.append(results);
    const input=form.elements.operator;
    input.oninput=()=>{
      const choices=suggestions(current(),form.elements.type.value,input.value);
      results.innerHTML=choices.map((row,i)=>`<button type="button" data-operator-choice="${i}">${E(row.name)}</button>`).join('');
      results.onclick=e=>{const button=e.target.closest('[data-operator-choice]');if(!button)return;input.value=choices[Number(button.dataset.operatorChoice)].name;results.replaceChildren();binding.refresh();input.focus();};
      binding.refresh();
    };
    if(form._operatorTypeHandler)form.elements.type.removeEventListener('change',form._operatorTypeHandler);
    form._operatorTypeHandler=()=>{host.hidden=form.elements.type.value==='flight';results.replaceChildren();binding.refresh();};
    form.elements.type.addEventListener('change',form._operatorTypeHandler);
    host.hidden=form.elements.type.value==='flight';
  }
  function drafts(form) {
    if(current()!==form._operatorData||current()?.activeProfileId!==form._operatorProfile)throw new Error('Your account or traveller changed. Reopen this journey.');
    if(form._operatorLogoEditors?.some(editor=>editor.busy))throw new Error('Wait for the logo to finish preparing.');
    return [...(form._pendingOperatorLogos||[]),...(form._operatorLogos?.values()||[])];
  }
  function commit(data,records,changes=[]) {
    const used=new Set(),artwork=new Set(changes.map(change=>identity(change.type,change.provider)));
    for(const record of records) {
      if(record.type==='flight') {
        for(const leg of record.legs||[])if(D.providerName(leg.airline).trim()){const row=set(data,'flight',leg.airline),key=identity('flight',leg.airline);if(row.operatorLogo||artwork.has(key))leg.operatorId=row.id;used.add(key);}
        if(record.legs?.length===1&&record.legs[0].operatorId)record.operatorId=record.legs[0].operatorId;
      } else if(D.mode(record.type)&&D.providerName(record.operator).trim()) {const row=set(data,record.type,record.operator),key=identity(record.type,record.operator);if(row.operatorLogo||artwork.has(key))record.operatorId=row.id;used.add(key);}
    }
    for(const change of changes)if(used.has(identity(change.type,change.provider)))set(data,change.type,change.provider,change.src);
  }
  const choice=row=>({name:row.name,...(row.directoryId?{id:row.directoryId}:{}),...(row.iata?{iata:row.iata}:{}),...(row.icao?{icao:row.icao}:{})});
  const api={identity,valid,find,logo,set,suggestions,choice,image,editor,bind,setup,drafts,commit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVOperators=api;
})(typeof window!=='undefined'?window:globalThis);

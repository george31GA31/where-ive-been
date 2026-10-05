/* Herald Voyages travel-specific Notes, Checklists and Budget Planner UI. */
(() => {
  'use strict';
  const M=window.HVTravelTools;
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=id=>document.getElementById(id)||window.HVPages?.get(id);
  let host,notesPanel,budgetPanel,activeNoteId=null,activeBudgetItemId=null;

  const now=()=>new Date().toISOString();
  const tripName=id=>(state.trips||[]).find(t=>t.id===id)?.name||'All travel';
  const trips=()=>HVJourney.scoped(state.trips||[],state.activeProfileId).filter(t=>t.status!=='cancelled').sort((a,b)=>(a.start||'').localeCompare(b.start||'')||String(a.name||'').localeCompare(String(b.name||'')));
  const tripOptions=(selected='',allLabel='All travel')=>'<option value="">'+E(allLabel)+'</option>'+trips().map(t=>'<option value="'+E(t.id)+'" '+(t.id===selected?'selected':'')+'>'+E(t.name||'Unnamed trip')+'</option>').join('');
  const save=()=>{persist();render();};
  function inline(text){
    let value=E(text);
    value=value.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    value=value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>'<a href="'+E(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>');
    return value;
  }
  function rich(text=''){
    const lines=String(text).split(/\r?\n/),out=[];let list=null;
    const close=()=>{if(list){out.push(list.type==='ul'?'<ul>'+list.items.join('')+'</ul>':'<ol>'+list.items.join('')+'</ol>');list=null;}};
    for(const line of lines){
      const bullet=line.match(/^\s*-\s+(.+)/),numbered=line.match(/^\s*\d+[.)]\s+(.+)/);
      if(bullet||numbered){const type=bullet?'ul':'ol',body=bullet?.[1]||numbered?.[1];if(!list||list.type!==type){close();list={type,items:[]};}list.items.push('<li>'+inline(body)+'</li>');continue;}
      close();if(line.trim())out.push('<p>'+inline(line)+'</p>');else out.push('<br>');
    }
    close();return out.join('');
  }
  const money=(amount,currency)=>{if(amount==null||amount==='')return '—';try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(Number(amount));}catch{return Number(amount).toFixed(2)+' '+(currency||'GBP');}};
  const hashParams=()=>new URLSearchParams(location.hash.split('?')[1]||'');
  function toolFromHash(){return hashParams().get('tool')||'';}
  function tripFromHash(){const id=hashParams().get('trip')||'';return (state.trips||[]).some(t=>t.id===id)?id:'';}
  function toolHeader(title,eyebrow,copy){
    return '<header class="travel-tool-head"><div><p class="eyebrow">'+E(eyebrow)+'</p><h2>'+E(title)+'</h2><p class="panel-copy">'+E(copy)+'</p></div><a class="secondary compact" href="#/travel-tools">Back to Travel Tools</a></header>';
  }
  function relatedOptions(tripId,selected=''){
    const rows=[];
    const add=(type,id,label)=>id&&rows.push({value:type+':'+id,label});
    const scope=tripId?M.tripRecords(state,tripId):{stays:state.stays||[],transports:state.transports||[],accommodations:state.accommodations||[],places:state.placeVisits||[]};
    for(const a of scope.accommodations||[])add('accommodation',a.id,'Hotel · '+(a.propertyName||a.location||'Accommodation'));
    for(const t of scope.transports||[])add('transport',t.id,(HVJourney.types?.[t.type]||t.type||'Transport')+' · '+HVJourney.transportLabel(t,window.HVJourneys?.airportFor));
    for(const s of scope.stays||[])add('stay',s.id,'Destination · '+(s.location||s.countryName||s.countryCode));
    for(const p of scope.places||[])add('location',p.id,'Place · '+(p.place?.name||'Saved place'));
    return '<option value="">No specific item</option>'+rows.map(r=>'<option value="'+E(r.value)+'" '+(r.value===selected?'selected':'')+'>'+E(r.label)+'</option>').join('');
  }
  function install(){
    host=get('toolsView');if(!host||host.dataset.travelToolsReady)return;
    host.dataset.travelToolsReady='1';
    notesPanel=document.createElement('section');notesPanel.id='notesChecklistTool';notesPanel.className='travel-tool-workspace';
    budgetPanel=document.createElement('section');budgetPanel.id='budgetPlannerTool';budgetPanel.className='travel-tool-workspace';
    host.append(notesPanel,budgetPanel);
    host.addEventListener('click',onClick);
    host.addEventListener('submit',onSubmit);
    host.addEventListener('change',onChange);
    host.addEventListener('input',onInput);
    render();
  }
  function render(){
    if(!host)return;
    M.ensure(state);
    const tool=toolFromHash(),overview=[...host.children].filter(n=>n!==notesPanel&&n!==budgetPanel);
    overview.forEach(n=>n.hidden=!!tool);
    notesPanel.hidden=tool!=='notes';budgetPanel.hidden=tool!=='budget';
    if(tool==='notes')renderNotes();
    if(tool==='budget')renderBudget();
  }
  function renderNotes(){
    const context=tripFromHash(),filter=get('notesTripFilter')?.value??context,noteTrip=get('noteTrip')?.value??filter,checkTrip=get('checklistTrip')?.value??filter;
    const notes=(state.notes||[]).filter(n=>!filter||n.tripId===filter).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const checklists=(state.checklists||[]).filter(c=>!filter||c.tripId===filter).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    notesPanel.innerHTML=toolHeader('Notes & Checklist','TRAVEL TOOLS','Keep practical information, documents and trip-ready tasks beside the journeys they belong to.')+
      '<div class="travel-context-bar"><label class="field"><span>Show</span><select id="notesTripFilter">'+tripOptions(filter,'All travel')+'</select></label><span>Notes and checklist progress sync with your Herald account.</span></div>'+
      '<div class="travel-notes-grid"><section class="panel travel-note-editor"><div class="panel-head"><div><p class="eyebrow">NOTES</p><h3>'+(activeNoteId?'Edit note':'Add a travel note')+'</h3></div></div>'+
        '<form id="noteForm"><input type="hidden" name="id" value="'+E(activeNoteId||'')+'"><label class="field"><span>Title</span><input name="title" required maxlength="120"></label>'+
        '<div class="form-grid"><label class="field"><span>Trip <em>optional</em></span><select id="noteTrip" name="tripId">'+tripOptions(noteTrip,'All travel')+'</select></label><label class="field"><span>Date <em>optional</em></span><input name="date" type="date"></label></div>'+
        '<div class="form-grid"><label class="field"><span>Category <em>optional</em></span><select name="category"><option value="">No category</option>'+M.NOTE_CATEGORIES.map(c=>'<option>'+E(c)+'</option>').join('')+'</select></label><label class="field"><span>Related to <em>optional</em></span><select name="related">'+relatedOptions(noteTrip)+'</select></label></div>'+
        '<div class="note-formatting" aria-label="Note formatting"><button type="button" class="text-btn" data-note-format="bold"><strong>B</strong> Bold</button><button type="button" class="text-btn" data-note-format="bullet">• Bullets</button><button type="button" class="text-btn" data-note-format="number">1. List</button><button type="button" class="text-btn" data-note-format="link">↗ Link</button></div>'+
        '<label class="field"><span>Note</span><textarea name="body" rows="8" maxlength="20000" placeholder="Keep booking details, restaurant ideas, entry notes, contacts or anything useful for the journey."></textarea></label>'+
        '<label class="check-row"><input name="pinned" type="checkbox"><span>Pin this note</span></label><div class="button-row"><button class="primary" type="submit">'+(activeNoteId?'Save note':'Add note')+'</button>'+(activeNoteId?'<button type="button" class="secondary" data-note-cancel>Cancel</button>':'')+'</div></form></section>'+
        '<section class="panel travel-note-list"><div class="panel-head"><div><p class="eyebrow">TRIP NOTES</p><h3>'+E(filter?tripName(filter):'All notes')+'</h3></div><span>'+notes.length+' '+(notes.length===1?'note':'notes')+'</span></div><div class="note-cards">'+(notes.length?notes.map(noteCard).join(''):'<p class="empty-state">No notes here yet. Add the information you would actually want to find quickly while travelling.</p>')+'</div></section></div>'+
      '<section class="panel checklist-workspace"><div class="panel-head"><div><p class="eyebrow">CHECKLISTS</p><h3>Travel-ready lists</h3><p class="helper">Start from a useful travel template, make it your own, or build a list from scratch.</p></div></div>'+
        '<form id="checklistCreate" class="checklist-create"><label class="field"><span>Trip <em>optional</em></span><select id="checklistTrip" name="tripId">'+tripOptions(checkTrip,'All travel')+'</select></label><label class="field"><span>Starting point</span><select name="template"><option value="">Blank checklist</option><option value="smart">Smart suggestions for this trip</option>'+Object.entries(M.CHECKLIST_TEMPLATES).map(([k,v])=>'<option value="'+k+'">'+E(v.title)+'</option>').join('')+'</select></label><label class="field"><span>Checklist name</span><input name="title" maxlength="120" placeholder="e.g. Algeria departure checks"></label><button class="primary" type="submit">Create checklist</button></form>'+
        '<div class="checklist-list">'+(checklists.length?checklists.map(checklistCard).join(''):'<p class="empty-state">No checklists yet. A trip-aware checklist can keep tickets, documents and departure jobs together.</p>')+'</div></section>';
    const editing=activeNoteId&&(state.notes||[]).find(n=>n.id===activeNoteId);
    if(editing){
      const form=notesPanel.querySelector('#noteForm');for(const key of ['title','date','category','body'])if(form.elements[key])form.elements[key].value=editing[key]||'';
      form.elements.tripId.value=editing.tripId||'';form.elements.pinned.checked=!!editing.pinned;
      form.elements.related.innerHTML=relatedOptions(editing.tripId||'',editing.relatedType&&editing.relatedId?editing.relatedType+':'+editing.relatedId:'');
    }
  }
  function noteCard(n){
    const related=n.relatedType&&n.relatedId?' · linked '+n.relatedType:'';
    return '<article class="travel-note-card '+(n.pinned?'is-pinned':'')+'"><div class="travel-note-card-head"><div><span>'+E([n.category,n.date,tripName(n.tripId)].filter(Boolean).join(' · '))+'</span><h4>'+E(n.title)+'</h4></div><button type="button" class="text-btn" data-note-pin="'+E(n.id)+'" aria-pressed="'+String(!!n.pinned)+'">'+(n.pinned?'Unpin':'Pin')+'</button></div><div class="travel-note-body">'+rich(n.body)+'</div><small>'+E(related.replace(/^ · /,''))+'</small><div class="button-row"><button type="button" class="secondary compact" data-note-edit="'+E(n.id)+'">Edit</button><button type="button" class="danger-link" data-note-delete="'+E(n.id)+'">Delete</button></div></article>';
  }
  function checklistCard(c){
    const all=(state.checklistItems||[]).filter(i=>i.checklistId===c.id).sort((a,b)=>(a.order??0)-(b.order??0)||a.id.localeCompare(b.id)),shown=c.hideCompleted?all.filter(i=>!i.done):all,done=all.filter(i=>i.done).length;
    const sections=[...new Set(shown.map(i=>i.section||'Checklist'))];
    return '<article class="checklist-card" data-checklist-card="'+E(c.id)+'"><div class="checklist-card-head"><div><span>'+E(c.tripId?tripName(c.tripId):'All travel')+'</span><h4>'+E(c.title)+'</h4><small>'+done+' of '+all.length+' complete</small></div><div class="checklist-actions"><button type="button" class="text-btn" data-checklist-toggle="'+E(c.id)+'">'+(c.hideCompleted?'Show completed':'Hide completed')+'</button><button type="button" class="text-btn" data-checklist-duplicate="'+E(c.id)+'">Duplicate</button><button type="button" class="danger-link" data-checklist-delete="'+E(c.id)+'">Delete</button></div></div>'+
      '<div class="checklist-progress" aria-label="'+done+' of '+all.length+' complete"><span style="width:'+(all.length?done/all.length*100:0)+'%"></span></div>'+
      (sections.length?sections.map(section=>'<section class="checklist-section"><h5>'+E(section)+'</h5>'+shown.filter(i=>(i.section||'Checklist')===section).map((item,index)=>checklistItem(item,index,shown.length)).join('')+'</section>').join(''):(all.length?'<p class="empty-state">All completed items are hidden.</p>':'<p class="empty-state">Add the first item below.</p>'))+
      '<form class="checklist-add" data-checklist-add="'+E(c.id)+'"><label class="field"><span>Item</span><input name="text" required maxlength="240" placeholder="Add a useful travel task"></label><label class="field"><span>Section <em>optional</em></span><input name="section" maxlength="80" placeholder="e.g. Documents"></label><button class="secondary" type="submit">Add item</button></form></article>';
  }
  function checklistItem(i,index,total){
    return '<div class="checklist-item '+(i.done?'is-done':'')+'"><label><input type="checkbox" data-check-item="'+E(i.id)+'" '+(i.done?'checked':'')+'><span>'+E(i.text)+'</span></label><div><button type="button" class="icon-btn" data-item-move="'+E(i.id)+'" data-delta="-1" '+(index===0?'disabled':'')+' aria-label="Move earlier">↑</button><button type="button" class="icon-btn" data-item-move="'+E(i.id)+'" data-delta="1" '+(index===total-1?'disabled':'')+' aria-label="Move later">↓</button><button type="button" class="text-btn" data-item-delete="'+E(i.id)+'">Remove</button></div></div>';
  }
  function selectedBudgetTrip(){return get('budgetTrip')?.value||'';}
  function budgetFor(tripId){return (state.budgets||[]).find(b=>b.tripId===tripId);}
  function renderBudget(){
    const selected=selectedBudgetTrip()||tripFromHash()||trips()[0]?.id||'',budget=budgetFor(selected),items=budget?(state.budgetItems||[]).filter(i=>i.budgetId===budget.id):[],summary=budget?M.budgetSummary(state,budget):null;
    const existing=selected?M.existingCosts(state,selected).filter(cost=>!items.some(i=>i.sourceType===cost.sourceType&&i.sourceId===cost.sourceId)):[];
    budgetPanel.innerHTML=toolHeader('Budget Planner','TRAVEL TOOLS','Use costs Herald already knows, plan what is left, then record what you actually spend without turning the trip into a spreadsheet.')+
      '<div class="travel-context-bar"><label class="field"><span>Trip</span><select id="budgetTrip"><option value="">Choose a trip</option>'+trips().map(t=>'<option value="'+E(t.id)+'" '+(t.id===selected?'selected':'')+'>'+E(t.name||'Unnamed trip')+'</option>').join('')+'</select></label><span>Original currencies are always kept. Overall totals use the budget currency only when a reliable equivalent is recorded.</span></div>'+
      (!selected?'<article class="panel empty-state">Choose a trip to see its existing accommodation and transport prices.</article>':!budget?'<article class="panel budget-start"><p class="eyebrow">START WITH WHAT HERALD KNOWS</p><h3>'+E(tripName(selected))+'</h3><p>'+existing.length+' priced travel '+(existing.length===1?'item is':'items are')+' already available to bring into this budget.</p><button type="button" class="primary" data-budget-start="'+E(selected)+'">Start this trip budget</button></article>':budgetMarkup(budget,items,existing,summary));
  }
  function budgetMarkup(budget,items,existing,s){
    const categories=new Map();for(const i of items){const v=M.baseValue(i.actual,s.base)??M.baseValue(i.planned,s.base);if(v!=null&&i.include!==false)categories.set(i.category||'Other',(categories.get(i.category||'Other')||0)+v);}
    const max=Math.max(1,...categories.values());
    return '<section class="budget-summary"><article><span>Trip budget</span><strong>'+money(s.totalBudget,s.base)+'</strong></article><article><span>Planned</span><strong>'+money(s.planned,s.base)+'</strong></article><article><span>Spent</span><strong>'+money(s.actual,s.base)+'</strong></article><article><span>Remaining</span><strong class="'+(s.remaining!=null&&s.remaining<0?'budget-over':'')+'">'+money(s.remaining,s.base)+'</strong></article><article><span>Paid</span><strong>'+money(s.paid,s.base)+'</strong></article><article><span>Outstanding</span><strong>'+money(s.outstanding,s.base)+'</strong></article></section>'+
      (s.missingConversions?'<p class="budget-conversion-note">'+s.missingConversions+' foreign '+(s.missingConversions===1?'amount is':'amounts are')+' shown in the original currency but excluded from '+E(s.base)+' totals until an equivalent is recorded.</p>':'')+
      '<div class="budget-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">PLAN</p><h3>Budget settings</h3></div></div><form id="budgetSettings"><div class="form-grid"><label class="field"><span>Overall trip budget</span><input name="totalBudget" type="number" min="0" step="any" value="'+E(budget.totalBudget??'')+'"></label><label class="field"><span>Budget currency</span><select name="baseCurrency">'+HVPrices.currencies.map(c=>'<option '+(c===s.base?'selected':'')+'>'+c+'</option>').join('')+'</select></label><label class="field"><span>Travellers</span><input name="travellers" type="number" min="1" step="1" value="'+E(budget.travellers||1)+'"></label></div><button class="secondary" type="submit">Save budget settings</button></form>'+
      (existing.length?'<div class="existing-costs"><div class="panel-head"><div><h4>Costs already in Herald</h4><p class="helper">Bring these in once. The source price remains on the original hotel or journey.</p></div><button type="button" class="text-btn" data-cost-add-all>Add all</button></div>'+existing.map((c,i)=>'<div class="existing-cost"><div><strong>'+E(c.label)+'</strong><span>'+E(c.category)+' · '+E(money(c.planned.amount,c.planned.currency))+'</span></div><button type="button" class="secondary compact" data-cost-add="'+i+'">Add</button></div>').join('')+'</div>':'')+
      '</section><section class="panel"><div class="panel-head"><div><p class="eyebrow">ADD OR UPDATE</p><h3>'+(activeBudgetItemId?'Edit expense':'Add expense')+'</h3></div></div>'+budgetItemForm(budget,s.base)+'</section></div>'+
      '<section class="panel budget-ledger"><div class="panel-head"><div><p class="eyebrow">TRIP SPEND</p><h3>Planned versus actual</h3></div><span>'+items.length+' '+(items.length===1?'item':'items')+'</span></div>'+(items.length?'<div class="budget-table" role="table"><div class="budget-row budget-row-head" role="row"><span>Item</span><span>Planned</span><span>Actual</span><span>Status</span><span></span></div>'+items.map(i=>budgetRow(i,s.base)).join('')+'</div>':'<p class="empty-state">Add a planned cost or bring in an existing Herald price to start the budget.</p>')+'</section>'+
      (categories.size?'<section class="panel budget-breakdown"><h3>Spend by category</h3>'+[...categories].sort((a,b)=>b[1]-a[1]).map(([name,value])=>'<div><span>'+E(name)+'</span><i><b style="width:'+value/max*100+'%"></b></i><strong>'+E(money(value,s.base))+'</strong></div>').join('')+'</section>':'')+
      dailyMarkup(items,s.base)+
      '<div class="budget-foot-metrics"><span>Cost per day <strong>'+money(s.costPerDay,s.base)+'</strong></span><span>Cost per traveller <strong>'+money(s.costPerTraveller,s.base)+'</strong></span></div>';
  }
  function budgetItemForm(budget,base){
    const item=activeBudgetItemId&&(state.budgetItems||[]).find(i=>i.id===activeBudgetItemId),cur=item?.planned?.currency||item?.actual?.currency||base;
    return '<form id="budgetItemForm"><input type="hidden" name="id" value="'+E(item?.id||'')+'"><label class="field"><span>Item</span><input name="label" required maxlength="160" value="'+E(item?.label||'')+'" placeholder="e.g. Museum tickets"></label><div class="form-grid"><label class="field"><span>Category</span><input name="category" list="budgetCategoryList" value="'+E(item?.category||'Other')+'" required><datalist id="budgetCategoryList">'+M.BUDGET_CATEGORIES.map(c=>'<option value="'+E(c)+'">').join('')+'</datalist></label><label class="field"><span>Date <em>optional</em></span><input name="date" type="date" value="'+E(item?.date||'')+'"></label><label class="field"><span>Original currency</span><select name="currency">'+HVPrices.currencies.map(c=>'<option '+(c===cur?'selected':'')+'>'+c+'</option>').join('')+'</select></label></div>'+
      '<div class="form-grid"><label class="field"><span>Planned amount</span><input name="planned" type="number" min="0" step="any" value="'+E(item?.planned?.amount??'')+'"></label><label class="field"><span>Actual amount</span><input name="actual" type="number" min="0" step="any" value="'+E(item?.actual?.amount??'')+'"></label><label class="field"><span>Paid so far</span><input name="paid" type="number" min="0" step="any" value="'+E(item?.paid?.amount??'')+'"></label></div>'+
      '<div class="form-grid budget-base-equivalents" '+(cur===base?'hidden':'')+'><label class="field"><span>'+E(base)+' equivalent · planned <em>optional</em></span><input name="basePlanned" type="number" min="0" step="any" value="'+E(item?.planned?.baseAmount??'')+'"></label><label class="field"><span>'+E(base)+' equivalent · actual <em>optional</em></span><input name="baseActual" type="number" min="0" step="any" value="'+E(item?.actual?.baseAmount??'')+'"></label><label class="field"><span>'+E(base)+' equivalent · paid <em>optional</em></span><input name="basePaid" type="number" min="0" step="any" value="'+E(item?.paid?.baseAmount??'')+'"></label><a class="text-btn budget-xe" href="https://www.xe.com/currencyconverter/" target="_blank" rel="noopener noreferrer">Open XE for a live rate ↗</a></div>'+
      '<label class="field"><span>Payment status</span><select name="paymentStatus">'+M.PAYMENT_STATUSES.map(x=>'<option '+(x===(item?.paymentStatus||'Not booked')?'selected':'')+'>'+E(x)+'</option>').join('')+'</select></label><label class="check-row"><input name="include" type="checkbox" '+(item?.include===false?'':'checked')+'><span>Include in trip totals</span></label><div class="button-row"><button class="primary" type="submit">'+(item?'Save expense':'Add expense')+'</button>'+(item?'<button type="button" class="secondary" data-budget-cancel>Cancel</button>':'')+'</div></form>';
  }
  function budgetRow(i,base){
    const approx=value=>{if(!value)return '—';const original=money(value.amount,value.currency),converted=value.currency!==base&&Number.isFinite(value.baseAmount)?'<small>≈ '+E(money(value.baseAmount,base))+'</small>':'';return E(original)+converted;};
    return '<div class="budget-row '+(i.include===false?'is-excluded':'')+'" role="row"><span><strong>'+E(i.label)+'</strong><small>'+E(i.category||'Other')+(i.date?' · '+E(i.date):'')+'</small></span><span>'+approx(i.planned)+'</span><span>'+approx(i.actual)+'</span><span>'+E(i.paymentStatus||'Not booked')+'</span><span><button type="button" class="text-btn" data-budget-edit="'+E(i.id)+'">Edit</button><button type="button" class="danger-link" data-budget-delete="'+E(i.id)+'">Delete</button></span></div>';
  }
  function dailyMarkup(items,base){
    const groups=M.groupDaily(items);if(!groups.length)return '';
    return '<section class="panel daily-spend"><div class="panel-head"><div><p class="eyebrow">DURING THE TRIP</p><h3>Daily spending</h3></div></div>'+groups.map(([date,rows])=>'<details><summary><strong>'+E(new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}))+'</strong><span>'+rows.length+' '+(rows.length===1?'expense':'expenses')+'</span></summary>'+rows.map(i=>'<div><span>'+E(i.label)+'</span><strong>'+E(money(i.actual?.amount,i.actual?.currency||base))+'</strong></div>').join('')+'</details>').join('')+'</section>';
  }
  function onInput(e){
    if(e.target.id==='noteTrip'){const related=notesPanel.querySelector('[name=related]');if(related)related.innerHTML=relatedOptions(e.target.value);}
  }
  function onChange(e){
    if(e.target.id==='notesTripFilter'||e.target.id==='budgetTrip'){render();return;}
    if(e.target.matches('#budgetItemForm [name=currency]')){const budget=budgetFor(selectedBudgetTrip()),box=budgetPanel.querySelector('.budget-base-equivalents');if(box&&budget)box.hidden=e.target.value===budget.baseCurrency;return;}
    if(e.target.matches('[data-check-item]')){const item=state.checklistItems.find(i=>i.id===e.target.dataset.checkItem);if(item){item.done=e.target.checked;item.completedAt=item.done?now():null;save();}}
  }
  function formatNote(kind){
    const textarea=notesPanel.querySelector('#noteForm [name=body]');if(!textarea)return;const start=textarea.selectionStart,end=textarea.selectionEnd,selected=textarea.value.slice(start,end),lineStart=textarea.value.lastIndexOf('\n',start-1)+1;
    let replacement=selected;
    if(kind==='bold')replacement='**'+(selected||'important text')+'**';
    if(kind==='link')replacement='['+(selected||'link text')+'](https://)';
    if(kind==='bullet'||kind==='number'){const source=selected||textarea.value.slice(lineStart,end)||'list item';replacement=source.split('\n').map((line,i)=>(kind==='bullet'?'- ':String(i+1)+'. ')+line.replace(/^\s*(?:[-*]|\d+[.)])\s*/,'')).join('\n');}
    textarea.setRangeText(replacement,start,end,'select');textarea.focus();
  }
  function onClick(e){
    const b=e.target.closest('button,[data-budget-start]');if(!b)return;
    if(b.dataset.noteFormat){formatNote(b.dataset.noteFormat);return;}
    if(b.hasAttribute('data-note-cancel')){activeNoteId=null;render();return;}
    if(b.dataset.noteEdit){activeNoteId=b.dataset.noteEdit;render();return;}
    if(b.dataset.notePin){const n=state.notes.find(n=>n.id===b.dataset.notePin);if(n){n.pinned=!n.pinned;n.updatedAt=now();save();}return;}
    if(b.dataset.noteDelete){if(confirm('Delete this note?')){state.notes=state.notes.filter(n=>n.id!==b.dataset.noteDelete);if(activeNoteId===b.dataset.noteDelete)activeNoteId=null;save();}return;}
    if(b.dataset.checklistToggle){const c=state.checklists.find(c=>c.id===b.dataset.checklistToggle);if(c){c.hideCompleted=!c.hideCompleted;c.updatedAt=now();save();}return;}
    if(b.dataset.checklistDuplicate){duplicateChecklist(b.dataset.checklistDuplicate);return;}
    if(b.dataset.checklistDelete){if(confirm('Delete this checklist and its items?')){state.checklists=state.checklists.filter(c=>c.id!==b.dataset.checklistDelete);state.checklistItems=state.checklistItems.filter(i=>i.checklistId!==b.dataset.checklistDelete);save();}return;}
    if(b.dataset.itemDelete){state.checklistItems=state.checklistItems.filter(i=>i.id!==b.dataset.itemDelete);save();return;}
    if(b.dataset.itemMove){moveItem(b.dataset.itemMove,Number(b.dataset.delta));return;}
    if(b.dataset.budgetStart){state.budgets.push({id:uid(),tripId:b.dataset.budgetStart,baseCurrency:'GBP',totalBudget:null,travellers:1,createdAt:now(),updatedAt:now()});save();return;}
    if(b.hasAttribute('data-cost-add-all')){const trip=selectedBudgetTrip(),budget=budgetFor(trip);for(const c of M.existingCosts(state,trip))addExistingCost(budget,c);save();return;}
    if(b.dataset.costAdd!==undefined){const trip=selectedBudgetTrip(),budget=budgetFor(trip),existing=M.existingCosts(state,trip).filter(cost=>!state.budgetItems.some(i=>i.budgetId===budget.id&&i.sourceType===cost.sourceType&&i.sourceId===cost.sourceId)),cost=existing[Number(b.dataset.costAdd)];if(cost){addExistingCost(budget,cost);save();}return;}
    if(b.dataset.budgetEdit){activeBudgetItemId=b.dataset.budgetEdit;render();return;}
    if(b.hasAttribute('data-budget-cancel')){activeBudgetItemId=null;render();return;}
    if(b.dataset.budgetDelete){if(confirm('Delete this budget item?')){state.budgetItems=state.budgetItems.filter(i=>i.id!==b.dataset.budgetDelete);if(activeBudgetItemId===b.dataset.budgetDelete)activeBudgetItemId=null;save();}return;}
  }
  function onSubmit(e){
    const form=e.target;if(!form.closest('#toolsView')&&!form.closest('.travel-tool-workspace'))return;
    if(form.id==='noteForm'){e.preventDefault();saveNote(form);return;}
    if(form.id==='checklistCreate'){e.preventDefault();createChecklist(form);return;}
    if(form.matches('[data-checklist-add]')){e.preventDefault();addChecklistItem(form);return;}
    if(form.id==='budgetSettings'){e.preventDefault();saveBudgetSettings(form);return;}
    if(form.id==='budgetItemForm'){e.preventDefault();saveBudgetItem(form);return;}
  }
  function saveNote(form){
    const f=form.elements,id=f.id.value||uid(),old=state.notes.find(n=>n.id===id),related=String(f.related.value||'').split(':');
    const note={...old,id,title:f.title.value.trim(),body:f.body.value.trim(),tripId:f.tripId.value||null,date:f.date.value||null,category:f.category.value||null,pinned:f.pinned.checked,relatedType:related.length>1?related[0]:null,relatedId:related.length>1?related.slice(1).join(':'):null,createdAt:old?.createdAt||now(),updatedAt:now()};
    if(old)state.notes[state.notes.indexOf(old)]=note;else state.notes.push(note);activeNoteId=null;save();
  }
  function createChecklist(form){
    const f=form.elements,key=f.template.value,tripId=f.tripId.value||null,t=M.template(key,state,tripId),title=f.title.value.trim()||t.title||'Travel checklist',id=uid(),stamp=now();
    state.checklists.push({id,title,tripId,templateKey:key||null,hideCompleted:false,createdAt:stamp,updatedAt:stamp});
    t.items.forEach(([section,text],order)=>state.checklistItems.push({id:uid(),checklistId:id,text,section,done:false,order,createdAt:stamp,updatedAt:stamp}));
    save();
  }
  function addChecklistItem(form){
    const id=form.dataset.checklistAdd,items=state.checklistItems.filter(i=>i.checklistId===id),stamp=now();
    state.checklistItems.push({id:uid(),checklistId:id,text:form.elements.text.value.trim(),section:form.elements.section.value.trim()||'Checklist',done:false,order:items.length?Math.max(...items.map(i=>Number(i.order)||0))+1:0,createdAt:stamp,updatedAt:stamp});
    const c=state.checklists.find(c=>c.id===id);if(c)c.updatedAt=stamp;save();
  }
  function moveItem(id,delta){
    const item=state.checklistItems.find(i=>i.id===id);if(!item)return;const rows=state.checklistItems.filter(i=>i.checklistId===item.checklistId).sort((a,b)=>(a.order??0)-(b.order??0)||a.id.localeCompare(b.id)),i=rows.indexOf(item),j=i+delta;if(j<0||j>=rows.length)return;
    rows.forEach((row,index)=>row.order=index);[rows[i].order,rows[j].order]=[rows[j].order,rows[i].order];item.updatedAt=now();save();
  }
  function duplicateChecklist(id){
    const c=state.checklists.find(c=>c.id===id);if(!c)return;const next=uid(),stamp=now();state.checklists.push({...c,id:next,title:c.title+' copy',createdAt:stamp,updatedAt:stamp});
    state.checklistItems.filter(i=>i.checklistId===id).forEach(i=>state.checklistItems.push({...i,id:uid(),checklistId:next,done:false,completedAt:null,createdAt:stamp,updatedAt:stamp}));save();
  }
  function addExistingCost(budget,cost){
    if(!budget||state.budgetItems.some(i=>i.budgetId===budget.id&&i.sourceType===cost.sourceType&&i.sourceId===cost.sourceId))return;
    state.budgetItems.push({id:uid(),budgetId:budget.id,...cost,actual:null,paid:null,paymentStatus:'Booked',include:true,createdAt:now(),updatedAt:now()});
  }
  function saveBudgetSettings(form){
    const budget=budgetFor(selectedBudgetTrip());if(!budget)return;budget.totalBudget=form.elements.totalBudget.value===''?null:Number(form.elements.totalBudget.value);budget.baseCurrency=form.elements.baseCurrency.value;budget.travellers=Math.max(1,Number(form.elements.travellers.value)||1);budget.updatedAt=now();save();
  }
  function moneyField(amount,currency,baseAmount,baseCurrency){
    if(amount===''||amount==null)return null;const result={amount:Number(amount),currency};if(currency!==baseCurrency&&baseAmount!==''&&baseAmount!=null)result.baseAmount=Number(baseAmount);return result;
  }
  function saveBudgetItem(form){
    const budget=budgetFor(selectedBudgetTrip());if(!budget)return;const f=form.elements,id=f.id.value||uid(),old=state.budgetItems.find(i=>i.id===id),cur=f.currency.value;
    const item={...old,id,budgetId:budget.id,label:f.label.value.trim(),category:f.category.value.trim()||'Other',date:f.date.value||null,planned:moneyField(f.planned.value,cur,f.basePlanned.value,budget.baseCurrency),actual:moneyField(f.actual.value,cur,f.baseActual.value,budget.baseCurrency),paid:moneyField(f.paid.value,cur,f.basePaid.value,budget.baseCurrency),paymentStatus:f.paymentStatus.value,include:f.include.checked,createdAt:old?.createdAt||now(),updatedAt:now()};
    if(old)state.budgetItems[state.budgetItems.indexOf(old)]=item;else state.budgetItems.push(item);activeBudgetItemId=null;save();
  }

  document.addEventListener('DOMContentLoaded',install);
  window.addEventListener('hashchange',()=>queueMicrotask(render));
  window.addEventListener('hv-route',()=>queueMicrotask(render));
  window.HVTravelToolsUI={render};
})();

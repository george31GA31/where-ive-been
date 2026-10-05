/* Pure travel-specific Notes, Checklist and Budget helpers. */
(function(root){
  'use strict';

  const NOTE_CATEGORIES=['General','Itinerary','Accommodation','Transport','Entry requirements','Visa','Health','Money','Packing','Food','Places to visit','Booking information','Contact information','Emergency information','Other'];
  const BUDGET_CATEGORIES=['Flights','Accommodation','Trains','Buses','Ferries','Taxis','Car hire','Fuel','Public transport','Food & drink','Activities','Tours','Visas / entry fees','Insurance','Shopping','Other'];
  const PAYMENT_STATUSES=['Not booked','Booked','Deposit paid','Part paid','Paid','Refund pending','Refunded'];
  const CHECKLIST_TEMPLATES={
    beforeBooking:{title:'Before booking',items:[
      ['Before booking','Check passport validity'],['Before booking','Check visa / entry requirements'],['Before booking','Check travel insurance'],['Before booking','Compare flight or transport options'],['Before booking','Check accommodation'],['Before booking','Check airport or station transfers']
    ]},
    beforeDeparture:{title:'Before departure',items:[
      ['Travel documents','Check in for flight where applicable'],['Travel documents','Download boarding passes and tickets'],['Travel documents','Confirm accommodation'],['Travel documents','Confirm airport / station transfer'],
      ['Practical','Download offline maps'],['Practical','Check currency and payment options'],['Practical','Check roaming or eSIM'],['Practical','Check weather'],['Packing','Pack medication'],['Packing','Charge power bank']
    ]},
    documents:{title:'Documents',items:[
      ['Documents','Passport'],['Documents','Visa / eVisa where required'],['Documents','Travel insurance'],['Documents','Flight or transport confirmation'],['Documents','Accommodation confirmation'],['Documents','Driving licence where needed'],['Documents','International driving permit where needed'],['Documents','Vaccination certificate where applicable']
    ]},
    packing:{title:'Packing',items:[
      ['Essentials','Passport and wallet'],['Essentials','Phone and charging cable'],['Essentials','Medication and prescriptions'],['Clothing','Weather-appropriate layers'],['Clothing','Comfortable walking shoes'],['Travel kit','Power adapter if needed'],['Travel kit','Reusable water bottle'],['Travel kit','Small day bag']
    ]}
  };
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const number=value=>value===''||value==null?null:(Number.isFinite(Number(value))?Number(value):null);
  const currency=value=>/^[A-Z]{3}$/.test(String(value||'').toUpperCase())?String(value).toUpperCase():'GBP';
  function ensure(state){
    for(const key of ['notes','checklists','checklistItems','budgets','budgetItems'])if(!Array.isArray(state[key]))state[key]=[];
    return state;
  }
  function tripRecords(state,tripId){
    if(!tripId)return {trip:null,stays:[],transports:[],accommodations:[],places:[]};
    return {
      trip:(state.trips||[]).find(t=>t.id===tripId)||null,
      stays:(state.stays||[]).filter(r=>r.tripId===tripId&&r.status!=='cancelled'),
      transports:(state.transports||[]).filter(r=>r.tripId===tripId&&r.status!=='cancelled'),
      accommodations:(state.accommodations||[]).filter(r=>r.tripId===tripId&&r.status!=='cancelled'),
      places:(state.placeVisits||[]).filter(r=>r.tripId===tripId&&r.status!=='not-recorded')
    };
  }
  function smartItems(state,tripId){
    const r=tripRecords(state,tripId),out=[],add=(section,text)=>{if(!out.some(x=>x[1]===text))out.push([section,text]);};
    if(r.transports.some(t=>t.type==='flight')){add('Based on this trip','Check in for flight when check-in opens');add('Based on this trip','Download boarding passes');}
    if(r.transports.some(t=>t.type==='train'))add('Based on this trip','Confirm train tickets and seat reservations');
    if(r.transports.some(t=>t.type==='boat'))add('Based on this trip','Confirm ferry / boat ticket and departure terminal');
    if(r.transports.some(t=>t.type==='bus'))add('Based on this trip','Confirm bus / coach ticket and departure stop');
    if(r.accommodations.length)add('Based on this trip','Confirm accommodation booking and check-in details');
    if(r.stays.some(s=>s.countryCode&&s.countryCode!=='SEA'))add('Based on this trip','Review entry requirements for each destination');
    if(r.places.length)add('Based on this trip','Save key places for offline access');
    add('Before departure','Download offline maps');
    add('Before departure','Check local payment options and emergency access to money');
    add('Before departure','Check roaming or eSIM');
    return out;
  }
  function template(key,state,tripId){
    if(key==='smart')return {title:'Trip-ready checklist',items:smartItems(state,tripId)};
    return clone(CHECKLIST_TEMPLATES[key]||{title:'New checklist',items:[]});
  }
  function transportCategory(type){
    return ({flight:'Flights',train:'Trains',bus:'Buses',boat:'Ferries',ferry:'Ferries',car:'Car hire',taxi:'Taxis'})[type]||'Other';
  }
  function validPrice(p){return p&&Number.isFinite(Number(p.amount))&&Number(p.amount)>=0&&/^[A-Z]{3}$/.test(String(p.currency||''));}
  function existingCosts(state,tripId){
    const r=tripRecords(state,tripId),out=[];
    for(const t of r.transports)if(validPrice(t.price))out.push({
      sourceType:'transport',sourceId:t.id,label:[t.start?.name,t.end?.name].filter(Boolean).join(' → ')||'Transport',
      category:transportCategory(t.type),date:String(t.startLocal||'').slice(0,10),planned:{amount:Number(t.price.amount),currency:t.price.currency}
    });
    for(const a of r.accommodations)if(validPrice(a.price))out.push({
      sourceType:'accommodation',sourceId:a.id,label:a.propertyName||'Accommodation',category:'Accommodation',date:a.checkIn||'',
      planned:{amount:Number(a.price.amount),currency:a.price.currency}
    });
    return out;
  }
  function money(value,defaultCurrency='GBP'){
    if(value==null)return null;
    if(typeof value==='number')return {amount:value,currency:currency(defaultCurrency)};
    const amount=number(value.amount);if(amount==null||amount<0)return null;
    const result={amount,currency:currency(value.currency||defaultCurrency)};
    const baseAmount=number(value.baseAmount);if(baseAmount!=null&&baseAmount>=0)result.baseAmount=baseAmount;
    return result;
  }
  function baseValue(value,baseCurrency){
    const m=money(value,baseCurrency);if(!m)return null;
    if(m.currency===baseCurrency)return m.amount;
    return Number.isFinite(m.baseAmount)?m.baseAmount:null;
  }
  function tripSpan(state,tripId){
    const r=tripRecords(state,tripId),dates=[
      r.trip?.start,r.trip?.end,
      ...r.stays.flatMap(x=>[x.start,x.end]),
      ...r.transports.flatMap(x=>[String(x.startLocal||'').slice(0,10),String(x.endLocal||'').slice(0,10)]),
      ...r.accommodations.flatMap(x=>[x.checkIn,x.checkOut])
    ].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')).sort();
    if(!dates.length)return {start:'',end:'',days:0};
    const days=Math.max(1,Math.round((Date.parse(dates.at(-1)+'T00:00:00Z')-Date.parse(dates[0]+'T00:00:00Z'))/86400000)+1);
    return {start:dates[0],end:dates.at(-1),days};
  }
  function budgetSummary(state,budget){
    ensure(state);const base=currency(budget?.baseCurrency||'GBP'),items=state.budgetItems.filter(i=>i.budgetId===budget?.id&&i.include!==false);
    let planned=0,actual=0,paid=0,outstanding=0,missing=0;
    for(const item of items){
      const p=baseValue(item.planned,base),a=baseValue(item.actual,base),committed=a??p;
      if(item.planned&&p==null)missing++; else if(p!=null)planned+=p;
      if(item.actual&&a==null)missing++; else if(a!=null)actual+=a;
      if(committed!=null){
        let itemPaid=baseValue(item.paid,base);
        if(item.paymentStatus==='Paid')itemPaid=committed;
        if(item.paymentStatus==='Refunded')itemPaid=0;
        itemPaid=Math.max(0,Math.min(committed,itemPaid||0));
        paid+=itemPaid;
        if(!['Refunded','Refund pending'].includes(item.paymentStatus))outstanding+=Math.max(0,committed-itemPaid);
      }
    }
    const totalBudget=number(budget?.totalBudget),remaining=totalBudget==null?null:totalBudget-actual;
    const span=tripSpan(state,budget?.tripId),travellers=Math.max(1,Number(budget?.travellers)||1);
    return {base,planned,actual,paid,outstanding,totalBudget,remaining,missingConversions:missing,days:span.days,costPerDay:span.days?actual/span.days:null,costPerTraveller:actual/travellers};
  }
  function groupDaily(items=[]){
    const map=new Map();for(const item of items){if(!item.date||!item.actual)continue;if(!map.has(item.date))map.set(item.date,[]);map.get(item.date).push(item);}
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  }
  const api={NOTE_CATEGORIES,BUDGET_CATEGORIES,PAYMENT_STATUSES,CHECKLIST_TEMPLATES,ensure,tripRecords,smartItems,template,transportCategory,existingCosts,money,baseValue,tripSpan,budgetSummary,groupDaily};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVTravelTools=api;
})(typeof window!=='undefined'?window:globalThis);

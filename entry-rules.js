/* Reviewed official guidance for ordinary passports and short tourism visits. Unknown cases stay unknown. */
(function(root){
 'use strict';
 const checked='2026-10-02',schengen=new Set('AT BE BG HR CZ DK EE FI FR DE GR HU IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH'.split(' '));
 const source=slug=>'https://www.gov.uk/foreign-travel-advice/'+slug+'/entry-requirements';
 const rules={
  IE:{title:'Entry under the Common Travel Area',tone:'good',requirement:'special arrangement',source:source('ireland'),text:'British and Irish citizens can travel freely under the Common Travel Area. Carry identification accepted by your carrier.'},
  AL:{title:'Visa not required',tone:'good',requirement:'visa free',days:90,source:source('albania'),text:'Short tourism or business visits: up to 90 days in a 180-day period. Longer visits require permission.'},
  US:{title:'Electronic authorisation or visa required',tone:'warn',requirement:'eta',days:90,source:source('usa'),text:'Eligible Visa Waiver Program travellers need ESTA, including transit. Travel history, passport and personal circumstances can require a visa instead.'},
  IN:{title:'Visa required before travel',tone:'bad',requirement:'visa',source:source('india'),text:'Arrange an appropriate visa or eligible e-visa before travel. A valid OCI or e-OCI may provide an exemption; check its conditions.'},
  EG:{title:'Visa on arrival or advance visa',tone:'warn',requirement:'visa on arrival',days:30,source:source('egypt'),text:'British citizen passport holders can usually obtain a visa on arrival or apply in advance. Limited Sinai resort exemptions and passport-category restrictions apply.'}
 };
 function lookup(passport,destination,{purpose='tourism',days=null,residency='',today=new Date().toISOString().slice(0,10)}={}){
  const unknown={title:'Check official requirements',tone:'neutral',requirement:'unknown',checked,source:'https://www.gov.uk/foreign-travel-advice',text:'No current verified rule covers these details. Check the destination immigration authority. Residence permits, passport categories, transit and visit purpose can change eligibility.'};
  if(!passport||!destination)return unknown;
  if(passport===destination)return {...unknown,title:'Citizenship destination',tone:'good',requirement:'citizen',text:'Check the passport or identity document required for entry as a citizen.'};
  if(today>'2026-12-31'||!['tourism','business'].includes(purpose)||residency)return unknown;
  if(passport==='GB'){
   if(schengen.has(destination))return {...unknown,title:days>90?'Check permission for a longer stay':'Visa not required for a short visit',tone:days>90?'warn':'good',requirement:days>90?'unknown':'visa free',days:90,source:source('france'),text:'Ordinary British citizen passports: up to 90 days across the Schengen Area in any 180-day period for permitted short visits. Check passport validity, border registration and current authorisation requirements. This does not establish your remaining allowance.'};
   const rule=rules[destination];if(rule){if(days&&rule.days&&days>rule.days)return unknown;return {...rule,checked};}
  }
  if(passport==='IE'&&destination==='GB')return {...rules.IE,checked};
  return unknown;
 }
 const api={lookup,checked,schengen};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVEntryRules=api;
})(typeof window!=='undefined'?window:globalThis);

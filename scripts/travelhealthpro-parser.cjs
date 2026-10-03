/* Parse public, OGL-licensed destination facts. Never execute source scripts. */
'use strict';
const {JSDOM}=require('jsdom');
const origin='https://travelhealthpro.org.uk';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function sourceUrl(value){try{const u=new URL(value,origin);return !u.username&&!u.password&&!u.search&&u.origin===origin&&/^\/countries\/[a-z0-9-]+$/.test(u.pathname)?u.href:null;}catch{return null;}}
function document(html){const d=new JSDOM(html).window.document;d.querySelectorAll('script,style,iframe,noscript').forEach(n=>n.remove());return d;}
function directory(html){
 const d=document(html),destinations=new Map();
 for(const a of d.querySelectorAll('a[href]')){const url=sourceUrl(a.getAttribute('href')),name=clean(a.textContent);if(!url||!name||name.length>100)continue;const id=new URL(url).pathname.split('/').pop();const r=destinations.get(id)||{id,url,name,aliases:[]};if(!r.aliases.includes(name))r.aliases.push(name);destinations.set(id,r);}
 if(destinations.size<200)throw new Error('Country directory is incomplete or changed');const result=[...destinations.values()].sort((a,b)=>a.id.localeCompare(b.id));d.defaultView.close();return result;
}
function between(heading){const nodes=[];for(let n=heading?.nextElementSibling;n&&!/^H[1-4]$/.test(n.tagName);n=n.nextElementSibling)nodes.push(n);return nodes;}
function blocks(nodes){return nodes.flatMap(n=>n.matches('ul,ol')?[...n.children].map(li=>clean(li.textContent)):[clean(n.textContent)]).filter(Boolean);}
function section(container,name){return [...(container?.querySelectorAll('h2,h3,h4')||[])].find(h=>key(h.textContent)===key(name));}
function vaccine(item,url){
 const heading=item.querySelector('.accordion-button')||item.querySelector('h4,h3'),body=item.querySelector('.accordion-body');if(!heading||!body)return null;
 const name=clean(heading.textContent),recommendation=[...body.querySelectorAll('h2,h3,h4')].find(h=>/vaccination$/.test(key(h.textContent)));
 // Keep complete source statements, not a sentence cut in half. Longer qualifications stay at the source.
 const advice=blocks(between(recommendation)).filter(t=>!/^Resources$|^.*in brief$/.test(t));
 const narrative=[...body.querySelectorAll('p')].map(n=>clean(n.textContent)).filter(Boolean);
 const summary=advice.find(t=>t.length<=650&&/recommend|consider|should/i.test(t))||narrative.find(t=>t.length<=650&&/recommend|consider|should/i.test(t))||advice.find(t=>t.length<=650)||null;
 const considerations=advice.filter(t=>t!==summary&&t.length<=300&&!/^.*in brief$/.test(t)).slice(0,6);
 const riskHeading=[...body.querySelectorAll('h2,h3')].find(h=>key(h.textContent).startsWith(key(name)+' in '));
 const risk=blocks(between(riskHeading)).filter(t=>t.length<=450&&!/current outbreaks.*outbreak surveillance/i.test(t)).slice(0,2);
 const anchor=item.querySelector('.accordion-collapse')?.id;
 return {name,summary,considerations,risk,url:url+(anchor?'#'+anchor:'#Vaccine_Recommendations')};
}
function parse(html,destination,retrieved){
 const d=document(html),url=sourceUrl(d.querySelector('link[rel=canonical]')?.getAttribute('href'))||destination.url;
 if(url!==(destination.canonical||destination.url))throw new Error('Unexpected destination redirect');
 const name=clean(d.querySelector('.country_banner h2')?.textContent)||clean(d.title).replace(/^NaTHNaC\s*[-–]\s*/,''),vaccines=d.querySelector('#Vaccine_Recommendations')||[...d.querySelectorAll('[role=tabpanel]')].find(n=>section(n,'Vaccine Recommendations'));
 if(!vaccines||![destination.name,...destination.aliases,...(destination.canonicalAliases||[])].some(a=>key(a)===key(name)))throw new Error('Destination identity or vaccine section changed: '+destination.id);
 const certificateHeading=section(vaccines,'Certificate requirements'),certificateEntries=blocks(between(certificateHeading)).filter(t=>!/^Please read the information below/i.test(t));
 if(!certificateHeading||!certificateEntries.length)throw new Error('Certificate section missing: '+destination.id);
 const certificates={status:certificateEntries.some(t=>/^(?:there (?:are|is) )?no certificate requirements under international health regulations/i.test(t))?'none':'listed',entries:certificateEntries};
 function group(label){const heading=section(vaccines,label);if(!heading)return null;const accordion=between(heading).find(n=>n.matches('.accordion')||n.querySelector('.accordion-item'));return [...(accordion?.querySelectorAll('.accordion-item')||[])].map(n=>vaccine(n,url)).filter(Boolean);}
 const most=group('Most travellers'),some=group('Some travellers');
 if(!most&&!some)throw new Error('Vaccine categories missing: '+destination.id);
 const malariaPanel=d.querySelector('#Malaria'),riskHeading=section(malariaPanel,'Risk areas');let malaria=null;
 if(malariaPanel){let areas=blocks(between(riskHeading));if(!areas.length){areas=[...malariaPanel.querySelectorAll('p')].map(n=>clean(n.textContent)).filter(t=>/no (?:risk of )?malaria|malaria (?:risk|is not)/i.test(t)).slice(0,2);}
  if(areas.length){const text=areas.join(' '),noRisk=areas.every(t=>/no (?:risk of )?malaria|no risk.*malaria|malaria is not/i.test(t));malaria={classification:noRisk?'none':/low risk|certain|areas|region|parts|province|states/i.test(text)?'regional':'present',areas,seasonal:/season|month|rain|summer|winter/i.test(text),tablets:/recommended|advised/i.test(text)&&/atovaquone|doxycycline|mefloquine|antimalarial|chloroquine/i.test(text)?'recommended':/antimalarial|tablets/i.test(text)?'conditional':'not-listed',url:url+'#Malaria'};}
 }
 const yellowVaccine=[...(most||[]),...(some||[])].find(v=>/^yellow fever$/i.test(v.name));
 const yellowEntries=certificateEntries.filter(t=>/yellow fever|vaccination certificate|9 months|one year/i.test(t)&&!/^According to World Health Organization|^View the WHO/i.test(t));
 const yellowFever=yellowEntries.length||yellowVaccine?{entry:yellowEntries,recommendation:yellowVaccine||null}:null;
 const notices=[...d.querySelectorAll('#Outbreaks .outbreak_post')].flatMap(n=>{const dateText=clean(n.querySelector('.outbreak_date small')?.textContent),time=Date.parse(dateText+' UTC'),title=clean(n.querySelector('.outbreak_details h3')?.textContent),status=clean(n.querySelector('.status')?.textContent),paragraph=clean(n.querySelector('.outbreak_details > p')?.textContent);if(!Number.isFinite(time)||!title)return [];const date=new Date(time).toISOString().slice(0,10);if(date>retrieved||Date.parse(retrieved)-time>90*86400000)return [];return [{title,date,status,summary:paragraph.length<=420?paragraph:null,url:url+'#Outbreaks'}];}).slice(0,3);
 const result={id:destination.id,url,name:url===destination.url?name:destination.name,sourceName:name,aliases:destination.aliases,sourceStatus:'available',retrieved,sourceUpdated:null,certificates,most:most||[],some:some||[],malaria,yellowFever,notices};d.defaultView.close();return result;
}
function robotsPolicy(text,agent='HeraldVoyagesHealthUpdater'){
 const groups=[];let current=null,hasRules=false;
 for(const line of String(text).split(/\r?\n/)){const match=line.replace(/#.*$/,'').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);if(!match)continue;const type=match[1].toLowerCase(),value=match[2].trim();if(type==='user-agent'){if(!current||hasRules){current={agents:[],rules:[],delay:0};groups.push(current);hasRules=false;}current.agents.push(value.toLowerCase());}else if(current&&['allow','disallow','crawl-delay'].includes(type)){hasRules=true;if(type==='crawl-delay')current.delay=Math.max(current.delay,Number(value)||0);else if(value)current.rules.push({allow:type==='allow',path:value});}}
 const exact=groups.filter(g=>g.agents.includes(agent.toLowerCase())),selected=exact.length?exact:groups.filter(g=>g.agents.includes('*'));
 return {delay:Math.max(1.5,...selected.map(g=>g.delay)),allows(path){const matches=selected.flatMap(g=>g.rules).filter(r=>{const pattern=r.path.split('*').map(s=>s.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp('^'+pattern).test(path);}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return !matches.length||matches[0].allow;}};
}
module.exports={directory,parse,robotsPolicy,key,sourceUrl};

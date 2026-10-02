/* Display-only romanisation. Original place snapshots are never rewritten. */
(function(root){
  'use strict';
  const ascii=typeof module!=='undefined'&&module.exports?require('./vendor/anyascii/anyascii.js'):root.HVAnyAscii;
  const nonLatin=/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
  const isLatin=value=>!!String(value||'').trim()&&!nonLatin.test(String(value));
  function text(value,alternatives=[]){
    const original=String(value??'');
    if(isLatin(original)||!original)return original;
    const preferred=alternatives.find(isLatin);if(preferred)return String(preferred);
    // Retain an unmapped character rather than deleting part of an address.
    return original.replace(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]+/gu,run=>[...run].every(c=>ascii?.(c))?(ascii?.(run)||run):[...run].map(c=>ascii?.(c)||c).join(''));
  }
  function field(p,key){return text(p?.[key],[p?.[key+'En'],p?.[key+':en'],p?.['english'+key[0].toUpperCase()+key.slice(1)],p?.[key+'Latin'],p?.[key+'Transliteration']]);}
  function address(p){
    if(typeof p==='string')return text(p);
    if(!p)return '';
    const preferred=[p.addressEn,p['address:en'],p.englishAddress,p.addressLatin,p.addressTransliteration].find(isLatin);
    if(preferred)return preferred;
    let raw=String(p.address||'');
    // Use provider aliases before romanising, including an English city name.
    for(const [native,latin] of Object.entries(p.addressAliases||{}))if(native&&isLatin(latin))raw=raw.split(native).join(latin);
    const parts=text(raw).split(/\s*,\s*/),seen=new Set();
    return parts.filter(part=>{const key=part.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;}).join(', ');
  }
  function place(p){if(!p)return p;return {...p,name:field(p,'name'),address:address(p),area:field(p,'area'),city:field(p,'city'),countryName:field(p,'countryName')};}
  const api={text,field,address,place,isLatin};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVAddress=api;
})(typeof window!=='undefined'?window:globalThis);

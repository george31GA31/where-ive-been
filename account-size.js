/* Match PostgreSQL jsonb::text byte sizing without modifying the saved payload. */
(function(root){
  'use strict';
  const limit=5000000;
  const utf8=text=>typeof TextEncoder!=='undefined'?new TextEncoder().encode(text).length:unescape(encodeURIComponent(text)).length;
  function expanded(value){
    const text=String(value);if(!/[eE]/.test(text))return text;
    const [coefficient,power]=text.toLowerCase().split('e'),negative=coefficient.startsWith('-'),digits=coefficient.replace('-','').replace('.',''),position=(coefficient.replace('-','').split('.')[0].length)+Number(power);
    const unsigned=position<=0?'0.'+'0'.repeat(-position)+digits:position>=digits.length?digits+'0'.repeat(position-digits.length):digits.slice(0,position)+'.'+digits.slice(position);
    return (negative?'-':'')+unsigned;
  }
  function measure(value){
    const text=JSON.stringify(value);if(text===undefined)throw Object.assign(new Error('Invalid account data.'),{kind:'validation'});
    const data=JSON.parse(text);
    function size(item){
      if(item===null)return 4;
      if(typeof item==='number')return expanded(item).length;
      if(typeof item==='boolean')return item?4:5;
      if(typeof item==='string'){
        for(let i=0;i<item.length;i++){const code=item.charCodeAt(i);if(code===0||code>=0xDC00&&code<=0xDFFF||code>=0xD800&&code<=0xDBFF&&!(item.charCodeAt(++i)>=0xDC00&&item.charCodeAt(i)<=0xDFFF))throw Object.assign(new Error('Account text contains an unsupported character. Your original text is unchanged.'),{kind:'validation'});}
        return utf8(JSON.stringify(item));
      }
      if(Array.isArray(item))return 2+Math.max(0,item.length-1)*2+item.reduce((total,child)=>total+size(child),0);
      const keys=Object.keys(item);return 2+Math.max(0,keys.length-1)*2+keys.reduce((total,key)=>total+size(key)+2+size(item[key]),0);
    }
    return {bytes:size(data),limit};
  }
  const api={measure,limit};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WIBAccountSize=api;
})(typeof window!=='undefined'?window:globalThis);

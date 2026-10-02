/* Original prices stay in their original currency; totals never invent exchange rates. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const currencies=Intl.supportedValuesOf?.('currency')||['GBP','EUR','USD','CAD','AUD','NZD','CHF','JPY','CNY','INR','BRL','ZAR','TND','GYD','SRD'];
 function price(record){const p=record?.price;return p&&Number.isFinite(p.amount)&&p.amount>=0&&/^[A-Z]{3}$/.test(p.currency)?p:null;}
 function format(p){if(!p)return '';try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:p.currency}).format(p.amount);}catch{return p.amount.toFixed(2)+' '+p.currency;}}
 function fields(record={}){const p=price(record);return `<div class="form-grid travel-price"><label class="field"><span>Price (optional)</span><input name="priceAmount" type="number" min="0" step="any" inputmode="decimal" value="${p?p.amount:''}"></label><label class="field"><span>Currency</span><select name="priceCurrency">${[...new Set(['GBP',p?.currency,...currencies].filter(Boolean))].map(c=>`<option ${c===(p?.currency||'GBP')?'selected':''}>${c}</option>`).join('')}</select></label></div>`;}
 function read(form){const amount=form.querySelector('[name=priceAmount]')?.value,currency=form.querySelector('[name=priceCurrency]')?.value||'GBP';return amount==null||amount===''?null:{amount:Number(amount),currency};}
 function valid(p){return p&&(!Number.isFinite(p.amount)||p.amount<0||!/^[A-Z]{3}$/.test(p.currency))?'Enter a valid non-negative price and currency.':'';}
 function totals(records){const seen=new Set(),result={};for(const r of records||[]){if(seen.has(r.id))continue;seen.add(r.id);const p=price(r);if(p)result[p.currency]=(result[p.currency]||0)+p.amount;}return result;}
 function summary(records){return Object.entries(totals(records)).map(([currency,amount])=>format({currency,amount})).join(' + ')||'No prices recorded';}
 function detail(record){const p=price(record);if(!p)return '';const to=p.currency==='GBP'?'EUR':'GBP';return `<p class="record-price"><strong>${E(format(p))}</strong></p><label class="field currency-conversion"><span>Convert to</span><select data-xe-target data-amount="${p.amount}" data-from="${p.currency}">${currencies.map(c=>`<option ${c===to?'selected':''}>${c}</option>`).join('')}</select><a data-xe-link href="https://www.xe.com/currencyconverter/convert/?${new URLSearchParams({Amount:p.amount,From:p.currency,To:to})}" target="_blank" rel="noopener noreferrer">Open XE for live rates ↗</a></label>`;}
 if(typeof document!=='undefined')document.addEventListener('change',e=>{const s=e.target.closest('[data-xe-target]');if(s)s.closest('label').querySelector('[data-xe-link]').href='https://www.xe.com/currencyconverter/convert/?'+new URLSearchParams({Amount:s.dataset.amount,From:s.dataset.from,To:s.value});});

 const api={price,format,fields,read,valid,totals,summary,detail,currencies};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVPrices=api;
})(typeof window!=='undefined'?window:globalThis);

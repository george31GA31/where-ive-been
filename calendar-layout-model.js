(function(root){
 'use strict';
 const time=t=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
 function lodging(items,date){const rows=items.filter(a=>a.checkIn<=date&&a.checkOut>=date).map((record,index)=>({record,index,begin:record.checkIn<date?0:time(record.checkInTime),finish:record.checkOut>date?1440:time(record.checkOutTime)}));
   const zones=new Set(rows.map(r=>r.record.timeZone).filter(Boolean)),reliable=rows.length&&zones.size<=1&&rows.every(r=>r.begin!==null&&r.finish!==null&&r.finish>=r.begin);
   rows.sort((a,b)=>reliable?a.begin-b.begin:(a.record.journeyOrder??a.index)-(b.record.journeyOrder??b.index));
   const total=rows.reduce((n,r)=>n+Math.max(1,(r.finish||0)-(r.begin||0)),0);
   return rows.map(r=>({...r,width:reliable?Math.max(1,r.finish-r.begin)/total:1/rows.length}));
 }
 function countries(stays,transports,date){const rows=stays.map((record,index)=>({record,index,at:record.start<date?0:null,end:null}));
   for(const t of transports)for(const l of(t.type==='flight'?(t.legs?.length?t.legs:[t]):[t])){const departure=l.startLocal?.slice(0,10)===date?time(l.startLocal.slice(11)):null,arrival=l.endLocal?.slice(0,10)===date?time(l.endLocal.slice(11)):null;for(const r of rows){if(r.record.countryCode===(l.start?.countryCode||l.start?.countryCodes?.[0])&&departure!==null){r.at??=0;r.end=departure;}if(r.record.countryCode===(l.end?.countryCode||l.end?.countryCodes?.[0])&&arrival!==null)r.at??=arrival;}}
   rows.sort((a,b)=>(a.at??720)-(b.at??720)||a.record.start.localeCompare(b.record.start)||(a.record.tripOrder??a.index)-(b.record.tripOrder??b.index));
   const reliable=rows.length>1&&rows.every(r=>r.at!==null)&&rows.every((r,i)=>!i||r.at>=rows[i-1].at);
   return rows.map((r,i)=>({...r,width:reliable?Math.max(120,(r.end??rows[i+1]?.at??1440)-r.at):1}));
 }
 const api={lodging,countries};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVCalendarLayout=api;
})(typeof window!=='undefined'?window:globalThis);

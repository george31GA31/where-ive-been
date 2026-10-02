(function(root){
 'use strict';
 const time=t=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
 function lodging(items,date){const rows=items.filter(a=>a.checkIn<=date&&a.checkOut>=date).map((record,index)=>({record,index,begin:record.checkIn<date?0:time(record.checkInTime),finish:record.checkOut>date?1440:time(record.checkOutTime)}));
   const zones=new Set(rows.map(r=>r.record.timeZone).filter(Boolean)),reliable=rows.length&&zones.size<=1&&rows.every(r=>r.begin!==null&&r.finish!==null&&r.finish>=r.begin);
   rows.sort((a,b)=>reliable?a.begin-b.begin:(a.record.journeyOrder??a.index)-(b.record.journeyOrder??b.index));
   // Local times order records; they do not stretch boundary stays across an empty half-day.
   if(rows.length===1&&rows[0].record.checkIn<date&&rows[0].record.checkOut>date)return [{...rows[0],width:1,column:1,span:2,columns:[.5,.5]}];
   const halves=[[],[]],unassigned=[];
   for(const r of rows){
     if(r.record.checkIn===date&&r.record.checkOut!==date)halves[1].push(r);
     else if(r.record.checkOut===date&&r.record.checkIn!==date)halves[0].push(r);
     else unassigned.push(r);
   }
   // Concurrent and same-day records share the available row without hiding a record.
   for(const r of unassigned)halves[halves[0].length<=halves[1].length?0:1].push(r);
   const columns=halves.flatMap(half=>Array(Math.max(1,half.length)).fill(.5/Math.max(1,half.length)));
   return rows.map(r=>{const side=halves[0].includes(r)?0:1,index=halves[side].indexOf(r);return {...r,width:.5/halves[side].length,column:(side?Math.max(1,halves[0].length):0)+index+1,span:1,columns};});
 }
 function countries(stays,transports,date){const rows=stays.map((record,index)=>({record,index,at:record.start<date?0:null,end:null}));
   for(const t of transports)for(const l of(t.type==='flight'?(t.legs?.length?t.legs:[t]):[t])){const departure=l.startLocal?.slice(0,10)===date?time(l.startLocal.slice(11)):null,arrival=l.endLocal?.slice(0,10)===date?time(l.endLocal.slice(11)):null,startCode=l.start?.countryCode||l.start?.countryCodes?.[0],endCode=l.end?.countryCode||l.end?.countryCodes?.[0];if(!startCode||!endCode||startCode===endCode)continue;for(const r of rows){if(r.record.countryCode===startCode&&departure!==null){r.at??=0;r.end=departure;}if(r.record.countryCode===endCode&&arrival!==null)r.at??=arrival;}}
   rows.sort((a,b)=>(a.at??720)-(b.at??720)||a.record.start.localeCompare(b.record.start)||(a.record.tripOrder??a.index)-(b.record.tripOrder??b.index));
   const reliable=rows.length>1&&rows.every(r=>r.at!==null)&&rows.every((r,i)=>!i||r.at>=rows[i-1].at);
   return rows.map((r,i)=>({...r,width:reliable?Math.max(120,(r.end??rows[i+1]?.at??1440)-r.at):1}));
 }
 const api={lodging,countries};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVCalendarLayout=api;
})(typeof window!=='undefined'?window:globalThis);

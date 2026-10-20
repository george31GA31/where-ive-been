/* Shared, scoped Calendar date windows for month/year views and daily plans. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,D=node?require('./view-data.js'):root.HVData,J=node?require('./journey-model.js'):root.HVJourney;
  const currentDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const keys=['stays','trips','profiles','residences','transports','accommodations','placeVisits','calendarNotes'];
  const next=(date,n=1)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
  function windowFor(data,start,count=42,profileId=data.activeProfileId){
    if(!J.validDate(start)||!Number.isInteger(count)||count<1||count>370)throw new Error('Invalid Calendar date window.');
    return D.memo(data,'calendar-window',keys,[profileId,start,count,currentDate()].join('|'),()=>{
      const end=next(start,count-1),cancelled=new Set((data.trips||[]).filter(t=>t.status==='cancelled').map(t=>t.id));
      const eligible=r=>r.status!=='cancelled'&&!cancelled.has(r.tripId),scope=rows=>J.scoped(rows,profileId).filter(eligible);
      const {stays,hotels,transports,places}=D.memo(data,'calendar-index:'+profileId,keys.filter(key=>key!=='calendarNotes'),profileId+'|'+currentDate(),()=>{
      const stays=new D.Intervals(scope(data.stays),r=>r.start,r=>r.end||currentDate()),hotels=new D.Intervals(scope(data.accommodations).filter(r=>!J.hiddenHomeRecord(data,r)),r=>r.checkIn||r.checkOut,r=>r.checkOut||r.checkIn);
      const transports=new D.Intervals(J.visibleTransport(data,profileId).filter(r=>!J.hiddenHomeRecord(data,r)),r=>J.transportDates(r)[0],r=>J.transportDates(r).at(-1));
      const places=new D.Intervals(scope(data.placeVisits).filter(r=>r.category==='locations'&&r.status==='visited'&&!J.hiddenHomeRecord(data,r)),r=>r.date,r=>r.endDate||r.date);
        return {stays,hotels,transports,places};
      });
      const notes=new Map();for(const note of scope(Array.isArray(data.notes)?data.notes:[])){if(!J.validDate(note.date))continue;const last=J.validDate(note.endDate)&&note.endDate>=note.date?note.endDate:note.date;if(last<start||note.date>end)continue;for(let day=note.date<start?start:note.date;day<=last&&day<=end;day=next(day)){if(!notes.has(day))notes.set(day,[]);notes.get(day).push(note);}}
      const dates=new Map();
      for(let n=0;n<count;n++){
        const date=next(start,n),all=stays.overlap(date),travel=all.filter(r=>J.isTravelStay(data,r,date,r.profileId||profileId)),homes=all.filter(r=>!J.isDomesticHoliday(r)&&J.isHome(data,r.countryCode,date,r.profileId||profileId));
        const accommodation=hotels.overlap(date),transport=transports.overlap(date),locations=places.overlap(date);
        const actualHome=all.some(r=>J.isActual(r)&&!J.isTravelStay(data,r,date,r.profileId||profileId));
        const away=travel.some(J.countsForPlanning)||transport.length||[...accommodation,...locations].some(r=>J.homeKind(data,r,date,r.profileId||profileId)==='trip'||r.place?.countryCode&&!J.isHome(data,r.place.countryCode,date,r.profileId||profileId));
        const status=away?(actualHome?'mixed':'travel'):actualHome||J.homeCountryCodes(data,profileId,date).length?'home':'unrecorded';
        dates.set(date,{date,stays:travel,homes,sea:all.filter(r=>r.countryCode==='SEA'),transports:transport,accommodations:accommodation,places:locations,notes:notes.get(date)||[],status});
      }
      return dates;
    });
  }
  const api={window:windowFor,next,keys};if(node)module.exports=api;else root.HVCalendarData=api;
})(typeof window!=='undefined'?window:globalThis);

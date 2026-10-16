'use strict';
const {largeAccount}=require('./large-account.cjs');
function calendarHistory(){
  const data=largeAccount(8,4);
  const country=(id,code,name,start,end,tripId='africa')=>({id,profileId:'p',countryCode:code,countryName:name,start,end,tripId,status:'planned',notes:'Keep '+id});
  const hotel=(id,name,checkIn,checkOut,extra={})=>({id,profileId:'p',tripId:'africa',propertyName:name,location:'Original address',checkIn,checkOut,bookingReference:'KEEP-'+id,notes:'Keep accommodation notes',...extra});
  data.trips.push({id:'africa',profileId:'p',name:'North Africa',start:'2026-09-28',end:'2026-11-03',status:'planned'},
    {id:'malta',profileId:'p',name:'Malta in November',start:'2026-11-05',end:'2026-11-08',status:'planned'},
    {id:'cancelled-trip',profileId:'p',name:'Cancelled journey',start:'2026-10-12',end:'2026-10-14',status:'cancelled'});
  data.stays.push(country('algeria','DZ','Algeria','2026-09-28','2026-10-14'),country('tunisia','TN','Tunisia','2026-10-14','2026-10-23'),country('malta','MT','Malta','2026-11-05','2026-11-08','malta'));
  for(const [i,code,name] of [[0,'FR','France'],[1,'CH','Switzerland'],[2,'SI','Slovenia'],[3,'ES','Spain'],[4,'DE','Germany']])data.stays.push(country('many-'+i,code,name,'2026-10-15','2026-10-15'));
  data.accommodations.push(
    hotel('previous','Courtyard Guesthouse','2026-09-28','2026-10-06',{type:'guesthouse'}),
    hotel('first','Grand Canal Hotel','2026-10-06','2026-10-10',{type:'hotel'}),
    hotel('second','Hôtel Belvédère Fourati','2026-10-10','2026-10-14',{type:'hotel'}),
    hotel('house','House sit in Tunis','2026-10-14','2026-10-19',{type:'house-sit'}),
    hotel('next-month','Olive Grove Apartments','2026-10-19','2026-11-03',{type:'apartment'}),
    hotel('overlap-a','Parallel hostel','2026-10-22','2026-10-24',{type:'hostel'}),
    hotel('overlap-b','Parallel guesthouse','2026-10-22','2026-10-24',{type:'guesthouse'}),
    hotel('day-room','Day room','2026-10-25','2026-10-25'),
    hotel('consecutive-a','Same property','2026-10-27','2026-10-28'),
    hotel('consecutive-b','Same property','2026-10-28','2026-10-29'),
    hotel('cancelled','Cancelled accommodation','2026-10-12','2026-10-14',{tripId:'cancelled-trip'}),
    hotel('other-profile','Other traveller accommodation','2026-10-10','2026-10-12',{profileId:'p2',tripId:null})
  );
  data.profiles.push({id:'p2',name:'Other traveller',citizenships:['GB'],homeCountryCodes:['GB']});
  const flight=(id,start,end,date,extra={})=>({id,profileId:'p',tripId:'africa',type:'flight',status:'planned',start:{iata:start,name:start,countryCode:'DZ'},end:{iata:end,name:end,countryCode:'TN'},startLocal:date+'T08:00',endLocal:date+'T10:00',bookingReference:'KEEP-FLIGHT',...extra});
  data.transports.push(flight('alg-tun','ALG','TUN','2026-10-14'),flight('busy-flight','TUN','MLA','2026-10-15'),
    {id:'busy-train',profileId:'p',tripId:'africa',type:'train',status:'planned',start:{name:'Tunis'},end:{name:'Sfax'},startLocal:'2026-10-15T12:00',endLocal:'2026-10-15T14:00'},
    {id:'busy-bus',profileId:'p',tripId:'africa',type:'bus',status:'planned',start:{name:'Sfax'},end:{name:'El Jem'},startLocal:'2026-10-15T15:00',endLocal:'2026-10-15T16:00'},
    flight('standalone-flight','LHR','MAD','2026-10-30',{tripId:null}));
  data.notes.push({id:'important-date',profileId:'p',title:'Apply for visa',body:'Preserve this dated note.',date:'2026-10-12'});
  data.placeVisits.push({id:'saved-location',profileId:'p',category:'locations',status:'visited',date:'2026-10-15',place:{name:'Roman theatre',countryCode:'TN',lat:35.3,lon:10.7}});
  data.visualLayers={calendar:{countries:true,transport:true,accommodation:true}};
  return data;
}
module.exports={calendarHistory};

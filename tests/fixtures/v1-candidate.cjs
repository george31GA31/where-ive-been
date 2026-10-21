'use strict';
const {calendarHistory}=require('./calendar-chronology.cjs');
function candidateHistory(){
 const data=calendarHistory();data.profiles[0].citizenships=[];
 data.privateFixtureMarker={unknown:'round trip'};data.stays[0].unknownPayload={nested:[1,2,3]};
 data.trips.push({id:'south',profileId:'p',name:'Guianas journey',start:'2026-11-08',end:'2026-11-23'});
 for(const [id,code,name,start,end] of [['suriname','SR','Suriname','08','12'],['guiana','GF','French Guiana','12','17'],['guyana','GY','Guyana','17','23']])data.stays.push({id,tripId:'south',profileId:'p',countryCode:code,countryName:name,start:'2026-11-'+start,end:'2026-11-'+end,status:'planned'});
 for(const [id,name,start,end] of [['jungle','Kabalebo Nature Resort','08','12'],['atlantis','Hotel Atlantis','12','17'],['alberga','Guesthouse Albergo Alberga','17','21']])data.accommodations.push({id,tripId:'south',profileId:'p',propertyName:name,location:'Fictional address for layout verification',checkIn:'2026-11-'+start,checkOut:'2026-11-'+end,price:{amount:100,currency:'GBP'},bookingReference:'FICTIONAL-'+id});
 data.transports.push({id:'guianas-flight',profileId:'p',tripId:'south',type:'flight',status:'planned',start:{iata:'PBM',name:'Johan Adolf Pengel',city:'Paramaribo'},end:{iata:'GEO',name:'Cheddi Jagan',city:'Georgetown'},startLocal:'2026-11-17T10:30',endLocal:'2026-11-17T12:45'});
 data.notes.push({id:'south-note',tripId:'south',profileId:'p',title:'Meet the guide at reception',body:'Fictional itinerary reminder',date:'2026-11-17'});
 data.checklists.push({id:'south-packing',tripId:'south',profileId:'p',title:'Packing for the Guianas',items:[{id:'done',text:'Passport',done:true}]});
 return data;
}
module.exports={candidateHistory};

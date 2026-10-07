'use strict';
const Routes = require('../../route-persistence.js');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSe8AAAAASUVORK5CYII=', 'base64');
function largeAccount(count = 160, points = 350) {
  const data = {version:2,activeProfileId:'p',profiles:[{id:'p',name:'Fictional traveller',citizenships:['GB'],homeCountryCodes:['GB'],enabledRules:['schengen']}],stays:[],residences:[],trips:[],accommodations:[],transports:[],notes:[],checklists:[],budgets:[],expenses:[],roadTrips:[],savedPlaces:[],placeVisits:[],manualCountryVisits:[],tccVisits:[]};
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(2018,0,1+i*3)).toISOString().slice(0,10);
    const place = {id:'osm:N:'+i,name:'Fictional hotel '+i,city:'Paris',countryCode:'FR',lat:48.8+i*.002,lon:2.3};
    const src = 'data:image/png;base64,' + Buffer.concat([pixel,Buffer.alloc(3000),Buffer.from(String(i%2 ? i : i%8))]).toString('base64');
    data.trips.push({id:'trip-'+i,profileId:'p',name:'Fictional journey '+i,start:date,end:date,status:'actual'});
    data.stays.push({id:'stay-'+i,tripId:'trip-'+i,profileId:'p',countryCode:'FR',countryName:'France',start:date,end:date,status:'actual'});
    data.accommodations.push({id:'hotel-'+i,tripId:'trip-'+i,profileId:'p',propertyName:place.name,location:'Paris',checkIn:date,checkOut:date,travelKind:'trip',place});
    data.savedPlaces.push({id:'saved-'+i,profileId:'p',place,accommodationIds:['hotel-'+i],accommodationLogo:{updatedAt:'2026-10-07',src}});
    const type=['flight','train','boat','car','bus'][i%5],start={name:'Departure',lat:48,lon:2,countryCode:'FR'},end={name:'Arrival',lat:48.01,lon:2.01,countryCode:'FR'};
    const coordinates=Array.from({length:points},(_,j)=>[48+j*.01/(points-1),2+j*.01/(points-1)]);
    data.transports.push({id:'transport-'+i,tripId:'trip-'+i,profileId:'p',type,start,end,startLocal:date+'T08:00',endLocal:date+'T09:00',status:'actual',resolvedRoutes:{0:{version:1,signature:Routes.signature(type,0,start,end),coordinates,points,label:'Preserved legacy route',resolvedAt:'2026-10-07',refreshToken:''}}});
  }
  data.notes.push({id:'note',profileId:'p',title:'Keep the itinerary',body:'Fictional travel notes'});
  data.checklists.push({id:'checklist',profileId:'p',title:'Packing',items:[{id:'passport',label:'Passport',done:true}]});
  data.budgets.push({id:'budget',profileId:'p',name:'Travel',currency:'GBP'});
  data.expenses.push({id:'expense',profileId:'p',budgetId:'budget',amount:25,currency:'GBP'});
  data.manualCountryVisits.push({id:'manual-country:p:TN',profileId:'p',countryCode:'TN',visited:true,year:2025});
  data.tccVisits.push({id:'tcc-visit:p:tcc-algeria',profileId:'p',destinationId:'tcc-algeria',visited:true});
  return data;
}
module.exports = {largeAccount};

/* Presentation only: keep actual records, controls and explicit editing boundaries. */
(() => {
  'use strict';
  const captions={
    stays:['02 / JOURNEYS','THE JOURNEY INDEX','Find a journey. Pick up the story.'],
    transport:['03 / CONNECTIONS','ON THE MOVE','Every departure. All the details.'],
    places:['05 / PLACES','THE PLACE INDEX','Good places are worth keeping.'],
    stats:['06 / HISTORY','A LIFE IN MOTION','See where the years have taken you.'],
    country:['04 / ATLAS','YOUR PERSONAL HISTORY','A place, and the time you spent there.'],
    countries:['04 / ATLAS','THE COUNTRY INDEX','Your world, place by place.'],
    journeys:['03 / CONNECTIONS','THE JOURNEY MAP','See how the places join up.'],
    tools:['07 / TOOLS','BEFORE YOU GO','Good journeys begin with a few good tools.'],
    notes:['08 / FIELD NOTES','KEEP IT CLOSE','The notes and little things that matter.'],
    budget:['09 / BUDGET','PLAN THE EVERYDAY','Make room for the experiences you came for.'],
    currency:['10 / CURRENCY','MONEY ON THE MOVE','A clearer picture of what things cost.'],
    roadTrip:['11 / ROAD TRIPS','TAKE THE LONG WAY','One route. All the places in between.'],
    schengen:['12 / SCHENGEN','KNOW YOUR WINDOW','Time to stay. Time to move on.'],
    stayPlanner:['13 / STAY PLANNER','BEFORE YOU BOOK','Find the dates that work for your journey.'],
    rules:['14 / ENTRY','ARRIVE PREPARED','The practical checks before a new place.'],
    profiles:['15 / TRAVELLERS','WHO IS COMING?','Every traveller has their own story.'],
    homes:['16 / HOME BASES','A PLACE TO RETURN TO','Keep the places you call home in the picture.'],
    settings:['17 / PREFERENCES','MAKE IT YOURS','Settle into your own way of travelling.'],
    planner:['18 / ITINERARIES','FROM IDEA TO ITINERARY','Give the journey a shape of its own.']
  };
  const rows='.trip-group,#personalPlaces .reference-row,.personal-travel-stat,.transport-row,.travel-tool-link,.travel-note-card,.travel-checklist-card,.saved-currency-rate,.saved-road-card,.profile-card,.atlas-country,.journey-library-card';
  let mutation,intersection,pending=false,observedView,pointFrame=0,pointRow=null;
  const pendingRows=new Set();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const allowsMotion=()=>!reduced.matches&&document.documentElement.dataset.experienceMotion==='on';
  function cover(group){
    if(group.querySelector('.motion-trip-cover'))return;
    const id=group.querySelector('[data-trip-open]')?.dataset.tripOpen;
    if(!id||typeof state==='undefined')return;
    const trip=HVJourney.scoped(state.trips||[],state.activeProfileId).find(row=>row.id===id);
    const photo=trip?.coverPhotoId&&(trip.photos||[]).find(row=>row.id===trip.coverPhotoId);
    if(!photo||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.src))return;
    const image=document.createElement('img');image.className='motion-trip-cover';image.src=photo.src;image.alt=photo.name||'Your chosen trip cover';image.loading='lazy';image.decoding='async';
    group.querySelector('.trip-group-head')?.after(image);
  }
  function decorate(){
    pending=false;
    const view=document.body.dataset.currentView,host=document.querySelector('.view.active');
    if(!host)return;
    for(const row of pendingRows)if(!row.isConnected||!host.contains(row)){intersection?.unobserve(row);pendingRows.delete(row);}
    host.dataset.motionWorkspace=view;
    const words=captions[view];
    if(words&&!host.querySelector('.motion-workspace-caption')){
      const intro=document.createElement('div');intro.className='motion-workspace-caption';
      const copy=document.createElement('div'),overline=document.createElement('p'),line=document.createElement('p'),index=document.createElement('span');
      overline.className='eyebrow';overline.textContent=words[1];line.textContent=words[2];index.className='motion-workspace-number';index.textContent=words[0];index.setAttribute('aria-hidden','true');copy.append(overline,line);intro.append(copy,index);
      const location=host.querySelector(':scope>.page-location');location?location.after(intro):host.prepend(intro);
    }
    [...host.querySelectorAll('.trip-group')].forEach((group,i)=>{
      if(!group.querySelector('.motion-trip-number')){const number=document.createElement('span');number.className='motion-trip-number';number.textContent=String(i+1).padStart(2,'0');number.setAttribute('aria-hidden','true');group.prepend(number);}
      cover(group);
    });
    [...host.querySelectorAll('.travel-tool-link')].forEach((link,i)=>{
      if(!link.querySelector('.motion-tool-index')){const index=document.createElement('span');index.className='motion-tool-index';index.textContent=String(i+1).padStart(2,'0');index.setAttribute('aria-hidden','true');link.prepend(index);}
    });
    [...host.querySelectorAll(rows)].forEach(row=>{
      row.classList.add('motion-row');
      row.dataset.motionRowReady='true';
      if(!row.dataset.motionRowVisible&&!pendingRows.has(row)){if(intersection&&pendingRows.size<120){pendingRows.add(row);intersection.observe(row);}else row.dataset.motionRowVisible='true';}
    });
    if(observedView!==host){mutation?.disconnect();mutation?.observe(host,{childList:true,subtree:true});observedView=host;}
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(decorate);}
  function boot(){
    if(document.body.dataset.accountPage||!window.HVPages||window.HVMotionWorkspaces)return;
    if('IntersectionObserver'in window)intersection=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.dataset.motionRowVisible='true';pendingRows.delete(entry.target);intersection.unobserve(entry.target);}}),{rootMargin:'48px'});
    mutation=new MutationObserver(schedule);
    window.addEventListener('hv-route',schedule);window.addEventListener('hv-data-changed',schedule);
    const render=window.renderAll;window.renderAll=function(...args){const result=render.apply(this,args);schedule();return result;};
    document.addEventListener('pointermove',event=>{
      if(!allowsMotion()||event.pointerType==='touch')return;
      const row=event.target.closest('.motion-row');
      if(pointRow&&pointRow!==row){pointRow.style.removeProperty('--mw-pointer-x');pointRow.style.removeProperty('--mw-pointer-y');}pointRow=row;
      if(!row||pointFrame)return;
      pointFrame=requestAnimationFrame(()=>{pointFrame=0;if(!row.isConnected||pointRow!==row)return;const box=row.getBoundingClientRect();row.style.setProperty('--mw-pointer-x',(event.clientX-box.left)+'px');row.style.setProperty('--mw-pointer-y',(event.clientY-box.top)+'px');});
    },{passive:true});
    decorate();window.HVMotionWorkspaces={refresh:decorate};
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

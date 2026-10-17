/* A bounded search index; navigating results uses the same dates and record drawers. */
function calendarSearchRows() {
  return HVData.memo(state,'calendar-search',['stays','accommodations','transports','calendarNotes','placeVisits','trips'],state.activeProfileId,() => {
    const cancelled=new Set((state.trips||[]).filter(t=>t.status==='cancelled').map(t=>t.id));
    const rows=[];
    const add=(kind,record,date,title,text)=>{
      if(record.status==='cancelled'||cancelled.has(record.tripId)||!HVJourney.validDate(date))return;
      rows.push({kind,id:record.id,date,title,text:HVTransportDashboardModel.norm([title,text].join(' '))});
    };
    for(const s of scoped(state.stays||[]))add('country',s,s.start,s.countryName,[s.location,s.notes].join(' '));
    for(const a of scoped(state.accommodations||[]))add('accommodation',a,a.checkIn||a.checkOut,a.propertyName,[HVAddress.address(a.place),HVAddress.text(a.location),a.notes].join(' '));
    for(const t of scoped(state.transports||[]))add('transport',t,HVJourney.transportDates(t)[0],HVJourneys.transportLabel(t),[t.flightNumber,HVTransportDashboardModel.providerName(t.airline||t.operator),t.serviceNumber,t.notes,t.start?.name,t.start?.iata,t.start?.icao,t.end?.name,t.end?.iata,t.end?.icao,...(t.legs||[]).map(l=>[l.flightNumber,l.airline?.name,l.start?.name,l.end?.name].join(' '))].join(' '));
    for(const n of scoped(Array.isArray(state.notes)?state.notes:[]))add('note',n,n.date,n.title||'Note',n.body);
    for(const p of scoped(state.placeVisits||[]))if(p.category==='locations'&&p.status==='visited')add('location',p,p.date,HVAddress.field(p.place,'name')||'Saved location',[HVAddress.address(p.place),p.notes].join(' '));
    return rows.sort((a,b)=>b.date.localeCompare(a.date));
  });
}

function renderCalendarSearch() {
  const input=$('calendarSearchInput'),host=$('calendarSearchResults');
  if(!input||!host)return;
  const term=HVTransportDashboardModel.norm(input.value);
  if(term.length<2){host.innerHTML='<p>Type at least two characters to find a recorded journey, stay or memory.</p>';return;}
  const matches=calendarSearchRows().filter(row=>row.text.includes(term)),visible=matches.slice(0,20);
  host.innerHTML=`<p>${matches.length} ${matches.length===1?'match':'matches'}${matches.length>20?' · showing the 20 most recent':''}</p>`+visible.map(row=>`<button type="button" ${entryAttributes(row.kind,row.id,row.date)} data-calendar-search-result-date="${row.date}"><span><strong>${E(row.title)}</strong><small>${E(calendarKinds.find(item=>item[2]===row.kind)?.[1]||'Entry')} · ${E(dateText(row.date))}</small></span><span aria-hidden="true">↗</span></button>`).join('');
}

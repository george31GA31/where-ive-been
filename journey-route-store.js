/* Saved route geometry belongs to the transport record, not the map session. */
(function(root){
  'use strict';

  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const point=p=>{
    if(!p||typeof p!=='object')return null;
    const lat=Number(p.lat),lon=Number(p.lon);
    return {
      id:p.id||p.placeId||p.airportId||null,
      name:String(p.name||'').trim(),
      address:String(p.address||'').trim(),
      iata:String(p.iata||'').trim().toUpperCase(),
      icao:String(p.icao||'').trim().toUpperCase(),
      lat:Number.isFinite(lat)?Number(lat.toFixed(6)):null,
      lon:Number.isFinite(lon)?Number(lon.toFixed(6)):null
    };
  };
  const legSignature=(type,start,end)=>JSON.stringify({type:String(type||'other'),start:point(start),end:point(end)});
  const transportSignature=record=>{
    const legs=(record?.legs||[]).map(l=>({start:point(l.start),end:point(l.end)}));
    return JSON.stringify({
      type:String(record?.type||'other'),
      start:point(record?.start),
      via:(record?.via||[]).map(point),
      end:point(record?.end),
      legs
    });
  };
  function validCoordinates(value){
    return Array.isArray(value)&&value.length>=2&&value.length<=100000&&value.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))&&Number(p[0])>=-90&&Number(p[0])<=90&&Number(p[1])>=-180&&Number(p[1])<=180);
  }
  function read(record,index,type,start,end){
    const saved=record?.routeGeometry?.legs?.[index];
    if(!saved||saved.signature!==legSignature(type,start,end)||!validCoordinates(saved.coordinates))return null;
    return copy(saved);
  }
  function write(record,index,type,start,end,result={}){
    if(!record||!Number.isInteger(index)||index<0||!validCoordinates(result.coordinates))return false;
    const next={
      signature:legSignature(type,start,end),
      coordinates:result.coordinates.map(p=>[Number(p[0]),Number(p[1])]),
      label:String(result.label||'Saved route'),
      illustrative:!!result.illustrative,
      source:String(result.source||'resolved')
    };
    const current=record.routeGeometry?.legs?.[index];
    const same=current&&current.signature===next.signature&&current.label===next.label&&current.illustrative===next.illustrative&&current.source===next.source&&JSON.stringify(current.coordinates)===JSON.stringify(next.coordinates);
    if(same)return false;
    const legs=Array.isArray(record.routeGeometry?.legs)?record.routeGeometry.legs.slice():[];
    legs[index]=next;
    record.routeGeometry={version:1,updatedAt:new Date().toISOString(),transportSignature:transportSignature(record),legs};
    return true;
  }
  function clear(record){
    if(!record?.routeGeometry)return false;
    delete record.routeGeometry;
    return true;
  }
  function stale(record){
    return !!record?.routeGeometry&&record.routeGeometry.transportSignature!==transportSignature(record);
  }
  const api={point,legSignature,transportSignature,validCoordinates,read,write,clear,stale};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteStore=api;
})(typeof window!=='undefined'?window:globalThis);

/* Persist resolved Journey Map geometry on the transport record. */
(function(root){
  'use strict';
  const VERSION=1,copy=value=>value==null?value:JSON.parse(JSON.stringify(value)),finite=value=>Number.isFinite(Number(value));
  function point(value={}){return[finite(value.lat)?Number(value.lat).toFixed(6):'',finite(value.lon)?Number(value.lon).toFixed(6):'',String(value.airportId||value.id||''),String(value.iata||''),String(value.icao||''),String(value.name||''),String(value.terminal||''),String(value.address||'')];}
  function signature(type,index,start,end){return JSON.stringify([VERSION,String(type||'other'),Number(index)||0,point(start),point(end)]);}
  function validCoordinates(coords){return Array.isArray(coords)&&coords.length>=2&&coords.every(p=>Array.isArray(p)&&p.length>=2&&finite(p[0])&&finite(p[1]));}
  function get(record,index,type,start,end){const saved=record?.resolvedRoutes?.[String(Number(index)||0)];if(!saved||saved.version!==VERSION||saved.signature!==signature(type,index,start,end)||!validCoordinates(saved.coordinates))return null;return copy(saved);}
  function set(record,index,type,start,end,result={}){if(!record||!validCoordinates(result.coordinates))return null;if(!record.resolvedRoutes||typeof record.resolvedRoutes!=='object')record.resolvedRoutes={};const key=String(Number(index)||0),saved={version:VERSION,signature:signature(type,index,start,end),coordinates:result.coordinates.map(p=>[Number(p[0]),Number(p[1])]),label:String(result.label||'Saved route'),illustrative:!!result.illustrative,unavailable:!!result.unavailable,resolvedAt:new Date().toISOString()};record.resolvedRoutes[key]=saved;return copy(saved);}
  function clear(record){if(record&&record.resolvedRoutes)delete record.resolvedRoutes;}
  const api={VERSION,signature,validCoordinates,get,set,clear};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteStore=api;
})(typeof window!=='undefined'?window:globalThis);

/* Persist resolved Journey Map geometry on the transport record without repeatedly querying routing services. */
(function(root){
  'use strict';
  const VERSION=1,copy=value=>value==null?value:JSON.parse(JSON.stringify(value)),finite=value=>value!==null&&value!==''&&typeof value!=='boolean'&&Number.isFinite(Number(value));
  function point(value={}){return[finite(value.lat)?Number(value.lat).toFixed(6):'',finite(value.lon)?Number(value.lon).toFixed(6):'',String(value.airportId||value.id||''),String(value.iata||''),String(value.icao||''),String(value.name||''),String(value.terminal||''),String(value.address||'')];}
  function signature(type,index,start,end){return JSON.stringify([VERSION,String(type||'other'),Number(index)||0,point(start),point(end)]);}
  function validCoordinates(coords){return Array.isArray(coords)&&coords.length>=2&&coords.every(p=>Array.isArray(p)&&p.length>=2&&finite(p[0])&&finite(p[1]));}
  function encode(coords){let lastLat=0,lastLon=0,out='';const push=delta=>{let value=delta<0?(-delta*2-1):delta*2;while(value>=32){out+=String.fromCharCode((32+(value%32))+63);value=Math.floor(value/32);}out+=String.fromCharCode(value+63);};for(const p of coords){const lat=Math.round(Number(p[0])*1e7),lon=Math.round(Number(p[1])*1e7);push(lat-lastLat);push(lon-lastLon);lastLat=lat;lastLon=lon;}return out;}
  function decode(text){let index=0,lat=0,lon=0,out=[];const next=()=>{let result=0,multiplier=1,b,count=0;do{if(index>=text.length||++count>12)throw new Error('Invalid saved route');b=text.charCodeAt(index++)-63;if(b<0||b>63)throw new Error('Invalid saved route');result+=(b%32)*multiplier;multiplier*=32;}while(b>=32);return result%2?-(Math.floor(result/2)+1):Math.floor(result/2);};while(index<text.length){lat+=next();lon+=next();out.push([lat/1e7,lon/1e7]);}return out;}
  function coordinates(saved){if(validCoordinates(saved?.coordinates))return saved.coordinates.map(p=>[Number(p[0]),Number(p[1])]);if(typeof saved?.polyline==='string'&&saved.polyline){try{const value=decode(saved.polyline);if(validCoordinates(value))return value;}catch{}}return null;}
  function get(record,index,type,start,end,allowPrevious=false){const saved=record?.resolvedRoutes?.[String(Number(index)||0)],coords=coordinates(saved)||(saved?.unavailable&&saved.points===0&&saved.polyline===''?[]:null);if(!saved||saved.version!==VERSION||saved.signature!==signature(type,index,start,end)||!coords||(!allowPrevious&&(saved.refreshToken||'')!==(record.routeRefreshToken||'')))return null;return{...copy(saved),coordinates:coords};}
  function set(record,index,type,start,end,result={}){
    if(!record)return null;
    const previous=get(record,index,type,start,end,true),key=String(Number(index)||0);
    // A deliberate retry must not replace a useful saved route with a failed lookup.
    if(previous&&!previous.unavailable&&(result.unavailable||!validCoordinates(result.coordinates))){record.resolvedRoutes[key]={...record.resolvedRoutes[key],refreshToken:record.routeRefreshToken||'',refreshFailedAt:new Date().toISOString()};return get(record,index,type,start,end);}
    if(!validCoordinates(result.coordinates)&&!(result.unavailable&&Array.isArray(result.coordinates)&&result.coordinates.length===0))return null;
    if(!record.resolvedRoutes||typeof record.resolvedRoutes!=='object')record.resolvedRoutes={};
    const coords=result.coordinates.map(p=>[Number(p[0]),Number(p[1])]),saved={version:VERSION,signature:signature(type,index,start,end),polyline:encode(coords),points:coords.length,label:String(result.label||'Saved route'),illustrative:!!result.illustrative,unavailable:!!result.unavailable,resolvedAt:new Date().toISOString(),refreshToken:record.routeRefreshToken||''};record.resolvedRoutes[key]=saved;
    // Draw the same centimetre-precision geometry that reloads and other devices use.
    return get(record,index,type,start,end);
  }
  function requestRefresh(record){if(record)record.routeRefreshToken=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
  function clear(record){if(record&&record.resolvedRoutes)delete record.resolvedRoutes;}
  const api={VERSION,signature,validCoordinates,encode,decode,get,set,clear,requestRefresh};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteStore=api;
})(typeof window!=='undefined'?window:globalThis);

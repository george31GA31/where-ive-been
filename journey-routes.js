/* Route geometry only. No country, stay, residence or statistic mutations. */
(function(root){
  'use strict';
  const point=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
  const distance=(a,b)=>{const r=Math.PI/180,x=(b[0]-a[0])*r,y=(b[1]-a[1])*r,h=Math.sin(x/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  function flightArc(a,b){
    let end=b.lon;while(end-a.lon>180)end-=360;while(end-a.lon< -180)end+=360;
    const dx=end-a.lon,dy=b.lat-a.lat,bend=Math.min(8,Math.hypot(dx,dy)*.16),length=Math.hypot(dx,dy)||1;
    return Array.from({length:49},(_,i)=>{const t=i/48,k=4*t*(1-t);return [a.lat+dy*t+dx/length*bend*k,a.lon+dx*t-dy/length*bend*k];});
  }
  function mappedPath(elements,start,end){
    // Follow connected OSM route geometry; never bridge gaps with invented track.
    const graph=new Map(),coords=new Map(),key=p=>p.map(v=>v.toFixed(6)).join(',');
    for(const element of elements||[])for(const way of element.members||[]){const geometry=(way.geometry||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>[p.lat,p.lon]);for(let i=1;i<geometry.length;i++){
      const a=geometry[i-1],b=geometry[i],ka=key(a),kb=key(b),d=distance(a,b);coords.set(ka,a);coords.set(kb,b);if(!graph.has(ka))graph.set(ka,[]);if(!graph.has(kb))graph.set(kb,[]);graph.get(ka).push([kb,d]);graph.get(kb).push([ka,d]);
    }}
    if(!coords.size||coords.size>60000)return null;
    const nearest=p=>[...coords].map(([k,c])=>[k,distance(c,[p.lat,p.lon])]).sort((a,b)=>a[1]-b[1])[0];
    const a=nearest(start),b=nearest(end);if(a[1]>2500||b[1]>2500)return null;
    const costs=new Map([[a[0],0]]),previous=new Map(),queue=[[0,a[0]]];
    // Binary heap for long railway relations.
    const push=v=>{queue.push(v);let i=queue.length-1;while(i){const p=(i-1)>>1;if(queue[p][0]<=v[0])break;queue[i]=queue[p];i=p;}queue[i]=v;};
    const pop=()=>{const out=queue[0],last=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let j=i*2+1;if(j+1<queue.length&&queue[j+1][0]<queue[j][0])j++;if(queue[j][0]>=last[0])break;queue[i]=queue[j];i=j;}queue[i]=last;}return out;};
    while(queue.length){const [cost,k]=pop();if(cost!==costs.get(k))continue;if(k===b[0])break;for(const [next,d] of graph.get(k)||[])if(cost+d<(costs.get(next)??Infinity)){costs.set(next,cost+d);previous.set(next,k);push([cost+d,next]);}}
    if(!costs.has(b[0]))return null;const path=[];let k=b[0];while(k){path.push(coords.get(k));if(k===a[0])break;k=previous.get(k);}return path.reverse();
  }
  const api={point,distance,flightArc,mappedPath};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
